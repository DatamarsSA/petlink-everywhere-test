import { GraphQLClient, RequestMiddleware } from "graphql-request";
import { getSdk as getCoreSdk, Sdk as CoreSdk } from "./endpoints/graphql/generated/core_schema.js";
import { getSdk as getCctSdk, Sdk as CctSdk } from "./endpoints/graphql/generated/cct_schema.js";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { logger } from "../../config/logger.js";
import { fxt } from "../../fixtures/fixtures.js";
import WebSocket from "ws";

// === Types ===
const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  API_KEY: "x-api-key",
  CONTENT_TYPE: "Content-Type",
  HOST: "host",
};

enum AuthType {
  JWT = "jwt",
  IAM = "iam",
  API_KEY = "apiKey",
}

type IamCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

type AuthConfig = {
  cacheKey: string;
  headers: Record<string, string>;
  middleware?: RequestMiddleware;
};

type HttpProtocolConfig<TClient extends object, TSdk extends object> = {
  serviceName: ServiceType;
  endpoint: string;
  jwtProvider: JwtAuthProvider;
  iamProvider: IamAuthProvider;
  createClient: (authConfig: AuthConfig) => Promise<TClient>;
  createSdk: (client: TClient) => TSdk;
};

type HttpProtocol<TSdk extends object> = {
  authJwt: TSdk;
  authIam: TSdk;
  public: TSdk;
  clearCache: () => void;
};

enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

// === Envs ===
class EnvConfig {
  static getEndpoint(service: ServiceType): string {
    return process.env[`${service}_GRAPHQL_API_URL`]!;
  }

  static getApiKey(service: ServiceType): string {
    return process.env[`${service}_GRAPHQL_API_KEY`]!;
  }

  static getCognitoConfig(service: ServiceType) {
    const clientId = service === ServiceType.CCT ? process.env.COGNITO_CLIENT_ID_FE_CCT! : process.env.COGNITO_CLIENT_ID_APP_USER!;

    return {
      region: process.env.COGNITO_REGION!,
      clientId,
    };
  }

  static getAwsRegion(): string {
    return process.env.AWS_REGION!;
  }
}

// === Auth ===

class JwtAuthProvider {
  private token: { token: string; expiry: Date } | null = null;

  constructor(private serviceType: ServiceType) {}

