import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { PacketType, OperatingStatus } from "../../../clients/sentinel/packet-encode-decode.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import {
  CommandEnum,
  GpsMessagePosition,
  ModeType,
  StatusState,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";

describe("Live Tracking", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await sentinelTcpSocketClient.connect();
    await sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!);
  });

  afterAll(() => {
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("User ACTIVATE Live Tracking (sendCommand duration=900) -> packet should arrives to device AND app receives LiveTracking Status ON", async () => {
    logger.info("📍 User activates Live Tracking");

    // 1. Start listening (Prepare the trap)
    const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      fxt.socket.timeoutMs,
      "Should receive status update with liveTracking=ON",
      (data) => data?.onGpsMessageStatus?.status?.liveTracking === StatusState.On,
    );

    // 2. Trigger Action
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.devices.dogStandard!.id,
        duration: 900,
        modeType: ModeType.Sentinel,
      },
    });
    expect(activateResponse.sendCommand.code).toBe("200");

    // 3. Assert Packet (Device side) - Prima verifica il device...
    logger.info("⏳ Waiting for 0x01 (FAST_TRACKING)...");
    const [commandPacket] = await Promise.all([
      sentinelTcpSocketClient.waitForPacket(
        PacketType.PACKET_0x01,
        fxt.socket.timeoutMs,
        (p) => p.requested_operating_status === OperatingStatus.FAST_TRACKING,
      ),
      // Polling heartbeat to trigger pending commands
      new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
        sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!, {
          curr_status: OperatingStatus.DEFAULT,
        }),
      ),
    ]);

    expect(commandPacket.requested_operating_status).toBe(OperatingStatus.FAST_TRACKING);
    logger.info("✓ Device received command");
    await sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!, {
      curr_status: OperatingStatus.FAST_TRACKING,
    });

    // 4. Assert App Notification (User side) - ...poi verifica l'app
    logger.info("⏳ Waiting for GraphQL Status Update...");
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
      battery: 4200,
      temperature: 22,
      last_gps_time: Math.floor(Date.now() / 1000),
    };

    // Subscribe with onReady callback to ensure sequential execution
    const positionEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessagePosition,
      { id: setup.devices.dogStandard!.id },
      fxt.socket.timeoutMs,
      "Position update should arrive via WebSocket",
      (data) => data?.onGpsMessagePosition?.position.lat === positionPayload.latitude,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat POSITION...");
        await sentinelTcpSocketClient.simulator.heartbeat(device, positionPayload);
      },
    );

    logger.info("Position received:", positionEvent);
    expect(positionEvent.onGpsMessagePosition.position.lat).toBe(positionPayload.latitude);
    expect(positionEvent.onGpsMessagePosition.position.lng).toBe(positionPayload.longitude);
    logger.info("✓ Position streaming working");
  });

  // IT 3: Deactivation
  it("User DEACTIVATE Live Tracking (sendCommand duration=0) -> packet should arrives to Device", async () => {
    logger.info("📍 User deactivates Live Tracking");

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
    const [deactivationPacket] = await Promise.all([
      sentinelTcpSocketClient.waitForPacket(
        PacketType.PACKET_0x01,
        fxt.socket.timeoutMs,
        (p) => p.requested_operating_status === OperatingStatus.DEFAULT,
      ),
      // Polling heartbeat to trigger pending commands
      new Promise((resolve) => setTimeout(resolve, 1000)).then(() =>
        sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!, {
          curr_status: OperatingStatus.FAST_TRACKING,
        }),
      ),
    ]);

    expect(deactivationPacket.requested_operating_status).toBe(OperatingStatus.DEFAULT);
    logger.info("✓ Live Tracking deactivated");

    // ACK finale
    await sentinelTcpSocketClient.simulator.heartbeat(setup.devices.dogStandard!, {
      curr_status: OperatingStatus.DEFAULT,
    });
  });
});
