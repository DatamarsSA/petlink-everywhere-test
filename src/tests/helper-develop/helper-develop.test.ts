import { beforeAll, describe, it } from "vitest";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { isKippyRun } from "../../fixtures/fixtures.js";

describe("Utilyties fro developing features", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    const builder = testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice();
    // Add EVO device only for KIPPY brand
    if (isKippyRun) {
      builder.withDogForEvo().withDogEvoDevice();
    }

    setup = await builder.build();
  });

  it("Tes user buy a subscription", () => {});
});
