import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testHelper, TestSetup } from "../../clients/client-test-helper.js";
import { fixtureCurrentBrand, isKippyRun } from "../../fixtures/fixtures.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { PetlinkGps } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { User } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { waitFor } from "../../helpers/helper-waitfor.js";
import { logger } from "../../config/logger.js";

describe("Utilyties fro developing features", () => {
  let setup: TestSetup = {} as TestSetup;

  beforeAll(async () => {
    // const builder = await testHelper.setupBuilder().withUser().withDog().withCat().withDogDevice().withCatDevice().build();
  });

  it("Test DATA MIGRATION", async () => {
    // /** Loro settano user in uno stato che forza la richiesta del cambio email/phone/password
    //  * - login con mail data da loro, settano
    //  * - flow cambio password ecc
    //  */
    // logger.info("=== START DATA MIGRATION TEST ===");
    //
    // // 1. Login with existing user
    // logger.debug("1️⃣ Logging in with user email...");
    // await petlink.loginWithPhone(fixtureCurrentBrand.user.phone, fixtureCurrentBrand.user.password);
    // logger.info("✓ Login successful");
    //
    // // 2. Get User data
    // logger.debug("2️⃣ Fetching user data...");
    // const userResponse = await petlink.core.graphql.authJwt.getUser();
    // logger.debug("User data", { user: userResponse.getUser.user });
    // logger.info("✓ User data fetched");
    //
    // // 3. Get all Pets
    // logger.debug("3️⃣ Fetching all pets...");
    // const petsResponse = await petlink.core.graphql.authJwt.getPets();
    // logger.info(`Found ${petsResponse.getPets.pets?.length || 0} pets`);
    // petsResponse.getPets.pets?.forEach((pet, i) => {
    //   logger.debug(`Pet ${i + 1}`, { name: pet.name, species: pet.species, id: pet.id, pet });
    // });
    // logger.info("✓ Pets data fetched");
    //
    // // 4. Get all Devices (one for each pet if petId is available)
    //
    // logger.info("=== DATA MIGRATION TEST COMPLETED ===");
  });
});