  /**
   * Authenticate via Cognito user pools and cache the ID token.
   */
  async authenticate(username: string, password: string, authMethod: "email" | "phone_number"): Promise<void> {
    try {
      const config = EnvConfig.getCognitoConfig(this.serviceType);
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
        throw new Error(`[${this.serviceType}] Failed to get ID token from Cognito for user: ${username}`);
      }

      this.token = this.createTokenCacheEntry(idToken);
    } catch (error: any) {
      logger.error(`[AUTH/JWT/${this.serviceType}] Failed to authenticate user ${username} via ${authMethod}`, {
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
      throw new Error(`[${this.serviceType}] No valid JWT token available. Please login first.`);
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

class IamAuthProvider {
  private readonly credentials: IamCredentials;

  constructor() {
    this.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    };
  }

  /**
   * Build SigV4 headers for AppSync request.
   */
  async signRequest(endpoint: string, body: string): Promise<Record<string, string>> {
    const signer = new SignatureV4({
      credentials: {
        accessKeyId: this.credentials.accessKeyId,
        secretAccessKey: this.credentials.secretAccessKey,
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
}

// === Clients/Protocols ===

const createGraphQLWSProtocol = (serviceType: ServiceType, jwtProvider: JwtAuthProvider) => {
  class WSClient {
    private token: string | null = null;
    private apiKey: string | null = null;
    private authType: "jwt" | "apikey" | null = null;
    private ws: WebSocket | null = null;
    private isConnected = false;
    private subscriptions = new Map<
      string,
      {
        callbacks: { next: (data: any) => void; ready: () => Promise<void>; error: (err: any) => void };
        timeout: NodeJS.Timeout | null;
      }
    >();
    private subscriptionCounter = 0;

    setAuthJwt() {
      this.token = jwtProvider.getToken();
      this.authType = "jwt";
    }

    setAuthApiKey() {
      this.apiKey = EnvConfig.getApiKey(serviceType);
      this.authType = "apikey";
    }

    private async ensureConnected(): Promise<void> {
      // Controlla se auth è cambiata
      if (this.ws && this.isConnected) {
        const currentAuthMatches = (this.authType === "jwt" && this.token) || (this.authType === "apikey" && this.apiKey);

        if (currentAuthMatches) {
          logger.debug("Reusing existing WebSocket connection");
          return;
        }

        // Auth cambiata, chiudi socket esistente
        logger.debug("Auth type changed, reconnecting WebSocket");
        this.disconnect();
      }

      if (!this.authType) {
        throw new Error("No authentication configured.");
      }

      const endpoint = EnvConfig.getEndpoint(serviceType);
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
                sub.callbacks.next({ data: message.payload.data });
              }
              break;
            }

            case "error": {
              const subId = message.id;
              const sub = this.subscriptions.get(subId);
              if (sub) {
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

            case "start_ack": {
              const subId = message.id;
              const sub = this.subscriptions.get(subId);
              logger.debug("Subscription start acknowledged", { id: subId });
              if (sub) {
                sub.callbacks.ready();
              }
              break;
            }

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

    async subscribeUntil<T = any>(
      query: string,
      variables: Record<string, any>,
      timeoutError: string,
      filter?: (data: any) => boolean,
      onReady?: () => Promise<void>,
      timeoutMs: number = fxt.socket.timeoutMs,
    ): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        await this.ensureConnected();

        const subId = (++this.subscriptionCounter).toString();
        const operationNameMatch = query.match(/subscription\s+(\w+)/);
        const operationName = operationNameMatch ? operationNameMatch[1] : "unknown";

        const endpoint = EnvConfig.getEndpoint(serviceType);
        const host = new URL(endpoint).host;

        let timeout: NodeJS.Timeout | null = null;
        let isCleanedUp = false;

        // Cleanup function
        const cleanup = () => {
          if (isCleanedUp) return;
          isCleanedUp = true;

          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          this.subscriptions.delete(subId);

          if (this.isConnected) {
            this.ws!.send(JSON.stringify({ type: "stop", id: subId }));
          }
          logger.debug("Subscription auto-unsubscribed", { subId });
        };

        // Setup timeout (mandatory)
        timeout = setTimeout(() => {
          logger.error("GraphQl Subscription socket timeout", { subId, timeoutMs, timeoutError });
          cleanup();
          reject(new Error(timeoutError));
        }, timeoutMs);

        // Setup callbacks
        this.subscriptions.set(subId, {
          callbacks: {
            next: (event: any) => {
              const data = event.data;
              const isMatch = filter ? filter(data) : true;
              const opName = operationName || "Subscription";

              if (isMatch) {
                logger.info(`✅ [GRAPHQL-SUB] ${opName} MATCHED!`);
                cleanup();
                resolve(data);
              } else {
                logger.debug(
                  `ℹ️ [GRAPHQL-SUB] ${opName} received event but FILTER MISMATCH\n` +
                    `  ├─ Received: ${JSON.stringify(data)}\n` +
                    `  └─ Action: Still waiting...`,
                );
              }
            },
            ready: async () => {
              if (onReady) {
                try {
                  await onReady();
                } catch (err: any) {
                  logger.error("Error in onReady callback", { error: err.message });
                  cleanup();
                  reject(err);
                }
              }
            },
            error: (err: any) => {
              cleanup();
              reject(err);
            },
          },
          timeout,
        });

        // Send subscription payload
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
      });
    }

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

  const client = new WSClient();

  return {
    authJwt: {
      subscribeUntil: async <T = any>(
        query: string,
        variables: Record<string, any>,
        timeoutError: string,
        filter?: (data: any) => boolean,
        onReady?: () => Promise<void>,
        timeoutMs: number = fxt.socket.timeoutMs,
      ) => {
        client.setAuthJwt();
        return await client.subscribeUntil<T>(query, variables, timeoutError, filter, onReady, timeoutMs);
      },
    },
    authApiKey: {
      subscribeUntil: async <T = any>(
        query: string,
        variables: Record<string, any>,
        timeoutError: string,
        filter?: (data: any) => boolean,
        onReady?: () => Promise<void>,
        timeoutMs: number = fxt.socket.timeoutMs,
      ) => {
        client.setAuthApiKey();
        return await client.subscribeUntil<T>(query, variables, timeoutError, filter, onReady, timeoutMs);
      },
    },
    disconnect: () => client.disconnect(),
  };
};

const createHttpProtocol = <TClient extends object, TSdk extends object>(config: HttpProtocolConfig<TClient, TSdk>): HttpProtocol<TSdk> => {
  const cache = new Map<string, TSdk>();

  const createAuthFacet = (authType: AuthType): TSdk => {
    return new Proxy({} as TSdk, {
      get: (_target, prop: string | symbol) => {
        return async (...args: any[]) => {
          // 1. Build auth config for this auth type
          let authConfig: AuthConfig;

          switch (authType) {
            case AuthType.JWT: {
              if (!config.jwtProvider.hasValidToken()) {
                throw new Error(`[${config.serviceName}] No valid JWT token available. Please login first via ${config.serviceName}.loginWith...`);
              }
              const token = config.jwtProvider.getToken();
              authConfig = {
                cacheKey: `${config.serviceName}:jwt:${token}`,
                headers: { [HTTP_HEADERS.AUTHORIZATION]: token },
              };
              break;
            }

            case AuthType.IAM: {
              authConfig = {
                cacheKey: `${config.serviceName}:iam:static`,
                headers: {}, // Will be filled by middleware
                middleware: async (request) => {
                  const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body) || "";
                  const signedHeaders = await config.iamProvider.signRequest(config.endpoint, body);
                  return {
                    ...request,
                    headers: { ...request.headers, ...signedHeaders },
                  };
                },
              };
              break;
            }

            case AuthType.API_KEY: {
              const apiKey = EnvConfig.getApiKey(config.serviceName);
              if (!apiKey) throw new Error(`[${config.serviceName}] API Key not found`);
              authConfig = {
                cacheKey: `${config.serviceName}:apiKey:${apiKey}`,
                headers: { [HTTP_HEADERS.API_KEY]: apiKey },
              };
              break;
            }

            default:
              throw new Error(`Unsupported auth type: ${authType}`);
          }

          // 2. Create or get client from cache
          let client = cache.get(authConfig.cacheKey);
          if (!client) {
            const httpClient = await config.createClient(authConfig);
            client = config.createSdk(httpClient);
            cache.set(authConfig.cacheKey, client);
          }

          // 3. Execute operation with performance tracking and automatic logging
          const startTime = performance.now();

          // Log request details
          logger.info(`🚀 [${config.serviceName}] CALLING ->: ${String(prop)}`, args);

          try {
            const response = await (client as any)[prop](...args);

            // Log successful response
            const duration = (performance.now() - startTime).toFixed(0);
            logger.info(`✅ [${config.serviceName}] SUCCESS <-: ${String(prop)} (${duration}ms)`, response);

            return response;
          } catch (error: any) {
            logger.error(`❌ [${config.serviceName}] ERROR <-: ${String(prop)}`, error);
            throw error;
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

// === Services ===

class CoreService {
  readonly graphqlHttp: HttpProtocol<CoreSdk>;
  readonly graphqlWS: ReturnType<typeof createGraphQLWSProtocol>;
  private readonly jwtProvider: JwtAuthProvider;
  private readonly iamProvider: IamAuthProvider;

  constructor() {
    this.jwtProvider = new JwtAuthProvider(ServiceType.CORE);
    this.iamProvider = new IamAuthProvider();

    this.graphqlHttp = createHttpProtocol<GraphQLClient, CoreSdk>({
      serviceName: ServiceType.CORE,
      endpoint: EnvConfig.getEndpoint(ServiceType.CORE),
      jwtProvider: this.jwtProvider,
      iamProvider: this.iamProvider,
      createClient: async (authConfig) =>
        new GraphQLClient(EnvConfig.getEndpoint(ServiceType.CORE), {
          headers: authConfig.headers,
          requestMiddleware: authConfig.middleware,
        }),
      createSdk: (client) => getCoreSdk(client),
    });

    this.graphqlWS = createGraphQLWSProtocol(ServiceType.CORE, this.jwtProvider);
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    await this.jwtProvider.authenticate(email, password, "email");
  }

  async loginWithPhone(phone: string, password: string): Promise<void> {
    await this.jwtProvider.authenticate(phone, password, "phone_number");
  }

  clearCache(): void {
    this.jwtProvider.clear();
    this.graphqlHttp.clearCache();
  }
}

class CctService {
  readonly graphqlHttp: HttpProtocol<CctSdk>;
  private readonly jwtProvider: JwtAuthProvider;
  private readonly iamProvider: IamAuthProvider;

  constructor() {
    this.jwtProvider = new JwtAuthProvider(ServiceType.CCT);
    this.iamProvider = new IamAuthProvider();

    this.graphqlHttp = createHttpProtocol<GraphQLClient, CctSdk>({
      serviceName: ServiceType.CCT,
      endpoint: EnvConfig.getEndpoint(ServiceType.CCT),
      jwtProvider: this.jwtProvider,
      iamProvider: this.iamProvider,
      createClient: async (authConfig) =>
        new GraphQLClient(EnvConfig.getEndpoint(ServiceType.CCT), {
          headers: authConfig.headers,
          requestMiddleware: authConfig.middleware,
        }),
      createSdk: (client) => getCctSdk(client),
    });
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    await this.jwtProvider.authenticate(email, password, "email");
  }

  clearCache(): void {
    this.jwtProvider.clear();
    this.graphqlHttp.clearCache();
  }
}

class PetLinkInfrastructure {
  readonly core: CoreService;
  readonly cct: CctService;

  constructor() {
    this.core = new CoreService();
    this.cct = new CctService();
  }

  /**
   * Clears user-specific authentication (JWT) and related clients
   * for ALL services.
   */
  logoutUser(): void {
    this.core.clearCache();
    this.cct.clearCache();
  }
}

export const petlink = new PetLinkInfrastructure();
