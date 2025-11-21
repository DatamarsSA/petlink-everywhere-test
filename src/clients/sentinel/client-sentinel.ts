import { createConnection, Socket } from "net";
import { EventEmitter } from "events";
import { logger } from "../../config/logger.js";

// ================================ CONSTANTS ================================ //

const PROTOCOL = {
  HEADER: Buffer.from([0xa0, 0xa2]), // 2 bytes
  LENGTH_FIELD: 2, // 2 bytes
  CRC: 2, // 2 bytes
  FOOTER: Buffer.from([0xb0, 0xb3]), // 2 bytes
} as const;

// ================================ SENTINEL PACKET TYPES ================================ //

export enum SentinelPacketType {
  PACKET_0x01 = 0x01,
  PACKET_0x0A = 0x0a,
  PACKET_0x10 = 0x10,
  PACKET_0x15 = 0x15,
}

// ================================ 1. SERIALIZER (Request Builder - toSentinel) ================================ //

export class PacketSerializer {
  /**
   * Wraps payload in SIRF protocol: [HEADER] [LENGTH_FIELD] [PAYLOAD] [CRC] [FOOTER]
   */
  private static encapsulate(payload: Buffer): Buffer {
    const length = payload.length;
    if (length >= 1024) throw new Error("Payload too large");

    let crc = 0;
    for (let i = 0; i < length; i++) {
      crc += payload[i];
      crc &= 0x7fff;
    }

    const packet = Buffer.alloc(length + 8);
    PROTOCOL.HEADER.copy(packet, 0);
    packet.writeUInt16BE(length, PROTOCOL.HEADER.length); // Length Big Endian
    payload.copy(packet, PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD);
    packet.writeUInt16BE(crc, PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD + length); // CRC Big Endian
    PROTOCOL.FOOTER.copy(packet, PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD + length + PROTOCOL.CRC);

    return packet;
  }

  private static stringToBytes(str: string, length: number): Buffer {
    const buf = Buffer.alloc(length);
    Buffer.from(str, "ascii").copy(buf);
    return buf;
  }

  static packet01(
    serialNumber: string,
    options?: {
      latitude?: number;
      longitude?: number;
      battery?: number;
      temperature?: number;
      collar_detached?: boolean;
      geofence_status?: "inside" | "outside" | "none";
      wifi_cells?: { bssid: string; rssi: number; channel: number }[];
      gsm_cells?: { cid: number; lac: number; mcc: number; mnc: number; rxl: number }[];
    },
  ): Buffer {
    const MAX_PAYLOAD_SIZE = 600;
    const buffer = Buffer.alloc(MAX_PAYLOAD_SIZE);
    let offset = 0;

    // Packet Type 0x01
    buffer[offset++] = SentinelPacketType.PACKET_0x01;

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

    const finalPayload = buffer.subarray(0, offset);
    return this.encapsulate(finalPayload);
  }
}

// ================================ 2. DESERIALIZER (Response Parser - fromSentinel) ================================ //

export interface ParsedPacket {
  type: number;
  name: string;
  payload: any;
  raw: Buffer;
}

export class PacketDeserializer {
  static parse0x0A(payload: Buffer) {
    if (payload.length < 2) return { commandName: "INVALID" };

    const commandType = payload[1];
    const commandMap: Record<number, string> = {
      0x01: "LIVE_TRACKING",
      0x02: "GEOFENCE",
      0x03: "ENERGY_SAVING_ZONE",
      0x04: "SETTINGS",
      0x05: "WAKEUP",
    };

    return {
      commandType,
      commandName: commandMap[commandType] || "UNKNOWN",
      duration: payload.length >= 4 ? payload.readInt16LE(2) : undefined,
    };
  }

  static parse0x15(payload: Buffer) {
    // Payload: [0x15] [Lat(8)] [Lng(8)] [Radius(8)] [BSSID(6)] ... repeated
    if (payload.length < 1) return null;

    const zones = [];
    let offset = 1; // Salta il packet type 0x15
    const zoneSize = 30; // 8+8+8+6 = 30 bytes per zone

    while (offset + zoneSize <= payload.length) {
      const lat = payload.readDoubleLE(offset);
      offset += 8;
      const lng = payload.readDoubleLE(offset);
      offset += 8;
      const radius = payload.readDoubleLE(offset);
      offset += 8;
      const bssidBytes = payload.subarray(offset, offset + 6);
      const bssid = bssidBytes.toString("hex").toUpperCase();
      offset += 6;

      zones.push({ lat, lng, radius, bssid });
    }

    return {
      zonesCount: zones.length,
      zones,
    };
  }

