import { beforeAll, describe, expect, it } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { env } from "../../../config/env-schema-validation.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fixtures } from "../../../fixtures/fixtures.js";
import { AppBrand, UtilityTestTypeEnum } from "../../../clients/petlink-infrastructure/types.js";
import { waitFor } from "../../../helpers/helper-waitfor.js";

describe("DEFAULT subscription flow", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    // Base setup: common for all brands
    const builder = testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice();

    // Add EVO device only for KIPPY brand
    if (fixtures.isKippyRun) {
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
      ...(fixtures.isKippyRun && evoDevice
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

    console.log("Plans availability for each devices:", {
      DOG: dogPlans.getSubscriptionPlans,
      CAT: catPlans.getSubscriptionPlans,
      EVO: evoPlans.getSubscriptionPlans,
    });

    // Assert DOG device
    expect(dogPlans.getSubscriptionPlans.code).toBe("200");
    expect(dogPlans.getSubscriptionPlans.plans).toBeDefined();
    expect(Array.isArray(dogPlans.getSubscriptionPlans.plans)).toBe(true);
    expect(dogPlans.getSubscriptionPlans.plans?.length).toBeGreaterThan(0);

    // Assert CAT device
    expect(catPlans.getSubscriptionPlans.code).toBe("200");
    expect(catPlans.getSubscriptionPlans.plans).toBeDefined();
    expect(Array.isArray(catPlans.getSubscriptionPlans.plans)).toBe(true);
    expect(catPlans.getSubscriptionPlans.plans?.length).toBeGreaterThan(0);

    // Assert EVO device (only for KIPPY)
    if (fixtures.isKippyRun && evoPlans) {
      expect(evoPlans.getSubscriptionPlans.code).toBe("200");
      expect(evoPlans.getSubscriptionPlans.plans).toBeDefined();
      expect(Array.isArray(evoPlans.getSubscriptionPlans.plans)).toBe(true);
      expect(evoPlans.getSubscriptionPlans.plans?.length).toBeGreaterThan(0);
    }
  });

  it("Should return price adjusted to user's currency", async () => {
    const device = setup.devices.dogStandard!;

    const plansResponse = await petlink.core.graphql.authJwt.getSubscriptionPlans({
      productId: device.id,
      countryCode: device.countryCode,
      serialNumber: device.serialNumber,
    });

    const choosenPlan = plansResponse.getSubscriptionPlans.plans![0].pricings[0]!;
    console.log("Testing pricing for plan:", choosenPlan.id);

    // Fetch specific pricing
    const pricingResponse = await petlink.core.graphql.authJwt.getSubscriptionPlanPricing({
      planPriceId: choosenPlan.id,
      countryCode: device.countryCode!,
      productId: device.id,
    });

    // Debug log
    console.log("Pricing returned:", {
      planCurrency: choosenPlan.currencyCode,
      pricingCurrency: pricingResponse.getSubscriptionPlanPricing.pricing?.currencyCode,
    });

    expect(pricingResponse.getSubscriptionPlanPricing.code).toBe("200");
    expect(pricingResponse.getSubscriptionPlanPricing.pricing).toBeDefined();
    expect(pricingResponse.getSubscriptionPlanPricing.pricing?.currencyCode).toBe(choosenPlan.currencyCode);
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

    expect(updateResponse.updateBillingInfo.code).toBe("200");

    // Retrieve to verify
    const updatedBillingInfo = await petlink.core.graphql.authJwt.getBillingInfo();

    // Debug
    console.log("Billing info updated:", {
      sentCity: user.city,
      returnedCity: updatedBillingInfo.getBillingInfo.billingInfo?.city,
    });

    expect(updatedBillingInfo.getBillingInfo.billingInfo).toBeDefined();
    expect(updatedBillingInfo.getBillingInfo.billingInfo?.city).toBe(user.city);
  });

  it("Test BUY sub and verify it becomes active", async () => {
    const device = setup.devices.dogStandard!;
    const user = setup.user!;

    // Step 1: Verify no active subscription
    const beforePurchase = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: device.id,
    });
    expect(beforePurchase.getSubscriptionByProductId.code).toBe("404");

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
        card: fixtures.card.valid,
      },
    });

    expect(purchaseResponse.utilityIntegrationTest.code).toBe("200");

    // Step 4: Wait for activation with polling
    const afterPurchase = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
      },
      timeoutMs: 60000,
      intervalMs: 2000,
      timeoutError: `Timeout: Payment succeeded not return in time.`,
    });

    expect(afterPurchase.getSubscriptionByProductId.subscription?.status).toBe("active");
    expect(afterPurchase.getSubscriptionByProductId.subscription?.paymentStatus).toBe("SUCCEEDED");
  });

  it.runIf(fixtures.isKippyRun)("Test BUY sub + addon (PET & DEVICE protection)", () => {
    //TODO: (If KIPPY) Buy sub with addon PET-PROTECTION
    //TODO: (If KIPPY && user IT) Buy sub with addon DEVICE-PROTECTION
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

    expect(subBeforeCancel.getSubscriptionByProductId.code).toBe("200");
    expect(subBeforeCancel.getSubscriptionByProductId.subscription).toBeDefined();
    expect(subBeforeCancel.getSubscriptionByProductId.subscription?.status).toBe("active");

    const subscriptionId = subBeforeCancel.getSubscriptionByProductId.subscription!.id;
    const currentTermEnd = subBeforeCancel.getSubscriptionByProductId.subscription!.currentTermEnd;

    console.log("Subscription to delete (BEFORE):", subBeforeCancel);

    // STEP 2: Cancel the subscription (stop auto-renewal)
    const cancelResponse = await petlink.core.graphql.authJwt.stopRenewingSubscription({
      subscriptionId,
      appBrand: fixtures.appBrand,
      cancelReason: "Testing cancellation flow for integration tests",
      cancelReasonCode: "OTHER",
    });

    expect(cancelResponse.stopRenewingSubscription?.code).toBe("200");

    // STEP 3: Verify subscription is now "non_renewing" but still active until term end
    const subAfterCancel = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: device.id,
    });
    console.log("Subscription to delete (AFTER):", subAfterCancel);

    expect(subAfterCancel.getSubscriptionByProductId.code).toBe("200");
    //TODO: how to check if is real deleted automatic renewal?
  });
});
