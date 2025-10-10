import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fixtures } from "../../../fixtures/fixtures.js";
import { testHelper } from "../../../clients/client-test-helper.js";
import {
  CreatePetlinkGpsMutation,
  Pet,
  PetlinkGps,
  PetlinkGpsIn,
  User,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe("PetlinkGPS Registration", () => {
  let testUser: User;
  let testPets: { dog: Pet; cat: Pet };
  // Tipizziamo correttamente i dispositivi
  let dogDevice: PetlinkGps;
  let catDevice: PetlinkGps;

  // Clean everything BEFORE this test file starts, then create user and pets
  beforeAll(async () => {
    testUser = await testHelper.createUser();
    testPets = (await testHelper.createPetsForUser()) as { dog: Pet; cat: Pet };
  });

  it("Associate Petlink GPS to both DOG and CAT", async () => {
    // Payload puliti e consistenti
    const dogDevicePayload = {
      serialNumber:
        fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
      countryCode:
        fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
      petId: testPets.dog.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber:
        fixtures.devices.petlinkGps[fixtures.appBrand].CAT.serialNumber,
      countryCode:
        fixtures.devices.petlinkGps[fixtures.appBrand].CAT.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.timezone,
      petId: testPets.cat.id,
    } as PetlinkGpsIn;

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: dogDevicePayload,
        appBrand: fixtures.appBrand,
      }),
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: catDevicePayload,
        appBrand: fixtures.appBrand,
      }),
    ]);

    // Assert per DOG
    expect(dogResponse.createPetlinkGps.code).toBe("200");
    expect(dogResponse.createPetlinkGps.petlinkGps?.serialNumber).toBe(
      dogDevicePayload.serialNumber,
    );
    expect(dogResponse.createPetlinkGps.petlinkGps?.petId).toBe(
      dogDevicePayload.petId,
    );
    expect(dogResponse.createPetlinkGps.petlinkGps?.countryCode).toBe(
      dogDevicePayload.countryCode,
    );
    expect(dogResponse.createPetlinkGps.petlinkGps?.timezone).toBe(
      dogDevicePayload.timezone,
    );
    expect(dogResponse.createPetlinkGps.petlinkGps?.userId).toBe(testUser.id);

    // Assert per CAT
    expect(catResponse.createPetlinkGps.code).toBe("200");
    expect(catResponse.createPetlinkGps.petlinkGps?.serialNumber).toBe(
      catDevicePayload.serialNumber,
    );
    expect(catResponse.createPetlinkGps.petlinkGps?.petId).toBe(
      catDevicePayload.petId,
    );
    expect(catResponse.createPetlinkGps.petlinkGps?.countryCode).toBe(
      catDevicePayload.countryCode,
    );
    expect(catResponse.createPetlinkGps.petlinkGps?.timezone).toBe(
      catDevicePayload.timezone,
    );
    expect(catResponse.createPetlinkGps.petlinkGps?.userId).toBe(testUser.id);

    // Salva i dispositivi per i test successivi
    dogDevice = dogResponse.createPetlinkGps.petlinkGps!;
    catDevice = catResponse.createPetlinkGps.petlinkGps!;
  });

  it("PetlinkGPS should not be available anymore", async () => {
    // Payload puliti per test duplicazione
    const dogDevicePayload = {
      serialNumber:
        fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
      countryCode:
        fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
      petId: testPets.dog.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber:
        fixtures.devices.petlinkGps[fixtures.appBrand].CAT.serialNumber,
      countryCode:
        fixtures.devices.petlinkGps[fixtures.appBrand].CAT.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.timezone,
      petId: testPets.cat.id,
    } as PetlinkGpsIn;

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: dogDevicePayload,
        appBrand: fixtures.appBrand,
      }),
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: catDevicePayload,
        appBrand: fixtures.appBrand,
      }),
    ]);

    expect(dogResponse.createPetlinkGps.code).not.toBe("200");
    expect(catResponse.createPetlinkGps.code).not.toBe("200");
  });

  it("Update PetlinkGps should work correctly", async () => {
    // STEP 1: UPDATE - Modifica solo timezone del DOG GPS
    const newTimezone = "America/New_York";
    const updateResponse = await petlink.core.graphql.authJwt.updatePetlinkGps({
      petlinkGps: {
        id: dogDevice.id,
        timezone: newTimezone,
      },
    });
    expect(updateResponse.updatePetlinkGps).toBeDefined();
    expect(updateResponse.updatePetlinkGps.code).toBe("200");

    // STEP 2: GET - Verifica che l'update sia persistito
    const getUpdatedResponse = await petlink.core.graphql.authJwt.getPetlinkGps(
      {
        id: dogDevice.id,
      },
    );
    expect(getUpdatedResponse.getPetlinkGps.code).toBe("200");
    expect(getUpdatedResponse.getPetlinkGps.petlinkGps?.timezone).toBe(
      newTimezone,
    );
  });
});
