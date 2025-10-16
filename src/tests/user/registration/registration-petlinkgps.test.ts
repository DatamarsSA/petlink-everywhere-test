import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fixtures, fixtureCurrentBrand, appBrand, isKippyRun } from "../../../fixtures/fixtures.js";
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

    if (isKippyRun) {
      builder.withDogForEvo();
    }

    setup = await builder.build();
  });

  it("Associate PetlinkGPS to both DOG and CAT", async () => {
    const dogDevicePayload = {
      serialNumber: fixtureCurrentBrand.devices.DOG.serialNumber,
      countryCode: fixtureCurrentBrand.devices.DOG.countryCode,
      timezone: fixtureCurrentBrand.devices.DOG.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber: fixtureCurrentBrand.devices.CAT.serialNumber,
      countryCode: fixtureCurrentBrand.devices.CAT.countryCode,
      timezone: fixtureCurrentBrand.devices.CAT.timezone,
      petId: setup.pets.cat!.id,
    } as PetlinkGpsIn;

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: dogDevicePayload,
        appBrand: appBrand,
      }),
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: catDevicePayload,
        appBrand: appBrand,
      }),
    ]);

    // Assert DOG device
    expect(dogResponse.createPetlinkGps.code).toBe("200");
    expect(dogResponse.createPetlinkGps.petlinkGps, "Dog DEVICE payload should match input payload").toMatchObject({
      serialNumber: dogDevicePayload.serialNumber,
      petId: dogDevicePayload.petId,
      countryCode: dogDevicePayload.countryCode,
      timezone: dogDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(dogResponse.createPetlinkGps.petlinkGps?.id, "Dog device ID auto-generated should be present").toBeDefined();

    // Assert CAT device
    expect(catResponse.createPetlinkGps.code).toBe("200");
    expect(catResponse.createPetlinkGps.petlinkGps, "Cat DEVICE payload should match input payload").toMatchObject({
      serialNumber: catDevicePayload.serialNumber,
      petId: catDevicePayload.petId,
      countryCode: catDevicePayload.countryCode,
      timezone: catDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(catResponse.createPetlinkGps.petlinkGps?.id, "Cat device ID auto-generated should be present").toBeDefined();

    // Salva i dispositivi per i test successivi
    dogDevice = dogResponse.createPetlinkGps.petlinkGps!;
    catDevice = catResponse.createPetlinkGps.petlinkGps!;
  });

  it.runIf(isKippyRun)("Associate EVO device to DOG", async () => {
    const evoDevicePayload = {
      serialNumber: fixtures.KIPPY.devices.EVO.serialNumber,
      countryCode: fixtures.KIPPY.devices.EVO.countryCode,
      timezone: fixtures.KIPPY.devices.EVO.timezone,
      petId: setup.pets.dogForEvo!.id,
    } as PetlinkGpsIn;

    const evoResponse = await petlink.core.graphql.authJwt.createPetlinkGps({
      petlinkGps: evoDevicePayload,
      appBrand: appBrand,
    });

    // Assert EVO device
    expect(evoResponse.createPetlinkGps.code).toBe("200");
    expect(evoResponse.createPetlinkGps.petlinkGps, "EVO device should match input payload").toMatchObject({
      serialNumber: evoDevicePayload.serialNumber,
      petId: evoDevicePayload.petId,
      countryCode: evoDevicePayload.countryCode,
      timezone: evoDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(evoResponse.createPetlinkGps.petlinkGps?.id, "EVO device ID auto-generated should be present").toBeDefined();

    // Salva per eventuali test successivi
    evoDevice = evoResponse.createPetlinkGps.petlinkGps!;
  });

  it("PetlinkGPS should not be available anymore", async () => {
    // Payload puliti per test duplicazione
    const dogDevicePayload = {
      serialNumber: fixtureCurrentBrand.devices.DOG.serialNumber,
      countryCode: fixtureCurrentBrand.devices.DOG.countryCode,
      timezone: fixtureCurrentBrand.devices.DOG.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber: fixtureCurrentBrand.devices.CAT.serialNumber,
      countryCode: fixtureCurrentBrand.devices.CAT.countryCode,
      timezone: fixtureCurrentBrand.devices.CAT.timezone,
      petId: setup.pets.cat!.id,
    } as PetlinkGpsIn;

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: dogDevicePayload,
        appBrand: appBrand,
      }),
      petlink.core.graphql.authJwt.createPetlinkGps({
        petlinkGps: catDevicePayload,
        appBrand: appBrand,
      }),
    ]);

    expect(dogResponse.createPetlinkGps.code, "Dog device should not be registered twice").not.toBe("200");
    expect(catResponse.createPetlinkGps.code, "Cat device should not be registered twice").not.toBe("200");
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
    expect(updateResponse.updatePetlinkGps, "Update device response should be defined").toBeDefined();
    expect(updateResponse.updatePetlinkGps.code).toBe("200");

    // STEP 2: GET - Verifica che l'update sia persistito
    const getUpdatedResponse = await petlink.core.graphql.authJwt.getPetlinkGps({
      id: dogDevice.id,
    });
    expect(getUpdatedResponse.getPetlinkGps.code).toBe("200");
    expect(getUpdatedResponse.getPetlinkGps.petlinkGps?.timezone, "Device timezone should be updated and persisted").toBe(newTimezone);
  });
});
