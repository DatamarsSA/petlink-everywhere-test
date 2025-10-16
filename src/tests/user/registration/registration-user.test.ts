import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { fixtureCurrentBrand, appBrand } from "../../../fixtures/fixtures.js";
import type { UserIn } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { waitFor } from "../../../helpers/helper-waitfor.js";
import { twilioClient } from "../../../clients/twilio/client-twillio.js";
import { gmailClient } from "../../../clients/gmail/client-gmail.js";
import { testHelper } from "../../../clients/client-test-helper.js";

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
    const otp = await waitFor(() => twilioClient.getLatestOtp(signUpPayload.phone), {
      timeoutMs: 10000,
      intervalMs: 500,
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
      timeoutMs: 10000,
      intervalMs: 500,
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
