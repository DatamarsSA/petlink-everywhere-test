import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { fxt } from "../../fixtures/fixtures.js";

describe.skip("Utilities for debug test", () => {
  let setup: TestSetup = {} as TestSetup;


  it("debug", async () => {
    // await testHelper.cleanupAll();
    // console.log("Running with brand:", fxt.current.appBrand);
    // console.log("Pet to use:", fxt.current.pet);
    // console.log("Devices to use:", fxt.current.devices);

    // Add EVO device only for KIPPY brand
    if (fxt.isKippyRun) {

      let builder =  testHelper
        .setupBuilder()
        .withUser()
        .withDog()
        .withDogForEvo()
        .withCat()
        .withDogDevice()
        .withCatDevice()
        .withDogEvoDevice()
      setup = await builder.build();
    }

  });
});
