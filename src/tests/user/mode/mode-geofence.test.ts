import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { Packet01, PacketType, OperatingStatus } from "../../../clients/sentinel/packet-encode-decode.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import {
  SettingOperationEnum,
  SettingTypeEnum,
  StatusState,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { logger } from "../../../config/logger.js";

describe("Geofence", () => {
  // Sequential per dipendenze
  let setup: TestSetup = {} as TestSetup;
  let geofenceId: string; // Per activation/deactivation

  const GEOFENCE_COORDINATES = {
    name: "Casa Test Geofence",
    polygon: [
      { lat: 44.5, lng: 11.3 }, // Marker 1
      { lat: 44.5, lng: 11.35 }, // Marker 2
      { lat: 44.55, lng: 11.35 }, // Marker 3
      { lat: 44.55, lng: 11.3 }, // Marker 4
      { lat: 44.505, lng: 11.32 }, // Marker 5
      { lat: 44.495, lng: 11.32 }, // Marker 6
    ],
    inside: {
      lat: 44.505,
      lng: 11.32,
    },
    outside: {
      lat: 44.4,
      lng: 11.2,
    },
  };

  const createGeofencePayload = {
    name: GEOFENCE_COORDINATES.name,
    position: GEOFENCE_COORDINATES.polygon,
  };

  beforeAll(async () => {
    // STEP 1: Create user, pet, device, and purchase subscription
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    // STEP 2: Connect to Sentinel TCP server
    await sentinelTcpSocketClient.connect();
    // STEP 3: Start aggressive keep-alive to prevent socket disconnection
    await sentinelTcpSocketClient.startKeepAlive(setup.devices.dogStandard!);
  });

  afterAll(() => {
    sentinelTcpSocketClient.stopKeepAlive();
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  // IT 1: Create Geofence (Core API only)
  it("User CREATE Geofence (createGeofence) - API Assert", async () => {
    logger.info("📍 User creates geofence");

    const createGeofenceResponse = await petlink.core.graphqlHttp.authJwt.createGeofence({
      geofence: createGeofencePayload,
    });

    expect(
      createGeofenceResponse.createGeofence.code,
      `createGeofence should succeed - Error: ${createGeofenceResponse.createGeofence.message}${createGeofenceResponse.createGeofence.translationCode ? ` (${createGeofenceResponse.createGeofence.translationCode})` : ""}`,
    ).toBe("200");

    // Salva ID per activation
    geofenceId = createGeofenceResponse.createGeofence.geofence!.id;

    logger.info("✓ Geofence created in DB");
  });

  // IT 2: Activate Geofence - Wait Packet 0x01 with coordinates
  it("User ACTIVATE Geofence (sendSetting ACTIVATE) -> assert Packet arrives to Device", async () => {
    logger.info("📍 User activates geofence");

    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Activate,
        settingType: SettingTypeEnum.Geofence,
        id: geofenceId,
        deviceId: setup.devices.dogStandard!.id,
        geofence: createGeofencePayload.position, // REQUIRED: Backend does not fetch from DB, must pass explicitly
      },
    });

    expect(
      activateResponse.sendSetting.code,
      `sendSetting ACTIVATE should succeed - Error: ${activateResponse.sendSetting.message}${activateResponse.sendSetting.translationCode ? ` (${activateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // Wait packet 0x01 with geofence data
    logger.info("⏳ Waiting for 0x01 (geofence activation) on device...");
    const packet01 = await sentinelTcpSocketClient.waitForPacket(
      PacketType.PACKET_0x01,
      fxt.socket.timeoutMs,
      (p) => p.requested_operating_status === OperatingStatus.GEOFENCE_ON,
    );

    expect(packet01, "Should receive 0x01 (Geofence activation)").toBeDefined();
    logger.info("packet01 (Geofence activation):", packet01);

    // Verify geofence to be activate to device & coordinates sent from app match coordinates arrived on device
    expect(packet01.geofence_latitude_longitude).toHaveLength(6);
    expect(packet01.requested_operating_status).toBe(OperatingStatus.GEOFENCE_ON);
    packet01.geofence_latitude_longitude.forEach((coord, index) => {
      expect(coord.lat).toBeCloseTo(createGeofencePayload.position[index].lat, 3);
      expect(coord.lng).toBeCloseTo(createGeofencePayload.position[index].lng, 3);
    });

    logger.info("✓ Geofence activated, packet with correct coordinates");
  });

  // IT 3: Device Inside Geofence - Send 0x01 + Assert Sub
  it("Device INSIDE geofence -> notify app GraphQL Sub", async () => {
    logger.info("📍 Emula device inside geofence");

    // Start listening for geofence active event
    const geofenceActiveEventPromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      fxt.socket.timeoutMs,
      `Notification inGeofence=true not arrived to app after ${fxt.socket.timeoutMs}ms`,
      (data) => data?.onGpsMessageStatus?.status?.inGeofence === true,
    );

    // Emula: Send 0x01 con inside_geofence flag
    const device = setup.devices.dogStandard!;
    const bufferInside = Packet01.D2SWelcomeHeartBeat.toBuffer(device, {
      latitude: GEOFENCE_COORDINATES.inside.lat,
      longitude: GEOFENCE_COORDINATES.inside.lng,
      notifications: Packet01.D2SWelcomeHeartBeat.Notifications.NInsideFence, // 0x20 = inside geofence
      last_gps_time: Math.floor(Date.now() / 1000),
    });
    await sentinelTcpSocketClient.send(bufferInside, "GEOFENCE_INSIDE");

    // Wait for event and assert
    const geofenceActiveEvent = await geofenceActiveEventPromise;
    logger.info("Device INSIDE onGpsMessageStatus:", geofenceActiveEvent);
    expect(geofenceActiveEvent.onGpsMessageStatus.status.geofence).toBe(StatusState.On);
    expect(geofenceActiveEvent.onGpsMessageStatus.status.inGeofence).toBe(true);
    logger.info("✓ Inside geofence emulated, sub received true");
  });

  // IT 4: Device Exits Geofence - Send 0x01 + Assert Auto Live Tracking
  it("Device EXITS geofence -> notify app GraphQL Sub + auto-activate Live Tracking", async () => {
    logger.info("📍 Emula device exits geofence (critical!)");

    // Start listening for geofence exit event
    const geofenceExitEventPromise = petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      fxt.socket.timeoutMs,
      "Device should notify inGeofence=false when outside",
      (data) => data?.onGpsMessageStatus?.status?.inGeofence === false,
    );

    // Emula: Send 0x01 con outside_geofence flag
    const device = setup.devices.dogStandard!;
    const bufferExit = Packet01.D2SWelcomeHeartBeat.toBuffer(device, {
      latitude: GEOFENCE_COORDINATES.outside.lat,
      longitude: GEOFENCE_COORDINATES.outside.lng,
      notifications: Packet01.D2SWelcomeHeartBeat.Notifications.NOutsideFence, // 0x40 = outside geofence
      last_gps_time: Math.floor(Date.now() / 1000),
    });
    await sentinelTcpSocketClient.send(bufferExit, "GEOFENCE_OUTSIDE");

    // Wait for geofence exit event
    const geofenceExitEvent = await geofenceExitEventPromise;
    logger.info("Device EXITS onGpsMessageStatus:", geofenceExitEvent);
    expect(geofenceExitEvent.onGpsMessageStatus.status.inGeofence).toBe(false);
    expect(geofenceExitEvent.onGpsMessageStatus.status.liveTracking).toBe(StatusState.On);
    logger.info("✓ Exit emulated, auto Live Tracking activated");
  });

  // IT 5: Deactivate Geofence - Assert 200 + Wait 0x01 Default
  it("User DEACTIVATE Geofence (sendSetting DEACTIVATE) -> assert Packet arrives to Device", async () => {
    logger.info("📍 User deactivates geofence");

    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Deactivate,
        settingType: SettingTypeEnum.Geofence,
        id: geofenceId,
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      deactivateResponse.sendSetting.code,
      `sendSetting DEACTIVATE should succeed - Error: ${deactivateResponse.sendSetting.message}${deactivateResponse.sendSetting.translationCode ? ` (${deactivateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // Wait 0x01 deactivate
    logger.info("⏳ Waiting for 0x01 (deactivate)...");
    const packet01 = await sentinelTcpSocketClient.waitForPacket(
      PacketType.PACKET_0x01,
      fxt.socket.timeoutMs,
      (p) => p.requested_operating_status === OperatingStatus.DEFAULT,
    );
    logger.info("0x01 received:", packet01);

    expect(packet01, "Should receive 0x01 (Deactivate Geofence)").toBeDefined();
    expect(packet01.requested_operating_status).toBe(OperatingStatus.DEFAULT);
    logger.info("✓ Geofence deactivated, packet default received");
  });
});
