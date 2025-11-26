import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { sentinelTcpSocketClient } from "../../../clients/sentinel/client-sentinel.js";
import { Packet01, PacketType } from "../../../clients/sentinel/packet-encode-decode.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";
import {
  EntityTypeEnum,
  SettingOperationEnum,
  SettingTypeEnum,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { logger } from "../../../config/logger.js";

describe("Energy Saving Zone Happy Path", () => {
  let setup: TestSetup = {} as TestSetup;

  // Explicit payload for ESZ creation (no spreads, typed as partial for simplicity)
  const createZonePayload = {
    userId: setup.user!.id,
    entityType: EntityTypeEnum.EnergySavingZone,
    name: "Casa",
    position: { lat: 44.5024, lng: 11.3463 },
    radius: 100,
    ssid: "MioWiFi",
    bssid: "AA:BB:CC:DD:EE:FF",
  } as const;

  beforeAll(async () => {
    // STEP 1: Create user, pet, device, and purchase subscription
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().withSubscription().build();
    // STEP 2: Connect to Sentinel TCP server
    await sentinelTcpSocketClient.connect();
    // STEP 3: Start aggressive keep-alive to prevent socket disconnection
    sentinelTcpSocketClient.startKeepAlive(setup.devices.dogStandard!.serialNumber);
  });

  afterAll(() => {
    sentinelTcpSocketClient.stopKeepAlive();
    sentinelTcpSocketClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("User CREATE ESZ (sendSetting(CREATE))", async () => {
    logger.info("📍 User creates ESZ zone");

    const createZoneResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Create,
        settingType: SettingTypeEnum.EnergySavingZone,
        createObject: JSON.stringify(createZonePayload),
      },
    });

    expect(
      createZoneResponse.sendSetting.code,
      `sendSetting CREATE should succeed - Error: ${createZoneResponse.sendSetting.message}${createZoneResponse.sendSetting.translationCode ? ` (${createZoneResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    logger.info("✓ ESZ zone created");
  });

  it("User ACTIVATE ESZ (sendSetting(ACTIVATE))", async () => {
    logger.info("📍 User activates ESZ");

    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Activate,
        settingType: SettingTypeEnum.EnergySavingZone,
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      activateResponse.sendSetting.code,
      `sendSetting ACTIVATE should succeed - Error: ${activateResponse.sendSetting.message}${activateResponse.sendSetting.translationCode ? ` (${activateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // VERIFY PACKETS: Should receive 0x15 (Safe Places) and 0x10 (Evo Extra Data)
    logger.info("⏳ Waiting for packets 0x15 and 0x10...");
    const [packet15, packet10] = await Promise.all([
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x15, 5000),
      sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10, 5000),
    ]);

    expect(packet15, "Should receive Packet 0x15 (Safe Places)").toBeDefined();
    expect(packet10, "Should receive Packet 0x10 (Enable ESZ)").toBeDefined();

    logger.info("✓ ESZ activated, packets received");
  });

  it("Device DETECT wifi (automatic)", async () => {
    logger.info("📍 Device detects WiFi and enters ESZ");

    // Subscribe to ESZ status changes
    let statusReceived: boolean | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessageStatus,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.debug("onGpsMessageStatus event:", JSON.stringify(event, null, 2));
            const status = event.data?.onGpsMessageStatus?.status?.inEnergySavingZone;
            if (status === true) {
              statusReceived = status;
              resolve();
            }
          },
          error: (error: any) => {
            logger.error("Subscription error:", error);
            reject(error);
          },
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    // Device sends Packet 0x01 with collar_detached = 1 (GPS off: lat=0, lon=0)
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;
    const eszEntryData = {
      ...Packet01.D2SWelcomeHeartBeat.Data,
      serial_number: deviceSerialNumber,
      latitude: 0, // GPS off in ESZ
      longitude: 0,
      collar_detached: true, // ESZ active
    };
    await sentinelTcpSocketClient.send(Packet01.D2SWelcomeHeartBeat.toBuffer(eszEntryData), eszEntryData);

    // Wait for ESZ entry notification
    await subscriptionPromise;
    expect(statusReceived, "Device should enter ESZ - inEnergySavingZone should be true").toBe(true);

    logger.info("✓ Device entered ESZ, notification received");
  });

  it("Device DETECT leaves zone wifi (automatic)", async () => {
    logger.info("📍 Device leaves ESZ (WiFi lost)");

    // Subscribe to ESZ status changes
    let statusReceived: boolean | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessageStatus,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.debug("onGpsMessageStatus event:", JSON.stringify(event, null, 2));
            const status = event.data?.onGpsMessageStatus?.status?.inEnergySavingZone;
            if (status === false) {
              statusReceived = status;
              resolve();
            }
          },
          error: (error: any) => {
            logger.error("Subscription error:", error);
            reject(error);
          },
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    // Device sends Packet 0x01 with collar_detached = 0 (GPS on)
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;
    const eszExitData = {
      ...Packet01.D2SWelcomeHeartBeat.Data,
      serial_number: deviceSerialNumber,
      latitude: 44.5024,
      longitude: 11.3463,
      collar_detached: false, // Left ESZ
    };
    await sentinelTcpSocketClient.send(Packet01.D2SWelcomeHeartBeat.toBuffer(eszExitData), eszExitData);

    // Wait for ESZ exit notification
    await subscriptionPromise;
    expect(statusReceived, "Device should leave ESZ - inEnergySavingZone should be false").toBe(false);

    logger.info("✓ Device left ESZ, notification received");
  });

  it("User DEACTIVATE ESZ", async () => {
    logger.info("📍 User deactivates ESZ");

    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendSetting({
      setting: {
        operationType: SettingOperationEnum.Deactivate,
        settingType: SettingTypeEnum.EnergySavingZone,
        deviceId: setup.devices.dogStandard!.id,
      },
    });

    expect(
      deactivateResponse.sendSetting.code,
      `sendSetting DEACTIVATE should succeed - Error: ${deactivateResponse.sendSetting.message}${deactivateResponse.sendSetting.translationCode ? ` (${deactivateResponse.sendSetting.translationCode})` : ""}`,
    ).toBe("200");

    // VERIFY PACKET: Should receive 0x10 with disable flag
    logger.info("⏳ Waiting for packet 0x10 (disable)...");
    const packet10 = await sentinelTcpSocketClient.waitForPacket(PacketType.PACKET_0x10, 5000);
    expect(packet10, "Should receive Packet 0x10 (Disable ESZ)").toBeDefined();

    logger.info("✓ ESZ deactivated");
  });
});
