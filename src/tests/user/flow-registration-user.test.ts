import { describe, it, expect, beforeAll } from "vitest";
import { env } from "../../config/env-schema-validation.js";
import { twilioClient } from "../../clients/twilio/client-twillio.js";
import { petlink } from "../../clients/petlink-infrastructure/client-petlink-infrastructure.js";

describe("User Registration Flow", () => {
  const myPhoneNumber = env.TWILIO_TEST_PHONE_NUMBER;
  const testEmail = `test-${Date.now()}@example.com`; // Email unico per ogni esecuzione

  // Pulizia messaggi prima di tutti i test
  beforeAll(async () => {
    console.log(
      "\n🧹 PULIZIA INIZIALE: Elimino tutti i messaggi precedenti...",
    );
    const deletedCount =
      await twilioClient.deleteAllMessagesSentoToNumber(myPhoneNumber);
    console.log(`🧹 PULIZIA COMPLETATA: ${deletedCount} messaggi eliminati`);
  });

  it("Should complete full registration flow", async () => {
    console.log("\n🎯 TEST: Flusso completo registrazione utente...");

    // STEP 1: Verifica che il numero di telefono non sia già registrato
    console.log(
      `📱 Verifico che il numero ${myPhoneNumber} non sia già registrato...`,
    );
    const checkPhoneResponse = await petlink.core.authApiKey.sdk.checkContact({
      contact: myPhoneNumber,
      contactType: "PHONE",
    });

    console.log(
      "📋 Risposta checkContact (phone):",
      JSON.stringify(checkPhoneResponse, null, 2),
    );
    expect(checkPhoneResponse.checkContact).toBeDefined();
    expect(checkPhoneResponse.checkContact.code).toBe("200");
    console.log("✅ Numero di telefono verificato con successo!");

    // STEP 2: Invia OTP al numero di telefono
    console.log(`📱 Invio OTP al numero ${myPhoneNumber}...`);
    const otpResponse = await petlink.core.authApiKey.sdk.sendOtp({
      phone: myPhoneNumber,
      languageId: "IT",
    });

    console.log("📋 Risposta sendOtp:", JSON.stringify(otpResponse, null, 2));
    expect(otpResponse.sendOtp).toBeDefined();
    expect(otpResponse.sendOtp.verificationId).toBeDefined();
    const verificationId = otpResponse.sendOtp.verificationId as string;
    console.log(`✅ OTP inviato! VerificationId: ${verificationId}`);

    // STEP 3: Aspetta e recupera l'OTP da Twilio
    console.log("📱 SMS inviato, aspetto l'OTP con delay iniziale...");
    const receivedOtp = await twilioClient.waitForOtp(
      myPhoneNumber,
      60000, // 60 secondi timeout totale
      5000, // 5 secondi tra i tentativi
    );

    console.log(`🎉 OTP ricevuto: ${receivedOtp}`);
    expect(receivedOtp).toMatch(/^\d{4,6}$/);

    // STEP 4: Verifica l'OTP ricevuto
    console.log(
      `🔐 Verifico l'OTP ${receivedOtp} con verificationId ${verificationId}...`,
    );
    const checkOtpResponse = await petlink.core.authApiKey.sdk.checkOtp({
      verificationId: verificationId,
      otp: receivedOtp,
      contact: myPhoneNumber,
    });

    console.log(
      "📋 Risposta checkOtp:",
      JSON.stringify(checkOtpResponse, null, 2),
    );
    expect(checkOtpResponse.checkOtp).toBeDefined();
    expect(checkOtpResponse.checkOtp.code).toBe("200");
    console.log("✅ OTP verificato con successo!");

    // STEP 5: Verifica che l'email non sia già registrata
    console.log(
      `📧 Verifico che l'email ${testEmail} non sia già registrata...`,
    );
    const checkEmailResponse = await petlink.core.authApiKey.sdk.checkContact({
      contact: testEmail,
      contactType: "EMAIL",
    });

    console.log(
      "📋 Risposta checkContact (email):",
      JSON.stringify(checkEmailResponse, null, 2),
    );
    expect(checkEmailResponse.checkContact).toBeDefined();
    expect(checkEmailResponse.checkContact.code).toBe("200");
    console.log("✅ Email verificata con successo!");

    // STEP 6: Registrazione utente completa
    console.log("👤 Procedo con la registrazione completa dell'utente...");
    const signUpResponse = await petlink.core.authApiKey.sdk.signUpUser({
      user: {
        email: testEmail,
        name: "Test",
        surname: "User",
        city: "Milano",
        countryCode: "IT",
        zipCode: "20100",
        streetAddress: "Via Test 123",
        phone: myPhoneNumber,
        password: "Test123!",
        confirmPassword: "Test123!",
        languageId: "IT",
      },
      otpData: {
        otp: receivedOtp,
        verificationId: verificationId,
      },
      languageId: "IT",
      appBrand: "PETLINK",
    });

    console.log(
      "📋 Risposta signUpUser:",
      JSON.stringify(signUpResponse, null, 2),
    );
    expect(signUpResponse.signUpUser).toBeDefined();
    expect(signUpResponse.signUpUser.code).toBe("200");
    console.log("🎉 Utente registrato con successo!");
    let newUser = petlink.core.authApiKey.sdk.getUser();

    console.log("✅ TEST COMPLETATO: Flusso di registrazione utente funziona!");
  }, 120000); // 2 minuti timeout per il test completo
});
