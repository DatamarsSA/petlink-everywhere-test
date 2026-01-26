import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { PetlinkGps, PetlinkGpsIn, User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { logger } from "../../../config/logger.js";

describe("PetlinkGPS Registration", () => {
  let setup: TestSetup;
  // Tipizziamo correttamente i dispositivi
  let dogDevice: PetlinkGps;
  let catDevice: PetlinkGps;
  let evoDevice: PetlinkGps;

  beforeAll(async () => {
    const builder = testHelper.setupBuilder().withUser().withDog().withCat();

    if (fxt.isKippyRun) {
      builder.withDogForEvo();
    }

    setup = await builder.build();
  });

  it("Verify device is available before registration", async () => {
    logger.debug("→ Testing checkGps flow (emulates app behavior)");

    // STEP 1: Fetch checkGps for both devices in parallel
    const [dogCheckResponse, catCheckResponse] = await Promise.all([
      petlink.core.graphqlHttp.public.checkGps({
        serialNumber: fxt.current.devices.DOG.serialNumber,
      }),
      petlink.core.graphqlHttp.public.checkGps({
        serialNumber: fxt.current.devices.CAT.serialNumber,
      }),
    ]);

    // STEP 2: Verify DOG device sequentially
    expect(dogCheckResponse.checkGps.code, `checkGps should succeed for available device - Error: ${dogCheckResponse.checkGps.message}`).toBe("200");
    expect(dogCheckResponse.checkGps.imei, "Device should have imei").toBeDefined();
    expect(dogCheckResponse.checkGps.idccd, "Device should have idccd").toBeDefined();
    expect(dogCheckResponse.checkGps.firmwareVersion, "Device should have firmwareVersion").toBeDefined();

    // STEP 3: Verify CAT device sequentially
    expect(catCheckResponse.checkGps.code, `checkGps should succeed for available device - Error: ${catCheckResponse.checkGps.message}`).toBe("200");
    expect(catCheckResponse.checkGps.imei, "Device should have imei").toBeDefined();
    expect(catCheckResponse.checkGps.idccd, "Device should have idccd").toBeDefined();
    expect(catCheckResponse.checkGps.firmwareVersion, "Device should have firmwareVersion").toBeDefined();
  });

  it("Associate PetlinkGPS to both DOG and CAT", async () => {
    const dogDevicePayload = {
      serialNumber: fxt.current.devices.DOG.serialNumber,
      countryCode: fxt.current.devices.DOG.countryCode,
      timezone: fxt.current.devices.DOG.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber: fxt.current.devices.CAT.serialNumber,
      countryCode: fxt.current.devices.CAT.countryCode,
      timezone: fxt.current.devices.CAT.timezone,
      petId: setup.pets.cat!.id,
    } as PetlinkGpsIn;

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: dogDevicePayload,
        appBrand: fxt.current.appBrand,
      }),
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: catDevicePayload,
        appBrand: fxt.current.appBrand,
      }),
    ]);

    // Assert DOG device
    expect(
      dogResponse.createPetlinkGps.code,
      `createPetlinkGps should succeed for dog device - Error: ${dogResponse.createPetlinkGps.message}${dogResponse.createPetlinkGps.translationCode ? ` (${dogResponse.createPetlinkGps.translationCode})` : ""}`,
    ).toBe("200");
    expect(dogResponse.createPetlinkGps.petlinkGps, "Dog DEVICE payload should match input payload").toMatchObject({
      serialNumber: dogDevicePayload.serialNumber,
      petId: dogDevicePayload.petId,
      countryCode: dogDevicePayload.countryCode,
      timezone: dogDevicePayload.timezone,
      userId: setup.user!.id,
    });
    expect(dogResponse.createPetlinkGps.petlinkGps?.id, "Dog device ID auto-generated should be present").toBeDefined();

    // Assert CAT device
    expect(
      catResponse.createPetlinkGps.code,
      `createPetlinkGps should succeed for cat device - Error: ${catResponse.createPetlinkGps.message}${catResponse.createPetlinkGps.translationCode ? ` (${catResponse.createPetlinkGps.translationCode})` : ""}`,
    ).toBe("200");
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

  it.runIf(fxt.isKippyRun)("Associate EVO device to DOG", async () => {
    const evoDevicePayload = {
      serialNumber: fxt.KIPPY.devices.EVO.serialNumber,
      countryCode: fxt.KIPPY.devices.EVO.countryCode,
      timezone: fxt.KIPPY.devices.EVO.timezone,
      petId: setup.pets.dogForEvo!.id,
    } as PetlinkGpsIn;

    const evoResponse = await petlink.core.graphqlHttp.authJwt.createPetlinkGps({
      petlinkGps: evoDevicePayload,
      appBrand: fxt.current.appBrand,
    });

    // Assert EVO device
    expect(
      evoResponse.createPetlinkGps.code,
      `createPetlinkGps should succeed for EVO device - Error: ${evoResponse.createPetlinkGps.message}${evoResponse.createPetlinkGps.translationCode ? ` (${evoResponse.createPetlinkGps.translationCode})` : ""}`,
    ).toBe("200");
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
      serialNumber: fxt.current.devices.DOG.serialNumber,
      countryCode: fxt.current.devices.DOG.countryCode,
      timezone: fxt.current.devices.DOG.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;

    const catDevicePayload = {
      serialNumber: fxt.current.devices.CAT.serialNumber,
      countryCode: fxt.current.devices.CAT.countryCode,
      timezone: fxt.current.devices.CAT.timezone,
      petId: setup.pets.cat!.id,
    } as PetlinkGpsIn;

    const [dogResponse, catResponse] = await Promise.all([
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: dogDevicePayload,
        appBrand: fxt.current.appBrand,
      }),
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: catDevicePayload,
        appBrand: fxt.current.appBrand,
      }),
    ]);

    expect(
      dogResponse.createPetlinkGps.code,
      `createPetlinkGps should fail - dog device already registered - Error: ${dogResponse.createPetlinkGps.message}${dogResponse.createPetlinkGps.translationCode ? ` (${dogResponse.createPetlinkGps.translationCode})` : ""}`,
    ).not.toBe("200");
    expect(
      catResponse.createPetlinkGps.code,
      `createPetlinkGps should fail - cat device already registered - Error: ${catResponse.createPetlinkGps.message}${catResponse.createPetlinkGps.translationCode ? ` (${catResponse.createPetlinkGps.translationCode})` : ""}`,
    ).not.toBe("200");
  });

  it("Update PetlinkGps should work correctly", async () => {
    // STEP 1: UPDATE - Modifica solo timezone del DOG GPS
    const newTimezone = "America/New_York";
    const updateResponse = await petlink.core.graphqlHttp.authJwt.updatePetlinkGps({
      petlinkGps: {
        id: dogDevice.id,
        timezone: newTimezone,
      },
    });
    expect(updateResponse.updatePetlinkGps, "Update device response should be defined").toBeDefined();
    expect(
      updateResponse.updatePetlinkGps.code,
      `updatePetlinkGps should succeed - Error: ${updateResponse.updatePetlinkGps.message}${updateResponse.updatePetlinkGps.translationCode ? ` (${updateResponse.updatePetlinkGps.translationCode})` : ""}`,
    ).toBe("200");

    // STEP 2: GET - Verifica che l'update sia persistito
    const getUpdatedResponse = await petlink.core.graphqlHttp.authJwt.getPetlinkGps({
      id: dogDevice.id,
    });
    expect(
      getUpdatedResponse.getPetlinkGps.code,
      `getPetlinkGps should succeed - Error: ${getUpdatedResponse.getPetlinkGps.message}${getUpdatedResponse.getPetlinkGps.translationCode ? ` (${getUpdatedResponse.getPetlinkGps.translationCode})` : ""}`,
    ).toBe("200");
    expect(getUpdatedResponse.getPetlinkGps.petlinkGps?.timezone, "Device timezone should be updated and persisted").toBe(newTimezone);
  });
});
