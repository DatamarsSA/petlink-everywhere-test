import { beforeAll, describe, expect, it } from "vitest";
import { twilioClient } from "./client-twillio.js";
import { petlink } from "../petlink-infrastructure/client-petlink-infrastructure.js";
import { env } from "../../config/env-schema-validation.js";

describe("Twilio Client must work", () => {
  const myPhoneNumber = env.TWILIO_TEST_PHONE_NUMBER;

  // Pulizia messaggi prima di tutti i test
  beforeAll(async () => {
    console.log(
      "\n🧹 PULIZIA INIZIALE: Elimino tutti i messaggi precedenti...",
    );
    const deletedCount =
      await twilioClient.deleteAllMessagesSentoToNumber(myPhoneNumber);
    console.log(`🧹 PULIZIA COMPLETATA: ${deletedCount} messaggi eliminati`);
  });

  it("Should works OTP flow (send OTP & read it by SMS)", async () => {
    console.log("\n🎯 TEST: Flusso completo OTP...");

    // 1. Invia OTP tramite il tuo backend
    console.log(`📱 Invio OTP al numero ${myPhoneNumber}...`);
    const otpResponse = await petlink.core.public.sendOtp({
      phone: myPhoneNumber,
      languageId: "IT",
    });

    console.log("📋 Risposta OTP:", JSON.stringify(otpResponse, null, 2));
    expect(otpResponse.sendOtp).toBeDefined();
    expect(otpResponse.sendOtp.verificationId).toBeDefined();
    console.log(
      `✅ OTP inviato! VerificationId: ${otpResponse.sendOtp.verificationId}`,
    );

    // 2. Aspetta e leggi OTP da Twilio (con delay iniziale di 10 secondi)
    console.log("📱 SMS inviato, aspetto l'OTP con delay iniziale...");
    const receivedOtp = await twilioClient.waitForOtp(
      myPhoneNumber,
      60000, // 60 secondi timeout totale
      5000, // 5 secondi tra i tentativi
    );

    console.log(`🎉 OTP ricevuto: ${receivedOtp}`);
    expect(receivedOtp).toMatch(/^\d{4,6}$/);

    console.log("✅ TEST COMPLETATO: Flusso OTP funziona!");
  }, 90000); // 90 secondi timeout per il test
});
