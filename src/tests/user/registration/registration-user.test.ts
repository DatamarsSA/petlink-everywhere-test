import { beforeAll, afterAll, describe, expect, it, beforeEach } from "vitest";
import { fixtureCurrentBrand, appBrand, pollingTimeoutMs, pollingIntervalMs } from "../../../fixtures/fixtures.js";
import type { UserIn } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { waitFor } from "../../../helpers/helpers.js";
import { twilioClient } from "../../../clients/twilio/client-twillio.js";
import { gmailClient } from "../../../clients/gmail/client-gmail.js";
import { testHelper } from "../../../clients/client-test-helper.js";
import { User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { logger } from "../../../config/logger.js";

describe("User Registration", () => {
  // Payload per la registrazione utente
  const signUpPayload = {
    email: fixtureCurrentBrand.user.email,
    name: fixtureCurrentBrand.user.name,
    surname: fixtureCurrentBrand.user.surname,
    city: fixtureCurrentBrand.user.city,
    countryCode: fixtureCurrentBrand.user.countryCode,
    zipCode: fixtureCurrentBrand.user.zipCode,
    streetAddress: fixtureCurrentBrand.user.streetAddress,
    phone: fixtureCurrentBrand.user.phone,
    password: fixtureCurrentBrand.user.password,
    confirmPassword: fixtureCurrentBrand.user.confirmPassword,
    languageId: fixtureCurrentBrand.user.languageId,
  } as UserIn;

  // Variabili condivise tra i test
  let verificationId: string;
  let receivedOtp: string | null;
  let verificationLink: string | null;

  it("Verify phone number availability", async () => {
    const response = await petlink.core.graphql.public.checkContact({
      contact: signUpPayload.phone,
      contactType: "PHONE",
    });

    expect(response.checkContact.code, "checkContact endpoint should return success").toBe("200");
  });

  it("Send OTP to phone", async () => {
    const response = await petlink.core.graphql.public.sendOtp({
      phone: signUpPayload.phone,
      languageId: signUpPayload.languageId,
    });

    expect(response.sendOtp.verificationId, "VerificationId should be returned after sending OTP").toBeDefined();

    // Salva il verificationId per i test successivi
    verificationId = response.sendOtp.verificationId as string;
  });

  it("Wait to receive OTP via SMS", async () => {
    const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(signUpPayload.phone), {
      timeoutMs: pollingTimeoutMs,
      intervalMs: pollingIntervalMs,
      timeoutError: `OTP not received for ${signUpPayload.phone}`,
    });

    expect(otp, "OTP should match 4-6 digit pattern").toMatch(/^\d{4,6}$/);
    receivedOtp = otp;
  }, 70000);

  it("Verify phone number (sending received OTP)", async () => {
    const response = await petlink.core.graphql.public.checkOtp({
      verificationId,
      otp: receivedOtp!,
      contact: signUpPayload.phone,
    });

    expect(response.checkOtp.code, "checkOtp endpoint should return success").toBe("200");
  });

  it("Register User", async () => {
    const response = await petlink.core.graphql.public.signUpUser({
      user: signUpPayload,
      otpData: {
        otp: receivedOtp!,
        verificationId,
      },
      appBrand: appBrand,
    });

    expect(response.signUpUser.code, "signUpUser endpoint should return success").toBe("200");
  });

  it("Try login new user (with PHONE)", async () => {
    await petlink.loginWithPhone(signUpPayload.phone, signUpPayload.password);
    const userResponse = await petlink.core.graphql.authJwt.getUser();

    expect(userResponse.getUser.user?.phone, "Logged in user phone should match signup payload").toBe(signUpPayload.phone);
    expect(userResponse.getUser.user?.contactVerified?.phone, "Phone should be verified after OTP confirmation").toBe(true);
    expect(userResponse.getUser.user?.contactVerified?.email, "Email should not be verified yet").toBe(false);
  });

  it("Wait to receive CONFIRMATION EMAIL", async () => {
    const linkUrlToOpen = await waitFor(() => gmailClient.getVerificationLink(), {
      timeoutMs: pollingTimeoutMs,
      intervalMs: pollingIntervalMs,
      timeoutError: "Verification email not received",
    });

    expect(linkUrlToOpen, "Verification link should be received via email").toBeDefined();
    expect(linkUrlToOpen, "Verification link should contain uuid parameter").toContain("uuid=");
    expect(linkUrlToOpen, "Verification link should contain otp parameter").toContain("otp=");
    expect(linkUrlToOpen, "Verification link should contain verificationId parameter").toContain("verificationId=");

    // Salva il link per i test successivi
    verificationLink = linkUrlToOpen;
  }, 70000);

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
    expect(response.verifyEmail, "Email verification response should be defined").toBeDefined();
    expect(response.verifyEmail!.code, "verifyEmail endpoint should return success").toBe("200");
  });

  it("Try login new user (with EMAIL)", async () => {
    await petlink.loginWithEmail(signUpPayload.email, signUpPayload.password);
    const user = await petlink.core.graphql.authJwt.getUser();

    expect(user.getUser.user, "User should be defined after login with email").toBeDefined();
    expect(user.getUser.user?.email, "Logged in user email should match signup payload").toBe(signUpPayload.email);
    expect(user.getUser.user?.phone, "Logged in user phone should match signup payload").toBe(signUpPayload.phone);
    expect(user.getUser.user?.contactVerified?.phone, "Phone should remain verified").toBe(true);
    expect(user.getUser.user?.contactVerified?.email, "Email should now be verified").toBe(true);
  });

  it("Verify user created has all value equals to input payload", async () => {
    const userResponse = await petlink.core.graphql.authJwt.getUser();
    // Verifica campi specifici dell'input
    expect(userResponse.getUser.user, "Created user should match input payload").toMatchObject({
      email: signUpPayload.email,
      name: signUpPayload.name,
      surname: signUpPayload.surname,
      city: signUpPayload.city,
      countryCode: signUpPayload.countryCode,
      zipCode: signUpPayload.zipCode,
      streetAddress: signUpPayload.streetAddress,
      phone: signUpPayload.phone,
      languageId: signUpPayload.languageId,
    });
    // Verifica anche i campi generati dal backend
    expect(userResponse.getUser.user?.id, "User ID auto-generated should be present").toBeDefined();
    expect(userResponse.getUser.user?.creationDate, "Creation date should be set").toBeDefined();
    expect(userResponse.getUser.user?.updateDate, "Update date should be set").toBeDefined();
  });

  it("Verify contacts (Phone & Email) are no longer available", async () => {
    const [phoneCheck, emailCheck] = await Promise.all([
      petlink.core.graphql.public.checkContact({
        contact: signUpPayload.phone,
        contactType: "PHONE",
      }),
      petlink.core.graphql.public.checkContact({
        contact: signUpPayload.email,
        contactType: "EMAIL",
      }),
    ]);

    expect(phoneCheck.checkContact.code, "checkContact endpoint should return error - Phone should no longer be available").toBe("400");
    expect(emailCheck.checkContact.code, "checkContact endpoint should return error - Email should no longer be available").toBe("400");
  });

  it("Test RESET email, phone number and password", async () => {
    //TODO: Test RESET email, phone number and password
  });
});

