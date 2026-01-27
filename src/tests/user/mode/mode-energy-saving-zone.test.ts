import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { OperatingStatus, PacketWelcomeHeartBeat, PacketType } from "../../../clients/sentinel/packets.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import {
  SettingOperationEnum,
  SettingTypeEnum,
  StatusState,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { logger } from "../../../config/logger.js";

describe("Energy Saving Zone", () => {
  // Sequential per dipendenze
  let setup: TestSetup = {} as TestSetup;
  let eszId: string; // Per activation/deactivation

  // Explicit payload for ESZ creation (no spreads, typed)
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
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await sentinelTcpSocketClient.connectAndHandshake(setup.devices.dogStandard!);
  });

  afterAll(() => {
    sentinelTcpSocketClient.disconnect();
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
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x15),
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10),
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
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      "Device should detect WiFi and enter energy saving zone",
      (data) => data?.onGpsMessageStatus?.status?.inEnergySavingZone === true,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat ENTER ESZ...");
        await sentinelTcpSocketClient.simulator.heartbeat(device, eszEnterPayload);
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
      subscriptions.onGpsMessageStatus,
      { id: setup.devices.dogStandard!.id },
      "Device should leave energy saving zone when WiFi is lost",
      (data) => data?.onGpsMessageStatus?.status?.inEnergySavingZone === false,
      async () => {
        logger.info("⚡ Subscription ready -> Sending heartbeat EXIT ESZ...");
        await sentinelTcpSocketClient.simulator.heartbeat(device, eszExitPayload);
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
    const packet10Promise = sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10);

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
});
