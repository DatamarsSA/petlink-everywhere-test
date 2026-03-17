import { GraphQLClient } from "graphql-request";
import { getSdk as getCoreSdk, Sdk as CoreSdk } from "./endpoints/graphql/generated/core_schema.js";
import { getSdk as getCctSdk, Sdk as CctSdk } from "./endpoints/graphql/generated/cct_schema.js";
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { logger } from "../../config/logger.js";
import { fxt } from "../../fixtures/fixtures.js";
import WebSocket from "ws";
import { performanceTracker } from "../../helpers/helper-performance-tracker.js";
import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
import {
  DeviceIdentity,
  PacketEvoExtraData,
  PacketGeofenceResponse,
  PacketType,
  PacketTypeMap,
  PacketWelcomeAck,
  PacketWelcomeHeartBeat,
  ParsedPacket,
  parsePacketByType,
  SIRF,
  SirfProtocol,
} from "./packets-sentinel/packets.js";
import { DocumentNode, print } from "graphql";

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

type WsClientConfig = {
  serviceName: ServiceType;
  endpoint: string;
  apiKey: string;
  jwtProvider: JwtAuthProvider;
};

type HttpClientConfig<TSdk extends object> = {
  serviceName: ServiceType;
  endpoint: string;
  apiKey: string;
  jwtProvider: JwtAuthProvider;
  iamProvider: IamAuthProvider;
  createSdk: (client: GraphQLClient) => TSdk;
};

type WsSubscribeFn = <T = any>(
  query: DocumentNode,
  variables: Record<string, any>,
  timeoutError: string,
  filter?: (data: any) => boolean,
  onReady?: () => Promise<void>,
  timeoutMs?: number,
) => Promise<T>;

type GraphQLWSClient = {
  authJwt: { subscribeUntil: WsSubscribeFn };
  authApiKey: { subscribeUntil: WsSubscribeFn };
  disconnect: () => void;
};

type GraphQLHttpClient<TSdk extends object> = {
  authJwt: TSdk;
  authIam: TSdk;
  public: TSdk;
  clearCache: () => void;
};

enum ServiceType {
  CORE = "CORE",
  CCT = "CCT",
}

// === Auth ===

class JwtAuthProvider {
  private token: { token: string; expiry: Date } | null = null;

  constructor(
    private serviceLabel: string,
    private cognitoRegion: string,
    private cognitoClientId: string,
  ) {}

