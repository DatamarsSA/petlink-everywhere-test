import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../../config/logger.js";
import { sentinelTcpClient } from "../../../clients/sentinel/client-sentinel.js";
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

  it("Activate live tracking and should receive frequent position updates", async () => {
    // logger.info("Mocked Setup", setup);
    console.log(JSON.stringify(setup, null, 2));

    /**
     * Attivare Live Tracking via GraphQL mutation sendCommand
     * Sottoscriversi a onGpsMessagePosition(deviceId) via WebSocket
     * Emulare device che invia 3 posizioni via TCP (usando sentinelTcpClient.sendWelcome)
     * Verificare che le 3 posizioni arrivino via WebSocket
     * Disattivare Live Tracking via GraphQL mutation
     * Verificare che il device torna a modalità normale
     */
    logger.info("📍 STEP 1: Setup - Device in normal mode");
    // Open WebSocket subscription BEFORE purchase (event-driven)
    const activationPromise = new Promise<void>(async (resolve, reject) => {
      const wsSub = await petlink.core.graphqlWS.authJwt.subscribe(
        subscriptions.onGpsMessagePosition,
        { id: setup.user!.id },
        {
          next: (event: any) => {
            logger.info("WebSocket event received", { event });
            // subStatusUpdated = event.data;

            // Resolve only when subscription is ACTIVE
            const status = event.data?.onSubscriptionStatus?.status;
            if (status?.subscriptionIsActive === true) {
              wsSub.unsubscribe();
              resolve();
            }
          },
          error: (error: any) => {
            logger.error("WebSocket error", { error: error.message });
            reject(error);
          },
        },
        { timeoutMs: fxt.socket.timeoutMs },
      );
    });

    // Wait for WebSocket to establish connection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info("📍 STEP 2: Activate Live Tracking");
    // TODO: App chiama sendCommand(LIVE_TRACKING, duration: 900)
    const activateResponse = await petlink.core.graphqlHttp.authJwt.sendCommand({
      command: {
        commandType: CommandEnum.LiveTracking,
        id: setup.devices.dogStandard!.id,
        duration: 900,
        modeType: ModeType.Sentinel,
      },
    });
    expect(activateResponse.sendCommand.code).toBe("200");

    logger.info("📍 STEP 3: Simulate device sending positions every ~5 seconds");
    // Posizione 1
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 44.5024,
      longitude: 11.3463,
      battery: 4200,
    });
    logger.info("✓ Position 1 sent");

    // Aspetta 5 secondi
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // Posizione 2
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 44.5025,
      longitude: 11.3464,
      battery: 4190,
    });
    logger.info("✓ Position 2 sent");

    // Aspetta 5 secondi
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // Posizione 3
    await sentinelTcpClient.sendWelcome("PETL123456", {
      latitude: 44.5026,
      longitude: 11.3465,
      battery: 4180,
    });
    logger.info("✓ Position 3 sent");

    logger.info("📍 STEP 4: Subscribe to position updates");
    // TODO: App si sottoscrive a onGpsMessagePosition(deviceId) - Verifica che riceve 3 posizioni diverse

    logger.info("📍 STEP 5: Deactivate Live Tracking");
    // TODO: App chiama sendCommand(LIVE_TRACKING, duration: 0)

    logger.info("📍 STEP 6: Verify normal mode resumed");
    // TODO: Verifica che le posizioni arrivano ogni ~4 minuti
  });
});
