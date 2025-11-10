import { describe, expect, it } from "vitest";
import { fxt } from "../../../fixtures/fixtures.js";
import { ContactType, PetIn, UserIn } from "../../../clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.js";
import { petlink } from "../../../clients/petlink-infrastructure/client-petlink-infrastructure.js";
import { extractParamsFromUrl, waitFor } from "../../../helpers/helpers.js";
import { twilioClient } from "../../../clients/twilio/client-twillio.js";
import { gmailClient } from "../../../clients/gmail/client-gmail.js";

describe("User Registration", () => {
  // Payload per la registrazione utente
  const signUpPayload = {
    email: fxt.current.user.email,
    name: fxt.current.user.name,
    surname: fxt.current.user.surname,
    city: fxt.current.user.city,
    countryCode: fxt.current.user.countryCode,
    zipCode: fxt.current.user.zipCode,
    streetAddress: fxt.current.user.streetAddress,
    phone: fxt.current.user.phone,
    password: fxt.current.user.password,
    confirmPassword: fxt.current.user.confirmPassword,
    languageId: fxt.current.user.languageId,
  } as UserIn;

  // Variabili condivise tra i test
  let verificationId: string;
  let receivedOtp: string | null;
  let verificationLink: string | null;
  let userId: string;

  it("Verify phone number availability", async () => {
    const response = await petlink.core.graphqlHttp.public.checkContact({
      contact: signUpPayload.phone,
      contactType: ContactType.Phone,
    });

    expect(
      response.checkContact.code,
      `checkContact should succeed - Error: ${response.checkContact.message}${response.checkContact.translationCode ? ` (${response.checkContact.translationCode})` : ""}`,
    ).toBe("200");
  });

  it("Send OTP to phone", async () => {
    const response = await petlink.core.graphqlHttp.public.sendOtp({
      phone: signUpPayload.phone,
      languageId: signUpPayload.languageId,
    });

    expect(response.sendOtp.verificationId, "VerificationId should be returned after sending OTP").toBeDefined();

    // Salva il verificationId per i test successivi
    verificationId = response.sendOtp.verificationId as string;
  });

  it("Wait to receive OTP via SMS", async () => {
    const otp = await waitFor(() => twilioClient.getOtpFromReceivedSms(signUpPayload.phone), {
      timeoutMs: fxt.polling.timeoutMs,
      intervalMs: fxt.polling.intervalMs,
      timeoutError: `OTP not received for ${signUpPayload.phone}`,
    });

    expect(otp, "OTP should match 4-6 digit pattern").toMatch(/^\d{4,6}$/);
    receivedOtp = otp;
  }, 70000);

  it("Verify phone number (sending received OTP)", async () => {
    const response = await petlink.core.graphqlHttp.public.checkOtp({
      verificationId,
      otp: receivedOtp!,
      contact: signUpPayload.phone,
    });

    expect(
      response.checkOtp.code,
      `checkOtp should succeed - Error: ${response.checkOtp.message}${response.checkOtp.translationCode ? ` (${response.checkOtp.translationCode})` : ""}`,
    ).toBe("200");
  });

  it("Register User", async () => {
    const response = await petlink.core.graphqlHttp.public.signUpUser({
      user: signUpPayload,
      otpData: {
        otp: receivedOtp!,
        verificationId,
      },
      appBrand: fxt.current.appBrand,
    });

    expect(
      response.signUpUser.code,
      `signUpUser should succeed - Error: ${response.signUpUser.message}${response.signUpUser.translationCode ? ` (${response.signUpUser.translationCode})` : ""}`,
    ).toBe("200");
  });

  it("Try login new user (with PHONE)", async () => {
    await petlink.loginWithPhone(signUpPayload.phone, signUpPayload.password);
    const userResponse = await petlink.core.graphqlHttp.authJwt.getUser();

    expect(userResponse.getUser.user?.phone, "Logged in user phone should match signup payload").toBe(signUpPayload.phone);
    expect(userResponse.getUser.user?.contactVerified?.phone, "Phone should be verified after OTP confirmation").toBe(true);
    expect(userResponse.getUser.user?.contactVerified?.email, "Email should not be verified yet").toBe(false);
    userId = userResponse.getUser.user!.id;
  });

  it("Wait to receive CONFIRMATION EMAIL", async () => {
    const linkUrlToOpen = await waitFor(() => gmailClient.getVerificationLink(), {
      timeoutMs: fxt.polling.timeoutMs,
      intervalMs: fxt.polling.intervalMs,
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
    const params = extractParamsFromUrl(verificationLink!);

    const response = await petlink.core.graphqlHttp.public.verifyEmail({
      uuid: params.uuid!,
      otp: params.otp!,
      verificationId: params.verificationId!,
    });
    expect(response.verifyEmail, "Email verification response should be defined").toBeDefined();
    expect(
      response.verifyEmail!.code,
      `verifyEmail should succeed - Error: ${response.verifyEmail!.message}${response.verifyEmail!.translationCode ? ` (${response.verifyEmail!.translationCode})` : ""}`,
    ).toBe("200");
  });

  it("Try login new user (with EMAIL)", async () => {
    await petlink.loginWithEmail(signUpPayload.email, signUpPayload.password);
    const user = await petlink.core.graphqlHttp.authJwt.getUser();

    expect(user.getUser.user, "User should be defined after login with email").toBeDefined();
    expect(user.getUser.user?.email, "Logged in user email should match signup payload").toBe(signUpPayload.email);
    expect(user.getUser.user?.phone, "Logged in user phone should match signup payload").toBe(signUpPayload.phone);
    expect(user.getUser.user?.contactVerified?.phone, "Phone should remain verified").toBe(true);
    expect(user.getUser.user?.contactVerified?.email, "Email should now be verified").toBe(true);
  });

  it("Verify user created has all value equals to input payload", async () => {
    const userResponse = await petlink.core.graphqlHttp.authJwt.getUser();
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
      petlink.core.graphqlHttp.public.checkContact({
        contact: signUpPayload.phone,
        contactType: ContactType.Phone,
      }),
      petlink.core.graphqlHttp.public.checkContact({
        contact: signUpPayload.email,
        contactType: ContactType.Email,
      }),
    ]);

    expect(
      phoneCheck.checkContact.code,
      `checkContact should fail - phone no longer available - Error: ${phoneCheck.checkContact.message}${phoneCheck.checkContact.translationCode ? ` (${phoneCheck.checkContact.translationCode})` : ""}`,
    ).toBe("400");
    expect(
      emailCheck.checkContact.code,
      `checkContact should fail - email no longer available - Error: ${emailCheck.checkContact.message}${emailCheck.checkContact.translationCode ? ` (${emailCheck.checkContact.translationCode})` : ""}`,
    ).toBe("400");
  });

  it("Delete User", async () => {
    await petlink.loginWithPhone(signUpPayload.phone, signUpPayload.password);
    //associo Pet a user
    const catPayload = {
      name: fxt.current.pet.defaultCat.name,
      species: fxt.current.pet.defaultCat.species,
      breedType: fxt.current.pet.defaultCat.breedType,
      breeds: fxt.current.pet.defaultCat.breeds,
      gender: fxt.current.pet.defaultCat.gender,
      weight: fxt.current.pet.defaultCat.weight,
      birthDate: fxt.current.pet.defaultCat.birthDate,
      livingEnvironment: fxt.current.pet.defaultCat.livingEnvironment,
      primaryColor: fxt.current.pet.defaultCat.primaryColor,
    } as PetIn;
    let createCatResponse = await petlink.core.graphqlHttp.authJwt.createPet({ pet: catPayload });
    //delete user should not be possibile where has pet associated
    let deleteUserResponse = await petlink.core.graphqlHttp.authJwt.deleteUser({ id: userId });
    //FIXME: now deleteUser pass also with pet associated because check is on app and not on backend api, when added cehck on backend api this test should test also not.tobe 200
    expect(
      deleteUserResponse.deleteUser.code,
      `deleteUser should fail - Error: ${deleteUserResponse.deleteUser.message}${deleteUserResponse.deleteUser.translationCode ? ` (${deleteUserResponse.deleteUser.translationCode})` : ""}`,
    ).not.toBe("200");

    await petlink.core.graphqlHttp.authJwt.deletePet({ petId: createCatResponse.createPet.pet!.id });
    deleteUserResponse = await petlink.core.graphqlHttp.authJwt.deleteUser({ id: userId });
    expect(
      deleteUserResponse.deleteUser.code,
      `deleteUser should succeed - Error: ${deleteUserResponse.deleteUser.message}${deleteUserResponse.deleteUser.translationCode ? ` (${deleteUserResponse.deleteUser.translationCode})` : ""}`,
    ).toBe("200");
  });
});
