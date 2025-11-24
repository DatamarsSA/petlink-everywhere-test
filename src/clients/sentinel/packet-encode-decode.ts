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
  DEFAULT = 0x00,
  GEOFENCE_ON = 0x01,
  FAST_TRACKING = 0x02,
}

// ================================ DIZIONARIO DEI TIPI ================================ //

export interface PacketTypeMap {
  [PacketType.PACKET_0x01]: typeof Packet01S2D.Data;
  [PacketType.PACKET_0x0A]: typeof Packet0A.Data;
  [PacketType.PACKET_0x10]: Packet10;
  [PacketType.PACKET_0x15]: Packet15;
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

export enum PacketType {
  PACKET_0x01 = 0x01,
  PACKET_0x0A = 0x0a,
  PACKET_0x10 = 0x10,
  PACKET_0x15 = 0x15,
}

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
 *
 * 1️⃣ Device → Sentinel (Welcome/Heartbeat) - 109+ bytes
 *    - Uso: new Packet01(serialNumber, lat, lng, battery, temp)
 *    - Parsing: Packet01.fromBufferDeviceToSentinel(payload)
 *
 * 2️⃣ Sentinel → Device (PacketGeofenceResponse) - 71 bytes
 *    - Uso: new Packet01({ lbsCurrentLatitude, ... })
 *    - Parsing: Packet01.fromBufferSentinelToDevice(payload)
 */

// Represents a packet sent FROM the Device TO Sentinel
export class Packet01D2S {
  static Data = {
    serialNumber: "" as string,
    latitude: 0 as number,
    longitude: 0 as number,
    battery: 4200 as number,
    temperature: 20 as number,
    collar_detached: false as boolean,
    geofence_status: "none" as "inside" | "outside" | "none",
    wifi_cells: undefined as { bssid: string; rssi: number; channel: number }[] | undefined,
    gsm_cells: undefined as { cid: number; lac: number; mcc: number; mnc: number; rxl: number }[] | undefined,
  };

