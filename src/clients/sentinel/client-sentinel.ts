import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
import { logger } from "../../config/logger.js";
import {
  Packet01,
  SirfProtocol,
  parsePacketByType,
  ParsedPacket,
  SIRF,
  PacketType,
  Packet0A,
  Packet10,
  Packet15,
  PacketTypeMap,
} from "./packet-encode-decode.js";

// ================================ 3. CLIENT (Network & Logic) ================================ //

export class SentinelTcpClient {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private events = new EventEmitter();
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor(private config: { host: string; port: number }) {}

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
      // Timeout di 10 secondi per la connessione iniziale
      this.socket.setTimeout(10000);
      this.socket.on("timeout", () => {
        // Don't reject here as it might trigger on idle, just handle if needed
      });
    });
  }

  /**
   * Invia pacchetto a Sentinel.
   * @param kippyPayload - Il payload del pacchetto già serializzato in Buffer
   * @param originalPacketData - L'oggetto dati originale, usato per il logging
   */
  async send(kippyPayload: Buffer, originalPacketData: object): Promise<void> {
    if (!this.socket) throw new Error("Not connected");

    const sirfPacket = SirfProtocol.encapsulate(kippyPayload);
    SirfProtocol.logPacket("OUTGOING", sirfPacket, originalPacketData);
    this.socket.write(sirfPacket);
  }

  disconnect() {
    this.stopKeepAlive();
    this.socket?.destroy();
    this.socket = null;
  }

  clearBuffer() {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Waits for a single packet of a specific type.
   * @param type The packet type (use SentinelPacketType enum)
   * @param timeoutMs Timeout in milliseconds
   * @param validator Optional function to filter the packet
   */
  async waitForPacket<T extends PacketType>(type: T, timeoutMs = 5000, validator?: (p: PacketTypeMap[T]) => boolean): Promise<PacketTypeMap[T]> {
    // First, check the buffer for an already-received packet
    const existingPacketIndex = this.receivedPackets.findIndex((p) => {
      if (p.type !== type) return false;
      const typedPayload = p.payload as PacketTypeMap[T];
      return !validator || validator(typedPayload);
    });

    if (existingPacketIndex !== -1) {
      const [foundPacket] = this.receivedPackets.splice(existingPacketIndex, 1);
      const typeHex = `0x${type.toString(16)}`;
      logger.debug(`✓ Found pre-received expected packet ${typeHex}`);
      return Promise.resolve(foundPacket.payload as PacketTypeMap[T]);
    }

    // If not found in buffer, wait for the next one
    return new Promise((resolve, reject) => {
      const typeHex = `0x${type.toString(16)}`;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for packet ${typeHex}`));
      }, timeoutMs);

      const onPacket = (packet: ParsedPacket) => {
        if (packet.type === type) {
          const typedPacket = packet.payload as PacketTypeMap[T];
          if (!validator || validator(typedPacket)) {
            logger.debug(`✓ Received expected packet ${typeHex}`);
            cleanup();
            resolve(typedPacket);
          } else {
            logger.debug(`- Skipped packet ${typeHex} (validator failed)`);
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

  private receivedPackets: ParsedPacket[] = [];
  private handleData(chunk: Buffer) {
    // 1. Accumulo: Aggiunge i nuovi dati arrivati (chunk) al buffer esistente.
    //    TCP non garantisce che un chunk = un pacchetto. Potrebbe essere mezzo pacchetto o dieci pacchetti.
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // 2. Loop infinito: Continua a processare finché ci sono pacchetti completi nel buffer.
    while (true) {
      // 3. Ricerca Header: Cerca la sequenza di byte 0xA0, 0xA2 che indica l'inizio di un pacchetto SIRF.
      const start = this.buffer.indexOf(SIRF.HEADER);
      if (start === -1) {
        // Nessun header, scarta tutto tranne l'ultimo byte se è 0xA0 (caso bordo)
        // Perché se l'ultimo byte è 0xA0, potrebbe essere la prima metà dell'header (0xA0 0xA2)
        // e il resto arriverà nel prossimo chunk.
        if (this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === SIRF.HEADER[0]) {
          this.buffer = this.buffer.subarray(this.buffer.length - 1);
        } else {
          this.buffer = Buffer.alloc(0);
        }
        return;
      }

      // 4. Verifica se abbiamo abbastanza dati per leggere la lunghezza (HEADER + LENGTH_FIELD)
      const headerAndLengthSize = SIRF.HEADER.length + SIRF.LENGTH_FIELD;
      if (this.buffer.length < start + headerAndLengthSize) return;

      const len = this.buffer.readUInt16BE(start + SIRF.HEADER.length);
      // 5. Calcolo Lunghezza Totale Pacchetto:
      //    Header + LENGTH_FIELD + Payload (len) + CRC + Footer
      const totalLen = SIRF.HEADER.length + SIRF.LENGTH_FIELD + len + SIRF.CRC + SIRF.FOOTER.length;

      // 6. Verifica se abbiamo ricevuto l'intero pacchetto
      if (this.buffer.length < start + totalLen) return;

      // 7. Estrazione Pacchetto Completo
      const rawPacket = this.buffer.subarray(start, start + totalLen);
      this.buffer = this.buffer.subarray(start + totalLen); // Avanza buffer

      // 8. Parsing Payload (DECAPSULATE manuale)
      //    Il payload inizia dopo l'header e il length field, finisce prima del CRC
      const payloadStart = SIRF.HEADER.length + SIRF.LENGTH_FIELD;
      const payload: Buffer = rawPacket.subarray(payloadStart, payloadStart + len);
      const type: number = payload[0];

      try {
        // Parse with factory (manual parsing)
        const parsed = parsePacketByType(payload);

        // LOG AFTER PARSING (INCOMING) - symmetric logging with parsed payload
        SirfProtocol.logPacket("INCOMING", rawPacket, parsed.payload);

        this.events.emit("packet", parsed);
        this.receivedPackets.push(parsed);
      } catch (e) {
        logger.error(`Error processing packet: ${e}`);
      }
    }
  }

  /**
   * Sends a lightweight heartbeat packet to keep the TCP connection alive
   * and ensure Sentinel considers the device "socket capable".
   * @param serialNumber The device's serial number.
   */
  public async keepAlive(serialNumber: string): Promise<void> {
    // 1. Crea l'oggetto dati usando il template
    const keepAliveData = {
      ...Packet01.D2SWelcomeHeartBeat.Data,
      serial_number: serialNumber, // 2. Inserisce il serial number specifico
    };
    // 3. Invia il pacchetto
    await this.send(Packet01.D2SWelcomeHeartBeat.toBuffer(keepAliveData), keepAliveData);
    logger.debug(`✓ Sent keep-alive packet for ${serialNumber}`);
  }

  /**
   * Starts a keep-alive loop to prevent socket disconnection from Sentinel.
   * @param serialNumber The device's serial number.
   * @param intervalMs The interval in milliseconds (default: 3000).
   */
  public startKeepAlive(serialNumber: string, intervalMs = 3000): void {
    this.stopKeepAlive(); // Stop any existing loop
    logger.debug(`Starting keep-alive loop for ${serialNumber} every ${intervalMs}ms`);
    this.keepAliveInterval = setInterval(() => {
      if (this.socket?.writable) {
        this.keepAlive(serialNumber).catch((err) => {
          logger.warn(`Keep-alive interval failed: ${err.message}`);
        });
      }
    }, intervalMs);
  }

  /**
   * Stops the keep-alive loop.
   */
  public stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      logger.info("Stopping keep-alive loop");
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

export const sentinelTcpSocketClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});
