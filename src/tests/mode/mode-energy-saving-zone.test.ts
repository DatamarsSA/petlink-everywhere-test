import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { OperatingStatus, PacketWelcomeHeartBeat, PacketType } from "../../clients/petlink-infrastructure/packets-sentinel/packets.js";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import {
  OnGpsMessageStatusDocument,
  SettingOperationEnum,
  SettingTypeEnum,
  StatusState,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { logger } from "../../config/logger.js";

describe("Energy Saving Zone", () => {
  let setup: TestSetup = {} as TestSetup;
  let eszId: string;

  const createZonePayload = {
    entityType: SettingTypeEnum.EnergySavingZone,
    name: "Wifi Casa Test",
    position: { lat: 44.5024, lng: 11.3463 },
    radius: 100,
    ssid: "HomeNetwork",
    bssid: "AA:BB:CC:DD:EE:FF",
    icon: "🏠",
  };

  beforeAll(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await petlink.sentinel.connectAndHandshake(setup.devices.dogStandard!);
  });

  afterAll(() => {
    petlink.sentinel.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  // IT 1: Create Zone (Core API only)
  it("User CREATE ESZ (sendSetting CREATE) - API Assert", async () => {
    logger.info("📍 User creates ESZ zone");

    const createZoneResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Create,
        settingType: SettingTypeEnum.EnergySavingZone,
        createObject: JSON.stringify(createZonePayload),
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      createZoneResponse.sendSetting.code,
      `sendSetting CREATE should succeed - Error: ${createZoneResponse.sendSetting.message}${createZoneResponse.sendSetting.translationCode ? ` (${createZoneResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // Salva ID per activation
    eszId = createZoneResponse.sendSetting.energySavingZone!.id;

    logger.info("✓ ESZ zone created in DB");
  });

  // IT 2: Activate ESZ - Wait Packets (0x15 zones + 0x10 enable)
  it("User ACTIVATE ESZ (sendSetting ACTIVATE) -> assert Packet arrives to Device", async () => {
    logger.info("📍 User activates ESZ");

    // 1. Prepare listeners BEFORE action
    logger.info("⏳ Device waiting for 0x15 (zones) and 0x10 (enable)...");
    const packetsPromise = Promise.all([
      petlink.sentinel.waitForPacket(PacketType.PACKET_0x15),
      petlink.sentinel.waitForPacket(PacketType.PACKET_0x10),
    ]);

    // 2. Perform action
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Activate,
        settingType: SettingTypeEnum.EnergySavingZone,
        id: eszId,
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      activateResponse.sendSetting.code,
      `sendSetting ACTIVATE should succeed - Error: ${activateResponse.sendSetting.message}${activateResponse.sendSetting.translationCode ? ` (${activateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // 3. Wait for packets
    const [packet15, packet10] = await packetsPromise;

    expect(packet15, "Should receive 0x15 (Safe Places with zones)").toBeDefined();
    expect(packet10, "Should receive 0x10 (Evo Extra Data enable)").toBeDefined();
    logger.info("packet15 (Safe Places with zones):", packet15);
    logger.info("packet10 (Evo Extra Data enable)", packet10);

    // Assert 0x15 zones (match create payload)
    expect(packet15.zones).toHaveLength(1); // Una zona creata
    expect(packet15.zones[0]).toMatchObject({
      lat: expect.closeTo(createZonePayload.position.lat, 3),
      lng: expect.closeTo(createZonePayload.position.lng, 3),
      radius: expect.closeTo(createZonePayload.radius, 1),
      bssid: createZonePayload.bssid.replace(/:/g, "").toUpperCase(),
    });
    // Assert 0x10 (enabled feature)
    expect(packet10.energy_saving_area_enabled).toBe(1); // Enable

    logger.info("✓ ESZ activated, packets with correct data");
  });

  // IT 3: Emula Enter - Send 0x01 + Assert Sub
  it("Device DETECT wifi (emula enter sending 0x01) -> notify app GraphQL Sub", async () => {
    logger.info("📍 Emula device enters ESZ (WiFi detect)");

    const device = setup.devices.dogStandard!;
    const eszEnterPayload = {
      latitude: 44.5024,
      longitude: 11.3463,
      curr_status: OperatingStatus.DEFAULT,
      spare_c5: PacketWelcomeHeartBeat.SpareC5.NDetached,
    };

    // Start listening for ESZ enter event with onReady callback
    const eszEnterEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      OnGpsMessageStatusDocument,
      { id: setup.devices.dogStandard!.id },
      "Device should detect WiFi and enter energy saving zone",
      (data) => data?.onGpsMessageStatus?.status?.inEnergySavingZone === true,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat ENTER ESZ...");
        await petlink.sentinel.simulator.heartbeat(device, eszEnterPayload);
      },
    );

    logger.info("onGpsMessageStatus:", eszEnterEvent);
    expect(eszEnterEvent.onGpsMessageStatus.status.energySavingMode).toBe(StatusState.On);
    expect(eszEnterEvent.onGpsMessageStatus.status.inEnergySavingZone).toBe(true);
    logger.info("✓ Enter emulato, sub received true");
  });

  // IT 4: Emula Exit - Send 0x01 + Assert Sub
  it("Device LEAVES wifi (emula exit sending 0x01) -> notify app GraphQL Sub", async () => {
    logger.info("📍 Emula device leaves ESZ (WiFi lost)");

    const device = setup.devices.dogStandard!;
    const eszExitPayload = {
      latitude: 44.5024,
      longitude: 11.3463,
      spare_c5: 0x00,
      curr_status: OperatingStatus.DEFAULT,
    };

    // Start listening for ESZ exit event with onReady callback
    const eszExitEvent = await petlink.core.graphqlWS.authJwt.subscribeUntil(
      OnGpsMessageStatusDocument,
      { id: setup.devices.dogStandard!.id },
      "Device should leave energy saving zone when WiFi is lost",
      (data) => data?.onGpsMessageStatus?.status?.inEnergySavingZone === false,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat EXIT ESZ...");
        await petlink.sentinel.simulator.heartbeat(device, eszExitPayload);
      },
    );

    logger.info("onGpsMessageStatus:", eszExitEvent);
    expect(eszExitEvent.onGpsMessageStatus.status.energySavingMode).toBe(StatusState.On);
    expect(eszExitEvent.onGpsMessageStatus.status.inEnergySavingZone).toBe(false);
    logger.info("✓ Exit emulato, sub received false");
  });

  // IT 5: Deactivate - Assert 200 + Wait 0x10 Disable
  it("User DEACTIVATE ESZ (sendSetting DEACTIVATE) - API + Packet Assert", async () => {
    logger.info("📍 User deactivates ESZ");

    // 1. Prepare listener
    logger.info("⏳ Device waiting for 0x10 (disable)...");
    const packet10Promise = petlink.sentinel.waitForPacket(PacketType.PACKET_0x10);

    // 2. Perform action
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Deactivate,
        settingType: SettingTypeEnum.EnergySavingZone,
        id: eszId,
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      deactivateResponse.sendSetting.code,
      `sendSetting DEACTIVATE should succeed - Error: ${deactivateResponse.sendSetting.message}${deactivateResponse.sendSetting.translationCode ? ` (${deactivateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // 3. Wait for packet
    const packet10 = await packet10Promise;
    logger.info("Packet 0x10", packet10);
    expect(packet10, "Should receive 0x10 (Disable ESZ)").toBeDefined();
    expect(packet10.energy_saving_area_enabled).toBe(0); // Disabled

    logger.info("✓ ESZ deactivated, packet disable received");
  });

  // IT 6: Update ESZ - Assert 200 + Verify with getEnergySavingZone
  it("User UPDATE ESZ (sendSetting UPDATE) - API + Query Assert", async () => {
    logger.info("📍 User updates ESZ");

    const updatePayload = {
      ...createZonePayload,
      id: eszId,
      name: "Wifi Casa Updated",
      radius: 150,
      ssid: "HomeNetworkUpdated",
    };

    const updateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Update,
        settingType: SettingTypeEnum.EnergySavingZone,
        updateObject: JSON.stringify(updatePayload),
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      updateResponse.sendSetting.code,
      `sendSetting UPDATE should succeed - Error: ${updateResponse.sendSetting.message}${updateResponse.sendSetting.translationCode ? ` (${updateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    const getZoneResponse = await petlink.core.graphqlHttp.authJwt.getEnergySavingZone({
      id: eszId,
    });

    expect(getZoneResponse.getEnergySavingZone.code).toBe("200");
    expect(getZoneResponse.getEnergySavingZone.energySavingZone).toMatchObject({
      id: eszId,
      name: updatePayload.name,
      radius: updatePayload.radius,
      ssid: updatePayload.ssid,
      position: updatePayload.position,
    });

    const getAllZonesResponse = await petlink.core.graphqlHttp.authJwt.getEnergySavingZones({});
    expect(getAllZonesResponse.getEnergySavingZones.code).toBe("200");
    expect(getAllZonesResponse.getEnergySavingZones.energySavingZones).toHaveLength(1);
    expect(getAllZonesResponse.getEnergySavingZones.energySavingZones![0]).toMatchObject({
      id: eszId,
      name: updatePayload.name,
      radius: updatePayload.radius,
      ssid: updatePayload.ssid,
    });

    logger.info("✓ ESZ updated and verified with queries");
  });

  // IT 7: Delete ESZ - Assert 200 + Verify with getEnergySavingZone and getEnergySavingZones
  it("User DELETE ESZ (sendSetting DELETE) - API + Query Assert", async () => {
    logger.info("📍 User deletes ESZ");

    // 1. Perform delete
    const deleteResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Delete,
        settingType: SettingTypeEnum.EnergySavingZone,
        id: eszId,
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      deleteResponse.sendSetting.code,
      `sendSetting DELETE should succeed - Error: ${deleteResponse.sendSetting.message}${deleteResponse.sendSetting.translationCode ? ` (${deleteResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // 2. Verify soft delete with getEnergySavingZone (should return 404 after soft delete)
    const getZoneResponse = await petlink.core.graphqlHttp.authJwt.getEnergySavingZone({
      id: eszId,
    });

    // After soft delete, getEnergySavingZone should return 404
    expect(getZoneResponse.getEnergySavingZone.code).toBe("404");
    expect(getZoneResponse.getEnergySavingZone.energySavingZone).toBeNull();

    // 3. Verify with getEnergySavingZones (should not return deleted zone)
    const getAllZonesResponse = await petlink.core.graphqlHttp.authJwt.getEnergySavingZones({});
    expect(getAllZonesResponse.getEnergySavingZones.code).toBe("200");
    expect(getAllZonesResponse.getEnergySavingZones.energySavingZones).toBeDefined();

    // Check that the deleted zone is not in the list (or is marked as deleted)
    const deletedZone = getAllZonesResponse.getEnergySavingZones.energySavingZones.find((zone: any) => zone.id === eszId);

    // If the API filters out deleted zones, it should not be found
    // If it returns deleted zones, we might need to check a 'deleted' flag
    expect(deletedZone).toBeUndefined();

    logger.info("✓ ESZ deleted and verified with queries");
  });
});
