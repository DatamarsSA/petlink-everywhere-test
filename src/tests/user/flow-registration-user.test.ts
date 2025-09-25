import { describe, it, expect, beforeAll } from "vitest";
import { env } from "../../config/env-schema-validation.js";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { GetUserQuery } from "../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";

// describe("User Registration Flow", () => {
//   const userPhoneNumber = env.USER_PHONE_NUMBER;
//   const userEmail = env.USER_EMAIL;
//   const userPassword = env.USER_PASSWORD;
//
//   // Pulizia messaggi prima di tutti i test
//   beforeAll(async () => {
//     console.log(
//       "\n🧹 PULIZIA INIZIALE: Elimino tutti i messaggi precedenti...",
//     );
//     const deletedCount =
//       await twilioClient.deleteAllMessagesSentoToNumber(userPhoneNumber);
//     console.log(`🧹 PULIZIA COMPLETATA: ${deletedCount} messaggi eliminati`);
//   });
//
//   it("Should complete full registration flow", async () => {
//     console.log("\n🎯 TEST: Flusso completo registrazione utente...");
//
//     // STEP 1: Verifica che il numero di telefono non sia già registrato
//     console.log(
//       `📱 Verifico che il numero ${userPhoneNumber} non sia già registrato...`,
//     );
//     const checkPhoneResponse = await petlink.core.public.checkContact({
//       contact: userPhoneNumber,
//       contactType: "PHONE",
//     });
//
//     console.log(
//       "📋 Risposta checkContact (phone):",
//       JSON.stringify(checkPhoneResponse, null, 2),
//     );
//     expect(checkPhoneResponse.checkContact).toBeDefined();
//     expect(checkPhoneResponse.checkContact.code).toBe("200");
//     console.log("✅ Numero di telefono verificato con successo!");
//
//     // STEP 2: Invia OTP al numero di telefono
//     console.log(`📱 Invio OTP al numero ${userPhoneNumber}...`);
//     const otpResponse = await petlink.core.public.sendOtp({
//       phone: userPhoneNumber,
//       languageId: "IT",
//     });
//
//     console.log("📋 Risposta sendOtp:", JSON.stringify(otpResponse, null, 2));
//     expect(otpResponse.sendOtp).toBeDefined();
//     expect(otpResponse.sendOtp.verificationId).toBeDefined();
//     const verificationId = otpResponse.sendOtp.verificationId as string;
//     console.log(`✅ OTP inviato! VerificationId: ${verificationId}`);
//
//     // STEP 3: Aspetta e recupera l'OTP da Twilio
//     console.log("📱 SMS inviato, aspetto l'OTP con delay iniziale...");
//     const receivedOtp = await twilioClient.waitForOtp(
//       userPhoneNumber,
//       60000, // 60 secondi timeout totale
//       5000, // 5 secondi tra i tentativi
//     );
//
//     console.log(`🎉 OTP ricevuto: ${receivedOtp}`);
//     expect(receivedOtp).toMatch(/^\d{4,6}$/);
//
//     // STEP 4: Verifica l'OTP ricevuto
//     console.log(
//       `🔐 Invio l'OTP ${receivedOtp} con verificationId ${verificationId}...`,
//     );
//     const checkOtpResponse = await petlink.core.public.checkOtp({
//       verificationId: verificationId,
//       otp: receivedOtp,
//       contact: userPhoneNumber,
//     });
//
//     console.log(
//       "📋 Risposta checkOtp:",
//       JSON.stringify(checkOtpResponse, null, 2),
//     );
//     expect(checkOtpResponse.checkOtp).toBeDefined();
//     expect(checkOtpResponse.checkOtp.code).toBe("200");
//     console.log("✅ OTP verificato con successo!");
//
//     // STEP 6: Registrazione utente completa
//     console.log("👤 Procedo con la registrazione completa dell'utente...");
//     const signUpResponse = await petlink.core.public.signUpUser({
//       user: {
//         email: userEmail,
//         name: "Test",
//         surname: "User",
//         city: "Milano",
//         countryCode: "IT",
//         zipCode: "20100",
//         streetAddress: "Via Test 123",
//         phone: userPhoneNumber,
//         password: userPassword,
//         confirmPassword: userPassword,
//         languageId: "IT",
//       },
//       otpData: {
//         otp: receivedOtp,
//         verificationId: verificationId,
//       },
//       languageId: "IT",
//       appBrand: "PETLINK",
//     });
//
//     console.log(
//       "📋 Risposta signUpUser:",
//       JSON.stringify(signUpResponse, null, 2),
//     );
//     expect(signUpResponse.signUpUser).toBeDefined();
//     expect(signUpResponse.signUpUser.code).toBe("200");
//     console.log("🎉 Utente registrato con successo!");
//
//     // STEP 7: Verifica login con l'utente appena registrato
//     console.log(
//       "\n🔐 VERIFICA LOGIN: Testo login con l'utente appena registrato...",
//     );
//
//     await petlink.loginWithPhone(userPhoneNumber, userPassword);
//     const createduser = await petlink.core.authJwt.getUser();
//     expect(createduser.getUser.user).toBeDefined();
//     expect(createduser.getUser.user?.email).toBe(userEmail);
//     expect(createduser.getUser.user?.phone).toBe(userPhoneNumber);
//     expect(createduser.getUser.user?.contactVerified?.phone).toBe(true);
//     expect(createduser.getUser.user?.contactVerified?.email).toBe(false);
//
//     //todo: implements email verification
//
//     console.log(
//       "📋 Risposta getUser (utente loggato):",
//       JSON.stringify(createduser, null, 2),
//     );
//   }, 120000); // 2 minuti timeout per il test completo
// });

