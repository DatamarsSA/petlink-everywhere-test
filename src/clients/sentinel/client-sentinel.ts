import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
import { logger } from "../../config/logger.js";
import { PacketWelcomeHeartBeat, PacketGeofenceResponse, Packet02, Packet10, SirfProtocol, parsePacketByType, ParsedPacket, SIRF, PacketTypeMap, DeviceIdentity, PacketType } from "./packets.js";
import { fxt } from "../../fixtures/fixtures.js";

export class SentinelTcpClient {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private events = new EventEmitter();

  constructor(private config: { host: string; port: number }) {}

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

      // Timeout for initial connection
      this.socket.setTimeout(10000);
      this.socket.on("timeout", () => {
        // Idle timeout handled if needed
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
  }

  /**
   * Private raw sender. Handles SIRF encapsulation and final socket write.
   * Internal logging is handled by the simulator Proxy.
   */
  private async sendRaw(kippyPayload: Buffer): Promise<void> {
    if (!this.socket) throw new Error("Not connected");
    const sirfPacket = SirfProtocol.encapsulate(kippyPayload);
    this.socket.write(sirfPacket);
  }

  /**
   * Simulator facet: provides a high-level API to simulate device behavior.
   * Uses a Proxy to automatically log intent and encode data before sending raw bytes.
   */
  public readonly simulator = new Proxy({} as any, {
    get: (_target, prop: string) => {
      // Mapping of human names to encoder functions
      const commands: Record<string, Function> = {
        welcome: (device: DeviceIdentity, data: any) => PacketWelcomeHeartBeat.toBuffer(device, data, PacketType.PACKET_0x01),
        heartbeat: (device: DeviceIdentity, data: any) => PacketWelcomeHeartBeat.toBuffer(device, data, PacketType.PACKET_0x06),
        geofenceResponse: PacketGeofenceResponse.toBuffer,
        torch: (_device: DeviceIdentity, duration: number) => {
          return Packet10.toBuffer({
            evo_tasks: 0x01 | 0x10,
            torch_duration: duration,
          });
        },
        sound: (_device: DeviceIdentity, duration: number) => {
          return Packet10.toBuffer({
            evo_tasks: 0x04 | 0x10,
            sound_command: duration > 0 ? 1 : 0,
            sound_duration: duration,
          });
        },
      };

      const encoder = commands[prop];
      if (!encoder) return undefined;

      return async (...args: any[]) => {
        // 1. Generate the binary payload using the encoder
        const buffer = encoder(...args);

        // 2. Automatic Logging (similar to GraphQL infrastructure)
        logger.info(`🚀 [SENTINEL] SIMULATING ->: ${prop}`, args);

        // 3. Send the raw bytes through the socket
        return this.sendRaw(buffer);
      };
    },
  });

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
        const ackBuffer = Packet02.toBuffer(0x01 | 0x02 | 0x04); // 0x07 = All OK
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

export const sentinelTcpSocketClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});