  static parse0x10(payload: Buffer) {
    if (payload.length < 5) return null;

    let offset = 1;
    const evo_tasks = payload.readUInt32LE(offset);
    offset += 4;

    // Bitmasks from Rust
    const EvoFlashlight = 0x01;
    const EVO_TOUR_RECORDING = 0x02;
    const EvoSound = 0x04;
    const EvoEnergySaveArea = 0x08;

    const result: any = {
      evo_tasks,
    };

    if (evo_tasks & EvoFlashlight) {
      if (offset + 2 <= payload.length) {
        result.torch_duration = payload.readInt16LE(offset);
        offset += 2;
      }
    }
    if (evo_tasks & EVO_TOUR_RECORDING) {
      if (offset + 1 <= payload.length) {
        result.tour_recording_enabled = payload.readInt8(offset);
        offset += 1;
      }
    }
    if (evo_tasks & EvoSound) {
      if (offset + 4 <= payload.length) {
        result.sound_command = payload.readInt16LE(offset);
        offset += 2;
        result.sound_duration = payload.readInt16LE(offset);
        offset += 2;
      }
    }
    if (evo_tasks & EvoEnergySaveArea) {
      if (offset + 1 <= payload.length) {
        result.energy_saving_area_enabled = payload.readInt8(offset); // 1 = ON, 0 = OFF
        offset += 1;
      }
    }

    return result;
  }
}

// ================================ 3. CLIENT (Network & Logic) ================================ //

export class SentinelTcpClient {
  private socket: Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private events = new EventEmitter();

  // Utility to access raw socket for cleanup if needed, though usage should be minimal
  public get rawSocket(): Socket | null {
    return this.socket;
  }

