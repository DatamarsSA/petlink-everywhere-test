import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fxt } from "../../../fixtures/fixtures.js";
import {
  assertDatesWithinTolerance,
  expectSubBoughtMatchSubToBuy,
  expectPetProtBoughtMatchesPetProtToBuy,
  waitFor,
} from "../../../helpers/helpers.js";
import { logger } from "../../../config/logger.js";
import {
  UtilityTestTypeEnum,
  LanguageId,
  CancelReasonCodeEnum,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { SubscriptionStatusEnum } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import * as subscriptions from "../../../clients/petlink-infrastructure/endpoints/graphql/operations/core/subscriptions.js";

describe("DEFAULT subscription flow", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    // Base setup: common for all brands
    const builder = testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice();

    // Add EVO device only for KIPPY brand
    if (fxt.isKippyRun) {
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
      petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: dogDevice.id,
        countryCode: dogDevice.countryCode,
        serialNumber: dogDevice.serialNumber,
      }),
      // CAT device plans
      petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: catDevice.id,
        countryCode: catDevice.countryCode,
        serialNumber: catDevice.serialNumber,
      }),
      // EVO device plans (only for KIPPY)
      ...(fxt.isKippyRun && evoDevice
        ? [
            petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
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
    expect(
      dogPlans.getSubscriptionPlans.code,
      `getSubscriptionPlans should succeed for dog device - Error: ${dogPlans.getSubscriptionPlans.message}${dogPlans.getSubscriptionPlans.translationCode ? ` (${dogPlans.getSubscriptionPlans.translationCode})` : ""}`,
    ).toBe("200");
    expect(dogPlans.getSubscriptionPlans.plans, "Dog device should have subscription plans defined").toBeDefined();
    expect(Array.isArray(dogPlans.getSubscriptionPlans.plans), "Subscription plans should be returned as an array").toBe(true);
    expect(dogPlans.getSubscriptionPlans.plans?.length, "Dog device should have at least one subscription plan available").toBeGreaterThan(0);

    // Assert CAT device
    expect(
      catPlans.getSubscriptionPlans.code,
      `getSubscriptionPlans should succeed for cat device - Error: ${catPlans.getSubscriptionPlans.message}${catPlans.getSubscriptionPlans.translationCode ? ` (${catPlans.getSubscriptionPlans.translationCode})` : ""}`,
    ).toBe("200");
    expect(catPlans.getSubscriptionPlans.plans, "Cat device should have subscription plans defined").toBeDefined();
    expect(Array.isArray(catPlans.getSubscriptionPlans.plans), "Subscription plans should be returned as an array").toBe(true);
    expect(catPlans.getSubscriptionPlans.plans?.length, "Cat device should have at least one subscription plan available").toBeGreaterThan(0);

    // Assert EVO device (only for KIPPY)
    if (fxt.isKippyRun && evoPlans) {
      expect(
        evoPlans.getSubscriptionPlans.code,
        `getSubscriptionPlans should succeed for EVO device - Error: ${evoPlans.getSubscriptionPlans.message}${evoPlans.getSubscriptionPlans.translationCode ? ` (${evoPlans.getSubscriptionPlans.translationCode})` : ""}`,
      ).toBe("200");
      expect(evoPlans.getSubscriptionPlans.plans, "EVO device should have subscription plans defined").toBeDefined();
      expect(Array.isArray(evoPlans.getSubscriptionPlans.plans), "Subscription plans should be returned as an array").toBe(true);
      expect(evoPlans.getSubscriptionPlans.plans?.length, "EVO device should have at least one subscription plan available").toBeGreaterThan(0);
    }
  });

  it("Should return the price adjusted to the user's billing currency", async () => {
    const device = setup.devices.dogStandard!;

    const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      productId: device.id,
      countryCode: device.countryCode,
      serialNumber: device.serialNumber,
    });
    const choosenPlanBeforeConversion = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    const planResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlanPricing({
      planPriceId: choosenPlanBeforeConversion.id,
      countryCode: "CH",
      productId: device.id,
    });

    const chosenPlanAfterConvesion = planResponse.getSubscriptionPlanPricing.pricing;

    expect(
      planResponse.getSubscriptionPlanPricing.code,
      `getSubscriptionPlanPricing should succeed - Error: ${planResponse.getSubscriptionPlanPricing.message}${planResponse.getSubscriptionPlanPricing.translationCode ? ` (${planResponse.getSubscriptionPlanPricing.translationCode})` : ""}`,
    ).toBe("200");
    expect(chosenPlanAfterConvesion, "Pricing details should be returned").toBeDefined();
    expect(chosenPlanAfterConvesion?.currencyCode, "Pricing currency should match billing info of user").toBe(fxt.isKippyRun ? "CHF" : "USD");
    expect(chosenPlanAfterConvesion?.itemId, "Plan adjust should be the same as the previous one").toBe(choosenPlanBeforeConversion.itemId);
    expect(chosenPlanAfterConvesion?.periodUnit, "Plan adjust should be the same as the previous one").toBe(choosenPlanBeforeConversion.periodUnit);
    expect(chosenPlanAfterConvesion?.period, "Plan adjust should be the same as the previous one").toBe(choosenPlanBeforeConversion.period);
  });

  it("Test Get and Update BILLING INFO", async () => {
    const user = setup.user!;

    // Update billing info
    const updateResponse = await petlink.core.graphqlHttp.authJwt.updateBillingInfo({
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

    expect(
      updateResponse.updateBillingInfo.code,
      `updateBillingInfo should succeed - Error: ${updateResponse.updateBillingInfo.message}${updateResponse.updateBillingInfo.translationCode ? ` (${updateResponse.updateBillingInfo.translationCode})` : ""}`,
    ).toBe("200");

    // Retrieve to verify
    const updatedBillingInfo = await petlink.core.graphqlHttp.authJwt.getBillingInfo();

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

      // Billing + Plans in parallelo: ~0.5s
      const [_, plansResponse] = await Promise.all([
        petlink.core.graphqlHttp.authJwt.updateBillingInfo({
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
        }),
        petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
          productId: setup.devices.dogStandard!.id,
          countryCode: setup.devices.dogStandard!.countryCode,
          serialNumber: setup.devices.dogStandard!.serialNumber,
        }),
      ]);

      availablePlansForThisDevice = plansResponse.getSubscriptionPlans.plans!;
      availablePetProtectionForThisPet = plansResponse.getSubscriptionPlans.careProtectionPlans!;
    });

    afterAll(() => {
      petlink.core.graphqlWS.disconnect();
    });

    it("BUY sub and verify it becomes active", async () => {
      const choosenPlan = availablePlansForThisDevice![0].pricings[0]!;
      const deviceId = setup.devices.dogStandard!.id;

      logger.info("Testing subscription purchase", {
        planId: choosenPlan.id,
        price: choosenPlan.price,
        period: choosenPlan.period,
        periodUnit: choosenPlan.periodUnit,
      });

      let subStatusUpdated = null;

      // Open WebSocket subscription BEFORE purchase (event-driven)
      const activationPromise = new Promise<void>(async (resolve, reject) => {
        const wsSub = await petlink.core.graphqlWS.authJwt.subscribe(
          subscriptions.onSubscriptionStatus,
          { id: setup.user!.id },
          {
            next: (event: any) => {
              logger.info("GraphQlSocket event received -> onSubscriptionStatus", { event });
              subStatusUpdated = event.data;

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

      // Purchase subscription
      const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: deviceId,
          priceIds: [choosenPlan.id],
          card: fxt.current.card.valid,
        },
      });

      expect(
        purchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed - Error: ${purchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // Wait for WebSocket event (pure event-driven)
      await activationPromise;

      // Assert on WebSocket event
      expect(subStatusUpdated, "Should arrive update of sub status from subscription").not.toBeNull();
      expect(subStatusUpdated!.onSubscriptionStatus.id).toBe(setup.user!.id);
      expect(subStatusUpdated!.onSubscriptionStatus.status.subscriptionIsActive).toBe(true);
      expect(subStatusUpdated!.onSubscriptionStatus.status.productId).toBe(deviceId);

      // Fetch final subscription details
      const subsDetails = await petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({
        productId: setup.devices.dogStandard!.id,
      });
      const subscription = subsDetails.getSubscriptionByProductId.subscription!;

      logger.info("Subscription activated successfully", {
        subscriptionId: subscription.id,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
      });

      expectSubBoughtMatchSubToBuy(subscription, choosenPlan, {
        expectedStatus: "active",
        expectedPaymentStatus: "SUCCEEDED",
      });
    });

    it.runIf(fxt.isKippyRun)("BUY sub + addOn DEVICE-protection", async () => {
      const chosenPlan = testHelper.findPlanWithAddonDeviceprotection(availablePlansForThisDevice);
      expect(chosenPlan, "Should find a plan with addon device protection").toBeDefined();

      logger.info("Testing subscription purchase with device protection addon", {
        planId: chosenPlan.id,
        addonId: chosenPlan.addon.id,
        planPrice: chosenPlan.price,
        addonPrice: chosenPlan.addon.price,
      });

      const purchasePlanWithAddonResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [chosenPlan.id, chosenPlan.addon.id],
          card: fxt.current.card.valid,
        },
      });
      expect(
        purchasePlanWithAddonResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed - Error: ${purchasePlanWithAddonResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      const purchasedSubscriptions = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: setup.devices.dogStandard!.id }),
        {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: Subscription status did not change to "${SubscriptionStatusEnum.Active}" in ${fxt.polling.timeoutMs}ms`,
        },
      );

      const subscription = purchasedSubscriptions.getSubscriptionByProductId.subscription!;

      logger.info("Subscription with addon activated successfully", {
        subscriptionId: subscription.id,
        itemsCount: subscription.subscriptionItems.length,
      });

      // Verify subscription with addon matches the purchased plan
      expectSubBoughtMatchSubToBuy(subscription, chosenPlan, {
        expectedStatus: "active",
        expectedPaymentStatus: "SUCCEEDED",
        addonToBuy: chosenPlan.addon,
      });
    });

    it.runIf(fxt.isKippyRun && fxt.current.user.languageId == LanguageId.It)("BUY sub + PET-protection", async () => {
      const chosenPlan = availablePlansForThisDevice![0].pricings[0]!;
      const chosenPetProtection = availablePetProtectionForThisPet![0].pricings[0]!;
      logger.debug("Chosen plans for test", { chosenPlan, chosenPetProtection });

      const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [chosenPlan.id, chosenPetProtection.id],
          card: fxt.current.card.valid,
        },
      });

      const [subscription, petProtectionResult] = await Promise.all([
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: setup.devices.dogStandard!.id }), {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: Subscription status did not change to "active"`,
        }),
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.pets.dog!.id! }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: petProtectionId not assigned to pet`,
        }),
      ]);

      const sub = subscription.getSubscriptionByProductId.subscription!;
      const pet = petProtectionResult.getPet.pet!;
      const petProtectionResponse = await petlink.core.graphqlHttp.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      // Purchase response
      expect(
        purchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed - Error: ${purchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // Verify subscription matches plan
      expectSubBoughtMatchSubToBuy(sub, chosenPlan, {
        expectedStatus: "active",
        expectedPaymentStatus: "SUCCEEDED",
      });

      // Verify pet protection matches plan
      expectPetProtBoughtMatchesPetProtToBuy(petProtection, chosenPetProtection, {
        expectedPetId: pet.id,
        expectedUserId: setup.user!.id,
        expectedStatus: "OPEN",
      });
    });

    it.runIf(fxt.isKippyRun && fxt.current.user.languageId == LanguageId.It)("BUY PET-protection alone", async () => {
      logger.debug("dentro BUY PET-protection alone");
      const petProtectionPlan = availablePetProtectionForThisPet![0].pricings[0]!;
      const regularPlan = availablePlansForThisDevice![0].pricings[0]!;

      // STEP 2: Purchase a regular subscription first
      const subPurchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [regularPlan.id],
          card: fxt.current.card.valid,
        },
      });
      expect(
        subPurchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed for regular subscription - Error: ${subPurchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // STEP 3: Wait for the subscription to become active with SUCCEEDED payment status
      logger.debug(`bought SUB for device ${setup.devices.dogStandard!.id}, start to wait to become active`);
      const activeSubscription = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: setup.devices.dogStandard!.id }),
        {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: Subscription status did not change to "active" with SUCCEEDED payment`,
        },
      );

      const activeSub = activeSubscription.getSubscriptionByProductId.subscription!;
      expect(activeSub.status, "Subscription should be active before purchasing pet protection").toBe("active");
      expect(activeSub.paymentStatus, "Payment status should be SUCCEEDED before purchasing pet protection").toBe("SUCCEEDED");

      // STEP 4: Purchase pet protection alone
      logger.debug(`bought PET-PROTECTION for device ${setup.devices.dogStandard!.id}, start to wait to become active`);
      const petProtectionPurchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [petProtectionPlan.id],
          card: fxt.current.card.valid,
          isOnlyProtection: true,
          currencyCode: regularPlan.currencyCode,
        },
      });
      expect(
        petProtectionPurchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed for pet protection - Error: ${petProtectionPurchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // STEP 5: Wait for pet protection to be assigned to the pet
      const petProtectionResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.pets.dog!.id! }), {
        isReady: (result) => result.getPet.pet!.petProtectionId != null,
        timeoutMs: fxt.polling.timeoutMs,
        intervalMs: fxt.polling.intervalMs,
        timeoutError: `Timeout: petProtectionId not assigned to pet`,
      });
      const pet = petProtectionResult.getPet.pet!;
      expect(pet.petProtectionId, "Pet should have a petProtectionId assigned").toBeDefined();

      // Step 5.5 Update pet protection data (form submission simulation)
      const petProtectionOwner = {
        name: setup.user!.name,
        surname: setup.user!.surname,
        email: setup.user!.email,
        fiscalCode: "RSSMRA80A01H501U",
        city: setup.user!.city!,
        zipCode: setup.user!.zipCode!,
        streetAddress: setup.user!.streetAddress!,
        countryCode: setup.user!.countryCode,
        provinceCode: "MI",
        homePhone: setup.user!.phone,
        mobilePhone: setup.user!.phone,
      };

      const petProtectionPet = {
        species: pet.species,
        breed: pet.breeds?.[0],
        gender: pet.gender,
        name: pet.name,
        birthDate: pet.birthDate!,
        microchip: "123456789012345", //if dog required, at least 15 characters
      };

      const updateResponse = await petlink.core.graphqlHttp.authJwt.updatePetProtectionData({
        petProtectionId: pet.petProtectionId!,
        owner: petProtectionOwner,
        pet: petProtectionPet,
      });
      expect(updateResponse.updatePetProtectionData).toBeDefined();

      const updateResult = updateResponse.updatePetProtectionData!;
      expect(
        updateResult.code,
        `updatePetProtectionData should succeed - Error: ${updateResult.message}${updateResult.translationCode ? ` (${updateResult.translationCode})` : ""}`,
      ).toBe("200");
      expect(updateResult.petProtection?.petOwner?.fiscalCode, "Owner fiscal code should be updated").toBe(petProtectionOwner.fiscalCode);
      expect(updateResult.petProtection?.pet?.name, "Pet name should be updated").toBe(petProtectionPet.name);

      // STEP 6: Verify pet protection details
      const petProtectionResponse = await petlink.core.graphqlHttp.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      // Verify pet protection matches plan
      expectPetProtBoughtMatchesPetProtToBuy(petProtection, petProtectionPlan, {
        expectedPetId: pet.id,
        expectedUserId: setup.user!.id,
        expectedStatus: "OPEN",
      });

      // Owner & Pet match
      expect(petProtection.petOwner, "Owner data should match").toEqual(petProtectionOwner);
      expect(petProtection.pet, "Pet data should match").toEqual(petProtectionPet);
    });

    it.runIf(fxt.isKippyRun && fxt.current.user.languageId == LanguageId.It)("BUY sub + addOn DEVICE-protection + PET-protection", async () => {
      // select plan with device addon
      const chosenPlan = testHelper.findPlanWithAddonDeviceprotection(availablePlansForThisDevice);
      expect(chosenPlan, "Should find a plan with addon device protection").toBeDefined();

      // select a pet protection plan for the pet
      const chosenPetProtection = availablePetProtectionForThisPet?.[0]?.pricings?.[0];
      expect(chosenPetProtection, "Should find a pet protection pricing for this pet").toBeDefined();

      logger.info("Testing subscription purchase with device addon + pet protection", {
        planId: chosenPlan.id,
        addonId: chosenPlan.addon.id,
        petProtectionId: chosenPetProtection.id,
        planPrice: chosenPlan.price,
        addonPrice: chosenPlan.addon.price,
        petProtectionPrice: chosenPetProtection.price,
      });

      // Purchase: plan + addon + pet protection (price ids array)
      const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [chosenPlan.id, chosenPlan.addon.id, chosenPetProtection.id],
          card: fxt.current.card.valid,
        },
      });

      expect(
        purchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed - Error: ${purchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // Wait for both subscription active and petProtection assignment
      const [subscriptionResult, petProtectionResult] = await Promise.all([
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: setup.devices.dogStandard!.id }), {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: Subscription not active with SUCCEEDED payment`,
        }),
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.pets.dog!.id! }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: petProtectionId not assigned to pet`,
        }),
      ]);

      const subscription = subscriptionResult.getSubscriptionByProductId.subscription!;
      const pet = petProtectionResult.getPet.pet!;

      logger.info("Combined subscription + pet protection activated", {
        subscriptionId: subscription.id,
        itemsCount: subscription.subscriptionItems.length,
        petProtectionId: pet.petProtectionId,
      });

      // Verify subscription with addon matches plan
      expectSubBoughtMatchSubToBuy(subscription, chosenPlan, {
        expectedStatus: "active",
        expectedPaymentStatus: "SUCCEEDED",
        addonToBuy: chosenPlan.addon,
      });

      // Verify pet protection assigned and matches plan
      expect(pet.petProtectionId, "Pet should have a petProtectionId assigned").toBeDefined();
      const petProtectionResponse = await petlink.core.graphqlHttp.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      expectPetProtBoughtMatchesPetProtToBuy(petProtection, chosenPetProtection, {
        expectedPetId: pet.id,
        expectedUserId: setup.user!.id,
        expectedStatus: "OPEN",
      });
    });
  });

  describe("EDIT purchased subscriptions", () => {
    let setup: TestSetup = {} as TestSetup;
    let currentSubscription: any;

    beforeEach(async () => {
      // STEP 1: Cleanup e setup base
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice().build();
      // STEP 2: update Billing info + get available plasn
      const [_, plansResponse] = await Promise.all([
        petlink.core.graphqlHttp.authJwt.updateBillingInfo({
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
        }),
        petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
          productId: setup.devices.dogStandard!.id,
          countryCode: setup.devices.dogStandard!.countryCode,
          serialNumber: setup.devices.dogStandard!.serialNumber,
        }),
      ]);
      // STEP 3: Purchase a subscription that will be available for all tests
      const chosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;
      logger.debug("Purchasing subscription for EDIT tests", { chosenPlan });

      const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [chosenPlan.id],
          card: fxt.current.card.valid,
        },
      });

      expect(
        purchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed in beforeEach - Error: ${purchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // STEP 4: Wait for subscription to become active and store it
      const subscriptionResult = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: setup.devices.dogStandard!.id }),
        {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: Subscription status did not change to "active" with SUCCEEDED payment`,
        },
      );

      currentSubscription = subscriptionResult.getSubscriptionByProductId.subscription!;

      logger.info("Subscription ready for EDIT tests", {
        subscriptionId: currentSubscription.id,
        status: currentSubscription.status,
        paymentStatus: currentSubscription.paymentStatus,
      });

      // Validazione che la subscription sia pronta
      expect(currentSubscription.status, "Subscription should be active before each test").toBe("active");
      expect(currentSubscription.paymentStatus, "Payment should be SUCCEEDED before each test").toBe("SUCCEEDED");
    });

    it("CHANGE sub: Buy MONTHLY → Buy YEARLY (creates future sub)", async () => {
      logger.info("Testing subscription UPGRADE flow", {
        currentSubscriptionId: currentSubscription.id,
        currentStatus: currentSubscription.status,
        currentTermEnd: currentSubscription.currentTermEnd,
      });

      // STEP 1: Get updated plans available AFTER first subscription bought
      const updatedPlansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: setup.devices.dogStandard!.id,
        countryCode: setup.devices.dogStandard!.countryCode,
        serialNumber: setup.devices.dogStandard!.serialNumber,
      });

      // STEP 2: Find YEARLY plan to buy
      const yearlyPlan = updatedPlansResponse.getSubscriptionPlans
        .plans!.flatMap((item) => item.pricings)
        .find((pricing) => pricing!.periodUnit === "year");

      logger.info("Yearly plan selected for upgrade", {
        planId: yearlyPlan!.id,
        planName: yearlyPlan!.name,
        price: yearlyPlan!.price,
        period: yearlyPlan!.period,
        periodUnit: yearlyPlan!.periodUnit,
      });

      // STEP 3: Buy YEARLY subscription (should create FUTURE)
      const purchaseYearlyResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [yearlyPlan!.id],
          card: fxt.current.card.valid,
        },
      });

      // STEP 4: Get ALL subscriptions (current + future) via getSubscriptions
      expect(
        purchaseYearlyResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed for yearly subscription - Error: ${purchaseYearlyResponse.utilityIntegrationTest.message}`,
      ).toBe("200");
      logger.info("Yearly subscription purchased successfully");

      const subscriptionsResponse = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.devices.dogStandard!.id }),
        {
          isReady: (result) => {
            const subs = result.getSubscriptions.subscriptions!;
            if (subs.length !== 2) return false;
            const futureSub = subs.find((sub) => sub.status === "future");
            return futureSub?.paymentStatus === "SUCCEEDED";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: New subscription just purchased not found in ${fxt.polling.timeoutMs} `,
        },
      );

      expect(
        subscriptionsResponse.getSubscriptions.code,
        `getSubscriptions should succeed - Error: ${subscriptionsResponse.getSubscriptions.message}${subscriptionsResponse.getSubscriptions.translationCode ? ` (${subscriptionsResponse.getSubscriptions.translationCode})` : ""}`,
      ).toBe("200");

      const allSubscriptions = subscriptionsResponse.getSubscriptions.subscriptions;
      expect(allSubscriptions!.length, "Should have 2 subscriptions (current + future)").toBe(2);

      logger.info("📋 All subscriptions retrieved", {
        count: allSubscriptions!.length,
        subscriptions: allSubscriptions!.map((sub) => ({
          id: sub.id,
          status: sub.status,
          billingPeriodUnit: sub.billingPeriodUnit,
          currentTermStart: sub.currentTermStart,
          currentTermEnd: sub.currentTermEnd,
          subscriptionItemsCount: sub.subscriptionItems.length,
          items: sub.subscriptionItems.map((item) => ({
            name: item.name,
            itemType: item.itemType,
            itemPriceId: item.itemPriceId,
          })),
        })),
      });

      // STEP 6: Find current (active) and future subscriptions
      const currentSub = allSubscriptions!.find((sub) => sub.status === "active");
      const futureSub = allSubscriptions!.find((sub) => sub.status === "future");
      expect(currentSub, "Should have current active subscription").toBeDefined();
      expect(futureSub, "Should have future subscription").toBeDefined();

      logger.info("✅ Subscriptions identified", {
        current: {
          id: currentSub!.id,
          status: currentSub!.status,
          billingPeriodUnit: currentSub!.billingPeriodUnit,
          currentTermEnd: currentSub!.currentTermEnd,
        },
        future: {
          id: futureSub!.id,
          status: futureSub!.status,
          billingPeriodUnit: futureSub!.billingPeriodUnit,
          currentTermStart: futureSub!.currentTermStart,
        },
      });

      // STEP 7: Verify future subscription matches purchased yearly plan
      expectSubBoughtMatchSubToBuy(futureSub!, yearlyPlan!, {
        expectedStatus: "future",
        expectedPaymentStatus: "SUCCEEDED",
      });

      // Verify future subscription starts when current ends
      assertDatesWithinTolerance(futureSub!.currentTermStart!, currentSub!.currentTermEnd!, 0.5, "Future sub should start when current ends");
    });

    it.todo("AUTOMATIC RENEWAL of active subscription");
    it.todo("DUNNING for active subscription");
    it.todo("CANCEL active sub (with & without fee)", async () => {
      // Use currentSubscription directly (already available from beforeEach)
      expect(currentSubscription).toBeDefined();
      expect(currentSubscription.status).toBe("active");

      const subscriptionId = currentSubscription.id;
      const currentTermEnd = currentSubscription.currentTermEnd;

      logger.info("Testing subscription cancellation", {
        subscriptionId,
        currentStatus: currentSubscription.status,
      });

      // STEP 1: Cancel the subscription (stop auto-renewal)
      const cancelResponse = await petlink.core.graphqlHttp.authJwt.stopRenewingSubscription({
        subscriptionId,
        appBrand: fxt.current.appBrand,
        cancelReason: "Testing cancellation flow for integration tests",
        cancelReasonCode: CancelReasonCodeEnum.Other,
      });

      expect(
        cancelResponse.stopRenewingSubscription?.code,
        `stopRenewingSubscription should succeed - Error: ${cancelResponse.stopRenewingSubscription?.message}${cancelResponse.stopRenewingSubscription?.translationCode ? ` (${cancelResponse.stopRenewingSubscription?.translationCode})` : ""}`,
      ).toBe("200");

      // STEP 2: Verify subscription is now "non_renewing" but still active until term end
      const subAfterCancel = await waitFor(
        async () =>
          petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({
            productId: setup.devices.dogStandard!.id,
          }),
        {
          isReady: (result) => {
            return result.getSubscriptionByProductId.subscription?.status === "non_renewing";
          },
          timeoutMs: fxt.polling.timeoutMs,
          intervalMs: fxt.polling.intervalMs,
          timeoutError: `Timeout: Subscription status did not change to "non_renewing" in ${fxt.polling.timeoutMs} ms`,
        },
      );

      const subAfter = subAfterCancel.getSubscriptionByProductId.subscription!;

      logger.info("Subscription cancelled successfully", {
        subscriptionId: subAfter.id,
        oldStatus: currentSubscription.status,
        newStatus: subAfter.status,
      });

      expect(subAfter.status, `Subscription status should change from active to non_renewing`).toBe("non_renewing");
      expect(subAfter.id, "Subscription ID should remain unchanged after cancel renewal").toBe(currentSubscription.id);
      expect(subAfter.currentTermEnd, "Subscription term end date should remain unchanged after cancel renewal").toBe(currentTermEnd);
    });
  });
});
