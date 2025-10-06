// src/clients/gmail/client-gmail.ts
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env-schema-validation.js";

// Minimal scope for reading and deleting/moving messages to Trash
const GMAIL_QUERY = "is:unread";

export class GmailClient {
  private authClient: OAuth2Client | null = null;
  private refreshInProgress = false;

  constructor() {
    // No-op. All configuration comes from env at authenticate() time.
  }

  /**
   * Build an OAuth2 client using ONLY the long‑lived refresh_token.
   * google-auth-library will mint/refresh short‑lived access tokens automatically.
   */
  private async authenticate(): Promise<OAuth2Client> {
    if (this.authClient && !this.refreshInProgress) return this.authClient;

    this.refreshInProgress = true;
    try {
      const oAuth2 = new google.auth.OAuth2(
        env.GMAIL_CLIENT_ID,
        env.GMAIL_CLIENT_SECRET,
      );

      oAuth2.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
      // Optional: force-mint an access token now to fail fast in case RT is invalid
      await oAuth2.getAccessToken();

      this.authClient = oAuth2;
      this.refreshInProgress = false;
      return oAuth2;
    } catch (error) {
      this.refreshInProgress = false;
      // Normalize and surface a concise error
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Gmail OAuth2 authentication failed (refresh_token flow): ${msg}`,
      );
    }
  }

  /**
   * Search unread messages and extract the first verification link.
   * Returns null if no verification email is found.
   * Use with waitFor() utility for polling behavior.
   */
  async getVerificationLink(): Promise<string | null> {
    try {
      const authClient = await this.authenticate();
      const gmail = google.gmail({ version: "v1", auth: authClient });

      const list = await gmail.users.messages.list({
        userId: "me",
        q: GMAIL_QUERY,
        maxResults: 1,
      });

      const messages = list.data.messages ?? [];
      if (messages.length === 0) return null;

      for (const msg of messages) {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });

        const payload = full.data.payload!;
        const textBodies = this.extractTextParts(payload);
        const content = textBodies.join("\n");

        // Best-effort: move message to Trash (recoverable). Use users.messages.delete for permanent deletion.
        try {
          await gmail.users.messages.trash({ userId: "me", id: msg.id! });
        } catch {}

        const link = this.extractLink(content);
        if (link) return link;
      }

      return null;
    } catch (error: any) {
      // Reset cached client only on auth/permission errors
      const status = error?.code ?? error?.response?.status ?? 0;
      if (status === 401 || status === 403) this.authClient = null;
      return null;
    }
  }

  /**
   * Extract text parts from a Gmail MIME payload.
   * NOTE: Gmail bodies are base64url; here we keep it minimal per user's request.
   */
  private extractTextParts(part: any): string[] {
    if (!part) return [];
    if (part.mimeType?.startsWith("text/") && part.body?.data) {
      // Minimal decoding (base64). For full correctness, normalize base64url first.
      const decoded = Buffer.from(part.body.data, "base64").toString("utf8");
      return [decoded];
    }
    if (part.parts)
      return part.parts.flatMap((p: any) => this.extractTextParts(p));
    return [];
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

  /**
   * Delete up to 100 recent messages (moves them to Trash).
   */
  async deleteAllEmails(): Promise<number> {
    try {
      const authClient = await this.authenticate();
      const gmail = google.gmail({ version: "v1", auth: authClient });

      const list = await gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
      });
      const messages = list.data.messages ?? [];
      if (messages.length === 0) return 0;

      let deleted = 0;
      for (const msg of messages) {
        try {
          await gmail.users.messages.trash({ userId: "me", id: msg.id! });
          deleted++;
        } catch {}
      }
      return deleted;
    } catch (error: any) {
      const status = error?.code ?? error?.response?.status ?? 0;
      if (status === 401 || status === 403) this.authClient = null;
      return 0;
    }
  }

  /**
   * Quick connectivity check; returns the mailbox address.
   */
  async verifyConnection(): Promise<string> {
    const authClient = await this.authenticate();
    const gmail = google.gmail({ version: "v1", auth: authClient });
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data.emailAddress || "";
  }
}

// ------------------------------
// Export singleton instance
// ------------------------------
export const gmailClient = new GmailClient();
