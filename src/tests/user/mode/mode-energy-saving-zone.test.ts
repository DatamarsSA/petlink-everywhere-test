import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { Packet01D2S, PacketType } from "../../../clients/sentinel/packet-encode-decode.js";
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

    logger.info("📍 STEP 1: Sending Handshake Packet to Sentinel");
    await sentinelTcpSocketClient.keepAlive(setup.devices.dogStandard!.serialNumber);
    logger.info("✓ Handshake complete");
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
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Activate,
        settingType: SettingTypeEnum.EnergySavingZone,
        deviceId: setup.devices.dogStandard!.id,
      },
    });
    expect(activateResponse.sendSetting.code).toBe("200");

    // VERIFY PACKETS: Should receive 0x15 (Safe Places) and 0x10 (Evo Extra Data)
    logger.info("⏳ Waiting for packets 0x15 and 0x10...");
    const [packet15, packet10] = await Promise.all([
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x15, 5000),
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10, 5000),
    ]);

    expect(packet15, "Should receive Packet 0x15 (Safe Places)").toBeDefined();

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
    const eszEntryData = {
      ...Packet01D2S.Data,
      serialNumber: deviceSerialNumber,
      latitude: 44.5024,
      longitude: 11.3463,
      collar_detached: true, // ← ESZ ACTIVE!
    };
    await sentinelTcpSocketClient.send(Packet01D2S.toBuffer(eszEntryData), eszEntryData);

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
    const eszExitData = {
      ...Packet01D2S.Data,
      serialNumber: deviceSerialNumber,
      latitude: 44.5024,
      longitude: 11.3463,
      collar_detached: false, // ← LEFT ESZ!
    };
    await sentinelTcpSocketClient.send(Packet01D2S.toBuffer(eszExitData), eszExitData);

    // STEP 3: Wait for ESZ exit notification
    await subscriptionPromise;
    expect(statusReceived, `Device should leave ESZ - inEnergySavingZone should be false`).toBe(false);
  });

  it("Deactivate ESZ", async () => {
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Deactivate,
        settingType: SettingTypeEnum.EnergySavingZone,
        deviceId: setup.devices.dogStandard!.id,
      },
    });
    expect(deactivateResponse.sendSetting.code).toBe("200");

    // VERIFY PACKET: Should receive 0x10 with disable flag
    logger.info("⏳ Waiting for packet 0x10...");
    const packet10 = await sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10, 5000);
  });
});
