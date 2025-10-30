import { User } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { fxt } from "../../../fixtures/fixtures.js";
import { testHelper } from "../../../clients/client-test-helper.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { beforeEach, describe, expect, it } from "vitest";
import { twilioClient } from "../../../clients/twilio/client-twillio.js";
import { waitFor } from "../../../helpers/helpers.js";
import { logger } from "../../../config/logger.js";

describe("User Credentials Management", () => {
  describe("CHANGE credentials (intentional -> authenticated)", () => {
    let testUser: User;
    const originalPassword = fxt.current.user.password;

    beforeEach(async () => {
      const setup = await testHelper.setupBuilder().withUser().build();
      testUser = setup.user!;
      // User is already authenticated ✅
    });

    it("Change PASSWORD (User wants to change his password)", async () => {
      const newPassword = "NewPassword123!";

      // Change password using old password
      const response = await petlink.core.graphql.authJwt.changePassword({
        oldPassword: originalPassword,
        password: newPassword,
      });

      expect(
        response.changePassword.code,
        `changePassword should succeed - Error: ${response.changePassword.message}${response.changePassword.translationCode ? ` (${response.changePassword.translationCode})` : ""}`,
      ).toBe("200");

      // Verify old password no longer works
      await expect(petlink.loginWithEmail(testUser.email, originalPassword)).rejects.toThrow("Incorrect username or password.");

      // Verify new password works
      petlink.clearAllCache();
      await petlink.loginWithEmail(testUser.email, newPassword);
      const userCheck = await petlink.core.graphql.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `getUser should succeed - Error: ${userCheck.getUser.message}${userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""}`,
      ).toBe("200");
    });

    it("Change EMAIL (User wants to change his email)", async () => {
      const newEmail = `new-email-${Date.now()}@example.com`;

      // Update email
      const response = await petlink.core.graphql.authJwt.updateEmailUser({
        email: newEmail,
        languageId: fxt.current.user.languageId,
        appBrand: fxt.current.appBrand,
      });

      expect(
        response.updateEmailUser.code,
        `updateEmailUser should succeed - Error: ${response.updateEmailUser.message}${response.updateEmailUser.translationCode ? ` (${response.updateEmailUser.translationCode})` : ""}`,
      ).toBe("200");

      // Verify email changed in user profile
      const userCheck = await petlink.core.graphql.authJwt.getUser();
      expect(userCheck.getUser.user?.email, "User email should be updated").toBe(newEmail);
    });

    it("Change PHONE (User wants to change his phone number)", async () => {
      const newPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;

      // STEP 1: Request OTP for new phone
      const otpResponse = await petlink.core.graphql.public.sendOtp({
        phone: newPhone,
        languageId: fxt.current.user.languageId,
      });

      expect(
        otpResponse.sendOtp.code,
        `sendOtp should succeed - Error: ${otpResponse.sendOtp.message}${otpResponse.sendOtp.translationCode ? ` (${otpResponse.sendOtp.translationCode})` : ""}`,
      ).toBe("200");
      expect(otpResponse.sendOtp.verificationId, "Should receive verificationId").toBeDefined();

      // STEP 2: Get OTP from SMS (using Twilio client)
      const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(newPhone), {
        timeoutMs: fxt.polling.timeoutMs,
        intervalMs: fxt.polling.intervalMs,
        timeoutError: `OTP not received for ${newPhone}`,
      });

      // STEP 3: Update phone with OTP
      const updateResponse = await petlink.core.graphql.authJwt.updatePhoneNumberUser({
        phone: newPhone,
        languageId: fxt.current.user.languageId,
        verificationId: otpResponse.sendOtp.verificationId!,
        otp: otp!,
      });

      expect(
        updateResponse.updatePhoneNumberUser.code,
        `updatePhoneNumberUser should succeed - Error: ${updateResponse.updatePhoneNumberUser.message}${updateResponse.updatePhoneNumberUser.translationCode ? ` (${updateResponse.updatePhoneNumberUser.translationCode})` : ""}`,
      ).toBe("200");

      // Verify phone changed in user profile
      const userCheck = await petlink.core.graphql.authJwt.getUser();
      expect(userCheck.getUser.user?.phone, "User phone should be updated").toBe(newPhone);
    });
  });

  describe("RECOVERY credentials (forgot -> public)", () => {
    beforeEach(async () => {
      // Clear all cache to simulate non-authenticated user
      await testHelper.cleanupAll();
      petlink.clearAllCache();
    });

    it("Reset PASSWORD (User forgot password) → OTP flow", async () => {
      const setup = await testHelper.setupBuilder().withUser().build();
      // Logout (delete JWT) to simulate "forgot password" scenario
      petlink.clearAllCache();

      // STEP 1: Request OTP (sent to phone) for password reset
      const otpResponse = await petlink.core.graphql.public.sendOtpForgotPassword({
        contact: setup.user!.phone,
        languageId: fxt.current.user.languageId,
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

      // STEP 3: Change password using OTP
      const newPassword = "ResetPassword123!";
      const changeResponse = await petlink.core.graphql.public.changeForgotPassword({
        otp: otp!,
        verificationId: otpResponse.sendOtpForgotPassword.verificationId!,
        password: newPassword,
      });
      logger.debug("changeForgotPassword() response", { changeResponse });

      expect(
        changeResponse.changeForgotPassword.code,
        `changeForgotPassword should succeed - Error: ${changeResponse.changeForgotPassword.message}${changeResponse.changeForgotPassword.translationCode ? ` (${changeResponse.changeForgotPassword.translationCode})` : ""}`,
      ).toBe("200");

      // STEP 4: Verify new password works
      await petlink.loginWithEmail(setup.user!.phone, newPassword);
      const userCheck = await petlink.core.graphql.authJwt.getUser();
      expect(
        userCheck.getUser.code,
        `getUser should succeed - Error: ${userCheck.getUser.message}${userCheck.getUser.translationCode ? ` (${userCheck.getUser.translationCode})` : ""}`,
      ).toBe("200");
    });

    it("Recovery EMAIL (User forgot email) → Serial number device flow", async () => {
      // Setup: Create user with device
      const setup = await testHelper.setupBuilder().withUser().withDog().withDogDevice().build();

      const testUser = setup.user!;
      const device = setup.devices.dogStandard!;

      // Logout to simulate "forgot email" scenario
      petlink.clearAllCache();

      // STEP 1: Recover email using device serial number
      const response = await petlink.core.graphql.public.forgotEmail({
        productNumber: device.serialNumber,
        entityType: "PETLINK_GPS",
        languageId: fxt.current.user.languageId,
      });

      expect(
        response.forgotEmail?.code,
        `forgotEmail should succeed - Error: ${response.forgotEmail?.message}${response.forgotEmail?.translationCode ? ` (${response.forgotEmail?.translationCode})` : ""}`,
      ).toBe("200");

      // Note: Email will be sent to the registered address
      // User needs to check their mailbox to find which email received the message
      logger.info("Email recovery requested", {
        deviceSerial: device.serialNumber,
        emailSentTo: testUser.email,
      });
    });
  });
});