describe("Claude - User Registration Flow", () => {
  const userPhoneNumber = env.USER_PHONE_NUMBER;
  const userEmail = env.USER_EMAIL;
  const userPassword = env.USER_PASSWORD;

  beforeAll(async () => {
    const deletedCount =
      await twilioClient.deleteAllMessagesSentoToNumber(userPhoneNumber);
    console.log(`🧹 Cleanup: ${deletedCount} messages deleted`);
  });

  it("should complete full registration flow", async () => {
    // Step 1: Phone verification check
    await step("Verify phone number availability", async () => {
      const response = await petlink.core.public.checkContact({
        contact: userPhoneNumber,
        contactType: "PHONE",
      });

      expect(response.checkContact).toBeDefined();
      expect(response.checkContact.code).toBe("200");
      return response;
    });

    // Step 2: OTP sending
    const verificationId = await step("Send OTP to phone", async () => {
      const response = await petlink.core.public.sendOtp({
        phone: userPhoneNumber,
        languageId: "IT",
      });

      expect(response.sendOtp).toBeDefined();
      expect(response.sendOtp.verificationId).toBeDefined();
      return response.sendOtp.verificationId as string;
    });

    // Step 3: OTP retrieval
    const receivedOtp = await step("Wait for OTP via SMS", async () => {
      const otp = await twilioClient.waitForOtp(
        userPhoneNumber,
        60000, // 60s timeout
        5000, // 5s retry interval
      );

      expect(otp).toMatch(/^\d{4,6}$/);
      return otp;
    });

    // Step 4: OTP verification
    await step("Verify received OTP", async () => {
      const response = await petlink.core.public.checkOtp({
        verificationId,
        otp: receivedOtp,
        contact: userPhoneNumber,
      });

      expect(response.checkOtp).toBeDefined();
      expect(response.checkOtp.code).toBe("200");
      return response;
    });

    // Step 5: User registration
    await step("Complete user registration", async () => {
      const response = await petlink.core.public.signUpUser({
        user: {
          email: userEmail,
          name: "Test",
          surname: "User",
          city: "Milano",
          countryCode: "IT",
          zipCode: "20100",
          streetAddress: "Via Test 123",
          phone: userPhoneNumber,
          password: userPassword,
          confirmPassword: userPassword,
          languageId: "IT",
        },
        otpData: {
          otp: receivedOtp,
          verificationId,
        },
        languageId: "IT",
        appBrand: "PETLINK",
      });

      expect(response.signUpUser).toBeDefined();
      expect(response.signUpUser.code).toBe("200");
      return response;
    });

    // Step 6: Login verification
    await step("Verify login with new user", async () => {
      await petlink.loginWithPhone(userPhoneNumber, userPassword);
      const user = await petlink.core.authJwt.getUser();

      expect(user.getUser.user).toBeDefined();
      expect(user.getUser.user?.email).toBe(userEmail);
      expect(user.getUser.user?.phone).toBe(userPhoneNumber);
      expect(user.getUser.user?.contactVerified?.phone).toBe(true);
      expect(user.getUser.user?.contactVerified?.email).toBe(false);

      return user;
    });
  }, 120000);

  // Helper function for step-based execution
  async function step<T>(
    description: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      console.log(`\n🔄 ${description}...`);
      const result = await fn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${description} completed (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${description} failed (${duration}ms)`);
      console.error(`Error details:`, error);
      throw error;
    }
  }
});
