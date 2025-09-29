// src/clients/gmail/client-gmail.ts
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env-schema-validation.js";

// Utilizziamo un solo scope completo che include tutte le operazioni
const GMAIL_SCOPE = "https://mail.google.com/";
const GMAIL_QUERY = "is:unread";

export class GmailClient {
  private authClient: OAuth2Client | null = null;
  private refreshInProgress = false;

  constructor() {
    // Inizializzazione semplificata
  }

  /**
   * Ottiene un client OAuth2 autenticato utilizzando solo il refresh token.
   * La libreria gestisce automaticamente il refresh dell'access token quando necessario.
   */
  private async authenticate(): Promise<OAuth2Client> {
    // Se abbiamo già un client autenticato e non è in corso un refresh, lo restituiamo
    if (this.authClient && !this.refreshInProgress) return this.authClient;

    this.refreshInProgress = true;

    try {
      // Crea un nuovo client OAuth2
      const oAuth2 = new google.auth.OAuth2(
        env.GMAIL_CLIENT_ID,
        env.GMAIL_CLIENT_SECRET,
        env.GMAIL_REDIRECT_URI,
      );

      // Imposta solo il refresh token - la libreria gestirà automaticamente l'access token
      oAuth2.setCredentials({
        refresh_token: env.GMAIL_REFRESH_TOKEN,
        scope: GMAIL_SCOPE,
      });

      // Forza un refresh per verificare che il token funzioni
      await oAuth2.getAccessToken();

      // Verifica che il token funzioni con una chiamata API reale
      const gmail = google.gmail({ version: "v1", auth: oAuth2 });
      await gmail.users.getProfile({ userId: "me" });

      // Salva il client autenticato
      this.authClient = oAuth2;
      this.refreshInProgress = false;

      return oAuth2;
    } catch (error) {
      this.refreshInProgress = false;
      console.error(
        "Errore durante l'autenticazione con refresh token:",
        error,
      );
      throw new Error(
        `Impossibile autenticarsi con Gmail: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Attende l'arrivo di un'email di verifica e ne estrae il link.
   * @param timeoutMs Timeout in millisecondi (default: 60000)
   * @param retryIntervalMs Intervallo tra i tentativi in millisecondi (default: 10000)
   * @returns Il link di verifica trovato o null se non trovato entro il timeout
   */
  async waitForVerificationEmail(
    timeoutMs = 60000,
    retryIntervalMs = 10000,
  ): Promise<string> {
    const startTime = Date.now();
    console.log("🔍 In attesa dell'email di verifica...");

    while (Date.now() - startTime < timeoutMs) {
      const link = await this.getVerificationLink();
      if (link) {
        console.log("✅ Link di verifica trovato:", link);
        return link;
      }

      console.log(
        `⏳ Email non ancora arrivata, riprovo tra ${retryIntervalMs / 1000} secondi...`,
      );
      // Attendi prima di riprovare
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }

    throw new Error(`Verification email not received within ${timeoutMs}ms`);
  }

  /**
   * Cerca nelle email non lette un link di verifica.
   * @returns Il link di verifica trovato o null se non trovato
   */
  private async getVerificationLink(): Promise<string | null> {
    try {
      const authClient = await this.authenticate();
      const gmail = google.gmail({ version: "v1", auth: authClient });

      // Cerca le email non lette
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
    } catch (error) {
      console.error("Errore durante il recupero delle email:", error);

      // Se c'è un errore di autenticazione, resetta il client e riprova
      if (
        error instanceof Error &&
        (error.message.includes("authentication") ||
          error.message.includes("auth") ||
          error.message.includes("token"))
      ) {
        this.authClient = null; // Reset del client per forzare la riautenticazione
      }

      return null;
    }
  }

  /**
   * Estrae le parti di testo da una parte MIME di un'email.
   * @param part Parte MIME dell'email
   * @returns Array di stringhe contenenti il testo estratto
   */
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

  /**
   * Estrae un link di verifica dal testo di un'email.
   * @param text Testo dell'email
   * @returns Il link di verifica trovato o null se non trovato
   */
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

  /**
   * Elimina tutte le email nella casella.
   * @returns Il numero di email eliminate
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

      // Elimina un messaggio alla volta per maggiore affidabilità
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
    } catch (error) {
      console.error("Errore durante l'eliminazione delle email:", error);

      // Se c'è un errore di autenticazione, resetta il client
      if (
        error instanceof Error &&
        (error.message.includes("authentication") ||
          error.message.includes("auth") ||
          error.message.includes("insufficient") ||
          error.message.includes("scope") ||
          error.message.includes("token"))
      ) {
        this.authClient = null;
      }

      return 0;
    }
  }

  /**
   * Verifica la connessione con l'API Gmail.
   * @returns L'indirizzo email dell'account autenticato
   */
  async verifyConnection(): Promise<string> {
    try {
      const authClient = await this.authenticate();
      const gmail = google.gmail({ version: "v1", auth: authClient });

      const profile = await gmail.users.getProfile({ userId: "me" });
      const email = profile.data.emailAddress || "";
      console.log(`✅ Connessione verificata come: ${email}`);
      return email;
    } catch (error) {
      console.error("Errore durante la verifica della connessione:", error);
      this.authClient = null; // Reset del client per forzare la riautenticazione
      throw error;
    }
  }
}

// Esporta un'istanza singleton del client
export const gmailClient = new GmailClient();
