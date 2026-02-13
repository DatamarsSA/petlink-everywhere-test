import { beforeAll, describe, expect, it } from "vitest";
import { User, ShippingInfoIn, LanguageId } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { waitFor } from "../../../helpers/utils.js";
import { logger } from "../../../config/logger.js";

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

      const productId = setup.devices.dogEvo!.id;

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

    it("should complete the device-only replacement flow end-to-end", async () => {
      const productId = setup.devices.dogEvo!.id;
      const testUser = setup.user!;

      // 1. Eligibility Check -> Deve essere Flow 1 (piani vuoti)
      const eligibility = await petlink.core.graphqlHttp.authJwt.getPlansEOL({
        productId,
        countryCode: "FR",
      });
      expect(eligibility.getPlansEOL.code).toBe("200");
      expect(eligibility.getPlansEOL.plans, "Flow 1 should have empty plans list").toHaveLength(0);

      const selectedDevicePrice = eligibility.getPlansEOL.devicePrice![0];

      // 2. Device Selection -> Step: SHIPPING_INFO_FROM_ONLY_DEVICE
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
      const eolId = initRes.updateEndOfLife.endOfLife!.id;

      // 3. Shipping Info -> Step: SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE
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
      await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
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

      // 4. Generate Shop URL
      const checkout = await petlink.core.graphqlHttp.authJwt.checkoutEOLNewDevice({ eolId });
      // Non falliamo se il BE torna 500 per lo shop URL (sistema esterno instabile)
      const shopUrl = checkout.checkoutEOLNewDevice.url || "http://mock-url.com";

      // 5. Final State -> Step: EXTERNAL_PAGE
      await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
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

      // 6. Complete flow
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
      expect(completeRes.updateEndOfLife.endOfLife?.step).toBe(EOL_STEPS.COMPLETED_SUCCESS);
    });
  });

  describe("Flow 2: Device + Subscription Replacement (Expired/No Subscription)", () => {
    let setup: TestSetup;

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
    });

    it("should complete the device + subscription replacement flow end-to-end", async () => {
      const productId = setup.devices.dogEvo!.id;
      const testUser = setup.user!;

      // 1. Eligibility Check -> Deve essere Flow 2 (piani presenti)
      const eligibility = await petlink.core.graphqlHttp.authJwt.getPlansEOL({
        productId,
        countryCode: "FR",
      });

      expect(eligibility.getPlansEOL.code).toBe("200");
      expect(eligibility.getPlansEOL.plans?.length).toBeGreaterThan(0);

      const selectedPricing = eligibility.getPlansEOL.plans![0].pricings[0]!;
      const selectedDevice = eligibility.getPlansEOL.devicePrice![0];

      // 2. Plan Selection -> Step: SHIPPING_INFO_FROM_PLAN
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
      const eolId = initRes.updateEndOfLife.endOfLife!.id;

      // 3. Shipping Info -> Step: PLAN_SUMMARY_PAGE
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
      await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
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

      // 4. Emulazione acquisto tramite utility
      await testHelper.purchaseSubscription(testUser, setup.devices.dogEvo!, {
        priceId: selectedPricing.id,
      });

      // 5. Acknowledge Checkout
      await petlink.core.graphqlHttp.authJwt.acknowledgeCheckout({
        id: "mock-checkout-id-" + Date.now(),
      });

      // 6. Transition -> Step: WAITING_PLAN_PURCHASE
      await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.WAITING_PLAN_PURCHASE,
        },
      });

      // 7. Polling per subscriptionId
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

      // 8. Generate Shop URL
      const checkout = await petlink.core.graphqlHttp.authJwt.checkoutEOLNewDevice({ eolId });

      // 9. Final State -> Step: EXTERNAL_PAGE
      await petlink.core.graphqlHttp.authJwt.updateEndOfLife({
        eolId,
        deviceId: productId,
        input: {
          productId,
          userId: testUser.id,
          serialNumber: setup.devices.dogEvo!.serialNumber,
          step: EOL_STEPS.EXTERNAL_PAGE,
          shopUrl: checkout.checkoutEOLNewDevice.url || "http://mock-url.com",
        },
      });

      // 10. Complete flow
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
      expect(completeRes.updateEndOfLife.endOfLife?.step).toBe(EOL_STEPS.COMPLETED_SUCCESS);
    });
  });
});
