import { beforeAll, describe, expect, it } from "vitest";
import { testHelper } from "../clients/client-test-helper.js";

describe("Mix test", () => {
  beforeAll(async () => {});

  it("should delete user", async () => {
    await testHelper.cleanupAll();
  });

  it("sould create user with pet and device", async () => {
    let setup = await testHelper
      .setupBuilder()
      .withUser()
      .withDog()
      .withDogDevice()
      .withCat()
      .withCatDevice()
      .build();
    
    // Accesso ai dati creati:
    console.log("User:", setup.user?.email);
    console.log("Dog:", setup.pets.dog?.name);
    console.log("Dog Device:", setup.devices.dogStandard?.serialNumber);
    console.log("Cat:", setup.pets.cat?.name);
    console.log("Cat Device:", setup.devices.catStandard?.serialNumber);
  });
});