  static toBuffer(data: typeof Packet01D2S.Data): Buffer {
    const MAX_SIZE = 600;
    const buffer = Buffer.alloc(MAX_SIZE);
    let offset = 0;

    buffer[offset++] = PacketType.PACKET_0x01;

    const hasWiFi = data.wifi_cells && data.wifi_cells.length > 0;
    const hasGSM = data.gsm_cells && data.gsm_cells.length > 0;

    stringToBytes(data.serialNumber, 10).copy(buffer, offset);
    offset += 10;
    stringToBytes("123456789012345", 15).copy(buffer, offset);
    offset += 15;
    stringToBytes("12345678901234567890", 20).copy(buffer, offset);
    offset += 20;
    buffer[offset++] = 10;
    buffer[offset++] = 0;
    buffer[offset++] = 73;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer.writeFloatLE(data.latitude ?? 0, offset);
    offset += 4;
    buffer.writeFloatLE(data.longitude ?? 0, offset);
    offset += 4;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeUInt32LE(Math.floor(Date.now() / 1000), offset);
    offset += 4;
    buffer.writeInt16LE((data.temperature ?? 20) * 10, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(data.battery ?? 4200, offset);
    offset += 2;
    buffer[offset++] = 20;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;

    let notifications = 0x00;
    if (data.geofence_status === "inside") notifications |= 0x20;
    else if (data.geofence_status === "outside") notifications |= 0x40;
    buffer[offset++] = notifications;

    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 80;
    buffer[offset++] = (data.collar_detached ?? false) ? 0x01 : 0x00;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeUInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;
    buffer.writeInt16LE(0, offset);
    offset += 2;

    let infoFlag = 0x00;
    if (hasWiFi) infoFlag |= 0x01;
    if (hasGSM) infoFlag |= 0x04;
    buffer[offset++] = infoFlag;

    if (hasWiFi) {
      for (let i = 0; i < 10; i++) {
        const wifi = data.wifi_cells![i];
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

    if (hasGSM) {
      for (let i = 0; i < 7; i++) {
        const gsm = data.gsm_cells![i];
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

  static fromBuffer(payload: Buffer): typeof Packet01D2S.Data {
    let offset = 1;

    const serialNumber = payload
      .subarray(offset, offset + 10)
      .toString("ascii")
      .replace(/\0/g, "");
    offset += 10;
    offset += 15;
    offset += 20;
    offset += 3;
    offset += 3;
    const latitude = payload.readFloatLE(offset);
    offset += 4;
    const longitude = payload.readFloatLE(offset);
    offset += 4;
    offset += 2;
    offset += 4;
    const temperature = payload.readInt16LE(offset) / 10;
    offset += 2;
    offset += 2;
    const battery = payload.readInt16LE(offset);
    offset += 2;
    offset += 1;
    offset += 1;
    offset += 1;
    offset += 1;
    const notifications = payload[offset++];
    const geofence_status: "inside" | "outside" | "none" = notifications & 0x20 ? "inside" : notifications & 0x40 ? "outside" : "none";
    offset += 1;
    offset += 1;
    offset += 1;
    offset += 1;
    const collar_detached = (payload[offset++] & 0x01) === 0x01;
    offset += 1;
    offset += 1;
    offset += 1;
    offset += 2;
    offset += 2;
    offset += 2;
    offset += 2;
    offset += 2;
    offset += 2;
    offset += 2;
    offset += 2;
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
        offset += 14;
        if (cid !== 0) {
          gsm_cells.push({ cid, lac, mcc, mnc, rxl });
        }
      }
    }

    const data: typeof Packet01D2S.Data = {
      serialNumber,
      latitude,
      longitude,
      battery,
      temperature,
      collar_detached,
      geofence_status,
      wifi_cells,
      gsm_cells,
    };
    return data;
  }
}

// Represents a packet sent FROM Sentinel TO the Device
export class Packet01S2D {
  static Data = {
    lbsCurrentLatitude: 0 as number,
    lbsCurrentLongitude: 0 as number,
    serverPositionSource: 0 as number,
    geofenceCoordinates: [] as { lat: number; lng: number }[],
    requestedOperatingStatus: 0 as number,
    updateFrequency: 0 as number,
    utcTimestamp: 0 as number,
    txEveryCheck: 0 as number,
    lbsCurrentRadius: 0 as number,
  };

  static fromBuffer(payload: Buffer): typeof Packet01S2D.Data {
    let offset = 0;
    const packetNumber = payload[offset++];
    if (packetNumber !== 0x01) throw new Error(`Invalid packet: 0x${packetNumber.toString(16)}`);

    const lbsCurrentLatitude = payload.readFloatLE(offset);
    offset += 4;
    const lbsCurrentLongitude = payload.readFloatLE(offset);
    offset += 4;
    const serverPositionSource = payload[offset++];

    const geofenceCoordinates: { lat: number; lng: number }[] = [];
    for (let i = 0; i < 6; i++) {
      geofenceCoordinates.push({
        lat: payload.readFloatLE(offset),
        lng: payload.readFloatLE(offset + 4),
      });
      offset += 8;
    }

    const requestedOperatingStatus = payload[offset++];
    const updateFrequency = payload.readUInt16LE(offset);
    offset += 2;
    const utcTimestamp = payload.readUInt32LE(offset);
    offset += 4;
    const txEveryCheck = payload.readUInt16LE(offset);
    offset += 2;
    const lbsCurrentRadius = payload.readUInt32LE(offset);

    return {
      lbsCurrentLatitude,
      lbsCurrentLongitude,
      serverPositionSource,
      geofenceCoordinates,
      requestedOperatingStatus,
      updateFrequency,
      utcTimestamp,
      txEveryCheck,
      lbsCurrentRadius,
    };
  }
}

export class Packet0A {
  static Data = {
    commandType: 0 as CommandType,
    duration: undefined as number | undefined,
  };

  static toBuffer(data: typeof Packet0A.Data): Buffer {
    const hasDuration = data.duration !== undefined;
    const buffer = Buffer.alloc(2 + (hasDuration ? 2 : 0));
    let offset = 0;
    buffer.writeUInt8(PacketType.PACKET_0x0A, offset++);
    buffer.writeUInt8(data.commandType, offset++);
    if (hasDuration) {
      buffer.writeInt16LE(data.duration!, offset);
    }
    return buffer;
  }

  static fromBuffer(payload: Buffer): typeof Packet0A.Data {
    const commandType = payload[1];
    const duration = payload.length >= 4 ? payload.readInt16LE(2) : undefined;

    return { commandType, duration };
  }
}

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
  payload: typeof Packet01S2D.Data | typeof Packet01D2S.Data | typeof Packet0A.Data | Packet10 | Packet15 | { error: string };
  raw: Buffer;
}

export function parsePacketByType(payload: Buffer): ParsedPacket {
  const type = payload[0];

  try {
    switch (type) {
      case PacketType.PACKET_0x01:
        if (payload.length === 71) {
          return { type, payload: Packet01S2D.fromBuffer(payload), raw: payload };
        } else {
          return { type, payload: Packet01D2S.fromBuffer(payload), raw: payload };
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
