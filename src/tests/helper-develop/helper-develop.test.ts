import { beforeAll, describe, it } from "vitest";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { fixtureCurrentBrand, isKippyRun } from "../../fixtures/fixtures.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("Utilyties fro developing features", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    const builder = await testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice().build();
  });

  it("Test DATA MIGRATION", async () => {
    /** Loro settano user in uno stato che forza la richiesta del cambio email/phone/password
     * - login con mail data da loro, settano
     * - flow cambio password ecc
     */
    console.log("=== START DATA MIGRATION TEST ===\n");

    // 1. Login with existing user
    console.log("1️⃣ Logging in with user email...");
    await petlink.loginWithPhone(fixtureCurrentBrand.user.phone, fixtureCurrentBrand.user.password);
    console.log("✅ Login successful\n");

    // 2. Get User data
    console.log("2️⃣ Fetching user data...");
    const userResponse = await petlink.core.graphql.authJwt.getUser();
    console.log("User:", JSON.stringify(userResponse.getUser.user, null, 2));
    console.log("✅ User data fetched\n");

    // 3. Get all Pets
    console.log("\n3️⃣ Fetching all pets...");
    const petsResponse = await petlink.core.graphql.authJwt.getPets();
    console.log(`Found ${petsResponse.getPets.pets?.length || 0} pets`);
    petsResponse.getPets.pets?.forEach((pet, i) => {
      console.log(`  Pet ${i + 1}: ${pet.name} (${pet.species}) - ID: ${pet.id} - ${JSON.stringify(pet, null, 2)}`);
    });
    console.log("✅ Pets data fetched\n");

    // 4. Get all Devices (one for each pet if petId is available)

    console.log("\n=== DATA MIGRATION TEST COMPLETED ===");
  });
});
