import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpClient } from "../../../clients/sentinel/client-sentinel.js";
import { PacketFromSentinel } from "../../../clients/sentinel/packet-builders.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { CommandEnum, ModeType, UtilityTestTypeEnum } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
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
    logger.info("✓ Subscription purchased successfully");
    // STEP 5: Connect to Sentinel TCP server
    logger.info("🔌 Connecting to Sentinel TCP server...");
    await sentinelTcpClient.connect();
    logger.info("✓ Connected to Sentinel TCP server");
  });

  afterAll(() => {
    logger.info("🧹 Cleaning up...");
    sentinelTcpClient.disconnect();
    petlink.core.graphqlWS.disconnect();
  });

  it("Activate live tracking and should receive position updates", async () => {
    const deviceSerialNumber = setup.devices.dogStandard!.serialNumber;
    logger.info("📍 STEP 1: Register device with Sentinel (send initial Packet 0x01)");
    // CRITICAL: sends a Packet 0x01 to register the device (device must be registered in Sentinel's connection map BEFORE sending commands)
    await sentinelTcpClient.sendWelcome(deviceSerialNumber, {
      latitude: 44.5024,
      longitude: 11.3463,
      battery: 4200,
      temperature: 22,
    });
    logger.info("✓ Device registered on Sentinel cache map");
    // Wait for Sentinel to process the registration
    await new Promise((resolve) => setTimeout(resolve, 500));

    logger.info("📍 STEP 2: Subscribe to position updates via WebSocket");
    const positionsReceived: any[] = [];
    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessagePosition,
        { id: setup.devices.dogStandard!.id },
        {
          next: (event: any) => {
            logger.info("📡 WebSocket event received", { event });
            const position = event.data?.onGpsMessagePosition;
            if (position) {
              positionsReceived.push(position);
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
    // Wait for WebSocket to establish connection
    await new Promise((resolve) => setTimeout(resolve, 500));

    logger.info("📍 STEP 3: Activate Live Tracking via GraphQL");
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.devices.dogStandard!.id,
        duration: 900,
        modeType: ModeType.Sentinel,
      },
    });
    expect(
      activateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${activateResponse.sendCommand.message}${activateResponse.sendCommand.translationCode ? ` (${activateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");
    logger.info("✓ Live Tracking activated");
    // Wait for command to reach Sentinel
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info("📍 STEP 3.5: Verify device received Packet 0x0A (LIVE_TRACKING command)");
    const rawData = sentinelTcpClient.getReceivedData();
    expect(rawData.length, "Device should have received data from Sentinel").toBeGreaterThan(0);

    const activateCommand = PacketFromSentinel.packet0x0A(rawData);
    expect(activateCommand).toBeDefined();
    expect(activateCommand?.commandName).toBe("LIVE_TRACKING");
    expect(activateCommand?.duration).toBe(900);
    logger.info(`✓ Device received LIVE_TRACKING command with duration: ${activateCommand?.duration}s`);

    logger.info("📍 STEP 4: Simulate device sending 1 Packet 0x01");
    // Position 1
    await sentinelTcpClient.sendWelcome(deviceSerialNumber, {
      latitude: 44.5024,
      longitude: 11.3463,
      battery: 4200,
      temperature: 22,
    });
    logger.info("✓ Packet 0x01 #1 sent");

    logger.info("📍 STEP 5: Wait for positions to arrive via WebSocket");
    await subscriptionPromise;

    expect(positionsReceived.length).toBe(1);
    logger.info("✓ Received position via WebSocket");

    logger.info("📍 STEP 6: Deactivate Live Tracking");
    sentinelTcpClient.clearBuffer();
    const deactivateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.devices.dogStandard!.id,
        duration: 0,
        modeType: ModeType.Sentinel,
      },
    });
    expect(
      deactivateResponse.sendCommand.code,
      `sendCommand should succeed - Error: ${deactivateResponse.sendCommand.message}${deactivateResponse.sendCommand.translationCode ? ` (${deactivateResponse.sendCommand.translationCode})` : ""}`,
    ).toBe("200");
    logger.info("✓ Live Tracking deactivated");

    // Wait for command to reach Sentinel
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info("📍 STEP 6.5: Verify device received Packet 0x0A (LIVE_TRACKING deactivation command)");
    const rawDeactivateData = sentinelTcpClient.getReceivedData();
    expect(rawDeactivateData.length, "Device should have received deactivation data from Sentinel").toBeGreaterThan(0);

    const deactivateCommand = PacketFromSentinel.packet0x0A(rawDeactivateData);
    expect(deactivateCommand).toBeDefined();
    expect(deactivateCommand?.commandName).toBe("LIVE_TRACKING");
    expect(deactivateCommand?.duration).toBe(0);
    logger.info(`✓ Device received LIVE_TRACKING deactivation command with duration: ${deactivateCommand?.duration}s`);
  });
});
