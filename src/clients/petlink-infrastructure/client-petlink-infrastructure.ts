import { GraphQLClient, RequestMiddleware } from "graphql-request";
import { getSdk as getCoreSdk, Sdk as CoreSdk } from "./endpoints/graphql/generated/core_schema.js";
import { getSdk as getCctSdk, Sdk as CctSdk } from "./endpoints/graphql/generated/cct_schema.js";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { performanceTracker } from "../../helpers/helper-performance-tracker.js";
import { logger } from "../../config/logger.js";
import WebSocket from "ws";

const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  API_KEY: "x-api-key",
  X_AMZ_DATE: "X-Amz-Date",
  X_AMZ_SECURITY_TOKEN: "X-Amz-Security-Token",
};

enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

enum AuthType {
  JWT = "jwt",
  IAM = "iam",
  API_KEY = "apiKey",
}

type IamCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

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

  static clearJwtCache(): void {
    this.jwtToken = null;
  }

  static clearIamCredentials(): void {
    this.iamCredentials = null;
  }
}

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

// GraphQL Query & Mutations
class GraphQLHttpProtocol<TSdk extends object> extends BaseProtocol<TSdk> {
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

// GraphQL Subscription (AppSync custom WebSocket)
/**
 * WebSocket client for GraphQL subscriptions (AppSync custom protocol)
 * Singleton pattern: maintains 1 persistent connection, multiplexes N subscriptions
 */
class GraphQLWSProtocol {
  private token: string | null = null;
  private apiKey: string | null = null;
  private authType: "jwt" | "apikey" | null = null;

  private ws: WebSocket | null = null;
  private isConnected = false;

  private subscriptions = new Map<
    string,
    {
      callbacks: { next: (data: any) => void; error: (err: any) => void };
      timeout: NodeJS.Timeout | null;
    }
  >();
  private subscriptionCounter = 0;

  authJwt(): this {
    this.token = AuthManager.getJwtToken();
    this.authType = "jwt";
    return this;
  }

  authApiKey(): this {
    this.apiKey = EnvConfig.getApiKey(ServiceType.CORE);
    this.authType = "apikey";
    return this;
  }

  // Ensures WebSocket connection is established (lazy connection)
  private async ensureConnected(): Promise<void> {
    if (this.ws && this.isConnected) {
      logger.debug("Reusing existing WebSocket connection");
      return;
    }

    if (!this.authType) {
      throw new Error("No authentication configured. Call authJwt() or authApiKey() first.");
    }

    const endpoint = EnvConfig.getEndpoint(ServiceType.CORE);
    const host = new URL(endpoint).host;
    const wsUrl = endpoint.replace("https://", "wss://").replace("appsync-api", "appsync-realtime-api");

    const connectionHeaders = this.authType === "jwt" ? { host, Authorization: this.token! } : { host, "x-api-key": this.apiKey! };

    const headerString = Buffer.from(JSON.stringify(connectionHeaders)).toString("base64");
    const payloadString = Buffer.from(JSON.stringify({})).toString("base64");
    const connectionUrl = `${wsUrl}?header=${headerString}&payload=${payloadString}`;

    this.ws = new WebSocket(connectionUrl, "graphql-ws");

    return new Promise((resolve, reject) => {
      this.ws!.on("open", () => {
        logger.debug("WebSocket opened, sending connection_init");
        this.ws!.send(JSON.stringify({ type: "connection_init" }));
      });

      this.ws!.on("message", (data: any) => {
        const message = JSON.parse(data.toString());
        logger.debug("WebSocket message received", { type: message.type, id: message.id });

        switch (message.type) {
          case "connection_ack":
            this.isConnected = true;
            logger.debug("WebSocket connection established");
            resolve();
            break;

          case "data": {
            const subId = message.id;
            const sub = this.subscriptions.get(subId);
            if (sub && message.payload?.data) {
              if (sub.timeout) {
                clearTimeout(sub.timeout);
                sub.timeout = null;
              }
              sub.callbacks.next({ data: message.payload.data });
            }
            break;
          }

          case "error": {
            const subId = message.id;
            const sub = this.subscriptions.get(subId);
            if (sub) {
              if (sub.timeout) {
                clearTimeout(sub.timeout);
                sub.timeout = null;
              }
              logger.error("Subscription error", { subId, errors: message.payload?.errors });
              sub.callbacks.error(new Error(message.payload?.errors?.[0]?.message || "Unknown subscription error"));
            }
            break;
          }

          case "connection_error":
            logger.error("Connection error", { payload: message.payload });
            this.isConnected = false;
            reject(new Error(`Connection error: ${JSON.stringify(message.payload)}`));
            break;

          case "start_ack":
            logger.debug("Subscription start acknowledged", { id: message.id });
            break;

          case "ka":
            logger.debug("Keep-alive received");
            break;

          default:
            logger.debug("Unknown message type", { type: message.type });
            break;
        }
      });

      this.ws!.on("error", (error: any) => {
        logger.error("WebSocket error", { error: error.message });
        this.isConnected = false;
        reject(error);
      });

      this.ws!.on("close", (code: number, reason: Buffer) => {
        logger.debug("WebSocket closed", { code, reason: reason.toString() });
        this.isConnected = false;
        this.subscriptions.clear();
      });
    });
  }

