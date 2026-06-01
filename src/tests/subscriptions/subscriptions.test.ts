import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { fxt } from "../../fixtures/fixtures.js";
import { logger } from "../../config/logger.js";
import {
  UtilityTestTypeEnum,
  LanguageId,
  OnSubscriptionStatusDocument,
  SubscriptionStatusEnum,
  PaymentStatusTypeEnum,
  PetProtectionStatus,
  SubscriptionShortInfo,
  ScheduledChanges,
  SubscriptionShortInfoItem,
  InvoiceStatusEnum,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { AddFreePeriod, CouponSetMode } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { waitFor } from "../../helpers/utils.js";

describe("DEFAULT", () => {


  describe("SETUP & PREREQUISITES", () => {
    let setup: TestSetup = {} as TestSetup;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      const builder = testHelper.setupBuilder().withUser().withDog({ withDevice: true }).withCat({ withDevice: true });

      // Add EVO device only for KIPPY brand
      if (fxt.isKippyRun) {
        builder.withDogForEvo({ withDevice: true });
      }

      setup = await builder.build();
    });

    it("Each device type should has at least 1 sub plan available", async () => {
      const dogPlans = setup.dog!.device!.availablePlans!;
      const catPlans = setup.cat!.device!.availablePlans!;
      const evoPlans = setup.dogForEvo?.device?.availablePlans;

      expect(dogPlans, "Dog device should have subscription plans defined").toBeDefined();
      expect(Array.isArray(dogPlans), "Subscription plans should be returned as an array").toBe(true);
      expect(dogPlans.length, "Dog device should have at least one subscription plan available").toBeGreaterThan(0);

      expect(catPlans, "Cat device should have subscription plans defined").toBeDefined();
      expect(Array.isArray(catPlans), "Subscription plans should be returned as an array").toBe(true);
      expect(catPlans.length, "Cat device should have at least one subscription plan available").toBeGreaterThan(0);

      if (fxt.isKippyRun && evoPlans) {
        expect(evoPlans, "EVO device should have subscription plans defined").toBeDefined();
        expect(Array.isArray(evoPlans), "Subscription plans should be returned as an array").toBe(true);
        expect(evoPlans.length, "EVO device should have at least one subscription plan available").toBeGreaterThan(0);
      }
    });

    it("Should return the price adjusted to the user's billing currency", async () => {
      const device = setup.dog!.device!;

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
      logger.info("Billing info updated", {
        sentCity: user.city,
        returnedCity: updatedBillingInfo.getBillingInfo.billingInfo?.city,
      });

      expect(updatedBillingInfo.getBillingInfo.billingInfo, "Billing info should be defined after update").toBeDefined();
      expect(updatedBillingInfo.getBillingInfo.billingInfo?.city, "Billing city should match updated value").toBe(user.city);
    });
  });

  describe("BUY (sub, deviceProtection, petProtection)", () => {
    let setup: TestSetup = {} as TestSetup;
    let availablePlansForThisDevice: any[] = [];
    let availablePetProtectionForThisPet: any[] = [];

    beforeEach(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).withCat({ withDevice: true }).build();
      availablePlansForThisDevice = setup.dog!.device!.availablePlans!;
      availablePetProtectionForThisPet = setup.dog!.device!.availablePetProtectionPlans!;
    });

    afterAll(() => {
      petlink.core.graphqlWS.disconnect();
    });

    it("BUY sub and verify it becomes active", async () => {
      const choosenPlan = availablePlansForThisDevice![0].pricings[0]!;
      const deviceId = setup.dog!.device!.id;

      logger.info("Testing subscription purchase", {
        planId: choosenPlan.id,
        price: choosenPlan.price,
        period: choosenPlan.period,
        periodUnit: choosenPlan.periodUnit,
      });

      // Open WebSocket subscription and purchase ONLY when ready
      const subStatusUpdated = await petlink.core.graphqlWS.authJwt.subscribeUntil(
        OnSubscriptionStatusDocument,
        { id: setup.user!.id },
        "Subscription should become active after purchase",
        (data) => data?.onSubscriptionStatus?.status?.subscriptionIsActive === true,
        async () => {
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
        },
      );

      logger.info("GraphQlSocket event received -> onSubscriptionStatus", { event: subStatusUpdated });

      // Assert on WebSocket event
      expect(subStatusUpdated, "Should arrive update of sub status from subscription").toBeDefined();
      expect(subStatusUpdated.onSubscriptionStatus.id).toBe(setup.user!.id);
      expect(subStatusUpdated.onSubscriptionStatus.status.subscriptionIsActive).toBe(true);
      expect(subStatusUpdated.onSubscriptionStatus.status.productId).toBe(deviceId);

      // Fetch final subscription details
      const subsDetails = await petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({
        productId: setup.dog!.device!.id,
      });
      const subscription = subsDetails.getSubscriptionByProductId.subscription!;

      logger.info("Subscription activated successfully", {
        subscriptionId: subscription.id,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
      });

      expect(subscription, "Subscription should match purchased plan").toMatchObject({
        currencyCode: choosenPlan.currencyCode,
        billingPeriod: choosenPlan.period,
        billingPeriodUnit: choosenPlan.periodUnit,
        status: SubscriptionStatusEnum.Active,
        paymentStatus: PaymentStatusTypeEnum.Succeeded,
      });
      expect(subscription.subscriptionItems, "Should have 1 subscription item").toHaveLength(1);
      const planItem = subscription.subscriptionItems.find((i: any) => i.itemType === "plan");
      expect(planItem, "Plan item should match purchased pricing").toMatchObject({
        itemPriceId: choosenPlan.id,
        itemId: choosenPlan.itemId,
        amount: choosenPlan.price,
        itemType: "plan",
        quantity: 1,
      });
    });

    it.runIf(fxt.isKippyRun)("BUY sub + DEVICE-protection", async () => {
      const chosenPlan = testHelper.findPlanWithAddonDeviceprotection(availablePlansForThisDevice);
      expect(chosenPlan, "Should find a plan with addon device protection").toBeDefined();

      logger.info("Testing subscription purchase with device protection addon", {
        planId: chosenPlan.id,
        addonId: chosenPlan.addon.id,
        planPrice: chosenPlan.price,
        addonPrice: chosenPlan.addon.price,
      });

      const subscription = await testHelper.purchaseSubscription(
        setup.user!,
        setup.dog!.device!,
        [chosenPlan.id, chosenPlan.addon.id],
        { waitForActive: true },
      );

      logger.info("Subscription with addon activated successfully", {
        subscriptionId: subscription.id,
        itemsCount: subscription.subscriptionItems.length,
      });

      // Verify subscription with addon matches the purchased plan
      expect(subscription, "Subscription should match purchased plan").toMatchObject({
        currencyCode: chosenPlan.currencyCode,
        billingPeriod: chosenPlan.period,
        billingPeriodUnit: chosenPlan.periodUnit,
        status: SubscriptionStatusEnum.Active,
        paymentStatus: PaymentStatusTypeEnum.Succeeded,
      });
      expect(subscription.subscriptionItems, "Should have 2 subscription items (plan + addon)").toHaveLength(2);
      const planItem = subscription.subscriptionItems.find((i: any) => i.itemType === "plan");
      expect(planItem, "Plan item should match purchased pricing").toMatchObject({
        itemPriceId: chosenPlan.id,
        itemId: chosenPlan.itemId,
        amount: chosenPlan.price,
        itemType: "plan",
        quantity: 1,
      });
      const addonItem = subscription.subscriptionItems.find((i: any) => i.itemType === "addon");
      expect(addonItem, "Addon item should match purchased addon pricing").toMatchObject({
        itemPriceId: chosenPlan.addon.id,
        itemId: chosenPlan.addon.itemId,
        amount: chosenPlan.addon.price,
        itemType: "addon",
        quantity: 1,
      });
    });

    it.runIf(fxt.isKippyRun && fxt.current.user.languageId == LanguageId.It)("BUY sub + PET-protection", async () => {
      const chosenPlan = availablePlansForThisDevice![0].pricings[0]!;
      const chosenPetProtection = availablePetProtectionForThisPet![0].pricings[0]!;
      logger.info("Chosen plans for test", { chosenPlan, chosenPetProtection });

      const [sub, petProtectionResult] = await Promise.all([
        testHelper.purchaseSubscription(
          setup.user!,
          setup.dog!.device!,
          [chosenPlan.id, chosenPetProtection.id],
          { waitForActive: true },
        ),
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.dog!.id }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
          timeoutError: `Timeout: petProtectionId not assigned to pet`,
        }),
      ]);

      const pet = petProtectionResult.getPet.pet!;
      const petProtectionResponse = await petlink.core.graphqlHttp.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      // Verify subscription matches plan
      expect(sub, "Subscription should match purchased plan").toMatchObject({
        currencyCode: chosenPlan.currencyCode,
        billingPeriod: chosenPlan.period,
        billingPeriodUnit: chosenPlan.periodUnit,
        status: SubscriptionStatusEnum.Active,
        paymentStatus: PaymentStatusTypeEnum.Succeeded,
      });
      expect(sub.subscriptionItems, "Should have 1 subscription item").toHaveLength(1);
      const planItem = sub.subscriptionItems.find((i: any) => i.itemType === "plan");
      expect(planItem, "Plan item should match purchased pricing").toMatchObject({
        itemPriceId: chosenPlan.id,
        itemId: chosenPlan.itemId,
        amount: chosenPlan.price,
        itemType: "plan",
        quantity: 1,
      });

      // Verify pet protection matches plan
      expect(petProtection, "Pet protection should match purchased plan").toMatchObject({
        name: chosenPetProtection.externalName,
        price: chosenPetProtection.price,
        currencyCode: chosenPetProtection.currencyCode,
        period: chosenPetProtection.period,
        periodUnit: chosenPetProtection.periodUnit,
        petId: pet.id,
        userId: setup.user!.id,
        status: PetProtectionStatus.Open,
      });
    });

    it.runIf(fxt.isKippyRun && fxt.current.user.languageId == LanguageId.It)("BUY sub + DEVICE-protection + PET-protection", async () => {
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

      // Wait for both subscription active and petProtection assignment
      const [subscription, petProtectionResult] = await Promise.all([
        testHelper.purchaseSubscription(
          setup.user!,
          setup.dog!.device!,
          [chosenPlan.id, chosenPlan.addon.id, chosenPetProtection.id],
          { waitForActive: true },
        ),
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.dog!.id }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
          timeoutError: `Timeout: petProtectionId not assigned to pet`,
        }),
      ]);

      const pet = petProtectionResult.getPet.pet!;

      logger.info("Combined subscription + pet protection activated", {
        subscriptionId: subscription.id,
        itemsCount: subscription.subscriptionItems.length,
        petProtectionId: pet.petProtectionId,
      });

      // Verify subscription with addon matches plan
      expect(subscription, "Subscription should match purchased plan").toMatchObject({
        currencyCode: chosenPlan.currencyCode,
        billingPeriod: chosenPlan.period,
        billingPeriodUnit: chosenPlan.periodUnit,
        status: SubscriptionStatusEnum.Active,
        paymentStatus: PaymentStatusTypeEnum.Succeeded,
      });
      expect(subscription.subscriptionItems, "Should have 2 subscription items (plan + addon)").toHaveLength(2);
      const planItem = subscription.subscriptionItems.find((i: any) => i.itemType === "plan");
      expect(planItem, "Plan item should match purchased pricing").toMatchObject({
        itemPriceId: chosenPlan.id,
        itemId: chosenPlan.itemId,
        amount: chosenPlan.price,
        itemType: "plan",
        quantity: 1,
      });
      const addonItem = subscription.subscriptionItems.find((i: any) => i.itemType === "addon");
      expect(addonItem, "Addon item should match purchased addon pricing").toMatchObject({
        itemPriceId: chosenPlan.addon.id,
        itemId: chosenPlan.addon.itemId,
        amount: chosenPlan.addon.price,
        itemType: "addon",
        quantity: 1,
      });

      // Verify pet protection assigned and matches plan
      expect(pet.petProtectionId, "Pet should have a petProtectionId assigned").toBeDefined();
      const petProtectionResponse = await petlink.core.graphqlHttp.authJwt.getPetProtection({ petProtectionId: pet.petProtectionId! });
      const petProtection = petProtectionResponse.getPetProtection.petProtection!;

      expect(petProtection, "Pet protection should match purchased plan").toMatchObject({
        name: chosenPetProtection.externalName,
        price: chosenPetProtection.price,
        currencyCode: chosenPetProtection.currencyCode,
        period: chosenPetProtection.period,
        periodUnit: chosenPetProtection.periodUnit,
        petId: pet.id,
        userId: setup.user!.id,
        status: PetProtectionStatus.Open,
      });
    });

    it.runIf(fxt.isKippyRun && fxt.current.user.languageId == LanguageId.It)("BUY PET-protection alone", async () => {
      logger.info("dentro BUY PET-protection alone");
      const petProtectionPlan = availablePetProtectionForThisPet![0].pricings[0]!;
      const regularPlan = availablePlansForThisDevice![0].pricings[0]!;

      // STEP 2: Purchase a regular subscription first and wait for active
      const activeSub = await testHelper.purchaseSubscription(
        setup.user!,
        setup.dog!.device!,
        [regularPlan.id],
        { waitForActive: true },
      );

      // STEP 4: Purchase pet protection alone
      logger.info(`bought PET-PROTECTION for device ${setup.dog!.device!.id}, start to wait to become active`);
      const petProtectionPurchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.dog!.device!.id,
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
      const petProtectionResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.dog!.id }), {
        isReady: (result) => result.getPet.pet!.petProtectionId != null,
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
      expect(petProtection, "Pet protection should match purchased plan").toMatchObject({
        name: petProtectionPlan.externalName,
        price: petProtectionPlan.price,
        currencyCode: petProtectionPlan.currencyCode,
        period: petProtectionPlan.period,
        periodUnit: petProtectionPlan.periodUnit,
        petId: pet.id,
        userId: setup.user!.id,
        status: PetProtectionStatus.Open,
      });

      // Owner & Pet match
      expect(petProtection.petOwner, "Owner data should match").toEqual(petProtectionOwner);
      expect(petProtection.pet, "Pet data should match").toEqual(petProtectionPet);
    });
  });

  describe("CHANGE (upgrade/downgrade)", () => {
    let setup: TestSetup = {} as TestSetup;
    let currentSubscription: SubscriptionShortInfo;
    let monthlyPlan: any;
    let yearlyPlan: any;

    async function setupCleanMonthlySub(): Promise<{
      setup: TestSetup;
      monthlyPlan: any;
      yearlyPlan: any;
      currentSubscription: SubscriptionShortInfo;
    }> {
      const maxRetries = 5;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await testHelper.cleanupAll();
        const built = await testHelper.setupBuilder()
          .withUser()
          .withDog({ withDevice: true })
          .build();

        const device = built.dog!.device!;

        // --- RILEVAZIONE PREPAID ORPHAN SUBSCRIPTION ---
        const hasPrepaidHint = (device as any).subscriptionPlan === "prepaid";
        if (hasPrepaidHint) {
          logger.warn(`Stray subscription detected on ${device.serialNumber} (attempt ${attempt}/${maxRetries}), retrying cleanup...`);
          continue;
        }

        const allPricings = device.availablePlans!.flatMap((p: any) => p.pricings);
        const m = allPricings.find((pr: any) => pr.periodUnit === "month");
        const y = allPricings.find((pr: any) => pr.periodUnit === "year");
        expect(m, "A MONTHLY pricing must be available").toBeDefined();
        expect(y, "A YEARLY pricing must be available").toBeDefined();

        // --- ACQUISTA MONTHLY ---
        const sub = await testHelper.purchaseSubscription(built.user!, device, [m.id], { waitForActive: true });
        expect(sub.billingPeriodUnit, "Baseline sub should be MONTHLY").toBe("month");
        expect(sub.scheduledChanges, "Fresh sub should have no scheduled changes").toBeFalsy();

        return { setup: built, monthlyPlan: m, yearlyPlan: y, currentSubscription: sub };
      }

      throw new Error(`Unable to get a clean device after ${maxRetries} cleanup attempts`);
    }

    beforeEach(async () => {
      const state = await setupCleanMonthlySub();
      setup = state.setup;
      monthlyPlan = state.monthlyPlan;
      yearlyPlan = state.yearlyPlan;
      currentSubscription = state.currentSubscription;
    });


    it("CHANGE sub: Buy MONTHLY → Buy YEARLY should creates schedule change", async () => {
      // STEP 1: Trigger plan change to yearly
      const changeResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.ChangeSubscriptionPlan,
          subscriptionId: currentSubscription.id,
          priceIds: [yearlyPlan.id],
        },
      });
      expect(
        changeResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest CHANGE_SUBSCRIPTION_PLAN should succeed - Error: ${changeResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // STEP 2: Wait for scheduledChanges to appear on the same sub (using getSubscriptions)
      const updated = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.dog!.device!.id }), {
        isReady: (result) => {
          const subs = result.getSubscriptions.subscriptions;
          const sub = subs?.[0];
          return sub?.id === currentSubscription.id && sub?.scheduledChanges != null;
        },
        timeoutError: `Timeout: scheduledChanges with yearly plan not appearing on subscription`,
      });
      const sub = updated.getSubscriptions.subscriptions![0]!;

      logger.info("Subscription with scheduledChanges retrieved");
      // STEP 3: getSubscriptions returns ONE sub (no future sibling in new flow)
      expect(updated.getSubscriptions.code).toBe("200");
      expect(updated.getSubscriptions.subscriptions!.length, "Should have exactly 1 subscription (no Future)").toBe(1);

      // STEP 4: Current sub still MONTHLY/Active, untouched
      expect(sub.id).toBe(currentSubscription.id);
      expect(sub.status).toBe(SubscriptionStatusEnum.Active);
      expect(sub.paymentStatus).toBe(PaymentStatusTypeEnum.Succeeded);
      expect(sub.billingPeriodUnit, "Current sub period must remain monthly").toBe("month");
      const currentPlanItem = sub.subscriptionItems.find((i: SubscriptionShortInfoItem) => i.itemType === "plan");
      expect(currentPlanItem!.itemPriceId, "Current plan item still the monthly one").toBe(monthlyPlan.id);

      // STEP 5: scheduledChanges contains the yearly plan
      expect(sub.scheduledChanges, "scheduledChanges should be populated").toBeDefined();
      expect(sub.scheduledChanges!.billingPeriodUnit).toBe(yearlyPlan.periodUnit);
      expect(sub.scheduledChanges!.billingPeriod).toBe(yearlyPlan.period);
      expect(sub.scheduledChanges!.currencyCode).toBe(yearlyPlan.currencyCode);
      const scheduledPlanItem = sub.scheduledChanges!.items!.find((i: SubscriptionShortInfoItem) => i.itemType === "plan");
      expect(scheduledPlanItem, "scheduledChanges should include the new plan item").toMatchObject({
        itemPriceId: yearlyPlan.id,
        itemId: yearlyPlan.itemId,
        itemType: "plan",
        quantity: 1,
      });

      // STEP 6: Schedule kicks in when current term ends
      expect(sub.scheduledChanges!.currentTermStart!).toBeWithinHoursOf(sub.currentTermEnd!, 0.5);
    });

    it("CHANGE sub: a second change while one is already scheduled should fail", async () => {
      // STEP 1: First change → schedules YEARLY
      const firstChange = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.ChangeSubscriptionPlan,
          subscriptionId: currentSubscription.id,
          priceIds: [yearlyPlan.id],
        },
      });
      expect(firstChange.utilityIntegrationTest.code, "First CHANGE should succeed").toBe("200");

      // Wait until scheduledChanges is actually persisted (using getSubscriptions)
      await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.dog!.device!.id }), {
        isReady: (result) => result.getSubscriptions.subscriptions?.[0]?.scheduledChanges != null,
        timeoutError: `Timeout: first scheduledChanges did not appear`,
      });

      // STEP 2: Second change attempt → must fail (only 1 schedule allowed at a time)
      const secondChange = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.ChangeSubscriptionPlan,
          subscriptionId: currentSubscription.id,
          priceIds: [monthlyPlan.id],
        },
      });
      expect(
        secondChange.utilityIntegrationTest.code,
        `Second CHANGE should fail because a scheduled change already exists - got ${secondChange.utilityIntegrationTest.code}: ${secondChange.utilityIntegrationTest.message}`,
      ).not.toBe("200");

      // STEP 3: Verify the original scheduledChange is still the yearly one (no overwrite)
      const stillScheduled = await petlink.core.graphqlHttp.authJwt.getSubscriptions({
        productId: setup.dog!.device!.id,
      });
      const sub = stillScheduled.getSubscriptions.subscriptions![0]!;
      expect(sub.scheduledChanges, "scheduledChanges should still be present").toBeDefined();
      const scheduledPlanItem = sub.scheduledChanges!.items!.find((i: SubscriptionShortInfoItem) => i.itemType === "plan");
      expect(scheduledPlanItem!.itemPriceId, "scheduledChanges should still target the original yearly plan").toBe(yearlyPlan.id);
    });

  });

  describe("AUTOMATIC_RENEW", () => {
    let setup: TestSetup = {} as TestSetup;

    beforeEach(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).build();
    });

    // buy & wait active -> Force renew by moving nextBillingDate to now ->poll until (?)-> assert
    it("Succeeded - should renew subscription and create a paid invoice", async () => {
      const device = setup.dog!.device!;
      const plan = device.availablePlans![0].pricings[0];

      // 1. Buy and wait active
      const subBefore = await testHelper.purchaseSubscription(setup.user!, device, [plan.id], { waitForActive: true });
      const originalTermEnd = subBefore.currentTermEnd!;

      const initialSubsResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptions({
        productId: device.id,
      });
      const originalInvoicesCount = initialSubsResponse.getSubscriptions.subscriptions![0].invoices?.length ?? 0;

      // 2. Force renew by moving nextBillingDate to now
      const travelResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.UpdateSubscriptionNextBillingDate,
          subscriptionId: subBefore.id,
          nextBillingDate: new Date().toISOString(),
        },
      });
      expect(travelResponse.utilityIntegrationTest.code).toBe("200");

      // 3. Poll until term shifts (renew is async)
      const renewedResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: device.id }), {
        isReady: (res) => {
          const sub = res.getSubscriptions.subscriptions?.[0];
          if (!sub?.currentTermEnd) return false;
          return new Date(sub.currentTermEnd).getTime() > new Date(originalTermEnd).getTime();
        },
        timeoutError: "Timeout: subscription did not renew after time travel",
      });
      const subAfter = renewedResult.getSubscriptions.subscriptions![0]!;

      // 4. Assert dates, status and payment
      expect(subAfter.status).toBe(SubscriptionStatusEnum.Active);
      expect(subAfter.paymentStatus).toBe(PaymentStatusTypeEnum.Succeeded);
      expect(new Date(subAfter.currentTermStart!).getTime()).toBeGreaterThanOrEqual(new Date(originalTermEnd).getTime());

      // 5. Assert invoice
      expect(subAfter.invoices?.length).toBeGreaterThan(originalInvoicesCount);
      const newInvoice = subAfter.invoices!.find((inv) => new Date(inv.creationDate).getTime() > Date.now() - 120_000);
      expect(newInvoice).toBeDefined();
      expect(newInvoice!.status).toBe(InvoiceStatusEnum.Paid as any);
    });

    //here: UtilityTestTypeEnum.UpdateSubscriptionNextBillingDate
    it("Dunning - should fail payment and enter dunning when card has no funds", async () => {
      const device = setup.dog!.device!;
      const plan = device.availablePlans![0].pricings[0];

      // 1. Buy with valid card
      const subBefore = await testHelper.purchaseSubscription(setup.user!, device, [plan.id], { waitForActive: true });

      // 2. Swap to no-funds card (assuming utilityIntegrationTest supports this)
      const updateCardResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.UpdatePaymentMethod,
          subscriptionId: subBefore.id,
          card: fxt.current.card.insufficientFunds,
        },
      });
      expect(updateCardResponse.utilityIntegrationTest.code).toBe("200");

      // 3. Force renew
      const travelResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.UpdateSubscriptionNextBillingDate,
          subscriptionId: subBefore.id,
          nextBillingDate: new Date().toISOString(),
        },
      });
      expect(travelResponse.utilityIntegrationTest.code).toBe("200");

      // 4. Poll until dunning appears
      const dunningResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: device.id }), {
        isReady: (res) => {
          const sub = res.getSubscriptions.subscriptions?.[0];
          return !!sub?.dunningStatus || (sub?.dunningAttempts && sub.dunningAttempts.length > 0);
        },
        timeoutError: "Timeout: dunning did not start after failed renew",
      });
      const subAfter = dunningResult.getSubscriptions.subscriptions![0]!;

      // 5. Assert dunning state
      expect(subAfter.paymentStatus).toBe(PaymentStatusTypeEnum.Failed);
      expect(subAfter.dunningStatus).toBeTruthy();
      expect(subAfter.dunningAttempts!.length).toBeGreaterThan(0);

      // Term should NOT shift on failed renew
      expect(new Date(subAfter.currentTermEnd!).getTime()).toBe(new Date(subBefore.currentTermEnd!).getTime());
    });
  });

  describe("STOP RENEW", () => {});

  describe("CANCEL/REFUND", () => {})
});

