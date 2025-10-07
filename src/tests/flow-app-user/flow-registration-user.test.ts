import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { waitFor } from "../../helpers/utils-retry.js";
import { fixtures } from "../../fixtures/fixtures.js";
import type {
  PetIn,
  PetlinkGpsIn,
  UserIn,
} from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe.sequential("User - Pet - PetlinkGPS registration flows", () => {
  const testUser = {
    phone: fixtures.user.phone,
    email: fixtures.user.email,
    password: fixtures.user.password,
    signUpPayload: {
      email: fixtures.user.email,
      name: fixtures.user.name,
      surname: fixtures.user.surname,
      city: fixtures.user.city,
      countryCode: fixtures.user.countryCode,
      zipCode: fixtures.user.zipCode,
      streetAddress: fixtures.user.streetAddress,
      phone: fixtures.user.phone,
      password: fixtures.user.password,
      confirmPassword: fixtures.user.confirmPassword,
      languageId: fixtures.user.languageId,
    } as UserIn,
  };

  beforeAll(async () => {});

  // Log performance report after all tests (top 10 slowest requests)
  afterAll(async () => {});

  /**
   * Oggetto condiviso tra tutti i describe blocks per salvare i dati creati durante i test.
   * Questo permette di accedere ai dati dell'utente, dei pet e dei device in tutti i test successivi.
   *
   * Struttura:
   * - flow-app-user: dati dell'utente creato (salvato in "User Registration")
   * - pet.dog: dati del cane creato (salvato in "Pet Registration")
   * - pet.cat: dati del gatto creato (salvato in "Pet Registration")
   * - device.dogGps: dati del GPS del cane (salvato in "PetlinkGPS registration")
   * - device.catGps: dati del GPS del gatto (salvato in "PetlinkGPS registration")
   */
  let setupResults = {
    user: null as any,
    pet: {
      dog: null as any,
      cat: null as any,
    },
    device: {
      dogGps: null as any,
      catGps: null as any,
    },
  };

  describe("User Registration", () => {
    // Variabili condivise tra i test
    let verificationId: string;
    let receivedOtp: string | null;
    let verificationLink: string | null;

    it("Verify phone number availability", async () => {
      const response = await petlink.core.graphql.public.checkContact({
        contact: testUser.phone,
        contactType: "PHONE",
      });

      expect(response.checkContact.code).toBe("200");
    });

    it("Send OTP to phone", async () => {
      const response = await petlink.core.graphql.public.sendOtp({
        phone: testUser.phone,
        languageId: testUser.signUpPayload.languageId,
      });

      expect(response.sendOtp.verificationId).toBeDefined();

      // Salva il verificationId per i test successivi
      verificationId = response.sendOtp.verificationId as string;
    });

    it("Wait to receive OTP via SMS", async () => {
      const otp = await waitFor(
        () => twilioClient.getLatestOtp(testUser.phone),
        {
          timeoutMs: 60000,
          intervalMs: 500,
          timeoutError: `OTP not received for ${testUser.phone}`,
        },
      );

      expect(otp).toMatch(/^\d{4,6}$/);
      receivedOtp = otp;
    }, 70000);

    it("Verify phone number (sending received OTP)", async () => {
      const response = await petlink.core.graphql.public.checkOtp({
        verificationId,
        otp: receivedOtp!,
        contact: testUser.phone,
      });

      expect(response.checkOtp.code).toBe("200");
    });

    it("Complete User registration", async () => {
      const response = await petlink.core.graphql.public.signUpUser({
        user: testUser.signUpPayload,
        otpData: {
          otp: receivedOtp!,
          verificationId,
        },
        languageId: testUser.signUpPayload.languageId,
        appBrand: fixtures.appBrand,
      });

      expect(response.signUpUser.code).toBe("200");
    });

    it("Try login new flow-app-user (with PHONE)", async () => {
      await petlink.loginWithPhone(testUser.phone, testUser.password);
      const userResponse = await petlink.core.graphql.authJwt.getUser();

      expect(userResponse.getUser.user?.phone).toBe(testUser.phone);
      expect(userResponse.getUser.user?.contactVerified?.phone).toBe(true);
      setupResults.user = userResponse.getUser.user;
    });

    it("Wait to receive CONFIRMATION EMAIL", async () => {
      const linkUrlToOpen = await waitFor(
        () => gmailClient.getVerificationLink(),
        {
          timeoutMs: 60000,
          intervalMs: 500,
          timeoutError: "Verification email not received",
        },
      );

      expect(linkUrlToOpen).toBeDefined();
      expect(linkUrlToOpen).toContain("uuid=");
      expect(linkUrlToOpen).toContain("otp=");
      expect(linkUrlToOpen).toContain("verificationId=");

      // Salva il link per i test successivi
      verificationLink = linkUrlToOpen;
    });

    it("Verify Email (clicking on received link)", async () => {
      const extractParamsFromUrl = (url: string) => {
        const urlObj = new URL(url);
        const uuid = urlObj.searchParams.get("uuid");
        const otp = urlObj.searchParams.get("otp");
        const verificationId = urlObj.searchParams.get("verificationId");
        return { uuid, otp, verificationId };
      };

      const params = extractParamsFromUrl(verificationLink!);

      const response = await petlink.core.graphql.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });
      expect(response.verifyEmail).toBeDefined();
      expect(response.verifyEmail!.code).toBe("200");
    });

    it("Try login new flow-app-user (with EMAIL)", async () => {
      await petlink.loginWithEmail(testUser.email, testUser.password);
      const user = await petlink.core.graphql.authJwt.getUser();

      expect(user.getUser.user).toBeDefined();
      expect(user.getUser.user?.email).toBe(testUser.email);
      expect(user.getUser.user?.phone).toBe(testUser.phone);
      expect(user.getUser.user?.contactVerified?.phone).toBe(true);
      expect(user.getUser.user?.contactVerified?.email).toBe(true);

      // Salva i dati dell'utente per i describe successivi
      setupResults.user = user.getUser.user;
    });

    it("Verify contacts (Phone & Email) are no longer available", async () => {
      const [phoneCheck, emailCheck] = await Promise.all([
        petlink.core.graphql.public.checkContact({
          contact: testUser.phone,
          contactType: "PHONE",
        }),
        petlink.core.graphql.public.checkContact({
          contact: testUser.email,
          contactType: "EMAIL",
        }),
      ]);

      expect(phoneCheck.checkContact.code).toBe("400");
      expect(emailCheck.checkContact.code).toBe("400");
    });
  });

  describe("Pet Registration", () => {
    const dogPayload = {
      name: fixtures.pet.defaultDog.name,
      species: fixtures.pet.defaultDog.species,
      breedType: fixtures.pet.defaultDog.breedType,
      breeds: fixtures.pet.defaultDog.breeds,
      gender: fixtures.pet.defaultDog.gender,
      weight: fixtures.pet.defaultDog.weight,
      birthDate: fixtures.pet.defaultDog.birthDate,
      livingEnvironment: fixtures.pet.defaultDog.livingEnvironment,
      primaryColor: fixtures.pet.defaultDog.primaryColor,
    } as PetIn;

    const catPayload = {
      name: fixtures.pet.defaultCat.name,
      species: fixtures.pet.defaultCat.species,
      breedType: fixtures.pet.defaultCat.breedType,
      breeds: fixtures.pet.defaultCat.breeds,
      gender: fixtures.pet.defaultCat.gender,
      weight: fixtures.pet.defaultCat.weight,
      birthDate: fixtures.pet.defaultCat.birthDate,
      livingEnvironment: fixtures.pet.defaultCat.livingEnvironment,
      primaryColor: fixtures.pet.defaultCat.primaryColor,
    } as PetIn;

    const assertPetCreation = (response: any, expectedPet: PetIn) => {
      expect(response.createPet.code).toBe("200");
      expect(response.createPet.pet?.name).toBe(expectedPet.name);
      expect(response.createPet.pet?.species).toBe(expectedPet.species);
      expect(response.createPet.pet?.breedType).toBe(expectedPet.breedType);
      expect(response.createPet.pet?.gender).toBe(expectedPet.gender);
      expect(response.createPet.pet?.weight).toBe(expectedPet.weight);
      expect(response.createPet.pet?.birthDate).toBe(expectedPet.birthDate);
      expect(response.createPet.pet?.livingEnvironment).toBe(
        expectedPet.livingEnvironment,
      );
      expect(response.createPet.pet?.primaryColor).toBe(
        expectedPet.primaryColor,
      );
      expect(response.createPet.pet?.id).toBeDefined();
    };

    beforeAll(async () => {
      // Guard: Ensure flow-app-user was created in previous tests
      if (!setupResults.user) {
        throw new Error(
          "setupResults.flow-app-user is null - User Registration tests may have failed",
        );
      }
      await petlink.loginWithPhone(testUser.phone, testUser.password);
    });

    it("Create DOG and CAT for the flow-app-user", async () => {
      const [dogResponse, catResponse] = await Promise.all([
        petlink.core.graphql.authJwt.createPet({ pet: dogPayload }),
        petlink.core.graphql.authJwt.createPet({ pet: catPayload }),
      ]);

      // Usa helper per ridurre duplicazione
      assertPetCreation(dogResponse, dogPayload);
      assertPetCreation(catResponse, catPayload);

      setupResults.pet.dog = dogResponse.createPet.pet;
      setupResults.pet.cat = catResponse.createPet.pet;
    });

    it("Try to create PETs with wrong combinations data", async () => {
      // Test validation rules:
      // 1. PUREBREED must have exactly 1 breed
      // 2. MIXED_BREED must have exactly 2 breeds (and both should be differente breeds)
      // 3. DOG species cannot use CAT breeds
      // 4. CAT species cannot use DOG breeds

      // Execute all invalid pet creation requests in parallel
      const [
        dogPurebreedWithTwoBreeds,
        dogMixedbreedWithOneBreed,
        dogMixedbreedWithwoEqualsBreed,
        catWithDogBreed,
        dogWithCatBreed,
      ] = await Promise.all([
        // Invalid: PUREBREED with 2 breeds (should have only 1)
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...dogPayload,
            breedType: "PUREBREED",
            breeds: [
              "5b0bfddb-532e-41cb-9705-b2ddc21226ef", // Labrador Retriever
              "0074b56e-8c84-43b6-aaad-d7c00a9aa37e", // Another dog breed
            ],
          },
        }),
        // Invalid: MIXED_BREED with 1 breed (should have 2)
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...dogPayload,
            breedType: "MIXED_BREED",
            breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Only 1 breed
          },
        }),
        // Invalid: MIXED_BREED with 2 equals breeds
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...dogPayload,
            breedType: "MIXED_BREED",
            breeds: [
              "5b0bfddb-532e-41cb-9705-b2ddc21226ef",
              "5b0bfddb-532e-41cb-9705-b2ddc21226ef",
            ],
          },
        }),
        // Invalid: CAT with DOG breed
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...catPayload,
            breedType: "PUREBREED",
            breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Labrador Retriever (DOG)
          },
        }),
        // Invalid: DOG with CAT breed
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...dogPayload,
            breedType: "PUREBREED",
            breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], // Siamese (CAT)
          },
        }),
      ]);
      // Assert all requests failed with validation error (400)
      expect(dogPurebreedWithTwoBreeds.createPet.code).toBe("400");
      expect(dogMixedbreedWithOneBreed.createPet.code).toBe("400");
      expect(dogMixedbreedWithwoEqualsBreed.createPet.code).toBe("400");
      expect(catWithDogBreed.createPet.code).toBe("400");
      expect(dogWithCatBreed.createPet.code).toBe("400");
    });

    it("Update and Delete PET should work correctly", async () => {
      // Create a temporary PET for CRUD testing (isolated from main DOG and CAT)
      const tempPetData = {
        ...dogPayload,
        name: "Temp Pet for CRUD Test",
      } as PetIn;

      const createResponse = await petlink.core.graphql.authJwt.createPet({
        pet: tempPetData,
      });

      expect(createResponse.createPet).toBeDefined();
      expect(createResponse.createPet.code).toBe("200");
      expect(createResponse.createPet.pet).toBeDefined();
      expect(createResponse.createPet.pet?.name).toBe(tempPetData.name);

      const petId = createResponse.createPet.pet?.id!;

      // TEST UPDATE: Modify the temporary PET
      const updatedName = "Updated Temp Pet";
      const updatedWeight = 25;

      const updateResponse = await petlink.core.graphql.authJwt.updatePet({
        pet: {
          id: petId,
          name: updatedName,
          weight: updatedWeight,
        },
      });

      expect(updateResponse.updatePet).toBeDefined();
      expect(updateResponse.updatePet.code).toBe("200");
      expect(updateResponse.updatePet.pet).toBeDefined();
      expect(updateResponse.updatePet.pet?.id).toBe(petId);
      expect(updateResponse.updatePet.pet?.name).toBe(updatedName);
      expect(updateResponse.updatePet.pet?.weight).toBe(updatedWeight);

      // TEST DELETE: Remove the temporary PET
      const deleteResponse = await petlink.core.graphql.authJwt.deletePet({
        petId,
      });

      expect(deleteResponse.deletePet).toBeDefined();
      expect(deleteResponse.deletePet.code).toBe("200");

      // Verify the PET no longer exists
      const petsAfterDelete = await petlink.core.graphql.authJwt.getPets();
      const deletedPet = petsAfterDelete.getPets.pets?.find(
        (p) => p.id === petId,
      );
      expect(deletedPet).toBeUndefined();
    });
  });

  describe("PetlinkGPS registration", () => {
    beforeAll(async () => {
      if (!setupResults.user) {
        throw new Error("User not created - previous tests failed");
      }
      if (!setupResults.pet.dog || !setupResults.pet.cat) {
        throw new Error("Pets not created - previous tests failed");
      }
      await petlink.loginWithPhone(testUser.phone, testUser.password);
    });

    it("Associate Petlink GPS to both DOG and CAT", async () => {
      // Payload puliti e consistenti
      const dogDevicePayload = {
        serialNumber:
          fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
        countryCode:
          fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
        timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
        petId: setupResults.pet.dog.id,
      } as PetlinkGpsIn;

      const catDevicePayload = {
        serialNumber:
          fixtures.devices.petlinkGps[fixtures.appBrand].CAT.serialNumber,
        countryCode:
          fixtures.devices.petlinkGps[fixtures.appBrand].CAT.countryCode,
        timezone: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.timezone,
        petId: setupResults.pet.cat.id,
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
      expect(dogResponse.createPetlinkGps.petlinkGps?.userId).toBe(
        setupResults.user.id,
      );

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
      expect(catResponse.createPetlinkGps.petlinkGps?.userId).toBe(
        setupResults.user.id,
      );

      setupResults.device.dogGps = dogResponse.createPetlinkGps.petlinkGps;
      setupResults.device.catGps = catResponse.createPetlinkGps.petlinkGps;
    });

    it("PetlinkGPS should not be available anymore", async () => {
      // Payload puliti per test duplicazione
      const dogDevicePayload = {
        serialNumber:
          fixtures.devices.petlinkGps[fixtures.appBrand].DOG.serialNumber,
        countryCode:
          fixtures.devices.petlinkGps[fixtures.appBrand].DOG.countryCode,
        timezone: fixtures.devices.petlinkGps[fixtures.appBrand].DOG.timezone,
        petId: setupResults.pet.dog.id,
      } as PetlinkGpsIn;

      const catDevicePayload = {
        serialNumber:
          fixtures.devices.petlinkGps[fixtures.appBrand].CAT.serialNumber,
        countryCode:
          fixtures.devices.petlinkGps[fixtures.appBrand].CAT.countryCode,
        timezone: fixtures.devices.petlinkGps[fixtures.appBrand].CAT.timezone,
        petId: setupResults.pet.cat.id,
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
      const updateResponse =
        await petlink.core.graphql.authJwt.updatePetlinkGps({
          petlinkGps: {
            id: setupResults.device.dogGps.id,
            timezone: newTimezone,
          },
        });
      expect(updateResponse.updatePetlinkGps).toBeDefined();
      expect(updateResponse.updatePetlinkGps.code).toBe("200");
      // expect(updateResponse.updatePetlinkGps.petlinkGps?.timezone).toBe(newTimezone);

      // STEP 2: GET - Verifica che l'update sia persistito
      const getUpdatedResponse =
        await petlink.core.graphql.authJwt.getPetlinkGps({
          id: setupResults.device.dogGps.id,
        });
      expect(getUpdatedResponse.getPetlinkGps.code).toBe("200");
      expect(getUpdatedResponse.getPetlinkGps.petlinkGps?.timezone).toBe(
        newTimezone,
      );
    });
  });
});
