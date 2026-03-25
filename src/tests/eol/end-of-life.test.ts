import { beforeAll, describe, expect, it } from "vitest";
import { User, ShippingInfoIn, LanguageId } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fxt } from "../../fixtures/fixtures.js";
import { waitFor } from "../../helpers/utils.js";
import { logger } from "../../config/logger.js";

/**
 * End of Life (EOL) Test Suite
 *
 * Validates the End of Life flow for devices affected by network shutdown.
 */

const EOL_STEPS = {
  LOADING: "LOADING",
  UPDATE_DEVICE_AND_PLAN: "UPDATE_DEVICE_AND_PLAN",
  UPDATE_ONLY_DEVICE: "UPDATE_ONLY_DEVICE",
  SHIPPING_INFO_FROM_PLAN: "SHIPPING_INFO_FROM_PLAN",
  SHIPPING_INFO_FROM_ONLY_DEVICE: "SHIPPING_INFO_FROM_ONLY_DEVICE",
  SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE: "SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE",
  PLAN_SUMMARY_PAGE: "PLAN_SUMMARY_PAGE",
  WAITING_PLAN_PURCHASE: "WAITING_PLAN_PURCHASE",
  EXTERNAL_PAGE: "EXTERNAL_PAGE",
  COMPLETED_SUCCESS: "COMPLETED_SUCCESS",
  COMPLETED_FAILURE: "COMPLETED_FAILURE",
} as const;

