import { GraphQLClient, RequestMiddleware } from "graphql-request";
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
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { env } from "../../config/env-schema-validation.js";

// ------------------------------
// HTTP header constants
// ------------------------------
export const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  API_KEY: "x-api-key",
  X_AMZ_DATE: "X-Amz-Date",
  X_AMZ_SECURITY_TOKEN: "X-Amz-Security-Token",
};

// ------------------------------
// Service types
// ------------------------------
export enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

// ------------------------------
// Auth types
// ------------------------------
export enum AuthType {
  JWT = "jwt",
  IAM = "iam",
  API_KEY = "apiKey",
}

export type IamCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

// ------------------------------
// Env config helper
// ------------------------------
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

  static getAwsRegion(): string {
    return env.AWS_REGION;
  }
}

// ------------------------------
// Auth manager
// ------------------------------
class AuthManager {
  // Active JWT token cache
  private static jwtToken: { token: string; expiry: Date } | null = null;

  // Active IAM credentials
  private static iamCredentials: IamCredentials | null = null;

  /**
   * Authenticate via Cognito user pools and cache the ID token.
   */
  static async authenticateWithJwt(
    username: string,
    password: string,
    authMethod: "email" | "phone_number",
  ): Promise<void> {
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
      },
    });

    const response = await client.send(command);
    const token = response.AuthenticationResult?.IdToken;

    if (!token) {
      throw new Error(
        `Failed to get ID token from Cognito for user: ${username}`,
      );
    }

    this.jwtToken = this.createTokenCacheEntry(token);
  }

  /**
   * Return true if there is a non-expired JWT.
   */
  static hasValidJwtToken(): boolean {
    return !!this.jwtToken && this.jwtToken.expiry > new Date();
  }

  /**
   * Get the cached JWT token value (throws if missing/expired).
   */
  static getJwtToken(): string {
    if (!this.hasValidJwtToken()) {
      throw new Error("No valid JWT token available. Please login first.");
    }
    return this.jwtToken!.token;
  }

  /**
   * Decode exp and compute a safe expiry with clock skew.
   */
  private static createTokenCacheEntry(token: string): {
    token: string;
    expiry: Date;
  } {
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

    return { token, expiry: new Date(expiryMs) };
  }

  // ------------------------------
  // IAM credentials management
  // ------------------------------
  static setIamCredentials(credentials: IamCredentials): void {
    this.iamCredentials = credentials;
  }

  static hasIamCredentials(): boolean {
    return !!this.iamCredentials;
  }

  static getIamCredentials(): IamCredentials {
    if (!this.hasIamCredentials()) {
      throw new Error(
        "IAM credentials not set. Please call loginWithIam first.",
      );
    }
    return this.iamCredentials!;
  }

  /**
   * Build SigV4 headers for AppSync request.
   */
  static async generateIamAuthHeaders(
    endpoint: string,
    body: string,
  ): Promise<Record<string, string>> {
    const credentials = this.getIamCredentials();

    const signer = new SignatureV4({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
      region: EnvConfig.getAwsRegion(),
      service: "appsync",
      sha256: Sha256,
    });

    const url = new URL(endpoint);
    const httpRequest = new HttpRequest({
      headers: {
        "Content-Type": "application/json",
        host: url.host,
      },
      body: body,
      method: "POST",
      protocol: url.protocol,
      path: url.pathname,
      hostname: url.hostname,
    });

    const signedRequest = await signer.sign(httpRequest);
    return signedRequest.headers as Record<string, string>;
  }

  /**
   * Clear all cached auth material.
   */
  static clearCache(): void {
    this.jwtToken = null;
    this.iamCredentials = null;
  }
}

// ------------------------------
// Base client (no retry)
// ------------------------------
abstract class BaseClient<TSdk extends object> {
  protected target: ServiceType;
  private sdkCache = new Map<string, { key: string; sdk: TSdk }>();

  protected constructor(target: ServiceType) {
    this.target = target;
  }

  clearCache(): void {
    this.sdkCache.clear();
  }

  /**
   * Create a proxy that lazily resolves the underlying SDK bound to the chosen auth.
   */
  private makeSdkProxy(authType: AuthType): TSdk {
    const self = this as BaseClient<TSdk>;
    return new Proxy({} as TSdk, {
      get: (_target, prop, _recv) => {
        return async (...args: any[]) => {
          const sdk = await self.getOrCreateSdk(authType);
          const member = (sdk as any)[prop];
          if (typeof member !== "function") return member;
          return member(...args);
        };
      },
    }) as TSdk;
  }

