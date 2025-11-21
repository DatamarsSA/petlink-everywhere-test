import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpSocketClient, SentinelPacketType } from "../../../clients/sentinel/client-sentinel.js";
import { Packet01, SirfProtocol } from "../../../clients/sentinel/packet-encode-decode.js";
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
  });

  afterAll(() => {
    logger.info("🧹 Cleaning up...");
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("Activate live tracking and should receive position updates", async () => {
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;

    logger.info("📍 STEP 1: Register device on Sentinel socketMap (send initial Packet 0x01)");
    // Rust-like: Create packet instance directly (no factory)
    const welcomePacketObj = new Packet01(deviceSerialNumber, 44.5024, 11.3463, 4200, 22);
    const welcomePayload = welcomePacketObj.toBuffer();
    const welcomePacket = SirfProtocol.encapsulate(welcomePayload);
    await sentinelTcpSocketClient.send(welcomePacket, welcomePacketObj);
    logger.info("✓ Device registered on Sentinel cache map");

    logger.info("📍 STEP 2: Subscribe to position updates via GraphQl Sub WebSocket");
    let positionsReceived: GpsMessagePosition | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessagePosition,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.info("📡 GraphQlSocket event received", { event });
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
    sentinelTcpSocketClient.clearBuffer();
    let commandSentToDevice = CommandEnum.LiveTracking;
    let durationCommandSentToDevice = 900;
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

    logger.info("📍 STEP 4: Verify device received Packet 0x0A (LIVE_TRACKING command)");

    const commandPacket = await sentinelTcpSocketClient.waitForPacket(SentinelPacketType.PACKET_0x0A, 5000);
    expect(commandPacket, "Should receive Packet 0x0A (LIVE_TRACKING command)").toBeDefined();
    expect(commandPacket.type).toBe(SentinelPacketType.PACKET_0x0A);
    expect(commandPacket.payload, "Should parse Packet 0x0A").toBeDefined();
    logger.info(`✓ Device received LIVE_TRACKING command`, { parsed: commandPacket.payload });

    logger.info("📍 STEP 5: Simulate device sending 1 Packet 0x01");
    let latutideSentoFromDevice = 44.5024;
    let longitudeSentoFromDevice = 11.3463;
    let batterySentoFromDevice = 4200;
    let temperatureSentoFromDevice = 22;
    // Rust-like: Create packet instance directly
    const heartbeatPacketObj = new Packet01(
      deviceSerialNumber,
      latutideSentoFromDevice,
      longitudeSentoFromDevice,
      batterySentoFromDevice,
      temperatureSentoFromDevice,
    );
    const heartbeatPayload = heartbeatPacketObj.toBuffer();
    const heartbeatPacket = SirfProtocol.encapsulate(heartbeatPayload);
    await sentinelTcpSocketClient.send(heartbeatPacket, heartbeatPacketObj);
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

    logger.info("📍 STEP 8: Verify device received Packet 0x0A (LIVE_TRACKING deactivation command)");

    const deactivationPacket = await sentinelTcpSocketClient.waitForPacket(SentinelPacketType.PACKET_0x0A, 3000);

    expect(deactivationPacket, "Should receive Deactivation Packet").toBeDefined();
    logger.info(`✓ Device received LIVE_TRACKING deactivation command`, { parsed: deactivationPacket.payload });
  });
});
