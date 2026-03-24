import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { testHelper, TestSetup } from "../../../clients/client-test-helper.js";
import { PetlinkGps, PetlinkGpsIn, ProductTypeEnum } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import {
  CustomerMood,
  OrderEnum,
  TicketAction,
  TicketActionReason,
  TicketIssue,
  TicketStatus,
} from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.js";
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

  it.runIf(fxt.isKippyRun)("Should not allow to register old devices", async () => {
    const vitaDevicePayload = {
      serialNumber: fxt.KIPPY.devices.VITA.serialNumber,
      countryCode: fxt.KIPPY.devices.VITA.countryCode,
      timezone: fxt.KIPPY.devices.VITA.timezone,
      petId: setup.pets.dog!.id,
    } as PetlinkGpsIn;
    const finderDevicePayload = {
      serialNumber: fxt.KIPPY.devices.FINDER.serialNumber,
      countryCode: fxt.KIPPY.devices.FINDER.countryCode,
      timezone: fxt.KIPPY.devices.FINDER.timezone,
      petId: setup.pets.cat!.id,
    } as PetlinkGpsIn;
    const evo6DevicePayload = {
      serialNumber: fxt.KIPPY.devices.EVO6.serialNumber,
      countryCode: fxt.KIPPY.devices.EVO6.countryCode,
      timezone: fxt.KIPPY.devices.EVO6.timezone,
      petId: setup.pets.cat!.id,
    } as PetlinkGpsIn;

    const [vitaResponse, finderResponse, evo6Response] = await Promise.all([
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: vitaDevicePayload,
        appBrand: fxt.current.appBrand,
      }),
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: finderDevicePayload,
        appBrand: fxt.current.appBrand,
      }),
      petlink.core.graphqlHttp.authJwt.createPetlinkGps({
        petlinkGps: evo6DevicePayload,
        appBrand: fxt.current.appBrand,
      }),
    ]);

    // Assert VITA device
    expect(
      vitaResponse.createPetlinkGps.code,
      `createPetlinkGps should not succeed for VITA device - Error: ${vitaResponse.createPetlinkGps.message}${vitaResponse.createPetlinkGps.translationCode ? ` (${vitaResponse.createPetlinkGps.translationCode})` : ""}`,
    ).not.toBe("200");

    // Assert FINDER device
    expect(
      finderResponse.createPetlinkGps.code,
      `createPetlinkGps should not succeed for FINDER device - Error: ${finderResponse.createPetlinkGps.message}${finderResponse.createPetlinkGps.translationCode ? ` (${finderResponse.createPetlinkGps.translationCode})` : ""}`,
    ).not.toBe("200");

    // Assert EVO6 device
    expect(
      evo6Response.createPetlinkGps.code,
      `createPetlinkGps should not succeed for EVO6 device - Error: ${evo6Response.createPetlinkGps.message}${evo6Response.createPetlinkGps.translationCode ? ` (${evo6Response.createPetlinkGps.translationCode})` : ""}`,
    ).not.toBe("200");
    //FIXME: should not registre evo6 device, now it allow it, say to fix at BE
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

describe("PetlinkGPS Reset", () => {
  beforeEach(async () => {
    await testHelper.cleanupAll();
  });

  it("should NOT allow reset when device has active subscription", async () => {
    let setup = await testHelper
      .setupBuilder()
      .withUser()
      .withDog()
      .withDogDevice()
      .withSubscription({ waitForActivation: true }) // <-- crea subscription attiva
      .build();
    const device = setup.devices.dogStandard!;

    logger.info("Testing reset with active subscription...");
    // Chiama reset su CCT (che poi chiama Core)
    const resetResponse = await petlink.cct.graphqlHttp.authJwt.resetPetlinkGps({
      id: device.id,
    });
    // Verifica che il reset sia BLOCCATO
    expect(resetResponse.resetPetlinkGps.code).toBe("422");
    expect(resetResponse.resetPetlinkGps.message).toBeDefined();
    // Verifica che il dispositivo esista ancora (by getPetlinkGps from app)
    const deviceCheck = await petlink.core.graphqlHttp.authJwt.getPetlinkGps({
      id: device.id,
    });
    expect(deviceCheck.getPetlinkGps.code).toBe("200");
    expect(deviceCheck.getPetlinkGps.petlinkGps?.id).toBe(device.id);
    logger.info("✓ Reset correctly blocked with active subscription");
  });

  it("should allow reset when device has NO active subscription", async () => {
    let setup = await testHelper
      .setupBuilder()
      .withUser()
      .withDog()
      .withDogDevice()
      // NOTA: NON chiamare .withSubscription()
      .build();
    const device = setup.devices.dogStandard!;

    logger.info("Testing reset without active subscription...");
    // Call reset on CCT
    const resetResponse = await petlink.cct.graphqlHttp.authJwt.resetPetlinkGps({
      id: device.id,
    });
    expect(resetResponse.resetPetlinkGps.code, "Reset should succeed, and device should not be found").toBe("200");
    // Verify (by getDevice from cct) device results no more binded to any user/pet
    const deviceDetailResponse = await petlink.cct.graphqlHttp.authJwt.getDevice({
      serialId: device.serialNumber,
    });
    expect(deviceDetailResponse.getDevice.code).toBe("200");
    expect(deviceDetailResponse.getDevice.device?.deviceId).toBeNull();
    expect(deviceDetailResponse.getDevice.device?.customerId).toBeNull();
    expect(deviceDetailResponse.getDevice.device?.petId).toBeNull();
    expect(deviceDetailResponse.getDevice.device?.registrationDate).toBeNull();
    logger.info("✓ Reset completed successfully without subscription");
  });
});

