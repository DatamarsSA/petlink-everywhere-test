# Packet 0x01 (WelcomeHeartBeat) - Device → Sentinel

This document details the anatomy of the binary packet **0x01** sent from the Device to Sentinel. It maps TypeScript fields (used in tests) to the Rust backend implementation and explains the business logic behind each field.

## 📦 Packet Structure Overview

*   **Protocol**: SIRF
*   **Direction**: Device → Sentinel
*   **Purpose**: Periodic heartbeat containing status, position, and sensors.
*   **Rust Struct**: `PacketWelcomeHeartBeat` (in `petlink-everywhere-sentinel`)

---

## 1. Device Identification (Header)

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `serial_number` | `device_id` | String (10B) | **Unique ID**. Used to identify the TCP session and the Device entity in DB. Mismatch causes disconnection. |
| `imei` | `imei` | String (15B) | Modem identifier. Stored for diagnostics. |
| `iccid` | `iccid` | String (20B) | SIM identifier. Used to detect SIM changes or for activation flows. |

---

## 2. Software Status

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `fw_version` | `fw_version` | 3 Bytes | Firmware Version (e.g., `10.1.50`). Rust checks if this < latest version. If true (and battery sufficient), it triggers OTA update (Packet 0x02). |
| `bl_version` | `bl_version` | 3 Bytes | Bootloader Version. Informational. |

---

## 3. GPS Position (Critical) 📍

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `latitude` | `latitude` | Float (4B) | Latitude (Little Endian). |
| `longitude` | `longitude` | Float (4B) | Longitude (Little Endian). |
| `altitude` | `altitude` | Int16 (2B) | Altitude in meters. |
| `last_gps_time` | `last_gps_time` | UInt32 (4B) | **GPS Fix Timestamp** (Unix Epoch). <br>⚠️ **Logic**: Sentinel discards the position if `(now - last_gps_time) > 600s` or if 0. |
| `speed` | `speed` | Int16 (2B) | Speed in km/h (or knots depending on FW). |
| `gps_sat` | `gps_sat` | UInt8 | Number of satellites. If < 3, position is deemed unreliable. |

---

## 4. Sensors & Status

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `battery` | `battery` | Int16 (2B) | Voltage in mV (e.g., 4200). Rust converts to % (0-100). Sends Low Battery notification if < 25%. |
| `temperature` | `temperature` | Int16 (2B) | Temperature in 1/10th °C. |
| `notifications` | `notifications` | UInt8 (Bitmask) | **Events Bitmask**:<br>- `0x20`: Inside Fence<br>- `0x40`: Outside Fence (Triggers Geofence alert)<br>- `0x08`: No GPS |
| `spare_c5` | `spare_c5` | UInt8 (Bitmask) | **Extended Events**:<br>- `0x01` ("Collar Detached"): **Energy Saving Zone (ESZ)** indicator.<br>  - `1`: Device found Home WiFi (GPS off).<br>  - `0`: Device left Home WiFi.<br>  Sentinel monitors transitions (0↔1) to trigger Zone Enter/Exit notifications. |

---

## 5. Network Diagnostics

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `csq` | `csq` | UInt8 | GSM Signal Quality (0-31). |
| `ber` | `ber` | UInt8 | Bit Error Rate (Interference). |
| `gprs_retry` | `gprs_retry` | UInt8 | Connection retry counter. Debugging. |
| `reset_cause` | `reset_cause` | UInt8 | Reason for device restart (Crash, Power On, Watchdog). |

---

## 6. Spare Fields (Reserved/Debug)

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `spare_c4`..`c8` | `spare_c*` | UInt8 | Reserved bytes for future use or FW-specific debug flags. |
| `last_gprs` | `last_gprs` | Int16 | Time since last successful GPRS connection. |
| `last_gps` | `last_gps` | Int16 | Time since last GPS fix (redundant with `last_gps_time`). |
| `spare_s3`..`s8` | `spare_s*` | Int16/UInt16 | Additional reserved stats. |

---

## 7. LBS & Cells (Location Based Services)

| TypeScript Field | Rust Field | Type (Size) | Description & Backend Logic |
| :--- | :--- | :--- | :--- |
| `info_flag` | `info_flag` | UInt8 (Bitmask) | **Extra Data Flag**.<br>- `0x80` (`InfoWifiCells`): Payload contains WiFi APs.<br>- `0x01` (`InfoGsmCellsFlag`): Payload contains GSM Cells.<br>⚠️ **Logic**: If set, Sentinel parses extra bytes at the end of the packet to perform LBS (Unwired/Google) lookup if GPS is missing. |

---

## 8. Key Logic "Behind the Scenes" (Rust)

1.  **Strict Binary Parsing**: Rust consumes the buffer byte-by-byte. If a field length is off (e.g., FW Version 4 bytes vs 3 bytes), **all subsequent fields shift**, resulting in corrupted data (e.g., Latitude becomes `1.5e-36`).
2.  **Operating Status Calculation**: Rust derives the device status (Default, Geofence, Home WiFi) by combining `notifications` (Geofence bits) and `spare_c5` (ESZ bits) in a (runteime derived) `extended_notifications` and make all of logic on that variable.
3.  **Live Tracking Handling**: When `0x01` arrives, Rust checks if `LIVE_TRACKING` is active for this device. If so, and GPS is valid, it routes the message to the `LIVE_TRACKING` queue/topic for real-time WebSocket delivery, bypassing standard storage latency.




