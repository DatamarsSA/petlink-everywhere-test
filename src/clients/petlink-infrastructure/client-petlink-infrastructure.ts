import { GraphQLClient } from "graphql-request";
import {
  getSdk as getCoreSdk,
  Sdk as CoreSdk,
} from "./endpoints/graphql/generated/core_schema.js";
import {
  getSdk as getCctSdk,
  Sdk as CctSdk,
} from "./endpoints/graphql/generated/cct_schema.js";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../../config/env-schema-validation.js";

// Costanti per gli header HTTP
export const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  API_KEY: "x-api-key",
  X_AMZ_DATE: "X-Amz-Date",
  X_AMZ_SECURITY_TOKEN: "X-Amz-Security-Token",
};

// Tipi di servizio supportati
export enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

// Tipi di autenticazione supportati
export enum AuthType {
  JWT = "jwt",
  IAM = "iam",
  API_KEY = "apiKey",
}

// Opzioni per i tentativi di ripetizione delle richieste
export type RetryOptions = {
  retries: number;
  delayMs: number[];
};


export type IamCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

// Classe per la gestione delle configurazioni di ambiente
class EnvConfig {
  static getEndpoint(service: ServiceType): string {
    return env[`${service}_GRAPHQL_API_URL`];
  }

  static getApiKey(service: ServiceType): string {
    return env[`${service}_GRAPHQL_API_KEY`];
  }

  static getCognitoConfig() {
    return {
      region: env.COGNITO_REGION,
      clientId: env.COGNITO_CLIENT_ID,
    };
  }
}

// Gestore dell'autenticazione
class AuthManager {
  // Token JWT attivo
  private static jwtToken: { token: string; expiry: Date } | null = null;

  // Credenziali IAM attive
  private static iamCredentials: IamCredentials | null = null;

  // Autenticazione JWT con Cognito
  static async authenticateWithJwt(username: string, password: string, authMethod: "email"| "phone_number"): Promise<void> {
    const config = EnvConfig.getCognitoConfig();
    const client = new CognitoIdentityProviderClient({ region: config.region });

    const command = new InitiateAuthCommand({
      ClientId: config.clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
      ClientMetadata: {
        method: authMethod,
        username: username,
      }
    });

    const response = await client.send(command);
    const token = response.AuthenticationResult?.IdToken;

    if (!token) {
      throw new Error(`Failed to get ID token from Cognito for user: ${username}`);
    }

    this.jwtToken = this.createTokenCacheEntry(token);
  }

  // Verifica se abbiamo un token JWT valido
  static hasValidJwtToken(): boolean {
    return !!this.jwtToken && this.jwtToken.expiry > new Date();
  }

  // Ottiene il token JWT (se disponibile)
  static getJwtToken(): string {
    if (!this.hasValidJwtToken()) {
      throw new Error("No valid JWT token available. Please login first.");
    }
    return this.jwtToken!.token;
  }

  // Crea una voce di cache per il token con scadenza
  private static createTokenCacheEntry(token: string): { token: string; expiry: Date } {
    const decodePayload = (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length < 2) throw new Error("Invalid JWT");
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const json = Buffer.from(padded, "base64").toString("utf8");
      return JSON.parse(json) as { exp?: number };
    };

    const { exp } = decodePayload(token);
    const nowMs = Date.now();
    const skewMs = 60 * 1000; // 1 minuto di margine di sicurezza
    const expiryMs = exp ? exp * 1000 - skewMs : nowMs + 3 * 60 * 1000;

    return {
      token,
      expiry: new Date(expiryMs),
    };
  }

  // Gestione credenziali IAM
  static setIamCredentials(credentials: IamCredentials): void {
    this.iamCredentials = credentials;
  }

  // Verifica se abbiamo credenziali IAM
  static hasIamCredentials(): boolean {
    return !!this.iamCredentials;
  }

  // Ottiene le credenziali IAM (se disponibili)
  static getIamCredentials(): IamCredentials {
    if (!this.hasIamCredentials()) {
      throw new Error("IAM credentials not set. Please call loginWithIam first.");
    }
    return this.iamCredentials!;
  }

  // Genera gli header per l'autenticazione IAM
  static generateIamAuthHeaders(): Record<string, string> {
    const credentials = this.getIamCredentials();

    // In una implementazione reale, qui genereresti la firma AWS SigV4
    const headers: Record<string, string> = {
      [HTTP_HEADERS.X_AMZ_DATE]: new Date().toISOString(),
    };

    if (credentials.sessionToken) {
      headers[HTTP_HEADERS.X_AMZ_SECURITY_TOKEN] = credentials.sessionToken;
    }

    // Qui andrebbe aggiunta la firma vera e propria
    // headers['Authorization'] = 'AWS4-HMAC-SHA256 Credential=...';

    return headers;
  }

  // Pulisce tutte le cache
  static clearCache(): void {
    this.jwtToken = null;
    this.iamCredentials = null;
  }
}

// Tipo per SDK con funzionalità di retry
type AugmentedSdk<T> = T & {
  withRetry: (opts?: Partial<RetryOptions>) => AugmentedSdk<T>;
};

