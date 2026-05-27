
describe.skip("COUPON", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeEach(async () => {
    await testHelper.cleanupAll();
    setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
  });

  it("Coupon pre-assigned to device applies discount on purchase", async () => {
    const device = setup.devices.dogStandard!;

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
      setMode: "apply",
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

    const purchaseResponse = await petlink.core.graphqlHttp.authIam.utilityIntegrationTest({
      input: {
        utilityType: UtilityTestTypeEnum.BuyNewSubscription,
        phone: setup.user!.phone,
        productId: device.id,
        priceIds: [chosenPlan.id],
        card: fxt.current.card.valid,
      },
    });

    expect(
      purchaseResponse.utilityIntegrationTest.code,
      `utilityIntegrationTest should succeed - Error: ${purchaseResponse.utilityIntegrationTest.message}`,
    ).toBe("200");

    // STEP 4: Wait for subscription to become active
    const subscriptionResult = await waitFor(async () => petlink.core.graphqlHttp.authJwt.getSubscriptionByProductId({ productId: device.id }), {
      isReady: (result) => {
        const sub = result.getSubscriptionByProductId.subscription;
        return sub?.status === SubscriptionStatusEnum.Active && sub?.paymentStatus === PaymentStatusTypeEnum.Succeeded;
      },
      timeoutError: `Timeout: Subscription not active with SUCCEEDED payment`,
    });

    const subscription = subscriptionResult.getSubscriptionByProductId.subscription!;

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
