// import { Parser } from "binary-parser";
const { Parser } = require("binary-parser");
// ============================================
// TYPES
// ============================================

export interface WiFiCell {
  bssid: number[];
  rssi: number;
  channel: number;
}

export interface GSMCell {
  cellType: number;
  cellDescription: number[];
}

export interface Packet01Parsed {
  packetType: number;
  serialNumber: string;
  imei: string;
  iccid: string;
  fwVersion: number[];
  bootVersion: number[];
  latitude: number;
  longitude: number;
  altitude: number;
  lastGpsTime: number;
  temperature: number;
  speed: number;
  battery: number;
  csq: number;
  ber: number;
  newStatus: number;
  currStatus: number;
  resetCause: number;
  gprsRetry: number;
  gpsSat: number;
  spare_c4: number;
  spare_c6: number;
  spare_c7: number;
  spare_c8: number;
  lastGprs: number;
  lastGps: number;
  spare_s3: number;
  spare_s4: number;
  spare_s5: number;
  spare_s6: number;
  spare_s7: number;
  spare_s8: number;
  notifications: number;
  spare_c5: number;
  infoFlag: number;
  extraData?: {
    wifiCells?: WiFiCell[];
    gsmCells?: GSMCell[];
  };
}

export interface Packet02Parsed {
  packetType: number;
  sequenceNumber: number;
  status: number;
  rawData: Buffer;
}

export interface Packet0AParsed {
  packetType: number;
  commandType: number;
  duration: number;
  rawData: Buffer;
}

// ============================================
// PARSER DEFINITIONS
// ============================================

/**
 * WiFi Cell Parser (9 bytes per cell)
 * - bssid: 6 bytes (MAC address)
 * - rssi: 1 byte (signal strength)
 * - channel: 2 bytes (WiFi channel)
 */
const wifiCellParser = new Parser().array("bssid", { type: "uint8", length: 6 }).int8("rssi").uint16le("channel");

/**
 * GSM Cell Parser (23 bytes per cell)
 * - cellType: 1 byte
 * - cellDescription: 22 bytes
 */
const gsmCellParser = new Parser().uint8("cellType").array("cellDescription", { type: "uint8", length: 22 });

/**
 * PACKET 0x01 (WELCOME/HEARTBEAT)
 * Base: 109 bytes
 * Optional: WiFi cells (90 bytes) + GSM cells (161 bytes)
 */
export const packet01Parser = new Parser()
  .uint8("packetType")
  .string("serialNumber", { length: 10, encoding: "ascii" })
  .string("imei", { length: 15, encoding: "ascii" })
  .string("iccid", { length: 20, encoding: "ascii" })
  .array("fwVersion", { type: "uint8", length: 3 })
  .array("bootVersion", { type: "uint8", length: 3 })
  .floatle("latitude")
  .floatle("longitude")
  .int16le("altitude")
  .uint32le("lastGpsTime")
  .int16le("temperature")
  .int16le("speed")
  .int16le("battery")
  .uint8("csq")
  .uint8("ber")
  .uint8("newStatus")
  .uint8("currStatus")
  .uint8("resetCause")
  .uint8("gprsRetry")
  .uint8("gpsSat")
  .uint8("spare_c4")
  .uint8("spare_c6")
  .uint8("spare_c7")
  .uint8("spare_c8")
  .int16le("lastGprs")
  .int16le("lastGps")
  .int16le("spare_s3")
  .uint16le("spare_s4")
  .int16le("spare_s5")
  .int16le("spare_s6")
  .int16le("spare_s7")
  .int16le("spare_s8")
  .uint8("notifications")
  .uint8("spare_c5")
  .uint8("infoFlag")
  .choice("extraData", {
    tag: "infoFlag",
    choices: {
      0x00: new Parser(), // No extra data
      0x01: new Parser().array("wifiCells", {
        type: wifiCellParser,
        length: 10,
      }),
      0x04: new Parser().array("gsmCells", {
        type: gsmCellParser,
        length: 7,
      }),
      0x05: new Parser().array("wifiCells", { type: wifiCellParser, length: 10 }).array("gsmCells", { type: gsmCellParser, length: 7 }),
    },
    defaultChoice: new Parser(),
  });

/**
 * PACKET 0x02 (ACK)
 * - packetType: 1 byte (0x02)
 * - sequenceNumber: 2 bytes (LE)
 * - status: 1 byte
 * - rawData: rest of payload
 */
export const packet02Parser = new Parser().uint8("packetType").uint16le("sequenceNumber").uint8("status").buffer("rawData", { readUntil: "eof" });

/**
 * PACKET 0x0A (COMMAND)
 * - packetType: 1 byte (0x0A)
 * - commandType: 1 byte
 * - duration: 2 bytes (LE)
 * - rawData: rest of payload
 */
export const packet0AParser = new Parser().uint8("packetType").uint8("commandType").uint16le("duration").buffer("rawData", { readUntil: "eof" });

/**
 * PACKET 0x10 (EVO TASKS)
 * - packetType: 1 byte (0x10)
 * - evo_tasks: 4 bytes (LE)
 * - conditional fields based on evo_tasks bitmask
 */
export const packet10Parser = new Parser().uint8("packetType").uint32le("evo_tasks").buffer("rawData", { readUntil: "eof" });

/**
 * PACKET 0x15 (ENERGY SAVING ZONES)
 * - packetType: 1 byte (0x15)
 * - zones: array of (lat, lng, radius, bssid)
 */
export const packet15Parser = new Parser().uint8("packetType").buffer("rawData", { readUntil: "eof" });

// ============================================
// HELPER: Parse any packet by type
// ============================================

export function parsePacketByType(payload: Buffer): any {
  const packetType = payload[0];

  try {
    switch (packetType) {
      case 0x01:
        return packet01Parser.parse(payload);
      case 0x02:
        return packet02Parser.parse(payload);
      case 0x0a:
        return packet0AParser.parse(payload);
      case 0x10:
        return packet10Parser.parse(payload);
      case 0x15:
        return packet15Parser.parse(payload);
      default:
        return {
          packetType,
          rawData: payload,
          _unparsed: true,
        };
    }
  } catch (error) {
    return {
      packetType,
      rawData: payload,
      _error: error instanceof Error ? error.message : String(error),
    };
  }
}
