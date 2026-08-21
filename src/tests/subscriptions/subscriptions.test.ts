import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  SubscriptionShortInfoItem,
  InvoiceStatusEnum,
  SubscriptionPlanEnum,
  SpeciesEnum,
  DeviceTypeEnum,
  User,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import {
  AddFreePeriod,
  CancelReasonCodeEnum,
  CouponSetMode,
  FilterEnum,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
import { waitFor } from "../../helpers/utils.js";

/**
 *
 * 1. Device registrato → petlinkGpsInventory.planProfileId → recupera PLAN_PROFILE
 *
 * 2. App chiama getSubscriptionPlans(productId)
 *    ├── legge planProfileId dall'inventario
 *    ├── se device ha già sub attiva → mostra upgradePlans
 *    └── se device non ha sub → mostra startingPlans
 *    → ritorna lista di piani (da Chargebee item prices) filtrati per quei planIds
 *
 * 3. User sceglie un piano → checkout
 *    ├── DEFAULT: hosted page Chargebee → sub su CB → webhook → SUBSCRIPTION + INVOICE su Mongo
 *    ├── TRIAL: hosted page Chargebee → sub in_trial su CB → webhook → SUBSCRIPTION su Mongo (no invoice finché trial non finisce)
 *    └── PAID_EXTERNALLY: handleInsuranceSubscription()
 *        ├── crea SUBSCRIPTION su Mongo (businessEntityId: DATAMARS, isInsurance: true)
 *        ├── crea INVOICE su Mongo (status: paid_externally, total: 0)
 *        └── NON chiama Chargebee → nessun webhook → nessuna sub su CB
 *
 *
 *
 *  ═══════════════════════════════════════════════════════════════════
 * MACROFLUSSI PAGAMENTO / SUBSCRIPTION
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. DEFAULT (checkout standard)
 *    User → app → checkoutNewSubscription → Chargebee hosted page
 *    → sub attiva, invoice al primo ciclo, rinnovi automatici
 *    → tutto su Chargebee, sync async su Mongo via webhook
 *
 * 2. TRIAL (trial period poi paga)
 *    User → app → checkoutNewSubscription → Chargebee (con trial_end)
 *    → sub in_trial, NO invoice finché trial non finisce
 *    → al trial end: primo pagamento → invoice → sub attiva
 *    → tutto su Chargebee, sync async su Mongo via webhook
 *
 * 3. PAID_EXTERNALLY / INSURANCE (terzo paga)
 *    CCT setPlanProfile → user registra device → auto-crea sub
 *    → sub solo Mongo (DATAMARS), invoice paid_externally total=0
 *    → NO Chargebee, NO webhook, NO pagamento
 *
 * 4. PREPAID (store esterno, prima compra poi registra)
 *    Store → POST /order (ghost user, serial PREPAID-*)
 *    User → checkoutPrepaid → Chargebee checkout (ghost user)
 *    → sub orfana su CB (userId=ghost, productId=null)
 *    Store → POST /order-tracking → serial reale, realign su CB
 *    User → createPetlinkGps → adoption: linka sub a user+device
 *    → sub su Chargebee (sempre), poi linkata a Mongo
 *    → se buyer ≠ registrant: clone su CB, vecchia sub fermata
 *
 * 5. NON_PAYING / FREE PERIOD (operatore CCT regala giorni)
 *    A) Device senza sub → crea sub Mongo only (DATAMARS, non_paying)
 *    B) Device con sub esistente → estende currentTermEnd
 *       ├── sub CB-managed → changeTermEnd su Chargebee
 *       └── sub DATAMARS → upsert DB diretto
 *
 * ═══════════════════════════════════════════════════════════════════
 * EVENTI POST-ACQUISTO (su sub esistenti)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 6. RINNOVO (automatico, ogni ciclo)
 *    Chargebee → payment_succeeded + subscription_renewed + invoice_generated
 *    → Core: nuova INVOICE, currentTerm shiftato, paymentStatus=SUCCEEDED
 *
 * 7. CHANGE PLAN (upgrade/downgrade)
 *    User → changeSubscriptionPlan → CB scheduled change (next term)
 *    → al term end: vecchia sub fermata, nuova attivata
 *
 * 8. STOP RINNOVO (disdetta a fine termine)
 *    User → stopRenewingSubscription
 *    → calculateFee: se <4 mesi pagati → applyCharges (ETF) + changeTermEnd
 *    → CB: cancelForItems(end_of_term)
 *    → alla scadenza: subscription_cancelled
 *
 * 9. REFUND (rimborso da CCT)
 *    CCT → refundInvoice → SM → CB credit note
 *    → CREDIT_NOTE su Mongo, sub marcata isRefunded
 *
 * 10. DUNNING (rinnovo fallito)
 *     Chargebee → payment_failed → retry automatici
 *     → se tutti falliscono → subscription_cancelled
 * ═══════════════════════════════════════════════════════════════════
 *
 */

//FIXME: on cct set "planProfileId" as a Enum and not as a string, then we can use that codegn generated enum
enum PLanProfile {
  //to reset to origin status
  DEFAULT = "DEFAULT",
  //TRIAL
  TRIAL_1_MONTH = "TRIAL_1_MONTH",
  ESSELUNGA = "ESSELUNGA",
  //PAID_EXTERNALLY
  AXA_12_YEARS = "AXA_12_YEARS", //trialDuration: 0,
  EuropAss = "EuropAss",
}

describe("DEFAULT (buy, change, renew, stop, refund)", () => {
  describe("SETUP & PREREQUISITES", () => {
    let setup: TestSetup = {} as TestSetup;

    beforeAll(async () => {
      await testHelper.cleanupAll();
      const builder = testHelper.setupBuilder().withUser().withDog({ gps: {} }).withCat({ gps: {} });
      if (fxt.isKippyRun) {
        builder.withDogForEvo({ gps: {} });
      }
      setup = await builder.build();
    });

    it("Each device type should has at least 1 sub plan available", async () => {
      const dogPlans = setup.dog!.devices.gps!.availablePlans!;
      const catPlans = setup.cat!.devices.gps!.availablePlans!;
      const evoPlans = setup.dogForEvo?.devices.gps?.availablePlans;

      expect(dogPlans, "Dog GPS should have subscription plans defined").toBeDefined();
      expect(Array.isArray(dogPlans), "Subscription plans should be returned as an array").toBe(true);
      expect(dogPlans.length, "Dog GPS should have at least one subscription plan available").toBeGreaterThan(0);

      expect(catPlans, "Cat GPS should have subscription plans defined").toBeDefined();
      expect(Array.isArray(catPlans), "Subscription plans should be returned as an array").toBe(true);
      expect(catPlans.length, "Cat GPS should have at least one subscription plan available").toBeGreaterThan(0);

      if (fxt.isKippyRun && evoPlans) {
        expect(evoPlans, "EVO GPS should have subscription plans defined").toBeDefined();
        expect(Array.isArray(evoPlans), "Subscription plans should be returned as an array").toBe(true);
        expect(evoPlans.length, "EVO GPS should have at least one subscription plan available").toBeGreaterThan(0);
      }
    });

    it("Should return the price adjusted to the user's billing currency", async () => {
      const gps = setup.dog!.devices.gps!;

      const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
        productId: gps.id,
        countryCode: gps.countryCode,
        serialNumber: gps.serialNumber,
      });
      const choosenPlanBeforeConversion = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

      const planResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlanPricing({
        planPriceId: choosenPlanBeforeConversion.id,
        countryCode: "CH",
        productId: gps.id,
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

  describe("BUY (sub, deviceProtection, petProtection)", async () => {
    let setup: TestSetup = {} as TestSetup;
    let availablePlansForThisDevice: any[] = [];
    let availablePetProtectionForThisPet: any[] = [];

    beforeEach(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).withCat({ gps: {} }).build();
      availablePlansForThisDevice = setup.dog!.devices.gps!.availablePlans!;
      availablePetProtectionForThisPet = setup.dog!.devices.gps!.availablePetProtectionPlans!;
    });

    afterAll(() => {
      petlink.core.graphqlWS.disconnect();
    });

    it("BUY sub and verify it becomes active", async () => {
      const choosenPlan = availablePlansForThisDevice![0].pricings[0]!;
      const deviceId = setup.dog!.devices.gps!.id;

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
        productId: setup.dog!.devices.gps!.id,
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

      const subscription = await testHelper.purchaseSubscription(setup.user!, setup.dog!.devices.gps!, [chosenPlan.id, chosenPlan.addon.id], {
        waitForActive: true,
      });

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
        testHelper.purchaseSubscription(setup.user!, setup.dog!.devices.gps!, [chosenPlan.id, chosenPetProtection.id], { waitForActive: true }),
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
        testHelper.purchaseSubscription(setup.user!, setup.dog!.devices.gps!, [chosenPlan.id, chosenPlan.addon.id, chosenPetProtection.id], {
          waitForActive: true,
        }),
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
      const activeSub = await testHelper.purchaseSubscription(setup.user!, setup.dog!.devices.gps!, [regularPlan.id], { waitForActive: true });

      // STEP 4: Purchase pet protection alone
      logger.info(`bought PET-PROTECTION for device ${setup.dog!.devices.gps!.id}, start to wait to become active`);
      const petProtectionPurchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BuyNewSubscription,
          phone: setup.user!.phone,
          productId: setup.dog!.devices.gps!.id,
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

  describe("CHANGE PLAN (upgrade/downgrade)", () => {
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
        const built = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();

        const gps = built.dog!.devices.gps!;

        // --- RILEVAZIONE PREPAID ORPHAN SUBSCRIPTION ---
        const hasPrepaidHint = (gps as any).subscriptionPlan === "prepaid";
        if (hasPrepaidHint) {
          logger.warn(`Stray subscription detected on ${gps.serialNumber} (attempt ${attempt}/${maxRetries}), retrying cleanup...`);
          continue;
        }

        const allPricings = gps.availablePlans!.flatMap((p: any) => p.pricings);
        const m = allPricings.find((pr: any) => pr.periodUnit === "month");
        const y = allPricings.find((pr: any) => pr.periodUnit === "year");
        expect(m, "A MONTHLY pricing must be available").toBeDefined();
        expect(y, "A YEARLY pricing must be available").toBeDefined();

        // --- ACQUISTA MONTHLY ---
        const sub = await testHelper.purchaseSubscription(built.user!, gps, [m.id], { waitForActive: true });
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

    it("Buy MONTHLY → Buy YEARLY -> should creates schedule change", async () => {
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
      const updated = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.dog!.devices.gps!.id }), {
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

    it("A second change while one is already scheduled should fail", async () => {
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
      await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: setup.dog!.devices.gps!.id }), {
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
        productId: setup.dog!.devices.gps!.id,
      });
      const sub = stillScheduled.getSubscriptions.subscriptions![0]!;
      expect(sub.scheduledChanges, "scheduledChanges should still be present").toBeDefined();
      const scheduledPlanItem = sub.scheduledChanges!.items!.find((i: SubscriptionShortInfoItem) => i.itemType === "plan");
      expect(scheduledPlanItem!.itemPriceId, "scheduledChanges should still target the original yearly plan").toBe(yearlyPlan.id);
    });
  });

  describe.todo("AUTOMATIC_RENEW", () => {
    //TODO: we'll complete this when we setup Chargebee TimeMachine (https://www.chargebee.com/docs/billing/2.0/site-configuration/time-machine)
    let setup: TestSetup = {} as TestSetup;

    beforeEach(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    });

    // buy & wait active -> Force renew by moving nextBillingDate to now ->poll until (?)-> assert
    it("Succeeded - should renew subscription and create a paid invoice", async () => {
      const gps = setup.dog!.devices.gps!;
      const plan = gps.availablePlans![0].pricings[0];

      // 1. Buy and wait active
      const subBefore = await testHelper.purchaseSubscription(setup.user!, gps, [plan.id], { waitForActive: true });
      const originalTermEnd = subBefore.currentTermEnd!;

      const originalInvoicesCount = subBefore.invoices.length;

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
      const renewedResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }), {
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
      const gps = setup.dog!.devices.gps!;
      const plan = gps.availablePlans![0].pricings[0];

      // 1. Buy with valid card
      const subBefore = await testHelper.purchaseSubscription(setup.user!, gps, [plan.id], { waitForActive: true });

      // 2. Swap to no-funds card (assuming utilityIntegrationTest supports this)
      const updateCardResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.UpdatePaymentMethod,
          userId: setup.user!.id,
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
      const dunningResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }), {
        isReady: (res) => {
          const sub = res.getSubscriptions.subscriptions?.[0];
          return !!sub?.dunningStatus || !!(sub?.dunningAttempts && sub.dunningAttempts.length > 0);
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

  describe("STOP RENEW", () => {
    let setup: TestSetup = {} as TestSetup;
    beforeEach(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    });

    it("stop renew -> status become non_renewing + nextBillingAt null, term end unchanged", async () => {
      const gps = setup.dog!.devices.gps!;
      const plan = gps.availablePlans![0].pricings[0];
      const sub = await testHelper.purchaseSubscription(setup.user!, gps, [plan.id], { waitForActive: true });

      const res = await petlink.core.graphqlHttp.authJwt.stopRenewingSubscription({
        subscriptionId: sub.id,
        appBrand: fxt.current.appBrand,
        cancelReason: "test",
        cancelReasonCode: CancelReasonCodeEnum.DoNotUse,
      });
      expect(res.stopRenewingSubscription?.code).toBe("200");

      const after = await waitFor(() => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }), {
        isReady: (r) => {
          const s = r.getSubscriptions.subscriptions?.[0];
          return s?.nextBillingAt == null;
        },
        timeoutError: "Timeout: subscription status din't become non_renewing",
      });
      const s = after.getSubscriptions.subscriptions![0]!;
      expect(s.nextBillingAt).toBeNull();
      expect(s.paymentStatus).toBe(PaymentStatusTypeEnum.Succeeded);
      expect(new Date(s.currentTermEnd!).getTime()).toBe(new Date(sub.currentTermEnd!).getTime());
    });
  });

  describe("CANCEL/REFUND", () => {
    let setup: TestSetup = {} as TestSetup;
    beforeEach(async () => {
      await testHelper.cleanupAll();
      setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    });

    it("refund plan item -> sub cancelled immediately, no penale", async () => {
      const gps = setup.dog!.devices.gps!;
      const plan = gps.availablePlans![0].pricings[0];
      const sub = await testHelper.purchaseSubscription(setup.user!, gps, [plan.id], { waitForActive: true });

      const invoice = sub.invoices![0];
      const planItem = invoice.items.find((i: { itemType: string }) => i.itemType === "plan_item_price")!;

      const refundRes = await petlink.cct.graphqlHttp.authJwt.refundInvoice({
        invoiceId: invoice.id, // id Mongo dell'invoice
        reason: "test refund",
        refunds: [{ chargebeeInvoiceItemId: planItem.chargebeeInvoiceItemId, amount: planItem.amount }],
      });
      expect(refundRes.refundInvoice?.code).toBe("200");

      const after = await waitFor(() => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }), {
        isReady: (r) => r.getSubscriptions.subscriptions?.[0]?.status === SubscriptionStatusEnum.Cancelled,
        timeoutError: "Timeout: sub did not become cancelled after refund",
      });
      expect(after.getSubscriptions.subscriptions![0]!.status).toBe(SubscriptionStatusEnum.Cancelled);
    });
  });
});

describe.runIf(fxt.isKippyRun)("TRIAL (Esselunga or Trial_1_month), different duration trial, different nextPlans available", () => {
  beforeEach(async () => {
    await testHelper.cleanupAll();
  });

  afterEach(async () => {
    await petlink.cct.graphqlHttp.authJwt.setPlanProfiles({
      serialNumbers: [fxt.current.gpsFixtures.DOG.serialNumber],
      planProfileId: PLanProfile.DEFAULT,
    });
  });

  it("Esselunga - 365d trial, choose updatePlan (only yearly plans), sub created, no invoices, nextBilling after trial end", async () => {
    await petlink.cct.graphqlHttp.authJwt.setPlanProfiles({
      serialNumbers: [fxt.current.gpsFixtures.DOG.serialNumber],
      planProfileId: PLanProfile.ESSELUNGA,
    });

    const setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    const gps = setup.dog!.devices.gps!;

    // 1. Dopo registration NON c'è sub
    const subsBefore = await petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id });
    expect(subsBefore.getSubscriptions.subscriptions).toHaveLength(0);

    // 2. Piani disponibili: SOLO yearly
    const plansRes = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      productId: gps.id,
      countryCode: gps.countryCode,
      serialNumber: gps.serialNumber,
    });
    const plans = plansRes.getSubscriptionPlans.plans ?? [];
    expect(plans.length).toBeGreaterThan(0);

    const yearlyOnly = plans.every((p) => p.pricings?.[0]?.periodUnit === "year");
    expect(yearlyOnly, "Esselunga should allow only yearly plans").toBe(true);

    const chosenPlan = plans[0]!.pricings[0]!;

    // 3. Bypass hosted page (simula checkout)
    await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BuyNewSubscription,
        phone: setup.user!.phone,
        productId: gps.id,
        priceIds: [chosenPlan.id],
        card: fxt.current.card.valid,
      },
    });

    // 4. Aspetta che Chargebee crei la sub in_trial
    const subsAfter = await waitFor(() => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }), {
      isReady: (data) => {
        const sub = data.getSubscriptions.subscriptions?.[0];
        return sub?.status === SubscriptionStatusEnum.InTrial && !!sub?.trialEnd;
      },
      timeoutError: "Subscription did not become in_trial after bypass",
    });

    const sub = subsAfter.getSubscriptions.subscriptions![0];
    expect(sub.status).toBe(SubscriptionStatusEnum.InTrial);

    // 5. Verifica durata trial ~365 giorni
    const trialEnd = new Date(sub.trialEnd!);
    const diffDays = Math.round((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(364);
    expect(diffDays).toBeLessThanOrEqual(366);

    // 6. Nessuna fattura = nessun pagamento immediato
    expect(sub.invoices).toBeNull();

    // 7. Il term corrente coincide con il periodo di trial
    expect(sub.trialStart).toBe(sub.currentTermStart);
    expect(sub.trialEnd).toBe(sub.currentTermEnd);

    // 8. Il primo pagamento è programmato alla fine della trial
    expect(sub.nextBillingAt!).toBeWithinHoursOf(sub.trialEnd!, 1);
  });

  it("Trial_1_month - 30d trial, choose updatePlan (any plans), sub created, no invoices, nextBilling after trial end", async () => {
    await petlink.cct.graphqlHttp.authJwt.setPlanProfiles({
      serialNumbers: [fxt.current.gpsFixtures.DOG.serialNumber],
      planProfileId: PLanProfile.TRIAL_1_MONTH,
    });

    const setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    const gps = setup.dog!.devices.gps!;

    // 1. Dopo registration NON c'è sub
    const subsBefore = await petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id });
    expect(subsBefore.getSubscriptions.subscriptions).toHaveLength(0);

    // 2. Piani disponibili: almeno monthly + yearly
    const plansRes = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      productId: gps.id,
      countryCode: gps.countryCode,
      serialNumber: gps.serialNumber,
    });
    const plans = plansRes.getSubscriptionPlans.plans ?? [];
    expect(plans.length).toBeGreaterThan(0);

    const hasMonthly = plans.some((p) => p.pricings?.[0]?.periodUnit === "month");
    const hasYearly = plans.some((p) => p.pricings?.[0]?.periodUnit === "year");
    expect(hasMonthly || hasYearly, "Trial_1_month should allow multiple plan types").toBe(true);

    // Prendiamo un piano mensile se disponibile, altrimenti yearly
    const targetPlan = (plans.find((p) => p.pricings?.[0]?.periodUnit === "month") ?? plans.find((p) => p.pricings?.[0]?.periodUnit === "year"))!;
    const chosenPlan = targetPlan.pricings[0]!;

    // 3. Bypass hosted page
    await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BuyNewSubscription,
        phone: setup.user!.phone,
        productId: gps.id,
        priceIds: [chosenPlan.id],
        card: fxt.current.card.valid,
      },
    });

    // 4. Aspetta sub in_trial
    const subsAfter = await waitFor(() => petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id }), {
      isReady: (data) => {
        const sub = data.getSubscriptions.subscriptions?.[0];
        return sub?.status === SubscriptionStatusEnum.InTrial && !!sub?.trialEnd;
      },
      timeoutError: "Subscription did not become in_trial after bypass",
    });

    const sub = subsAfter.getSubscriptions.subscriptions![0];
    expect(sub.status).toBe(SubscriptionStatusEnum.InTrial);

    // 5. Verifica durata trial ~30 giorni
    const trialEnd = new Date(sub.trialEnd!);
    const diffDays = Math.round((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);

    // 6. Nessuna fattura = nessun pagamento immediato
    expect(sub.invoices).toBeNull();

    // 7. Il term corrente coincide con il periodo di trial
    expect(sub.trialStart).toBe(sub.currentTermStart);
    expect(sub.trialEnd).toBe(sub.currentTermEnd);

    // 8. Il primo pagamento è programmato alla fine della trial
    expect(sub.nextBillingAt!).toBeWithinHoursOf(sub.trialEnd!, 1);
  });
});

