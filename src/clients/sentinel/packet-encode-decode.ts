/**
 * ==================== PACKET ENCODE/DECODE (Rust-like) ====================
 *
 * Ogni classe rappresenta un packet type con:
 * - constructor(): crea l'istanza con i dati
 * - toBuffer(): serializza in Buffer (manuale)
 * - static fromBuffer(): deserializza da Buffer (manuale)
 *
 * SIRF Protocol:
 * [HEADER: 0xA0A2] [LEN: 2bytes BE] [PAYLOAD] [CRC: 2bytes BE] [FOOTER: 0xB0B3]
 */

import { logger } from "../../config/logger.js";

// ================================ SIRF PROTOCOL UTILITIES ================================ //

const SIRF = {
  HEADER: Buffer.from([0xa0, 0xa2]),
  LENGTH_FIELD: 2, // 2 bytes
  CRC: 2, // 2 bytes
  FOOTER: Buffer.from([0xb0, 0xb3]),
} as const;

export class SirfProtocol {
  /**
   * Encapsula payload nel SIRF protocol
   */
  static encapsulate(payload: Buffer): Buffer {
    const length = payload.length;
    if (length >= 1024) throw new Error("Payload too large");

    // Calcola CRC (15-bit sum)
    let crc = 0;
    for (let i = 0; i < length; i++) {
      crc += payload[i];
      crc &= 0x7fff;
    }

    const packet = Buffer.alloc(length + 8);
    SIRF.HEADER.copy(packet, 0);
    packet.writeUInt16BE(length, 2); // Length Big Endian
    payload.copy(packet, 4);
    packet.writeUInt16BE(crc, 4 + length); // CRC Big Endian
    SIRF.FOOTER.copy(packet, 4 + length + 2);

    return packet;
  }

  /**
   * Decapsula pacchetto SIRF e ritorna solo il payload
   */
  static decapsulate(packet: Buffer): Buffer {
    if (packet.length < 8) throw new Error("Packet too short");

    const header = packet.subarray(0, 2);
    if (!header.equals(SIRF.HEADER)) throw new Error("Invalid SIRF header");

    const length = packet.readUInt16BE(2);
    const payload = packet.subarray(4, 4 + length);
    const crc = packet.readUInt16BE(4 + length);
    const footer = packet.subarray(4 + length + 2, 4 + length + 4);

    if (!footer.equals(SIRF.FOOTER)) throw new Error("Invalid SIRF footer");

    // Verifica CRC
    let calculatedCrc = 0;
    for (let i = 0; i < length; i++) {
      calculatedCrc += payload[i];
      calculatedCrc &= 0x7fff;
    }
    if (calculatedCrc !== crc) throw new Error("CRC mismatch");

    return payload;
  }

  /**
   * Logga pacchetto SIRF in modo simmetrico (hex + parsed)
   */
  static logPacket(direction: "INCOMING" | "OUTGOING", rawPacket: Buffer, parsedPayload?: any): void {
    const type = rawPacket[4];
    const length = rawPacket.readUInt16BE(2);
    const payload = rawPacket.subarray(4, 4 + length);
    const crc = rawPacket.readUInt16BE(4 + length);

    // Legenda del protocollo SIRF (statica)
    const protocolLegend =
      `[SIRF-PROTOCOL]: [HEADER: (${SIRF.HEADER.length}bytes) ${SIRF.HEADER.toString("hex").toUpperCase()}] ` +
      `[LEN: (${SIRF.LENGTH_FIELD}bytes)] ` +
      `[PAYLOAD: [PACKET_TYPE: (1byte)] [KIPPY_DATA: (variable bytes)]] ` +
      `[CRC: (${SIRF.CRC}bytes) CHECKSUM] ` +
      `[FOOTER: (${SIRF.FOOTER.length}bytes) ${SIRF.FOOTER.toString("hex").toUpperCase()}]`;

    // Visualizzazione completa del pacchetto
    const packetVisualization =
      `\n\n[${direction}] SIRF Packet: 0x${type.toString(16).padStart(2, "0").toUpperCase()}\n` +
      `${protocolLegend}\n` +
      `[ORIGINAL-HEX]: ${rawPacket.toString("hex").toUpperCase()}\n` +
      `[HEADER: ${rawPacket.subarray(0, SIRF.HEADER.length).toString("hex").toUpperCase()}]\n` +
      `[LEN-PAYLOAD:] (hex: ${rawPacket
        .subarray(SIRF.HEADER.length, SIRF.HEADER.length + SIRF.LENGTH_FIELD)
        .toString("hex")
        .toUpperCase()}) (decimal: ${length} B)\n` +
      `[PAYLOAD-HEX]: ${payload.toString("hex").toUpperCase()}\n` +
      `[PAYLOAD-DECIMAL]: [${Array.from(payload).join(", ")}] payload_size: ${payload.length}\n` +
      (parsedPayload ? `[PAYLOAD-PARSED]: ${JSON.stringify(parsedPayload)}\n` : "") +
      `[CRC: ${rawPacket
        .subarray(SIRF.HEADER.length + SIRF.LENGTH_FIELD + length, SIRF.HEADER.length + SIRF.LENGTH_FIELD + length + SIRF.CRC)
        .toString("hex")
        .toUpperCase()}]\n` +
      `[FOOTER: ${rawPacket
        .subarray(SIRF.HEADER.length + SIRF.LENGTH_FIELD + length + SIRF.CRC)
        .toString("hex")
        .toUpperCase()}]`;

    // LOG UNICO E LEGGIBILE
    logger.info(packetVisualization);
  }
}