/**
 * ✓ User Credentials Management
 *   ✓ CHANGE flows (authenticated)
 *     ✓ 1. Change PASSWORD (User wants to change his password)
 *     ✓ 2. Change EMAIL (User wants to change his email)
 *     ✓ 3. Change PHONE (User wants to change his phone number)
 *   ✓ FORGOT/RECOVERY flows (public)
 *     ✓ 4. Reset PASSWORD (User forgot password) → OTP flow
 *     ✓ 5. Recovery EMAIL (User forgot email) → Serial number device flow
 *
 * ------ CHANGE flows (authenticated) ------
 *
 * 🔄 1. CHANGE PASSWORD (utente autenticato vuole cambiare password)
 * STEP 1: Cambia password direttamente
 * └─> changePassword(oldPassword, newPassword)
 *     └─> Password aggiornata
 * Autenticazione richiesta: ✅ SI (authJwt)
 *
 * 📧 2. CHANGE EMAIL
 * STEP 1: Aggiorna email
 * └─> updateEmailUser(newEmail, languageId, appBrand)
 *     └─> Email aggiornata
 * Autenticazione richiesta: ✅ SI (authJwt)
 *
 * 📱 3. CHANGE PHONE
 * STEP 1: Richiedi OTP per il nuovo numero
 * └─> sendOtp(newPhone)
 *     └─> Ritorna: verificationId
 *
 * STEP 2: Utente riceve OTP via SMS
 *
 * STEP 3: Aggiorna phone con OTP
 * └─> updatePhoneNumberUser(newPhone, verificationId, otp)
 *     └─> Phone aggiornato
 * Autenticazione richiesta:
 *   STEP 1: ❌ NO (public)
 *   STEP 3: ✅ SI (authJwt)
 *
 * ------ FORGOT/RECOVERY flows (public) ------
 *
 * 🔐 4. RESET PASSWORD (utente ha dimenticato la password)
 * STEP 1: Richiedi OTP
 * └─> sendOtpForgotPassword(contact: email/phone)
 *     └─> Ritorna: verificationId
 *
 * STEP 2: Utente riceve OTP via email/SMS
 *
 * STEP 3: Cambia password
 * └─> changeForgotPassword(otp, verificationId, newPassword)
 *     └─> Password aggiornata
 * Autenticazione richiesta: ❌ NO (public endpoint)
 *
 * 🔍 5. RECOVER EMAIL (utente ha dimenticato la email)
 * STEP 1: Recupera email usando serial number del device
 * └─> forgotEmail(deviceSerialNumber, entityType: "PETLINK_GPS")
 *     └─> Email inviata all'indirizzo registrato
 * Autenticazione richiesta: ❌ NO (public endpoint)
 */
