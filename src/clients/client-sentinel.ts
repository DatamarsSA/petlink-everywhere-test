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

interface WiFiCell {
  bssid: string;      // MAC address (6 bytes)
  rssi: number;       // Signal strength (-100 to 0 dBm)
  channel: number;    // WiFi channel (1-14)
}

interface GSMCell {
  cid: number;        // Cell ID (2 bytes)
  lac: number;        // Location Area Code (2 bytes)
  mcc: number;        // Mobile Country Code (2 bytes)
  mnc: number;        // Mobile Network Code (2 bytes)
  rxl: number;        // Signal strength (0-63)
}

//Encapsula un payload nel formato SIRF protocol
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

//Converte una stringa ASCII (es. "PETL123456") in array di bytes
function stringToBytes(str: string, length: number): Buffer {
  const buf = Buffer.alloc(length);
  Buffer.from(str, "ascii").copy(buf);
  return buf;
}

/**
 * Crea il pacchetto 0x01 WELCOME
 * Basato su kippy-protocol.md - Contiene TUTTI i campi obbligatori
 * + WiFi cells (opzionale, 90 bytes)
 * + GSM cells (opzionale, 161 bytes)
 */
function createWelcomePacket(
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
): Buffer {
  // Calcola la dimensione totale
  let totalSize = 109; // Base obbligatorio
  const hasWiFi = options?.wifi_cells && options.wifi_cells.length > 0;
  const hasGSM = options?.gsm_cells && options.gsm_cells.length > 0;
  
  if (hasWiFi) totalSize += 90;  // 10 WiFi cells × 9 bytes
  if (hasGSM) totalSize += 161;  // 7 GSM cells × 23 bytes
  
  const payload = Buffer.alloc(totalSize);
  let offset = 0;

  console.log("🔧 DEBUG: Starting packet creation");

  // Packet type (1 byte)
  payload[offset++] = 0x01;
  console.log(`  [${offset - 1}] pckNr = 0x01`);

  // Serial number (10 bytes)
  stringToBytes(serialNumber, 10).copy(payload, offset);
  offset += 10;
  console.log(`  [${offset - 10}..${offset - 1}] serialNumber`);

  // IMEI (15 bytes)
  stringToBytes("123456789012345", 15).copy(payload, offset);
  offset += 15;
  console.log(`  [${offset - 15}..${offset - 1}] imei`);

  // CCID (20 bytes)
  stringToBytes("12345678901234567890", 20).copy(payload, offset);
  offset += 20;
  console.log(`  [${offset - 20}..${offset - 1}] iccid`);

  // FW version (3 bytes)
  payload[offset++] = 1;
  payload[offset++] = 0;
  payload[offset++] = 0;
  console.log(`  [${offset - 3}..${offset - 1}] fw_version`);

  // Boot version (3 bytes)
  payload[offset++] = 1;
  payload[offset++] = 0;
  payload[offset++] = 0;
  console.log(`  [${offset - 3}..${offset - 1}] bl_version`);

  // Latitude (4 bytes, f32 - LITTLE ENDIAN)
  const lat = options?.latitude || 0;
  payload.writeFloatLE(lat, offset);
  console.log(`  [${offset}..${offset + 3}] latitude = ${lat}`);
  offset += 4;

  // Longitude (4 bytes, f32 - LITTLE ENDIAN)
  const lon = options?.longitude || 0;
  payload.writeFloatLE(lon, offset);
  console.log(`  [${offset}..${offset + 3}] longitude = ${lon}`);
  offset += 4;

  // Altitude (2 bytes, int16 - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;
  console.log(`  [${offset - 2}..${offset - 1}] altitude`);

  // Last GPS time (4 bytes, uint32 - LITTLE ENDIAN)
  payload.writeUInt32LE(Math.floor(Date.now() / 1000), offset);
  offset += 4;
  console.log(`  [${offset - 4}..${offset - 1}] last_gps_time`);

  // Temperature (2 bytes, int16 - in 0.1°C - LITTLE ENDIAN)
  const temp = (options?.temperature || 20) * 10;
  payload.writeInt16LE(temp, offset);
  console.log(`  [${offset}..${offset + 1}] temperature = ${temp}`);
  offset += 2;

  // Speed (2 bytes, int16 - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;
  console.log(`  [${offset - 2}..${offset - 1}] speed`);

  // Battery voltage (2 bytes, int16 - in mV - LITTLE ENDIAN)
  const battery = options?.battery || 4200;
  payload.writeInt16LE(battery, offset);
  console.log(`  [${offset}..${offset + 1}] battery = ${battery}`);
  offset += 2;

  // Modem quality (CSQ) (1 byte)
  payload[offset++] = 20;
  console.log(`  [${offset - 1}] csq`);

  // Modem BER (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] ber`);

  // New operating status (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] new_status`);

  // Current operating status (1 byte) - 0x00 = DEFAULT
  payload[offset++] = 0x00;
  console.log(`  [${offset - 1}] curr_status`);

  // Server notifications (1 byte) - flags per geofence
  // Bit 0x20 = inside_geofence, 0x40 = outside_geofence
  let notifications = 0x00;
  if (options?.geofence_status === "inside") {
    notifications |= 0x20;  // Bit 5
  } else if (options?.geofence_status === "outside") {
    notifications |= 0x40;  // Bit 6
  }
  payload[offset++] = notifications;
  console.log(`  [${offset - 1}] notifications = 0x${notifications.toString(16).padStart(2, "0")}`);

  // Reset cause (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] reset_cause`);

  // Modem retry (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] gprs_retry`);

  // Modem num sat (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] gps_sat`);

  // Battery remaining (spare_c4) (1 byte) - percentuale
  payload[offset++] = 80;
  console.log(`  [${offset - 1}] spare_c4 = 80`);

  // Server notification ext (spare_c5) (1 byte) - flags per ESZ
  // Bit 0x01 = collar_detached (ESZ mode)
  const collar_detached = options?.collar_detached ? 0x01 : 0x00;
  payload[offset++] = collar_detached;
  console.log(`  [${offset - 1}] spare_c5 = ${collar_detached}`);

  // Modem GMR (spare_c6) (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] spare_c6 = 0`);

  // Modem retry (spare_c7) (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] spare_c7 = 0`);

  // Modem error (spare_c8) (1 byte)
  payload[offset++] = 0;
  console.log(`  [${offset - 1}] spare_c8 = 0`);

  // Modem time from last GPRS (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Modem looking for GPS for (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Current radius (spare_s3) (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Ephemeris CRC (spare_s4) (2 bytes - LITTLE ENDIAN)
  payload.writeUInt16LE(0, offset);
  offset += 2;

  // Life (spare_s5) (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Life (spare_s6) (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Active life (spare_s7) (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Active life (spare_s8) (2 bytes - LITTLE ENDIAN)
  payload.writeInt16LE(0, offset);
  offset += 2;

  // Detailed information flag (1 byte)
  // Bit 0 = wifiCell, Bit 2 = gsmCell
  let infoFlag = 0x00;
  if (hasWiFi) infoFlag |= 0x01;  // Bit 0
  if (hasGSM) infoFlag |= 0x04;   // Bit 2
  payload[offset++] = infoFlag;
  console.log(`  [${offset - 1}] info_flag = 0x${infoFlag.toString(16).padStart(2, "0")}`);

  // ===== OPZIONALE: WiFi Cells (90 bytes totali) =====
  if (hasWiFi) {
    console.log(`\n📡 WiFi Cells (${options!.wifi_cells!.length} networks):`);
    for (let i = 0; i < 10; i++) {
      const wifi = options!.wifi_cells![i];
      
      if (wifi) {
        // BSSID (6 bytes) - MAC address
        const bssidBytes = Buffer.from(wifi.bssid.replace(/:/g, ""), "hex");
        bssidBytes.copy(payload, offset);
        offset += 6;
        
        // RSSI (1 byte) - Signal strength (-100 to 0 dBm, stored as unsigned)
        const rssi = Math.max(0, Math.min(255, wifi.rssi + 100));
        payload[offset++] = rssi;
        
        // Channel (1 byte)
        payload[offset++] = wifi.channel;
        
        console.log(`  [${offset - 9}..${offset - 1}] WiFi ${i}: ${wifi.bssid} RSSI=${wifi.rssi} CH=${wifi.channel}`);
      } else {
        // Empty WiFi cell
        payload.fill(0, offset, offset + 8);
        offset += 8;
      }
    }
  }

  // ===== OPZIONALE: GSM Cells (161 bytes totali) =====
  if (hasGSM) {
    console.log(`\n📶 GSM Cells (${options!.gsm_cells!.length} cells):`);
    for (let i = 0; i < 7; i++) {
      const gsm = options!.gsm_cells![i];
      
      if (gsm) {
        // CID (2 bytes - LITTLE ENDIAN)
        payload.writeUInt16LE(gsm.cid, offset);
        offset += 2;
        
        // LAC (2 bytes - LITTLE ENDIAN)
        payload.writeUInt16LE(gsm.lac, offset);
        offset += 2;
        
        // MCC (2 bytes - LITTLE ENDIAN)
        payload.writeUInt16LE(gsm.mcc, offset);
        offset += 2;
        
        // MNC (2 bytes - LITTLE ENDIAN)
        payload.writeUInt16LE(gsm.mnc, offset);
        offset += 2;
        
        // RXL (1 byte) - Signal strength (0-63)
        payload[offset++] = Math.max(0, Math.min(63, gsm.rxl));
        
        // Spare (14 bytes)
        payload.fill(0, offset, offset + 14);
        offset += 14;
        
        console.log(`  [${offset - 23}..${offset - 1}] GSM ${i}: CID=${gsm.cid} LAC=${gsm.lac} MCC=${gsm.mcc} MNC=${gsm.mnc} RXL=${gsm.rxl}`);
      } else {
        // Empty GSM cell
        payload.fill(0, offset, offset + 23);
        offset += 23;
      }
    }
  }

  console.log(`\n✅ TOTAL PACKET SIZE: ${offset} bytes`);
  console.log(`📦 Base: 109 bytes`);
  if (hasWiFi) console.log(`📡 WiFi cells: +90 bytes`);
  if (hasGSM) console.log(`📶 GSM cells: +161 bytes`);
  console.log(`   Total: ${offset} bytes\n`);

  return encapsulate(payload.subarray(0, offset));
}

//Crea il pacchetto 0x06 HEARTBEAT (simil-welcome)
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
    const packet = createWelcomePacket(serialNumber, options);
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

// Singleton instance
let sentinelClientInstance: SentinelTcpClient | null = null;

/**
 * Factory per creare il client con config da env
 */
export function createSentinelClient(): SentinelTcpClient {
  //todo: add SENTINEL_HOST & SENTINEL_PORT to file env
  const host = process.env.SENTINEL_HOST || "localhost";
  const port = parseInt(process.env.SENTINEL_PORT || "8080", 10);

  return new SentinelTcpClient({ host, port });
}

/**
 * Ritorna l'istanza singleton del client Sentinel
 * Se non esiste, la crea
 */
export function getSentinelClient(): SentinelTcpClient {
  if (!sentinelClientInstance) {
    sentinelClientInstance = createSentinelClient();
  }
  return sentinelClientInstance;
}

/**
 * Resetta l'istanza singleton (utile per i test)
 */
export function resetSentinelClient(): void {
  if (sentinelClientInstance) {
    sentinelClientInstance.disconnect();
    sentinelClientInstance = null;
  }
}

/**
 * ESEMPI DI UTILIZZO
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
