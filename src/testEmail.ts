import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { writeFile } from "node:fs/promises";
import readline from "node:readline/promises";

const TOKEN_PATH = "./token.json";

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];
const GMAIL_QUERY = "is:unread";

function extractLink(text: string): string | null {
  // Decodifica veloce per i casi più comuni (basta per query tipo &amp;)
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
  return Array.from(new Set(cleaned))[0];
}

async function auth(): Promise<OAuth2Client> {
  const creds = {
    client_id:
      "962541738631-ru79un0fqub20a7v8l4rgiaqkthhlt21.apps.googleusercontent.com",
    project_id: "velvety-network-473219-i8",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: "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",
    redirect_uris: ["http://localhost"],
  };
  // const de = {
  //   "client_id": "962541738631-ru79un0fqub20a7v8l4rgiaqkthhlt21.apps.googleusercontent.com",
  //     "project_id": "velvety-network-473219-i8",
  //     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  //     "token_uri": "https://oauth2.googleapis.com/token",
  //     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  //     "client_secret": "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",
  //     "redirect_uris": ["http://localhost"]
  // }
  const oAuth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uris?.[0],
  );

  try {
    const token = {
      access_token:
        "ya29.a0AQQ_BDT-Ontc2-DgF8erP25mScuPuFpEqi0qPopYnGnbw25r683R4L7h7AEOy71D09-iArxAYJVZ11vu8HnwpUb443p-hJpEFZhl4mHENtBaaEjPeeBSEOylHsPHAzPZvOTQZ2QajkLutJmlrGPA7W4AguL_YVZlHk0U8O09kWn8GenBbHQKRLYpYFIxtuRxUb51YEEaCgYKAbwSARASFQHGX2Mi7nRNWqF2_FzWMYrJYz0skA0206",
      refresh_token:
        "1//096oB8AedvgNBCgYIARAAGAkSNwF-L9Ir3R2hnKZS_sJsTVRZGBAr5l4bcj2iuy2YPe5_562KSrqrYApLe3FyuN99cHnlh4kFpXs",
      scope: "https://www.googleapis.com/auth/gmail.modify",
      token_type: "Bearer",
      refresh_token_expires_in: 604799,
      expiry_date: 1758833993589,
    };
    oAuth2.setCredentials(token);
    return oAuth2;
  } catch {
    const authUrl = oAuth2.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
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
    await writeFile(TOKEN_PATH, JSON.stringify(tokens), "utf8");
    return oAuth2;
  }
}
async function getConfermationLink(): Promise<string | null> {
  const authClient = await auth();
  const gmail = google.gmail({ version: "v1", auth: authClient });

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
    function extractTextParts(part: any): string[] {
      if (!part) return [];
      if (part.mimeType?.startsWith("text/") && part.body?.data) {
        const decoded = Buffer.from(part.body.data, "base64").toString("utf8");
        return [decoded];
      }
      if (part.parts) {
        return part.parts.flatMap(extractTextParts);
      }
      return [];
    }

    const textBodies = extractTextParts(payload);
    const content = textBodies.join("\n");

    //console.log("=== EMAIL BODY ===\n", content);
    await gmail.users.messages.modify({
      userId: "me",
      id: msg.id!,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    });

    return extractLink(content);
  }

  return null;
}

const link = await getConfermationLink();
if (link) {
  console.log("LINK CONFERMA:", link);
} else {
  console.log("Nessun LINK CONFERMA trovato.");
}
