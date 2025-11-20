import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
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
}

// ================================ PACKET DESERIALIZERS (Binary → Structured) ================================ //

/**
 * PacketFromSentinel class - made public for export
 */
export class PacketFromSentinel {
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
   * NOTA: NON c'è zonesCount! Il formato è diretto: pck_nr seguito dai dati delle zone
   */
  static packet0x15(payload: Buffer): any {
    if (payload.length < 1 || payload[0] !== 0x15) return null;

    const zones = [];
    let offset = 1; // Salta il packet type 0x15
    const zoneSize = 30; // 8+8+8+6 = 30 bytes per zone

    while (offset + zoneSize <= payload.length) {
      // Rust usa f64 (double) per lat/lng/radius
      const lat = payload.readDoubleLE(offset);
      offset += 8;
      const lng = payload.readDoubleLE(offset);
      offset += 8;
      const radius = payload.readDoubleLE(offset);
      offset += 8;
      // BSSID è 6 bytes in formato esadecimale
      const bssidBytes = payload.subarray(offset, offset + 6);
      const bssid = bssidBytes.toString("hex").toUpperCase();
      offset += 6;

      zones.push({ lat, lng, radius, bssid });
    }

    return {
      packetType: 0x15,
      commandName: "SAFE_PLACES_WIFI",
      zonesCount: zones.length,
      zones,
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
      evo_tasks,
    };

    if (evo_tasks & EvoFlashlight) {
      result.torch_duration = payload.readInt16LE(offset);
      offset += 2;
      logger.debug(`   🔦 EvoFlashlight: torch_duration = ${result.torch_duration}`);
    }
    if (evo_tasks & EVO_TOUR_RECORDING) {
      result.tour_recording_enabled = payload.readInt8(offset);
      offset += 1;
      logger.debug(`   🎥 EvoTourRecording: tour_recording_enabled = ${result.tour_recording_enabled}`);
    }
    if (evo_tasks & EvoSound) {
      result.sound_command = payload.readInt16LE(offset);
      offset += 2;
      result.sound_duration = payload.readInt16LE(offset);
      offset += 2;
      logger.debug(`   🔊 EvoSound: sound_command = ${result.sound_command}, sound_duration = ${result.sound_duration}`);
    }
    if (evo_tasks & EvoEnergySaveArea) {
      result.energy_saving_area_enabled = payload.readInt8(offset); // 1 = ON, 0 = OFF
      offset += 1;
      logger.debug(`   🏠 EvoEnergySaveArea: energy_saving_area_enabled = ${result.energy_saving_area_enabled}`);
    }

    return result;
  }

  /**
   * PARSA il Packet 0x02 (placeholder - not implemented yet)
   */
  static packet0x02(payload: Buffer): any {
    if (payload.length < 1 || payload[0] !== 0x02) return null;

    return {
      packetType: 0x02,
      commandName: "PACKET_0x02",
      rawData: payload.toString("hex"),
    };
  }

  /**
   * PARSA il Packet 0x03 (placeholder - not implemented yet)
   */
  static packet0x03(payload: Buffer): any {
    if (payload.length < 1 || payload[0] !== 0x03) return null;

    return {
      packetType: 0x03,
      commandName: "PACKET_0x03",
      rawData: payload.toString("hex"),
    };
  }
}

// --------------------------------------- CLIENT ----------------------------------------- //

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
  startOffset?: number;
  endOffset?: number;
}

//------ Facade Client (unique export) ------
export class SentinelTcpClient {
  private socket: Socket | null = null;
  private config: SentinelConfig;
  private dataBuffer: Buffer = Buffer.alloc(0);
  private packetCounter: number = 0;
  private eventEmitter: EventEmitter;

