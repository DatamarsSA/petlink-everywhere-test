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
  CONTENT_TYPE: "Content-Type",
  HOST: "host",
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

// ============================================
// Auth Config Type (needed by HTTP Protocol Factory)
// ============================================
type AuthConfig = {
  cacheKey: string;
  headers: Record<string, string>;
  middleware?: RequestMiddleware;
};

// ============================================
// HTTP Protocol Factory (Generic for GraphQL, REST, etc.)
// ============================================
type HttpProtocolConfig<TClient extends object, TSdk extends object> = {
  serviceName: string;
  endpoint: string;
  createClient: (authConfig: AuthConfig) => Promise<TClient>;
  createSdk: (client: TClient) => TSdk;
};

type HttpProtocol<TSdk extends object> = {
  authJwt: TSdk;
  authIam: TSdk;
  public: TSdk;
  clearCache: () => void;
};

const createHttpProtocol = <TClient extends object, TSdk extends object>(config: HttpProtocolConfig<TClient, TSdk>): HttpProtocol<TSdk> => {
  const cache = new Map<string, TSdk>();

  const createAuthFacet = (authType: AuthType): TSdk => {
    return new Proxy({} as TSdk, {
      get: (_target, prop: string | symbol) => {
        return async (...args: any[]) => {
          // Build auth config for this auth type
          const authConfig = await buildAuthConfig(authType, config.serviceName, config.endpoint);

          // Get or create client from cache
          let client = cache.get(authConfig.cacheKey);
          if (!client) {
            const httpClient = await config.createClient(authConfig);
            client = config.createSdk(httpClient);
            cache.set(authConfig.cacheKey, client);
          }

          // Execute operation with performance tracking
          const startTime = performance.now();
          try {
            return await (client as any)[prop](...args);
          } catch (error: any) {
            logger.error(`[${config.serviceName}/graphql/${authType}] Error in ${String(prop)}`, {
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
              protocol: "graphql",
              authType,
              operation: String(prop),
              duration,
            });
          }
        };
      },
    }) as TSdk;
  };

  return {
    authJwt: createAuthFacet(AuthType.JWT),
    authIam: createAuthFacet(AuthType.IAM),
    public: createAuthFacet(AuthType.API_KEY),
    clearCache: () => cache.clear(),
  };
};

// ============================================
// Auth Config Builder Function
// ============================================
const buildAuthConfig = async (authType: AuthType, serviceName: string, endpoint?: string): Promise<AuthConfig> => {
  switch (authType) {
    case AuthType.JWT: {
      if (!AuthManager.jwt.hasValidToken()) {
        throw new Error("No valid JWT token available. Please login first with loginWithEmail or loginWithPhone.");
      }
      const token = AuthManager.jwt.getToken();
      return {
        cacheKey: `jwt:${token}`,
        headers: { [HTTP_HEADERS.AUTHORIZATION]: token },
      };
    }

    case AuthType.IAM: {
      if (!AuthManager.iam.hasCredentials()) {
        throw new Error("No IAM credentials available. Please login first with loginWithIam.");
      }
      const credentials = AuthManager.iam.getCredentials();
      return {
        cacheKey: `iam:${credentials.accessKeyId}`,
        headers: {}, // Will be filled by middleware
        middleware: async (request) => {
          const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body) || "";
          const signedHeaders = await AuthManager.iam.signRequest(endpoint!, body);
          return {
            ...request,
            headers: { ...request.headers, ...signedHeaders },
          };
        },
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
};

// ============================================
// Auth Providers (Separated by Auth Type)
// ============================================

/**
 * JWT Authentication Provider
 * Handles Cognito user pool authentication and token management
 */
class JwtAuthProvider {
  private token: { token: string; expiry: Date } | null = null;

  /**
   * Authenticate via Cognito user pools and cache the ID token.
   */
  async authenticate(username: string, password: string, authMethod: "email" | "phone_number"): Promise<void> {
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
          method: authMethod,
          username: username,
        },
      });

      const response = await client.send(command);
      const idToken = response.AuthenticationResult?.IdToken;

      if (!idToken) {
        throw new Error(`Failed to get ID token from Cognito for user: ${username}`);
      }

      this.token = this.createTokenCacheEntry(idToken);
    } catch (error: any) {
      logger.error(`[AUTH/JWT] Failed to authenticate user ${username} via ${authMethod}`, {
        error: error.message,
        code: error.code || error.name,
        username,
        authMethod,
      });
      throw error;
    }
  }

  hasValidToken(): boolean {
    return !!this.token && this.token.expiry > new Date();
  }

  getToken(): string {
    if (!this.hasValidToken()) {
      throw new Error("No valid JWT token available. Please login first.");
    }
    return this.token!.token;
  }

  clear(): void {
    this.token = null;
  }

  /**
   * Decode JWT exp claim and compute a safe expiry with clock skew.
   */
  private createTokenCacheEntry(token: string): { token: string; expiry: Date } {
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
}

