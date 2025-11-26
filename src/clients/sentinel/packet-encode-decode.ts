/**
 * ==================== SIRF PROTOCOL LEGEND for packet ENCODE/DECODE (Rust-like) ====================
 *
 * Ogni classe rappresenta un packet type con:
 * - constructor(): crea l'istanza con i dati
 * - toBuffer(): serializza in Buffer (manuale)
 * - static fromBuffer(): deserializza da Buffer (manuale)
 *
 * SIRF Protocol:
 * [HEADER: (2bytes) A0A2]
 * [LEN: (2bytes) SIZE] ← length of payload (includes PACKET_TYPE)
 * [PAYLOAD: (variable length bytes) TOTAL]
 *    └─ [PACKET_TYPE: (1byte) 0x01] ← FIRST byte of payload
 *    └─ [KIPPY_DATA: (N bytes) REST] ← serialNumber, IMEI, GPS, etc
 * [CRC: (2bytes) CHECKSUM]
 * [FOOTER: (2bytes) B0B3]
 *
 * - packet 01 - Geofence & Live tracking
 * - packet 10 - suono, torcia - ESZ
 */

import { logger } from "../../config/logger.js";
import { petlink } from "../petlink-infrastructure/client-petlink-infrastructure";

// ================================ ENUMS ================================ //

export enum CommandType {
  LIVE_TRACKING = 0x01,
  GEOFENCE = 0x02,
  ENERGY_SAVING_ZONE = 0x03,
  SETTINGS = 0x04,
  WAKEUP = 0x05,
}

export enum OperatingStatus {
  DEFAULT = 0x01, // to DEACTIVATE live-tracking (matches Rust's OPERATING_STATUS_DEFAULT = 1)
  FAST_TRACKING = 0x02, // to ACTIVATE live-tracking (matches Rust's OPERATING_STATUS_FAST_TRACKING = 2)
  GEOFENCE_ON = 0x03, // (matches Rust's OPERATING_STATUS_GEOFENCE_ON = 3)
}

export enum PacketType {
  PACKET_0x01 = 0x01,
  PACKET_0x0A = 0x0a,
  PACKET_0x10 = 0x10,
  PACKET_0x15 = 0x15,
}

// ================================ DIZIONARIO DEI TIPI ================================ //

/**
 * Map for types of pacekt received on sokcet by Sentinel
 */
export interface PacketTypeMap {
  [PacketType.PACKET_0x01]: typeof Packet01.S2DGeofenceResponse.Data;
  [PacketType.PACKET_0x0A]: typeof Packet0A.Data;
  [PacketType.PACKET_0x10]: typeof Packet10.Data;
  [PacketType.PACKET_0x15]: typeof Packet15.Data;
}

// ================================ SIRF PROTOCOL UTILITIES ================================ //

// Esporta costanti SIRF per uso in client e logging
export const SIRF = {
  HEADER: Buffer.from([0xa0, 0xa2]),
  LENGTH_FIELD: 2, // 2 bytes
  CRC: 2, // 2 bytes
  FOOTER: Buffer.from([0xb0, 0xb3]),
} as const;

