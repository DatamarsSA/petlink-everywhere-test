import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import { PacketType, OperatingStatus } from "../../clients/petlink-infrastructure/packets-sentinel/packets.js";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import {
  CommandEnum,
  ModeType,
  OnGpsMessagePositionDocument,
  OnGpsMessageStatusDocument,
  StatusState,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { waitFor } from "../../helpers/utils.js";

describe("Live Tracking", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper
      .setupBuilder()
      .withUser()
      .withDog({ gps: { withSubscription: true } })
      .build();
    await petlink.sentinel.connectAndHandshake(setup.dog!.devices.gps!);
  });

  afterAll(() => {
    petlink.sentinel.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("User ACTIVATE Live Tracking (sendCommand duration=900) -> packet should arrives to device AND app receives LiveTracking Status ON", async () => {
    logger.info("📍 User activates Live Tracking");

    // 1. Setup listener for device packet BEFORE triggering anything
    logger.info("⏳ Device waiting for 0x01 (FAST_TRACKING)...");
    const commandPacketPromise = petlink.sentinel.waitForPacket(
      PacketType.PACKET_0x01,
      (p) => p.requested_operating_status === OperatingStatus.FAST_TRACKING,
    );

    // 2. Setup listener for App AND send command ONLY when App WebSocket is fully ready
    const statusUpdatePromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
      OnGpsMessageStatusDocument,
      { id: setup.dog!.devices.gps!.id },
      "Should receive status update with liveTracking=ON",
      (data) => data?.onGpsMessageStatus?.status?.liveTracking === StatusState.On,
      async () => {
        logger.info("⚡ Subscription ready -> Sending ACTIVATE LT...");
        const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
          command: {
            commandType: CommandEnum.LiveTracking,
            id: setup.dog!.devices.gps!.id,
            duration: 900,
            modeType: ModeType.Sentinel,
          },
        });
        expect(activateResponse.sendCommand.code).toBe("200");
      },
    );

    // 3. Wait for the TCP command to hit the simulated device
    const commandPacket = await commandPacketPromise;
    expect(commandPacket.requested_operating_status).toBe(OperatingStatus.FAST_TRACKING);
    logger.info("✓ Device received command");

    // 4. Device acknowledges by sending his new FAST_TRACKING status back
    await petlink.sentinel.simulator.heartbeat(setup.dog!.devices.gps!, {
      curr_status: OperatingStatus.FAST_TRACKING,
    });

    // 5. App receives correct new status of device via WebSocket
    const statusEvent = await statusUpdatePromise;
    expect(statusEvent.onGpsMessageStatus.status.liveTracking).toBe(StatusState.On);
    logger.info("✓ App received status update");
  });

  // IT 2: Position streaming
  it("Device SENDS position -> notify app GraphQL Sub", async () => {
    logger.info("📍 Device sends position, app receives via WebSocket");

    const gps = setup.dog!.devices.gps!;
    const positionPayload = {
      latitude: 44.5024,
      longitude: 11.3463,
      last_gps_time: Math.floor(Date.now() / 1000),
      curr_status: OperatingStatus.FAST_TRACKING,
    };

    // Subscribe with onReady callback to ensure sequential execution
    const positionEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      OnGpsMessagePositionDocument,
      { id: setup.dog!.devices.gps!.id },
      "Position update should arrive via WebSocket",
      (data) => {
        const pos = data?.onGpsMessagePosition?.position;
        if (!pos) return false;
        // Use toFixed(3) to avoid floating point precision issues in filter
        return pos.lat.toFixed(3) === positionPayload.latitude.toFixed(3) && pos.lng.toFixed(3) === positionPayload.longitude.toFixed(3);
      },
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat POSITION...");
        await petlink.sentinel.simulator.heartbeat(gps, positionPayload);
      },
    );

    expect(positionEvent.onGpsMessagePosition.position.lat).toBeCloseTo(positionPayload.latitude, 4);
    expect(positionEvent.onGpsMessagePosition.position.lng).toBeCloseTo(positionPayload.longitude, 4);
    logger.info("✓ Position streaming working");
  });

  // IT 3: Deactivation
  it("User DEACTIVATE Live Tracking (sendCommand duration=0) -> packet should arrives to Device", async () => {
    logger.info("📍 User deactivates Live Tracking");

    // 1. Send deactivate command
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.dog!.devices.gps!.id,
        duration: 0,
        modeType: ModeType.Sentinel,
      },
    });
    expect(
      deactivateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");

    // 2. Poll actively via heartbeats until we receive the correct status
    logger.info("⏳ Polling device heartbeats until 0x01 (DEFAULT) arrives...");

    const deactivationPacket = await waitFor(
      async () => {
        // Prepariamo l'ascolto per la singola iterazione
        const packetPromise = petlink.sentinel.waitForPacket(
          PacketType.PACKET_0x01,
          (p) => p.requested_operating_status === OperatingStatus.DEFAULT,
          500, // timeout di 500ms per il singolo ascolto
        );

        // Manda l'heartbeat per questa iterazione
        await petlink.sentinel.simulator.heartbeat(setup.dog!.devices.gps!, {
          curr_status: OperatingStatus.FAST_TRACKING,
        });

        // Ritorna il pacchetto (se va in timeout, lancerà errore e `waitFor` lo catturerà per riprovare)
        return await packetPromise;
      },
      {
        isReady: (packet) => packet !== undefined,
        timeoutMs: 10000, // Massimo 10 secondi totali per il test
        intervalMs: 100, // Pausa minima tra i tentativi
        timeoutError: "Live Tracking did not switch to DEFAULT within timeout",
      },
    );

    expect(deactivationPacket.requested_operating_status).toBe(OperatingStatus.DEFAULT);

    const statusOffEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      OnGpsMessageStatusDocument,
      { id: setup.dog!.devices.gps!.id },
      "Should receive status update with liveTracking=OFF",
      (data) => data?.onGpsMessageStatus?.status?.liveTracking === StatusState.Off,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat DEFAULT...");
        await petlink.sentinel.simulator.heartbeat(setup.dog!.devices.gps!, {
          curr_status: OperatingStatus.DEFAULT,
        });
      },
    );

    expect(statusOffEvent.onGpsMessageStatus.status.liveTracking).toBe(StatusState.Off);
    logger.info("✓ Live Tracking deactivated");
  });
});