  /**
   * Resolve or create the underlying GraphQL SDK configured with the right auth headers/middleware.
   */
  private async getOrCreateSdk(authType: AuthType): Promise<TSdk> {
    const endpoint = EnvConfig.getEndpoint(this.target);
    let cacheKey: string;
    let headers: Record<string, string>;

    switch (authType) {
      case AuthType.JWT: {
        if (!AuthManager.hasValidJwtToken()) {
          throw new Error(
            "No valid JWT token available. Please login first with loginWithEmail or loginWithPhone.",
          );
        }
        const token = AuthManager.getJwtToken();
        cacheKey = `jwt:${token}`;
        // NOTE: AppSync + Cognito usually expects the raw JWT here; if your API expects Bearer, prepend it.
        headers = { [HTTP_HEADERS.AUTHORIZATION]: token };
        break;
      }
      case AuthType.IAM: {
        if (!AuthManager.hasIamCredentials()) {
          throw new Error(
            "No IAM credentials available. Please login first with loginWithIam.",
          );
        }
        const iamCredentials = AuthManager.getIamCredentials();
        cacheKey = `iam:${iamCredentials.accessKeyId}`;
        headers = {}; // Will be filled by request middleware
        break;
      }
      case AuthType.API_KEY: {
        const apiKey = EnvConfig.getApiKey(this.target);
        if (!apiKey) throw new Error(`[${this.target}] API Key not found`);
        cacheKey = `apiKey:${apiKey}`;
        headers = { [HTTP_HEADERS.API_KEY]: apiKey };
        break;
      }
      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }

    const cached = this.sdkCache.get(cacheKey);
    if (cached) return cached.sdk;

    const clientOptions: {
      headers: Record<string, string>;
      requestMiddleware?: RequestMiddleware;
    } = {
      headers,
    };

    if (authType === AuthType.IAM) {
      clientOptions.requestMiddleware = async (request) => {
        const body =
          typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body) || "";
        const signedHeaders = await AuthManager.generateIamAuthHeaders(
          endpoint,
          body,
        );
        return {
          ...request,
          headers: {
            ...request.headers,
            ...signedHeaders,
          },
        };
      };
    }

    const client = new GraphQLClient(endpoint, clientOptions);
    const sdk = this.createSdk(client);
    this.sdkCache.set(cacheKey, { key: cacheKey, sdk });
    return sdk;
  }

  // -------------- Auth facets --------------
  get authJwt(): TSdk {
    return this.makeSdkProxy(AuthType.JWT);
  }

  get authIam(): TSdk {
    return this.makeSdkProxy(AuthType.IAM);
  }

  get public(): TSdk {
    return this.makeSdkProxy(AuthType.API_KEY);
  }

  protected abstract createSdk(client: GraphQLClient): TSdk;
}

// ------------------------------
// Concrete clients
// ------------------------------
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

// ------------------------------
// PetLink infrastructure (facade)
// ------------------------------
export class PetLinkInfrastructure {
  readonly core = new CoreClient();
  readonly cct = new CctClient();

  // --- Auth ---
  async loginWithEmail(email: string, password: string): Promise<void> {
    await AuthManager.authenticateWithJwt(email, password, "email");
  }

  async loginWithPhone(phone: string, password: string): Promise<void> {
    await AuthManager.authenticateWithJwt(phone, password, "phone_number");
  }

  loginWithIam(accessKeyId: string, secretAccessKey: string): void {
    AuthManager.setIamCredentials({ accessKeyId, secretAccessKey });
  }

  // --- Utilities ---
  reset(): void {
    AuthManager.clearCache();
    this.core.clearCache();
    this.cct.clearCache();
  }

  async deleteUser(): Promise<void> {
    await petlink.loginWithPhone(env.USER_PHONE_NUMBER, env.USER_PASSWORD);
    const user = await petlink.core.authJwt.getUser();
    petlink.loginWithIam(env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY);
    await petlink.core.authIam.utilityIntegrationTest({
      input: {
        userId: user.getUser.user!.id,
        utilityType: "CLEAN_UP_USER", //todo: put CLEAN_UP_USER and other actions in enum
      },
    });
  }
}

export const petlink = new PetLinkInfrastructure();
