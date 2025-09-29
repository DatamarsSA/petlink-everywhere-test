// src/test-utils/environment.ts

// Tipo per rappresentare lo stato di un test
import { User } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { env } from "../../config/env-schema-validation.js";
import { step } from "../helpers/utils-step.js";
import {
  LanguageId,
  petlink,
  UtilityTestTypeEnum,
} from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { GetUserQuery } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fixtures } from "../fixtures/fixture-user-pet-device.js";

export type TestState = {
  user?: User;
};

export class GlobalState {
  private state: TestState = {};

  // Singleton pattern
  private static _instance: GlobalState;

  private constructor() {
    // Inizializzazione privata
  }

  public static get instance(): GlobalState {
    if (!this._instance) {
      this._instance = new GlobalState();
    }
    return this._instance;
  }

  // Getter per lo stato corrente
  public getState(): TestState {
    return this.state;
  }

  /**
   * Crea un nuovo utente seguendo il flusso di registrazione completo
   * @param email Email opzionale (se non fornita, viene usata quella dell'env)
   * @param phoneNumber Numero di telefono opzionale (se non fornito, viene usato quello dell'env)
   * @param password Password opzionale (se non fornita, viene usata quella dell'env)
   * @returns L'utente creato
   */
  public async createUser(
    email?: string,
    phoneNumber?: string,
    password?: string,
  ): Promise<User> {
    // Usa i valori dell'env se non forniti
    const userEmail = email || fixtures.user.default.email;
    const userPhoneNumber = phoneNumber || fixtures.user.default.phoneNumber;
    const userPassword = password || fixtures.user.default.password;

    console.log(
      `Creating user with email ${userEmail} and phone ${userPhoneNumber}`,
    );

    // Step 1: Verifica disponibilità numero di telefono
    await step("Verify phone number availability", async () => {
      const responseCheckPhoneNumber = await petlink.core.public.checkContact({
        contact: userPhoneNumber,
        contactType: "PHONE",
      });

      if (responseCheckPhoneNumber.checkContact.code !== "200") {
        throw new Error(
          `Phone number ${userPhoneNumber} is not available: ${responseCheckPhoneNumber.checkContact.message}`,
        );
      }
    });

    // Step 2: Invio OTP al telefono
    const verificationId = await step("Send OTP to phone", async () => {
      const response = await petlink.core.public.sendOtp({
        phone: userPhoneNumber,
        languageId: fixtures.user.default.languageId,
      });

      if (!response.sendOtp.verificationId) {
        throw new Error("Failed to get verification ID");
      }

      return response.sendOtp.verificationId as string;
    });

    // Step 3: Attesa e recupero OTP da SMS
    const receivedOtp = await step("Wait for OTP via SMS", async () => {
      const otp = await twilioClient.waitForOtp(
        userPhoneNumber,
        60000, // 60s timeout
        5000, // 5s retry interval
      );

      return otp;
    });

    // Step 4: Verifica OTP
    await step("Verify Phone number with OTP", async () => {
      const response = await petlink.core.public.checkOtp({
        verificationId,
        otp: receivedOtp,
        contact: userPhoneNumber,
      });

      if (response.checkOtp.code !== "200") {
        throw new Error(
          `OTP verification failed: ${response.checkOtp.message}`,
        );
      }
    });

    // Step 5: Registrazione utente
    await step("Complete user registration", async () => {
      const userData = fixtures.user.default;
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

      if (response.signUpUser.code !== "200") {
        throw new Error(
          `User registration failed: ${response.signUpUser.message}`,
        );
      }
    });

    // Step 6: Login con il nuovo utente (via telefono)
    const user = await step("Login with new user (via PHONE)", async () => {
      await petlink.loginWithPhone(userPhoneNumber, userPassword);
      const userResponse = await petlink.core.authJwt.getUser();

      if (!userResponse.getUser.user) {
        throw new Error("Failed to get user after login");
      }

      return userResponse.getUser.user;
    });

    // Step 7: Verifica email (cliccando sul link ricevuto)
    await step("Verify Email (clicking on received link)", async () => {
      const linkUrlToOpen = await gmailClient.waitForVerificationEmail();
      const extractParamsFromUrl = (url: string) => {
        const urlObj = new URL(url);
        const uuid = urlObj.searchParams.get("uuid");
        const otp = urlObj.searchParams.get("otp");
        const verificationId = urlObj.searchParams.get("verificationId");
        return { uuid, otp, verificationId };
      };

      const params = extractParamsFromUrl(linkUrlToOpen);
      await petlink.core.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });
    });

    // Verifica finale con login via email
    const verifiedUser = await step("Verify login with EMAIL", async () => {
      await petlink.loginWithEmail(userEmail, userPassword);
      const userResponse = await petlink.core.authJwt.getUser();

      if (!userResponse.getUser.user) {
        throw new Error("Failed to get user after email verification");
      }

      return userResponse.getUser.user;
    });

    // Salva l'utente nello stato
    this.state.user = verifiedUser;

    return verifiedUser;
  }

  /**
   * Elimina l'utente corrente
   */
  public async deleteUser(): Promise<void> {
    if (!this.state.user) {
      console.log("No user to delete in the current state");
      try {
        await petlink.loginWithPhone(
          fixtures.user.default.phoneNumber,
          fixtures.user.default.password,
        );
        const user = await petlink.core.authJwt.getUser();

        petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
        await petlink.core.authIam.utilityIntegrationTest({
          input: {
            userId: user.getUser.user!.id,
            utilityType: UtilityTestTypeEnum.CLEAN_UP_USER,
          },
        });

        console.log(`Deleted default user with ID: ${user.getUser.user!.id}`);
      } catch (error) {
        console.log("No default user found or error deleting user:", error);
      }

      return;
    }
  }

  /**
   * Pulisce l'ambiente eliminando utenti, email e messaggi SMS
   */
  public async cleanupAll(): Promise<void> {
    console.log("Cleaning up test environment");

    // Elimina l'utente
    await this.deleteUser();

    // Pulisci email
    await gmailClient.deleteAllEmails();
    console.log("Deleted all emails");

    // Pulisci SMS
    await twilioClient.deleteAllMessagesSentoToNumber(
      fixtures.user.default.phoneNumber,
    );
    console.log(`Deleted SMS for ${fixtures.user.default.phoneNumber}`);

    // Resetta lo stato
    this.state = {};
  }
}

// Esporta l'istanza singleton direttamente
export const globalState = GlobalState.instance;