describe.skip("TRIAL (Trial 1 month, Esselunga)", () => {});

describe.skip("PAID_EXTERNALLY (Axa,Europass)", () => {});

describe.skip("PREPAID (purchase on external store)", () => {});

describe("NOT_PAYING", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).build();
  });

  it("Add Free period on device WITHOUT sub should create active non-paying sub", async () => {
    const device = setup.dog!.device!;
    const freePeriod = AddFreePeriod.Add_30Days;
    const daysOfFreePeriod = 30;

    logger.info("Testing addFreePeriod on device without subscription", {
      serialNumber: device.serialNumber,
      freePeriod,
    });

    const addFreePeriodResponse = await petlink.cct.graphqlHttp.authJwt.addFreePeriod({
      freePeriod,
      productId: device.id,
      serialNumber: device.serialNumber,
    });

    expect(addFreePeriodResponse.addFreePeriod.code, `addFreePeriod should succeed - Error: ${addFreePeriodResponse.addFreePeriod.message}`).toBe(
      "200",
    );

    const subscriptionResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => result.getSubscriptionByProductId.subscription != null,
      timeoutError: `Timeout: Subscription not created after addFreePeriod in ${fxt.polling.timeoutMs}ms`,
    });
    const coreSubscription = subscriptionResult.getSubscriptionByProductId.subscription!;
    expect(coreSubscription).toMatchObject({
      status: SubscriptionStatusEnum.InTrial,
      billingPeriod: daysOfFreePeriod,
      billingPeriodUnit: "days",
    });
    expect({ start: coreSubscription.currentTermStart!, end: coreSubscription.currentTermEnd! }).toHaveDaysDurationOf(daysOfFreePeriod);

    const cctSubscriptionsResponse = await petlink.cct.graphqlHttp.authJwt.getSubscriptions({
      deviceId: device.id,
    });
    expect(cctSubscriptionsResponse.getSubscriptions.code).toBe("200");
    const cctSubscription = cctSubscriptionsResponse.getSubscriptions.items![0];
    expect(cctSubscription).toMatchObject({
      userId: setup.user!.id,
      productId: device.id,
      serialNumber: device.serialNumber,
      status: SubscriptionStatusEnum.InTrial,
      addedFreePeriod: daysOfFreePeriod,
      billingPeriod: daysOfFreePeriod,
      billingPeriodUnit: "days",
      businessEntityId: "DATAMARS",
    });
    expect({ start: cctSubscription.currentTermStart!, end: cctSubscription.currentTermEnd! }).toHaveDaysDurationOf(daysOfFreePeriod);
  });

  it("Add Free period on device WITH active sub should extend current subscription", async () => {
    const device = setup.dog!.device!;
    const daysOfFreePeriod = 14;
    const freePeriod = AddFreePeriod.Add_14Days;

    const initialSubscription = await testHelper.purchaseSubscription(
      setup.user!,
      device,
      [device.availablePlans![0].pricings[0].id],
      { waitForActive: true },
    );
    const originalCurrentTermEnd = initialSubscription.currentTermEnd;

    const initialCctSubscriptionsResponse = await petlink.cct.graphqlHttp.authJwt.getSubscriptions({
      deviceId: device.id,
    });
    const originalAddedFreePeriod = initialCctSubscriptionsResponse.getSubscriptions.items![0].addedFreePeriod || 0;

    const addFreePeriodResponse = await petlink.cct.graphqlHttp.authJwt.addFreePeriod({
      freePeriod,
      productId: device.id,
      serialNumber: device.serialNumber,
    });

    expect(addFreePeriodResponse.addFreePeriod.code, `addFreePeriod should succeed - Error: ${addFreePeriodResponse.addFreePeriod.message}`).toBe(
      "200",
    );

    const updatedSubResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        const newCurrentTermEnd = sub?.currentTermEnd;
        return !!newCurrentTermEnd && new Date(newCurrentTermEnd).getTime() > new Date(originalCurrentTermEnd!).getTime();
      },
      timeoutError: `Timeout: currentTermEnd did not move forward after addFreePeriod`,
    });

    const updatedSubscription = updatedSubResult.getSubscriptionByProductId.subscription!;

    const updatedCctSubscriptionsResponse = await petlink.cct.graphqlHttp.authJwt.getSubscriptions({
      deviceId: device.id,
    });

    expect(updatedSubscription.id, "Free period should extend the current subscription, not create a new one").toBe(initialSubscription.id);
    expect(updatedSubscription.status, "Subscription should remain active").toBe(SubscriptionStatusEnum.Active);
    expect(updatedSubscription.paymentStatus, "Subscription should remain paid").toBe(PaymentStatusTypeEnum.Succeeded);

    expect(new Date(updatedSubscription.currentTermEnd!).getTime(), "currentTermEnd should move forward").toBeGreaterThan(
      new Date(originalCurrentTermEnd!).getTime(),
    );
    expect(updatedCctSubscriptionsResponse.getSubscriptions.items![0].addedFreePeriod, "addedFreePeriod should accumulate").toBe(
      originalAddedFreePeriod + daysOfFreePeriod,
    );
  });
});