describe.runIf(fxt.isKippyRun)("PAID_EXTERNALLY (Axa, Europass) -> should create subs only on our db", () => {
  beforeEach(async () => {
    await testHelper.cleanupAll();
  });

  afterEach(async () => {
    await petlink.cct.graphqlHttp.authJwt.setPlanProfiles({
      serialNumbers: [fxt.current.gpsFixtures.DOG.serialNumber],
      planProfileId: PLanProfile.DEFAULT,
    });
  });

  it("Axa", async () => {
    const serialNumber = fxt.current.gpsFixtures.DOG.serialNumber;

    await petlink.cct.graphqlHttp.authJwt.setPlanProfiles({
      serialNumbers: [serialNumber],
      planProfileId: PLanProfile.AXA_12_YEARS,
    });

    const setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    const gps = setup.dog!.devices.gps!;
    expect(gps.subscriptionPlan).toBe(SubscriptionPlanEnum.Insurance);

    const subsRes = await petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id });
    const subscriptions = subsRes.getSubscriptions.subscriptions!;
    expect(subscriptions, "Insurance subscription should be auto-created").toHaveLength(1);

    const sub = subscriptions[0];
    // expect(sub.status).toBe(SubscriptionStatusEnum.InTrial); FIXME: why InTrial and not PaidExternally
    expect(sub.invoices![0].status).toBe(InvoiceStatusEnum.PaidExternally);
    expect(sub.businessEntityId).toBe("DATAMARS");
    expect(sub.billingPeriod).toBe(12);
    expect(sub.billingPeriodUnit).toBe("years");
  });

  it("Europass", async () => {
    const serialNumber = fxt.current.gpsFixtures.DOG.serialNumber;

    await petlink.cct.graphqlHttp.authJwt.setPlanProfiles({
      serialNumbers: [serialNumber],
      planProfileId: PLanProfile.EuropAss,
    });

    const setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
    const gps = setup.dog!.devices.gps!;
    expect(gps.subscriptionPlan).toBe(SubscriptionPlanEnum.Insurance);

    const subsRes = await petlink.core.graphqlHttp.authJwt.getSubscriptions({ productId: gps.id });
    const subscriptions = subsRes.getSubscriptions.subscriptions!;
    expect(subscriptions, "Insurance subscription should be auto-created").toHaveLength(1);

    const sub = subscriptions[0];
    // expect(sub.status).toBe(SubscriptionStatusEnum.InTrial); FIXME: why InTrial and not PaidExternally
    expect(sub.invoices![0].status).toBe(InvoiceStatusEnum.PaidExternally);
    expect(sub.businessEntityId).toBe("DATAMARS");
    expect(sub.billingPeriod).toBe(54);
    expect(sub.billingPeriodUnit).toBe("weeks");
  });
});

