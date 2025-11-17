import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { petlink as sentinelClient, PacketToSentinel } from "../../../clients/sentinel/client-sentinel.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import {
  CommandEnum,
  GpsMessagePosition,
  ModeType,
  UtilityTestTypeEnum,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";

describe("User Mode - Live Tracking", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    logger.info("🔌 Setting up test environment...");
    // STEP 1: Create user, pet, and device
    logger.info("📍 Creating test user, pet, and device");
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
    logger.info("✓ Test setup complete", {
      userId: setup.user!.id,
      petId: setup.pets.dog!.id,
      deviceId: setup.devices.dogStandard!.id,
      serialNumber: setup.devices.dogStandard!.serialNumber,
    });
    // STEP 2: Update billing info (required for subscription purchase)
    logger.info("📍 Updating billing info");
    const billingResponse = await petlink.core.graphqlHttp.authJwt.updateBillingInfo({
      updateBillingInfoInput: {
        billingInfo: {
          address: setup.user!.streetAddress!,
          city: setup.user!.city!,
          country: setup.user!.countryCode!,
          zip: setup.user!.zipCode!,
        },
        email: setup.user!.email!,
        firstName: setup.user!.name!,
        lastName: setup.user!.surname!,
        phone: setup.user!.phone!,
      },
    });

    expect(billingResponse.updateBillingInfo.code).toBe("200");
    logger.info("✓ Billing info updated");
    // STEP 3: Get subscription plans and purchase a subscription
    logger.info("📍 Getting subscription plans");
    const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      productId: setup.devices.dogStandard!.id,
      countryCode: setup.devices.dogStandard!.countryCode,
      serialNumber: setup.devices.dogStandard!.serialNumber,
    });
    expect(plansResponse.getSubscriptionPlans.code).toBe("200");
    const choosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;
    logger.info("✓ Found subscription plan", {
      planId: choosenPlan.id,
      price: choosenPlan.price,
      period: choosenPlan.period,
    });
    // STEP 4: Purchase subscription
    logger.info("📍 Purchasing subscription");
    const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BuyNewSubscription,
        phone: setup.user!.phone,
        productId: setup.devices.dogStandard!.id,
        priceIds: [choosenPlan.id],
        card: fxt.current.card.valid,
      },
    });
    expect(purchaseResponse.utilityIntegrationTest.code).toBe("200");
    //todo: add purchase sub to builder pattern of testHelper
    logger.info("✓ Subscription purchased successfully");

    // STEP 5: Connect to Sentinel TCP server
    logger.info("🔌 Connecting to Sentinel TCP server...");
    await sentinelClient.connect();
    logger.info("✓ Connected to Sentinel TCP server");
  });

  afterAll(() => {
    logger.info("🧹 Cleaning up...");
    sentinelClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("Activate live tracking and should receive position updates", async () => {
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;

    logger.info("📍 STEP 1: Register device on Sentinel socketMap (send initial Packet 0x01)");
    const welcomePacket = PacketToSentinel.packet01(deviceSerialNumber, {
      latitude: 44.5024,
      longitude: 11.3463,
      battery: 4200,
      temperature: 22,
    });
    await sentinelClient.send(welcomePacket);
    logger.info("✓ Device registered on Sentinel cache map");

    logger.info("📍 STEP 2: Subscribe to position updates via GraphQl Sub WebSocket");
    let positionsReceived: GpsMessagePosition | null = null;
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessagePosition,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.info("📡 GraphQlSocket event received", { event });
            const position = event.data?.onGpsMessagePosition;
            if (position) {
              positionsReceived = position;
              logger.info(`✓ Position received: `, {
                lat: position.position?.lat,
                lng: position.position?.lng,
              });
              resolve();
            }
          },
          error: (error: any) => {
            logger.error("❌ WebSocket subscription error", { error: error.message });
            reject(error);
          },
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    logger.info("📍 STEP 3: Activate Live Tracking via GraphQL");
    let commandSentToDevice = CommandEnum.LiveTracking;
    let durationCommandSentToDevice = 900;
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: commandSentToDevice,
        id: setup.devices.dogStandard!.id,
        duration: durationCommandSentToDevice,
        modeType: ModeType.Sentinel,
      },
    });
    expect(
      activateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${activateResponse.sendCommand.message}${activateResponse.sendCommand.translationCode ? ` (${activateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");

    logger.info("📍 STEP 4: Verify device received Packet 0x0A (LIVE_TRACKING command)");
    const packets = await sentinelClient.waitForPackets(5000);
    const liveTrackingCommand = packets.find((p) => p.type === 0x0a && p.parsed);
    expect(liveTrackingCommand, "Should receive Packet 0x0A (LIVE_TRACKING command)").toBeDefined();
    expect(liveTrackingCommand!.parsed, "Should parse Packet 0x0A").toBeDefined();
    logger.info(`✓ Device received LIVE_TRACKING command`, { parsed: liveTrackingCommand!.parsed });

    logger.info("📍 STEP 5: Simulate device sending 1 Packet 0x01");
    let latutideSentoFromDevice = 44.5024;
    let longitudeSentoFromDevice = 11.3463;
    let batterySentoFromDevice = 4200;
    let temperatureSentoFromDevice = 22;
    sentinelClient.clearBuffer();
    const heartbeatPacket = PacketToSentinel.packet01(deviceSerialNumber, {
      latitude: latutideSentoFromDevice,
      longitude: longitudeSentoFromDevice,
      battery: batterySentoFromDevice,
      temperature: temperatureSentoFromDevice,
    });
    await sentinelClient.send(heartbeatPacket);
    logger.info("✓ Packet 0x01 #1 sent");

    logger.info("📍 STEP 6: Wait for positions to arrive via WebSocket");
    await subscriptionPromise;

    logger.info("positionsReceived: ", positionsReceived);
    expect(positionsReceived).not.toBeNull();
    expect(positionsReceived!.position.lat, "Latitude should match").toBe(latutideSentoFromDevice);
    expect(positionsReceived!.position.lng, "Longitude should match").toBe(longitudeSentoFromDevice);
    logger.info("✓ Received position via WebSocket", {
      lat: positionsReceived!.position.lat,
      lng: positionsReceived!.position.lng,
    });

    logger.info("📍 STEP 7: Deactivate Live Tracking");
    // sentinelTcpClient.clearBuffer();
    let commandSentToDeviceDeactivate = CommandEnum.LiveTracking;
    let durationCommandSentToDeviceDeactivate = 0;
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: commandSentToDeviceDeactivate,
        id: setup.devices.dogStandard!.id,
        duration: durationCommandSentToDeviceDeactivate,
        modeType: ModeType.Sentinel,
      },
    });

    expect(
      deactivateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");
    logger.info("✓ Live Tracking deactivated");

    logger.info("📍 STEP 8: Verify device received Packet 0x0A (LIVE_TRACKING deactivation command)");
    // const packets = await sentinelTcpClient.waitForPackets(5000);
    //todo: implement logics to handle "LIVE_TRACKING deactivation command" from device
  });
});
