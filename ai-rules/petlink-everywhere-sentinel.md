---
trigger: model_decision
description: Apply when debugging raw GPS data, Sentinel TCP server, SiRF binary commands, device connections, or device registration flows.
globs: 
---

# petlink-everywhere-sentinel (Device Communication)

> **Domain Knowledge Note:** For detailed explanations of how device registration, position updates, and commands flow through the entire system, read the Data Flows section in `docs/petlnk-infrastructure.md`.

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
All specific flows (Position Updates, Command Sending, Device Registration) are mapped with sequence diagrams in `docs/petlnk-infrastructure.md`.