describe("NOT_PAYING", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
  });

  it("Add Free period on device WITHOUT sub should create active non-paying sub", async () => {
    const gps = setup.dog!.devices.gps!;
    const freePeriod = AddFreePeriod.Add_30Days;
    const daysOfFreePeriod = 30;

    logger.info("Testing addFreePeriod on device without subscription", {
      serialNumber: gps.serialNumber,
      freePeriod,
    });

    const addFreePeriodResponse = await petlink.cct.graphqlHttp.authJwt.addFreePeriod({
      freePeriod,
      productId: gps.id,
      serialNumber: gps.serialNumber,
    });

    expect(addFreePeriodResponse.addFreePeriod.code, `addFreePeriod should succeed - Error: ${addFreePeriodResponse.addFreePeriod.message}`).toBe(
      "200",
    );

    const subscriptionResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: gps.id }), {
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
      deviceId: gps.id,
    });
    expect(cctSubscriptionsResponse.getSubscriptions.code).toBe("200");
    const cctSubscription = cctSubscriptionsResponse.getSubscriptions.items![0];
    expect(cctSubscription).toMatchObject({
      userId: setup.user!.id,
      productId: gps.id,
      serialNumber: gps.serialNumber,
      status: SubscriptionStatusEnum.InTrial,
      addedFreePeriod: daysOfFreePeriod,
      billingPeriod: daysOfFreePeriod,
      billingPeriodUnit: "days",
      businessEntityId: "DATAMARS",
    });
    expect({ start: cctSubscription.currentTermStart!, end: cctSubscription.currentTermEnd! }).toHaveDaysDurationOf(daysOfFreePeriod);
  });

  it("Add Free period on device WITH active sub should extend current subscription", async () => {
    const gps = setup.dog!.devices.gps!;
    const daysOfFreePeriod = 14;
    const freePeriod = AddFreePeriod.Add_14Days;

    const initialSubscription = await testHelper.purchaseSubscription(setup.user!, gps, [gps.availablePlans![0].pricings[0].id], {
      waitForActive: true,
    });
    const originalCurrentTermEnd = initialSubscription.currentTermEnd;

    const initialCctSubscriptionsResponse = await petlink.cct.graphqlHttp.authJwt.getSubscriptions({
      deviceId: gps.id,
    });
    const originalAddedFreePeriod = initialCctSubscriptionsResponse.getSubscriptions.items![0].addedFreePeriod || 0;

    const addFreePeriodResponse = await petlink.cct.graphqlHttp.authJwt.addFreePeriod({
      freePeriod,
      productId: gps.id,
      serialNumber: gps.serialNumber,
    });

    expect(addFreePeriodResponse.addFreePeriod.code, `addFreePeriod should succeed - Error: ${addFreePeriodResponse.addFreePeriod.message}`).toBe(
      "200",
    );

    const updatedSubResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: gps.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        const newCurrentTermEnd = sub?.currentTermEnd;
        return !!newCurrentTermEnd && new Date(newCurrentTermEnd).getTime() > new Date(originalCurrentTermEnd!).getTime();
      },
      timeoutError: `Timeout: currentTermEnd did not move forward after addFreePeriod`,
    });

    const updatedSubscription = updatedSubResult.getSubscriptionByProductId.subscription!;

    const updatedCctSubscriptionsResponse = await petlink.cct.graphqlHttp.authJwt.getSubscriptions({
      deviceId: gps.id,
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

describe("COUPON", () => {
  /*
  For test we use a precreate coupons TEST available forever, with 20% of discount from every prices
   */
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog({ gps: {} }).build();
  });

  it("Coupon pre-assigned to device applies discount on purchase", async () => {
    const gps = setup.dog!.devices.gps!;

    // STEP 1: Get available coupons
    const couponsResponse = await petlink.cct.graphqlHttp.authJwt.getCoupons();
    expect(couponsResponse.getCoupons.code, `getCoupons should succeed - Error: ${couponsResponse.getCoupons.message}`).toBe("200");

    const availableCoupons = couponsResponse.getCoupons.coupons;
    expect(availableCoupons, "Should have at least one coupon available").toBeDefined();
    expect(
      availableCoupons!.length,
      "Coupons array should not be empty (should have at least our coupon forever 20% for test suite)",
    ).toBeGreaterThan(0);

    const coupon = availableCoupons.find((coupon) => coupon.id === fxt.current.coupon.test20Percent.id)!;
    logger.info("Selected coupon for test", { couponId: coupon.id, couponName: coupon.name });

    // STEP 2: Assign coupon to device
    const setCouponResponse = await petlink.cct.graphqlHttp.authJwt.setCoupon({
      serialNumbers: [gps.serialNumber],
      couponId: coupon.id,
      setMode: CouponSetMode.Apply,
    });

    expect(setCouponResponse.setCoupon.code, `setCoupon should succeed - Error: ${setCouponResponse.setCoupon.message}`).toBe("200");

    logger.info("Coupon assigned to device", {
      serialNumber: gps.serialNumber,
      couponId: coupon.id,
      failureList: setCouponResponse.setCoupon.failureList,
    });

    // STEP 3: Buy subscription
    const plansResponse = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      productId: gps.id,
      countryCode: gps.countryCode,
      serialNumber: gps.serialNumber,
    });
    const chosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    // STEP 4: Purchase and wait for subscription to become active
    const subscription = await testHelper.purchaseSubscription(setup.user!, gps, [chosenPlan.id], { waitForActive: true });

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
    expect(discountItem.discountPercentage, "Discount percentage should be 20%").toBe(20);
    expect(discountItem.amount, "Discount amount should be positive").toBeGreaterThan(0);

    // Verify invoice math: total = plan amount - discount (±10 cents tolerance)
    const planItem = firstInvoice.items.find((i: { itemType: string }) => i.itemType === "plan_item_price")!;
    const expectedDiscount = planItem.amount * 0.2;
    expect(Math.abs(discountItem.amount - expectedDiscount), "Discount within 10 cents of 20%").toBeLessThanOrEqual(10);
    expect(firstInvoice.total, "Invoice total should equal plan amount minus discount").toBe(planItem.amount - discountItem.amount);
  });
});

