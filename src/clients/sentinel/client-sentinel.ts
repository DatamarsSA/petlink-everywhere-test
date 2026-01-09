import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
import { logger } from "../../config/logger.js";
import { Packet01, SirfProtocol, parsePacketByType, ParsedPacket, SIRF, PacketTypeMap, DeviceIdentity } from "./packet-encode-decode.js";

export class SentinelTcpClient {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private events = new EventEmitter();
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor(private config: { host: string; port: number }) {}

  /**
   * Connects to the Sentinel TCP server.
   */
  async connect(): Promise<void> {
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
    this.stopKeepAlive();
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
        heartbeat: Packet01.D2SWelcomeHeartBeat.toBuffer,
        geofenceResponse: Packet01.S2DGeofenceResponse.toBuffer,
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
    timeoutMs = 5000,
    validator?: (p: PacketTypeMap[T]) => boolean,
  ): Promise<PacketTypeMap[T]> {
    return new Promise((resolve, reject) => {
      const typeHex = `0x${type.toString(16)}`;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Device not received packet ${typeHex} from socket in ${timeoutMs}ms`));
      }, timeoutMs);

      const onPacket = (packet: ParsedPacket) => {
        if (packet.type === type) {
          const typedPacket = packet.payload as PacketTypeMap[T];
          if (!validator || validator(typedPacket)) {
            logger.debug(`✓ Received expected packet ${typeHex}`);
            cleanup();
            resolve(typedPacket);
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

      // LOG INCOMING (Symmetric with simulator OUTGOING)
      SirfProtocol.logPacket("INCOMING", rawPacket, parsed.payload);

      this.events.emit("packet", parsed);

      this.buffer = this.buffer.subarray(totalPacketLength);
    }
  }

  /**
   * Sends a lightweight heartbeat packet to keep the TCP connection alive.
   * @param device The device's identity from test setup.
   */
  public async keepAlive(device: DeviceIdentity): Promise<void> {
    await this.simulator.heartbeat(device);
    logger.debug(`✓ Sent keep-alive packet for ${device.serialNumber}`);
  }

  /**
   * Starts a keep-alive loop to prevent socket disconnection from Sentinel.
   * @param device The device's identity from test setup.
   * @param intervalMs The interval in milliseconds (default: 3000).
   */
  public async startKeepAlive(device: DeviceIdentity, intervalMs = 3000): Promise<void> {
    this.stopKeepAlive();
    logger.debug(`Starting keep-alive loop for ${device.serialNumber} every ${intervalMs}ms`);
    await this.keepAlive(device);
    this.keepAliveInterval = setInterval(() => {
      if (this.socket?.writable) {
        this.keepAlive(device).catch((err) => {
          logger.error(`Keep-alive interval failed: ${err.message}`);
        });
      }
    }, intervalMs);
  }

  /**
   * Stops the keep-alive loop.
   */
  public stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      logger.debug("Stopping keep-alive loop");
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

export const sentinelTcpSocketClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});
