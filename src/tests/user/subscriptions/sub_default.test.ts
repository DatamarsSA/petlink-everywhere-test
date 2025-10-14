import { beforeAll, describe, it } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { env } from "../../../config/env-schema-validation.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { fixtures } from "../../../fixtures/fixtures.js";
import { UtilityTestTypeEnum } from "../../../clients/petlink-infrastructure/types.js";
import {
  BillingInfoInput,
  Scalars,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe("Payment of sub (through utilityIntegrationTest) should works", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    setup = await testHelper
      .setupBuilder()
      .withUser()
      .withDog()
      .withCat()
      .withDogDevice()
      .withCatDevice()
      .build();
    // await petlink.loginWithPhone(fixtures.user.phone, fixtures.user.password);
  });

  it("should work", async () => {
    // FLOW SUBS
    // getSubscriptionPlans
    // getBillingInfo
    // updateBillingInfo (se non ho billing info le aggiorno)
    // getSubscriptionPlanPricing
    // utility

    // Use dogStandard device (available for both KIPPY and PETLINK)
    const device = setup.devices.dogStandard!;
    let deviceId = device.id;
    let deviceCountryCode = device.countryCode;
    let deviceSerialNumber = device.serialNumber;

    const subscriptionsPlans =
      await petlink.core.graphql.authJwt.getSubscriptionPlans({
        productId: deviceId,
        countryCode: deviceCountryCode,
        serialNumber: deviceSerialNumber,
      });

    const choosenSubscriptionPlan =
      subscriptionsPlans.getSubscriptionPlans.plans![0].pricings[0]!;

    const billingInfo = await petlink.core.graphql.authJwt.updateBillingInfo({
      updateBillingInfoInput: {
        billingInfo: {
          address: setup.user!.streetAddress!,
          city: setup.user!.city!,
          country: setup.user!.countryCode!,
          state: "IT", // Optional field
          zip: setup.user!.zipCode!,
        },
        email: setup.user!.email!,
        firstName: setup.user!.name!,
        lastName: setup.user!.surname!,
        phone: setup.user!.phone!,
      },
    });

    console.log("billingInfo: ", JSON.stringify(billingInfo));

    const subscriptionPlanPricing =
      await petlink.core.graphql.authJwt.getSubscriptionPlanPricing({
        planPriceId: choosenSubscriptionPlan.id,
        countryCode: deviceCountryCode!,
        productId: deviceId,
      });

    const previousActiveSubsOfThisDevice =
      await petlink.core.graphql.authJwt.getSubscriptionByProductId({
        productId: deviceId,
      });
    console.log(
      "previousActiveSubsOfThisDevice PRIMA: ",
      JSON.stringify(previousActiveSubsOfThisDevice),
    );

    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
    console.log("setup.user!.phone: ", setup.user!.phone);
    console.log("deviceId: ", deviceId);
    console.log("choosenSubscriptionPlan.id: ", choosenSubscriptionPlan.id);

    const buySubscriptionResponse =
      await petlink.core.graphql.authIam.utilityIntegrationTest({
        input: {
          utilityType: UtilityTestTypeEnum.BUY_NEW_SUBSCRIPTION,
          phone: setup.user!.phone,
          productId: deviceId,
          priceIds: [choosenSubscriptionPlan.id],
          card: {
            cardNumber: fixtures.card.valid.cardNumber,
            expiryMonth: fixtures.card.valid.expiryMonth,
            expiryYear: fixtures.card.valid.expiryYear,
            cvv: fixtures.card.valid.cvv,
          },
        },
      });

    console.log(
      "buySubscriptionResponse: ",
      JSON.stringify(buySubscriptionResponse),
    );

    const updatedActiveSubsOfThisDevice =
      await petlink.core.graphql.authJwt.getSubscriptionByProductId({
        productId: deviceId,
      });
    //todo: should have => statsu: "active" && paymentStatus: "SUCCEDED"
    console.log(
      "updatedActiveSubsOfThisDevice DOPO: ",
      JSON.stringify(updatedActiveSubsOfThisDevice),
    );
  });
});
