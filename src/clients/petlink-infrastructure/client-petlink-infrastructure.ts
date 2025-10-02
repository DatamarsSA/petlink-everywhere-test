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
import { writeFileSync } from "fs";
import { join } from "path";

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
// Performance Tracker
// ------------------------------
export type PerformanceRecord = {
  service: string;
  protocol: string;
  authType: string;
  operation: string;
  duration: number;
  timestamp: Date;
};

class PerformanceTracker {
  private static records: PerformanceRecord[] = [];

  static record(data: Omit<PerformanceRecord, "timestamp">): void {
    this.records.push({ ...data, timestamp: new Date() });
  }

  /**
   * Log performance records sorted by duration (descending).
   * @param limit - Optional limit for number of records to log. If not provided, logs all records.
   */
  static logRecords(limit?: number): void {
    if (this.records.length === 0) {
      console.log("\n=== 🚀 Performance Report ===");
      console.log("No requests tracked yet");
      return;
    }

    const sorted = [...this.records].sort((a, b) => b.duration - a.duration);
    const toLog = limit ? sorted.slice(0, limit) : sorted;

    console.log(
      `\n=== 🚀 Performance Report (${toLog.length}/${this.records.length} requests) ===`,
    );
    toLog.forEach((r, i) => {
      console.log(
        `${i + 1}. [${r.service}/${r.protocol}/${r.authType}] ${r.operation} - ${r.duration}ms`,
      );
    });

    if (this.records.length > 0) {
      const avgDuration = Math.round(
        this.records.reduce((sum, r) => sum + r.duration, 0) /
          this.records.length,
      );
      console.log(
        `\nAverage: ${avgDuration}ms | Total: ${this.records.length} requests`,
      );
    }
  }

  /**
   * Save performance records to a file for CI/CD pipeline consumption.
   * @param filePath - Path where to save the performance report
   */
  static saveToFile(filePath: string): void {
    if (this.records.length === 0) {
      const content = "=== 🚀 Performance Report ===\nNo requests tracked yet\n";
      writeFileSync(filePath, content, "utf-8");
      return;
    }

    const sorted = [...this.records].sort((a, b) => b.duration - a.duration);
    const avgDuration = Math.round(
      this.records.reduce((sum, r) => sum + r.duration, 0) /
        this.records.length,
    );

    let content = `=== 🚀 Performance Report (${sorted.length} requests) ===\n\n`;
    sorted.forEach((r, i) => {
      content += `${i + 1}. [${r.service}/${r.protocol}/${r.authType}] ${r.operation} - ${r.duration}ms\n`;
    });
    content += `\nAverage: ${avgDuration}ms | Total: ${this.records.length} requests\n`;

    writeFileSync(filePath, content, "utf-8");
  }

  static clear(): void {
    this.records = [];
  }

  static getRecords(): PerformanceRecord[] {
    return [...this.records].sort((a, b) => b.duration - a.duration);
  }
}

// ------------------------------
// Service types
// ------------------------------
export enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

export enum UtilityTestTypeEnum {
  BUY_NEW_SUBSCRIPTION = "BUY_NEW_SUBSCRIPTION",
  CLEAN_UP_USER = "CLEAN_UP_USER",
}

export enum LanguageId {
  DE = "DE",
  EN = "EN",
  ES = "ES",
  FR = "FR",
  IT = "IT",
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
          throw new Error(
            "No valid JWT token available. Please login first with loginWithEmail or loginWithPhone.",
          );
        }
        const token = AuthManager.getJwtToken();
        return {
          cacheKey: `jwt:${token}`,
          headers: { [HTTP_HEADERS.AUTHORIZATION]: token },
        };
      }

      case AuthType.IAM: {
        if (!AuthManager.hasIamCredentials()) {
          throw new Error(
            "No IAM credentials available. Please login first with loginWithIam.",
          );
        }
        const credentials = AuthManager.getIamCredentials();
        return {
          cacheKey: `iam:${credentials.accessKeyId}`,
          headers: {}, // Will be filled by middleware
        };
      }

      case AuthType.API_KEY: {
        const apiKey = EnvConfig.getApiKey(
          serviceName as unknown as ServiceType,
        );
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
  static create<TSdk extends object>(config: {
    getClient: () => Promise<TSdk>;
    serviceName: string;
    protocolName: string;
    authType: AuthType;
  }): TSdk {
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
          } finally {
            const duration = Math.round(performance.now() - startTime);
            PerformanceTracker.record({
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

  constructor(
    serviceName: string,
    endpoint: string,
    sdkFactory: (client: GraphQLClient) => TSdk,
  ) {
    super(serviceName, "graphql");
    this.endpoint = endpoint;
    this.sdkFactory = sdkFactory;
  }

  protected async getOrCreateSdk(authType: AuthType): Promise<TSdk> {
    // Use AuthHeadersBuilder to get auth config (eliminates duplication)
    const authConfig = await AuthHeadersBuilder.build(
      authType,
      this.serviceName,
    );

    // Use CacheManager to get or create SDK (eliminates cache duplication)
    return this.cache.getOrCreate(authConfig.cacheKey, async () => {
      const clientOptions: {
        headers: Record<string, string>;
        requestMiddleware?: RequestMiddleware;
      } = { headers: authConfig.headers };

      // IAM requires middleware because signature depends on request body
      if (authType === AuthType.IAM) {
        clientOptions.requestMiddleware = async (request) => {
          const body =
            typeof request.body === "string"
              ? request.body
              : JSON.stringify(request.body) || "";
          const signedHeaders = await AuthManager.generateIamAuthHeaders(
            this.endpoint,
            body,
          );
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
    this.graphql = new GraphQLProtocol(
      "CORE",
      EnvConfig.getEndpoint(ServiceType.CORE),
      (client) => getCoreSdk(client),
    );
  }

  clearCache(): void {
    this.graphql.clearCache();
  }
}

class CctService {
  readonly graphql: GraphQLProtocol<CctSdk>;

  constructor() {
    this.graphql = new GraphQLProtocol(
      "CCT",
      EnvConfig.getEndpoint(ServiceType.CCT),
      (client) => getCctSdk(client),
    );
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

  // --- Utilities ---
  reset(): void {
    AuthManager.clearCache();
    this.core.clearCache();
    this.cct.clearCache();
  }

  // --- Performance Tracking ---
  /**
   * Log performance records sorted by duration (descending).
   * @param limit - Optional limit for number of records to log. If not provided, logs all records.
   */
  logPerformance(limit?: number): void {
    PerformanceTracker.logRecords(limit);
  }

  /**
   * Save performance records to a file for CI/CD pipeline consumption.
   * @param filePath - Path where to save the performance report
   */
  savePerformanceToFile(filePath: string): void {
    PerformanceTracker.saveToFile(filePath);
  }

  clearPerformanceData(): void {
    PerformanceTracker.clear();
  }

  getPerformanceRecords(): PerformanceRecord[] {
    return PerformanceTracker.getRecords();
  }
}

export const petlink = new PetLinkInfrastructure();