  /**
   * Authenticate via Cognito user pools and cache the ID token.
   */
  async authenticate(username: string, password: string, authMethod: "email" | "phone_number"): Promise<void> {
    try {
      const client = new CognitoIdentityProviderClient({ region: this.cognitoRegion });

      const command = new InitiateAuthCommand({
        ClientId: this.cognitoClientId,
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
        throw new Error(`[${this.serviceLabel}] Failed to get ID token from Cognito for user: ${username}`);
      }

      this.token = this.createTokenCacheEntry(idToken);
    } catch (error: any) {
      logger.error(`[AUTH/JWT/${this.serviceLabel}] Failed to authenticate user ${username} via ${authMethod}`, {
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
      throw new Error(`[${this.serviceLabel}] No valid JWT token available. Please login first.`);
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
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly awsRegion: string;

  constructor() {
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
    this.awsRegion = process.env.AWS_REGION!;
  }

  /**
   * Build SigV4 headers for AppSync request.
   */
  async signRequest(endpoint: string, body: string): Promise<Record<string, string>> {
    const signer = new SignatureV4({
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      region: this.awsRegion,
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

// === Protocols ===

const createGraphQlWSClient = (config: WsClientConfig): GraphQLWSClient => {
  class WSClient {
    private authType: AuthType.JWT | AuthType.API_KEY | null = null;
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

    private async ensureConnected(authType: AuthType.JWT | AuthType.API_KEY): Promise<void> {
      // Controlla se auth è cambiata
      if (this.ws && this.isConnected) {
        if (authType === this.authType) {
          logger.debug("Reusing existing WebSocket connection");
          return;
        }

        // Auth cambiata, chiudi socket esistente
        logger.debug("Auth type changed, reconnecting WebSocket");
        this.disconnect();
      }

      this.authType = authType;

      const host = new URL(config.endpoint).host;
      const wsUrl = config.endpoint.replace("https://", "wss://").replace("appsync-api", "appsync-realtime-api");

      let tokenOrKey = "";
      if (authType === AuthType.JWT) {
        tokenOrKey = config.jwtProvider.getToken();
      } else {
        tokenOrKey = config.apiKey;
      }

      const connectionHeaders =
        authType === AuthType.JWT
          ? { [HTTP_HEADERS.HOST]: host, [HTTP_HEADERS.AUTHORIZATION]: tokenOrKey }
          : { [HTTP_HEADERS.HOST]: host, [HTTP_HEADERS.API_KEY]: tokenOrKey };

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
      authType: AuthType.JWT | AuthType.API_KEY,
      query: DocumentNode,
      variables: Record<string, any>,
      timeoutError: string,
      filter?: (data: any) => boolean,
      onReady?: () => Promise<void>,
      timeoutMs: number = fxt.socket.timeoutMs,
    ): Promise<T> {
      return new Promise<T>(async (resolve, reject) => {
        await this.ensureConnected(authType);

        const subId = (++this.subscriptionCounter).toString();
        const queryString = print(query);
        const operationDefinition = query.definitions.find(
          (def): def is any => def.kind === "OperationDefinition" && def.operation === "subscription",
        );
        const operationName = operationDefinition?.name?.value || "unknown";

        const host = new URL(config.endpoint).host;

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
                  // Delay for AppSync in pipeline (stabilization Realtime Gateway & GraphQL Runner)
                  await new Promise((resolve) => setTimeout(resolve, 2000));
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
          authType === AuthType.JWT
            ? {
                [HTTP_HEADERS.HOST]: host,
                [HTTP_HEADERS.AUTHORIZATION]: JSON.stringify({
                  operationName,
                  variables,
                  authToken: config.jwtProvider.getToken(),
                }),
              }
            : {
                [HTTP_HEADERS.HOST]: host,
                [HTTP_HEADERS.API_KEY]: config.apiKey,
              };

        const subscriptionPayload = {
          id: subId,
          type: "start",
          payload: {
            data: JSON.stringify({ query: queryString, variables }),
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

  const makeSubscriber = (authType: AuthType.JWT | AuthType.API_KEY) => ({
    subscribeUntil: <T = any>(...args: Parameters<WsSubscribeFn>) => client.subscribeUntil<T>(authType, ...args),
  });

  return {
    authJwt: makeSubscriber(AuthType.JWT),
    authApiKey: makeSubscriber(AuthType.API_KEY),
    disconnect: () => client.disconnect(),
  };
};

const createGraphQlHttpClient = <TSdk extends object>(config: HttpClientConfig<TSdk>): GraphQLHttpClient<TSdk> => {
  const cachedSdks = new Map<string, TSdk>();

  const createAuthFacet = (authType: AuthType): TSdk => {
    return new Proxy({} as TSdk, {
      get: (_target, prop: string | symbol) => {
        return async (...args: any[]) => {
          let client: TSdk;

          switch (authType) {
            case AuthType.IAM: {
              const cacheKey = `${config.serviceName}:iam:static`;
              if (!cachedSdks.has(cacheKey)) {
                const httpClient = new GraphQLClient(config.endpoint, {
                  requestMiddleware: async (request) => {
                    const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body) || "";
                    const signedHeaders = await config.iamProvider.signRequest(config.endpoint, body);
                    return {
                      ...request,
                      headers: { ...request.headers, ...signedHeaders },
                    };
                  },
                });
                cachedSdks.set(cacheKey, config.createSdk(httpClient));
              }
              client = cachedSdks.get(cacheKey)!;
              break;
            }
            case AuthType.JWT: {
              const cacheKey = `${config.serviceName}:jwt`;
              if (!cachedSdks.has(cacheKey)) {
                const httpClient = new GraphQLClient(config.endpoint, {
                  requestMiddleware: async (request) => ({
                    ...request,
                    headers: {
                      ...request.headers,
                      [HTTP_HEADERS.AUTHORIZATION]: config.jwtProvider.getToken(),
                    },
                  }),
                });
                cachedSdks.set(cacheKey, config.createSdk(httpClient));
              }
              client = cachedSdks.get(cacheKey)!;
              break;
            }
            case AuthType.API_KEY: {
              if (!config.apiKey) {
                throw new Error(`[${config.serviceName}] API Key not found`);
              }
              const token = config.apiKey;
              const cacheKey = `${config.serviceName}:apiKey:${token}`;

              if (!cachedSdks.has(cacheKey)) {
                const httpClient = new GraphQLClient(config.endpoint, {
                  headers: { [HTTP_HEADERS.API_KEY]: token },
                });
                cachedSdks.set(cacheKey, config.createSdk(httpClient));
              }
              client = cachedSdks.get(cacheKey)!;
              break;
            }
          }

          const startTime = performance.now();
          logger.info(`🚀 [${config.serviceName}] CALLING ->: ${String(prop)}`, args);

          try {
            const response = await (client as any)[prop](...args);
            const duration = (performance.now() - startTime).toFixed(0);
            logger.info(`✅ [${config.serviceName}] SUCCESS <-: ${String(prop)} (duration ${duration}ms)`, response);
            return response;
          } catch (error: any) {
            logger.error(`❌ [${config.serviceName}] ERROR <-: ${String(prop)}`, error);
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
    clearCache: () => cachedSdks.clear(),
  };
};

// === Services ===

class CoreService {
  public readonly jwtProvider: JwtAuthProvider;
  public readonly graphqlHttp: GraphQLHttpClient<CoreSdk>;
  public readonly graphqlWS: GraphQLWSClient;

  constructor() {
    const endpoint = process.env.CORE_GRAPHQL_API_URL!;
    const apiKey = process.env.CORE_GRAPHQL_API_KEY!;

    this.jwtProvider = new JwtAuthProvider(ServiceType.CORE, process.env.COGNITO_REGION!, process.env.COGNITO_CLIENT_ID_APP_USER!);
    const iamProvider = new IamAuthProvider();

    this.graphqlHttp = createGraphQlHttpClient<CoreSdk>({
      serviceName: ServiceType.CORE,
      endpoint,
      apiKey,
      jwtProvider: this.jwtProvider,
      iamProvider,
      createSdk: getCoreSdk,
    });

    this.graphqlWS = createGraphQlWSClient({
      serviceName: ServiceType.CORE,
      endpoint,
      apiKey,
      jwtProvider: this.jwtProvider,
    });
  }

  // Login methods
  loginWithEmail(email: string, password: string) {
    return this.jwtProvider.authenticate(email, password, "email");
  }

  loginWithPhone(phone: string, password: string) {
    return this.jwtProvider.authenticate(phone, password, "phone_number");
  }

  // Cache cleanup
  clearCache() {
    this.jwtProvider.clear();
    this.graphqlHttp.clearCache();
  }
}

class CctService {
  public readonly jwtProvider: JwtAuthProvider;
  public readonly graphqlHttp: GraphQLHttpClient<CctSdk>;

  constructor() {
    const endpoint = process.env.CCT_GRAPHQL_API_URL!;
    const apiKey = process.env.CCT_GRAPHQL_API_KEY!;

    this.jwtProvider = new JwtAuthProvider(ServiceType.CCT, process.env.COGNITO_REGION!, process.env.COGNITO_CLIENT_ID_FE_CCT!);
    const iamProvider = new IamAuthProvider();

    this.graphqlHttp = createGraphQlHttpClient<CctSdk>({
      serviceName: ServiceType.CCT,
      endpoint,
      apiKey,
      jwtProvider: this.jwtProvider,
      iamProvider,
      createSdk: getCctSdk,
    });
  }

  loginWithEmail(email: string, password: string) {
    return this.jwtProvider.authenticate(email, password, "email");
  }

  clearCache() {
    this.jwtProvider.clear();
    this.graphqlHttp.clearCache();
  }
}

class SentinelService {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private events = new EventEmitter();
  private readonly config = {
    host: process.env.SENTINEL_HOST!,
    port: parseInt(process.env.SENTINEL_PORT!, 10),
  };

  /**
   * Connects to the Sentinel TCP server.
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`→ Connecting to Sentinel at ${this.config.host}:${this.config.port}`);
      this.socket = createConnection(this.config);

      this.socket.on("connect", () => {
        logger.debug("✓ Connected to Sentinel TCP server");
        resolve();
      });

      this.socket.on("data", (data) => this.handleData(data));

      this.socket.on("error", (err) => {
        logger.error(`✗ Socket error: ${err.message}`);
        reject(err);
      });

      this.socket.on("close", () => {
        logger.debug("✓ Connection closed");
      });
    });
  }

  /**
   * Disconnects from the server and stops keep-alive.
   */
  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.clearBuffer();
  }

  /**
   * Private raw sender. Handles SIRF encapsulation and final socket write.
   */
  private async sendRaw(kippyPayload: Buffer): Promise<void> {
    if (!this.socket) throw new Error("Not connected");
    const sirfPacket = SirfProtocol.encapsulate(kippyPayload);
    this.socket.write(sirfPacket);
  }

  /**
   * Logs intent and sends the encoded buffer through the socket.
   */
  private async simulateAndSend(name: string, args: any[], buffer: Buffer): Promise<void> {
    logger.info(`🚀 [SENTINEL] SIMULATING ->: ${name}`, args);
    return this.sendRaw(buffer);
  }

  /**
   * Simulator facet: provides a high-level typed API to simulate device behavior.
   */
  public readonly simulator = {
    welcome: (device: DeviceIdentity, data?: any) =>
      this.simulateAndSend("welcome", [device, data], PacketWelcomeHeartBeat.toBuffer(device, data, PacketType.PACKET_0x01)),

    heartbeat: (device: DeviceIdentity, data?: any) =>
      this.simulateAndSend("heartbeat", [device, data], PacketWelcomeHeartBeat.toBuffer(device, data, PacketType.PACKET_0x06)),

    geofenceResponse: (data: typeof PacketGeofenceResponse.Data) =>
      this.simulateAndSend("geofenceResponse", [data], PacketGeofenceResponse.toBuffer(data)),

    torch: (device: DeviceIdentity, duration: number) =>
      this.simulateAndSend(
        "torch",
        [device, duration],
        PacketEvoExtraData.toBuffer({
          evo_tasks: 0x01 | 0x10,
          torch_duration: duration,
        }),
      ),

    sound: (device: DeviceIdentity, duration: number) =>
      this.simulateAndSend(
        "sound",
        [device, duration],
        PacketEvoExtraData.toBuffer({
          evo_tasks: 0x04 | 0x10,
          sound_command: duration > 0 ? 1 : 0,
          sound_duration: duration,
        }),
      ),
  };

  /**
   * Waits for a specific packet type to arrive from the socket.
   */
  async waitForPacket<T extends keyof PacketTypeMap>(
    type: T,
    validator?: (p: PacketTypeMap[T]) => boolean,
    timeoutMs: number = fxt.socket.timeoutMs,
  ): Promise<PacketTypeMap[T]> {
    return new Promise((resolve, reject) => {
      const typeHex = `0x${type.toString(16).toUpperCase()}`;
      logger.debug(`⏳ [SENTINEL-WAIT] Started waiting for ${typeHex} (timeout: ${timeoutMs}ms)`);

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Device not received packet ${typeHex} from socket in ${timeoutMs}ms`));
      }, timeoutMs);

      const onPacket = (packet: ParsedPacket) => {
        if (packet.type === type) {
          const typedPacket = packet.payload as PacketTypeMap[T];
          if (!validator || validator(typedPacket)) {
            logger.info(`✅ [SENTINEL-WAIT] Match found for ${typeHex}`);
            cleanup();
            resolve(typedPacket);
          } else {
            logger.warn(
              `⚠️ [SENTINEL-WAIT] Received ${typeHex} but VALIDATOR FAILED\n` +
                `  ├─ Received: ${JSON.stringify(typedPacket)}\n` +
                `  └─ Status: Still waiting...`,
            );
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.events.off("packet", onPacket);
      };

      this.events.on("packet", onPacket);
    });
  }

  /**
   * Clears the internal buffer and removes all packet listeners.
   */
  public clearBuffer(): void {
    this.buffer = Buffer.alloc(0);
    this.events.removeAllListeners("packet");
  }

  /**
   * Internal data handler. Handles SIRF framing and emits parsed packets.
   */
  private handleData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 8) {
      const headerIndex = this.buffer.indexOf(SIRF.HEADER);
      if (headerIndex === -1) {
        this.buffer = Buffer.alloc(0);
        break;
      }

      if (headerIndex > 0) {
        this.buffer = this.buffer.subarray(headerIndex);
      }

      if (this.buffer.length < 4) break;

      const length = this.buffer.readUInt16BE(2);
      const totalPacketLength = length + 8;

      if (this.buffer.length < totalPacketLength) break;

      const rawPacket = this.buffer.subarray(0, totalPacketLength);
      const payload = rawPacket.subarray(4, 4 + length);

      // Verify Footer
      const footer = rawPacket.subarray(totalPacketLength - 2);
      if (!footer.equals(SIRF.FOOTER)) {
        this.buffer = this.buffer.subarray(2); // Skip bad header
        continue;
      }

      // Parse and emit
      const parsed = parsePacketByType(payload);

      // --- AUTO-ACK LOGIC ---
      // Se ricevo un comando dal server (0x01=Config, 0x10=ExtraData, 0x15=SafePlaces), rispondo subito con ACK (0x02)
      if ([PacketType.PACKET_0x01, PacketType.PACKET_0x10, PacketType.PACKET_0x15].includes(parsed.type)) {
        logger.debug(`[SENTINEL-CLIENT] Auto-ACKing packet 0x${parsed.type.toString(16).toUpperCase()}`);
        const ackBuffer = PacketWelcomeAck.toBuffer(PacketWelcomeAck.ALL_OK);
        this.sendRaw(ackBuffer).catch((err) => {
          logger.error(`[SENTINEL-CLIENT] Failed to send auto-ACK: ${err.message}`);
        });
      }

      // LOG INCOMING (Symmetric with simulator OUTGOING)
      SirfProtocol.logPacket("INCOMING", rawPacket, parsed.payload);

      this.events.emit("packet", parsed);

      this.buffer = this.buffer.subarray(totalPacketLength);
    }
  }

  /**
   * Connects to Sentinel, sends a Welcome packet (0x01), and waits for the server's response (0x01).
   * This ensures the device is fully registered in Sentinel's connection map before tests proceed.
   */
  async connectAndHandshake(device: DeviceIdentity): Promise<void> {
    await this.connect();

    // Start waiting for response BEFORE sending welcome to avoid race conditions (fast networks)
    const handshakePromise = this.waitForPacket(PacketType.PACKET_0x01, (p) => p.requested_operating_status !== undefined);

    await this.simulator.welcome(device);
    await handshakePromise;
    logger.debug("✓ Handshake completed: Device registered in Sentinel");
  }
}

class PetLinkInfrastructure {
  public readonly core: CoreService;
  public readonly cct: CctService;
  public readonly sentinel: SentinelService;

  constructor() {
    this.core = new CoreService();
    this.cct = new CctService();
    this.sentinel = new SentinelService();
  }

  logoutUser() {
    this.core.clearCache();
    this.cct.clearCache();
  }
}

export const petlink = new PetLinkInfrastructure();