describe.skip("COUPON", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog({ withDevice: true }).build();
  });

  it("Coupon pre-assigned to device applies discount on purchase", async () => {
    const device = setup.dog!.device!;

    // STEP 1: Get available coupons
    const couponsResponse = await petlink.cct.graphqlHttp.authJwt.getCoupons();

    expect(couponsResponse.getCoupons.code, `getCoupons should succeed - Error: ${couponsResponse.getCoupons.message}`).toBe("200");

    const availableCoupons = couponsResponse.getCoupons.coupons;
    expect(availableCoupons, "Should have at least one coupon available").toBeDefined();
    expect(availableCoupons!.length, "Coupons array should not be empty").toBeGreaterThan(0);

    const coupon = availableCoupons![0];
    logger.info("Selected coupon for test", { couponId: coupon.id, couponName: coupon.name });

    // STEP 2: Assign coupon to device
    const setCouponResponse = await petlink.cct.graphqlHttp.authJwt.setCoupon({
      serialNumbers: [device.serialNumber],
      couponId: coupon.id,
      setMode: CouponSetMode.Apply,
    });

    expect(setCouponResponse.setCoupon.code, `setCoupon should succeed - Error: ${setCouponResponse.setCoupon.message}`).toBe("200");

    logger.info("Coupon assigned to device", {
      serialNumber: device.serialNumber,
      couponId: coupon.id,
      failureList: setCouponResponse.setCoupon.failureList,
    });

    // STEP 3: Buy subscription
    const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      productId: device.id,
      countryCode: device.countryCode,
      serialNumber: device.serialNumber,
    });
    const chosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    // STEP 4: Purchase and wait for subscription to become active
    const subscription = await testHelper.purchaseSubscription(
      setup.user!,
      device,
      [chosenPlan.id],
      { waitForActive: true },
    ) as any;

    logger.info("Subscription purchased with coupon", {
      subscriptionId: subscription.id,
      invoicesCount: subscription.invoices?.length,
    });

    // STEP 5: Verify discount in invoice
    expect(subscription.invoices, "Subscription should have invoices").toBeDefined();
    expect(subscription.invoices!.length, "Should have at least one invoice").toBeGreaterThan(0);

    const firstInvoice = subscription.invoices![0];
    expect(firstInvoice.discountItems, "Invoice should have discount items").toBeDefined();
    expect(firstInvoice.discountItems!.length, "Should have at least one discount item").toBeGreaterThan(0);

    const discountItem = firstInvoice.discountItems![0];
    expect(discountItem.couponId, "Discount should be from the assigned coupon").toBe(coupon.id);
    expect(discountItem.amount, "Discount amount should be positive").toBeGreaterThan(0);

    logger.info("Coupon discount verified", {
      couponId: discountItem.couponId,
      discountAmount: discountItem.amount,
    });
  });
});

