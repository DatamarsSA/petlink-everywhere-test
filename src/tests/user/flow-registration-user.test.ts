import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { globalState } from "../../test-utils/global-state/state-global-flow.js";
import { waitFor } from "../../test-utils/helpers/utils-retry.js";
import { fixtures } from "../../test-utils/fixtures/fixtures.js";
import type { PetIn } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

describe.sequential("Environment Setup", () => {
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

  describe("User Registration", () => {
    // Variabili condivise tra i test
    let verificationId: string;
    let receivedOtp: string | null;

    let createdUser: any;

    beforeAll(async () => {
      // await globalState.cleanupAll();
    });

    it("CleanUp all", async () => {
      // await globalState.cleanupAll();
    });

    it("Verify phone number availability", async () => {
      const responseCheckPhoneNumber = await petlink.core.public.checkContact({
        contact: userPhoneNumber,
        contactType: "PHONE",
      });

      expect(responseCheckPhoneNumber.checkContact).toBeDefined();
      expect(responseCheckPhoneNumber.checkContact.code).toBe("200");
    });

    it("Send OTP to phone", async () => {
      const response = await petlink.core.public.sendOtp({
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
      const response = await petlink.core.public.checkOtp({
        verificationId,
        otp: receivedOtp!,
        contact: userPhoneNumber,
      });

      expect(response.checkOtp).toBeDefined();
      expect(response.checkOtp.code).toBe("200");
    });

    it("Complete user registration", async () => {
      const response = await petlink.core.public.signUpUser({
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
      const createdUser = await petlink.core.authJwt.getUser();

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

      const response = await petlink.core.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });
      expect(response.verifyEmail).toBeDefined();
      expect(response.verifyEmail.code).toBe("200");
    }, 70000); // Timeout più lungo per l'attesa dell'email

    it("Try login new user (with EMAIL)", async () => {
      await petlink.loginWithEmail(userEmail, userPassword);
      const user = await petlink.core.authJwt.getUser();

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
    const fixtureCat = {
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
    const fixtureDog = {
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
      const response = await petlink.core.authJwt.createPet({
        pet: fixtureDog,
      });

      expect(response.createPet).toBeDefined();
      expect(response.createPet.code).toBe("200");
      expect(response.createPet.pet).toBeDefined();
      expect(response.createPet.pet?.name).toBe(fixtureDog.name);
      expect(response.createPet.pet?.species).toBe(fixtureDog.species);
      expect(response.createPet.pet?.breedType).toBe(fixtureDog.breedType);
      expect(response.createPet.pet?.gender).toBe(fixtureDog.gender);
      expect(response.createPet.pet?.id).toBeDefined();

      // Salva il pet creato per i test successivi
      createdDog = response.createPet.pet;
    });

    it("Create a CAT for the user", async () => {
      const response = await petlink.core.authJwt.createPet({
        pet: fixtureCat,
      });

      expect(response.createPet).toBeDefined();
      expect(response.createPet.code).toBe("200");
      expect(response.createPet.pet).toBeDefined();
      expect(response.createPet.pet?.name).toBe(fixtureCat.name);
      expect(response.createPet.pet?.species).toBe(fixtureCat.species);
      expect(response.createPet.pet?.breedType).toBe(fixtureCat.breedType);
      expect(response.createPet.pet?.gender).toBe(fixtureCat.gender);
      expect(response.createPet.pet?.id).toBeDefined();

      // Salva il pet creato per i test successivi
      createdCat = response.createPet.pet;
    });

    it("Try to create PETs with wrong combinations data", async () => {
      // Se purebred => devo passargli 1solo breeds
      // Se mixed breed => devo passargli 2 breeds
      //
      // Se cane => non deve accettare colori per gatto
      // Se gatto => non deve accettare colori per cane
      //
      // Se cane => non deve accettare breed di gatto
      // Se gatto => non deve accettare breed di gatto

      //Wrong combination of BREEDTYPE adn quantity of breeds
      const dogPurebreedWIthTwoBreeds = await petlink.core.authJwt.createPet({
        pet: {
          ...fixtureDog,
          breedType: "PUREBREED",
          breeds: [
            "5b0bfddb-532e-41cb-9705-b2ddc21226ef",
            "0074b56e-8c84-43b6-aaad-d7c00a9aa37e",
          ],
        },
      });
      const dogMixedbreedWIthOneBreed = await petlink.core.authJwt.createPet({
        pet: {
          ...fixtureDog,
          breedType: "MIXED_BREED",
          breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"],
        },
      });

      //Wrong combination of breed
      const catWithDogBreed = await petlink.core.authJwt.createPet({
        pet: {
          ...fixtureCat,
          breedType: "PUREBREED",
          breeds: ["5b0bfddb-532e-41cb-9705-b2ddc21226ef"], //DOG - Labrador Retriever
        },
      });

      const dogWithCAtBreed = await petlink.core.authJwt.createPet({
        pet: {
          ...fixtureCat,
          breedType: "PUREBREED",
          breeds: ["f7bbebdf-26bb-4947-996d-3290bf128f01"], //CAT - Siamese
        },
      });
    });

    it("Verify user has 2 pets", async () => {
      const response = await petlink.core.authJwt.getPets();

      expect(response.getPets).toBeDefined();
      expect(response.getPets.code).toBe("200");
      expect(response.getPets.pets).toBeDefined();
      expect(response.getPets.pets).toHaveLength(2);

      // Verifica che ci siano un cane e un gatto
      const petSpecies = response.getPets.pets?.map((pet) => pet.species);
      expect(petSpecies).toContain("DOG");
      expect(petSpecies).toContain("CAT");
    });

    it("Verify pet details are correct", async () => {
      // Verifica dettagli del cane
      expect(createdDog.weight).toBe(fixtureDog.weight);
      expect(createdDog.birthDate).toBe(fixtureDog.birthDate);
      expect(createdDog.livingEnvironment).toBe(fixtureDog.livingEnvironment);
      expect(createdDog.primaryColor).toBe(fixtureDog.primaryColor);
      // Verifica dettagli del gatto
      expect(createdCat.weight).toBe(fixtureCat.weight);
      expect(createdCat.birthDate).toBe(fixtureCat.birthDate);
      expect(createdCat.livingEnvironment).toBe(fixtureCat.livingEnvironment);
      expect(createdCat.primaryColor).toBe(fixtureCat.primaryColor);
    });

    afterAll(async () => {
      // Salva i pet creati per i test successivi (es. Device Registration)
    });
  });
});