  constructor(config: SentinelConfig) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
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
        logger.debug("✓ Connected to Sentinel TCP server");
        resolve();
      });

      this.socket.on("data", (data: Buffer) => {
        this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
        this.processIncomingData(this.dataBuffer);
      });

      this.socket.on("error", (err) => {
        logger.error(`✗ Socket error: ${err.message}`);
        reject(err);
      });

      this.socket.on("close", () => {
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
    }
  }

  /**
   * Pulisce il buffer di ricezione
   */
  clearBuffer(): void {
    this.dataBuffer = Buffer.alloc(0);
  }

  /**
   * Processa i dati in arrivo e emette eventi per ogni pacchetto parsato
   */
  private processIncomingData(buffer: Buffer): void {
    while (true) {
      const packet = this.extractPacket(buffer);

      if (!packet) return;

      this.packetCounter++;
      logger.debug(`[${this.packetCounter}] Emitting packet: 0x${packet.type.toString(16)}`);
      this.eventEmitter.emit("packet", packet);
      this.eventEmitter.emit(`packet:${packet.type.toString(16)}`, packet);
    }
  }

  /**
   * Estrae un pacchetto dal buffer e lo rimuove dal buffer
   */
  private extractPacket(buffer: Buffer): ParsedSiRFPacket | null {
    // Early return: minimum packet length check
    if (buffer.length < 8) return null;

    // Early return: find header
    const packetStart = this.findHeader(buffer);
    if (packetStart === -1) {
      this.discardGarbageData(buffer);
      return null;
    }

    // Early return: handle garbage before header
    if (packetStart > 0) {
      logger.warn(`Discarding ${packetStart} bytes of garbage data before packet header.`);
      buffer.copy(buffer, 0, packetStart);
      buffer.length = buffer.length - packetStart;
    }

    // Early return: re-check after garbage removal
    if (buffer.length < 8) return null;

    const length = buffer.readUInt16BE(2);
    const totalPacketLength = 8 + length;

    // Early return: incomplete packet
    if (buffer.length < totalPacketLength) return null;

    // Early return: invalid footer
    if (buffer[totalPacketLength - 2] !== 0xb0 || buffer[totalPacketLength - 1] !== 0xb3) {
      logger.warn("Invalid packet footer. Discarding malformed packet.");
      buffer.copy(buffer, 0, totalPacketLength);
      buffer.length = buffer.length - totalPacketLength;
      return null;
    }

    const fullPacket = buffer.subarray(0, totalPacketLength);
    buffer.copy(buffer, 0, totalPacketLength);
    buffer.length = buffer.length - totalPacketLength;

    const payload = fullPacket.subarray(4, fullPacket.length - 4);
    const packetType = payload[0];

    const parsed = this.parsePayload(packetType, payload);
    if (!parsed) return null;

    return {
      index: this.packetCounter,
      type: packetType,
      payload: payload,
      hex: fullPacket.toString("hex").toUpperCase(),
      parsed: parsed,
    };
  }

  private findHeader(buffer: Buffer): number {
    for (let i = 0; i <= buffer.length - 2; i++) {
      if (buffer[i] === 0xa0 && buffer[i + 1] === 0xa2) {
        return i;
      }
    }
    return -1;
  }

  private discardGarbageData(buffer: Buffer): void {
    const lastA0 = buffer.lastIndexOf(0xa0);
    if (lastA0 > -1) {
      buffer.copy(buffer, 0, lastA0);
      buffer.length = buffer.length - lastA0;
    } else {
      buffer.length = 0;
    }
  }

  private parsePayload(packetType: number, payload: Buffer): any {
    try {
      switch (packetType) {
        case 0x0a:
          return PacketFromSentinel.packet0x0A(payload);
        case 0x10:
          return PacketFromSentinel.packet0x10(payload);
        case 0x15:
          return PacketFromSentinel.packet0x15(payload);
        case 0x02:
          return PacketFromSentinel.packet0x02(payload);
        case 0x03:
          return PacketFromSentinel.packet0x03(payload);
        default:
          logger.warn(`Unknown packet type received: 0x${packetType.toString(16)}`);
          return { packetType, rawData: payload.toString("hex") };
      }
    } catch (e: any) {
      logger.error(`Error parsing packet 0x${packetType.toString(16)}: ${e.message}`);
      return null;
    }
  }

  /**
   * Wait for a specific packet type
   */
  async waitForPacket(packetType: number, timeout: number = 5000, validator?: (packet: ParsedSiRFPacket) => boolean): Promise<ParsedSiRFPacket> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventEmitter.off(`packet:${packetType.toString(16)}`, onPacket);
        reject(new Error(`Timeout waiting for packet 0x${packetType.toString(16)}`));
      }, timeout);

      const onPacket = (packet: ParsedSiRFPacket) => {
        if (!validator || validator(packet)) {
          clearTimeout(timer);
          this.eventEmitter.off(`packet:${packetType.toString(16)}`, onPacket);
          resolve(packet);
        }
      };

      this.eventEmitter.on(`packet:${packetType.toString(16)}`, onPacket);
    });
  }

  /**
   * Wait for multiple packet types in order
   */
  async waitForPackets(
    expectedPacketTypes: number[],
    timeout: number = 5000,
  ): Promise<{ byType: { [key: string]: ParsedSiRFPacket[] }; all: ParsedSiRFPacket[] }> {
    return new Promise((resolve, reject) => {
      const receivedPackets: ParsedSiRFPacket[] = [];
      const packetsByType: { [key: string]: ParsedSiRFPacket[] } = {};
      const expectedCount = expectedPacketTypes.length;

      const timer = setTimeout(() => {
        this.eventEmitter.off("packet", onPacket);
        reject(new Error(`Timeout waiting for ${expectedCount} packets. Received ${receivedPackets.length}`));
      }, timeout);

      const onPacket = (packet: ParsedSiRFPacket) => {
        if (expectedPacketTypes.includes(packet.type)) {
          receivedPackets.push(packet);
          const typeKey = `0x${packet.type.toString(16)}`;
          if (!packetsByType[typeKey]) {
            packetsByType[typeKey] = [];
          }
          packetsByType[typeKey].push(packet);

          if (receivedPackets.length >= expectedCount) {
            clearTimeout(timer);
            this.eventEmitter.off("packet", onPacket);
            resolve({ byType: packetsByType, all: receivedPackets });
          }
        }
      };

      this.eventEmitter.on("packet", onPacket);
    });
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
 * await sentinelTcpSocketClient.send(packet);
 *
 * ===== RICEZIONE (EVENT-DRIVEN) =====
 * // Ascolta tutti i pacchetti
 * sentinelTcpSocketClient.on('packet', (packet) => {
 *   console.log(`Packet 0x${packet.type.toString(16)}: ${JSON.stringify(packet.parsed)}`);
 * });
 *
 * // Ascolta pacchetti specifici
 * sentinelTcpSocketClient.on('packet:0x0A', (packet) => {
 *   console.log('LIVE_TRACKING command received:', packet.parsed);
 * });
 *
 * // Wait for single packet type with validation
 * const commandPacket = await sentinelTcpSocketClient.waitForPacket(0x0A, 5000, (packet) => {
 *   return packet.parsed?.commandType === 0x01; // Only LIVE_TRACKING commands
 * });
 *
 * // Wait for multiple packet types
 * const { byType, all } = await sentinelTcpSocketClient.waitForPackets([0x15, 0x10], 5000);
 * console.log('Safe Places packets:', byType['0x15']);
 * console.log('Evo Extra Data packets:', byType['0x10']);
 * console.log('Total packets received:', all.length);
 */
