import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { fixtures } from "../../../fixtures/fixtures.js";
import type { UserIn } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { waitFor } from "../../../helpers/helper-waitfor.js";
import { twilioClient } from "../../../clients/twilio/client-twillio.js";
import { gmailClient } from "../../../clients/gmail/client-gmail.js";
import { testHelper } from "../../../clients/client-test-helper.js";

describe("User Registration", () => {
  const testUser = {
    phone: fixtures.user.phone,
    email: fixtures.user.email,
    password: fixtures.user.password,
    signUpPayload: {
      email: fixtures.user.email,
      name: fixtures.user.name,
      surname: fixtures.user.surname,
      city: fixtures.user.city,
      countryCode: fixtures.user.countryCode,
      zipCode: fixtures.user.zipCode,
      streetAddress: fixtures.user.streetAddress,
      phone: fixtures.user.phone,
      password: fixtures.user.password,
      confirmPassword: fixtures.user.confirmPassword,
      languageId: fixtures.user.languageId,
    } as UserIn,
  };

  // Variabili condivise tra i test
  let verificationId: string;
  let receivedOtp: string | null;
  let verificationLink: string | null;

  it("Verify phone number availability", async () => {
    const response = await petlink.core.graphql.public.checkContact({
      contact: testUser.phone,
      contactType: "PHONE",
    });

    expect(response.checkContact.code).toBe("200");
  });

  it("Send OTP to phone", async () => {
    const response = await petlink.core.graphql.public.sendOtp({
      phone: testUser.phone,
      languageId: testUser.signUpPayload.languageId,
    });

    expect(response.sendOtp.verificationId).toBeDefined();

    // Salva il verificationId per i test successivi
    verificationId = response.sendOtp.verificationId as string;
  });

  it("Wait to receive OTP via SMS", async () => {
    const otp = await waitFor(() => twilioClient.getLatestOtp(testUser.phone), {
      timeoutMs: 60000,
      intervalMs: 500,
      timeoutError: `OTP not received for ${testUser.phone}`,
    });

    expect(otp).toMatch(/^\d{4,6}$/);
    receivedOtp = otp;
  }, 70000);

  it("Verify phone number (sending received OTP)", async () => {
    const response = await petlink.core.graphql.public.checkOtp({
      verificationId,
      otp: receivedOtp!,
      contact: testUser.phone,
    });

    expect(response.checkOtp.code).toBe("200");
  });

  it("Register User", async () => {
    const response = await petlink.core.graphql.public.signUpUser({
      user: testUser.signUpPayload,
      otpData: {
        otp: receivedOtp!,
        verificationId,
      },
      appBrand: fixtures.appBrand,
    });

    expect(response.signUpUser.code).toBe("200");
  });

  it("Try login new user (with PHONE)", async () => {
    await petlink.loginWithPhone(testUser.phone, testUser.password);
    const userResponse = await petlink.core.graphql.authJwt.getUser();

    expect(userResponse.getUser.user?.phone).toBe(testUser.phone);
    expect(userResponse.getUser.user?.contactVerified?.phone).toBe(true);
  });

  it("Wait to receive CONFIRMATION EMAIL", async () => {
    const linkUrlToOpen = await waitFor(
      () => gmailClient.getVerificationLink(),
      {
        timeoutMs: 60000,
        intervalMs: 500,
        timeoutError: "Verification email not received",
      },
    );

    expect(linkUrlToOpen).toBeDefined();
    expect(linkUrlToOpen).toContain("uuid=");
    expect(linkUrlToOpen).toContain("otp=");
    expect(linkUrlToOpen).toContain("verificationId=");

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
    expect(response.verifyEmail).toBeDefined();
    expect(response.verifyEmail!.code).toBe("200");
  });

  it("Try login new user (with EMAIL)", async () => {
    await petlink.loginWithEmail(testUser.email, testUser.password);
    const user = await petlink.core.graphql.authJwt.getUser();

    expect(user.getUser.user).toBeDefined();
    expect(user.getUser.user?.email).toBe(testUser.email);
    expect(user.getUser.user?.phone).toBe(testUser.phone);
    expect(user.getUser.user?.contactVerified?.phone).toBe(true);
    expect(user.getUser.user?.contactVerified?.email).toBe(true);
  });

  it("Verify contacts (Phone & Email) are no longer available", async () => {
    const [phoneCheck, emailCheck] = await Promise.all([
      petlink.core.graphql.public.checkContact({
        contact: testUser.phone,
        contactType: "PHONE",
      }),
      petlink.core.graphql.public.checkContact({
        contact: testUser.email,
        contactType: "EMAIL",
      }),
    ]);

    expect(phoneCheck.checkContact.code).toBe("400");
    expect(emailCheck.checkContact.code).toBe("400");
  });
});
