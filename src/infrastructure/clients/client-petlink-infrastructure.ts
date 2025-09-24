import { GraphQLClient } from "graphql-request";
import {
  getSdk as getCoreSdk,
  Sdk as CoreSdk,
} from "../../lib/generated/core_schema.js";
import {
  getSdk as getCctSdk,
  Sdk as CctSdk,
} from "../../lib/generated/cct_schema.js";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  AuthMode,
  HTTP_HEADERS,
  RetryOptions,
  ServiceType,
} from "../types/infrastructure-types.js";
import { env } from "../env-schema-validation.js";

// ===== Environment  =====
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
      username: env.COGNITO_USERNAME,
      password: env.COGNITO_PASSWORD,
    };
  }
}

// ===== Auth =====
class AuthHelper {
  private static tokenCache: { token: string; expiry: Date } | null = null;

  static async getToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiry > new Date()) {
      return this.tokenCache.token;
    }

    const config = EnvConfig.getCognitoConfig();
    const client = new CognitoIdentityProviderClient({ region: config.region });

    const command = new InitiateAuthCommand({
      ClientId: config.clientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: config.username,
        PASSWORD: config.password,
      },
    });

    const response = await client.send(command);
    const token = response.AuthenticationResult?.IdToken;

    if (!token) {
      throw new Error("Failed to get ID token from Cognito");
    }

    // Cache until slightly before JWT expiry (fallback to 3 minutes if missing)
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
    const skewMs = 60 * 1000; // 1 minute safety margin
    const expiryMs = exp ? exp * 1000 - skewMs : nowMs + 3 * 60 * 1000;

    this.tokenCache = {
      token,
      expiry: new Date(expiryMs),
    };

    return token;
  }

  static clearTokenCache(): void {
    this.tokenCache = null;
  }
}

// ===== Client Endpoints=

type AugmentedSdk<T> = T & {
  withRetry: (opts?: Partial<RetryOptions>) => AugmentedSdk<T>;
};

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
    // graphql-request throws ClientError for HTTP != 2xx
    const anyErr = err as any;
    const status: number | undefined = anyErr?.response?.status;

    if (typeof status === "number") {
      if (status === 429) return true;
      if (status >= 500 && status < 600) return true;
    }

    // Network-like errors (no response) → often transient
    if (
      !status &&
      (anyErr?.code || anyErr?.errno || anyErr?.message?.includes("network"))
    ) {
      return true;
    }

    return false;
  };

  const computeDelay = (attempt: number, o: RetryOptions): number => {
    // attempt starts at 1 for first retry (after first failure)
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
  // Re-throw last error preserving stack
  throw lastErr;
}

abstract class BaseClient<TSdk extends object> {
  protected target: ServiceType;
  private sdkCache = new Map<string, { key: string; sdk: TSdk }>();

  protected constructor(target: ServiceType) {
    this.target = target;
  }

  clearLocalCache(): void {
    this.sdkCache.clear();
  }

  private makeSdkProxy(
    mode: AuthMode,
    retryCfg?: Partial<RetryOptions>,
  ): AugmentedSdk<TSdk> {
    // NOTE: we capture retryCfg in closure. Calling withRetry returns a new proxy with new retryCfg.
    const self = this;

    return new Proxy({} as AugmentedSdk<TSdk>, {
      get: (_target, prop, _recv) => {
        if (prop === "withRetry") {
          // Return a function that creates a *new* proxy with retry enabled/customized
          return (opts?: Partial<RetryOptions>) =>
            self.makeSdkProxy(mode, { ...retryCfg, ...(opts ?? {}) });
        }

        // For actual SDK method/property access
        return async (...args: any[]) => {
          const sdk = await self.getOrCreateSdk(mode);
          const member = (sdk as any)[prop];

          if (typeof member !== "function") {
            // Non-callable property (e.g., fragments, constants)
            return member;
          }

          // Wrap the actual call with retry if configured, else call directly
          const call = () => member(...args);
          return retryCfg ? execWithRetry(call, retryCfg) : call();
        };
      },
    }) as AugmentedSdk<TSdk>;
  }

  private async getOrCreateSdk(mode: AuthMode): Promise<TSdk> {
    const endpoint = EnvConfig.getEndpoint(this.target);
    let cacheKey: string;
    let headers: Record<string, string>;

    if (mode === AuthMode.TOKEN) {
      const token = await AuthHelper.getToken();
      cacheKey = token;
      headers = { [HTTP_HEADERS.AUTHORIZATION]: token };
    } else {
      const apiKey = EnvConfig.getApiKey(this.target);
      if (!apiKey) throw new Error(`[${this.target}] ❌ API Key not found`);
      cacheKey = apiKey;
      headers = { [HTTP_HEADERS.API_KEY]: apiKey };
    }

    const cacheId = `${mode}:${cacheKey}`; // "TOKEN:<value_token>" or "API_KEY:<value_apiKey>"

    const cached = this.sdkCache.get(cacheId);
    if (cached) return cached.sdk;

    const client = new GraphQLClient(endpoint, { headers });
    const sdk = this.createSdk(client);
    this.sdkCache.set(cacheId, { key: cacheKey, sdk });
    return sdk;
  }

  get authLogin(): { sdk: AugmentedSdk<TSdk> } {
    return { sdk: this.makeSdkProxy(AuthMode.TOKEN) };
  }

  get authApiKey(): { sdk: AugmentedSdk<TSdk> } {
    return { sdk: this.makeSdkProxy(AuthMode.API_KEY) };
  }

  protected abstract createSdk(client: GraphQLClient): TSdk;
}

export class CoreClient extends BaseClient<CoreSdk> {
  constructor() {
    super(ServiceType.CORE);
  }

  protected createSdk(client: GraphQLClient): CoreSdk {
    return getCoreSdk(client);
  }
}

export class CctClient extends BaseClient<CctSdk> {
  constructor() {
    super(ServiceType.CCT);
  }

  protected createSdk(client: GraphQLClient): CctSdk {
    return getCctSdk(client);
  }
}

class PetLinkInfrastructure {
  readonly core = new CoreClient();
  readonly cct = new CctClient();

  reset(): void {
    AuthHelper.clearTokenCache();
    this.core.clearLocalCache();
    this.cct.clearLocalCache();
    console.log("🔄 Token & SDK cache cleared");
  }
}

export const petlink = new PetLinkInfrastructure();