describe("PetlinkGps Replacement", async () => {
  beforeEach(async () => {
    await testHelper.cleanupAll();
  });

  it("flow user buy another device and replace old", async () => {
    // SETUP: Creiamo utente + pet + device esistente (vecchio device)
    const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
    const oldDevice = setup.devices.dogStandard!;
    const user = setup.user!;
    const pet = setup.pets.dog!;

    logger.info("→ STEP 1: Verifica che non ci siano replacement history iniziali");
    const initialHistory = await petlink.cct.graphqlHttp.authJwt.getReplacementPetlinkGpsHistory({
      productId: oldDevice.id,
    });
    expect(initialHistory.getReplacementPetlinkGpsHistory.code).toBe("200");
    expect(initialHistory.getReplacementPetlinkGpsHistory.items!.length).toBe(0);

    logger.info("→ STEP 2: Simuliamo che l'utente ha comprato un nuovo device esternamente");
    // Il nuovo device serial number deve essere un device disponibile nell'inventario
    const newSerialNumber = fxt.current.devices.CAT.serialNumber; // Usiamo un device diverso come "nuovo"

    logger.info("→ STEP 3: Chiamata alla mutation replacement come farebbe l'app");
    const replacementResponse = await petlink.core.graphqlHttp.authJwt.replacement({
      productId: oldDevice.id,
      newSerialNumber: newSerialNumber,
      entityType: ProductTypeEnum.PetlinkGps,
    });

    expect(replacementResponse.replacement.code, `Replacement should succeed - Error: ${replacementResponse.replacement.message}`).toBe("200");

    logger.info("→ STEP 4: Verifica che il replacement sia stato tracciato correttamente");
    const finalHistory = await petlink.cct.graphqlHttp.authJwt.getReplacementPetlinkGpsHistory({
      productId: oldDevice.id,
    });
    expect(finalHistory.getReplacementPetlinkGpsHistory.code).toBe("200");
    expect(finalHistory.getReplacementPetlinkGpsHistory.items!.length).toBe(1);

    const replacementRecord = finalHistory.getReplacementPetlinkGpsHistory.items![0];
    expect(replacementRecord.oldSerialNumber).toBe(oldDevice.serialNumber);
    expect(replacementRecord.newSerialNumber).toBe(newSerialNumber);
    expect(replacementRecord.productId).toBe(oldDevice.id);
    expect(replacementRecord.petId).toBe(pet.id);
    expect(replacementRecord.userId).toBe(user.id);

    logger.info("→ STEP 5: Verifica che il device sia stato aggiornato nel sistema");
    const updatedDeviceResponse = await petlink.core.graphqlHttp.authJwt.getPetlinkGps({
      id: oldDevice.id,
    });

    expect(updatedDeviceResponse.getPetlinkGps.code).toBe("200");
    expect(updatedDeviceResponse.getPetlinkGps.petlinkGps?.serialNumber).toBe(newSerialNumber);

    logger.info("✓ GPS replacement test completed successfully");
  });

  it("flow user open ticket cct to replacement", async () => {
    const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
    const user = setup.user!;
    const pet = setup.pets.dog!;
    const oldDevice = setup.devices.dogStandard!;

    logger.info("→ STEP 1: History must be empty before opening ticket");
    const initialHistory = await petlink.cct.graphqlHttp.authJwt.getReplacementPetlinkGpsHistory({
      productId: oldDevice.id,
    });
    expect(initialHistory.getReplacementPetlinkGpsHistory.code).toBe("200");
    expect(initialHistory.getReplacementPetlinkGpsHistory.items!.length).toBe(0);

    logger.info("→ STEP 2: CCT operator opens replacement ticket");
    const createIssueResponse = await petlink.cct.graphqlHttp.authJwt.createIssue({
      issue: {
        customerId: user.id,
        deviceId: oldDevice.id,
        zendeskId: `ZD-${Date.now()}`,
        customerIssues: [TicketIssue.BatteryNotCharge],
        tickets: [
          {
            suspectedIssues: [TicketIssue.BatteryNotCharge],
            customerMood: CustomerMood.Collaborative,
            action: TicketAction.Replacement,
            actionReason: [TicketActionReason.BatteryCharging],
            inspectionRequired: false,
            negativeReview: false,
            status: TicketStatus.Open,
          },
        ],
      },
    });
    expect(createIssueResponse.createIssue.code).toBe("200");
    expect(createIssueResponse.createIssue.issue?.tickets?.length).toBe(1);

    logger.info("→ STEP 3: History should contain pending replacement without newSerialNumber");
    const pendingHistory = await petlink.cct.graphqlHttp.authJwt.getReplacementPetlinkGpsHistory({
      productId: oldDevice.id,
    });
    expect(pendingHistory.getReplacementPetlinkGpsHistory.code).toBe("200");
    expect(pendingHistory.getReplacementPetlinkGpsHistory.items!.length).toBe(1);
    const pendingRecord = pendingHistory.getReplacementPetlinkGpsHistory.items![0];
    expect(pendingRecord.oldSerialNumber).toBe(oldDevice.serialNumber);
    expect(pendingRecord.newSerialNumber).toBeNull();
    expect(pendingRecord.petId).toBe(pet.id);
    expect(pendingRecord.productId).toBe(oldDevice.id);

    logger.info("→ STEP 4: CCT should expose the opened issue via getIssues");
    const issuesResponse = await petlink.cct.graphqlHttp.authJwt.getIssues({
      deviceId: oldDevice.id,
      pagination: { pageNumber: 0, pageSize: 10 },
      order: { field: "creationDate", order: OrderEnum.Desc },
    });
    expect(issuesResponse.getIssues.code).toBe("200");
    expect(issuesResponse.getIssues.items?.length || 0).toBeGreaterThanOrEqual(1);
    const createdIssue = issuesResponse.getIssues.items?.find((issue) => issue?.id === createIssueResponse.createIssue.issue?.id);
    expect(createdIssue).toBeDefined();

    logger.info("→ STEP 5: User receives new device and performs replacement from the app");
    const newSerialNumber = fxt.current.devices.CAT.serialNumber;
    // TODO: add coverage for prepaid devices replacement guard once implemented (if i try to replace old device that has a prepaid shoudl fail)
    const replacementResponse = await petlink.core.graphqlHttp.authJwt.replacement({
      productId: oldDevice.id,
      newSerialNumber,
      entityType: ProductTypeEnum.PetlinkGps,
    });
    expect(replacementResponse.replacement.code).toBe("200");

    logger.info("→ STEP 6: History should now contain newSerialNumber");
    const finalHistory = await petlink.cct.graphqlHttp.authJwt.getReplacementPetlinkGpsHistory({
      productId: oldDevice.id,
    });
    expect(finalHistory.getReplacementPetlinkGpsHistory.code).toBe("200");
    expect(finalHistory.getReplacementPetlinkGpsHistory.items?.length || 0).toBe(1);
    const replacementRecord = finalHistory.getReplacementPetlinkGpsHistory.items![0];
    expect(replacementRecord.oldSerialNumber).toBe(oldDevice.serialNumber);
    expect(replacementRecord.newSerialNumber).toBe(newSerialNumber);
    expect(replacementRecord.userId).toBe(user.id);

    logger.info("→ STEP 7: Device should be updated with the new serial number");
    const updatedDeviceResponse = await petlink.core.graphqlHttp.authJwt.getPetlinkGps({
      id: oldDevice.id,
    });
    expect(updatedDeviceResponse.getPetlinkGps.code).toBe("200");
    expect(updatedDeviceResponse.getPetlinkGps.petlinkGps?.serialNumber).toBe(newSerialNumber);
  });
});
