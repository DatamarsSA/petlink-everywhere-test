// src/clients/gmail/client-gmail.ts
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env-schema-validation.js";
import readline from "node:readline/promises";
import { writeFile } from "node:fs/promises";

const TOKEN_PATH = "./gmail-token.json";
// Aggiungiamo più scope per avere accesso completo a Gmail
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://mail.google.com/", // Questo è lo scope completo che include tutte le operazioni
];
const GMAIL_QUERY = "is:unread";

export class GmailClient {
  //todo: understand better and clean and refactor it
  private authClient: OAuth2Client | null = null;
  private tokenRefreshInProgress = false;

  constructor() {
    // Inizializzazione con variabili d'ambiente
  }

  private async authenticate(): Promise<OAuth2Client> {
    if (this.authClient && !this.tokenRefreshInProgress) return this.authClient;

    const oAuth2 = new google.auth.OAuth2(
      env.GMAIL_CLIENT_ID,
      env.GMAIL_CLIENT_SECRET,
      env.GMAIL_REDIRECT_URI,
    );

    try {
      // Usa esattamente lo stesso formato dello script originale
      const token = {
        access_token: env.GMAIL_ACCESS_TOKEN,
        refresh_token: env.GMAIL_REFRESH_TOKEN,
        // Usa tutti gli scope necessari
        scope: SCOPES.join(" "),
        token_type: "Bearer",
        expiry_date: parseInt(env.GMAIL_TOKEN_EXPIRY || "0"),
      };

      oAuth2.setCredentials(token);

      // Verifica che il token funzioni
      const gmail = google.gmail({ version: "v1", auth: oAuth2 });
      await gmail.users.getProfile({ userId: "me" });

      this.authClient = oAuth2;
      return oAuth2;
    } catch (error) {
      console.log("Token non valido, richiedo nuova autenticazione...");
      this.tokenRefreshInProgress = true;

      try {
        const authUrl = oAuth2.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          prompt: "consent", // Forza il prompt di consenso per ottenere un nuovo refresh token
        });

        console.log(
          "Apri questo URL e autorizza l'app, poi incolla il code:\n",
          authUrl,
        );

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const code = await rl.question("Code: ");
        rl.close();

        const { tokens } = await oAuth2.getToken(code);
        oAuth2.setCredentials(tokens);

        // Salva i token per uso futuro
        await writeFile(TOKEN_PATH, JSON.stringify(tokens), "utf8");

        // Stampa i nuovi token per poterli aggiornare nel file .env
        console.log("Nuovi token generati:");
        console.log("GMAIL_ACCESS_TOKEN:", tokens.access_token);
        console.log("GMAIL_REFRESH_TOKEN:", tokens.refresh_token);
        console.log("GMAIL_TOKEN_EXPIRY:", tokens.expiry_date);

        this.authClient = oAuth2;
        this.tokenRefreshInProgress = false;
        return oAuth2;
      } catch (refreshError) {
        console.error("Errore durante il refresh del token:", refreshError);
        this.tokenRefreshInProgress = false;
        throw refreshError;
      }
    }
  }

  async waitForVerificationEmail(
    timeoutMs = 60000,
    retryIntervalMs = 10000,
  ): Promise<string | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const link = await this.getVerificationLink();
      if (link) {
        console.log("✅ Link di verifica trovato:", link);
        return link;
      }

      // Attendi prima di riprovare
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }

    throw new Error(`Verification email not received within ${timeoutMs}ms`);
  }

  private async getVerificationLink(): Promise<string | null> {
    const authClient = await this.authenticate();
    const gmail = google.gmail({ version: "v1", auth: authClient });

    try {
      // Usa esattamente la stessa query dello script originale
      const list = await gmail.users.messages.list({
        userId: "me",
        q: GMAIL_QUERY,
        maxResults: 5,
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

        try {
          // Segna come letto
          await gmail.users.messages.modify({
            userId: "me",
            id: msg.id!,
            requestBody: {
              removeLabelIds: ["UNREAD"],
            },
          });
        } catch (error) {
          console.error("Errore durante la modifica dell'email:", error);
          // Continua comunque, anche se non riesce a segnare come letta
        }

        const link = this.extractLink(content);
        if (link) return link;
      }

      return null;
    } catch (error: any) {
      console.error("Errore durante il recupero delle email:", error);
      // Se c'è un errore di autenticazione, prova a riautenticare
      if (
        error.message?.includes("authentication") ||
        error.message?.includes("auth")
      ) {
        this.authClient = null; // Reset del client per forzare la riautenticazione
        return this.getVerificationLink(); // Riprova
      }
      return null;
    }
  }

  private extractTextParts(part: any): string[] {
    if (!part) return [];
    if (part.mimeType?.startsWith("text/") && part.body?.data) {
      const decoded = Buffer.from(part.body.data, "base64").toString("utf8");
      return [decoded];
    }
    if (part.parts) {
      return part.parts.flatMap((p: any) => this.extractTextParts(p));
    }
    return [];
  }

  private extractLink(text: string): string | null {
    // Decodifica veloce per i casi più comuni
    const decoded = text
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");

    // Cerca URL che includono "verify-email" (case-insensitive)
    const re = /https?:\/\/[^\s"'<>]*verify-email[^\s"'<>]*/gi;
    const matches = decoded.match(re) ?? [];

    // Ripulisce punteggiatura finale e deduplica
    const cleaned = matches.map((u) => u.replace(/[)\].,;>'"]+$/g, "").trim());
    return Array.from(new Set(cleaned))[0] || null;
  }

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

      // Invece di batchDelete, proviamo a eliminare un messaggio alla volta
      // Questo può essere più lento ma più affidabile
      let deletedCount = 0;
      for (const msg of messages) {
        try {
          await gmail.users.messages.trash({
            userId: "me",
            id: msg.id!,
          });
          deletedCount++;
        } catch (error) {
          console.error(
            `Errore durante l'eliminazione dell'email ${msg.id}:`,
            error,
          );
          // Continua con le altre email
        }
      }

      return deletedCount;
    } catch (error: any) {
      console.error("Errore durante l'eliminazione delle email:", error);

      // Se c'è un errore di autenticazione, prova a riautenticare
      if (
        error.message?.includes("authentication") ||
        error.message?.includes("auth") ||
        error.message?.includes("insufficient") ||
        error.message?.includes("scope")
      ) {
        this.authClient = null; // Reset del client per forzare la riautenticazione
        return 0; // Ritorna 0 per evitare loop infiniti
      }

      return 0;
    }
  }

  // Metodo di utilità per verificare la connessione
  async verifyConnection(): Promise<string> {
    try {
      const authClient = await this.authenticate();
      const gmail = google.gmail({ version: "v1", auth: authClient });

      const profile = await gmail.users.getProfile({ userId: "me" });
      return profile.data.emailAddress || "";
    } catch (error) {
      console.error("Errore durante la verifica della connessione:", error);
      this.authClient = null; // Reset del client per forzare la riautenticazione
      throw error;
    }
  }
}

export const gmailClient = new GmailClient();
