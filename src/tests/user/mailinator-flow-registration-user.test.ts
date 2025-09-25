// // test/e2e/user-registration.mailinator.spec.ts
// import { describe, it, expect, beforeAll } from "vitest";
// import { env } from "../../config/env-schema-validation.js";
// import {
//   petlink,
//   type CognitoCredentials,
// } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
// import { MailinatorClient } from "../../clients/mailinator/client-mailinator.js";
//
// describe("User Registration Flow (Mailinator email+sms)", () => {
//   // --- Setup Mailinator ---
//   const mailinator = new MailinatorClient(
//       env.MAILINATOR_API_TOKEN,
//       env.MAILINATOR_DOMAIN, // "public" | "private"
//   );
//
//   // Email inbox: use random local-part under mailinator domain
//   const emailLocal =
//       `${env.MAILINATOR_EMAIL_LOCALPART_PREFIX}-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
//   const testEmail =
//       env.MAILINATOR_DOMAIN === "public"
//           ? `${emailLocal}@mailinator.com`
//           : `${emailLocal}@YOUR-PRIVATE-DOMAIN.TLD`; // opzionale se usi private domain
//
//   // SMS inbox: must be a pre-provisioned Mailinator number (string)
//   const smsNumber = env.MAILINATOR_SMS_NUMBER; // e.g. "+12065551234"
//
//   const testPassword = "Test123!";
//
//   beforeAll(async () => {
//     console.log("\n🧹 Cleanup iniziale Mailinator...");
//     // Pulisci entrambe le inbox per evitare collisioni
//     const deletedEmail = await mailinator.purgeInbox(emailLocal);
//     const deletedSms = await mailinator.purgeInbox(smsNumber);
//     console.log(`🧹 Email msgs rimossi: ${deletedEmail}, SMS msgs rimossi: ${deletedSms}`);
//   });
//
//   it(
//       "Should complete full registration flow",
//       async () => {
//         console.log("\n🎯 TEST: Flusso completo registrazione utente (Mailinator)...");
//
//         // STEP 1: Verifica che il numero di telefono non sia già registrato
//         console.log(`📱 checkContact( PHONE: ${smsNumber} )`);
//         const checkPhoneResponse = await petlink.core.authApiKey.checkContact({
//           contact: smsNumber,
//           contactType: "PHONE",
//         });
//         expect(checkPhoneResponse.checkContact?.code).toBe("200");
//
//         // STEP 2: Invia OTP al numero di telefono (arriverà come SMS in Mailinator)
//         console.log(`📱 Invio OTP a ${smsNumber}...`);
//         const otpResp = await petlink.core.authApiKey.sendOtp({
//           phone: smsNumber,
//           languageId: "IT",
//         });
//         expect(otpResp.sendOtp?.verificationId).toBeDefined();
//         const verificationId = otpResp.sendOtp!.verificationId as string;
//
//         // STEP 3: Poll SMS inbox fino ad ottenere l'OTP
//         console.log("⌛ Attendo SMS con OTP su Mailinator (SMS)...");
//         const smsMsg = await mailinator.waitForMessage(smsNumber, {
//           timeoutMs: 60_000,
//           intervalMs: 3_000,
//           // opzionale: filtra per subject mittente, se sai come arriva
//           // predicate: (m) => (m.subject ?? "").includes("Your OTP")
//         });
//         const receivedOtp = MailinatorClient.extractOtp(smsMsg);
//         console.log(`🎉 OTP SMS ricevuto: ${receivedOtp}`);
//         expect(receivedOtp).toMatch(/^\d{4,8}$/);
//
//         // STEP 4: Verifica OTP
//         const checkOtpResponse = await petlink.core.authApiKey.checkOtp({
//           verificationId,
//           otp: receivedOtp,
//           contact: smsNumber,
//         });
//         expect(checkOtpResponse.checkOtp?.code).toBe("200");
//         console.log("✅ OTP verificato!");
//
//         // STEP 5: Verifica che l'email non sia già registrata
//         console.log(`📧 checkContact( EMAIL: ${testEmail} )`);
//         const checkEmailResponse = await petlink.core.authApiKey.checkContact({
//           contact: testEmail,
//           contactType: "EMAIL",
//         });
//         expect(checkEmailResponse.checkContact?.code).toBe("200");
//
//         // STEP 6: Registrazione utente
//         console.log("👤 signUpUser...");
//         const signUpResponse = await petlink.core.authApiKey.signUpUser({
//           user: {
//             email: testEmail,
//             name: "Test",
//             surname: "User",
//             city: "Milano",
//             countryCode: "IT",
//             zipCode: "20100",
//             streetAddress: "Via Test 123",
//             phone: smsNumber,
//             password: testPassword,
//             confirmPassword: testPassword,
//             languageId: "IT",
//           },
//           otpData: { otp: receivedOtp, verificationId },
//           languageId: "IT",
//           appBrand: "PETLINK",
//         });
//         expect(signUpResponse.signUpUser?.code).toBe("200");
//         console.log("🎉 Utente registrato!");
//
//         // (Opzionale) STEP 6bis: Se il tuo pool richiede email_verified, aspetta l'email e clicca/estrai token
//         console.log("⌛ Attendo eventuale email di verifica su Mailinator (EMAIL)...");
//         const emailMsg = await mailinator.waitForMessage(emailLocal, {
//           timeoutMs: 90_000,
//           intervalMs: 3_000,
//           // predicate: (m) => (m.subject ?? "").includes("Verify"),
//         });
//         // Se serve un codice anche in email:
//         // const emailOtp = MailinatorClient.extractOtp(emailMsg);
//
//         // STEP 7: Login
//         const creds: CognitoCredentials = { username: testEmail, password: testPassword };
//         const getUserResponse = await petlink.core
//             .authLoginWith(creds)
//             .getUser();
//
//         expect(getUserResponse.getUser?.code).toBe("200");
//         expect(getUserResponse.getUser?.user).toBeDefined();
//         const u = getUserResponse.getUser!.user!;
//         expect(u.email).toBe(testEmail);
//         expect(u.phone).toBe(smsNumber);
//         console.log("✅ LOGIN VERIFICATO!");
//       },
//       180_000,
//   );
// });
