---
trigger: model_decision
description: Apply when debugging raw GPS data, Sentinel TCP server, SiRF binary commands, device connections, or device registration flows.
globs: 
---

# petlink-everywhere-sentinel (Device Communication)

## Architecture
**Rust TCP server** on AWS EKS with Global Accelerator. Accepts TCP connections from GPS devices, parses SiRF binary protocol, maintains connections, and routes data to SQS.

**Important Note**: The Lambda consumers that process Sentinel data (e.g. `gpsMessagesConsumer`, `notificationsConsumer`, `activitiesConsumer`) are **NOT in this repo** — they are in `petlink-everywhere-core/src/lambda_functions/sentinel/`.

## SQS Queue Map (Device Integration)
| Queue | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `gpsMessages` | Sentinel Rust | Core `gpsMessagesConsumer` | GPS positions + device status |
| `notifications` | Sentinel + Core | Core `notificationsConsumer` | Push, SMS, email dispatch |
| `activities` | Sentinel Rust | Core `activitiesConsumer` | Pet activity data |
| `commands` | Core `sendCommand` | Sentinel Rust | Commands to device (torch, sound, liveTracking) |
| `newGpsDevices` | Core `createPetlinkGps` | Sentinel Rust | New device registration |
| `settings` | Core `sendSetting` | Sentinel Rust | Device configuration updates |

## Key Flows

### Device to User (Position Updates)
1. GPS Device sends binary packet via TCP to Sentinel.
2. Sentinel parses SiRF packet, extracts position.
3. Sentinel sends message to `gpsMessages` SQS queue.
4. Core's `gpsMessagesConsumer` updates MongoDB position.
5. Core publishes real-time event via `publishOnGpsMessagePosition` (AppSync WebSocket).

### User to Device (Send Command)
1. Mobile calls `sendCommand` GraphQL mutation.
2. Core queues command in `commands` SQS.
3. Sentinel consumes command, sends TCP binary to device.
4. Device sends ACK/status.
5. Sentinel sends status update via `gpsMessages` SQS.
6. Core publishes `publishOnGpsMessageStatus` to WS clients.

### Device Registration (newGpsDevices)
1. User scans QR / inputs serial. Core validates via `petlinkGpsInventory` whitelist.
2. Core saves device in DB, activates SIM (ATT/Vodafone).
3. Core sends message to `newGpsDevices` SQS.
4. Sentinel updates device-to-user mapping and sends WAKEUP command to device.