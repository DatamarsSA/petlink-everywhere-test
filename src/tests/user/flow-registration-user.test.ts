import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { globalState } from "../../test-utils/global-state/state-global-flow.js";
import { waitFor } from "../../test-utils/helpers/utils-retry.js";
import { fixtures } from "../../test-utils/fixtures/fixtures.js";

describe.sequential("Environment Setup", () => {
  let setupResults = {
    user: null,
    pet: null,
    device: null,
    errors: [],
  };

  describe("User Registration", () => {
    const userData = fixtures.user;
    const userPhoneNumber = userData.phone;
    const userEmail = userData.email;
    const userPassword = userData.password;

    // Variabili condivise tra i test
    let verificationId: string;
    let receivedOtp: string;

    let createdUser: any;

    beforeAll(async () => {
      await globalState.cleanupAll();
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
          intervalMs: 1000,
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
        otp: receivedOtp,
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
          intervalMs: 1000,
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

      await petlink.core.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });

      const user = await petlink.core.authJwt.getUser();
      expect(user.getUser.user).toBeDefined();
      expect(user.getUser.user?.email).toBe(userEmail);
      expect(user.getUser.user?.contactVerified?.email).toBe(true);
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

    afterAll(async () => {
      this.setupResults.set(createdUser);
    });

    it("Negative assertions", async () => {
      //todo: try to checkContact for number register => should not be available
      //todo:
    });

    afterAll(async () => {
      this.setupResults.set(createdUser);
    });
  });

  describe("Pet Registration", () => {
    const fixtureCat = fixtures.pet.defaultCat;
    const fixtureDog = fixtures.pet.defaultDog;

    // Variabili condivise tra i test
    let createdDog: any;
    let createdCat: any;

    beforeAll(async () => {});

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

    it("Verify user has 2 pets", async () => {
      //todo: implement check on getPets() return pets of user of jwt
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
      if (createdDog) {
        setupResults.pet = createdDog;
      }
    });
  });
});
