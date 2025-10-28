import { GraphQLClient, RequestMiddleware } from "graphql-request";
import { getSdk as getCoreSdk, Sdk as CoreSdk } from "./endpoints/graphql/generated/core_schema.js";
import { getSdk as getCctSdk, Sdk as CctSdk } from "./endpoints/graphql/generated/cct_schema.js";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { performanceTracker } from "../../helpers/helper-performance-tracker.js";
import { logger } from "../../config/logger.js";

// ------------------------------
// HTTP header constants
// ------------------------------
const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  API_KEY: "x-api-key",
  X_AMZ_DATE: "X-Amz-Date",
  X_AMZ_SECURITY_TOKEN: "X-Amz-Security-Token",
};

// ------------------------------
// Service types
// ------------------------------
enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

// ------------------------------
// Auth types
// ------------------------------
enum AuthType {
  JWT = "jwt",
  IAM = "iam",
  API_KEY = "apiKey",
}

type IamCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

// ------------------------------
// Env config helper
// ------------------------------
class EnvConfig {
  static getEndpoint(service: ServiceType): string {
    return process.env[`${service}_GRAPHQL_API_URL`]!;
  }

  static getApiKey(service: ServiceType): string {
    return process.env[`${service}_GRAPHQL_API_KEY`]!;
  }

  static getCognitoConfig() {
    return {
      region: process.env.COGNITO_REGION!,
      clientId: process.env.COGNITO_CLIENT_ID!,
    };
  }

  static getAwsRegion(): string {
    return process.env.AWS_REGION!;
  }
}

// ------------------------------
// Reusable Components (Composition Pattern)
// ------------------------------

/**
 * Generic cache manager for any client type.
 * Handles get-or-create pattern with async factory.
 */
class CacheManager<T> {
  private cache = new Map<string, T>();

