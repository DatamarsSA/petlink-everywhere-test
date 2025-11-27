// petlink-everywhere-test/src/tests/user/mode/mode-energy-saving-zone.test.ts
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { Packet01, PacketType } from "../../../clients/sentinel/packet-encode-decode.js"; // Aggiungi Packet01 per emulazione
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import {
  EntityTypeEnum,
  SettingOperationEnum,
  SettingTypeEnum,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../../fixtures/fixtures.js";
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
    // STEP 0: Setup (user, pet, device, sub)
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    // Connect Sentinel
    await sentinelTcpSocketClient.connect();
    sentinelTcpSocketClient.startKeepAlive(setup.devices.dogStandard!.serialNumber);
  });

  afterAll(() => {
    sentinelTcpSocketClient.stopKeepAlive();
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
        createObject: JSON.stringify(createZonePayload), // Esplicito
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
  it("User ACTIVATE ESZ (sendSetting ACTIVATE) - Packets Assert", async () => {
    logger.info("📍 User activates ESZ");

    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Activate,
        settingType: SettingTypeEnum.EnergySavingZone,
        id: eszId,
        deviceId: setup.devices.dogStandard!.id, // Esplicito per matching
      },
    });

    expect(
      activateResponse.sendSetting.code,
      `sendSetting ACTIVATE should succeed - Error: ${activateResponse.sendSetting.message}${activateResponse.sendSetting.translationCode ? ` (${activateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // Wait packets
    logger.info("⏳ Waiting for 0x15 (zones) and 0x10 (enable)...");
    const [packet15, packet10] = await Promise.all([
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x15, fxt.socket.timeoutMs),
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10, fxt.socket.timeoutMs),
    ]);

    expect(packet15, "Should receive 0x15 (Safe Places with zones)").toBeDefined();
    expect(packet10, "Should receive 0x10 (Evo Extra Data enable)").toBeDefined();

    // Assert 0x15 zones (match create payload)
    expect(packet15.zones).toHaveLength(1); // Una zona creata
    expect(packet15.zones[0]).toMatchObject({
      lat: createZonePayload.position.lat,
      lng: createZonePayload.position.lng,
      radius: createZonePayload.radius,
      bssid: createZonePayload.bssid.toUpperCase(), // Hex
    });

    // Parse 0x10
    expect(packet10.energy_saving_area_enabled).toBe(1); // Enable

    logger.info("✓ ESZ activated, packets with correct data");
  });

  // IT 3: Emula Enter - Send 0x01 + Assert Sub
  it("Device DETECT wifi (emula enter) - Send 0x01 + GraphQL Sub Assert", async () => {
    logger.info("📍 Emula device enters ESZ (WiFi detect)");

    // Sub prima (aspetta event)
    let statusReceived: boolean | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessageStatus,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.debug("onGpsMessageStatus:", JSON.stringify(event, null, 2));
            const status = event.data?.onGpsMessageStatus?.status?.inEnergySavingZone;
            if (status === true) {
              // Esatto match
              statusReceived = status;
              resolve();
            }
          },
          error: (error: any) => {
            logger.error("Sub error:", error);
            reject(error);
          },
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    // Emula: Send 0x01 con detached=true (TS setta byte 81 bit raw)
    const enterData = {
      ...Packet01.D2SWelcomeHeartBeat.Data,
      serial_number: setup.devices.dogStandard!.serialNumber,
      latitude: 0, // GPS off
      longitude: 0,
      collar_detached: true, // Convenience: TS setta spare_c5 bit 0x01 (raw byte 81)
    };
    await sentinelTcpSocketClient.send(Packet01.D2SWelcomeHeartBeat.toBuffer(enterData), enterData);

    // Aspetta sub trigger (Rust calcola detached=1 → SQS → publish → sub)
    await subscriptionPromise;
    expect(statusReceived).toBe(true);

    logger.info("✓ Enter emulato, sub received true");
  });

  // IT 4: Emula Exit - Send 0x01 + Assert Sub
  it("Device LEAVES wifi (emula exit) - Send 0x01 + GraphQL Sub Assert", async () => {
    logger.info("📍 Emula device leaves ESZ (WiFi lost)");

    let statusReceived: boolean | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessageStatus,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.debug("onGpsMessageStatus:", JSON.stringify(event, null, 2));
            const status = event.data?.onGpsMessageStatus?.status?.inEnergySavingZone;
            if (status === false) {
              statusReceived = status;
              resolve();
            }
          },
          error: (error: any) => reject(error),
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    // Emula: detached=false (byte 81 bit=0)
    const exitData = {
      ...Packet01.D2SWelcomeHeartBeat.Data,
      serial_number: setup.devices.dogStandard!.serialNumber,
      latitude: 44.5024, // GPS on
      longitude: 11.3463,
      collar_detached: false, // TS setta byte 81=0
    };
    await sentinelTcpSocketClient.send(Packet01.D2SWelcomeHeartBeat.toBuffer(exitData), exitData);

    await subscriptionPromise;
    expect(statusReceived).toBe(false);

    logger.info("✓ Exit emulato, sub received false");
  });

  // IT 5: Deactivate - Assert 200 + Wait 0x10 Disable
  it("User DEACTIVATE ESZ (sendSetting DEACTIVATE) - API + Packet Assert", async () => {
    logger.info("📍 User deactivates ESZ");

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

    // Wait 0x10 disable
    logger.info("⏳ Waiting for 0x10 (disable)...");
    const packet10 = await sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10, fxt.socket.timeoutMs);
    expect(packet10, "Should receive 0x10 (Disable ESZ)").toBeDefined();

    expect(packet10.energy_saving_area_enabled).toBe(0); // Disabled

    logger.info("✓ ESZ deactivated, packet disable received");
  });
});