// describe("User Credentials Management", () => {
//   describe("CHANGE flows (authenticated)", () => {
//     let testUser: User;
//     const originalPassword = fixtureCurrentBrand.user.password;
//
//     beforeEach(async () => {
//       // Setup: Create new user for each test (isolated)
//       const setup = await testHelper.setupBuilder().withUser().build();
//       testUser = setup.user!;
//       // User is already authenticated ✅
//     });
//
//     it("Change PASSWORD (User wants to change his password)", async () => {
//       const newPassword = "NewPassword123!";
//
//       // Change password using old password
//       const response = await petlink.core.graphql.authJwt.changePassword({
//         oldPassword: originalPassword,
//         password: newPassword,
//       });
//
//       expect(response.changePassword.code, "Password change should succeed").toBe("200");
//
//       // Verify old password no longer works
//       petlink.clearAllCache();
//       await expect(petlink.loginWithEmail(testUser.email, originalPassword)).rejects.toThrow();
//
//       // Verify new password works
//       await petlink.loginWithEmail(testUser.email, newPassword);
//       const userCheck = await petlink.core.graphql.authJwt.getUser();
//       expect(userCheck.getUser.code, "Login with new password should succeed").toBe("200");
//     });
//
//     it("Change EMAIL (User wants to change his email)", async () => {
//       const newEmail = `new-email-${Date.now()}@example.com`;
//
//       // Update email
//       const response = await petlink.core.graphql.authJwt.updateEmailUser({
//         email: newEmail,
//         languageId: fixtureCurrentBrand.user.languageId,
//         appBrand: appBrand,
//       });
//
//       expect(response.updateEmailUser.code, "Email update should succeed").toBe("200");
//
//       // Verify email changed in user profile
//       const userCheck = await petlink.core.graphql.authJwt.getUser();
//       expect(userCheck.getUser.user?.email, "User email should be updated").toBe(newEmail);
//     });
//
//     it("Change PHONE (User wants to change his phone number)", async () => {
//       const newPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
//
//       // STEP 1: Request OTP for new phone
//       const otpResponse = await petlink.core.graphql.public.sendOtp({
//         phone: newPhone,
//         languageId: fixtureCurrentBrand.user.languageId,
//       });
//
//       expect(otpResponse.sendOtp.code, "OTP request should succeed").toBe("200");
//       expect(otpResponse.sendOtp.verificationId, "Should receive verificationId").toBeDefined();
//
//       // STEP 2: Get OTP from SMS (using Twilio client)
//       const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(fixtureCurrentBrand.user.phone), {
//         timeoutMs: pollingTimeoutMs,
//         intervalMs: pollingIntervalMs,
//         timeoutError: `OTP not received for ${fixtureCurrentBrand.user.phone}`,
//       });
//
//       // STEP 3: Update phone with OTP
//       const updateResponse = await petlink.core.graphql.authJwt.updatePhoneNumberUser({
//         phone: newPhone,
//         languageId: fixtureCurrentBrand.user.languageId,
//         verificationId: otpResponse.sendOtp.verificationId!,
//         otp: otp!,
//       });
//
//       expect(updateResponse.updatePhoneNumberUser.code, "Phone update should succeed").toBe("200");
//
//       // Verify phone changed in user profile
//       const userCheck = await petlink.core.graphql.authJwt.getUser();
//       expect(userCheck.getUser.user?.phone, "User phone should be updated").toBe(newPhone);
//     });
//   });
//
//   describe("FORGOT/RECOVERY flows (public)", () => {
//     beforeEach(async () => {
//       // Clear all cache to simulate non-authenticated user
//       await testHelper.cleanupAll();
//       petlink.clearAllCache();
//     });
//
//     it("Reset PASSWORD (User forgot password) → OTP flow", async () => {
//       const setup = await testHelper.setupBuilder().withUser().build();
//       // Logout (delete JWT) to simulate "forgot password" scenario
//       petlink.clearAllCache();
//
//       // STEP 1: Request OTP (sent to phone) for password reset
//       const otpResponse = await petlink.core.graphql.public.sendOtpForgotPassword({
//         contact: setup.user!.phone,
//         languageId: fixtureCurrentBrand.user.languageId,
//       });
//       logger.debug("changeForgotPassword() response", { otpResponse });
//
//       expect(otpResponse.sendOtpForgotPassword.code, "OTP send request should succeed").toBe("200");
//       expect(otpResponse.sendOtpForgotPassword.verificationId, "Should receive verificationId").toBeDefined();
//
//       // STEP 2: Get OTP from PHONE
//       const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(setup.user!.phone), {
//         timeoutMs: pollingTimeoutMs,
//         intervalMs: pollingIntervalMs,
//         timeoutError: `OTP not received for ${setup.user!.phone}`,
//       });
//       logger.debug("Received OTP", { otp });
//
//       // STEP 3: Change password using OTP
//       const newPassword = "ResetPassword123!";
//       const changeResponse = await petlink.core.graphql.public.changeForgotPassword({
//         otp: otp!,
//         verificationId: otpResponse.sendOtpForgotPassword.verificationId!,
//         password: newPassword,
//       });
//       logger.debug("changeForgotPassword() response", { changeResponse });
//
//       expect(changeResponse.changeForgotPassword.code, "Password reset should succeed").toBe("200");
//
//       // STEP 4: Verify new password works
//       let responseLoginWithNewPassword = await petlink.loginWithEmail(setup.user!.phone, newPassword);
//       const userCheck = await petlink.core.graphql.authJwt.getUser();
//       expect(userCheck.getUser.code, "Login with new password should succeed").toBe("200");
//     });
//
//     it("Recovery EMAIL (User forgot email) → Serial number device flow", async () => {
//       // Setup: Create user with device
//       const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();
//
//       const testUser = setup.user!;
//       const device = setup.devices.dogStandard!;
//
//       // Logout to simulate "forgot email" scenario
//       petlink.clearAllCache();
//
//       // STEP 1: Recover email using device serial number
//       const response = await petlink.core.graphql.public.forgotEmail({
//         productNumber: device.serialNumber,
//         entityType: "PETLINK_GPS",
//         languageId: fixtureCurrentBrand.user.languageId,
//       });
//
//       expect(response.forgotEmail?.code, "Email recovery request should succeed").toBe("200");
//
//       // Note: Email will be sent to the registered address
//       // User needs to check their mailbox to find which email received the message
//       logger.info("Email recovery requested", {
//         deviceSerial: device.serialNumber,
//         emailSentTo: testUser.email,
//       });
//     });
//   });
// });
