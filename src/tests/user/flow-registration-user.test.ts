import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { globalState } from "../../test-utils/global-state/state-global-flow.js";
import { waitFor } from "../../test-utils/helpers/utils-retry.js";
import { fixtures } from "../../test-utils/fixtures/fixtures.js";
import type { PetIn } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe.sequential("Environment Setup", () => {
  // Enable performance tracking for this test suite
  beforeAll(() => {
    petlink.enablePerformanceTracking();
  });

  // Print performance report after all tests
  afterAll(() => {
    petlink.printPerformanceReport();
  });
  const userData = fixtures.user;
  const userPhoneNumber = userData.phone;
  const userEmail = userData.email;
  const userPassword = userData.password;

  let setupResults = {
    user: null,
    pet: null,
    device: null,
    errors: [],
  };

  // beforeAll(async () => {
  //   await globalState.cleanupAll();
  // });
  it("CleanUp all", async () => {
    await globalState.cleanupAll();
  });

  describe("User Registration", () => {
    // Variabili condivise tra i test
    let verificationId: string;
    let receivedOtp: string | null;

    let createdUser: any;

    it("Verify phone number availability", async () => {
      const responseCheckPhoneNumber = await petlink.core.graphql.public.checkContact({
        contact: userPhoneNumber,
        contactType: "PHONE",
      });

      expect(responseCheckPhoneNumber.checkContact).toBeDefined();
      expect(responseCheckPhoneNumber.checkContact.code).toBe("200");
    });

    it("Send OTP to phone", async () => {
      const response = await petlink.core.graphql.public.sendOtp({
        phone: userPhoneNumber,
        languageId: userData.languageId,
      });

      expect(response.sendOtp).toBeDefined();
      expect(response.sendOtp.verificationId).toBeDefined();

      // Salva il verificationId per i test successivi
      verificationId = response.sendOtp.verificationId as string;
    });

    it("Wait to receive OTP via SMS", async () => {
      const otp = await waitFor(
        () => twilioClient.getLatestOtp(userPhoneNumber),
        {
          timeoutMs: 60000,
          intervalMs: 500,
          timeoutError: `OTP not received for ${userPhoneNumber}`,
        },
      );

      expect(otp).toMatch(/^\d{4,6}$/);

      // Salva l'OTP per i test successivi
      receivedOtp = otp;
    }, 70000); // Timeout più lungo per l'attesa dell'SMS

    it("Verify phone number (sending received OTP)", async () => {
      const response = await petlink.core.graphql.public.checkOtp({
        verificationId,
        otp: receivedOtp!,
        contact: userPhoneNumber,
      });

      expect(response.checkOtp).toBeDefined();
      expect(response.checkOtp.code).toBe("200");
    });

    it("Complete user registration", async () => {
      const response = await petlink.core.graphql.public.signUpUser({
        user: {
          email: userEmail,
          name: userData.name,
          surname: userData.surname,
          city: userData.city,
          countryCode: userData.countryCode,
          zipCode: userData.zipCode,
          streetAddress: userData.streetAddress,
          phone: userPhoneNumber,
          password: userPassword,
          confirmPassword: userPassword,
          languageId: userData.languageId,
        },
        otpData: {
          otp: receivedOtp,
          verificationId,
        },
        languageId: userData.languageId,
        appBrand: "PETLINK",
      });

      expect(response.signUpUser).toBeDefined();
      expect(response.signUpUser.code).toBe("200");
    });

    it("Try login new user (with PHONE)", async () => {
      await petlink.loginWithPhone(userPhoneNumber, userPassword);
      const createdUser = await petlink.core.graphql.authJwt.getUser();

      expect(createdUser.getUser.user).toBeDefined();
      expect(createdUser.getUser.user?.phone).toBe(userPhoneNumber);
      expect(createdUser.getUser.user?.contactVerified?.phone).toBe(true);
    });

    it("Verify Email (by clicking on received link)", async () => {
      const linkUrlToOpen = await waitFor(
        () => gmailClient.getVerificationLink(),
        {
          timeoutMs: 60000,
          intervalMs: 500,
          timeoutError: "Verification email not received",
        },
      );

      const extractParamsFromUrl = (url: string) => {
        const urlObj = new URL(url);
        const uuid = urlObj.searchParams.get("uuid");
        const otp = urlObj.searchParams.get("otp");
        const verificationId = urlObj.searchParams.get("verificationId");
        return { uuid, otp, verificationId };
      };

      // waitFor guarantees linkUrlToOpen is not null (throws on timeout)
      const params = extractParamsFromUrl(linkUrlToOpen!);

      const response = await petlink.core.graphql.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });
      expect(response.verifyEmail).toBeDefined();
      expect(response.verifyEmail.code).toBe("200");
    }, 70000); // Timeout più lungo per l'attesa dell'email

    it("Try login new user (with EMAIL)", async () => {
      await petlink.loginWithEmail(userEmail, userPassword);
      const user = await petlink.core.graphql.authJwt.getUser();

      expect(user.getUser.user).toBeDefined();
      expect(user.getUser.user?.email).toBe(userEmail);
      expect(user.getUser.user?.phone).toBe(userPhoneNumber);
      expect(user.getUser.user?.contactVerified?.phone).toBe(true);
      expect(user.getUser.user?.contactVerified?.email).toBe(true);
    });

    it("Negative assertions", async () => {
      //todo: try to checkContact for number register => should not be available
      //todo:
    });

    afterAll(async () => {
      setupResults.user = createdUser;
    });
  });

  describe("Pet Registration", () => {
    const defaultCat = {
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
    const defaultDog = {
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

    // Variabili condivise tra i test
    let createdDog: any;
    let createdCat: any;

    beforeAll(async () => {
      await petlink.loginWithPhone(userPhoneNumber, userPassword);
    });

    it("Create a DOG for the user", async () => {
      const response = await petlink.core.graphql.authJwt.createPet({
        pet: defaultDog,
      });

      expect(response.createPet).toBeDefined();
      expect(response.createPet.code).toBe("200");
      expect(response.createPet.pet).toBeDefined();
      expect(response.createPet.pet?.name).toBe(defaultDog.name);
      expect(response.createPet.pet?.species).toBe(defaultDog.species);
      expect(response.createPet.pet?.breedType).toBe(defaultDog.breedType);
      expect(response.createPet.pet?.gender).toBe(defaultDog.gender);
      expect(response.createPet.pet?.id).toBeDefined();
      expect(response.createPet.pet?.weight).toBe(defaultDog.weight);
      expect(response.createPet.pet?.birthDate).toBe(defaultDog.birthDate);
      expect(response.createPet.pet?.livingEnvironment).toBe(
        defaultDog.livingEnvironment,
      );
      expect(response.createPet.pet?.primaryColor).toBe(
        defaultDog.primaryColor,
      );
    });

    it("Create a CAT for the user", async () => {
      const response = await petlink.core.graphql.authJwt.createPet({
        pet: defaultCat,
      });

      expect(response.createPet).toBeDefined();
      expect(response.createPet.code).toBe("200");
      expect(response.createPet.pet).toBeDefined();
      expect(response.createPet.pet?.name).toBe(defaultCat.name);
      expect(response.createPet.pet?.species).toBe(defaultCat.species);
      expect(response.createPet.pet?.breedType).toBe(defaultCat.breedType);
      expect(response.createPet.pet?.gender).toBe(defaultCat.gender);
      expect(response.createPet.pet?.id).toBeDefined();
      expect(response.createPet.pet?.weight).toBe(defaultCat.weight);
      expect(response.createPet.pet?.birthDate).toBe(defaultCat.birthDate);
      expect(response.createPet.pet?.livingEnvironment).toBe(
        defaultCat.livingEnvironment,
      );
      expect(response.createPet.pet?.primaryColor).toBe(
        defaultCat.primaryColor,
      );
    });

    it("Try to create PETs with wrong combinations data", async () => {
      // Test validation rules:
      // 1. PUREBREED must have exactly 1 breed
      // 2. MIXED_BREED must have exactly 2 breeds
      // 3. DOG species cannot use CAT breeds
      // 4. CAT species cannot use DOG breeds

      // Execute all invalid pet creation requests in parallel
      const [
        dogPurebreedWithTwoBreeds,
        dogMixedbreedWithOneBreed,
        catWithDogBreed,
        dogWithCatBreed,
      ] = await Promise.all([
        // Invalid: PUREBREED with 2 breeds (should have only 1)
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...defaultDog,
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
            ...defaultDog,
            breedType: "MIXED_BREED",
            breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Only 1 breed
          },
        }),
        // Invalid: CAT with DOG breed
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...defaultCat,
            breedType: "PUREBREED",
            breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], // Labrador Retriever (DOG)
          },
        }),
        // Invalid: DOG with CAT breed
        petlink.core.graphql.authJwt.createPet({
          pet: {
            ...defaultDog,
            breedType: "PUREBREED",
            breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], // Siamese (CAT)
          },
        }),
      ]);
      // Assert all requests failed with validation error (400)
      expect(dogPurebreedWithTwoBreeds.createPet.code).toBe("400");
      expect(dogMixedbreedWithOneBreed.createPet.code).toBe("400");
      expect(catWithDogBreed.createPet.code).toBe("400");
      expect(dogWithCatBreed.createPet.code).toBe("400");
    });

    it("Verify user has 2 pets", async () => {
      const response = await petlink.core.graphql.authJwt.getPets();

      expect(response.getPets).toBeDefined();
      expect(response.getPets.code).toBe("200");
      expect(response.getPets.pets).toBeDefined();
      expect(response.getPets.pets).toHaveLength(2);

      // Verifica che ci siano un cane e un gatto
      const petSpecies = response.getPets.pets?.map((pet) => pet.species);
      expect(petSpecies).toContain("DOG");
      expect(petSpecies).toContain("CAT");
    });

    afterAll(async () => {
      // Salva i pet creati per i test successivi (es. Device Registration)
    });
  });
});
