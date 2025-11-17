import { createConnection, Socket } from "net";
import { logger } from "../../config/logger.js";
import { PacketToSentinel, PacketFromSentinel, type WiFiCell, type GSMCell } from "./packet-builders.js";

//------ INTERFACES ------
interface SentinelConfig {
  host: string;
  port: number;
}

export interface ParsedSiRFPacket {
  index: number;
  type: number;
  payload: Buffer;
  hex: string;
  parsed?: unknown;
  error?: string;
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

      this.socket.on("data", (chunk: Buffer) => {
        logger.debug(`← Received ${chunk.length} bytes from Sentinel`);
        logger.debug(`   Hex: ${chunk.toString("hex").toUpperCase()}`);

        // Accumula i dati ricevuti
        this.dataBuffer = Buffer.concat([this.dataBuffer, chunk]);

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
   * Supporta WiFi cells, GSM cells, geofence flags, ESZ flag
   */
  async sendWelcome(
    serialNumber: string,
    options?: {
      latitude?: number;
      longitude?: number;
      battery?: number;
      temperature?: number;
      collar_detached?: boolean;
      geofence_status?: "inside" | "outside" | "none";
      wifi_cells?: WiFiCell[];
      gsm_cells?: GSMCell[];
    },
  ): Promise<void> {
    logger.debug(`→ Sending WELCOME packet for device ${serialNumber}`);
    const packet = PacketToSentinel.packet01(serialNumber, options);
    this.sendRaw(packet);

    // Attendi un po' per la risposta
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Invia un heartbeat (0x06)
   */
  async sendHeartbeat(serialNumber: string): Promise<void> {
    logger.debug(`→ Sending HEARTBEAT packet for device ${serialNumber}`);
    const packet = PacketToSentinel.packet06(serialNumber);
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

  // Funzione helper per loggare TUTTI i pacchetti SIRF dal rawData
  logAllSiRFPackets(rawData: Buffer): void {
    logger.info(`🔍 Splitting rawData of ${rawData.length} bytes into single SIRF packets...`);
    const packets: Array<{ index: number; packet: Buffer }> = [];
    let offset = 0;
    let packetIndex = 0;

    while (offset < rawData.length) {
      // Cerca il prossimo header (0xA0 0xA2)
      if (offset + 4 > rawData.length) break;
      if (rawData[offset] !== 0xa0 || rawData[offset + 1] !== 0xa2) {
        offset++;
        continue;
      }

      // Leggi la lunghezza del payload (big-endian)
      const length = (rawData[offset + 2]! << 8) | rawData[offset + 3]!;
      const totalPacketSize = 8 + length; // header(2) + length(2) + payload(length) + crc(2) + footer(2)

      // Verifica che il pacchetto sia completo
      if (offset + totalPacketSize > rawData.length) {
        logger.warn(`⚠️ Incomplete packet at offset ${offset}: expected ${totalPacketSize} bytes, only ${rawData.length - offset} available`);
        break;
      }

      // Estrai il pacchetto completo (header + length + payload + crc + footer)
      const packet = rawData.slice(offset, offset + totalPacketSize);
      packets.push({ index: packetIndex, packet });

      // Log del pacchetto
      this.logSingleSiRFPacket(packet, packetIndex);

      offset += totalPacketSize;
      packetIndex++;
    }

    logger.info(`✅ Found ${packets.length} SIRF packets total\n`);
  }

  // Funzione helper per loggare un singolo pacchetto SIRF
  private logSingleSiRFPacket(packet: Buffer, packetIndex: number): void {
    logger.info(`📦 SIRF Packet #${packetIndex}:`);
    logger.info(`  Hex: ${packet.toString("hex").toUpperCase()}`);
    logger.info(`  Total Length: ${packet.length} bytes`);

    // Estrai header, length, payload, crc, footer
    const header = `0x${packet[0]?.toString(16).toUpperCase()} 0x${packet[1]?.toString(16).toUpperCase()}`;
    const length = (packet[2]! << 8) | packet[3]!;
    const payloadStart = 4;
    const payloadEnd = payloadStart + length;
    const payload = packet.slice(payloadStart, payloadEnd);
    const crc = (packet[payloadEnd]! << 8) | packet[payloadEnd + 1]!;
    const footer = `0x${packet[payloadEnd + 2]?.toString(16).toUpperCase()} 0x${packet[payloadEnd + 3]?.toString(16).toUpperCase()}`;

    logger.info(`  Header: ${header}`);
    logger.info(`  Payload Length: ${length} bytes`);
    logger.info(`  Packet Type: 0x${payload[0]?.toString(16).toUpperCase()}`);
    logger.info(`  Payload (hex): ${payload.toString("hex").toUpperCase()}`);
    logger.info(`  CRC: 0x${crc.toString(16).toUpperCase()}`);
    logger.info(`  Footer: ${footer}`);
  }
}

export const sentinelTcpClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});

/**
 *
 * 0x01 = Welcome (device → Sentinel)
 * 0x02 = ACK (device → Sentinel)
 * 0x03 = Settings Response (device → Sentinel)
 * 0x06 = Simil-Welcome (device → Sentinel)
 *
 * --------------------------------- MACRO-FLOW CLIENT ---------------------------------
 * STEP 1: Creazione Client
 *   export const client = new SentinelTcpClient({ host: "localhost", port: 8080 });
 *   └─ Istanza con config
 *
 * STEP 2: Connessione TCP
 *   await client.connect();
 *   └─ Crea socket, registra event listeners
 *
 * STEP 3: Creazione Pacchetto
 *   createWelcomePacket(serialNumber, options)
 *   └─ Costruisce payload packet0x01
 *
 * STEP 4: Encapsulation SIRF
 *   encapsulate(payload)
 *   └─ Aggiunge header (0xA0A2) + CRC + footer (0xB0B3)
 *
 * STEP 5: Invio via Socket
 *   this.socket.write(packet)
 *   └─ Invia i byte grezzi sulla TCP
 *
 * STEP 6: Ricezione (opzionale)
 *   this.socket.on("data", ...)
 *   └─ Accumula dati ricevuti da Sentinel
 *
 * --------------------------------- ARCHITECTURE ---------------------------------
 *   SentinelTcpClient (TypeScript)
 *          ↓
 *     TCP Socket (localhost:8080)
 *          ↓
 *   SIRF Protocol Encapsulation
 *   (Header + Payload + CRC + Footer)
 *          ↓
 *   Packet 0x01 (Welcome)
 *   (bytes base + [90 WiFi] + [161 GSM])
 *          ↓
 *   Sentinel (Rust)
 *   (Riceve, parsa, processa, invia a SQS)
 *
 * --------------------------------- ESEMPI DI UTILIZZO ---------------------------------
 *
 * // Scenario 1: Normal GPS tracking
 * await client.sendWelcome("PETL123456", {
 *   latitude: 44.5024,
 *   longitude: 11.3463,
 *   battery: 4200,
 *   temperature: 22,
 *   collar_detached: false
 * });
 *
 * // Scenario 2: ESZ Entry (GPS spento, a casa)
 * await client.sendWelcome("PETL123456", {
 *   latitude: 0,
 *   longitude: 0,
 *   battery: 3500,
 *   temperature: 20,
 *   collar_detached: true
 * });
 *
 * // Scenario 3: Geofence Outside
 * await client.sendWelcome("PETL123456", {
 *   latitude: 44.5024,
 *   longitude: 11.3463,
 *   geofence_status: "outside"
 * });
 *
 * // Scenario 4: WiFi Geolocation (GPS spento, WiFi disponibile)
 * await client.sendWelcome("PETL123456", {
 *   latitude: 0,
 *   longitude: 0,
 *   collar_detached: true,
 *   wifi_cells: [
 *     { bssid: "AA:BB:CC:DD:EE:FF", rssi: -50, channel: 6 },
 *     { bssid: "11:22:33:44:55:66", rssi: -70, channel: 11 },
 *     { bssid: "99:88:77:66:55:44", rssi: -80, channel: 1 }
 *   ]
 * });
 *
 * // Scenario 5: GSM Geolocation (GPS spento, WiFi assente, GSM disponibile)
 * await client.sendWelcome("PETL123456", {
 *   latitude: 0,
 *   longitude: 0,
 *   gsm_cells: [
 *     { cid: 12345, lac: 67890, mcc: 222, mnc: 10, rxl: 20 },
 *     { cid: 12346, lac: 67890, mcc: 222, mnc: 10, rxl: 18 },
 *     { cid: 12347, lac: 67890, mcc: 222, mnc: 10, rxl: 15 }
 *   ]
 * });
 *
 * // Scenario 6: WiFi + GSM Geolocation
 * await client.sendWelcome("PETL123456", {
 *   latitude: 0,
 *   longitude: 0,
 *   wifi_cells: [
 *     { bssid: "AA:BB:CC:DD:EE:FF", rssi: -50, channel: 6 }
 *   ],
 *   gsm_cells: [
 *     { cid: 12345, lac: 67890, mcc: 222, mnc: 10, rxl: 20 }
 *   ]
 * });
 */