/**
 * IAM Authentication Provider
 * Handles AWS IAM credentials and SigV4 request signing
 */
class IamAuthProvider {
  private credentials: IamCredentials | null = null;

  setCredentials(credentials: IamCredentials): void {
    this.credentials = credentials;
  }

  hasCredentials(): boolean {
    return !!this.credentials;
  }

  getCredentials(): IamCredentials {
    if (!this.hasCredentials()) {
      throw new Error("IAM credentials not set. Please call loginWithIam first.");
    }
    return this.credentials!;
  }

  /**
   * Build SigV4 headers for AppSync request.
   */
  async signRequest(endpoint: string, body: string): Promise<Record<string, string>> {
    const credentials = this.getCredentials();

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
        [HTTP_HEADERS.CONTENT_TYPE]: "application/json",
        [HTTP_HEADERS.HOST]: url.host,
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

  clear(): void {
    this.credentials = null;
  }
}

/**
 * AuthManager - Central authentication orchestrator
 * Provides unified access to different auth providers
 */
class AuthManager {
  static readonly jwt = new JwtAuthProvider();
  static readonly iam = new IamAuthProvider();

  /**
   * Clear all authentication state
   */
  static clearAll(): void {
    this.jwt.clear();
    this.iam.clear();
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
    this.token = AuthManager.jwt.getToken();
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

    const connectionHeaders =
      this.authType === "jwt"
        ? { [HTTP_HEADERS.HOST]: host, [HTTP_HEADERS.AUTHORIZATION]: this.token! }
        : { [HTTP_HEADERS.HOST]: host, [HTTP_HEADERS.API_KEY]: this.apiKey! };

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
          [HTTP_HEADERS.HOST]: host,
          [HTTP_HEADERS.AUTHORIZATION]: JSON.stringify({
            operationName,
            variables,
            authToken: this.token,
          }),
        }
        : {
          [HTTP_HEADERS.HOST]: host,
          [HTTP_HEADERS.API_KEY]: this.apiKey!,
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
  readonly graphqlHttp: HttpProtocol<CoreSdk>;
  readonly graphqlWS: GraphQLWSProtocol;

  constructor() {
    this.graphqlHttp = createHttpProtocol<GraphQLClient, CoreSdk>({
      serviceName: "CORE",
      endpoint: EnvConfig.getEndpoint(ServiceType.CORE),
      createClient: async (authConfig) =>
        new GraphQLClient(EnvConfig.getEndpoint(ServiceType.CORE), {
          headers: authConfig.headers,
          requestMiddleware: authConfig.middleware,
        }),
      createSdk: (client) => getCoreSdk(client),
    });
    this.graphqlWS = new GraphQLWSProtocol();
  }

  clearCache(): void {
    this.graphqlHttp.clearCache();
  }
}

class CctService {
  readonly graphqlHttp: HttpProtocol<CctSdk>;

  constructor() {
    this.graphqlHttp = createHttpProtocol<GraphQLClient, CctSdk>({
      serviceName: "CCT",
      endpoint: EnvConfig.getEndpoint(ServiceType.CCT),
      createClient: async (authConfig) =>
        new GraphQLClient(EnvConfig.getEndpoint(ServiceType.CCT), {
          headers: authConfig.headers,
          requestMiddleware: authConfig.middleware,
        }),
      createSdk: (client) => getCctSdk(client),
    });
  }

  clearCache(): void {
    this.graphqlHttp.clearCache();
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
    await AuthManager.jwt.authenticate(email, password, "email");
  }

  async loginWithPhone(phone: string, password: string): Promise<void> {
    await AuthManager.jwt.authenticate(phone, password, "phone_number");
  }

  loginWithIam(accessKeyId: string, secretAccessKey: string): void {
    AuthManager.iam.setCredentials({ accessKeyId, secretAccessKey });
  }

  /**
   * Clears user-specific authentication (JWT) and related clients,
   * simulating a user logout.
   */
  logoutUser(): void {
    AuthManager.jwt.clear();
    this.core.clearCache();
    this.cct.clearCache();
  }

  cleanIamCredentials(): void {
    AuthManager.iam.clear();
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
      isUserLoggedIn: AuthManager.jwt.hasValidToken(),
      hasIamCredentials: AuthManager.iam.hasCredentials(),
      jwtToken: AuthManager.jwt.hasValidToken() ? AuthManager.jwt.getToken() : undefined,
    };
  }
}

export const petlink = new PetLinkInfrastructure();