describe("PREPAID (purchase on external store)", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().build();
  });

  type CreatedOrder = { orderId: string; orderItemId: string; kippyOrderId: number; kippyItemId: number; prepaidSerial: string; country: string };

  async function createPrepaidOrder(user: User, orderData: typeof fxt.current.prepaidOrder): Promise<CreatedOrder> {
    const externalOrderId = Date.now();

    const createRes = await petlink.core.rest.createOrder(orderData.restCountry, {
      order_source: orderData.orderSource,
      external_order_id: externalOrderId,
      external_order_name: `#PREPAID_TEST_${externalOrderId}`,
      status: "paid",
      customer: { first_name: user.name!, last_name: user.surname!, email: user.email!, phone_prefix: "+", phone: user.phone! },
      total: orderData.total,
      currency: orderData.currency,
      payment_method: orderData.paymentMethod,
      ip: orderData.ip,
      shipping_address: orderData.address,
      billing_address: orderData.address,
      line_items: [orderData.lineItem],
    });
    expect(createRes.status).toBe("ok");
    expect(createRes.line_items).toHaveLength(1);

    const orderId = createRes.subscription_url.match(/\/activate-order\/([^?]+)/)![1]; // UUID lives only in the redirect URL

    // Core created the order with a TEMPORARY serial (PREPAID-<itemId>), device not yet activated
    const orderCreated = (await petlink.core.graphqlHttp.authApiKey.getOrder({ orderId })).getOrder!.order!;
    expect(orderCreated.devices[0].serialNumber).toMatch(/^PREPAID-/);
    expect(orderCreated.devices[0].activated).toBe(false);
    expect(orderCreated.devices[0].appBrand).toBe(fxt.current.appBrand);

    return {
      orderId,
      orderItemId: orderCreated.devices[0].itemId, // OrderLineItem _id: what the BE utility resolves the serial from
      kippyOrderId: createRes.kippy_order_id,
      kippyItemId: createRes.line_items[0].kippy_item_id, // numeric kippyId: used only by order-tracking
      prepaidSerial: orderCreated.devices[0].serialNumber,
      country: orderCreated.country,
    };
  }

  async function trackPrepaidOrder(o: CreatedOrder, imei: string): Promise<void> {
    const trackRes = await petlink.core.rest.trackOrder(fxt.current.prepaidOrder.restCountry, {
      kippy_order_id: o.kippyOrderId,
      tracking_service: "DHL",
      tracking_code: `TRACK-${o.kippyOrderId}`,
      tracking_url: "https://dhl.com/track",
      line_items: [{ kippy_item_id: o.kippyItemId, imei }],
    });
    expect(trackRes.status).toBe("success");
  }

  async function buyPrepaidSubscription(orderId: string, orderItemId: string, priceIds: string[]): Promise<void> {
    const buyRes = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BuyNewSubscriptionPrepaid,
        orderId,
        orderItemId,
        priceIds,
        card: fxt.current.card.valid,
      },
    });

    expect(buyRes.utilityIntegrationTest.code).toBe("200");
  }

  async function getPrepaidSub(email: string, serialNumber: string) {
    const res = await petlink.cct.graphqlHttp.authJwt.getSubscriptionsPrepaid({ filter: { email, filterType: FilterEnum.And } });
    return res.getSubscriptionsPrepaid?.items?.find((i) => i.serialNumber === serialNumber);
  }

  type PrepaidSub = Awaited<ReturnType<typeof getPrepaidSub>>;
  async function waitForPrepaidSub(email: string, chargebeeSubscriptionId: string, isReady: (s: PrepaidSub) => boolean, timeoutError: string) {
    const sub = await waitFor(
      async () => {
        const res = await petlink.cct.graphqlHttp.authJwt.getSubscriptionsPrepaid({
          filter: { email, filterType: FilterEnum.And },
        });
        return res.getSubscriptionsPrepaid?.items?.find((i) => i.chargebeeSubscriptionId === chargebeeSubscriptionId);
      },
      { isReady, timeoutError },
    );
    return sub!;
  }

  async function resolvePriceIds(country: string, serialNumber: string): Promise<string[]> {
    const plans = await petlink.core.graphqlHttp.authJwt.getSubscriptionPlans({
      countryCode: country,
      serialNumber: serialNumber,
    });
    return [plans.getSubscriptionPlans.plans![0].pricings[0]!.id];
  }

  async function registerDevice() {
    const pet = await testHelper.createPet(SpeciesEnum.Dog);
    return testHelper.createGpsForPet(pet, DeviceTypeEnum.Dog);
  }

  async function assertOrderActivated(orderId: string, realSerial: string): Promise<void> {
    const order = (await petlink.core.graphqlHttp.authApiKey.getOrder({ orderId })).getOrder!.order!;
    expect(order.devices[0].serialNumber).toBe(realSerial);
    expect(order.devices[0].activated).toBe(true);
  }

  async function assertPrepaidSubscriptionLinked(
    user: User,
    device: { id: string; serialNumber: string },
    chargebeeSubscriptionId: string,
  ): Promise<void> {
    const linked = await waitForPrepaidSub(
      user.email!,
      chargebeeSubscriptionId,
      (s) =>
        s?.productId === device.id &&
        s?.userId === user.id &&
        s?.serialNumber === device.serialNumber &&
        s?.status === SubscriptionStatusEnum.Active &&
        s?.paymentStatus === PaymentStatusTypeEnum.Succeeded,
      `prepaid subscription ${chargebeeSubscriptionId} was not linked to device ${device.id}`,
    );

    expect(linked).toMatchObject({
      productId: device.id,
      userId: user.id,
      serialNumber: device.serialNumber,
      status: SubscriptionStatusEnum.Active,
      paymentStatus: PaymentStatusTypeEnum.Succeeded,
    });

    const subscriptionByProduct = await waitFor(() => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => result.getSubscriptionByProductId.subscription?.id === linked.id,
      timeoutError: `device ${device.id} does not reference prepaid subscription ${linked.id}`,
    });

    expect(subscriptionByProduct.getSubscriptionByProductId.subscription?.id).toBe(linked.id);
  }

  it("Flow A: order → tracking → buy → register → sub active", async () => {
    const gps = fxt.current.gpsFixtures.DOG; // the physical device we will "ship": real serial + imei
    const buyer = setup.user!;

    // STEP 1: external store creates the order (temporary PREPAID-<itemId> serial)
    const order = await createPrepaidOrder(buyer, fxt.current.prepaidOrder);

    // STEP 2: shipping tracking replaces the placeholder with the real inventory serial (matched by IMEI)
    await trackPrepaidOrder(order, gps.imei);
    const orderTracked = (await petlink.core.graphqlHttp.authApiKey.getOrder({ orderId: order.orderId })).getOrder!.order!;
    expect(orderTracked.devices[0].serialNumber).toBe(gps.serialNumber);
    expect(orderTracked.devices[0].activated).toBe(false);

    // STEP 3: buy. The BE reads the order item serial, already REAL after tracking
    const priceIds = await resolvePriceIds(orderTracked.country, gps.serialNumber);
    await buyPrepaidSubscription(order.orderId, order.orderItemId, priceIds);

    // capture the chargebeeSubscriptionId created by the webhook for robust polling
    const subAfterBuy = await waitFor(() => getPrepaidSub(buyer.email!, gps.serialNumber), {
      isReady: (s) => s?.status === SubscriptionStatusEnum.Active && s?.serialNumber === gps.serialNumber,
      timeoutError: `prepaid subscription not created after buy for order ${order.orderId}`,
    });
    const chargebeeSubscriptionId = subAfterBuy!.chargebeeSubscriptionId!;

    // STEP 4: register the device (act)
    const registered = await registerDevice();
    expect(registered.serialNumber).toBe(gps.serialNumber);

    // STEP 5: sub links and becomes active (assert)
    await assertPrepaidSubscriptionLinked(buyer, registered, chargebeeSubscriptionId);
    await assertOrderActivated(order.orderId, gps.serialNumber);
  });

  it("Flow B: order → buy → tracking → register → sub active", async () => {
    const gps = fxt.current.gpsFixtures.DOG;
    const buyer = setup.user!;

    // STEP 1: external store creates the order (temporary PREPAID-<itemId> serial)
    const order = await createPrepaidOrder(buyer, fxt.current.prepaidOrder);

    // STEP 2: buy BEFORE tracking → the BE reads the order item serial, still the PREPAID placeholder
    const priceIds = await resolvePriceIds(order.country, order.prepaidSerial);
    await buyPrepaidSubscription(order.orderId, order.orderItemId, priceIds);

    // The subscription_created webhook persists an orphan prepaid sub (productId null) with the PREPAID serial
    const orphan = await waitFor(() => getPrepaidSub(buyer.email!, order.prepaidSerial), {
      isReady: (s) => s?.status === SubscriptionStatusEnum.Active && s?.serialNumber === order.prepaidSerial,
      timeoutError: `prepaid orphan subscription not created for order ${order.orderId}`,
    });
    expect(orphan!.productId).toBeNull();
    expect(orphan!.serialNumber).toBe(order.prepaidSerial);
    const chargebeeSubscriptionId = orphan!.chargebeeSubscriptionId!;

    // STEP 3: shipping tracking now updates the order item AND triggers the Chargebee serial realignment
    await trackPrepaidOrder(order, gps.imei);

    // KEY ASSERTION: the subscription_changed webhook must realign the Mongo serial from PREPAID-<itemId> to the real one.
    // This is async (CB → SM queue → Core queue); registration must not happen before it completes or the link silently fails.
    // We poll by the stable chargebeeSubscriptionId to avoid the serial→ORDER_ITEM join ambiguity during the realignment window.
    await waitForPrepaidSub(
      buyer.email!,
      chargebeeSubscriptionId,
      (s) => s?.serialNumber === gps.serialNumber,
      `prepaid subscription serial not realigned to ${gps.serialNumber} for order ${order.orderId}`,
    );

    // STEP 4: register the device (act)
    const registered = await registerDevice();
    expect(registered.serialNumber).toBe(gps.serialNumber);

    // STEP 5: the (now real-serial) orphan sub links and becomes active (assert)
    await assertPrepaidSubscriptionLinked(buyer, registered, chargebeeSubscriptionId);
    await assertOrderActivated(order.orderId, gps.serialNumber);
  });

  it("Flow D: order → buy → register → tracking → sub active (PRTSUP-767 scenario)", async () => {
    const gps = fxt.current.gpsFixtures.DOG;
    const buyer = setup.user!;
    const order = await createPrepaidOrder(buyer, fxt.current.prepaidOrder);
    const priceIds = await resolvePriceIds(order.country, order.prepaidSerial);

    await buyPrepaidSubscription(order.orderId, order.orderItemId, priceIds);

    const orphan = await waitFor(() => getPrepaidSub(buyer.email!, order.prepaidSerial), {
      isReady: (s) => s?.status === SubscriptionStatusEnum.Active && s?.serialNumber === order.prepaidSerial && s?.productId == null,
      timeoutError: `prepaid orphan subscription not created for order ${order.orderId}`,
    });
    const chargebeeSubscriptionId = orphan!.chargebeeSubscriptionId!;

    const registered = await registerDevice();
    expect(registered.serialNumber).toBe(gps.serialNumber);

    const orphanAfterRegistration = await getPrepaidSub(buyer.email!, order.prepaidSerial);
    expect(orphanAfterRegistration).toMatchObject({
      chargebeeSubscriptionId,
      productId: null,
      serialNumber: order.prepaidSerial,
    });

    await trackPrepaidOrder(order, gps.imei);

    await assertPrepaidSubscriptionLinked(buyer, registered, chargebeeSubscriptionId);
    await assertOrderActivated(order.orderId, gps.serialNumber);
  });
});


