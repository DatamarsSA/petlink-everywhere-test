import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { PacketType, OperatingStatus, PacketWelcomeHeartBeat } from "../../../clients/petlink-infrastructure/packets-sentinel/packets.js";
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
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await petlink.sentinel.connectAndHandshake(setup.devices.dogStandard!);
  });

  afterAll(() => {
    petlink.sentinel.disconnect();
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

    // 1. Prepare listener
    logger.info("⏳ Waiting for 0x01 (geofence activation) on device...");
    const packet01Promise = petlink.sentinel.waitForPacket(
      PacketType.PACKET_0x01,
      (p) => p.requested_operating_status === OperatingStatus.GEOFENCE_ON,
    );

    // 2. Perform action
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

    // 3. Wait packet
    const packet01 = await packet01Promise;

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
  it("Device send INSIDE geofence -> notify app GraphQL Sub", async () => {
    logger.info("📍 Emula device inside geofence");

    const device = setup.devices.dogStandard!;
    const insidePayload = {
      latitude: GEOFENCE_COORDINATES.inside.lat,
      longitude: GEOFENCE_COORDINATES.inside.lng,
      notifications: PacketWelcomeHeartBeat.Notifications.NInsideFence, // 0x20 = inside geofence
      curr_status: OperatingStatus.GEOFENCE_ON,
      last_gps_time: Math.floor(Date.now() / 1000),
    };

    // Start listening for geofence active event with onReady callback
    const geofenceActiveEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      `Notification inGeofence=true not arrived to app after ${fxt.socket.timeoutMs}ms`,
      (data) => data?.onGpsMessageStatus?.status?.inGeofence === true,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat INSIDE GEOFENCE...");
        await petlink.sentinel.simulator.heartbeat(device, insidePayload);
      },
    );

    logger.info("Device INSIDE onGpsMessageStatus:", geofenceActiveEvent);
    expect(geofenceActiveEvent.onGpsMessageStatus.status.geofence).toBe(StatusState.On);
    expect(geofenceActiveEvent.onGpsMessageStatus.status.inGeofence).toBe(true);
    logger.info("✓ Inside geofence emulated, sub received true");
  });

  // IT 4: Device Exits Geofence - Send 0x01 + Assert Auto Live Tracking
  it("Device send EXITS geofence -> notify app GraphQL Sub + auto-activate Live Tracking", async () => {
    logger.info("📍 Emula device exits geofence (critical!)");

    const device = setup.devices.dogStandard!;
    const outsidePayload = {
      latitude: GEOFENCE_COORDINATES.outside.lat,
      longitude: GEOFENCE_COORDINATES.outside.lng,
      notifications: PacketWelcomeHeartBeat.Notifications.NOutsideFence, // 0x40 = outside geofence
      curr_status: OperatingStatus.GEOFENCE_ON, // Still in geofence mode until Sentinel deactivates it
      last_gps_time: Math.floor(Date.now() / 1000),
    };

    // Start listening for geofence exit event with onReady callback
    const geofenceExitEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      "Device should notify inGeofence=false when outside",
      (data) => data?.onGpsMessageStatus?.status?.inGeofence === false,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat OUTSIDE GEOFENCE...");
        await petlink.sentinel.simulator.heartbeat(device, outsidePayload);
      },
    );

    logger.info("Device EXITS onGpsMessageStatus:", geofenceExitEvent);
    expect(geofenceExitEvent.onGpsMessageStatus.status.inGeofence).toBe(false);
    expect(geofenceExitEvent.onGpsMessageStatus.status.liveTracking).toBe(StatusState.On);
    logger.info("✓ Exit emulated, auto Live Tracking activated");
  });

  // IT 5: Deactivate Geofence - Assert 200 + Wait 0x01 Default
  it("User DEACTIVATE Geofence (sendSetting DEACTIVATE) -> assert Packet arrives to Device", async () => {
    logger.info("📍 User deactivates geofence");

    // 1. Prepare listener
    logger.info("⏳ Waiting for 0x01 (deactivate)...");
    const packet01Promise = petlink.sentinel.waitForPacket(PacketType.PACKET_0x01, (p) => p.requested_operating_status === OperatingStatus.DEFAULT);

    // 2. Perform action
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

    // 3. Wait packet
    const packet01 = await packet01Promise;
    logger.info("0x01 received:", packet01);

    expect(packet01, "Should receive 0x01 (Deactivate Geofence)").toBeDefined();
    expect(packet01.requested_operating_status).toBe(OperatingStatus.DEFAULT);
    logger.info("✓ Geofence deactivated, packet default received");
  });

  // IT 6: Update Geofence - Assert 200 + Verify with getGeofences
  it("User UPDATE Geofence - API + Query Assert", async () => {
    logger.info("📍 User updates geofence");

    const updatePayload = {
      id: geofenceId,
      name: "Geofence Updated",
      position: [
        { lat: 44.51, lng: 11.31 }, // Coordinate diverse
        { lat: 44.51, lng: 11.36 },
        { lat: 44.56, lng: 11.36 },
        { lat: 44.56, lng: 11.31 },
        { lat: 44.515, lng: 11.33 },
        { lat: 44.505, lng: 11.33 },
      ],
    };

    // 1. UPDATE API call
    const updateResponse = await petlink.core.graphqlHttp.authJwt.updateGeofence({
      geofence: updatePayload,
    });

    expect(updateResponse.updateGeofence.code).toBe("200");
    expect(updateResponse.updateGeofence.geofence).toMatchObject({
      id: geofenceId,
      name: updatePayload.name,
    });

    // Verify position coordinates are updated
    expect(updateResponse.updateGeofence.geofence!.position).toHaveLength(6);
    updateResponse.updateGeofence.geofence!.position.forEach((coord: any, index: number) => {
      expect(coord.lat).toBeCloseTo(updatePayload.position[index].lat, 3);
      expect(coord.lng).toBeCloseTo(updatePayload.position[index].lng, 3);
    });

    // 2. VERIFY con getGeofences
    const getAllResponse = await petlink.core.graphqlHttp.authJwt.getGeofences({});
    expect(getAllResponse.getGeofences.code).toBe("200");

    const updatedGeofence = getAllResponse.getGeofences.geofences?.find((g: any) => g.id === geofenceId);
    expect(updatedGeofence).toMatchObject({
      id: geofenceId,
      name: updatePayload.name,
    });

    // Verify position coordinates in getGeofences response
    expect(updatedGeofence!.position).toHaveLength(6);
    updatedGeofence!.position.forEach((coord: any, index: number) => {
      expect(coord.lat).toBeCloseTo(updatePayload.position[index].lat, 3);
      expect(coord.lng).toBeCloseTo(updatePayload.position[index].lng, 3);
    });

    logger.info("✓ Geofence updated and verified");
  });

  // IT 7: Delete Geofence - Assert 200 + Verify with getGeofences
  it("User DELETE Geofence - API + Query Assert", async () => {
    logger.info("📍 User deletes geofence");

    // 1. DELETE API call
    const deleteResponse = await petlink.core.graphqlHttp.authJwt.deleteGeofence({
      id: geofenceId,
    });

    expect(deleteResponse.deleteGeofence.code).toBe("200");

    // 2. VERIFY con getGeofences (non dovrebbe più esistere)
    const getAllResponse = await petlink.core.graphqlHttp.authJwt.getGeofences({});
    expect(getAllResponse.getGeofences.code).toBe("200");

    const deletedGeofence = getAllResponse.getGeofences.geofences?.find((g: any) => g.id === geofenceId);
    expect(deletedGeofence).toBeUndefined();

    logger.info("✓ Geofence deleted and verified");
  });
});
