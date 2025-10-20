import twilio from "twilio";
import { env } from "../../config/env-schema-validation.js";

export class TwilioClient {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  async getMessagesSentTo(phoneNumber: string, limit: number = 10): Promise<any[]> {
    try {
      // console.log(`🔍 Cerco messaggi inviati a ${phoneNumber}...`);

      const messages = await this.client.messages.list({
        to: phoneNumber,
        limit: limit,
      });

      const sortedMessages = messages.sort((a: any, b: any) => new Date(b.dateSent!).getTime() - new Date(a.dateSent!).getTime());

      // console.log(`📱 Trovati ${sortedMessages.length} messaggi`);
      return sortedMessages;
    } catch (error) {
      // console.error("❌ Errore nel recupero messaggi:", error);
      throw error;
    }
  }

  /**
   * Get the latest OTP from messages sent to a phone number.
   * Returns null if no OTP is found.
   * Use with waitFor() utility for polling behavior.
   */
  async getOtpFromReceivedSms(phoneNumber: string): Promise<string | null> {
    const messages = await this.getMessagesSentTo(phoneNumber, 1);

    for (const message of messages) {
      // console.log(`📄 Analizzo messaggio: "${message.body}"`);

      // Pattern comuni per OTP
      const otpMatch = message.body.match(/\b(\d{4,6})\b/);
      if (otpMatch) {
        const otp = otpMatch[1];
        // console.log(`✅ OTP trovato: ${otp}`);
        return otp;
      }
    }

    // console.log("❌ Nessun OTP trovato");
    return null;
  }

  async deleteAllMessagesSentoToNumber(phoneNumber: string, limit: number = 50): Promise<number> {
    const messages = await this.client.messages.list({
      to: phoneNumber,
      limit: limit,
    });

    let deletedCount = 0;
    for (const message of messages) {
      try {
        await this.client.messages(message.sid).remove();
        deletedCount++;
      } catch (err) {
        // Silently skip individual failures, continue with next message
      }
    }
    // If there were messages but none were deleted, throw error
    if (messages.length > 0 && deletedCount === 0) {
      throw new Error(`Failed to delete all ${messages.length} messages`);
    }

    return deletedCount;
  }
}

// ------------------------------
// Export singleton instance
// ------------------------------
export const twilioClient = new TwilioClient();
