import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fixtureCurrentBrand, isKippyRun, appBrand, pollingTimeoutMs, pollingIntervalMs } from "../../../fixtures/fixtures.js";
import { LanguageId, SubStatus, UtilityTestTypeEnum } from "../../../clients/petlink-infrastructure/types.js";
import { waitFor } from "../../../helpers/helper-waitfor.js";
import { logger } from "../../../config/logger.js";

describe("DEFAULT subscription flow", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    // Base setup: common for all brands
    const builder = testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice();

    // Add EVO device only for KIPPY brand
    if (isKippyRun) {
      builder.withDogForEvo().withDogEvoDevice();
    }

    setup = await builder.build();
  });

  it("Verify each device type has at least 1 sub plan available", async () => {
    const dogDevice = setup.devices.dogStandard!;
    const catDevice = setup.devices.catStandard!;
    const evoDevice = setup.devices.dogEvo;

    const plansPromises = [
      // DOG device plans
      petlink.core.graphql.authJwt.getSubscriptionPlans({
        productId: dogDevice.id,
        countryCode: dogDevice.countryCode,
        serialNumber: dogDevice.serialNumber,
      }),
      // CAT device plans
      petlink.core.graphql.authJwt.getSubscriptionPlans({
        productId: catDevice.id,
        countryCode: catDevice.countryCode,
        serialNumber: catDevice.serialNumber,
      }),
      // EVO device plans (only for KIPPY)
      ...(isKippyRun && evoDevice
        ? [
            petlink.core.graphql.authJwt.getSubscriptionPlans({
              productId: evoDevice.id,
              countryCode: evoDevice.countryCode,
              serialNumber: evoDevice.serialNumber,
            }),
          ]
        : []),
    ];

    const [dogPlans, catPlans, evoPlans] = await Promise.all(plansPromises);

    // console.log("Plans availability for each devices:", {
    //   DOG: dogPlans.getSubscriptionPlans,
    //   CAT: catPlans.getSubscriptionPlans,
    //   EVO: evoPlans.getSubscriptionPlans,
    // });

    // Assert DOG device
    expect(dogPlans.getSubscriptionPlans.code, "getSubscriptionPlans endpoint should return success for dog device").toBe("200");
    expect(dogPlans.getSubscriptionPlans.plans, "Dog device should have subscription plans defined").toBeDefined();
    expect(Array.isArray(dogPlans.getSubscriptionPlans.plans), "Subscription plans should be returned as an array").toBe(true);
    expect(dogPlans.getSubscriptionPlans.plans?.length, "Dog device should have at least one subscription plan available").toBeGreaterThan(0);

    // Assert CAT device
    expect(catPlans.getSubscriptionPlans.code, "getSubscriptionPlans endpoint should return success for cat device").toBe("200");
    expect(catPlans.getSubscriptionPlans.plans, "Cat device should have subscription plans defined").toBeDefined();
    expect(Array.isArray(catPlans.getSubscriptionPlans.plans), "Subscription plans should be returned as an array").toBe(true);
    expect(catPlans.getSubscriptionPlans.plans?.length, "Cat device should have at least one subscription plan available").toBeGreaterThan(0);

    // Assert EVO device (only for KIPPY)
    if (isKippyRun && evoPlans) {
      expect(evoPlans.getSubscriptionPlans.code, "getSubscriptionPlans endpoint should return success for EVO device").toBe("200");
      expect(evoPlans.getSubscriptionPlans.plans, "EVO device should have subscription plans defined").toBeDefined();
      expect(Array.isArray(evoPlans.getSubscriptionPlans.plans), "Subscription plans should be returned as an array").toBe(true);
      expect(evoPlans.getSubscriptionPlans.plans?.length, "EVO device should have at least one subscription plan available").toBeGreaterThan(0);
    }
  });

  it("Should return the price adjusted to the user's billing currency", async () => {
    const device = setup.devices.dogStandard!;

    const plansResponse = await petlink.core.graphql.authJwt.getSubscriptionPlans({
      productId: device.id,
      countryCode: device.countryCode,
      serialNumber: device.serialNumber,
    });
    const choosenPlanBeforeConversion = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    const planResponse = await petlink.core.graphql.authJwt.getSubscriptionPlanPricing({
      planPriceId: choosenPlanBeforeConversion.id,
      countryCode: "CH",
      productId: device.id,
    });

    const chosenPlanAfterConvesion = planResponse.getSubscriptionPlanPricing.pricing;

    expect(planResponse.getSubscriptionPlanPricing.code, "getSubscriptionPlanPricing endpoint should return success").toBe("200");
    expect(chosenPlanAfterConvesion, "Pricing details should be returned").toBeDefined();
    expect(chosenPlanAfterConvesion?.currencyCode, "Pricing currency should match billing info of user").toBe(isKippyRun ? "CHF" : "USD");
    expect(chosenPlanAfterConvesion?.itemId, "Plan adjust should be the same as the previous one").toBe(choosenPlanBeforeConversion.itemId);
    expect(chosenPlanAfterConvesion?.periodUnit, "Plan adjust should be the same as the previous one").toBe(choosenPlanBeforeConversion.periodUnit);
    expect(chosenPlanAfterConvesion?.period, "Plan adjust should be the same as the previous one").toBe(choosenPlanBeforeConversion.period);
  });

  it("Test Get and Update BILLING INFO", async () => {
    const user = setup.user!;

    // Update billing info
    const updateResponse = await petlink.core.graphql.authJwt.updateBillingInfo({
      updateBillingInfoInput: {
        billingInfo: {
          address: user.streetAddress!,
          city: user.city!,
          country: user.countryCode!,
          zip: user.zipCode!,
        },
        email: user.email!,
        firstName: user.name!,
        lastName: user.surname!,
        phone: user.phone!,
      },
    });

    expect(updateResponse.updateBillingInfo.code, "updateBillingInfo endpoint should return success").toBe("200");

    // Retrieve to verify
    const updatedBillingInfo = await petlink.core.graphql.authJwt.getBillingInfo();

    // Debug
    logger.debug("Billing info updated", {
      sentCity: user.city,
      returnedCity: updatedBillingInfo.getBillingInfo.billingInfo?.city,
    });

    expect(updatedBillingInfo.getBillingInfo.billingInfo, "Billing info should be defined after update").toBeDefined();
    expect(updatedBillingInfo.getBillingInfo.billingInfo?.city, "Billing city should match updated value").toBe(user.city);
  });

  describe("PURCHASE flows", () => {
    let setup: TestSetup = {} as TestSetup;
    let availablePlansForThisDevice: any[] = [];
    let availablePetProtectionForThisPet: any[] = [];
    let user: NonNullable<typeof setup.user>;
    let device: NonNullable<typeof setup.devices.dogStandard>;

    beforeEach(async () => {
      await testHelper.cleanupAll(); // ~2s

      // Già parallelizzato internamente!
      setup = await testHelper
        .setupBuilder()
        .withUser() // User: ~5s
        .withDog() // Dog + Cat in parallelo
        .withCat()
        .withDogDevice() // Devices in parallelo
        .withCatDevice()
        .build(); // Total: ~5-7s (user) + ~2s (pets parallel) + ~2s (devices parallel) = ~9-11s

      user = setup.user!;
      device = setup.devices.dogStandard!;

      // Billing + Plans in parallelo: ~0.5s
      const [_, plansResponse] = await Promise.all([
        petlink.core.graphql.authJwt.updateBillingInfo({
          updateBillingInfoInput: {
            billingInfo: {
              address: user.streetAddress!,
              city: user.city!,
              country: user.countryCode!,
              zip: user.zipCode!,
            },
            email: user.email!,
            firstName: user.name!,
            lastName: user.surname!,
            phone: user.phone!,
          },
        }),
        petlink.core.graphql.authJwt.getSubscriptionPlans({
          productId: device.id,
          countryCode: device.countryCode,
          serialNumber: device.serialNumber,
        }),
      ]);

      availablePlansForThisDevice = plansResponse.getSubscriptionPlans.plans!;
      availablePetProtectionForThisPet = plansResponse.getSubscriptionPlans.careProtectionPlans!;
    });

    it("BUY sub and verify it becomes active", async () => {
      const choosenPlan = availablePlansForThisDevice![0].pricings[0]!;

      logger.info("Testing subscription purchase", {
        planId: choosenPlan.id,
        price: choosenPlan.price,
        period: choosenPlan.period,
        periodUnit: choosenPlan.periodUnit,
      });

      // Purchase
      const purchaseResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: user.phone,
          productId: device.id,
          priceIds: [choosenPlan.id],
          card: fixtureCurrentBrand.card.valid,
        },
      });
      expect(purchaseResponse.utilityIntegrationTest.code, "utilityIntegrationTest endpoint should return success for subscription purchase").toBe("200");
      // Wait for payment SUCCEDED feedback (wait from chargebee webhook)
      const subsActiveForThisDevice = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
        isReady: (result) => {
          const sub = result.getSubscriptionByProductId.subscription;
          return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
        },
        timeoutMs: pollingTimeoutMs,
        intervalMs: pollingIntervalMs,
        timeoutError: `Timeout: Subscription status did not change to "${SubStatus.Active}" in ${pollingTimeoutMs}ms`,
      });
      const subscription = subsActiveForThisDevice.getSubscriptionByProductId.subscription!;

      logger.info("Subscription activated successfully", {
        subscriptionId: subscription.id,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
      });

      // Verify purchase status
      expect(subscription.status, "Subscription status should be active after successful purchase").toBe("active");
      expect(subscription.paymentStatus, "Payment status should be SUCCEEDED after successful purchase").toBe("SUCCEEDED");

      // Verify subscription matches the chosen plan
      expect(subscription.currencyCode, "Currency should match chosen plan").toBe(choosenPlan.currencyCode);
      expect(subscription.billingPeriod, "Billing period should match chosen plan").toBe(choosenPlan.period);
      expect(subscription.billingPeriodUnit, "Billing period unit should match chosen plan").toBe(choosenPlan.periodUnit);

      // Verify subscription items
      expect(subscription.subscriptionItems, "Should have subscription items").toBeDefined();
      expect(subscription.subscriptionItems.length, "Should have exactly 1 subscription item (the plan)").toBe(1);

      const planItem = subscription.subscriptionItems[0];
      expect(planItem.itemType, "Item should be of type 'plan'").toBe("plan");
      expect(planItem.itemPriceId, "Item price ID should match chosen plan").toBe(choosenPlan.id);
      expect(planItem.itemId, "Item ID should match chosen plan").toBe(choosenPlan.itemId);
      expect(planItem.unitPrice, "Unit price should match chosen plan").toBe(choosenPlan.price);
      expect(planItem.quantity, "Plan quantity should be 1").toBe(1);
      expect(planItem.amount, "Amount should match unit price * quantity").toBe(choosenPlan.price);

      // TODO: Verify start+period => assert termEnd, nextBillingPriod (tolerance?)
    });

    it.runIf(isKippyRun)("BUY sub + addOn DEVICE-protection", async () => {
      const chosenPlan = testHelper.findPlanWithAddonDeviceprotection(availablePlansForThisDevice);
      expect(chosenPlan, "Should find a plan with addon device protection").toBeDefined();

      logger.info("Testing subscription purchase with device protection addon", {
        planId: chosenPlan.id,
        addonId: chosenPlan.addon.id,
        planPrice: chosenPlan.price,
        addonPrice: chosenPlan.addon.price,
      });

      const purchasePlanWithAddonResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: user.phone,
          productId: device.id,
          priceIds: [chosenPlan.id, chosenPlan.addon.id],
          card: fixtureCurrentBrand.card.valid,
        },
      });
      expect(purchasePlanWithAddonResponse.utilityIntegrationTest.code).toBe("200");

      const purchasedSubscriptions = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
        isReady: (result) => {
          const sub = result.getSubscriptionByProductId.subscription;
          return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
        },
        timeoutMs: pollingTimeoutMs,
        intervalMs: pollingIntervalMs,
        timeoutError: `Timeout: Subscription status did not change to "${SubStatus.Active}" in ${pollingTimeoutMs}ms`,
      });

      const subscription = purchasedSubscriptions.getSubscriptionByProductId.subscription!;

      logger.info("Subscription with addon activated successfully", {
        subscriptionId: subscription.id,
        itemsCount: subscription.subscriptionItems.length,
      });

      // Verifica che ci siano 2 item (plan + addon)
      expect(subscription.subscriptionItems).toHaveLength(2);
      expect(subscription).toMatchObject({
        billingPeriodUnit: chosenPlan.periodUnit,
        billingPeriod: chosenPlan.period,
      });
      // Trova e verifica il plan
      const planItem = subscription.subscriptionItems.find((item) => item.itemType === "plan");
      expect(planItem?.itemPriceId).toBe(chosenPlan.id);
      expect(planItem).toMatchObject({
        itemPriceId: chosenPlan.id,
        unitPrice: chosenPlan.price,
      });
      // Trova e verifica l'addon
      const addonItem = subscription.subscriptionItems.find((item) => item.itemType === "addon");
      expect(addonItem?.itemPriceId).toBe(chosenPlan.addon.id);
      expect(addonItem).toMatchObject({
        itemPriceId: chosenPlan.addon.id,
        unitPrice: chosenPlan.addon.price,
      });
    });

    it.runIf(isKippyRun && fixtureCurrentBrand.user.languageId == LanguageId.IT)("BUY sub + PET-protection", async () => {
      const chosenPlan = availablePlansForThisDevice![0].pricings[0]!;
      const chosenPetProtection = availablePetProtectionForThisPet![0].pricings[0]!;
      logger.debug("Chosen plans for test", { chosenPlan, chosenPetProtection });

      const purchaseResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: user.phone,
          productId: device.id,
          priceIds: [chosenPlan.id, chosenPetProtection.id],
          card: fixtureCurrentBrand.card.valid,
        },
      });

      const [subscription, petProtectionResult] = await Promise.all([
        waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: pollingTimeoutMs,
          intervalMs: pollingIntervalMs,
          timeoutError: `Timeout: Subscription status did not change to "active"`,
        }),
        waitFor(async () => petlink.core.graphql.authJwt.getPet({ id: setup.pets.dog!.id! }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
          timeoutMs: pollingTimeoutMs,
          intervalMs: pollingIntervalMs,
          timeoutError: `Timeout: petProtectionId not assigned to pet`,
        }),
      ]);

      const sub = subscription.getSubscriptionByProductId.subscription!;
      const pet = petProtectionResult.getPet.pet!;
      const petProtectionResponse = await petlink.core.graphql.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      // Purchase response
      expect(purchaseResponse.utilityIntegrationTest.code, "Purchase should succeed").toBe("200");

      // Subscription state
      expect(sub.status, "Subscription should be active").toBe("active");
      expect(sub.paymentStatus, "Payment should be succeeded").toBe("SUCCEEDED");

      // Pet Protection details
      expect(petProtection.userId, "Pet protection should link to correct user").toBe(setup.user!.id);
      expect(petProtection.petId, "Pet protection should link to correct pet").toBe(pet.id);
      expect(petProtection.status, "Pet protection should be in OPEN status").toBe("OPEN");
      expect(petProtection.name, "Pet protection name should match plan").toBe(chosenPetProtection.externalName);
      expect(petProtection.price, "Pet protection price should match plan").toBe(chosenPetProtection.price);
      expect(petProtection.currencyCode, "Pet protection currency should match plan").toBe(chosenPetProtection.currencyCode);
      expect(petProtection.period, "Pet protection period should be 1").toBe(1);
      expect(petProtection.periodUnit, "Pet protection period unit should be year").toBe("year");
    });

    it.runIf(isKippyRun && fixtureCurrentBrand.user.languageId == LanguageId.IT)("BUY PET-protection alone", async () => {
      const petProtectionPlan = availablePetProtectionForThisPet![0].pricings[0]!;
      const regularPlan = availablePlansForThisDevice![0].pricings[0]!;

      // STEP 1: Verify that purchasing pet protection alone fails without an active subscription
      const failedPurchaseResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: user.phone,
          productId: device.id,
          priceIds: [petProtectionPlan.id],
          card: fixtureCurrentBrand.card.valid,
          isOnlyProtection: true,
          currencyCode: regularPlan.currencyCode,
        },
      });

      // Expect the purchase to fail (code should not be "200")
      expect(failedPurchaseResponse.utilityIntegrationTest.code, "Should not allow purchasing pet protection without an active subscription").not.toBe("200");

      // STEP 2: Purchase a regular subscription first
      const subPurchaseResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: user.phone,
          productId: device.id,
          priceIds: [regularPlan.id],
          card: fixtureCurrentBrand.card.valid,
        },
      });
      expect(subPurchaseResponse.utilityIntegrationTest.code, "Regular subscription purchase should succeed").toBe("200");

      // STEP 3: Wait for the subscription to become active with SUCCEEDED payment status
      const activeSubscription = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
        isReady: (result) => {
          const sub = result.getSubscriptionByProductId.subscription;
          return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
        },
        timeoutMs: pollingTimeoutMs,
        intervalMs: pollingIntervalMs,
        timeoutError: `Timeout: Subscription status did not change to "active" with SUCCEEDED payment`,
      });

      const activeSub = activeSubscription.getSubscriptionByProductId.subscription!;
      expect(activeSub.status, "Subscription should be active before purchasing pet protection").toBe("active");
      expect(activeSub.paymentStatus, "Payment status should be SUCCEEDED before purchasing pet protection").toBe("SUCCEEDED");

      // STEP 4: Now purchase pet protection alone (should succeed)
      const petProtectionPurchaseResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: user.phone,
          productId: device.id,
          priceIds: [petProtectionPlan.id],
          card: fixtureCurrentBrand.card.valid,
          isOnlyProtection: true,
          currencyCode: regularPlan.currencyCode,
        },
      });
      expect(petProtectionPurchaseResponse.utilityIntegrationTest.code, "Pet protection purchase should succeed when subscription is active").toBe("200");

      // STEP 5: Wait for pet protection to be assigned to the pet
      const petProtectionResult = await waitFor(async () => petlink.core.graphql.authJwt.getPet({ id: setup.pets.dog!.id! }), {
        isReady: (result) => result.getPet.pet!.petProtectionId != null,
        timeoutMs: pollingTimeoutMs,
        intervalMs: pollingIntervalMs,
        timeoutError: `Timeout: petProtectionId not assigned to pet`,
      });

      const pet = petProtectionResult.getPet.pet!;
      expect(pet.petProtectionId, "Pet should have a petProtectionId assigned").toBeDefined();

      // STEP 6: Verify pet protection details
      const petProtectionResponse = await petlink.core.graphql.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      expect(petProtection.userId, "Pet protection should link to correct user").toBe(setup.user!.id);
      expect(petProtection.petId, "Pet protection should link to correct pet").toBe(pet.id);
      expect(petProtection.status, "Pet protection should be in OPEN status").toBe("OPEN");
      expect(petProtection.name, "Pet protection name should match plan").toBe(petProtectionPlan.externalName);
      expect(petProtection.price, "Pet protection price should match plan").toBe(petProtectionPlan.price);
      expect(petProtection.currencyCode, "Pet protection currency should match plan").toBe(petProtectionPlan.currencyCode);
      expect(petProtection.period, "Pet protection period should be 1").toBe(1);
      expect(petProtection.periodUnit, "Pet protection period unit should be year").toBe("year");
    });
  });

  describe.skip("EDIT purchased subscriptions", () => {
    let editSetup: TestSetup = {} as TestSetup;
    let editUser: NonNullable<typeof editSetup.user>;
    let editDevice: NonNullable<typeof editSetup.devices.dogStandard>;
    let availablePlans: any[] = [];
    let currentSubscription: any; // ← Subscription disponibile per tutti i test

    beforeEach(async () => {
      await testHelper.cleanupAll(); // ~2s

      // Già parallelizzato internamente!
      setup = await testHelper
        .setupBuilder()
        .withUser() // User: ~5s
        .withDog() // Dog + Cat in parallelo
        .withCat()
        .withDogDevice() // Devices in parallelo
        .withCatDevice()
        .build(); // Total: ~5-7s (user) + ~2s (pets parallel) + ~2s (devices parallel) = ~9-11s

      user = setup.user!;
      device = setup.devices.dogStandard!;

      // Billing + Plans in parallelo: ~0.5s
      const [_, plansResponse] = await Promise.all([
        petlink.core.graphql.authJwt.updateBillingInfo({
          updateBillingInfoInput: {
            billingInfo: {
              address: user.streetAddress!,
              city: user.city!,
              country: user.countryCode!,
              zip: user.zipCode!,
            },
            email: user.email!,
            firstName: user.name!,
            lastName: user.surname!,
            phone: user.phone!,
          },
        }),
        petlink.core.graphql.authJwt.getSubscriptionPlans({
          productId: device.id,
          countryCode: device.countryCode,
          serialNumber: device.serialNumber,
        }),
      ]);

      availablePlansForThisDevice = plansResponse.getSubscriptionPlans.plans!;
      availablePetProtectionForThisPet = plansResponse.getSubscriptionPlans.careProtectionPlans!;
    });

    it("CANCEL active subscription", async () => {
      // Use currentSubscription directly (already available from beforeEach)
      expect(currentSubscription).toBeDefined();
      expect(currentSubscription.status).toBe("active");

      const subscriptionId = currentSubscription.id;
      const currentTermEnd = currentSubscription.currentTermEnd;

      logger.info("Testing subscription cancellation", {
        subscriptionId,
        currentStatus: currentSubscription.status,
      });

      // STEP 2: Cancel the subscription (stop auto-renewal)
      const cancelResponse = await petlink.core.graphql.authJwt.stopRenewingSubscription({
        subscriptionId,
        appBrand: appBrand,
        cancelReason: "Testing cancellation flow for integration tests",
        cancelReasonCode: "OTHER",
      });

      expect(cancelResponse.stopRenewingSubscription?.code, "stopRenewingSubscription endpoint should return success").toBe("200");

      // STEP 3: Verify subscription is now "non_renewing" but still active until term end
      const subAfterCancel = await waitFor(
        async () =>
          petlink.core.graphql.authJwt.getSubscriptionByProductId({
            productId: editDevice.id,
          }),
        {
          isReady: (result) => {
            return result.getSubscriptionByProductId.subscription?.status === SubStatus.NonRenewing;
          },
          timeoutMs: pollingTimeoutMs,
          intervalMs: pollingIntervalMs,
          timeoutError: `Timeout: Subscription status did not change to "${SubStatus.NonRenewing}" in ${pollingTimeoutMs}ms`,
        },
      );

      const subAfter = subAfterCancel.getSubscriptionByProductId.subscription!;

      logger.info("Subscription cancelled successfully", {
        subscriptionId: subAfter.id,
        oldStatus: currentSubscription.status,
        newStatus: subAfter.status,
      });

      expect(subAfter.status, `Subscription status should change from active to non_renewing`).toBe(SubStatus.NonRenewing);
      expect(subAfter.id, "Subscription ID should remain unchanged after cancel renewal").toBe(currentSubscription.id);
      expect(subAfter.currentTermEnd, "Subscription term end date should remain unchanged after cancel renewal").toBe(currentTermEnd);
    });

    // Placeholder per test futuri
    it.todo("UPGRADE subscription plan");
    it.todo("DOWNGRADE subscription plan");
    it.todo("AUTOMATIC RENEWAL of active subscription");
    it.todo("DUNNING for active subscription");
  });
});