  async getOrCreate(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const value = await factory();
    this.cache.set(key, value);
    return value;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Centralized auth headers builder for all auth types.
 * Eliminates duplication across protocols.
 */
class AuthHeadersBuilder {
  static async build(
    authType: AuthType,
    serviceName: string,
  ): Promise<{
    cacheKey: string;
    headers: Record<string, string>;
    middleware?: RequestMiddleware;
  }> {
    switch (authType) {
      case AuthType.JWT: {
        if (!AuthManager.hasValidJwtToken()) {
          throw new Error("No valid JWT token available. Please login first with loginWithEmail or loginWithPhone.");
        }
        const token = AuthManager.getJwtToken();
        return {
          cacheKey: `jwt:${token}`,
          headers: { [HTTP_HEADERS.AUTHORIZATION]: token },
        };
      }

      case AuthType.IAM: {
        if (!AuthManager.hasIamCredentials()) {
          throw new Error("No IAM credentials available. Please login first with loginWithIam.");
        }
        const credentials = AuthManager.getIamCredentials();
        return {
          cacheKey: `iam:${credentials.accessKeyId}`,
          headers: {}, // Will be filled by middleware
        };
      }

      case AuthType.API_KEY: {
        const apiKey = EnvConfig.getApiKey(serviceName as unknown as ServiceType);
        if (!apiKey) throw new Error(`[${serviceName}] API Key not found`);
        return {
          cacheKey: `apiKey:${apiKey}`,
          headers: { [HTTP_HEADERS.API_KEY]: apiKey },
        };
      }

      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }
  }
}

/**
 * Factory for creating performance-tracked proxies.
 * Wraps any SDK with automatic performance monitoring.
 */
class ProxyFactory {
  static create<TSdk extends object>(config: { getClient: () => Promise<TSdk>; serviceName: string; protocolName: string; authType: AuthType }): TSdk {
    return new Proxy({} as TSdk, {
      get: (_target, prop) => {
        return async (...args: any[]) => {
          const client = await config.getClient();
          const member = (client as any)[prop];
          if (typeof member !== "function") return member;

          // Track performance
          const startTime = performance.now();
          try {
            return await member(...args);
          } catch (error: any) {
            logger.error(`[${config.serviceName}/${config.protocolName}/${config.authType}] Error in ${String(prop)}`, {
              operation: String(prop),
              response: error.response?.errors,
              statusCode: error.response?.status,
              message: error.message,
            });

            throw error;
          } finally {
            const duration = Math.round(performance.now() - startTime);
            performanceTracker.recordPerformance({
              service: config.serviceName,
              protocol: config.protocolName,
              authType: config.authType,
              operation: String(prop),
              duration,
            });
          }
        };
      },
    }) as TSdk;
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
  static async authenticateWithJwt(username: string, password: string, authMethod: "email" | "phone_number"): Promise<void> {
    try {
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
          // appBrand: appBrand,
          method: authMethod,
          username: username,
        },
      });

      const response = await client.send(command);
      const token = response.AuthenticationResult?.IdToken;

      if (!token) {
        throw new Error(`Failed to get ID token from Cognito for user: ${username}`);
      }

      this.jwtToken = this.createTokenCacheEntry(token);
    } catch (error: any) {
      logger.error(`[AUTH] Failed to authenticate user ${username} via ${authMethod}`, {
        error: error.message,
        code: error.code || error.name,
        username,
        authMethod,
      });
      throw error;
    }
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
      throw new Error("IAM credentials not set. Please call loginWithIam first.");
    }
    return this.iamCredentials!;
  }

  /**
   * Build SigV4 headers for AppSync request.
   */
  static async generateIamAuthHeaders(endpoint: string, body: string): Promise<Record<string, string>> {
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
// Base Protocol (Simplified with Composition)
// ------------------------------
abstract class BaseProtocol<TSdk extends object> {
  protected serviceName: string;
  protected protocolName: string;
  protected cache: CacheManager<TSdk>;

  protected constructor(serviceName: string, protocolName: string) {
    this.serviceName = serviceName;
    this.protocolName = protocolName;
    this.cache = new CacheManager<TSdk>();
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Create a proxy that lazily resolves the underlying SDK bound to the chosen auth.
   * Uses ProxyFactory for automatic performance tracking.
   */
  protected makeSdkProxy(authType: AuthType): TSdk {
    return ProxyFactory.create({
      getClient: () => this.getOrCreateSdk(authType),
      serviceName: this.serviceName,
      protocolName: this.protocolName,
      authType,
    });
  }

  /**
   * Resolve or create the underlying SDK configured with the right auth headers/middleware.
   */
  protected abstract getOrCreateSdk(authType: AuthType): Promise<TSdk>;

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
}

// ------------------------------
// GraphQL Protocol Implementation (Simplified with Composition)
// ------------------------------
class GraphQLProtocol<TSdk extends object> extends BaseProtocol<TSdk> {
  private endpoint: string;
  private sdkFactory: (client: GraphQLClient) => TSdk;

  constructor(serviceName: string, endpoint: string, sdkFactory: (client: GraphQLClient) => TSdk) {
    super(serviceName, "graphql");
    this.endpoint = endpoint;
    this.sdkFactory = sdkFactory;
  }

  protected async getOrCreateSdk(authType: AuthType): Promise<TSdk> {
    // Use AuthHeadersBuilder to get auth config (eliminates duplication)
    const authConfig = await AuthHeadersBuilder.build(authType, this.serviceName);

    // Use CacheManager to get or create SDK (eliminates cache duplication)
    return this.cache.getOrCreate(authConfig.cacheKey, async () => {
      const clientOptions: {
        headers: Record<string, string>;
        requestMiddleware?: RequestMiddleware;
      } = { headers: authConfig.headers };

      // IAM requires middleware because signature depends on request body
      if (authType === AuthType.IAM) {
        clientOptions.requestMiddleware = async (request) => {
          const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body) || "";
          const signedHeaders = await AuthManager.generateIamAuthHeaders(this.endpoint, body);
          return {
            ...request,
            headers: { ...request.headers, ...signedHeaders },
          };
        };
      }

      const client = new GraphQLClient(this.endpoint, clientOptions);
      return this.sdkFactory(client);
    });
  }
}

// ------------------------------
// Service Containers
// ------------------------------
class CoreService {
  readonly graphql: GraphQLProtocol<CoreSdk>;

  constructor() {
    this.graphql = new GraphQLProtocol("CORE", EnvConfig.getEndpoint(ServiceType.CORE), (client) => getCoreSdk(client));
  }

  clearCache(): void {
    this.graphql.clearCache();
  }
}

class CctService {
  readonly graphql: GraphQLProtocol<CctSdk>;

  constructor() {
    this.graphql = new GraphQLProtocol("CCT", EnvConfig.getEndpoint(ServiceType.CCT), (client) => getCctSdk(client));
  }

  clearCache(): void {
    this.graphql.clearCache();
  }
}

// ------------------------------
// PetLink Infrastructure (Facade)
// ------------------------------
export class PetLinkInfrastructure {
  readonly core: CoreService;
  readonly cct: CctService;

  constructor() {
    this.loginWithIam(process.env.AWS_ACCESS_KEY_ID!, process.env.AWS_SECRET_ACCESS_KEY!);
    this.core = new CoreService();
    this.cct = new CctService();
  }

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

  /**
   * Clear all authentication state and cached clients.
   * Should be called between test suites to ensure clean state.
   */
  clearAllCache(): void {
    AuthManager.clearCache();
    this.core.clearCache();
    this.cct.clearCache();
  }
}

export const petlink = new PetLinkInfrastructure();
