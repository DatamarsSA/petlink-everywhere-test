import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { Packet01, PacketType, OperatingStatus } from "../../../clients/sentinel/packet-encode-decode.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { CommandEnum, GpsMessagePosition, ModeType } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";

describe("Live Tracking", () => {
  let setup: TestSetup = {} as TestSetup;
  let positionsReceived: GpsMessagePosition | null = null;
  let latutideSentoFromDevice = 44.5024;
  let longitudeSentoFromDevice = 11.3463;
  let subscriptionPromise: Promise<void>;

  beforeAll(async () => {
    // STEP 1: Create user, pet, device, and purchase subscription
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    // STEP 2: Connect to Sentinel TCP server
    await sentinelTcpSocketClient.connect();
    // STEP 3: Start aggressive keep-alive to prevent socket disconnection
    await sentinelTcpSocketClient.startKeepAlive(setup.devices.dogStandard!.serialNumber);
  });

  afterAll(() => {
    sentinelTcpSocketClient.stopKeepAlive();
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("Subscribe to position updates via GraphQLSocket onGpsMessagePosition", async () => {
    logger.info("📍 STEP 1: Subscribe to position updates via GraphQl Sub WebSocket");

    subscriptionPromise = petlink.core.graphqlWS.authJwt
      .subscribeUntil(
        subscriptions.onGpsMessagePosition,
        { id: setup.devices.dogStandard!.id },
        fxt.socket.timeoutMs,
        "Device should send position matching our test coordinate",
        (data) => {
          const position = data?.onGpsMessagePosition;
          // Validate that this is the position we sent (ignore interim LBS/Status messages with lat=0)
          return position && position.position.lat === latutideSentoFromDevice;
        }
      )
      .then((event) => {
        logger.info("📡 GraphQlSocket event received -> onGpsMessagePosition", { event });
        positionsReceived = event.onGpsMessagePosition;
      });
  });

  it("Activate Live Tracking via GraphQL and verify success", async () => {
    logger.info("📍 STEP 2: Activate Live Tracking via sendCommand()");
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
  });

  it("Verify device received Packet 0x01 (LIVE_TRACKING command)", async () => {
    logger.info("📍 STEP 3: Verify device received Packet 0x01 (LIVE_TRACKING command)");
    const commandPacket = await sentinelTcpSocketClient.waitForPacket(
      PacketType.PACKET_0x01,
      fxt.socket.timeoutMs,
      (p) => p.requested_operating_status === OperatingStatus.FAST_TRACKING,
    );
    expect(commandPacket.requested_operating_status, "Received packet should have requested_operating_status = FAST_TRACKING").toBe(
      OperatingStatus.FAST_TRACKING,
    );
    logger.info(`✓ Device received LIVE_TRACKING command`, { parsed: commandPacket });
  });

  it("Simulate device sending Packet 0x01 and verify position via subscription", async () => {
    logger.info("📍 STEP 4: Simulate device sending 1 Packet 0x01 (WelcomeHeartBeat) with position update");
    let batterySentoFromDevice = 4200;
    let temperatureSentoFromDevice = 22;
    const heartbeatData = {
      ...Packet01.D2SWelcomeHeartBeat.Data,
      serial_number: setup.devices.dogStandard!.serialNumber,
      latitude: latutideSentoFromDevice,
      longitude: longitudeSentoFromDevice,
      battery: batterySentoFromDevice,
      temperature: temperatureSentoFromDevice,
      notifications: Packet01.D2SWelcomeHeartBeat.Notifications.NOutsideFence,
      last_gps_time: Math.floor(Date.now() / 1000),
    };
    await sentinelTcpSocketClient.send(Packet01.D2SWelcomeHeartBeat.toBuffer(heartbeatData), heartbeatData);
    logger.info("✓ Packet 0x01 #1 sent");

    logger.info("📍 STEP 5: Wait for positions to arrive via GraphQLWebSocket on app");
    await subscriptionPromise;

    logger.info("positionsReceived: ", positionsReceived);
    expect(positionsReceived).not.toBeNull();
    expect(positionsReceived!.position.lat, "Latitude should match").toBe(latutideSentoFromDevice);
    expect(positionsReceived!.position.lng, "Longitude should match").toBe(longitudeSentoFromDevice);
    logger.info("✓ Received position via WebSocket", {
      lat: positionsReceived!.position.lat,
      lng: positionsReceived!.position.lng,
    });
  });

  it("Deactivate Live Tracking and verify device response", async () => {
    logger.info("📍 STEP 7: Deactivate Live Tracking");
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

    const deactivationPacket = await sentinelTcpSocketClient.waitForPacket(
      PacketType.PACKET_0x01,
      fxt.socket.timeoutMs,
      (p) => p.requested_operating_status === OperatingStatus.DEFAULT,
    );
    expect(deactivationPacket.requested_operating_status, "Received deactivation packet should have requested_operating_status = DEFAULT").toBe(
      OperatingStatus.DEFAULT,
    );
    logger.info(`✓ Device received LIVE_TRACKING deactivation command`, { parsed: deactivationPacket });
  });
});
