import { beforeAll, describe, expect, it } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { env } from "../../../config/env-schema-validation.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fixtureCurrentBrand, isKippyRun, appBrand } from "../../../fixtures/fixtures.js";
import { AppBrand, LanguageId, SubStatus, UtilityTestTypeEnum } from "../../../clients/petlink-infrastructure/types.js";
import { waitFor } from "../../../helpers/helper-waitfor.js";

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
    expect(chosenPlanAfterConvesion?.currencyCode, "Pricing currency should match billing info of user").toBe("CHF");
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
    console.log("Billing info updated:", {
      sentCity: user.city,
      returnedCity: updatedBillingInfo.getBillingInfo.billingInfo?.city,
    });

    expect(updatedBillingInfo.getBillingInfo.billingInfo, "Billing info should be defined after update").toBeDefined();
    expect(updatedBillingInfo.getBillingInfo.billingInfo?.city, "Billing city should match updated value").toBe(user.city);
  });

  it("Test BUY sub and verify it becomes active", async () => {
    const device = setup.devices.dogStandard!;
    const user = setup.user!;

    // Step 1: Verify no active subscription
    const beforePurchase = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: device.id,
    });
    expect(beforePurchase.getSubscriptionByProductId.code, "getSubscriptionByProductId endpoint should return not found - No subscription should exist before purchase").toBe("404");

    // Step 2: Get plan to purchase
    const plansResponse = await petlink.core.graphql.authJwt.getSubscriptionPlans({
      productId: device.id,
      countryCode: device.countryCode,
      serialNumber: device.serialNumber,
    });
    const choosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;

    console.log("Purchasing plan:", { planId: choosenPlan.id, price: choosenPlan.price, currency: choosenPlan.currencyCode });

    // Step 3: Purchase
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
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

    // Step 4: Wait for payment SUCCEDED feedback (wait from chargebee webhook)
    const afterPurchase = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
      },
      timeoutMs: 60000,
      intervalMs: 2000,
      timeoutError: `Timeout: Subscription status did not change to "${SubStatus.Active}" in time`,
    });

    expect(afterPurchase.getSubscriptionByProductId.subscription?.status, "Subscription status should be active after successful purchase").toBe("active");
    expect(afterPurchase.getSubscriptionByProductId.subscription?.paymentStatus, "Payment status should be SUCCEEDED after successful purchase").toBe("SUCCEEDED");
  });

  it.runIf(isKippyRun)("Test BUY sub + PET & DEVICE protection", () => {
    //TODO: (If KIPPY) Buy sub with addon DEVICE-PROTECTION
    if (fixtureCurrentBrand.user.languageId == LanguageId.IT) {
      //TODO: Buy sub with PET-PROTECTION
      //TODO: Buy PET-PROTECTION alone
    }
  });

  it("Test CHANGE (Upgrade/Downgrade) sub", () => {
    //TODO: Test CHANGE (Upgrade/Downgrade) sub
  });

  it("Test AUTMATIC RENEWAL active sub", () => {
    //TODO: Test AUTMATIC RENEWAL active sub
  });

  it("Test CANCEL active sub", async () => {
    const device = setup.devices.dogStandard!;

    // STEP 1: Get the active subscription (purchased in previous test)
    const subBeforeCancel = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: device.id,
    });

    expect(subBeforeCancel.getSubscriptionByProductId.code, "getSubscriptionByProductId endpoint should return success").toBe("200");
    expect(subBeforeCancel.getSubscriptionByProductId.subscription, "Active subscription should exist before cancellation").toBeDefined();
    expect(subBeforeCancel.getSubscriptionByProductId.subscription?.status, "Subscription should be active before cancellation").toBe("active");

    const subscriptionId = subBeforeCancel.getSubscriptionByProductId.subscription!.id;
    const currentTermEnd = subBeforeCancel.getSubscriptionByProductId.subscription!.currentTermEnd;

    console.log("Subscription to delete (BEFORE):", subBeforeCancel);

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
          productId: device.id,
        }),
      {
        isReady: (result) => {
          return result.getSubscriptionByProductId.subscription?.status == SubStatus.NonRenewing;
        },
        timeoutMs: 60000,
        intervalMs: 2000,
        timeoutError: `Timeout: Subscription status did not change to "${SubStatus.NonRenewing}" in time`,
      },
    );

    const subBefore = subBeforeCancel.getSubscriptionByProductId.subscription!;
    const subAfter = subAfterCancel.getSubscriptionByProductId.subscription!;

    expect(subAfter.status, `Subscription status should change from active to non_renewing`).toBe(SubStatus.NonRenewing);
    expect(subAfter.id, "Subscription ID should remain unchanged after cancel renewal").toBe(subBefore.id);
    expect(subAfter.currentTermEnd, "Subscription term end date should remain unchanged after cancel renewal").toBe(currentTermEnd);

    console.log("Subscription to delete (AFTER):", subAfterCancel);
  });
});
