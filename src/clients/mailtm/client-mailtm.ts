// src/clients/mailtm/client-mailtm.ts
import { logger } from "../../config/logger.js";

// DOCS mail.tm -> https://docs.mail.tm/
const MAIL_TM_API_URL = "https://api.mail.tm";

interface MailTmMessage {
  id: string;
  from: { address: string; name: string };
  subject: string;
  intro: string;
  seen: boolean;
  isDeleted: boolean;
  hasAttachments: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MailTmMessageDetail extends MailTmMessage {
  text: string;
  html: string[] | string | null;
}

interface MailTmTokenResponse {
  token: string;
}

export class MailTmClient {
  private token: string | null = null;

  private getCredentials(): { email: string; password: string } {
    const email = process.env.MAIL_TM_EMAIL;
    const password = process.env.MAIL_TM_PASSWORD;
    if (!email || !password) {
      throw new Error("MAIL_TM_EMAIL and MAIL_TM_PASSWORD must be set in environment");
    }
    return { email, password };
  }

  /**
   * Authenticate with Mail.tm and cache the Bearer token.
   */
  private async authenticate(): Promise<string> {
    if (this.token) {
      logger.debug("Reusing cached Mail.tm token");
      return this.token;
    }

    const { email, password } = this.getCredentials();
    logger.debug(`Authenticating Mail.tm account: ${email}`);

    const response = await fetch(`${MAIL_TM_API_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: email, password }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Mail.tm authentication failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as MailTmTokenResponse;
    this.token = data.token;
    logger.debug("Mail.tm authenticated successfully");
    return this.token;
  }

  /**
   * List messages in the inbox.
   */
  private async getMessages(token: string): Promise<MailTmMessage[]> {
    const response = await fetch(`${MAIL_TM_API_URL}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Mail.tm list messages failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { "hydra:member": MailTmMessage[] };
    return data["hydra:member"] ?? [];
  }

  /**
   * Get a single message with full body.
   */
  private async getMessage(token: string, id: string): Promise<MailTmMessageDetail> {
    const response = await fetch(`${MAIL_TM_API_URL}/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Mail.tm get message failed: ${response.status} ${text}`);
    }

    return (await response.json()) as MailTmMessageDetail;
  }

  /**
   * Delete a single message.
   */
  private async deleteMessage(token: string, id: string): Promise<void> {
    const response = await fetch(`${MAIL_TM_API_URL}/messages/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      logger.debug(`Failed to delete Mail.tm message ${id}: ${response.status}`);
    } else {
      logger.debug(`Deleted Mail.tm message ${id}`);
    }
  }

  /**
   * Search messages and extract the first verification link.
   * Returns null if no verification email is found.
   * Moves the message to trash after reading.
   */
  async getVerificationLink(): Promise<string | null> {
    const { email } = this.getCredentials();
    const token = await this.authenticate();

    logger.debug(`Searching Mail.tm messages in ${email} for verification link`);
    const messages = await this.getMessages(token);
    logger.debug(`Found ${messages.length} Mail.tm message(s)`);

    if (messages.length === 0) return null;

    for (const msg of messages) {
      const detail = await this.getMessage(token, msg.id);
      const content = this.extractContent(detail);

      const link = this.extractLink(content);
      if (link) {
        logger.debug(`Verification link found in Mail.tm: ${link}`);
        await this.deleteMessage(token, msg.id);
        return link;
      }

      logger.debug(`No verify-email link in message ${msg.id} — skipping delete`);
    }

    return null;
  }

  /**
   * Delete all messages in the inbox (up to what's returned by the API).
   */
  async deleteAllMessages(): Promise<number> {
    const token = await this.authenticate();
    logger.debug("Deleting all Mail.tm messages");

    const messages = await this.getMessages(token);
    logger.debug(`Found ${messages.length} Mail.tm message(s) to delete`);
    if (messages.length === 0) return 0;

    let deleted = 0;
    for (const msg of messages) {
      try {
        await this.deleteMessage(token, msg.id);
        deleted++;
      } catch {
        // Already logged in deleteMessage
      }
    }

    logger.debug(`Deleted ${deleted}/${messages.length} Mail.tm messages`);
    if (messages.length > 0 && deleted === 0) {
      throw new Error(`Failed to delete all ${messages.length} Mail.tm messages`);
    }

    return deleted;
  }

  /**
   * Extract content from a message detail.
   * Concatenates both text and HTML (with tags stripped) so that links
   * appearing as anchor text in HTML are also searchable.
   */
  private extractContent(detail: MailTmMessageDetail): string {
    const parts: string[] = [];

    if (detail.text) {
      parts.push(detail.text);
    }

    const html = Array.isArray(detail.html) ? detail.html.join("\n") : detail.html;
    if (html) {
      const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      parts.push(stripped);
    }

    if (parts.length === 0) {
      parts.push(detail.intro ?? "");
    }

    return parts.join("\n\n");
  }

  /**
   * Very simple link extractor for URLs containing "verify-email" (case-insensitive).
   */
  private extractLink(text: string): string | null {
    const decoded = text
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");

    const re = /https?:\/\/[^\s"'<>]*verify-email[^\s"'<>]*/i;
    const m = decoded.match(re)?.[0];
    return m ? m.replace(/[)\].,;>'"]+$/g, "").trim() : null;
  }
}

// Export singleton instance
export const mailTmClient = new MailTmClient();
