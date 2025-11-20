import { createConnection, Socket } from "net";
import { logger } from "../../config/logger.js";

// ================================ CONSTANTS & INTERFACES ================================ //

/**
 * SIRF Protocol Format:
 * [HEADER (2)] [LENGTH (2)] [PAYLOAD (N)] [CRC (2)] [FOOTER (2)]
 *   0xA0 0xA2   big-endian    variabile    15-bit    0xB0 0xB3
 */
const HEADER_BYTE1 = 0xa0;
const HEADER_BYTE2 = 0xa2;
const FOOTER_BYTE1 = 0xb0;
const FOOTER_BYTE2 = 0xb3;

//------ INTERFACES ------
interface WiFiCell {
  bssid: string; // MAC address (6 bytes)
  rssi: number; // Signal strength (-100 to 0 dBm)
  channel: number; // WiFi channel (1-14)
}

interface GSMCell {
  cid: number; // Cell ID (2 bytes)
  lac: number; // Location Area Code (2 bytes)
  mcc: number; // Mobile Country Code (2 bytes)
  mnc: number; // Mobile Network Code (2 bytes)
  rxl: number; // Signal strength (0-63)
}

interface PacketBuilderConfig {
  packetType: number;
  payloadBuilder: (buffer: Buffer, offset: number) => number;
}

// ================================ PACKET SERIALIZERS (Structured → Binary) ================================ //

/**
 * Crea pacchetti da inviare a Sentinel
 * Tutti i metodi ritornano un Buffer SIRF-encapsulato pronto per la socket
 */
