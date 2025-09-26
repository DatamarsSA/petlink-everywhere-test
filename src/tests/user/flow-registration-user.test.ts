import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { env } from "../../config/env-schema-validation.js";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { step } from "../../shared/utils.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";

describe("Claude - User Registration Flow", () => {
  const userPhoneNumber = env.USER_PHONE_NUMBER;
  const userEmail = env.USER_EMAIL;
  const userPassword = env.USER_PASSWORD;

  beforeAll(async () => {
    const deletedCount =
      await twilioClient.deleteAllMessagesSentoToNumber(userPhoneNumber);
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
    await step("Verify login with new user (with PHONE)", async () => {
      await petlink.loginWithPhone(userPhoneNumber, userPassword);
      const user = await petlink.core.authJwt.getUser();
      expect(user.getUser.user).toBeDefined();
      expect(user.getUser.user?.email).toBe(userEmail);
      expect(user.getUser.user?.phone).toBe(userPhoneNumber);
      expect(user.getUser.user?.contactVerified?.phone).toBe(true);
      expect(user.getUser.user?.contactVerified?.email).toBe(false);
      return user;
    });

    await step("Verify Email", async () => {
      const link = await gmailClient.waitForVerificationEmail();
      const extractParamsFromUrl = (url: string) => {
        const urlObj = new URL(url);
        const uuid = urlObj.searchParams.get("uuid");
        const otp = urlObj.searchParams.get("otp");
        const verificationId = urlObj.searchParams.get("verificationId");
        return { uuid, otp, verificationId };
      };
      const params = extractParamsFromUrl(link!);
      await petlink.core.public.verifyEmail({
        uuid: params.uuid!,
        otp: params.otp!,
        verificationId: params.verificationId!,
      });
      const user = await petlink.core.authJwt.getUser();
      expect(user.getUser.user).toBeDefined();
      expect(user.getUser.user?.email).toBe(userEmail);
      expect(user.getUser.user?.phone).toBe(userPhoneNumber);
      expect(user.getUser.user?.contactVerified?.phone).toBe(true);
      expect(user.getUser.user?.contactVerified?.email).toBe(true);
      return user;
    });

    await step("Verify login with new user (with EMAIL)", () => {
      //todo: login with Email
    });

    // Step 7: Delete user
    await step("Delete user after tests", async () => {
      const user = await petlink.core.authJwt.getUser();
      petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
      const deletedUser = await petlink.core.authIam.utilityIntegrationTest({
        input: {
          userId: user.getUser.user!.id,
          utilityType: "CLEAN_UP_USER", //todo: put CLEAN_UP_USER and other actions in enum
        },
      });
      expect(deletedUser).toBeDefined();
      expect(deletedUser.utilityIntegrationTest.code).toBe("200");

      const checkUserDeleted = await petlink.core.authJwt.getUser();
      expect(checkUserDeleted.getUser.code).toBe("401");
      expect(checkUserDeleted.getUser.user).toBeNull();
    });
  }, 120000);
});