  constructor(private config: { host: string; port: number }) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`→ Connecting to Sentinel at ${this.config.host}:${this.config.port}`);
      this.socket = createConnection(this.config);
      this.socket.on("connect", () => {
        logger.debug("✓ Connected to Sentinel TCP server");
        resolve();
      });
      this.socket.on("data", (data) => this.handleData(data));
      this.socket.on("error", (err) => {
        logger.error(`✗ Socket error: ${err.message}`);
        reject(err);
      });
      this.socket.on("close", () => {
        logger.debug("✓ Connection closed");
      });
      // Timeout di 10 secondi per la connessione iniziale
      this.socket.setTimeout(10000);
      this.socket.on("timeout", () => {
        // Don't reject here as it might trigger on idle, just handle if needed
      });
    });
  }

  async send(data: Buffer): Promise<void> {
    if (!this.socket) throw new Error("Not connected");
    logger.debug(`→ Sending ${data.length} bytes to Sentinel`);
    this.socket.write(data);
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
  }

  clearBuffer() {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Waits for a single packet of a specific type.
   * @param type The packet type (use SentinelPacketType enum)
   * @param timeoutMs Timeout in milliseconds
   * @param validator Optional function to filter the packet
   */
  async waitForPacket(type: SentinelPacketType, timeoutMs = 5000, validator?: (p: ParsedPacket) => boolean): Promise<ParsedPacket> {
    return new Promise((resolve, reject) => {
      const typeHex = `0x${type.toString(16)}`;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for packet ${typeHex}`));
      }, timeoutMs);

      const onPacket = (packet: ParsedPacket) => {
        if (packet.type === type) {
          if (!validator || validator(packet)) {
            logger.debug(`✓ Received expected packet ${typeHex}`);
            cleanup();
            resolve(packet);
          } else {
            logger.debug(`- Skipped packet ${typeHex} (validator failed)`);
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.events.off("packet", onPacket);
      };

      this.events.on("packet", onPacket);
    });
  }

  private handleData(chunk: Buffer) {
    // 1. Accumulo: Aggiunge i nuovi dati arrivati (chunk) al buffer esistente.
    //    TCP non garantisce che un chunk = un pacchetto. Potrebbe essere mezzo pacchetto o dieci pacchetti.
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // 2. Loop infinito: Continua a processare finché ci sono pacchetti completi nel buffer.
    while (true) {
      // 3. Ricerca Header: Cerca la sequenza di byte 0xA0, 0xA2 che indica l'inizio di un pacchetto SIRF.
      const start = this.buffer.indexOf(PROTOCOL.HEADER);
      if (start === -1) {
        // Nessun header, scarta tutto tranne l'ultimo byte se è 0xA0 (caso bordo)
        // Perché se l'ultimo byte è 0xA0, potrebbe essere la prima metà dell'header (0xA0 0xA2)
        // e il resto arriverà nel prossimo chunk.
        if (this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === PROTOCOL.HEADER[0]) {
          this.buffer = this.buffer.subarray(this.buffer.length - 1);
        } else {
          this.buffer = Buffer.alloc(0);
        }
        return;
      }

      // 4. Verifica se abbiamo abbastanza dati per leggere la lunghezza (HEADER + LENGTH_FIELD)
      const headerAndLengthSize = PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD;
      if (this.buffer.length < start + headerAndLengthSize) return;

      const len = this.buffer.readUInt16BE(start + PROTOCOL.HEADER.length);
      // 5. Calcolo Lunghezza Totale Pacchetto:
      //    Header + LENGTH_FIELD + Payload (len) + CRC + Footer
      const totalLen = PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD + len + PROTOCOL.CRC + PROTOCOL.FOOTER.length;

      // 6. Verifica se abbiamo ricevuto l'intero pacchetto
      if (this.buffer.length < start + totalLen) return;

      // 7. Estrazione Pacchetto Completo
      const rawPacket = this.buffer.subarray(start, start + totalLen);
      this.buffer = this.buffer.subarray(start + totalLen); // Avanza buffer

      // 8. Parsing Payload
      //    Il payload inizia dopo l'header e il length field, finisce prima del CRC
      const payloadStart = PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD;
      const payload: Buffer = rawPacket.subarray(payloadStart, payloadStart + len);
      const type: number = payload[0];
      const base = { type, raw: payload };

      try {
        let parsed: ParsedPacket;
        switch (type) {
          case SentinelPacketType.PACKET_0x0A:
            parsed = { ...base, name: "COMMAND", payload: PacketDeserializer.parse0x0A(payload) };
            break;
          case SentinelPacketType.PACKET_0x15:
            parsed = { ...base, name: "SAFE_PLACES", payload: PacketDeserializer.parse0x15(payload) };
            break;
          case SentinelPacketType.PACKET_0x10:
            parsed = { ...base, name: "EVO_EXTRA", payload: PacketDeserializer.parse0x10(payload) };
            break;
          default:
            parsed = { ...base, name: "UNKNOWN", payload: { raw: payload.toString("hex") } };
            break;
        }

        const packetVisualization =
          `\nSIRF Packet: 0x${type.toString(16).padStart(2, "0").toUpperCase()}\n` +
          `[ORIGINAL-HEX]: ${rawPacket.toString("hex").toUpperCase()}\n` +
          `[HEADER: ${rawPacket.subarray(0, PROTOCOL.HEADER.length).toString("hex").toUpperCase()}]\n` +
          `[LEN-PAYLOAD: (hex: ${rawPacket
            .subarray(PROTOCOL.HEADER.length, PROTOCOL.HEADER.length + PROTOCOL.LENGTH_FIELD)
            .toString("hex")
            .toUpperCase()}) (decimal: ${len} B)]\n` +
          `[PAYLOAD-HEX]: ${payload.toString("hex").toUpperCase()}\n` +
          `[PAYLOAD-DECIMAL]: [${Array.from(payload).join(", ")}] payload_size: ${payload.length}\n` +
          `[PAYLOAD-PARSED]: ${JSON.stringify(parsed.payload)}\n` +
          `[CRC: ${rawPacket
            .subarray(payloadStart + len, payloadStart + len + PROTOCOL.CRC)
            .toString("hex")
            .toUpperCase()}]\n` +
          `[FOOTER: ${rawPacket
            .subarray(payloadStart + len + PROTOCOL.CRC)
            .toString("hex")
            .toUpperCase()}]\n`;

        // LOG UNICO E LEGGIBILE
        logger.info(packetVisualization);

        this.events.emit("packet", parsed);
      } catch (e) {
        logger.error(`Error processing packet: ${e}`);
      }
    }
  }
}

export const sentinelTcpSocketClient = new SentinelTcpClient({
  host: process.env.SENTINEL_HOST!,
  port: parseInt(process.env.SENTINEL_PORT!, 10),
});
