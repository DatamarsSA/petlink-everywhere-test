// src/clients/sentinel/client-sentinel-tcp.ts

import { createConnection, Socket } from "net";
import { logger } from "../config/logger.js";

const HEADER_BYTE1 = 0xa0;
const HEADER_BYTE2 = 0xa2;
const FOOTER_BYTE1 = 0xb0;
const FOOTER_BYTE2 = 0xb3;

interface SentinelConfig {
  host: string;
  port: number;
}

/**
 * Encapsula un payload nel formato SIRF protocol
 */
function encapsulate(payload: Buffer): Buffer {
  const length = payload.length;

  if (length >= 1024) {
    throw new Error("Payload exceeds max length (1024 bytes)");
  }

  // Calcola CRC (15-bit sum)
  let crc = 0;
  for (let i = 0; i < length; i++) {
    crc += payload[i];
    crc &= 0x7fff; // Keep only 15 bits
  }

  // Costruisci il pacchetto completo
  const packet = Buffer.alloc(length + 8);

  // Header
  packet[0] = HEADER_BYTE1;
  packet[1] = HEADER_BYTE2;

  // Length (big-endian)
  packet[2] = (length >> 8) & 0xff;
  packet[3] = length & 0xff;

  // Payload
  payload.copy(packet, 4);

  // CRC (big-endian)
  packet[length + 4] = (crc >> 8) & 0xff;
  packet[length + 5] = crc & 0xff;

  // Footer
  packet[length + 6] = FOOTER_BYTE1;
  packet[length + 7] = FOOTER_BYTE2;

  return packet;
}

/**
 * Converte una stringa ASCII (es. "PETL123456") in array di bytes
 */
function stringToBytes(str: string, length: number): Buffer {
  const buf = Buffer.alloc(length);
  Buffer.from(str, "ascii").copy(buf);
  return buf;
}

/**
 * Crea il pacchetto 0x01 WELCOME
 * Versione minimale per testing
 */
function createWelcomePacket(serialNumber: string): Buffer {
  const payload = Buffer.alloc(100); // Dimensione minima per welcome
  let offset = 0;

  // Packet type
  payload[offset++] = 0x01;

  // Serial number (10 bytes)
  stringToBytes(serialNumber, 10).copy(payload, offset);
  offset += 10;

  // IMEI (15 bytes) - placeholder
  stringToBytes("123456789012345", 15).copy(payload, offset);
  offset += 15;

  // CCID (20 bytes) - placeholder
  stringToBytes("12345678901234567890", 20).copy(payload, offset);
  offset += 20;

  // FW version (3 bytes)
  payload[offset++] = 1;
  payload[offset++] = 0;
  payload[offset++] = 0;

  // Boot version (3 bytes)
  payload[offset++] = 1;
  payload[offset++] = 0;
  payload[offset++] = 0;

  // Latitude (4 bytes, int32)
  payload.writeInt32LE(0, offset);
  offset += 4;

  // Longitude (4 bytes, int32)
  payload.writeInt32LE(0, offset);
  offset += 4;

  // Altri campi opzionali possono essere aggiunti...
  // Per testing base questo è sufficiente

  return encapsulate(payload.subarray(0, offset));
}

/**
 * Crea il pacchetto 0x06 HEARTBEAT (simil-welcome)
 */
function createHeartbeatPacket(serialNumber: string): Buffer {
  // Struttura simile al welcome ma con packet type 0x06
  const payload = Buffer.alloc(100);
  let offset = 0;

  payload[offset++] = 0x06; // Packet type

  stringToBytes(serialNumber, 10).copy(payload, offset);
  offset += 10;

  // ... altri campi come il welcome

  return encapsulate(payload.subarray(0, offset));
}

export class SentinelTcpClient {
  private socket: Socket | null = null;
  private config: SentinelConfig;
  private connected = false;
  private dataBuffer: Buffer = Buffer.alloc(0);

  constructor(config: SentinelConfig) {
    this.config = config;
  }

  /**
   * Connette al server Sentinel
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`→ Connecting to Sentinel at ${this.config.host}:${this.config.port}`);

      this.socket = createConnection({
        host: this.config.host,
        port: this.config.port,
      });

      this.socket.on("connect", () => {
        this.connected = true;
        logger.debug("✓ Connected to Sentinel TCP server");
        resolve();
      });

      this.socket.on("data", (data: Buffer) => {
        logger.debug(`← Received ${data.length} bytes from Sentinel`);
        logger.debug(`   Hex: ${data.toString("hex").toUpperCase()}`);

        // Accumula i dati ricevuti
        this.dataBuffer = Buffer.concat([this.dataBuffer, data]);

        // Qui puoi parsare le risposte se necessario
        // (per ora logghiamo solo)
      });

      this.socket.on("error", (err) => {
        logger.error(`✗ Socket error: ${err.message}`);
        reject(err);
      });

      this.socket.on("close", () => {
        this.connected = false;
        logger.debug("✓ Connection closed");
      });

      // Timeout di 10 secondi
      this.socket.setTimeout(10000);
      this.socket.on("timeout", () => {
        reject(new Error("Connection timeout"));
        this.disconnect();
      });
    });
  }

  /**
   * Invia un pacchetto raw (già encapsulato)
   */
  private sendRaw(packet: Buffer): void {
    if (!this.socket || !this.connected) {
      throw new Error("Not connected to Sentinel");
    }

    logger.debug(`→ Sending ${packet.length} bytes to Sentinel`);
    logger.debug(`   Hex: ${packet.toString("hex").toUpperCase()}`);

    this.socket.write(packet);
  }

  /**
   * Invia il pacchetto WELCOME (0x01) per autenticarsi
   */
  async sendWelcome(serialNumber: string): Promise<void> {
    logger.debug(`→ Sending WELCOME packet for device ${serialNumber}`);
    const packet = createWelcomePacket(serialNumber);
    this.sendRaw(packet);

    // Attendi un po' per la risposta
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Invia un heartbeat (0x06)
   */
  async sendHeartbeat(serialNumber: string): Promise<void> {
    logger.debug(`→ Sending HEARTBEAT packet for device ${serialNumber}`);
    const packet = createHeartbeatPacket(serialNumber);
    this.sendRaw(packet);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Disconnette dal server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Pulisce il buffer di ricezione
   */
  clearBuffer(): void {
    this.dataBuffer = Buffer.alloc(0);
  }

  /**
   * Ritorna i dati ricevuti finora
   */
  getReceivedData(): Buffer {
    return this.dataBuffer;
  }
}

// Factory per creare il client con config da env
export function createSentinelClient(): SentinelTcpClient {
  //todo: add SENTINEL_HOST & SENTINEL_PORT to file env
  const host = process.env.SENTINEL_HOST || "localhost";
  const port = parseInt(process.env.SENTINEL_PORT || "8080", 10);

  return new SentinelTcpClient({ host, port });
}