// ================================ SENTINEL PACKET TYPES ================================ //

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
   * Logga pacchetto SIRF in modo simmetrico (hex + parsed)
   */
  static logPacket(direction: "INCOMING" | "OUTGOING", rawSirfPacket: Buffer, parsedPayload?: any): void {
    const type = rawSirfPacket[4];
    const length = rawSirfPacket.readUInt16BE(2);
    const payload = rawSirfPacket.subarray(4, 4 + length);
    const crc = rawSirfPacket.readUInt16BE(4 + length);

    // Legenda del protocollo SIRF (statica)
    const protocolLegend =
      `[SIRF-PROTOCOL]: [HEADER: (${SIRF.HEADER.length}bytes) ${SIRF.HEADER.toString("hex").toUpperCase()}] ` +
      `[LEN: (${SIRF.LENGTH_FIELD}bytes)] ` +
      `[PAYLOAD: [PACKET_TYPE: (1byte)] [PAYLOAD: (variable bytes)]] ` +
      `[CRC: (${SIRF.CRC}bytes) CHECKSUM] ` +
      `[FOOTER: (${SIRF.FOOTER.length}bytes) ${SIRF.FOOTER.toString("hex").toUpperCase()}]`;

    // Visualizzazione completa del pacchetto
    const packetVisualization =
      `\n\n[${direction}] SIRF Packet: 0x${type.toString(16).padStart(2, "0").toUpperCase()}\n` +
      `${protocolLegend}\n` +
      `[ORIGINAL-HEX]: ${rawSirfPacket.toString("hex").toUpperCase()}\n` +
      `[HEADER: ${rawSirfPacket.subarray(0, SIRF.HEADER.length).toString("hex").toUpperCase()}]\n` +
      `[LEN-PAYLOAD:] (hex: ${rawSirfPacket
        .subarray(SIRF.HEADER.length, SIRF.HEADER.length + SIRF.LENGTH_FIELD)
        .toString("hex")
        .toUpperCase()}) (decimal: ${length} B)\n` +
      `[PAYLOAD-HEX]: ${payload.toString("hex").toUpperCase()}\n` +
      `[PAYLOAD-DECIMAL]: [${Array.from(payload).join(", ")}] payload_size: ${payload.length}\n` +
      (parsedPayload ? `[PAYLOAD-PARSED]: ${JSON.stringify(parsedPayload)}\n` : "") +
      `[CRC: ${rawSirfPacket
        .subarray(SIRF.HEADER.length + SIRF.LENGTH_FIELD + length, SIRF.HEADER.length + SIRF.LENGTH_FIELD + length + SIRF.CRC)
        .toString("hex")
        .toUpperCase()}]\n` +
      `[FOOTER: ${rawSirfPacket
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
 * Packet 0x01 - BIDIREZIONALE
 * 1️⃣ Device → Sentinel (PacketWelcomeHeartBeat) - 109+ bytes
 *
 * 2️⃣ Sentinel → Device (PacketGeofenceResponse) - 71 bytes
 */
export class Packet01 {
  /**
   * Device → Sentinel (WelcomeHeartBeat)
   */
  static D2SWelcomeHeartBeat = class {
    static readonly Notifications = {
      NJustPowered: 0x01,
      NPoweringOFF: 0x02,
      NSMSReceived: 0x04,
      NNoGPS: 0x08,
      NJustUpgraded: 0x10,
      NInsideFence: 0x20,
      NOutsideFence: 0x40,
      NFullCharge: 0x80,
    } as const;

    static readonly SpareC5 = {
      NDetached: 0x01,
      NTempWarning: 0x02,
      NJustBooted: 0x04,
      NProductionTest: 0x08,
      NTempAlarm: 0x10,
      NContinousMode: 0x20,
      NGeran: 0x40,
      NEutran: 0x80,
    } as const;

    static readonly InfoFlags = {
      InfoGsmCellsFlag: 0x01,
      InfoAgpsEnable: 0x02,
      InfoAgps2: 0x04,
      InfoAgps3: 0x08,
      InfoActivity: 0x10,
      InfoFmwDisable: 0x20,
      InfoUbloxEph: 0x40,
      InfoWifiCells: 0x80,
    } as const;

    static Data = {
      // Main fields
      serial_number: "" as string,
      imei: "123456789012345" as string,
      iccid: "12345678901234567890" as string,
      fw_version: "10.1.70" as string,
      bl_version: "2.0.1" as string,
      latitude: 0 as number,
      longitude: 0 as number,
      altitude: 0 as number,
      last_gps_time: 0 as number,
      temperature: 20 as number,
      speed: 0 as number,
      battery: 4200 as number,
      csq: 20 as number,
      ber: 0 as number,
      new_status: 0 as number,
      curr_status: 0 as number,
      notifications: 0 as number, // Use Packet01.D2SWelcomeHeartBeat.Notifications.NJustPowered (example value)
      reset_cause: 0 as number,
      gprs_retry: 0 as number,
      gps_sat: 8 as number,
      spare_c4: 0 as number,
      spare_c5: 0 as number, // Use Packet01.D2SWelcomeHeartBeat.SpareC5.NDetached (example value)
      spare_c6: 0 as number,
      spare_c7: 0 as number,
      spare_c8: 0 as number,
      last_gprs: 0 as number,
      last_gps: 0 as number,
      spare_s3: 0 as number,
      spare_s4: 0 as number,
      spare_s5: 0 as number,
      spare_s6: 0 as number,
      spare_s7: 0 as number,
      spare_s8: 0 as number,
      info_flag: 0 as number, // Use Packet01.D2SWelcomeHeartBeat.InfoFlags.InfoGsmCellsFlag (example value)

      // Optional cell data
      wifi_cells: undefined as { bssid: string; rssi: number; channel: number }[] | undefined,
      gsm_cells: undefined as { cid: number; lac: number; mcc: number; mnc: number; rxl: number }[] | undefined,
    };

    static toBuffer(data: typeof Packet01.D2SWelcomeHeartBeat.Data): Buffer {
      const MAX_SIZE = 600;
      const buffer = Buffer.alloc(MAX_SIZE);
      let offset = 0;

      buffer[offset++] = PacketType.PACKET_0x01;

      // DEVICE_ID_LENGTH = 10
      stringToBytes(data.serial_number, 10).copy(buffer, offset);
      offset += 10;
      // IMEI_LENGTH = 15
      stringToBytes(data.imei, 15).copy(buffer, offset);
      offset += 15;
      // ICCID_LENGTH = 20
      stringToBytes(data.iccid, 20).copy(buffer, offset);
      offset += 20;

      // FIRMWARE_VERSION_LENGTH = 3
      const fwParts = data.fw_version.split(".").map(Number);
      for (let i = 0; i < 3; i++) buffer[offset++] = fwParts[i] || 0;

      // BOOTLOADER_VERSION_LENGTH = 3
      const blParts = data.bl_version.split(".").map(Number);
      for (let i = 0; i < 3; i++) buffer[offset++] = blParts[i] || 0;

      buffer.writeFloatLE(data.latitude, offset);
      offset += 4;
      buffer.writeFloatLE(data.longitude, offset);
      offset += 4;
      buffer.writeInt16LE(data.altitude, offset);
      offset += 2;
      buffer.writeUInt32LE(data.last_gps_time || Math.floor(Date.now() / 1000), offset);
      offset += 4;
      buffer.writeInt16LE(data.temperature * 10, offset); // Scale temperature
      offset += 2;
      buffer.writeInt16LE(data.speed, offset);
      offset += 2;
      buffer.writeInt16LE(data.battery, offset);
      offset += 2;
      buffer.writeUInt8(data.csq, offset++);
      buffer.writeUInt8(data.ber, offset++);
      buffer.writeUInt8(data.new_status, offset++);
      buffer.writeUInt8(data.curr_status, offset++);
      buffer.writeUInt8(data.notifications, offset++);
      buffer.writeUInt8(data.reset_cause, offset++);
      buffer.writeUInt8(data.gprs_retry, offset++);
      buffer.writeUInt8(data.gps_sat, offset++);
      buffer.writeUInt8(data.spare_c4, offset++);
      buffer.writeUInt8(data.spare_c5, offset++);
      buffer.writeUInt8(data.spare_c6, offset++);
      buffer.writeUInt8(data.spare_c7, offset++);
      buffer.writeUInt8(data.spare_c8, offset++);
      buffer.writeInt16LE(data.last_gprs, offset);
      offset += 2;
      buffer.writeInt16LE(data.last_gps, offset);
      offset += 2;
      buffer.writeInt16LE(data.spare_s3, offset);
      offset += 2;
      buffer.writeUInt16LE(data.spare_s4, offset);
      offset += 2;
      buffer.writeInt16LE(data.spare_s5, offset);
      offset += 2;
      buffer.writeInt16LE(data.spare_s6, offset);
      offset += 2;
      buffer.writeInt16LE(data.spare_s7, offset);
      offset += 2;
      buffer.writeInt16LE(data.spare_s8, offset);
      offset += 2;

      // Combine convenience wifi/gsm flags into info_flag byte
      const hasWiFi = data.wifi_cells && data.wifi_cells.length > 0;
      const hasGSM = data.gsm_cells && data.gsm_cells.length > 0;
      let info_flag = data.info_flag;
      if (hasWiFi) info_flag |= Packet01.D2SWelcomeHeartBeat.InfoFlags.InfoWifiCells;
      if (hasGSM) info_flag |= Packet01.D2SWelcomeHeartBeat.InfoFlags.InfoGsmCellsFlag;
      buffer.writeUInt8(info_flag, offset++);

      // Note: GSM/WiFi cell serialization is complex and not fully implemented
      // This is sufficient for current tests but may need expansion.

      return buffer.subarray(0, offset);
    }

    static fromBuffer(payload: Buffer): typeof Packet01.D2SWelcomeHeartBeat.Data {
      let offset = 1; // Skip packet type

      // DEVICE_ID_LENGTH = 10
      const serial_number = payload
        .subarray(offset, offset + 10)
        .toString("ascii")
        .replace(/\0/g, "");
      offset += 10;
      // IMEI_LENGTH = 15
      const imei = payload
        .subarray(offset, offset + 15)
        .toString("ascii")
        .replace(/\0/g, "");
      offset += 15;
      // ICCID_LENGTH = 20
      const iccid = payload
        .subarray(offset, offset + 20)
        .toString("ascii")
        .replace(/\0/g, "");
      offset += 20;

      // FIRMWARE_VERSION_LENGTH = 3
      const fw_version = [...payload.subarray(offset, offset + 3)].join(".");
      offset += 3;
      // BOOTLOADER_VERSION_LENGTH = 3
      const bl_version = [...payload.subarray(offset, offset + 3)].join(".");
      offset += 3;

      const latitude = payload.readFloatLE(offset);
      offset += 4;
      const longitude = payload.readFloatLE(offset);
      offset += 4;
      const altitude = payload.readInt16LE(offset);
      offset += 2;
      const last_gps_time = payload.readUInt32LE(offset);
      offset += 4;
      const temperature = payload.readInt16LE(offset) / 10;
      offset += 2;
      const speed = payload.readInt16LE(offset);
      offset += 2;
      const battery = payload.readInt16LE(offset);
      offset += 2;
      const csq = payload.readUInt8(offset++);
      const ber = payload.readUInt8(offset++);
      const new_status = payload.readUInt8(offset++);
      const curr_status = payload.readUInt8(offset++);
      const notifications = payload.readUInt8(offset++);
      const reset_cause = payload.readUInt8(offset++);
      const gprs_retry = payload.readUInt8(offset++);
      const gps_sat = payload.readUInt8(offset++);
      const spare_c4 = payload.readUInt8(offset++);
      const spare_c5 = payload.readUInt8(offset++);
      const spare_c6 = payload.readUInt8(offset++);
      const spare_c7 = payload.readUInt8(offset++);
      const spare_c8 = payload.readUInt8(offset++);
      const last_gprs = payload.readInt16LE(offset);
      offset += 2;
      const last_gps = payload.readInt16LE(offset);
      offset += 2;
      const spare_s3 = payload.readInt16LE(offset);
      offset += 2;
      const spare_s4 = payload.readUInt16LE(offset);
      offset += 2;
      const spare_s5 = payload.readInt16LE(offset);
      offset += 2;
      const spare_s6 = payload.readInt16LE(offset);
      offset += 2;
      const spare_s7 = payload.readInt16LE(offset);
      offset += 2;
      const spare_s8 = payload.readInt16LE(offset);
      offset += 2;
      const info_flag = payload.readUInt8(offset++);

      // Basic support for wifi/gsm, not fully parsed as it's complex and not needed yet.
      const wifi_cells = (info_flag & Packet01.D2SWelcomeHeartBeat.InfoFlags.InfoWifiCells) !== 0 ? [] : undefined;
      const gsm_cells = (info_flag & Packet01.D2SWelcomeHeartBeat.InfoFlags.InfoGsmCellsFlag) !== 0 ? [] : undefined;

      const data: typeof Packet01.D2SWelcomeHeartBeat.Data = {
        serial_number,
        imei,
        iccid,
        fw_version,
        bl_version,
        latitude,
        longitude,
        altitude,
        last_gps_time,
        temperature,
        speed,
        battery,
        csq,
        ber,
        new_status,
        curr_status,
        notifications,
        reset_cause,
        gprs_retry,
        gps_sat,
        spare_c4,
        spare_c5,
        spare_c6,
        spare_c7,
        spare_c8,
        last_gprs,
        last_gps,
        spare_s3,
        spare_s4,
        spare_s5,
        spare_s6,
        spare_s7,
        spare_s8,
        info_flag,
        wifi_cells,
        gsm_cells,
      };
      return data;
    }
  };

  /**
   * Sentinel → Device (GeofenceResponse)
   */
  static S2DGeofenceResponse = class {
    static Data = {
      lbs_current_latitude: 0 as number,
      lbs_current_longitude: 0 as number,
      server_position_source: 0 as number,
      geofence_latitude_longitude: [] as { lat: number; lng: number }[],
      requested_operating_status: 0 as number,
      update_frequency: 0 as number,
      utc_timestamp: 0 as number,
      tx_every_check: 0 as number,
      lbs_current_radius: 0 as number,
    };

    static toBuffer(data: typeof Packet01.S2DGeofenceResponse.Data): Buffer {
      const buffer = Buffer.alloc(71); // Fixed size
      let offset = 0;

      buffer[offset++] = PacketType.PACKET_0x01;

      buffer.writeFloatLE(data.lbs_current_latitude, offset);
      offset += 4;
      buffer.writeFloatLE(data.lbs_current_longitude, offset);
      offset += 4;
      buffer[offset++] = data.server_position_source;

      // Serialize up to 6 geofence points, pad with zeros
      const geofences = data.geofence_latitude_longitude.slice(0, 6);
      geofences.forEach(({ lat, lng }) => {
        buffer.writeFloatLE(lat, offset);
        offset += 4;
        buffer.writeFloatLE(lng, offset);
        offset += 4;
      });
      // Pad remaining to 48 bytes (6*8)
      while (offset < 1 + 8 + 1 + 48) {
        buffer.writeFloatLE(0, offset);
        offset += 4;
        buffer.writeFloatLE(0, offset);
        offset += 4;
      }

      buffer[offset++] = data.requested_operating_status;
      buffer.writeUInt16LE(data.update_frequency, offset);
      offset += 2;
      buffer.writeUInt32LE(data.utc_timestamp, offset);
      offset += 4;
      buffer.writeUInt16LE(data.tx_every_check, offset);
      offset += 2;
      buffer.writeUInt32LE(data.lbs_current_radius, offset);

      return buffer;
    }

    static fromBuffer(payload: Buffer): typeof Packet01.S2DGeofenceResponse.Data {
      let offset = 0;
      const packetNumber = payload[offset++];
      if (packetNumber !== PacketType.PACKET_0x01) throw new Error(`Invalid packet: 0x${packetNumber.toString(16)}`);

      const lbs_current_latitude = payload.readFloatLE(offset);
      offset += 4;
      const lbs_current_longitude = payload.readFloatLE(offset);
      offset += 4;
      const server_position_source = payload[offset++];

      const geofence_latitude_longitude: { lat: number; lng: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const lat = payload.readFloatLE(offset);
        offset += 4;
        const lng = payload.readFloatLE(offset);
        offset += 4;
        // Don't add empty coordinates
        if (lat !== 0 || lng !== 0) {
          geofence_latitude_longitude.push({ lat, lng });
        }
      }

      const requested_operating_status = payload[offset++];
      const update_frequency = payload.readUInt16LE(offset);
      offset += 2;
      const utc_timestamp = payload.readUInt32LE(offset);
      offset += 4;
      const tx_every_check = payload.readUInt16LE(offset);
      offset += 2;
      const lbs_current_radius = payload.readUInt32LE(offset);

      const data: typeof Packet01.S2DGeofenceResponse.Data = {
        lbs_current_latitude,
        lbs_current_longitude,
        server_position_source,
        geofence_latitude_longitude,
        requested_operating_status,
        update_frequency,
        utc_timestamp,
        tx_every_check,
        lbs_current_radius,
      };
      return data;
    }
  };
}

export class Packet0A {
  static Data = {
    command_type: 0 as CommandType,
    duration: undefined as number | undefined,
  };

  static toBuffer(data: typeof Packet0A.Data): Buffer {
    const hasDuration = data.duration !== undefined;
    const buffer = Buffer.alloc(2 + (hasDuration ? 2 : 0));
    let offset = 0;
    buffer.writeUInt8(PacketType.PACKET_0x0A, offset++);
    buffer.writeUInt8(data.command_type, offset++);
    if (hasDuration) {
      buffer.writeInt16LE(data.duration!, offset);
    }
    return buffer;
  }

  static fromBuffer(payload: Buffer): typeof Packet0A.Data {
    const command_type = payload[1];
    const duration = payload.length >= 4 ? payload.readInt16LE(2) : undefined;

    const data: typeof Packet0A.Data = { command_type, duration };
    return data;
  }
}

export class Packet10 {
  static Data = {
    evo_tasks: 0 as number,
    torch_duration: undefined as number | undefined,
    tour_recording_enabled: undefined as number | undefined,
    sound_command: undefined as number | undefined,
    sound_duration: undefined as number | undefined,
    energy_saving_area_enabled: undefined as number | undefined,
  };

  static fromBuffer(payload: Buffer): typeof Packet10.Data {
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

    const data: typeof Packet10.Data = {
      evo_tasks,
      torch_duration,
      tour_recording_enabled,
      sound_command,
      sound_duration,
      energy_saving_area_enabled,
    };
    return data;
  }
}

export class Packet15 {
  static Data = {
    zones: [] as { lat: number; lng: number; radius: number; bssid: string }[],
  };

  static fromBuffer(payload: Buffer): typeof Packet15.Data {
    const zones: { lat: number; lng: number; radius: number; bssid: string }[] = [];
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

    const data: typeof Packet15.Data = { zones };
    return data;
  }
}

// ================================ PARSING FACTORY ================================ //

export interface ParsedPacket {
  type: number;
  payload:
    | typeof Packet01.D2SWelcomeHeartBeat.Data
    | typeof Packet01.S2DGeofenceResponse.Data
    | typeof Packet0A.Data
    | typeof Packet10.Data
    | typeof Packet15.Data
    | { error: string };
  raw: Buffer;
}

export function parsePacketByType(payload: Buffer): ParsedPacket {
  const type = payload[0];

  try {
    switch (type) {
      case PacketType.PACKET_0x01:
        if (payload.length === 71) {
          return { type, payload: Packet01.S2DGeofenceResponse.fromBuffer(payload), raw: payload };
        } else {
          return { type, payload: Packet01.D2SWelcomeHeartBeat.fromBuffer(payload), raw: payload };
        }
      case PacketType.PACKET_0x0A:
        return { type, payload: Packet0A.fromBuffer(payload), raw: payload };
      case PacketType.PACKET_0x10:
        return { type, payload: Packet10.fromBuffer(payload), raw: payload };
      case PacketType.PACKET_0x15:
        return { type, payload: Packet15.fromBuffer(payload), raw: payload };
      default:
        const errorMessage = `Parser for packet not found.`;
        logger.warn(errorMessage);
        return { type, payload: { error: errorMessage }, raw: payload };
    }
  } catch (e) {
    const errorMessage = `Error parsing packet 0x${type.toString(16)}: ${e instanceof Error ? e.message : String(e)}`;
    logger.error(errorMessage);
    return { type, payload: { error: errorMessage }, raw: payload };
  }
}
