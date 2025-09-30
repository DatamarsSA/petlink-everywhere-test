import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { gmailClient } from "../../clients/gmail/client-gmail.js";
import { globalState } from "../../test-utils/global-state/state-global-flow.js";
import { fixtures } from "../../test-utils/fixtures/fixture-user-pet-device.js";

describe("User Registration", () => {
  const userData = fixtures.user.default;
  const userPhoneNumber = userData.phoneNumber;
  const userEmail = userData.email;
  const userPassword = userData.password;

  // Variabili condivise tra i test
  let verificationId: string;
  let receivedOtp: string;

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
    const otp = await twilioClient.waitForOtp(
      userPhoneNumber,
      60000, // 60s timeout
      5000, // 5s retry interval
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
    const user = await petlink.core.authJwt.getUser();

    expect(user.getUser.user).toBeDefined();
    expect(user.getUser.user?.phone).toBe(userPhoneNumber);
    expect(user.getUser.user?.contactVerified?.phone).toBe(true);
  });

  it("Verify Email (by clicking on received link)", async () => {
    const linkUrlToOpen = await gmailClient.waitForVerificationEmail();

    const extractParamsFromUrl = (url: string) => {
      const urlObj = new URL(url);
      const uuid = urlObj.searchParams.get("uuid");
      const otp = urlObj.searchParams.get("otp");
      const verificationId = urlObj.searchParams.get("verificationId");
      return { uuid, otp, verificationId };
    };

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
  }, 60000); // Timeout più lungo per l'attesa dell'email

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
    // await globalState.cleanupAll();
  });
});

describe("", () => {
  beforeAll(async () => {
    // await globalState.cleanupAll();
  });

  it("should", async () => {
    let a = 4;
    expect(a).toBe(5);
  });

  afterAll(async () => {
    // await globalState.cleanupAll();
  });
});
