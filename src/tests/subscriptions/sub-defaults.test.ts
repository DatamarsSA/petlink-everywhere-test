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
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { waitFor } from "../../helpers/utils.js";


describe("DEFAULT", () => {
  describe("SETUP & PREREQUISITES", () => {
    let setup: TestSetup = {} as TestSetup;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      const builder = testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice();

      // Add EVO device only for KIPPY brand
      if (fxt.isKippyRun) {
        builder.withDogForEvo().withDogEvoDevice();
      }

      setup = await builder.build();
    });

    it("Each device type should has at least 1 sub plan available", async () => {
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
      setup = await testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice().build();
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
        productId: setup.devices.dogStandard!.id,
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
            return sub?.status === SubscriptionStatusEnum.Active && sub?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
          },
          timeoutError: `Timeout: Subscription status did not change to "${SubscriptionStatusEnum.Active}" in ${fxt.polling.timeoutMs}ms`,
        },
      );

      const subscription = purchasedSubscriptions.getSubscriptionByProductId.subscription!;

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
            return sub?.status === SubscriptionStatusEnum.Active && sub?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
          },
          timeoutError: `Timeout: Subscription status did not change to "${SubscriptionStatusEnum.Active}"`,
        }),
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.pets.dog!.id! }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
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
            return sub?.status === SubscriptionStatusEnum.Active && sub?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
          },
          timeoutError: `Timeout: Subscription not active with ${PaymentStatusTypeEnum.Succeeded} payment`,
        }),
        waitFor(async () => petlink.core.graphqlHttp.authJwt.getPet({ id: setup.pets.dog!.id! }), {
          isReady: (result) => result.getPet.pet!.petProtectionId != null,
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
      logger.info(`bought SUB for device ${setup.devices.dogStandard!.id}, start to wait to become active`);
      const activeSubscription = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: setup.devices.dogStandard!.id }),
        {
          isReady: (result) => {
            const sub = result.getSubscriptionByProductId.subscription;
            return sub?.status === SubscriptionStatusEnum.Active && sub?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
          },
          timeoutError: `Timeout: Subscription status did not change to "${SubscriptionStatusEnum.Active}" with ${PaymentStatusTypeEnum.Succeeded} payment`,
        },
      );

      const activeSub = activeSubscription.getSubscriptionByProductId.subscription!;
      expect(activeSub.status, "Subscription should be active before purchasing pet protection").toBe(SubscriptionStatusEnum.Active);
      expect(activeSub.paymentStatus, "Payment status should be SUCCEEDED before purchasing pet protection").toBe(PaymentStatusTypeEnum.Succeeded);

      // STEP 4: Purchase pet protection alone
      logger.info(`bought PET-PROTECTION for device ${setup.devices.dogStandard!.id}, start to wait to become active`);
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
    let availablePlansForThisDevice: any[] = [];
    let monthlyPlan: any;
    let yearlyPlan: any;

    beforeEach(async () => {
      // STEP 1: Cleanup e setup base (no cat needed here)
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();

      // STEP 2: update Billing info + get available plans
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
      const allPricings = availablePlansForThisDevice.flatMap((p) => p.pricings);
      monthlyPlan = allPricings.find((pr: any) => pr.periodUnit === "month");
      yearlyPlan = allPricings.find((pr: any) => pr.periodUnit === "year");
      expect(monthlyPlan, "A MONTHLY pricing must be available for the device").toBeDefined();
      expect(yearlyPlan, "A YEARLY pricing must be available for the device").toBeDefined();

      // STEP 3: Buy MONTHLY plan (deterministic baseline for CHANGE tests)
      const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.devices.dogStandard!.id,
          priceIds: [monthlyPlan.id],
          card: fxt.current.card.valid,
        },
      });
      expect(
        purchaseResponse.utilityIntegrationTest.code,
        `utilityIntegrationTest should succeed in beforeEach - Error: ${purchaseResponse.utilityIntegrationTest.message}`,
      ).toBe("200");

      // STEP 4: Wait for subscription to become active and store it
      // Use getSubscriptions because scheduledChanges is only on SubscriptionShortInfo
      const subscriptionsResult = await waitFor(
        async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.devices.dogStandard!.id }),
        {
          isReady: (result) => {
            const subs = result.getSubscriptions.subscriptions;
            return subs?.length === 1 && subs[0]?.status === SubscriptionStatusEnum.Active && subs[0]?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
          },
          timeoutError: `Timeout: Subscription status did not change to "${SubscriptionStatusEnum.Active}" with ${PaymentStatusTypeEnum.Succeeded} payment`,
        },
      );

      currentSubscription = subscriptionsResult.getSubscriptions.subscriptions![0]!;

      logger.info("Subscription ready for CHANGE tests", {
        subscriptionId: currentSubscription.id,
        status: currentSubscription.status,
        billingPeriodUnit: currentSubscription.billingPeriodUnit,
      });

      expect(currentSubscription.billingPeriodUnit, "Baseline sub should be MONTHLY").toBe("month");
      expect(currentSubscription.scheduledChanges, "Fresh sub should have no scheduled changes").toBeFalsy();
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
      const updated = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.devices.dogStandard!.id }), {
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
      await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.devices.dogStandard!.id }), {
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
      ).not.toBe("200"); //todo: here correct that doesn't work, but it's correct 500 just Database Internal Server Error {"code":"500"}?

      // STEP 3: Verify the original scheduledChange is still the yearly one (no overwrite)
      const stillScheduled = await petlink.core.graphqlHttp.authJwt.getSubscriptions({
        productId: setup.devices.dogStandard!.id,
      });
      const sub = stillScheduled.getSubscriptions.subscriptions![0]!;
      expect(sub.scheduledChanges, "scheduledChanges should still be present").toBeDefined();
      const scheduledPlanItem = sub.scheduledChanges!.items!.find((i: SubscriptionShortInfoItem) => i.itemType === "plan");
      expect(scheduledPlanItem!.itemPriceId, "scheduledChanges should still target the original yearly plan").toBe(yearlyPlan.id);
    });
  });

  describe("AUTOMATIC RENEW (Done & Dunning)", () => {})

  describe("STOP RENEW", () => {});

  describe("CANCEL/REFUND", () => {})
});