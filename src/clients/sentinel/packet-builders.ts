//------ PACKET BUILDERS ------
// Contiene tutti i builder per i vari packet types (0x01, 0x02, 0x06, ecc)
// Ogni builder segue il pattern: buildPacket() → payload specifico → SIRF wrap

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
  payloadBuilder: (buffer: Buffer, offset: number) => number; // Ritorna nuovo offset
}

//------ SIRF PROTOCOL UTILITIES ------

/**
 * Encapsula un payload nel formato SIRF protocol (add header/footer/CRC)
 * Questo è il wrapper finale che aggiunge:
 * - Header: 0xA0A2
 * - Length: lunghezza payload (big-endian)
 * - Payload: i dati
 * - CRC: checksum 15-bit
 * - Footer: 0xB0B3
 */
function encapsulateOnSIRFProtocol(payload: Buffer): Buffer {
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

//------ BASE PACKET BUILDER ------

/**
 * Builder generico per tutti i packet types
 * Gestisce: allocazione buffer → packet type → payload specifico → SIRF wrapping
 *
 * Uso:
 * buildPacket({
 *   packetType: 0x01,
 *   payloadBuilder: (buffer, offset) => {
 *     // Scrivi il payload specifico
 *     buffer[offset++] = 0x50;
 *     return offset;
 *   }
 * });
 */
function buildPacket(config: PacketBuilderConfig): Buffer {
  // STEP 1: Alloca buffer massimo (sarà trimmato dopo)
  const MAX_PAYLOAD_SIZE = 500;
  const payload = Buffer.alloc(MAX_PAYLOAD_SIZE);
  let offset = 0;

  // STEP 2: Scrivi packet type (sempre primo byte)
  payload[offset++] = config.packetType;

  // STEP 3: Chiama il builder specifico per il payload
  const payloadEnd = config.payloadBuilder(payload, offset);

  // STEP 4: Estrai solo i byte usati
  const finalPayload = payload.slice(0, payloadEnd);

  logger.debug(`📦 Packet 0x${config.packetType.toString(16).toUpperCase().padStart(2, "0")} - Payload size: ${finalPayload.length} bytes`);
  logger.debug(`   Hex: ${finalPayload.toString("hex").toUpperCase()}`);

  // STEP 5: Incapsula nel SIRF protocol
  const sirf = encapsulateOnSIRFProtocol(finalPayload);

  logger.debug(`🔗 SIRF Encapsulated - Total size: ${sirf.length} bytes`);
  logger.debug(`   Hex: ${sirf.toString("hex").toUpperCase()}`);

  return sirf;
}

//------ PACKET 0x01: WELCOME ------

/**
 * Crea il pacchetto 0x01 WELCOME
 * Basato su kippy-protocol.md - Contiene TUTTI i campi obbligatori
 * + WiFi cells (opzionale, 90 bytes)
 * + GSM cells (opzionale, 161 bytes)
 */
export function createPacket01(
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
  return buildPacket({
    packetType: 0x01,
    payloadBuilder: (buffer, offset) => {
      // Calcola la dimensione totale
      let totalSize = 109; // Base obbligatorio
      const hasWiFi = options?.wifi_cells && options.wifi_cells.length > 0;
      const hasGSM = options?.gsm_cells && options.gsm_cells.length > 0;

      if (hasWiFi) totalSize += 90; // 10 WiFi cells × 9 bytes
      if (hasGSM) totalSize += 161; // 7 GSM cells × 23 bytes

      logger.debug("🔧 Starting Packet 0x01 (Welcome) creation");
      logger.debug(`Device: ${serialNumber}`);

      // Serial number (10 bytes)
      const startSerial = offset;
      stringToBytes(serialNumber, 10).copy(buffer, offset);
      offset += 10;
      logger.debug(
        `[${startSerial}-${offset - 1}] serialNumber: ${serialNumber} → ${buffer.slice(startSerial, offset).toString("hex").toUpperCase()}`,
      );

      // IMEI (15 bytes)
      const startImei = offset;
      stringToBytes("123456789012345", 15).copy(buffer, offset);
      offset += 15;
      logger.debug(`[${startImei}-${offset - 1}] imei: 123456789012345 → ${buffer.slice(startImei, offset).toString("hex").toUpperCase()}`);

      // CCID (20 bytes)
      const startCcid = offset;
      stringToBytes("12345678901234567890", 20).copy(buffer, offset);
      offset += 20;
      logger.debug(`[${startCcid}-${offset - 1}] iccid: 12345678901234567890 → ${buffer.slice(startCcid, offset).toString("hex").toUpperCase()}`);

      // FW version (3 bytes)
      const startFw = offset;
      buffer[offset++] = 1;
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      logger.debug(`[${startFw}-${offset - 1}] fw_version: 1.0.0 → ${buffer.slice(startFw, offset).toString("hex").toUpperCase()}`);

      // Boot version (3 bytes)
      const startBl = offset;
      buffer[offset++] = 1;
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      logger.debug(`[${startBl}-${offset - 1}] bl_version: 1.0.0 → ${buffer.slice(startBl, offset).toString("hex").toUpperCase()}`);

      // Latitude (4 bytes, f32 - LITTLE ENDIAN)
      const lat = options?.latitude || 0;
      const startLat = offset;
      buffer.writeFloatLE(lat, offset);
      logger.debug(
        `[${startLat}-${offset + 3}] latitude: ${lat} → ${buffer
          .slice(startLat, offset + 4)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 4;

      // Longitude (4 bytes, f32 - LITTLE ENDIAN)
      const lon = options?.longitude || 0;
      const startLon = offset;
      buffer.writeFloatLE(lon, offset);
      logger.debug(
        `[${startLon}-${offset + 3}] longitude: ${lon} → ${buffer
          .slice(startLon, offset + 4)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 4;

      // Altitude (2 bytes, int16 - LITTLE ENDIAN)
      const startAlt = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startAlt}-${offset + 1}] altitude: 0 → ${buffer
          .slice(startAlt, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Last GPS time (4 bytes, uint32 - LITTLE ENDIAN)
      const startTime = offset;
      const gpsTime = Math.floor(Date.now() / 1000);
      buffer.writeUInt32LE(gpsTime, offset);
      logger.debug(
        `[${startTime}-${offset + 3}] last_gps_time: ${gpsTime} → ${buffer
          .slice(startTime, offset + 4)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 4;

      // Temperature (2 bytes, int16 - in 0.1°C - LITTLE ENDIAN)
      const temp = (options?.temperature || 20) * 10;
      const startTemp = offset;
      buffer.writeInt16LE(temp, offset);
      logger.debug(
        `[${startTemp}-${offset + 1}] temperature: ${options?.temperature || 20}°C → ${buffer
          .slice(startTemp, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Speed (2 bytes, int16 - LITTLE ENDIAN)
      const startSpeed = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startSpeed}-${offset + 1}] speed: 0 → ${buffer
          .slice(startSpeed, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Battery voltage (2 bytes, int16 - in mV - LITTLE ENDIAN)
      const battery = options?.battery || 4200;
      const startBatt = offset;
      buffer.writeInt16LE(battery, offset);
      logger.debug(
        `[${startBatt}-${offset + 1}] battery: ${battery}mV → ${buffer
          .slice(startBatt, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Modem quality (CSQ) (1 byte)
      const startCsq = offset;
      buffer[offset++] = 20;
      logger.debug(`[${startCsq}] csq: 20 → ${buffer.slice(startCsq, offset).toString("hex").toUpperCase()}`);

      // Modem BER (1 byte)
      const startBer = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startBer}] ber: 0 → ${buffer.slice(startBer, offset).toString("hex").toUpperCase()}`);

      // New operating status (1 byte)
      const startNewStatus = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startNewStatus}] new_status: 0 → ${buffer.slice(startNewStatus, offset).toString("hex").toUpperCase()}`);

      // Current operating status (1 byte) - 0x00 = DEFAULT
      const startCurrStatus = offset;
      buffer[offset++] = 0x00;
      logger.debug(`[${startCurrStatus}] curr_status: 0 → ${buffer.slice(startCurrStatus, offset).toString("hex").toUpperCase()}`);

      // Reset cause (1 byte)
      const startResetCause = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startResetCause}] reset_cause: 0 → ${buffer.slice(startResetCause, offset).toString("hex").toUpperCase()}`);

      // Modem retry (1 byte)
      const startGprsRetry = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startGprsRetry}] gprs_retry: 0 → ${buffer.slice(startGprsRetry, offset).toString("hex").toUpperCase()}`);

      // Modem num sat (1 byte)
      const startGpsSat = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startGpsSat}] gps_sat: 0 → ${buffer.slice(startGpsSat, offset).toString("hex").toUpperCase()}`);

      // Battery remaining (spare_c4) (1 byte) - percentuale
      const startSpareC4 = offset;
      buffer[offset++] = 80;
      logger.debug(`[${startSpareC4}] spare_c4: 80% → ${buffer.slice(startSpareC4, offset).toString("hex").toUpperCase()}`);

      // Modem GMR (spare_c6) (1 byte)
      const startSpareC6 = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startSpareC6}] spare_c6: 0 → ${buffer.slice(startSpareC6, offset).toString("hex").toUpperCase()}`);

      // Modem retry (spare_c7) (1 byte)
      const startSpareC7 = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startSpareC7}] spare_c7: 0 → ${buffer.slice(startSpareC7, offset).toString("hex").toUpperCase()}`);

      // Modem error (spare_c8) (1 byte)
      const startSpareC8 = offset;
      buffer[offset++] = 0;
      logger.debug(`[${startSpareC8}] spare_c8: 0 → ${buffer.slice(startSpareC8, offset).toString("hex").toUpperCase()}`);

      // Modem time from last GPRS (2 bytes - LITTLE ENDIAN)
      const startLastGprs = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startLastGprs}-${offset + 1}] last_gprs: 0 → ${buffer
          .slice(startLastGprs, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Modem looking for GPS for (2 bytes - LITTLE ENDIAN)
      const startLastGps = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startLastGps}-${offset + 1}] last_gps: 0 → ${buffer
          .slice(startLastGps, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Current radius (spare_s3) (2 bytes - LITTLE ENDIAN)
      const startSpareS3 = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startSpareS3}-${offset + 1}] spare_s3: 0 → ${buffer
          .slice(startSpareS3, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Ephemeris CRC (spare_s4) (2 bytes - LITTLE ENDIAN)
      const startSpareS4 = offset;
      buffer.writeUInt16LE(0, offset);
      logger.debug(
        `[${startSpareS4}-${offset + 1}] spare_s4: 0 → ${buffer
          .slice(startSpareS4, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Life (spare_s5) (2 bytes - LITTLE ENDIAN)
      const startSpareS5 = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startSpareS5}-${offset + 1}] spare_s5: 0 → ${buffer
          .slice(startSpareS5, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Life (spare_s6) (2 bytes - LITTLE ENDIAN)
      const startSpareS6 = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startSpareS6}-${offset + 1}] spare_s6: 0 → ${buffer
          .slice(startSpareS6, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Active life (spare_s7) (2 bytes - LITTLE ENDIAN)
      const startSpareS7 = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startSpareS7}-${offset + 1}] spare_s7: 0 → ${buffer
          .slice(startSpareS7, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Active life (spare_s8) (2 bytes - LITTLE ENDIAN)
      const startSpareS8 = offset;
      buffer.writeInt16LE(0, offset);
      logger.debug(
        `[${startSpareS8}-${offset + 1}] spare_s8: 0 → ${buffer
          .slice(startSpareS8, offset + 2)
          .toString("hex")
          .toUpperCase()}`,
      );
      offset += 2;

      // Server notifications (1 byte) - flags per geofence
      // Bit 0x20 = inside_geofence, 0x40 = outside_geofence
      let notifications = 0x00;
      if (options?.geofence_status === "inside") {
        notifications |= 0x20; // Bit 5
      } else if (options?.geofence_status === "outside") {
        notifications |= 0x40; // Bit 6
      }
      const startNotif = offset;
      buffer[offset++] = notifications;
      logger.debug(
        `[${startNotif}] notifications: ${options?.geofence_status || "none"} → ${buffer.slice(startNotif, offset).toString("hex").toUpperCase()}`,
      );

      // Server notification ext (spare_c5) (1 byte) - flags per ESZ
      // Bit 0x01 = collar_detached (ESZ mode)
      const collar_detached = options?.collar_detached ? 0x01 : 0x00;
      const startSpareC5 = offset;
      buffer[offset++] = collar_detached;
      logger.debug(
        `[${startSpareC5}] spare_c5 (ESZ): ${options?.collar_detached ? "detached" : "attached"} → ${buffer.slice(startSpareC5, offset).toString("hex").toUpperCase()}`,
      );

      // Detailed information flag (1 byte)
      // Bit 0 = wifiCell, Bit 2 = gsmCell
      let infoFlag = 0x00;
      if (hasWiFi) infoFlag |= 0x01; // Bit 0
      if (hasGSM) infoFlag |= 0x04; // Bit 2
      const startInfoFlag = offset;
      buffer[offset++] = infoFlag;
      logger.debug(
        `[${startInfoFlag}] info_flag: ${hasWiFi ? "WiFi" : ""}${hasWiFi && hasGSM ? "+" : ""}${hasGSM ? "GSM" : ""}${!hasWiFi && !hasGSM ? "none" : ""} → ${buffer.slice(startInfoFlag, offset).toString("hex").toUpperCase()}`,
      );

      // ===== OPZIONALE: WiFi Cells (90 bytes totali) =====
      if (hasWiFi) {
        logger.debug(`\n📡 WiFi Cells (${options!.wifi_cells!.length} networks):`);
        for (let i = 0; i < 10; i++) {
          const wifi = options!.wifi_cells![i];

          if (wifi) {
            // BSSID (6 bytes) - MAC address
            const bssidBytes = Buffer.from(wifi.bssid.replace(/:/g, ""), "hex");
            bssidBytes.copy(buffer, offset);
            offset += 6;

            // RSSI (1 byte) - Signal strength (-100 to 0 dBm, stored as unsigned)
            const rssi = Math.max(0, Math.min(255, wifi.rssi + 100));
            buffer[offset++] = rssi;

            // Channel (1 byte)
            buffer[offset++] = wifi.channel;

            logger.debug(`  [${offset - 9}..${offset - 1}] WiFi ${i}: ${wifi.bssid} RSSI=${wifi.rssi} CH=${wifi.channel}`);
          } else {
            // Empty WiFi cell
            buffer.fill(0, offset, offset + 8);
            offset += 8;
          }
        }
      }

      // ===== OPZIONALE: GSM Cells (161 bytes totali) =====
      if (hasGSM) {
        logger.debug(`\n📶 GSM Cells (${options!.gsm_cells!.length} cells):`);
        for (let i = 0; i < 7; i++) {
          const gsm = options!.gsm_cells![i];

          if (gsm) {
            // CID (2 bytes - LITTLE ENDIAN)
            buffer.writeUInt16LE(gsm.cid, offset);
            offset += 2;

            // LAC (2 bytes - LITTLE ENDIAN)
            buffer.writeUInt16LE(gsm.lac, offset);
            offset += 2;

            // MCC (2 bytes - LITTLE ENDIAN)
            buffer.writeUInt16LE(gsm.mcc, offset);
            offset += 2;

            // MNC (2 bytes - LITTLE ENDIAN)
            buffer.writeUInt16LE(gsm.mnc, offset);
            offset += 2;

            // RXL (1 byte) - Signal strength (0-63)
            buffer[offset++] = Math.max(0, Math.min(63, gsm.rxl));

            // Spare (14 bytes)
            buffer.fill(0, offset, offset + 14);
            offset += 14;

            logger.debug(`  [${offset - 23}..${offset - 1}] GSM ${i}: CID=${gsm.cid} LAC=${gsm.lac} MCC=${gsm.mcc} MNC=${gsm.mnc} RXL=${gsm.rxl}`);
          } else {
            // Empty GSM cell
            buffer.fill(0, offset, offset + 23);
            offset += 23;
          }
        }
      }
      return offset;
    },
  });
}

//------ PACKET 0x06: HEARTBEAT (SIMIL-WELCOME) ------

/**
 * Crea il pacchetto 0x06 HEARTBEAT (simil-welcome)
 * Struttura simile al welcome ma con packet type 0x06
 * Per ora implementazione minimale
 */
export function createPacket06(serialNumber: string): Buffer {
  return buildPacket({
    packetType: 0x06,
    payloadBuilder: (buffer, offset) => {
      // Serial number (10 bytes)
      stringToBytes(serialNumber, 10).copy(buffer, offset);
      offset += 10;

      // IMEI (15 bytes)
      stringToBytes("123456789012345", 15).copy(buffer, offset);
      offset += 15;

      // CCID (20 bytes)
      stringToBytes("12345678901234567890", 20).copy(buffer, offset);
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
      buffer.writeInt16LE(200, offset); // 20°C
      offset += 2;

      // Speed (2 bytes, int16 - LITTLE ENDIAN)
      buffer.writeInt16LE(0, offset);
      offset += 2;

      // Battery (2 bytes, int16 - LITTLE ENDIAN)
      buffer.writeInt16LE(4200, offset);
      offset += 2;

      // ... altri campi come il welcome (riempiti con default) ...
      // Per ora minimale, aggiungi altri campi se necessario

      return offset;
    },
  });
}
