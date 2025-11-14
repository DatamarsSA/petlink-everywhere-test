//------ PACKET BUILDERS ------
// Due classi esportate per serializzare/deserializzare pacchetti Sentinel
// - PacketToSentinel: Structured → Binary (outgoing)
// - PacketFromSentinel: Binary → Structured (incoming)

import { logger } from "../../config/logger.js";

//------ CONSTANTS ------
const HEADER_BYTE1 = 0xa0;
const HEADER_BYTE2 = 0xa2;
const FOOTER_BYTE1 = 0xb0;
const FOOTER_BYTE2 = 0xb3;

//------ INTERFACES ------
export interface WiFiCell {
  bssid: string; // MAC address (6 bytes)
  rssi: number; // Signal strength (-100 to 0 dBm)
  channel: number; // WiFi channel (1-14)
}

export interface GSMCell {
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

//------ PACKET SERIALIZERS (Structured → Binary) ------
/**
 * Classe per convertire dati strutturati in pacchetti binari da inviare a Sentinel
 * Implementa direttamente la logica di creazione dei pacchetti
 */
export class PacketToSentinel {
  /**
   * Utility: Encapsula un payload nel formato SIRF protocol
   */
  private static encapsulateOnSIRFProtocol(payload: Buffer): Buffer {
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

    const sirf = this.encapsulateOnSIRFProtocol(finalPayload);

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

        // FW version (3 bytes)
        buffer[offset++] = 1;
        buffer[offset++] = 0;
        buffer[offset++] = 0;

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

//------ PACKET DESERIALIZERS (Binary → Structured) ------
/**
 * Classe per convertire pacchetti binari ricevuti da Sentinel in dati strutturati
 * Implementa direttamente la logica di parsing dei pacchetti
 */
export class PacketFromSentinel {
  /**
   * Parsa il Packet 0x0A (comando da Sentinel al device)
   * Converte il buffer binario in oggetto strutturato
   */
  static packet0x0A(rawData: Buffer): {
    packetType: number;
    commandType: number;
    commandName: string;
    duration?: number;
    rawData: Buffer;
  } | null {
    if (rawData.length < 2) {
      return null;
    }

    // Controlla se è un Packet 0x0A
    const packetType = rawData[0];
    if (packetType !== 0x0a) {
      logger.warn(`Expected Packet 0x0A, got 0x${packetType.toString(16).toUpperCase()}`);
      return null;
    }

    const commandType = rawData[1];
    let commandName = "UNKNOWN";

    // Mappa dei comandi
    const commandMap: Record<number, string> = {
      0x01: "LIVE_TRACKING",
      0x02: "GEOFENCE",
      0x03: "ENERGY_SAVING_ZONE",
      0x04: "SETTINGS",
      0x05: "WAKEUP",
    };

    commandName = commandMap[commandType] || "UNKNOWN";

    // Estrai duration se presente (per Live Tracking)
    let duration: number | undefined;
    if (rawData.length >= 4 && commandType === 0x01) {
      // Duration è int16 LE (little endian)
      duration = rawData.readInt16LE(2);
    }

    return {
      packetType,
      commandType,
      commandName,
      duration,
      rawData,
    };
  }

  /**
   * Verifica se il buffer contiene un comando specifico
   */
  static hasCommand(rawData: Buffer, commandName: string): boolean {
    const parsed = this.packet0x0A(rawData);
    if (!parsed) return false;
    return parsed.commandName === commandName;
  }

  /**
   * Estrae il nome del comando dal buffer
   */
  static getCommandName(rawData: Buffer): string | null {
    const parsed = this.packet0x0A(rawData);
    return parsed?.commandName ?? null;
  }

  /**
   * Estrae la duration dal buffer (per Live Tracking)
   */
  static getDuration(rawData: Buffer): number | null {
    const parsed = this.packet0x0A(rawData);
    return parsed?.duration ?? null;
  }
}
