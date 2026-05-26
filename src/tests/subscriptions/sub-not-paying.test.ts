import { beforeEach, describe, expect, it } from "vitest";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { logger } from "../../config/logger.js";
import {
  PaymentStatusTypeEnum,
  SubscriptionStatusEnum,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../fixtures/fixtures.js";
import { waitFor } from "../../helpers/utils.js";
import { AddFreePeriod } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";

describe("NOT_PAYING", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
  });

  it("Add Free period on device WITHOUT sub should create active non-paying sub", async () => {
    const device = setup.devices.dogStandard!;
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
    const device = setup.devices.dogStandard!;
    const daysOfFreePeriod = 14;
    const freePeriod = AddFreePeriod.Add_14Days;

    await testHelper.purchaseSubscription(setup.user!, device);

    const initialSubResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        return sub?.status === SubscriptionStatusEnum.Active && sub?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
      },
      timeoutError: `Timeout: Subscription not active with SUCCEEDED payment`,
    });

    const initialSubscription = initialSubResult.getSubscriptionByProductId.subscription!;
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