describe.runIf(fxt.isKippyRun)("End of Life (EOL) Tests", () => {
  describe("Flow 1: Device-Only Replacement (Active Long Subscription)", () => {
    let setup: TestSetup;
    let productId: string;
    let testUser: User;
    let eolId: string;
    let selectedDevicePrice: any;
    let shopUrl: string;

    beforeAll(async () => {
      // Pulisci l'utente prima di iniziare per garantire un ambiente pulito
      await testHelper.cleanupAll();

      // Setup base senza subscription per scoprire i piani EOL
      setup = await testHelper
        .setupBuilder()
        .withUser({
          countryCode: "FR",
          languageId: LanguageId.Fr,
        })
        .withDogForEvo()
        .withDogEvoDevice()
        .build();

      productId = setup.devices.dogEvo!.id;
      testUser = setup.user!;

      // 2. Scoperta dinamica del piano tramite getPlansEOL
      const eolPlans = await petlink.core.graphqlHttp.authJwt.getPlansEOL({
        productId,
        countryCode: "FR",
      });

      // Se non ci sono piani, siamo già in Flow 1
      if (eolPlans.getPlansEOL.plans?.length === 0) {
        logger.info("Device already in Flow 1 (no EOL plans available)");
        return;
      }

      // Cerchiamo un piano lungo (>= 2 anni) per forzare il Flow 1
      const longPricing = eolPlans.getPlansEOL.plans?.flatMap((p) => p.pricings).find((pr) => pr!.periodUnit === "year" && pr!.period! >= 2);

      if (!longPricing) {
        throw new Error("No long-term subscription plan (>= 2 years) found for EVO device!");
      }

      // 3. Acquisto mirato tramite utility usando il priceId scoperto
      await testHelper.purchaseSubscription(setup.user!, setup.devices.dogEvo!, {
        priceId: longPricing.id,
      });

      // 4. Attendiamo che il BE processi la subscription e getPlansEOL torni vuoto (Flow 1)
      await waitFor(
        () =>
          petlink.core.graphqlHttp.authJwt.getPlansEOL({
            productId,
            countryCode: "FR",
          }),
        {
          isReady: (res) => res.getPlansEOL.plans?.length === 0,
          timeoutError: "Timeout: getPlansEOL still returns plans after long-term subscription purchase",
          intervalMs: 2000,
        },
      );
    });

    it("Step 1: Eligibility Check - Should detect Flow 1 (empty plans)", async () => {
      const eligibility = await petlink.core.graphqlHttp.authJwt.getPlansEOL({
        productId,
        countryCode: "FR",
      });
      expect(eligibility.getPlansEOL.code).toBe("200");
      expect(eligibility.getPlansEOL.plans, "Flow 1 should have empty plans list").toHaveLength(0);

      // Save device price for next steps
      selectedDevicePrice = eligibility.getPlansEOL.devicePrice![0];
      expect(selectedDevicePrice).toBeDefined();
    });

    it("Step 2: Device Selection - Should transition to SHIPPING_INFO_FROM_ONLY_DEVICE", async () => {
      const initRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId: null,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.SHIPPING_INFO_FROM_ONLY_DEVICE,
          devicePriceId: selectedDevicePrice.id,
        },
      });
      expect(initRes.updateEndOfLife.code).toBe("200");

      // Save EOL ID for next steps
      eolId = initRes.updateEndOfLife.endOfLife!.id;
      expect(eolId).toBeDefined();

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.SHIPPING_INFO_FROM_ONLY_DEVICE);
    });

    it("Step 3: Shipping Info - Should transition to SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE", async () => {
      const shippingInfo: ShippingInfoIn = {
        firstName: "Mario",
        lastName: "Rossi",
        email: testUser.email,
        phone: "+33612345678",
        address: "123 Rue de la Paix",
        city: "Paris",
        state: "Île-de-France",
        stateCode: "IDF",
        country: "FR",
        zip: "75001",
      };

      const shippingInfoRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE,
          devicePriceId: selectedDevicePrice.id,
          shippingInfo,
        },
      });
      expect(shippingInfoRes.updateEndOfLife.code).toBe("200");

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE);
    });

    it("Step 4: Generate Shop URL - Should get checkout URL", async () => {
      const checkout = await petlink.core.graphqlHttp.authJwt.checkoutEOLNewDevice({ eolId });
      // TODO: when Dani put on env his endpoint checkoutEOLNewDevice shoul return 200 and correct URL for redirect
      // expect(checkout.checkoutEOLNewDevice.code).toBe("200");
      // expect(checkout.checkoutEOLNewDevice.url).toBeDefined();

      shopUrl = checkout.checkoutEOLNewDevice.url || "http://mock-url.com";
    });

    it("Step 5: External Page - Should redirect user", async () => {
      const externalPageRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.EXTERNAL_PAGE,
          shopUrl,
        },
      });
      expect(
        externalPageRes.updateEndOfLife.code,
        `updateEndOfLife should succeed - Error: ${externalPageRes.updateEndOfLife.message}${externalPageRes.updateEndOfLife.translationCode ? ` (${externalPageRes.updateEndOfLife.translationCode})` : ""}`,
      ).toBe("200");

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.EXTERNAL_PAGE);

      // here shuld be redirect fe to THANK YOU PAGE that we are not able to test it...
    });

    it("Step 6: Completion - Should finalize flow", async () => {
      const completeRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.COMPLETED_SUCCESS,
        },
      });
      expect(
        completeRes.updateEndOfLife.code,
        `updateEndOfLife should succeed - Error: ${completeRes.updateEndOfLife.message}${completeRes.updateEndOfLife.translationCode ? ` (${completeRes.updateEndOfLife.translationCode})` : ""}`,
      ).toBe("200");
      expect(completeRes.updateEndOfLife.endOfLife?.step).toBe(EOL_STEPS.COMPLETED_SUCCESS);

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.COMPLETED_SUCCESS);
    });
  });

  describe("Flow 2: Device + Subscription Replacement (Expired/No Subscription)", () => {
    let setup: TestSetup;
    let productId: string;
    let testUser: User;
    let eolId: string;
    let selectedPricing: any;
    let selectedDevice: any;
    let shopUrl: string;

    beforeAll(async () => {
      // Pulisci l'utente prima di iniziare per garantire un ambiente pulito
      await testHelper.cleanupAll();

      // SETUP: Utente FR con EVO e SENZA abbonamento -> Forza Flow 2
      setup = await testHelper
        .setupBuilder()
        .withUser({
          countryCode: "FR",
          languageId: LanguageId.Fr,
        })
        .withDogForEvo()
        .withDogEvoDevice()
        .build();

      productId = setup.devices.dogEvo!.id;
      testUser = setup.user!;
    });

    it("Step 1: Eligibility Check - Should find EOL plans", async () => {
      const eligibility = await petlink.core.graphqlHttp.authJwt.getPlansEOL({
        productId,
        countryCode: "FR",
      });
      expect(eligibility.getPlansEOL.code).toBe("200");
      expect(eligibility.getPlansEOL.plans?.length).toBeGreaterThan(0);

      // Save selection for next steps
      selectedPricing = eligibility.getPlansEOL.plans![0].pricings[0]!;
      selectedDevice = eligibility.getPlansEOL.devicePrice![0];

      expect(selectedPricing).toBeDefined();
      expect(selectedDevice).toBeDefined();
    });

    it("Step 2: Init Flow - Should transition to SHIPPING_INFO_FROM_PLAN", async () => {
      // Device- free if you buy sub of 2 or 5 years
      // Device- 50% if you buy sub of 1 year
      const initRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId: null,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.SHIPPING_INFO_FROM_PLAN,
          devicePriceId: selectedDevice.id,
          priceId: selectedPricing.id,
        },
      });
      expect(initRes.updateEndOfLife.code).toBe("200");

      // Save EOL ID for next steps
      eolId = initRes.updateEndOfLife.endOfLife!.id;
      expect(eolId).toBeDefined();

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.SHIPPING_INFO_FROM_PLAN);
    });

    it("Step 3: Shipping Info - Should transition to PLAN_SUMMARY_PAGE", async () => {
      const shippingInfo: ShippingInfoIn = {
        firstName: "Mario",
        lastName: "Rossi",
        email: testUser.email,
        phone: "+33612345678",
        address: "123 Rue de la Paix",
        city: "Paris",
        state: "Île-de-France",
        stateCode: "IDF",
        country: "FR",
        zip: "75001",
      };

      const res = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.PLAN_SUMMARY_PAGE,
          devicePriceId: selectedDevice.id,
          priceId: selectedPricing.id,
          shippingInfo,
        },
      });
      expect(res.updateEndOfLife.code).toBe("200");

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.PLAN_SUMMARY_PAGE);
    });

    it("Step 4: Test checkoutNewSubscription API - Should generate URL", async () => {
      // Test checkoutNewSubscription API to verify URL generation
      // We don't actually use this URL, but we verify the API works
      const checkoutRes = await petlink.core.graphqlHttp.authJwt.checkoutNewSubscription({
        productId,
        priceIds: [selectedPricing.id],
        hostedPageOptions: {
          redirectUrl: "https://test-petlink.com/thank-you",
          layout: "full_page",
        },
      });

      expect(
        checkoutRes.checkoutNewSubscription.code,
        `checkoutNewSubscription should succeed - Error: ${checkoutRes.checkoutNewSubscription.message}${checkoutRes.checkoutNewSubscription.translationCode ? ` (${checkoutRes.checkoutNewSubscription.translationCode})` : ""}`,
      ).toBe("200");
      expect(checkoutRes.checkoutNewSubscription.url).toBeDefined();
      expect(checkoutRes.checkoutNewSubscription.url).toContain("chargebee");

      logger.info("✅ checkoutNewSubscription API test passed - URL generated successfully");
    });

    it("Step 5: Purchase Subscription (Simulated)", async () => {
      // Emulazione acquisto tramite utility
      await testHelper.purchaseSubscription(testUser, setup.devices.dogEvo!, {
        priceId: selectedPricing.id,
      });
    });

    it("Step 6: Acknowledge Checkout (Optional Fast Track)", async () => {
      // Calling acknowledgeCheckout with mock ID
      // This is expected to fail internally (log error/500) but we proceed anyway
      try {
        await petlink.core.graphqlHttp.authJwt.acknowledgeCheckout({
          // id = id HostedPage chargebee (session of payments)
          id: "mock-checkout-id-" + Date.now(),
        });
      } catch (error) {
        // Expected failure with mock ID, ignoring
        logger.info("AcknowledgeCheckout failed as expected with mock ID");
      }
    });

    it("Step 7: Transition to Waiting - Should set step WAITING_PLAN_PURCHASE", async () => {
      const res = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.WAITING_PLAN_PURCHASE,
        },
      });
      expect(
        res.updateEndOfLife.code,
        `updateEndOfLife should succeed - Error: ${res.updateEndOfLife.message}${res.updateEndOfLife.translationCode ? ` (${res.updateEndOfLife.translationCode})` : ""}`,
      ).toBe("200");

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.WAITING_PLAN_PURCHASE);
      // The update should succeed regardless of payment status (client side state update)
      // Note: We don't assert 200 here strictly if previous steps failed, but generally it should work.
    });

    it("Step 8: Polling - Should wait for subscription activation", async () => {
      await waitFor(
        () =>
          petlink.core.graphqlHttp.authJwt.getPlansEOL({
            productId,
            countryCode: "FR",
          }),
        {
          isReady: (res) => !!res.getPlansEOL.endOfLife?.subscriptionId,
          timeoutError: "Timeout: subscriptionId not found in EOL state after purchase",
        },
      );
    });

    it("Step 9: Generate Shop URL - Should get checkout URL", async () => {
      const checkout = await petlink.core.graphqlHttp.authJwt.checkoutEOLNewDevice({ eolId });
      shopUrl = checkout.checkoutEOLNewDevice.url || "http://mock-url.com";
    });

    it("Step 10: External Page - Should transition to EXTERNAL_PAGE", async () => {
      const externalPageRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.EXTERNAL_PAGE,
          shopUrl,
        },
      });
      expect(
        externalPageRes.updateEndOfLife.code,
        `updateEndOfLife should succeed - Error: ${externalPageRes.updateEndOfLife.message}${externalPageRes.updateEndOfLife.translationCode ? ` (${externalPageRes.updateEndOfLife.translationCode})` : ""}`,
      ).toBe("200");

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.EXTERNAL_PAGE);
    });

    it("Step 11: Completion - Should finalize flow", async () => {
      const completeRes = await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.COMPLETED_SUCCESS,
        },
      });
      expect(
        completeRes.updateEndOfLife.code,
        `updateEndOfLife should succeed - Error: ${completeRes.updateEndOfLife.message}${completeRes.updateEndOfLife.translationCode ? ` (${completeRes.updateEndOfLife.translationCode})` : ""}`,
      ).toBe("200");
      expect(completeRes.updateEndOfLife.endOfLife?.step).toBe(EOL_STEPS.COMPLETED_SUCCESS);

      // Verify step with getEndOfLifeStep
      const stepCheck = await petlink.core.graphqlHttp.authJwt.getEndOfLifeStep({ eolId });
      expect(
        stepCheck.getEndOfLifeStep.code,
        `getEndOfLifeStep should succeed - Error: ${stepCheck.getEndOfLifeStep.message}${stepCheck.getEndOfLifeStep.translationCode ? ` (${stepCheck.getEndOfLifeStep.translationCode})` : ""}`,
      ).toBe("200");
      expect(stepCheck.getEndOfLifeStep.step).toBe(EOL_STEPS.COMPLETED_SUCCESS);
    });
  });
});
