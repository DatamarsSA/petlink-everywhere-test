import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { OperatingStatus, Packet01D2S, Packet01S2D, PacketType } from "../../../clients/sentinel/packet-encode-decode.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { CommandEnum, GpsMessagePosition, ModeType } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";

describe("User Mode - Live Tracking", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    logger.info("🔌 Setting up test environment...");
    // STEP 1: Create user, pet, device, and purchase subscription
    logger.info("📍 Creating test user, pet, device, and purchasing subscription");
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();

    logger.info("✓ Test setup complete", {
      userId: setup.user!.id,
      petId: setup.pets.dog!.id,
      deviceId: setup.devices.dogStandard!.id,
      deviceSerialNumber: setup.devices.dogStandard!.serialNumber,
      subscriptionId: setup.devices.dogStandard!.subscriptionId,
    });

    // STEP 2: Connect to Sentinel TCP server
    logger.info("🔌 Connecting to Sentinel TCP server...");
    await sentinelTcpSocketClient.connect();
    logger.info("✓ Connected to Sentinel TCP server");

    logger.info("📍 STEP 1: Sending Handshake Packet to Sentinel");
    await sentinelTcpSocketClient.keepAlive(setup.devices.dogStandard!.serialNumber);
    logger.info("✓ Handshake complete");
  });

  afterAll(() => {
    logger.info("🧹 Cleaning up...");
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("Activate live tracking and should receive position updates", async () => {
    logger.info("📍 STEP 2: Subscribe to position updates via GraphQl Sub WebSocket");
    let positionsReceived: GpsMessagePosition | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessagePosition,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.info("📡 GraphQlSocket event received -> onGpsMessagePosition", { event });
            const position = event.data?.onGpsMessagePosition;
            if (position) {
              positionsReceived = position;
              logger.info(`✓ Position received: `, {
                lat: position.position?.lat,
                lng: position.position?.lng,
              });
              resolve();
            }
          },
          error: (error: any) => {
            logger.error("❌ WebSocket subscription error", { error: error.message });
            reject(error);
          },
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    logger.info("📍 STEP 3: Activate Live Tracking via GraphQL");
    let commandSentToDevice = CommandEnum.LiveTracking;
    let durationCommandSentToDevice = 900;
    // HANDSHAKE: Ensure device is connected before starting the test flow
    logger.info("📍 STEP 1: Sending Handshake Packet to Sentinel");
    const handshakePacket = {
      ...Packet01D2S.Data,
      serialNumber: setup.devices.dogStandard!.serialNumber,
    };
    await sentinelTcpSocketClient.send(Packet01D2S.toBuffer(handshakePacket), handshakePacket);
    logger.info("✓ Handshake complete");
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: commandSentToDevice,
        id: setup.devices.dogStandard!.id,
        duration: durationCommandSentToDevice,
        modeType: ModeType.Sentinel,
      },
    });
    expect(
      activateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${activateResponse.sendCommand.message}${activateResponse.sendCommand.translationCode ? ` (${activateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");
    logger.info("✓ Sent command 'LIVE_TRACKING' to core");

    logger.info("📍 STEP 4: Verify device received Packet 0x01 (LIVE_TRACKING command)");
    const commandPacket = await sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x01, 5000);
    expect(commandPacket, "Should receive Packet 0x01 (LIVE_TRACKING command)").toBeDefined();
    expect(commandPacket.requestedOperatingStatus).toBe(OperatingStatus.FAST_TRACKING);

    logger.info(`✓ Device received LIVE_TRACKING command`, { parsed: commandPacket });

    logger.info("📍 STEP 5: Simulate device sending 1 Packet 0x01");
    let latutideSentoFromDevice = 44.5024;
    let longitudeSentoFromDevice = 11.3463;
    let batterySentoFromDevice = 4200;
    let temperatureSentoFromDevice = 22;
    const heartbeatData = {
      ...Packet01D2S.Data,
      serialNumber: setup.devices.dogStandard!.serialNumber,
      latitude: latutideSentoFromDevice,
      longitude: longitudeSentoFromDevice,
      battery: batterySentoFromDevice,
      temperature: temperatureSentoFromDevice,
    };
    await sentinelTcpSocketClient.send(Packet01D2S.toBuffer(heartbeatData), heartbeatData);
    logger.info("✓ Packet 0x01 #1 sent");

    logger.info("📍 STEP 6: Wait for positions to arrive via WebSocket");
    await subscriptionPromise;

    logger.info("positionsReceived: ", positionsReceived);
    expect(positionsReceived).not.toBeNull();
    expect(positionsReceived!.position.lat, "Latitude should match").toBe(latutideSentoFromDevice);
    expect(positionsReceived!.position.lng, "Longitude should match").toBe(longitudeSentoFromDevice);
    logger.info("✓ Received position via WebSocket", {
      lat: positionsReceived!.position.lat,
      lng: positionsReceived!.position.lng,
    });

    logger.info("📍 STEP 7: Deactivate Live Tracking");
    // sentinelTcpClient.clearBuffer();
    let commandSentToDeviceDeactivate = CommandEnum.LiveTracking;
    let durationCommandSentToDeviceDeactivate = 0;
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: commandSentToDeviceDeactivate,
        id: setup.devices.dogStandard!.id,
        duration: durationCommandSentToDeviceDeactivate,
        modeType: ModeType.Sentinel,
      },
    });

    expect(
      deactivateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");
    logger.info("✓ Live Tracking deactivated");

    logger.info("📍 STEP 8: Verify device received Packet 0x01 (LIVE_TRACKING deactivation command)");

    const deactivationPacket = await sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x01, 3000);

    expect(deactivationPacket, "Should receive Deactivation Packet").toBeDefined();
    expect(deactivationPacket.requestedOperatingStatus).toBe(OperatingStatus.DEFAULT);
    logger.info(`✓ Device received LIVE_TRACKING deactivation command`, { parsed: deactivationPacket });
  });
});