// Funzione per eseguire una chiamata con retry in caso di errore
async function execWithRetry<T>(
    fn: () => Promise<T>,
    opts?: Partial<RetryOptions>,
): Promise<T> {
  const DEFAULT_RETRY: RetryOptions = {
    retries: 3,
    delayMs: [200, 400, 800],
  };
  const cfg: RetryOptions = { ...DEFAULT_RETRY, ...(opts ?? {}) };
  let lastErr: unknown;

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const isRetriableError = (err: unknown): boolean => {
    const anyErr = err as any;
    const status: number | undefined = anyErr?.response?.status;

    if (typeof status === "number") {
      if (status === 429) return true;
      if (status >= 500 && status < 600) return true;
    }

    if (
        !status &&
        (anyErr?.code || anyErr?.errno || anyErr?.message?.includes("network"))
    ) {
      return true;
    }

    return false;
  };

  const computeDelay = (attempt: number, o: RetryOptions): number => {
    const index = Math.min(attempt - 1, o.delayMs.length - 1);
    return o.delayMs[index];
  };

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === cfg.retries;
      if (isLast || !isRetriableError(err)) break;

      const delay = computeDelay(attempt + 1, cfg);
      await sleep(delay);
    }
  }

  throw lastErr;
}

// Classe base per i client
abstract class BaseClient<TSdk extends object> {
  protected target: ServiceType;
  private sdkCache = new Map<string, { key: string; sdk: TSdk }>();

  protected constructor(target: ServiceType) {
    this.target = target;
  }

  clearCache(): void {
    this.sdkCache.clear();
  }

  // Crea un proxy per l'SDK con supporto per retry
  private makeSdkProxy(
      authType: AuthType,
      retryCfg?: Partial<RetryOptions>,
  ): AugmentedSdk<TSdk> {
    const self = this;

    return new Proxy({} as AugmentedSdk<TSdk>, {
      get: (_target, prop, _recv) => {
        if (prop === "withRetry") {
          return (opts?: Partial<RetryOptions>) =>
              self.makeSdkProxy(authType, { ...retryCfg, ...(opts ?? {}) });
        }

        return async (...args: any[]) => {
          const sdk = await self.getOrCreateSdk(authType);
          const member = (sdk as any)[prop];

          if (typeof member !== "function") {
            return member;
          }

          const call = () => member(...args);
          return retryCfg ? execWithRetry(call, retryCfg) : call();
        };
      },
    }) as AugmentedSdk<TSdk>;
  }

  // Ottiene o crea un SDK con le impostazioni di autenticazione appropriate
  private async getOrCreateSdk(authType: AuthType): Promise<TSdk> {
    const endpoint = EnvConfig.getEndpoint(this.target);
    let cacheKey: string;
    let headers: Record<string, string>;

    switch (authType) {
      case AuthType.JWT:
        if (!AuthManager.hasValidJwtToken()) {
          throw new Error("No valid JWT token available. Please login first with loginWithEmail or loginWithPhone.");
        }
        const token = AuthManager.getJwtToken();
        cacheKey = `jwt:${token}`;
        headers = { [HTTP_HEADERS.AUTHORIZATION]: token };
        break;

      case AuthType.IAM:
        if (!AuthManager.hasIamCredentials()) {
          throw new Error("No IAM credentials available. Please login first with loginWithIam.");
        }
        const iamCredentials = AuthManager.getIamCredentials();
        cacheKey = `iam:${iamCredentials.accessKeyId}`;
        headers = AuthManager.generateIamAuthHeaders();
        break;

      case AuthType.API_KEY:
        const apiKey = EnvConfig.getApiKey(this.target);
        if (!apiKey) throw new Error(`[${this.target}] API Key not found`);
        cacheKey = `apiKey:${apiKey}`;
        headers = { [HTTP_HEADERS.API_KEY]: apiKey };
        break;

      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }

    const cached = this.sdkCache.get(cacheKey);
    if (cached) return cached.sdk;

    const client = new GraphQLClient(endpoint, { headers });
    const sdk = this.createSdk(client);
    this.sdkCache.set(cacheKey, { key: cacheKey, sdk });
    return sdk;
  }

  // Proprietà per accedere ai diversi tipi di autenticazione
  get authJwt(): AugmentedSdk<TSdk> {
    return this.makeSdkProxy(AuthType.JWT);
  }

  get authIam(): AugmentedSdk<TSdk> {
    return this.makeSdkProxy(AuthType.IAM);
  }

  get public(): AugmentedSdk<TSdk> {
    return this.makeSdkProxy(AuthType.API_KEY);
  }

  protected abstract createSdk(client: GraphQLClient): TSdk;
}

// Client per il servizio Core
export class CoreClient extends BaseClient<CoreSdk> {
  constructor() {
    super(ServiceType.CORE);
  }

  protected createSdk(client: GraphQLClient): CoreSdk {
    return getCoreSdk(client);
  }
}

// Client per il servizio CCT
export class CctClient extends BaseClient<CctSdk> {
  constructor() {
    super(ServiceType.CCT);
  }

  protected createSdk(client: GraphQLClient): CctSdk {
    return getCctSdk(client);
  }
}

// Classe principale per l'infrastruttura PetLink
export class PetLinkInfrastructure {
  readonly core = new CoreClient();
  readonly cct = new CctClient();

  // Metodi di autenticazione
  async loginWithEmail(email: string, password: string): Promise<void> {
    await AuthManager.authenticateWithJwt(email, password, "email");
  }

  async loginWithPhone(phone: string, password: string): Promise<void> {
    await AuthManager.authenticateWithJwt(phone, password, "phone_number");
  }

  loginWithIam(accessKeyId: string, secretAccessKey: string, sessionToken?: string): void {
    AuthManager.setIamCredentials({ accessKeyId, secretAccessKey, sessionToken });
  }

  // Resetta tutte le cache
  reset(): void {
    AuthManager.clearCache();
    this.core.clearCache();
    this.cct.clearCache();
  }
}

export const petlink = new PetLinkInfrastructure();
