import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { fxt } from "../../fixtures/fixtures.js";

describe.skip("Utilities for debug test", () => {
  let setup: TestSetup = {} as TestSetup;


  // it("debug", async () => {
  //
  //   // Setup user
  //   setup = await testHelper.setupBuilder().withUser().build();
  //
  //   console.time("cleanupAll");
  //   await testHelper.cleanupAll();
  //   console.timeEnd("cleanupAll");
  //
  //   // Setup user again for the next cleanup
  //   setup = await testHelper.setupBuilder().withUser().build();
  //
  //   console.time("cleanUpUser");
  //   await testHelper.cleanUpUser();
  //   console.timeEnd("cleanUpUser");
  // });

  it("debug", async () => {
    let a = await testHelper.cleanUpUser("+15554839926");
    let b = await testHelper.cleanUpUser("+15554716645");
    let c = await testHelper.cleanUpUser("+15554874926");
    let d = await testHelper.cleanUpUser("+15558643068");
    //new hardcoded number
    let e = await testHelper.cleanUpUser("+15555234567");
    let f = ""
  });


});
