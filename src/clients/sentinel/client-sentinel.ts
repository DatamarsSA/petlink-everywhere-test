import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
import { logger } from "../../config/logger.js";
import { Packet01, SirfProtocol, parsePacketByType, ParsedPacket } from "./packet-encode-decode.js";

/**
 * ==================== SIRF PROTOCOL LEGEND ====================
 * [HEADER: (2bytes) A0A2]
 * [LEN: (2bytes) SIZE] ← length of payload (includes PACKET_TYPE)
 * [PAYLOAD: (variable length bytes) TOTAL]
 *    └─ [PACKET_TYPE: (1byte) 0x01] ← FIRST byte of payload
 *    └─ [KIPPY_DATA: (N bytes) REST] ← serialNumber, IMEI, GPS, etc
 * [CRC: (2bytes) CHECKSUM]
 * [FOOTER: (2bytes) B0B3]
 */

// ================================ CONSTANTS ================================ //

const PROTOCOL = {
  HEADER: Buffer.from([0xa0, 0xa2]), // 2 bytes
  LENGTH_FIELD: 2, // 2 bytes
  CRC: 2, // 2 bytes
  FOOTER: Buffer.from([0xb0, 0xb3]), // 2 bytes
} as const;

// ================================ SENTINEL PACKET TYPES ================================ //

export enum SentinelPacketType {
  PACKET_0x01 = 0x01,
  PACKET_0x0A = 0x0a,
  PACKET_0x10 = 0x10,
  PACKET_0x15 = 0x15,
}

// ================================ 3. CLIENT (Network & Logic) ================================ //

export class SentinelTcpClient {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private events = new EventEmitter();

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
   * Send packet (Rust-like: pass payload object, log before serialization)
   */
  async send(data: Buffer, payload?: any): Promise<void> {
    if (!this.socket) throw new Error("Not connected");

    // LOG BEFORE SENDING (OUTGOING) - symmetric logging with parsed payload
    SirfProtocol.logPacket("OUTGOING", data, payload);

    this.socket.write(data);
  }

  disconnect() {
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
  async waitForPacket(type: SentinelPacketType, timeoutMs = 5000, validator?: (p: ParsedPacket) => boolean): Promise<ParsedPacket> {
    return new Promise((resolve, reject) => {
      const typeHex = `0x${type.toString(16)}`;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for packet ${typeHex}`));
      }, timeoutMs);

      const onPacket = (packet: ParsedPacket) => {
        if (packet.type === type) {
          if (!validator || validator(packet)) {
            logger.debug(`✓ Received expected packet ${typeHex}`);
            cleanup();
            resolve(packet);
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

  private handleData(chunk: Buffer) {
    // 1. Accumulo: Aggiunge i nuovi dati arrivati (chunk) al buffer esistente.
    //    TCP non garantisce che un chunk = un pacchetto. Potrebbe essere mezzo pacchetto o dieci pacchetti.
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // 2. Loop infinito: Continua a processare finché ci sono pacchetti completi nel buffer.
    while (true) {
      // 3. Ricerca Header: Cerca la sequenza di byte 0xA0, 0xA2 che indica l'inizio di un pacchetto SIRF.
      const start = this.buffer.indexOf(PROTOCOL.HEADER);
      if (start === -1) {
        // Nessun header, scarta tutto tranne l'ultimo byte se è 0xA0 (caso bordo)
        // Perché se l'ultimo byte è 0xA0, potrebbe essere la prima metà dell'header (0xA0 0xA2)
        // e il resto arriverà nel prossimo chunk.
        if (this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === PROTOCOL.HEADER[0]) {
          this.buffer = this.buffer.subarray(this.buffer.length - 1);
        } else {
          this.buffer = Buffer.alloc(0);
        }
        return;
      }

      // 4. Verifica se abbiamo abbastanza dati per leggere la lunghezza (HEADER + LENGTH_FIELD)
      const headerAndLengthSize = PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD;
      if (this.buffer.length < start + headerAndLengthSize) return;

      const len = this.buffer.readUInt16BE(start + PROTOCOL.HEADER.length);
      // 5. Calcolo Lunghezza Totale Pacchetto:
      //    Header + LENGTH_FIELD + Payload (len) + CRC + Footer
      const totalLen = PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD + len + PROTOCOL.CRC + PROTOCOL.FOOTER.length;

      // 6. Verifica se abbiamo ricevuto l'intero pacchetto
      if (this.buffer.length < start + totalLen) return;

      // 7. Estrazione Pacchetto Completo
      const rawPacket = this.buffer.subarray(start, start + totalLen);
      this.buffer = this.buffer.subarray(start + totalLen); // Avanza buffer

      // 8. Parsing Payload
      //    Il payload inizia dopo l'header e il length field, finisce prima del CRC
      const payloadStart = PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD;
      const payload: Buffer = rawPacket.subarray(payloadStart, payloadStart + len);
      const type: number = payload[0];

      try {
        // Parse with factory (manual parsing)
        const parsed = parsePacketByType(payload);

        // LOG AFTER PARSING (INCOMING) - symmetric logging with parsed payload
        SirfProtocol.logPacket("INCOMING", rawPacket, parsed.payload);

        this.events.emit("packet", parsed);
      } catch (e) {
        logger.error(`Error processing packet: ${e}`);
      }
    }
  }
}

export const sentinelTcpSocketClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});
