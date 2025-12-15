import { LanguageId, ProductTypeEnum, User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { testHelper } from "../../../clients/client-test-helper.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { beforeEach, describe, expect, it } from "vitest";
import { twilioClient } from "../../../clients/twilio/client-twillio.js";
import { extractParamsFromUrl, waitFor } from "../../../helpers/helpers.js";
import { logger } from "../../../config/logger.js";
import { gmailClient } from "../../../clients/gmail/client-gmail.js";

describe("User Profile Management", () => {
  describe("CHANGE profile info (intentional -> authenticated)", () => {
    let testUser: User;
    const initialEmail = `initial-email@example.com`;
    const initialPhone = `+15555234567`;
    const originalPassword = fxt.current.user.password;

    beforeEach(async () => {
      await testHelper.cleanUpUser(initialPhone);
      const setup = await testHelper
        .setupBuilder()
        .withUser({
          email: initialEmail,
          phone: initialPhone,
          password: originalPassword,
        })
        .build();
      testUser = setup.user!;
    });

    it("Change PROFILE info (all fields of user)", async () => {
      // Definisci i dati in base al brand (Kippy = Europa, Petlink = USA)
      const europeanData = {
        city: "Roma",
        countryCode: "IT",
        zipCode: "00100",
        streetAddress: "Via Veneto 50",
        languageId: LanguageId.It,
      };

      const americanData = {
        city: "Los Angeles",
        countryCode: "US",
        zipCode: "90001",
        streetAddress: "Sunset Boulevard 200",
        languageId: LanguageId.En,
      };

      // Scegli i dati in base al brand
      const locationData = fxt.isKippyRun ? europeanData : americanData;

      const updatedProfileData = {
        id: testUser.id,
        name: "Mario",
        surname: "Rossi",
        ...locationData,
      };

      // STEP 1: Update user profile (all fields at once)
      const updateResponse = await petlink.core.graphqlHttp.authJwt.updateUser({ user: updatedProfileData });

      expect(
        updateResponse.updateUser.code,
        `updateUser should succeed - Error: ${updateResponse.updateUser.message}${
          updateResponse.updateUser.translationCode ? ` (${updateResponse.updateUser.translationCode})` : ""
        }`,
      ).toBe("200");

      // STEP 2: Verify all profile data was updated correctly
      const userCheck = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `getUser should succeed - Error: ${userCheck.getUser.message}${
          userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""
        }`,
      ).toBe("200");

      expect(userCheck.getUser.user, "User profile should be updated").toMatchObject({
        name: updatedProfileData.name,
        surname: updatedProfileData.surname,
        city: updatedProfileData.city,
        countryCode: updatedProfileData.countryCode,
        zipCode: updatedProfileData.zipCode,
        streetAddress: updatedProfileData.streetAddress,
        languageId: updatedProfileData.languageId,
      });
    });

    it("Change TIMEZONE", async () => {
      // Define the user data with timezone change
      const updatedUserWithTimezone = {
        id: testUser.id,
        name: testUser.name,
        surname: testUser.surname,
        city: testUser.city!,
        countryCode: testUser.countryCode,
        languageId: testUser.languageId,
        timezone: "America/Mexico_City",
        zipCode: testUser.zipCode!,
        streetAddress: testUser.streetAddress!,
      };

      // STEP 1: Update user with timezone
      const updateResponse = await petlink.core.graphqlHttp.authJwt.updateUser({ user: updatedUserWithTimezone });

      expect(
        updateResponse.updateUser.code,
        `updateUser should succeed - Error: ${updateResponse.updateUser.message}${
          updateResponse.updateUser.translationCode ? ` (${updateResponse.updateUser.translationCode})` : ""
        }`,
      ).toBe("200");

      // STEP 2: Verify timezone was updated
      const userCheck = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `getUser should succeed - Error: ${userCheck.getUser.message}${
          userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""
        }`,
      ).toBe("200");

      expect(userCheck.getUser.user?.timezone, "User timezone should be updated").toBe("America/Mexico_City");

      // Also verify other fields were preserved/updated
      expect(userCheck.getUser.user, "User profile should be updated with timezone").toMatchObject({
        id: updatedUserWithTimezone.id,
        name: updatedUserWithTimezone.name,
        surname: updatedUserWithTimezone.surname,
        city: updatedUserWithTimezone.city!,
        countryCode: updatedUserWithTimezone.countryCode,
        languageId: updatedUserWithTimezone.languageId,
        timezone: updatedUserWithTimezone.timezone,
        zipCode: updatedUserWithTimezone.zipCode!,
        streetAddress: updatedUserWithTimezone.streetAddress!,
      });
    });

    ///-------------- change credentials --------------

    it("Change EMAIL", async () => {
      const newEmail = fxt.current.user.email;

      // STEP 1: Update email (this marks it as unverified)
      const updateResponse = await petlink.core.graphqlHttp.authJwt.updateEmailUser({
        email: newEmail,
        languageId: fxt.current.user.languageId,
        appBrand: fxt.current.appBrand,
      });

      expect(
        updateResponse.updateEmailUser.code,
        `updateEmailUser should succeed - Error: ${updateResponse.updateEmailUser.message}${
          updateResponse.updateEmailUser.translationCode ? ` (${updateResponse.updateEmailUser.translationCode})` : ""
        }`,
      ).toBe("200");
      const checkUserUpdated = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(checkUserUpdated.getUser.user?.email, "User email should be updated").toBe(newEmail);

      // Verify login with old email doesn't works anymore
      await expect(petlink.loginWithEmail(initialEmail, originalPassword)).rejects.toThrow();

      // verify new email
      const linkUrlToOpen = await waitFor(() => gmailClient.getVerificationLink(), {
        timeoutMs: fxt.polling.timeoutMs,
        intervalMs: fxt.polling.intervalMs,
        timeoutError: "Verification email not received",
      });
      const params = extractParamsFromUrl(linkUrlToOpen!);
      await petlink.core.graphqlHttp.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });

      // Try login with new email
      petlink.logoutUser();
      await petlink.loginWithEmail(newEmail, originalPassword);
      const userCheck = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `Requests logged with new email should works - Error: ${userCheck.getUser.message}${
          userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""
        }`,
      );
    });

    it("Change PHONE NUMBER", async () => {
      const newPhone = fxt.current.user.phone; // Use the checkable fixture phone

      // STEP 1: Request OTP for new phone
      const otpResponse = await petlink.core.graphqlHttp.public.sendOtp({
        phone: newPhone,
        languageId: fxt.current.user.languageId,
      });

      expect(
        otpResponse.sendOtp.code,
        `sendOtp should succeed - Error: ${otpResponse.sendOtp.message}${otpResponse.sendOtp.translationCode ? ` (${otpResponse.sendOtp.translationCode})` : ""}`,
      ).toBe("200");
      expect(otpResponse.sendOtp.verificationId, "VerificationId should be returned after sending OTP").toBeDefined();

      // STEP 2: Get OTP from SMS (using Twilio client)
      const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(newPhone), {
        timeoutMs: fxt.polling.timeoutMs,
        intervalMs: fxt.polling.intervalMs,
        timeoutError: `OTP not received for ${newPhone}`,
      });

      // STEP 3: Verify OTP phone number (sending received OTP)
      await petlink.core.graphqlHttp.public.checkOtp({
        verificationId: otpResponse.sendOtp.verificationId!,
        otp: otp!,
        contact: newPhone,
      });

      // STEP 4: Update phone with OTP
      const updateResponse = await petlink.core.graphqlHttp.authJwt.updatePhoneNumberUser({
        phone: newPhone,
        languageId: fxt.current.user.languageId,
        verificationId: otpResponse.sendOtp.verificationId!,
        otp: otp!,
      });

      expect(
        updateResponse.updatePhoneNumberUser.code,
        `updatePhoneNumberUser should succeed - Error: ${updateResponse.updatePhoneNumberUser.message}${updateResponse.updatePhoneNumberUser.translationCode ? ` (${updateResponse.updatePhoneNumberUser.translationCode})` : ""}`,
      ).toBe("200");

      // STEP 5: Verify login with new password works
      petlink.logoutUser();
      await petlink.loginWithPhone(newPhone, fxt.current.user.password);
      const userCheck = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `Requests login with new phoneNumber should works - Error: ${userCheck.getUser.message}${userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""}`,
      ).toBe("200");
      // Verify phone changed in user profile
      expect(userCheck.getUser.user?.phone, "User phone should be updated").toBe(newPhone);
      await testHelper.cleanUpUser(newPhone);
    });

    it("Change PASSWORD", async () => {
      const newPassword = "NewPassword123!";

      // Change password using old password
      const response = await petlink.core.graphqlHttp.authJwt.changePassword({
        oldPassword: originalPassword,
        password: newPassword,
      });

      expect(
        response.changePassword.code,
        `changePassword should succeed - Error: ${response.changePassword.message}${
          response.changePassword.translationCode ? ` (${response.changePassword.translationCode})` : ""
        }`,
      ).toBe("200");

      // Verify old password no longer works
      await expect(petlink.loginWithEmail(testUser.email, originalPassword)).rejects.toThrow("Incorrect username or password.");

      // Verify new password works
      await petlink.loginWithEmail(testUser.email, newPassword);
      const userCheck = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `getUser should succeed - Error: ${userCheck.getUser.message}${userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""}`,
      ).toBe("200");
    });
  });

  describe("RECOVERY credentials (forgot -> public)", () => {
    beforeEach(async () => {
      await testHelper.cleanupAll();
    });

    it("Reset PASSWORD (User forgot password) → OTP flow", async () => {
      const setup = await testHelper.setupBuilder().withUser().build();

      // STEP 1: Request OTP (sent to phone) for password reset
      const otpResponse = await petlink.core.graphqlHttp.public.sendOtpForgotPassword({
        contact: setup.user!.phone,
        languageId: fxt.current.user.languageId,
        appBrand: fxt.current.appBrand,
      });
      logger.debug("changeForgotPassword() response", { otpResponse });

      expect(
        otpResponse.sendOtpForgotPassword.code,
        `sendOtpForgotPassword should succeed - Error: ${otpResponse.sendOtpForgotPassword.message}${otpResponse.sendOtpForgotPassword.translationCode ? ` (${otpResponse.sendOtpForgotPassword.translationCode})` : ""}`,
      ).toBe("200");
      expect(otpResponse.sendOtpForgotPassword.verificationId, "Should receive verificationId").toBeDefined();

      // STEP 2: Get OTP from PHONE
      const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(setup.user!.phone), {
        timeoutMs: fxt.polling.timeoutMs,
        intervalMs: fxt.polling.intervalMs,
        timeoutError: `OTP not received for ${setup.user!.phone}`,
      });
      logger.debug("Received OTP", { otp });

      // STEP 3: Verify OTP
      await petlink.core.graphqlHttp.public.checkOtp({
        verificationId: otpResponse.sendOtpForgotPassword.verificationId!,
        otp: otp!,
        contact: setup.user!.phone,
      });

      // STEP 4: Change password using OTP
      const newPassword = "ResetPassword123!";
      const changeResponse = await petlink.core.graphqlHttp.public.changeForgotPassword({
        otp: otp!,
        verificationId: otpResponse.sendOtpForgotPassword.verificationId!,
        password: newPassword,
      });
      logger.debug("changeForgotPassword() response", { changeResponse });

      expect(
        changeResponse.changeForgotPassword.code,
        `changeForgotPassword should succeed - Error: ${changeResponse.changeForgotPassword.message}${changeResponse.changeForgotPassword.translationCode ? ` (${changeResponse.changeForgotPassword.translationCode})` : ""}`,
      ).toBe("200");

      // STEP 5: Verify new password works
      petlink.logoutUser();
      await petlink.loginWithPhone(setup.user!.phone, newPassword);
      const userCheck = await petlink.core.graphqlHttp.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `Requests logge with new password should works - Error: ${userCheck.getUser.message}${userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""}`,
      ).toBe("200");
    });
  });
});