export class PacketToSentinel {
  /**
   * Utility: Encapsula un payload nel formato SIRF protocol
   */
  private static encapsulateToSIRFProtocol(payload: Buffer): Buffer {
    const length = payload.length;

    if (length >= 1024) {
      throw new Error("Payload exceeds max length (1024 bytes)");
    }

    // Calcola CRC (15-bit sum)
    let crc = 0;
    for (let i = 0; i < length; i++) {
      crc += payload[i];
      crc &= 0x7fff;
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
   * Utility: Converte una stringa ASCII in array di bytes
   */
  private static stringToBytes(str: string, length: number): Buffer {
    const buf = Buffer.alloc(length);
    Buffer.from(str, "ascii").copy(buf);
    return buf;
  }

  /**
   * Utility: Builder generico per tutti i packet types
   */
  private static buildPacket(config: PacketBuilderConfig): Buffer {
    const MAX_PAYLOAD_SIZE = 600;
    const payload = Buffer.alloc(MAX_PAYLOAD_SIZE);
    let offset = 0;

    payload[offset++] = config.packetType;
    const payloadEnd = config.payloadBuilder(payload, offset);
    const finalPayload = payload.slice(0, payloadEnd);

    logger.debug(`📦 Packet 0x${config.packetType.toString(16).toUpperCase().padStart(2, "0")} - Payload size: ${finalPayload.length} bytes`);
    logger.debug(`   Hex: ${finalPayload.toString("hex").toUpperCase()}`);

    const sirf = this.encapsulateToSIRFProtocol(finalPayload);

    logger.debug(`🔗 SIRF Encapsulated - Total size: ${sirf.length} bytes`);
    logger.debug(`   Hex: ${sirf.toString("hex").toUpperCase()}`);

    return sirf;
  }

  /**
   * Crea il pacchetto 0x01 WELCOME
   * Basato su kippy-protocol.md - Contiene TUTTI i campi obbligatori
   * + WiFi cells (opzionale, 90 bytes)
   * + GSM cells (opzionale, 161 bytes)
   */
  static packet01(
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
    return this.buildPacket({
      packetType: 0x01,
      payloadBuilder: (buffer, offset) => {
        const hasWiFi = options?.wifi_cells && options.wifi_cells.length > 0;
        const hasGSM = options?.gsm_cells && options.gsm_cells.length > 0;

        // Serial number (10 bytes)
        this.stringToBytes(serialNumber, 10).copy(buffer, offset);
        offset += 10;

        // IMEI (15 bytes)
        this.stringToBytes("123456789012345", 15).copy(buffer, offset);
        offset += 15;

        // CCID (20 bytes)
        this.stringToBytes("12345678901234567890", 20).copy(buffer, offset);
        offset += 20;

        // FW version (3 bytes) - Must be 8, 10, or 11 with minor >= 73 to be socket capable
        buffer[offset++] = 10; // DOG_FW_VERSION
        buffer[offset++] = 0;
        buffer[offset++] = 73; // minor version >= 73

        // Boot version (3 bytes)
        buffer[offset++] = 1;
        buffer[offset++] = 0;
        buffer[offset++] = 0;

        // Latitude (4 bytes, f32 - LITTLE ENDIAN)
        const lat = options?.latitude || 0;
        buffer.writeFloatLE(lat, offset);
        offset += 4;

        // Longitude (4 bytes, f32 - LITTLE ENDIAN)
        const lon = options?.longitude || 0;
        buffer.writeFloatLE(lon, offset);
        offset += 4;

        // Altitude (2 bytes, int16 - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Last GPS time (4 bytes, uint32 - LITTLE ENDIAN)
        const gpsTime = Math.floor(Date.now() / 1000);
        buffer.writeUInt32LE(gpsTime, offset);
        offset += 4;

        // Temperature (2 bytes, int16 - in 0.1°C - LITTLE ENDIAN)
        const temp = options?.temperature ? options.temperature * 10 : 200;
        buffer.writeInt16LE(temp, offset);
        offset += 2;

        // Speed (2 bytes, int16 - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Battery voltage (2 bytes, int16 - in mV - LITTLE ENDIAN)
        const battery = options?.battery || 4200;
        buffer.writeInt16LE(battery, offset);
        offset += 2;

        // Modem quality (CSQ) (1 byte)
        buffer[offset++] = 20;

        // Modem BER (1 byte)
        buffer[offset++] = 0;

        // New operating status (1 byte)
        buffer[offset++] = 0;

        // Current operating status (1 byte)
        buffer[offset++] = 0x00;

        // Server notifications (1 byte) - flags per geofence
        let notifications = 0x00;
        if (options?.geofence_status === "inside") {
          notifications |= 0x20;
        } else if (options?.geofence_status === "outside") {
          notifications |= 0x40;
        }
        buffer[offset++] = notifications;

        // Reset cause (1 byte)
        buffer[offset++] = 0;

        // Modem retry (1 byte)
        buffer[offset++] = 0;

        // Modem num sat (1 byte)
        buffer[offset++] = 0;

        // Battery remaining (spare_c4) (1 byte)
        buffer[offset++] = 80;

        // Server notification ext (spare_c5) (1 byte) - flags per ESZ
        const collar_detached = options?.collar_detached ? 0x01 : 0x00;
        buffer[offset++] = collar_detached;

        // Modem GMR (spare_c6) (1 byte)
        buffer[offset++] = 0;

        // Modem retry (spare_c7) (1 byte)
        buffer[offset++] = 0;

        // Modem error (spare_c8) (1 byte)
        buffer[offset++] = 0;

        // Modem time from last GPRS (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Modem looking for GPS for (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Current radius (spare_s3) (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Ephemeris CRC (spare_s4) (2 bytes - LITTLE ENDIAN)
        buffer.writeUInt16LE(0, offset);
        offset += 2;

        // Life (spare_s5) (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Life (spare_s6) (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Active life (spare_s7) (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Active life (spare_s8) (2 bytes - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Detailed information flag (1 byte)
        let infoFlag = 0x00;
        if (hasWiFi) infoFlag |= 0x01;
        if (hasGSM) infoFlag |= 0x04;
        buffer[offset++] = infoFlag;

        // ===== OPZIONALE: WiFi Cells (90 bytes totali) =====
        if (hasWiFi) {
          for (let i = 0; i < 10; i++) {
            const wifi = options!.wifi_cells![i];

            if (wifi) {
              const bssidBytes = Buffer.from(wifi.bssid.replace(/:/g, ""), "hex");
              bssidBytes.copy(buffer, offset);
              offset += 6;

              const rssi = Math.max(0, Math.min(255, wifi.rssi + 100));
              buffer[offset++] = rssi;

              buffer[offset++] = wifi.channel;
            } else {
              buffer.fill(0, offset, offset + 8);
              offset += 8;
            }
          }
        }

        // ===== OPZIONALE: GSM Cells (161 bytes totali) =====
        if (hasGSM) {
          for (let i = 0; i < 7; i++) {
            const gsm = options!.gsm_cells![i];

            if (gsm) {
              buffer.writeUInt16LE(gsm.cid, offset);
              offset += 2;

              buffer.writeUInt16LE(gsm.lac, offset);
              offset += 2;

              buffer.writeUInt16LE(gsm.mcc, offset);
              offset += 2;

              buffer.writeUInt16LE(gsm.mnc, offset);
              offset += 2;

              buffer[offset++] = Math.max(0, Math.min(63, gsm.rxl));

              buffer.fill(0, offset, offset + 14);
              offset += 14;
            } else {
              buffer.fill(0, offset, offset + 23);
              offset += 23;
            }
          }
        }
        return offset;
      },
    });
  }

  /**
   * Crea il pacchetto 0x06 HEARTBEAT (device → Sentinel)
   * Struttura simile al welcome ma con packet type 0x06
   * Per ora implementazione minimale
   */
  static packet06(serialNumber: string): Buffer {
    return this.buildPacket({
      packetType: 0x06,
      payloadBuilder: (buffer, offset) => {
        // Serial number (10 bytes)
        this.stringToBytes(serialNumber, 10).copy(buffer, offset);
        offset += 10;

        // IMEI (15 bytes)
        this.stringToBytes("123456789012345", 15).copy(buffer, offset);
        offset += 15;

        // CCID (20 bytes)
        this.stringToBytes("12345678901234567890", 20).copy(buffer, offset);
        offset += 20;

        // FW version (3 bytes)
        buffer[offset++] = 1;
        buffer[offset++] = 0;
        buffer[offset++] = 0;

        // Boot version (3 bytes)
        buffer[offset++] = 1;
        buffer[offset++] = 0;
        buffer[offset++] = 0;

        // Latitude (4 bytes, f32 - LITTLE ENDIAN)
        buffer.writeFloatLE(0, offset);
        offset += 4;

        // Longitude (4 bytes, f32 - LITTLE ENDIAN)
        buffer.writeFloatLE(0, offset);
        offset += 4;

        // Altitude (2 bytes, int16 - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Last GPS time (4 bytes, uint32 - LITTLE ENDIAN)
        buffer.writeUInt32LE(Math.floor(Date.now() / 1000), offset);
        offset += 4;

        // Temperature (2 bytes, int16 - LITTLE ENDIAN)
        buffer.writeInt16LE(200, offset);
        offset += 2;

        // Speed (2 bytes, int16 - LITTLE ENDIAN)
        buffer.writeInt16LE(0, offset);
        offset += 2;

        // Battery (2 bytes, int16 - LITTLE ENDIAN)
        buffer.writeInt16LE(4200, offset);
        offset += 2;

        return offset;
      },
    });
  }
}

// ================================ PACKET DESERIALIZERS (Binary → Structured) ================================ //

/**
 * Parsa pacchetti ricevuti da Sentinel
 * Tutti i metodi ricevono il payload DECAPSULATO (senza SIRF header/footer)
 */
class PacketFromSentinel {
  /**
   * DECAPSULA un pacchetto dal formato SIRF protocol
   *
   * INPUT:  [0xA0, 0xA2, len_hi, len_lo, payload..., crc_hi, crc_lo, 0xB0, 0xB3]
   *         (pacchetto SIRF completo dalla socket)
   *
   * OUTPUT: [0x0A, 0x01, 0x2C, 0x01, ...]
   *         (solo payload, senza SIRF header/footer/CRC)
   */
  static decapsulateFromSIRFProtocol(packet: Buffer): Buffer | null {
    if (packet.length < 8) return null;

    // Verifica header
    if (packet[0] !== HEADER_BYTE1 || packet[1] !== HEADER_BYTE2) return null;

    // Leggi length (big-endian)
    const length = (packet[2] << 8) | packet[3];

    // Verifica che il pacchetto sia completo
    if (packet.length < length + 8) return null;

    // Verifica footer
    if (packet[length + 6] !== FOOTER_BYTE1 || packet[length + 7] !== FOOTER_BYTE2) return null;

    // Ritorna solo il payload (bytes 4 a 4+length)
    return packet.subarray(4, 4 + length);
  }

  /**
   * PARSA il Packet 0x0A (comando da Sentinel al device)
   *
   * INPUT:  [0x0A, commandType, duration_lo, duration_hi, ...]
   *         Byte 0: 0x0A (packet type)
   *         Byte 1: commandType (0x01=LIVE_TRACKING, 0x02=GEOFENCE, ecc)
   *         Byte 2-3: duration (int16 LE, solo per LIVE_TRACKING)
   *
   * OUTPUT: {
   *   packetType: 0x0A,
   *   commandType: 0x01,
   *   commandName: "LIVE_TRACKING",
   *   duration: 300,
   *   rawData: Buffer
   * }
   */
  static packet0x0A(payload: Buffer): {
    packetType: number;
    commandType: number;
    commandName: string;
    duration?: number;
    rawData: Buffer;
  } | null {
    if (payload.length < 2 || payload[0] !== 0x0a) return null;

    const commandType = payload[1];
    const commandMap: Record<number, string> = {
      0x01: "LIVE_TRACKING",
      0x02: "GEOFENCE",
      0x03: "ENERGY_SAVING_ZONE",
      0x04: "SETTINGS",
      0x05: "WAKEUP",
    };

    return {
      packetType: 0x0a,
      commandType,
      commandName: commandMap[commandType] || "UNKNOWN",
      duration: payload.length >= 4 ? payload.readInt16LE(2) : undefined,
      rawData: payload,
    };
  }

  /**
   * PARSA il Packet 0x15 (Safe Places WiFi)
   * Payload: [0x15] [Lat(8)] [Lng(8)] [Radius(8)] [BSSID(6)] ... repeated
   */
  static packet0x15(payload: Buffer): any {
    if (payload.length < 1 || payload[0] !== 0x15) return null;

    const zones = [];
    let offset = 1;
    const zoneSize = 30;

    while (offset + zoneSize <= payload.length) {
      const lat = payload.readDoubleLE(offset);
      offset += 8;
      const lng = payload.readDoubleLE(offset);
      offset += 8;
      const radius = payload.readDoubleLE(offset);
      offset += 8;
      const bssid = payload.subarray(offset, offset + 6).toString('hex').toUpperCase();
      offset += 6;

      zones.push({ lat, lng, radius, bssid });
    }

    return {
      packetType: 0x15,
      commandName: "SAFE_PLACES_WIFI",
      zonesCount: zones.length,
      zones
    };
  }

  /**
   * PARSA il Packet 0x10 (Evo Extra Data)
   */
  static packet0x10(payload: Buffer): any {
    if (payload.length < 1 || payload[0] !== 0x10) return null;

    let offset = 1;
    const evo_tasks = payload.readUInt32LE(offset);
    offset += 4;

    // Bitmasks from Rust:
    const EvoFlashlight = 0x01;
    const EVO_TOUR_RECORDING = 0x02;
    const EvoSound = 0x04;
    const EvoEnergySaveArea = 0x08;
    // const EvoTimestamp = 0x0020; // Not used in parsing for now

    const result: any = {
      packetType: 0x10,
      commandName: "EVO_EXTRA_DATA",
      evo_tasks
    };

    if (evo_tasks & EvoFlashlight) {
      result.torch_duration = payload.readInt16LE(offset);
      offset += 2;
    }
    if (evo_tasks & EVO_TOUR_RECORDING) {
      result.tour_recording_enabled = payload.readInt8(offset);
      offset += 1;
    }
    if (evo_tasks & EvoSound) {
      result.sound_command = payload.readInt16LE(offset);
      offset += 2;
      result.sound_duration = payload.readInt16LE(offset);
      offset += 2;
    }
    if (evo_tasks & EvoEnergySaveArea) {
      result.energy_saving_area_enabled = payload.readInt8(offset); // 1 = ON, 0 = OFF
      offset += 1;
    }

    return result;
  }
}

// --------------------------------------- CLIENT ----------------------------------------- //

//------ INTERFACES ------
interface SentinelConfig {
  host: string;
  port: number;
}

interface ParsedSiRFPacket {
  index: number;
  type: number;
  payload: Buffer;
  hex: string;
  parsed?: unknown;
  error?: string;
}

//------ Facad Client (unique export) ------
class SentinelTcpClient {
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
   * Invia un pacchetto SIRF-encapsulato sulla socket
   *
   * Uso:
   *   const packet = PacketToSentinel.packet01("PETL123456", { latitude: 44.5024 });
   *   await petlink.send(packet);
   */
  async send(packet: Buffer): Promise<void> {
    if (!this.socket) {
      throw new Error("Not connected to Sentinel");
    }
    logger.debug(`→ Sending ${packet.length} bytes to Sentinel`);
    logger.debug(`   Hex: ${packet.toString("hex").toUpperCase()}`);
    this.socket!.write(packet);
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
   * Parsa tutti i pacchetti SIRF dal buffer grezzo
   * STEP 0: await 'timeBeforeReadSocket' to accumulate data on this.dataBuffer
   * STEP 1: Cerca header SIRF (0xA0A2)
   * STEP 2: Estrai pacchetto SIRF completo
   * STEP 3: DECAPSULA (rimuove SIRF header/footer/CRC)
   * STEP 4: PARSA (converte payload in oggetto strutturato)
   * STEP 5: Ritorna array di ParsedSiRFPacket
   */
  async waitForPackets(timeBeforeReadSocket: number): Promise<ParsedSiRFPacket[]> {
    await new Promise((resolve) => setTimeout(resolve, timeBeforeReadSocket));
    let rawData: Buffer = this.dataBuffer;

    logger.info(`🔍 Parsing rawData of ${rawData.length} bytes`);
    logger.info(`Raw Hex (before split): ${rawData.toString("hex").toUpperCase()}`);

    const packets: ParsedSiRFPacket[] = [];
    let offset = 0;
    let packetIndex = 0;

    while (offset < rawData.length) {
      // STEP 1: Cerca header SIRF (0xA0 0xA2)
      if (offset + 4 > rawData.length) break;
      if (rawData[offset] !== 0xa0 || rawData[offset + 1] !== 0xa2) {
        offset++;
        continue;
      }

      // STEP 2: Estrai pacchetto SIRF completo
      const length = (rawData[offset + 2]! << 8) | rawData[offset + 3]!;
      const totalPacketSize = 8 + length;

      if (offset + totalPacketSize > rawData.length) {
        logger.warn(`⚠️  Incomplete packet at offset ${offset}: expected ${totalPacketSize} bytes, only ${rawData.length - offset} available`);
        break;
      }

      const sirf_packet = rawData.slice(offset, offset + totalPacketSize);
      const packetHex = sirf_packet.toString("hex").toUpperCase();

      // Log del pacchetto SIRF
      logger.info(`📦 SIRF Packet #${packetIndex}:`);
      logger.info(`   Hex: ${packetHex}`);
      logger.info(`   Total Length: ${sirf_packet.length} bytes`);

      // STEP 3: DECAPSULA (rimuove SIRF header/footer/CRC)
      const payload = PacketFromSentinel.decapsulateFromSIRFProtocol(sirf_packet);
      if (!payload) {
        logger.warn(`   ⚠️  Failed to decapsulate packet`);
        offset += totalPacketSize;
        packetIndex++;
        continue;
      }

      const packetType = payload[0];
      logger.info(`   Packet Type: 0x${packetType.toString(16).toUpperCase()}`);
      logger.info(`   Payload Length: ${payload.length} bytes`);
      logger.info(`   Payload (hex): ${payload.toString("hex").toUpperCase()}`);

      // STEP 4: PARSA (converte payload in oggetto strutturato)
      let parsed: unknown;
      let error: string | undefined;

      try {
        switch (packetType) {
          case 0x0a:
            parsed = PacketFromSentinel.packet0x0A(payload);
            logger.info(`   ✓ Parsed as Packet 0x0A (LIVE_TRACKING Command)`);
            break;
          case 0x15:
            parsed = PacketFromSentinel.packet0x15(payload);
            logger.info(`   ✓ Parsed as Packet 0x15 (SAFE_PLACES_WIFI)`);
            break;
          case 0x10:
            parsed = PacketFromSentinel.packet0x10(payload);
            logger.info(`   ✓ Parsed as Packet 0x10 (EVO_EXTRA_DATA)`);
            break;
          //todo: implement other case parsing
          default:
            logger.debug(`   ℹ️  No parser for packet type 0x${packetType.toString(16).toUpperCase()}`);
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        logger.warn(`   ⚠️  Parsing error: ${error}`);
      }

      // STEP 5: Ritorna il pacchetto parsato
      packets.push({
        index: packetIndex,
        type: packetType,
        payload: payload,
        hex: packetHex,
        parsed: parsed,
        error: error,
      });

      offset += totalPacketSize;
      packetIndex++;
    }

    logger.info(`✅ Found ${packets.length} SIRF packets total\n`);
    this.clearBuffer();
    return packets;
  }
}

// ================================ EXPORT ================================ //

export const sentinelTcpSocketClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});

/**
 * UTILIZZO:
 *
 * ===== INVIO =====
 * const packet = PacketToSentinel.packet01("PETL123456", {
 *   latitude: 44.5024,
 *   longitude: 11.3463,
 *   battery: 4200,
 *   collar_detached: false
 * });
 * await petlink.send(packet);
 *
 * ===== RICEZIONE =====
 * const packets = await petlink.waitForPackets(5000);
 * packets.forEach(p => {
 *   console.log(`Packet 0x${p.type.toString(16)}: ${JSON.stringify(p.parsed)}`);
 * });
 */
