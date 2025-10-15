import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fixtures } from "../../../fixtures/fixtures.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { CreatePetlinkGpsMutation, Pet, PetlinkGps, PetlinkGpsIn, User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { AppBrand } from "../../../clients/petlink-infrastructure/types.js";

describe("PetlinkGPS Registration", () => {
  let setup: TestSetup;
  // Tipizziamo correttamente i dispositivi
  let dogDevice: PetlinkGps;
  let catDevice: PetlinkGps;
  let evoDevice: PetlinkGps;

  beforeAll(async () => {
    const builder = testHelper.setupBuilder().withUser().withDog().withCat();

    if (fixtures.appBrand === AppBrand.KIPPY) {
      builder.withDogForEvo();
    }

    setup = await builder.build();
  });

  it("Associate PetlinkGPS to both DOG and CAT", async () => {
    const dogDevicePayload = {
      serialNumber: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
      countryCode: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.serialNumber,
      countryCode: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.timezone,
      petId: setup.pets.cat!.id,
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

    // Assert DOG device
    expect(dogResponse.createPetlinkGps.code).toBe("200");
    expect(dogResponse.createPetlinkGps.petlinkGps).toMatchObject({
      serialNumber: dogDevicePayload.serialNumber,
      petId: dogDevicePayload.petId,
      countryCode: dogDevicePayload.countryCode,
      timezone: dogDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(dogResponse.createPetlinkGps.petlinkGps?.id).toBeDefined();

    // Assert CAT device
    expect(catResponse.createPetlinkGps.code).toBe("200");
    expect(catResponse.createPetlinkGps.petlinkGps).toMatchObject({
      serialNumber: catDevicePayload.serialNumber,
      petId: catDevicePayload.petId,
      countryCode: catDevicePayload.countryCode,
      timezone: catDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(catResponse.createPetlinkGps.petlinkGps?.id).toBeDefined();

    // Salva i dispositivi per i test successivi
    dogDevice = dogResponse.createPetlinkGps.petlinkGps!;
    catDevice = catResponse.createPetlinkGps.petlinkGps!;
  });

  it.runIf(fixtures.appBrand == AppBrand.KIPPY)("Associate EVO device to DOG", async () => {
    const evoDevicePayload = {
      serialNumber: fixtures.devices.petlinkGps.KIPPY.EVO.serialNumber,
      countryCode: fixtures.devices.petlinkGps.KIPPY.EVO.countryCode,
      timezone: fixtures.devices.petlinkGps.KIPPY.EVO.timezone,
      petId: setup.pets.dogForEvo!.id,
    } as PetlinkGpsIn;

    const evoResponse = await petlink.core.graphql.authJwt.createPetlinkGps({
      petlinkGps: evoDevicePayload,
      appBrand: fixtures.appBrand,
    });

    // Assert EVO device
    expect(evoResponse.createPetlinkGps.code).toBe("200");
    expect(evoResponse.createPetlinkGps.petlinkGps).toMatchObject({
      serialNumber: evoDevicePayload.serialNumber,
      petId: evoDevicePayload.petId,
      countryCode: evoDevicePayload.countryCode,
      timezone: evoDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(evoResponse.createPetlinkGps.petlinkGps?.id).toBeDefined();

    // Salva per eventuali test successivi
    evoDevice = evoResponse.createPetlinkGps.petlinkGps!;
  });

  it("PetlinkGPS should not be available anymore", async () => {
    // Payload puliti per test duplicazione
    const dogDevicePayload = {
      serialNumber: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
      countryCode: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.serialNumber,
      countryCode: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.countryCode,
      timezone: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.timezone,
      petId: setup.pets.cat!.id,
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
    const getUpdatedResponse = await petlink.core.graphql.authJwt.getPetlinkGps({
      id: dogDevice.id,
    });
    expect(getUpdatedResponse.getPetlinkGps.code).toBe("200");
    expect(getUpdatedResponse.getPetlinkGps.petlinkGps?.timezone).toBe(newTimezone);
  });
});