  /**
   * Subscribes to a GraphQL subscription
   * Automatically establishes connection if not already connected
   * @param query - GraphQL subscription query string
   * @param variables - Query variables
   * @param callbacks - Event handlers { next, error }
   * @param options - Optional configuration (timeoutMs for auto-timeout)
   * @returns Promise resolving to subscription handle with unsubscribe method
   */
  async subscribe(
    query: string,
    variables: Record<string, any>,
    callbacks: { next: (data: any) => void; error: (err: any) => void },
    options?: { timeoutMs?: number },
  ): Promise<{ unsubscribe: () => void }> {
    await this.ensureConnected();

    const subId = (++this.subscriptionCounter).toString();
    const operationNameMatch = query.match(/subscription\s+(\w+)/);
    const operationName = operationNameMatch ? operationNameMatch[1] : "unknown";

    const endpoint = EnvConfig.getEndpoint(ServiceType.CORE);
    const host = new URL(endpoint).host;

    let timeout: NodeJS.Timeout | null = null;

    if (options?.timeoutMs) {
      timeout = setTimeout(() => {
        logger.error("WebSocket timeout", { subId, timeoutMs: options.timeoutMs });
        callbacks.error(new Error(`Timeout: no event received in ${options.timeoutMs}ms`));
        this.subscriptions.delete(subId);
      }, options.timeoutMs);
    }

    this.subscriptions.set(subId, { callbacks, timeout });

    const authPayload =
      this.authType === "jwt"
        ? {
            host,
            Authorization: JSON.stringify({
              operationName,
              variables,
              authToken: this.token,
            }),
          }
        : {
            host,
            "x-api-key": this.apiKey!,
          };

    const subscriptionPayload = {
      id: subId,
      type: "start",
      payload: {
        data: JSON.stringify({ query, variables }),
        extensions: {
          authorization: authPayload,
        },
      },
    };

    this.ws!.send(JSON.stringify(subscriptionPayload));
    logger.debug("Subscription started", { subId, operationName, variables });

    return {
      unsubscribe: () => {
        const sub = this.subscriptions.get(subId);
        if (sub?.timeout) {
          clearTimeout(sub.timeout);
        }
        this.subscriptions.delete(subId);

        if (this.isConnected) {
          this.ws!.send(JSON.stringify({ type: "stop", id: subId }));
        }
        logger.debug("Subscription unsubscribed", { subId });
      },
    };
  }

  /**
   * Disconnects WebSocket and cleans up all subscriptions
   * Call this in afterAll() to cleanup after tests
   */
  disconnect(): void {
    if (this.ws) {
      this.subscriptions.forEach((sub) => {
        if (sub.timeout) {
          clearTimeout(sub.timeout);
        }
      });
      this.subscriptions.clear();

      this.ws.close();
      this.ws = null;
      this.isConnected = false;

      logger.debug("WebSocket disconnected (all subscriptions closed)");
    }
  }
}

class CoreService {
  readonly graphqlHttp: GraphQLHttpProtocol<CoreSdk>;
  readonly graphqlWS: GraphQLWSProtocol;

  constructor() {
    this.graphqlHttp = new GraphQLHttpProtocol("CORE", EnvConfig.getEndpoint(ServiceType.CORE), (client) => getCoreSdk(client));
    this.graphqlWS = new GraphQLWSProtocol();
  }

  clearCache(): void {
    this.graphqlHttp.clearCache();
  }
}

class CctService {
  readonly graphql: GraphQLHttpProtocol<CctSdk>;

  constructor() {
    this.graphql = new GraphQLHttpProtocol("CCT", EnvConfig.getEndpoint(ServiceType.CCT), (client) => getCctSdk(client));
  }

  clearCache(): void {
    this.graphql.clearCache();
  }
}

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
   * Clears user-specific authentication (JWT) and related clients,
   * simulating a user logout.
   */
  logoutUser(): void {
    AuthManager.clearJwtCache();
    this.core.clearCache();
    this.cct.clearCache();
  }

  cleanIamCredentials(): void {
    AuthManager.clearIamCredentials();
  }

  /**
   * [DEBUG] Returns the current authentication state of the client.
   * Useful for debugging and advanced test assertions.
   */
  getCurrentAuthState(): {
    isUserLoggedIn: boolean;
    hasIamCredentials: boolean;
    jwtToken?: string;
  } {
    return {
      isUserLoggedIn: AuthManager.hasValidJwtToken(),
      hasIamCredentials: AuthManager.hasIamCredentials(),
      jwtToken: AuthManager.hasValidJwtToken() ? AuthManager.getJwtToken() : undefined,
    };
  }
}

export const petlink = new PetLinkInfrastructure();
