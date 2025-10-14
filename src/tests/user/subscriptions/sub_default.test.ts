import { beforeAll, describe, expect, it } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { env } from "../../../config/env-schema-validation.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fixtures } from "../../../fixtures/fixtures.js";
import { AppBrand, UtilityTestTypeEnum } from "../../../clients/petlink-infrastructure/types.js";
import { waitFor } from "../../../helpers/helper-waitfor.js";
import exp from "node:constants";

describe("DEFAULT subsscriptions flow", () => {
  let setup: TestSetup = {} as TestSetup;

  // FLOW SUBS
  // getBillingInfo / updateBillingInfo (se non ho billing info le aggiorno) - OK
  // getSubscriptionPlans => getSubscriptionPlanPricing
  // utility
  // getSubscriptionByProductId() in polling per vedere se torna pyment succeded

  let device: any;
  let availableSubscriptionPlans: any;
  let choosenSubscriptionPlan: any;

  beforeAll(async () => {
    // 1. Setup base (user + device)
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
    device = setup.devices.dogStandard!;

    // 2. Fetch subscription plans (shared across tests)
    const plansResponse = await petlink.core.graphql.authJwt.getSubscriptionPlans({
      productId: device.id,
      countryCode: device.countryCode,
      serialNumber: device.serialNumber,
    });

    availableSubscriptionPlans = plansResponse.getSubscriptionPlans;
    choosenSubscriptionPlan = availableSubscriptionPlans.plans![0].pricings[0]!;
  });

  it("There should be at least 1 sub plan available for this device", async () => {
    expect(availableSubscriptionPlans).toBeDefined();
    expect(availableSubscriptionPlans.code).toBe("200");
    expect(availableSubscriptionPlans.plans?.length).toBeGreaterThan(0);
    expect(choosenSubscriptionPlan).toHaveProperty("id");
  });

  it("Choosen plan price should be adjusted to the user's currency", async () => {
    const pricingResponse = await petlink.core.graphql.authJwt.getSubscriptionPlanPricing({
      planPriceId: choosenSubscriptionPlan.id,
      countryCode: device.countryCode!,
      productId: device.id,
    });

    expect(pricingResponse.getSubscriptionPlanPricing.code).toBe("200");
    expect(pricingResponse.getSubscriptionPlanPricing.pricing).toBeDefined();
  });

  it("Retrieve and Update billing info should works", async () => {
    const user = setup.user!;

    const startingBillingInfo = await petlink.core.graphql.authJwt.getBillingInfo();

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

    const updatedBillingInfo = await petlink.core.graphql.authJwt.getBillingInfo();
    expect(updatedBillingInfo.getBillingInfo.billingInfo).toBeDefined();
  });

  it("Test BUY subscription and verify it becomes active", async () => {
    const user = setup.user!;

    // Verify no active subscription before
    const activePlanOfThisDevicePreviousPurchase = await petlink.core.graphql.authJwt.getSubscriptionByProductId({
      productId: device.id,
    });
    expect(activePlanOfThisDevicePreviousPurchase.getSubscriptionByProductId.code).toBe("404");

    // Purchase subscription
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
    const activePlanOfThisDeviceAfterPurchase = await petlink.core.graphql.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
        phone: user.phone,
        productId: device.id,
        priceIds: [choosenSubscriptionPlan.id],
        card: fixtures.card.valid,
      },
    });
    expect(activePlanOfThisDeviceAfterPurchase.utilityIntegrationTest.code).toBe("200");

    const result = await waitFor(async () => petlink.core.graphql.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        return sub?.status === "active" && sub?.paymentStatus === "SUCCEEDED";
      },
      timeoutMs: 30000,
      intervalMs: 2000,
    });

    expect(result.getSubscriptionByProductId.subscription?.status).toBe("active");
    expect(result.getSubscriptionByProductId.subscription?.paymentStatus).toBe("SUCCEEDED");
  });

  it("Test CHANGE (upgrade/downgrade) sub plan", () => {
    //todo: to implement
  });

  it("Test CANCEL sub plan");
});