// ================================ UTILITY FUNCTIONS ================================ //

function stringToBytes(str: string, length: number): Buffer {
  const buf = Buffer.alloc(length);
  Buffer.from(str, "ascii").copy(buf);
  return buf;
}

// ================================ PACKET CLASSES ================================ //

/**
 * Packet 0x01 - Welcome/Heartbeat
 */
export class Packet01 {
  constructor(
    public readonly serialNumber: string,
    public readonly latitude: number = 0,
    public readonly longitude: number = 0,
    public readonly battery: number = 4200,
    public readonly temperature: number = 20,
    public readonly collar_detached: boolean = false,
    public readonly geofence_status: "inside" | "outside" | "none" = "none",
    public readonly wifi_cells?: { bssid: string; rssi: number; channel: number }[],
    public readonly gsm_cells?: { cid: number; lac: number; mcc: number; mnc: number; rxl: number }[],
  ) {}

  /**
   * Serializza in Buffer (manuale)
   */
  toBuffer(): Buffer {
    const MAX_SIZE = 600;
    const buffer = Buffer.alloc(MAX_SIZE);
    let offset = 0;

    // Packet Type
    buffer[offset++] = 0x01;

    const hasWiFi = this.wifi_cells && this.wifi_cells.length > 0;
    const hasGSM = this.gsm_cells && this.gsm_cells.length > 0;

    // Serial number (10 bytes)
    stringToBytes(this.serialNumber, 10).copy(buffer, offset);
    offset += 10;

    // IMEI (15 bytes)
    stringToBytes("123456789012345", 15).copy(buffer, offset);
    offset += 15;

    // ICCID (20 bytes)
    stringToBytes("12345678901234567890", 20).copy(buffer, offset);
    offset += 20;

    // FW version (3 bytes)
    buffer[offset++] = 10;
    buffer[offset++] = 0;
    buffer[offset++] = 73;

    // Boot version (3 bytes)
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;

    // Latitude (4 bytes, float32 LE)
    buffer.writeFloatLE(this.latitude, offset);
    offset += 4;

    // Longitude (4 bytes, float32 LE)
    buffer.writeFloatLE(this.longitude, offset);
    offset += 4;

    // Altitude (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // Last GPS time (4 bytes, uint32 LE)
    buffer.writeUInt32LE(Math.floor(Date.now() / 1000), offset);
    offset += 4;

    // Temperature (2 bytes, int16 LE, in 0.1°C)
    buffer.writeInt16LE(this.temperature * 10, offset);
    offset += 2;

    // Speed (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // Battery (2 bytes, int16 LE, in mV)
    buffer.writeInt16LE(this.battery, offset);
    offset += 2;

    // CSQ (1 byte)
    buffer[offset++] = 20;

    // BER (1 byte)
    buffer[offset++] = 0;

    // New status (1 byte)
    buffer[offset++] = 0;

    // Current status (1 byte)
    buffer[offset++] = 0;

    // Notifications (1 byte) - geofence flags
    let notifications = 0x00;
    if (this.geofence_status === "inside") notifications |= 0x20;
    else if (this.geofence_status === "outside") notifications |= 0x40;
    buffer[offset++] = notifications;

    // Reset cause (1 byte)
    buffer[offset++] = 0;

    // GPRS retry (1 byte)
    buffer[offset++] = 0;

    // GPS sat (1 byte)
    buffer[offset++] = 0;

    // Battery % (spare_c4) (1 byte)
    buffer[offset++] = 80;

    // ESZ flag (spare_c5) (1 byte)
    buffer[offset++] = this.collar_detached ? 0x01 : 0x00;

    // Modem GMR (spare_c6) (1 byte)
    buffer[offset++] = 0;

    // Modem retry (spare_c7) (1 byte)
    buffer[offset++] = 0;

    // Modem error (spare_c8) (1 byte)
    buffer[offset++] = 0;

    // Last GPRS (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // Last GPS (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // spare_s3 (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // spare_s4 (2 bytes, uint16 LE)
    buffer.writeUInt16LE(0, offset);
    offset += 2;

    // spare_s5 (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // spare_s6 (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // spare_s7 (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // spare_s8 (2 bytes, int16 LE)
    buffer.writeInt16LE(0, offset);
    offset += 2;

    // Info flag (1 byte)
    let infoFlag = 0x00;
    if (hasWiFi) infoFlag |= 0x01;
    if (hasGSM) infoFlag |= 0x04;
    buffer[offset++] = infoFlag;

    // WiFi cells (90 bytes opzionali)
    if (hasWiFi) {
      for (let i = 0; i < 10; i++) {
        const wifi = this.wifi_cells![i];
        if (wifi) {
          const bssidBytes = Buffer.from(wifi.bssid.replace(/:/g, ""), "hex");
          bssidBytes.copy(buffer, offset);
          offset += 6;
          buffer[offset++] = Math.max(0, Math.min(255, wifi.rssi + 100));
          buffer[offset++] = wifi.channel;
        } else {
          buffer.fill(0, offset, offset + 8);
          offset += 8;
        }
      }
    }

    // GSM cells (161 bytes opzionali)
    if (hasGSM) {
      for (let i = 0; i < 7; i++) {
        const gsm = this.gsm_cells![i];
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

    return buffer.subarray(0, offset);
  }

  /**
   * Deserializza da Buffer (manuale)
   */
  static fromBuffer(payload: Buffer): Packet01 {
    let offset = 1; // Skip packet type

    const serialNumber = payload
      .subarray(offset, offset + 10)
      .toString("ascii")
      .replace(/\0/g, "");
    offset += 10;

    offset += 15; // IMEI
    offset += 20; // ICCID
    offset += 3; // FW version
    offset += 3; // Boot version

    const latitude = payload.readFloatLE(offset);
    offset += 4;

    const longitude = payload.readFloatLE(offset);
    offset += 4;

    offset += 2; // Altitude
    offset += 4; // Last GPS time

    const temperature = payload.readInt16LE(offset) / 10;
    offset += 2;

    offset += 2; // Speed

    const battery = payload.readInt16LE(offset);
    offset += 2;

    offset += 1; // CSQ
    offset += 1; // BER
    offset += 1; // New status
    offset += 1; // Current status

    const notifications = payload[offset++];
    const geofence_status: "inside" | "outside" | "none" = notifications & 0x20 ? "inside" : notifications & 0x40 ? "outside" : "none";

    offset += 1; // Reset cause
    offset += 1; // GPRS retry
    offset += 1; // GPS sat
    offset += 1; // Battery %

    const collar_detached = (payload[offset++] & 0x01) === 0x01;

    offset += 1; // Modem GMR
    offset += 1; // Modem retry
    offset += 1; // Modem error
    offset += 2; // Last GPRS
    offset += 2; // Last GPS
    offset += 2; // spare_s3
    offset += 2; // spare_s4
    offset += 2; // spare_s5
    offset += 2; // spare_s6
    offset += 2; // spare_s7
    offset += 2; // spare_s8

    const infoFlag = payload[offset++];
    const hasWiFi = (infoFlag & 0x01) !== 0;
    const hasGSM = (infoFlag & 0x04) !== 0;

    let wifi_cells: { bssid: string; rssi: number; channel: number }[] | undefined;
    if (hasWiFi) {
      wifi_cells = [];
      for (let i = 0; i < 10; i++) {
        const bssid = payload
          .subarray(offset, offset + 6)
          .toString("hex")
          .toUpperCase();
        offset += 6;
        const rssi = payload[offset++] - 100;
        const channel = payload[offset++];
        if (bssid !== "000000000000") {
          wifi_cells.push({ bssid, rssi, channel });
        }
      }
    }

    let gsm_cells: { cid: number; lac: number; mcc: number; mnc: number; rxl: number }[] | undefined;
    if (hasGSM) {
      gsm_cells = [];
      for (let i = 0; i < 7; i++) {
        const cid = payload.readUInt16LE(offset);
        offset += 2;
        const lac = payload.readUInt16LE(offset);
        offset += 2;
        const mcc = payload.readUInt16LE(offset);
        offset += 2;
        const mnc = payload.readUInt16LE(offset);
        offset += 2;
        const rxl = payload[offset++];
        offset += 14; // spare
        if (cid !== 0) {
          gsm_cells.push({ cid, lac, mcc, mnc, rxl });
        }
      }
    }

    return new Packet01(serialNumber, latitude, longitude, battery, temperature, collar_detached, geofence_status, wifi_cells, gsm_cells);
  }
}

/**
 * Packet 0x0A - Command from Sentinel
 */
export class Packet0A {
  constructor(
    public readonly commandType: number,
    public readonly commandName: string,
    public readonly duration?: number,
  ) {}

  static fromBuffer(payload: Buffer): Packet0A {
    const commandType = payload[1];
    const commandMap: Record<number, string> = {
      0x01: "LIVE_TRACKING",
      0x02: "GEOFENCE",
      0x03: "ENERGY_SAVING_ZONE",
      0x04: "SETTINGS",
      0x05: "WAKEUP",
    };
    const commandName = commandMap[commandType] || "UNKNOWN";
    const duration = payload.length >= 4 ? payload.readInt16LE(2) : undefined;

    return new Packet0A(commandType, commandName, duration);
  }
}

/**
 * Packet 0x10 - EVO Extra Data from Sentinel
 */
export class Packet10 {
  constructor(
    public readonly evo_tasks: number,
    public readonly torch_duration?: number,
    public readonly tour_recording_enabled?: number,
    public readonly sound_command?: number,
    public readonly sound_duration?: number,
    public readonly energy_saving_area_enabled?: number,
  ) {}

  static fromBuffer(payload: Buffer): Packet10 {
    let offset = 1;
    const evo_tasks = payload.readUInt32LE(offset);
    offset += 4;

    const EvoFlashlight = 0x01;
    const EVO_TOUR_RECORDING = 0x02;
    const EvoSound = 0x04;
    const EvoEnergySaveArea = 0x08;

    let torch_duration: number | undefined;
    let tour_recording_enabled: number | undefined;
    let sound_command: number | undefined;
    let sound_duration: number | undefined;
    let energy_saving_area_enabled: number | undefined;

    if (evo_tasks & EvoFlashlight) {
      torch_duration = payload.readInt16LE(offset);
      offset += 2;
    }
    if (evo_tasks & EVO_TOUR_RECORDING) {
      tour_recording_enabled = payload.readInt8(offset);
      offset += 1;
    }
    if (evo_tasks & EvoSound) {
      sound_command = payload.readInt16LE(offset);
      offset += 2;
      sound_duration = payload.readInt16LE(offset);
      offset += 2;
    }
    if (evo_tasks & EvoEnergySaveArea) {
      energy_saving_area_enabled = payload.readInt8(offset);
      offset += 1;
    }

    return new Packet10(evo_tasks, torch_duration, tour_recording_enabled, sound_command, sound_duration, energy_saving_area_enabled);
  }
}

/**
 * Packet 0x15 - Safe Places WiFi from Sentinel
 */
export class Packet15 {
  constructor(public readonly zones: { lat: number; lng: number; radius: number; bssid: string }[]) {}

  static fromBuffer(payload: Buffer): Packet15 {
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
      const bssid = payload
        .subarray(offset, offset + 6)
        .toString("hex")
        .toUpperCase();
      offset += 6;

      zones.push({ lat, lng, radius, bssid });
    }

    return new Packet15(zones);
  }
}

// ================================ PARSING FACTORY ================================ //

export interface ParsedPacket {
  type: number;
  payload: Packet01 | Packet0A | Packet10 | Packet15 | { raw: string };
  raw: Buffer;
}

/**
 * Factory per parsing (centralizzato)
 */
export function parsePacketByType(payload: Buffer): ParsedPacket {
  const type = payload[0];

  try {
    switch (type) {
      case 0x01:
        return { type, payload: Packet01.fromBuffer(payload), raw: payload };
      case 0x0a:
        return { type, payload: Packet0A.fromBuffer(payload), raw: payload };
      case 0x10:
        return { type, payload: Packet10.fromBuffer(payload), raw: payload };
      case 0x15:
        return { type, payload: Packet15.fromBuffer(payload), raw: payload };
      default:
        return { type, payload: { raw: payload.toString("hex") }, raw: payload };
    }
  } catch (e) {
    logger.error(`Error parsing packet 0x${type.toString(16)}: ${e}`);
    return { type, payload: { raw: payload.toString("hex") }, raw: payload };
  }
}
