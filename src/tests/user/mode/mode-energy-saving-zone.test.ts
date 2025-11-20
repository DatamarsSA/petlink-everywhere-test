import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { sentinelTcpSocketClient, PacketToSentinel } from "../../../clients/sentinel/client-sentinel.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import {
  EntityTypeEnum,
  SettingOperationEnum,
  SettingTypeEnum,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { logger } from "../../../config/logger.js";

describe("User Mode - Energy Saving Zone", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    // SETUP: User, Pet, Device, Subscription
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    await sentinelTcpSocketClient.connect();
    // HANDSHAKE: Login device to Sentinel (so it is mapped as socket capable)
    const handshake = PacketToSentinel.packet01(setup.devices.dogStandard!.serialNumber, {
      latitude: 44.5024,
      longitude: 11.3463,
      collar_detached: false,
      battery: 4200,
    });
    await sentinelTcpSocketClient.send(handshake);
  });

  afterAll(() => {
    logger.info("🧹 Closing socket GrapHQL (to core) & TCP (to sentinel)...");
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("Device enters ESZ (collar_detached = 1)", async () => {
    // STEP 1: Create ESZ zone
    const createZoneResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Create,
        settingType: SettingTypeEnum.EnergySavingZone,
        createObject: JSON.stringify({
          entityType: EntityTypeEnum.EnergySavingZone,
          name: "Casa",
          icon: "zone_home",
          position: { lat: 44.5024, lng: 11.3463 },
          radius: 100,
          ssid: "MioWiFi",
          bssid: "AA:BB:CC:DD:EE:FF",
        }),
      },
    });
    expect(createZoneResponse.sendSetting.code).toBe("200");

    // STEP 2: Activate ESZ
    sentinelTcpSocketClient.clearBuffer(); // Clear buffer before activation
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Activate,
        settingType: SettingTypeEnum.EnergySavingZone,
        deviceId: setup.devices.dogStandard!.id,
      },
    });
    expect(activateResponse.sendSetting.code).toBe("200");

    // VERIFY PACKETS: Should receive 0x15 (Safe Places) and 0x10 (Evo Extra Data)
    const packets: any[] = await sentinelTcpSocketClient.waitForPackets(2000);
    
    logger.info(`📦 Received ${packets.length} packets from Sentinel`);
    packets.forEach((p, i) => {
      logger.info(`   Packet ${i}: type=0x${p.type.toString(16)}, parsed=${JSON.stringify(p.parsed)}`);
    });

    const packet15 = packets.find((p) => p.type === 0x15);
    logger.info(`🔍 Packet 0x15 found: ${!!packet15}`);
    if (packet15?.parsed) {
      logger.info(`   Zones count: ${packet15.parsed.zonesCount}`);
      logger.info(`   First zone BSSID: ${packet15.parsed.zones[0]?.bssid}`);
    }
    expect(packet15, "Should receive Packet 0x15 (Safe Places)").toBeDefined();
    expect(packet15?.parsed?.zones[0]?.bssid).toBe("AABBCCDDEEFF"); // Verify correct zone BSSID

    const packet10 = packets.find((p) => p.type === 0x10);
    logger.info(`🔍 Packet 0x10 found: ${!!packet10}`);
    if (packet10?.parsed) {
      logger.info(`   Evo tasks: 0x${packet10.parsed.evo_tasks?.toString(16)}`);
      logger.info(`   Energy saving enabled: ${packet10.parsed.energy_saving_area_enabled}`);
    }
    expect(packet10, "Should receive Packet 0x10 (Evo Extra Data)").toBeDefined();
    expect(packet10?.parsed?.energy_saving_area_enabled).toBe(1); // Verify ESZ Enabled

    // STEP 3: Subscribe to ESZ status changes
    let statusReceived: boolean | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessageStatus,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            console.log("INSIDE_onGpsMessageStatus", JSON.stringify(event, null, 2));
            const status = event.data?.onGpsMessageStatus?.status?.inEnergySavingZone;
            if (status === true) {
              statusReceived = status;
              resolve();
            }
          },
          error: (error: any) => reject(error),
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    // STEP 4: Device sends Packet 0x01 with collar_detached = 1
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;
    const packet = PacketToSentinel.packet01(deviceSerialNumber, {
      latitude: 44.5024,
      longitude: 11.3463,
      collar_detached: true, // ← ESZ ACTIVE!
      battery: 4200,
    });
    await sentinelTcpSocketClient.send(packet);

    // STEP 5: Wait for ESZ entry notification
    await subscriptionPromise;
    expect(statusReceived, `Device should enter ESZ - inEnergySavingZone should be true`).toBe(true);
  });

  it("Device leaves ESZ (collar_detached = 0)", async () => {
    // STEP 1: Subscribe to ESZ status changes
    let statusReceived: boolean | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessageStatus,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
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

    // STEP 2: Device sends Packet 0x01 with collar_detached = 0
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;
    const packet = PacketToSentinel.packet01(deviceSerialNumber, {
      latitude: 44.5024,
      longitude: 11.3463,
      collar_detached: false, // ← LEFT ESZ!
      battery: 4200,
    });
    await sentinelTcpSocketClient.send(packet);

    // STEP 3: Wait for ESZ exit notification
    await subscriptionPromise;
    expect(statusReceived, `Device should leave ESZ - inEnergySavingZone should be false`).toBe(false);
  });

  it("Deactivate ESZ", async () => {
    sentinelTcpSocketClient.clearBuffer(); // Clear buffer before deactivation
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Deactivate,
        settingType: SettingTypeEnum.EnergySavingZone,
        deviceId: setup.devices.dogStandard!.id,
      },
    });
    expect(deactivateResponse.sendSetting.code).toBe("200");

    // VERIFY PACKET: Should receive 0x10 with disable flag
    const packets: any[] = await sentinelTcpSocketClient.waitForPackets(2000);
    
    logger.info(`📦 Deactivation - Received ${packets.length} packets from Sentinel`);
    packets.forEach((p, i) => {
      logger.info(`   Packet ${i}: type=0x${p.type.toString(16)}, parsed=${JSON.stringify(p.parsed)}`);
    });
    
    const packet10 = packets.find((p) => p.type === 0x10);
    logger.info(`🔍 Deactivation Packet 0x10 found: ${!!packet10}`);
    if (packet10?.parsed) {
      logger.info(`   Evo tasks: 0x${packet10.parsed.evo_tasks?.toString(16)}`);
      logger.info(`   Energy saving enabled: ${packet10.parsed.energy_saving_area_enabled}`);
    }

    expect(packet10, "Should receive Packet 0x10 (Evo Extra Data)").toBeDefined();
    expect(packet10?.parsed?.energy_saving_area_enabled).toBe(0); // Verify ESZ Disabled
  });
});