describe.skip("DEBUG: REMOVE_ALL_SUBSCRIPTION endpoint", () => {
  let debugSetup: TestSetup = {} as TestSetup;
  let debugUser: NonNullable<typeof debugSetup.user>;
  let debugDevice: NonNullable<typeof debugSetup.devices.dogStandard>;

  beforeAll(async () => {
    await testHelper.cleanupAll();
    debugSetup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
    debugUser = debugSetup.user!;
    debugDevice = debugSetup.devices.dogStandard!;

    // Update billing info
    await petlink.core.graphql.authJwt.updateBillingInfo({
      updateBillingInfoInput: {
        billingInfo: {
          address: debugUser.streetAddress!,
          city: debugUser.city!,
          country: debugUser.countryCode!,
          zip: debugUser.zipCode!,
        },
        email: debugUser.email!,
        firstName: debugUser.name!,
        lastName: debugUser.surname!,
        phone: debugUser.phone!,
      },
    });
  });

  it("should successfully remove all subscriptions", async () => {
    // STEP 1: Get available plans
    const plansResponse = await petlink.core.graphql.authJwt.getSubscriptionPlans({
      productId: debugDevice.id,
      countryCode: debugDevice.countryCode,
      serialNumber: debugDevice.serialNumber,
    });
    const chosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    // STEP 2: Purchase a subscription
    console.log("📦 Purchasing subscription...");
    const purchaseResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
        phone: debugUser.phone,
        productId: debugDevice.id,
        priceIds: [chosenPlan.id],
        card: fixtureCurrentBrand.card.valid,
      },
    });
    expect(purchaseResponse.utilityIntegrationTest.code).toBe("200");

    // STEP 3: Wait for subscription to become active
    console.log("⏳ Waiting for subscription to become active...");
    const activeSub = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: debugDevice.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
      },
      timeoutMs: pollingTimeoutMs,
      intervalMs: pollingIntervalMs,
      timeoutError: `Timeout: Subscription not active`,
    });

    const subscription = activeSub.getSubscriptionByProductId.subscription!;
    console.log("✅ Subscription active:", subscription.id);
    expect(subscription.status).toBe("active");

    // STEP 4: Verify subscription exists before removal
    const subBeforeRemoval = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: debugDevice.id,
    });
    expect(subBeforeRemoval.getSubscriptionByProductId.subscription).toBeDefined();
    expect(subBeforeRemoval.getSubscriptionByProductId.subscription?.id).toBe(subscription.id);

    // STEP 5: Call REMOVE_ALL_SUBSCRIPTION and measure time
    console.log("🧹 Removing all subscriptions...");
    console.time("⏱️  REMOVE_ALL_SUBSCRIPTION duration");

    const removeResponse = await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.REMOVE_ALL_SUBSCRIPTION,
        phone: debugUser.phone,
      },
    });

    console.timeEnd("⏱️  REMOVE_ALL_SUBSCRIPTION duration");
    expect(removeResponse.utilityIntegrationTest.code).toBe("200");

    // STEP 6: Verify no subscriptions remain
    const subAfterRemoval = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: debugDevice.id,
    });
    console.log("📊 Subscription after removal:", subAfterRemoval.getSubscriptionByProductId.subscription);
    expect(subAfterRemoval.getSubscriptionByProductId.subscription).toBeNull();

    // STEP 7: Verify user/pet/device still exist
    const userCheck = await petlink.core.graphql.authJwt.getUser();
    const petCheck = await petlink.core.graphql.authJwt.getPet({ id: debugSetup.pets.dog!.id! });
    const deviceCheck = await petlink.core.graphql.authJwt.getPetlinkGps({ id: debugDevice.id });

    expect(userCheck.getUser.user).toBeDefined();
    expect(userCheck.getUser.user?.id).toBe(debugUser.id);
    expect(petCheck.getPet.pet).toBeDefined();
    expect(petCheck.getPet.pet?.id).toBe(debugSetup.pets.dog!.id);
    expect(deviceCheck.getPetlinkGps.petlinkGps).toBeDefined();
    expect(deviceCheck.getPetlinkGps.petlinkGps?.id).toBe(debugDevice.id);

    console.log("✅ All checks passed: user/pet/device intact, subscriptions removed");
  });

  it("should handle multiple subscription removals", async () => {
    // STEP 1: Purchase first subscription
    const plansResponse = await petlink.core.graphql.authJwt.getSubscriptionPlans({
      productId: debugDevice.id,
      countryCode: debugDevice.countryCode,
      serialNumber: debugDevice.serialNumber,
    });
    const chosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    console.log("📦 Purchasing first subscription...");
    await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
        phone: debugUser.phone,
        productId: debugDevice.id,
        priceIds: [chosenPlan.id],
        card: fixtureCurrentBrand.card.valid,
      },
    });

    await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: debugDevice.id }), {
      isReady: (result) => result.getSubscriptionByProductId.subscription?.status === "active",
      timeoutMs: pollingTimeoutMs,
      intervalMs: pollingIntervalMs,
      timeoutError: `Timeout waiting for first subscription`,
    });

    console.log("✅ First subscription active");

    // STEP 2: Remove subscriptions (first time)
    console.log("🧹 First removal...");
    console.time("⏱️  First REMOVE_ALL_SUBSCRIPTION");
    await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.REMOVE_ALL_SUBSCRIPTION,
        phone: debugUser.phone,
      },
    });
    console.timeEnd("⏱️  First REMOVE_ALL_SUBSCRIPTION");

    // STEP 3: Purchase second subscription
    console.log("📦 Purchasing second subscription...");
    await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
        phone: debugUser.phone,
        productId: debugDevice.id,
        priceIds: [chosenPlan.id],
        card: fixtureCurrentBrand.card.valid,
      },
    });

    await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: debugDevice.id }), {
      isReady: (result) => result.getSubscriptionByProductId.subscription?.status === "active",
      timeoutMs: pollingTimeoutMs,
      intervalMs: pollingIntervalMs,
      timeoutError: `Timeout waiting for second subscription`,
    });

    console.log("✅ Second subscription active");

    // STEP 4: Remove subscriptions (second time)
    console.log("🧹 Second removal...");
    console.time("⏱️  Second REMOVE_ALL_SUBSCRIPTION");
    await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.REMOVE_ALL_SUBSCRIPTION,
        phone: debugUser.phone,
      },
    });
    console.timeEnd("⏱️  Second REMOVE_ALL_SUBSCRIPTION");

    // STEP 5: Verify clean state
    const finalCheck = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: debugDevice.id,
    });
    expect(finalCheck.getSubscriptionByProductId.subscription).toBeNull();

    console.log("✅ Multiple removal cycles completed successfully");
  });
});
