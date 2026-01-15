import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { PacketType, OperatingStatus } from "../../../clients/sentinel/packets.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { CommandEnum, ModeType, StatusState } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";

describe("Live Tracking", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await sentinelTcpSocketClient.connectAndHandshake(setup.devices.dogStandard!);
  });

  afterAll(() => {
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("User ACTIVATE Live Tracking (sendCommand duration=900) -> packet should arrives to device AND app receives LiveTracking Status ON", async () => {
    logger.info("📍 User activates Live Tracking");

    // 1. Start listening from App
    const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      "Should receive status update with liveTracking=ON",
      (data) => data?.onGpsMessageStatus?.status?.liveTracking === StatusState.On,
    );

    // 2. Setup listener for device packet
    logger.info("⏳ Device waiting for 0x01 (FAST_TRACKING)...");
    const commandPacketPromise = sentinelTcpSocketClient.waitForPacket(
      PacketType.PACKET_0x01,
      (p) => p.requested_operating_status === OperatingStatus.FAST_TRACKING,
    );

    // 3. Send ACTIVATE LT from app
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.devices.dogStandard!.id,
        duration: 900,
        modeType: ModeType.Sentinel,
      },
    });
    expect(activateResponse.sendCommand.code).toBe("200");

    // 4. Device wait for packet
    const commandPacket = await commandPacketPromise;
    expect(commandPacket.requested_operating_status).toBe(OperatingStatus.FAST_TRACKING);
    logger.info("✓ Device received command");

    // 4. Device sent his new status on LT
    await sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!, {
      curr_status: OperatingStatus.FAST_TRACKING,
    });

    // 5. App received correct new status of device
    const statusEvent = await statusUpdatePromise;
    logger.info("statusEvent:", statusEvent);
    expect(statusEvent.onGpsMessageStatus.status.liveTracking).toBe(StatusState.On);
    logger.info("✓ App received status update");
  });

  // IT 2: Position streaming
  it("Device SENDS position -> notify app GraphQL Sub", async () => {
    logger.info("📍 Device sends position, app receives via WebSocket");

    const device = setup.devices.dogStandard!;
    const positionPayload = {
      latitude: 44.5024,
      longitude: 11.3463,
      last_gps_time: Math.floor(Date.now() / 1000),
    };

    // Subscribe with onReady callback to ensure sequential execution
    const positionEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessagePosition,
      { id: setup.devices.dogStandard!.id },
      "Position update should arrive via WebSocket",
      (data) => Math.abs(data?.onGpsMessagePosition?.position.lat - positionPayload.latitude) < 0.0001,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat POSITION...");
        await sentinelTcpSocketClient.simulator.heartbeat(device, positionPayload);
      },
    );

    logger.info("Position received:", positionEvent);
    expect(positionEvent.onGpsMessagePosition.position.lat).toBeCloseTo(positionPayload.latitude, 4);
    expect(positionEvent.onGpsMessagePosition.position.lng).toBeCloseTo(positionPayload.longitude, 4);
    logger.info("✓ Position streaming working");
  });

  // IT 3: Deactivation
  it("User DEACTIVATE Live Tracking (sendCommand duration=0) -> packet should arrives to Device", async () => {
    logger.info("📍 User deactivates Live Tracking");

    const deactivationPacketPromise = sentinelTcpSocketClient.waitForPacket(
      PacketType.PACKET_0x01,
      (p) => p.requested_operating_status === OperatingStatus.DEFAULT,
    );

    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.devices.dogStandard!.id,
        duration: 0,
        modeType: ModeType.Sentinel,
      },
    });
    expect(
      deactivateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");

    logger.info("⏳ Waiting for 0x01 (DEFAULT)...");
    // Deactivate on LT not push a command to device, but just update db on sentinel, we must send hb to ask new status (and understand that we are exit from LT), for this we send hb
    await new Promise((resolve) => setTimeout(resolve, 500));
    sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!, {
      curr_status: OperatingStatus.FAST_TRACKING,
    });
    const deactivationPacket = await deactivationPacketPromise;

    expect(deactivationPacket.requested_operating_status).toBe(OperatingStatus.DEFAULT);
    logger.info("✓ Live Tracking deactivated");
  });
});
