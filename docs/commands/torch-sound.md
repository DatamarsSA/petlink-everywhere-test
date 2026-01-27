# Torch & Sound Commands

## Overview

Torch (Flashlight) and Sound (Beep) are on-demand commands that allow the user to locate their pet in real-time. The user can activate the device's flashlight or sound for a specified duration (e.g., 60 seconds), helping them find their pet in the dark or in noisy environments.

**Key Points:**
- Both commands are sent via **Packet 0x10 (PacketEvoExtraData)** from Sentinel to the device
- **Device automatically stops** after the specified duration expires (no explicit stop command needed)
- User can manually **disable** by sending duration=0
- Status updates come via device heartbeat (Packet 0x01)

---

## Visual Flow Summary

```
┌────────────────────────────────────────────────────┐
│       TORCH/SOUND COMMAND REAL-TIME FLOW           │
├────────────────────────────────────────────────────┤
│                                                    │
│  1. User Activates Torch/Sound (60 seconds)        │
│     ↓                                              │
│  2. Backend → Sentinel → Device : (Packet 0x10)    │
│     ↓                                              │
│  3. Device Receives & Activates                    │
│     ↓                                              │
│  4. Device Sends Status Update (Packet 0x01)       │
│     ↓                                              │
│  5. App Receives: Status = ON                      │
│     ↓                                              │
│  6. Duration Expires → Device Auto-Stops           │
│     ↓                                              │
│  7. Device Sends Status Update (Packet 0x01)       │
│     ↓                                              │
│  8. App Receives: Status = OFF                     │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Full User Journey

### STEP 1: USER ACTIVATES TORCH/SOUND

```
User: "Activate flashlight for 60 seconds" OR "Activate sound for 30 seconds"
  ↓
App calls GraphQL mutation:

  sendCommand({
    commandType: "FLASHLIGHT" | "SOUND",
    id: "device123",
    duration: 60,              // seconds
    modeType: "SENTINEL"
  })

  ↓
Backend (Core API):
  ├─ Validates command
  ├─ Publishes SQS message to "commands" queue
  └─ Status: REQUESTED (waiting for device confirmation)

  ↓
Sentinel Lambda Consumer:
  ├─ Consumes SQS message
  ├─ Converts duration: 60 seconds → 1 minute (divides by 60)
  └─ Sends Packet 0x10 to device via TCP
```

**Packet 0x10 Payload (TORCH):**
```
Byte 0:     0x10 (packet type)
Byte 1-4:   evo_tasks = 0x01 | 0x0020  (EvoFlashlight | EvoTimestamp)
[IF EvoFlashlight set]
  Byte 5-6: torch_duration = 1         (60 seconds ÷ 60 = 1 minute)
[IF EvoTimestamp set]
  Byte 7-10: timestamp (uint32 LE)
```

**Packet 0x10 Payload (SOUND):**
```
Byte 0:     0x10 (packet type)
Byte 1-4:   evo_tasks = 0x04 | 0x0020  (EvoSound | EvoTimestamp)
[IF EvoSound set]
  Byte 5-6: sound_command = 1          (1 = activate, 0 = mute, int16 LE)
  Byte 7-8: sound_duration = 30        (seconds)
[IF EvoTimestamp set]
  Byte 9-12: timestamp (uint32 LE)
```

---

### STEP 2: DEVICE RECEIVES PACKET 0x10

```
Device receives Packet 0x10 via TCP:
  ├─ Parses evo_tasks flags
  ├─ If EvoFlashlight set:
  │  └─ Activates flashlight for torch_duration seconds
  ├─ If EvoSound set:
  │  ├─ If sound_command == 1: Activates sound for sound_duration seconds
  │  └─ If sound_command == 0: Mutes sound
  └─ Starts internal countdown timer

  ↓
Device sends Packet 0x01 (heartbeat) with updated status
```

---

### STEP 3: DEVICE SENDS STATUS UPDATE (PACKET 0x01)

```
Device sends Packet 0x01 (heartbeat):
  ├─ battery: current battery level
  ├─ temperature: current temperature
  └─ [other fields...]

Sentinel processes:
  ├─ Reads device state from database
  ├─ Compares: flashlight_duration_user vs flashlight_duration_device
  │  ├─ If equal & > 0 → status = ON ✅
  │  ├─ If user > device → status = REQUESTED ⏳
  │  └─ If both = 0 → status = OFF
  └─ Publishes status to GraphQL subscription

App receives via WebSocket:
  {
    "status": {
      "flashlight": "ON",
      "sound": "OFF",
      "battery": 4200,
      "date": "2024-01-15T10:30:35Z"
    }
  }

  ↓
✅ User sees: Torch/Sound is ACTIVE
```

---

### STEP 4: DURATION EXPIRES (AUTOMATIC)

```
Device internal timer:
  ├─ Counts down from duration (e.g., 60 seconds)
  ├─ Timer expires
  └─ Device automatically stops flashlight/sound (no command needed)

  ↓
Device sends Packet 0x01 (next heartbeat):
  ├─ Status: flashlight/sound = OFF
  └─ Publishes to GraphQL subscription

  ↓
App receives:
  {
    "status": {
      "flashlight": "OFF",
      "sound": "OFF",
      "date": "2024-01-15T10:31:35Z"
    }
  }

  ↓
✅ User sees: Torch/Sound EXPIRED automatically
```

---

### STEP 5: USER MANUALLY DISABLES (OPTIONAL)

```
User: "Disable flashlight" OR "Disable sound"
  ↓
App calls GraphQL mutation:

  sendCommand({
    commandType: "FLASHLIGHT" | "SOUND",
    id: "device123",
    duration: 0,              // 0 = disable immediately
    modeType: "SENTINEL"
  })

  ↓
Backend → Sentinel → Device:
  ├─ Sends Packet 0x10 with duration=0
  └─ Device stops immediately (no countdown)

  ↓
Device sends Packet 0x01:
  ├─ Status: flashlight/sound = OFF
  └─ Publishes to GraphQL subscription

  ↓
✅ User sees: Torch/Sound DISABLED
```

---

**Important**: Backend divides duration by 60 (seconds → minutes)
- User sends: duration=60 seconds
- Backend sends: torch_duration=1 minute
- Device receives: 1 minute = 60 seconds

## Status Values

Status can be one of three values:

| Status | Meaning |
|--------|---------|
| **ON** | Device confirmed it received and activated the command |
| **REQUESTED** | User sent command but device hasn't confirmed yet |
| **OFF** | Torch/Sound is inactive |

**Status logic:**
- When user sends command → status becomes REQUESTED
- When device sends heartbeat confirming the duration → status becomes ON
- When duration expires or user disables → status becomes OFF

---

## Important Notes

### Duration Conversion
- **User sends**: duration in seconds (e.g., 60 seconds)
- **Backend converts**: seconds → minutes (60 / 60 = 1)
- **Device receives**: duration in minutes (1 minute = 60 seconds)
- **Device auto-stops**: after duration expires (no explicit stop command)

### Status Transitions
```
User sends command (duration > 0)
  ↓
Status = REQUESTED (waiting for device to confirm)
  ↓
Device sends heartbeat with matching duration
  ↓
Status = ON (device confirmed)
  ↓
Duration expires OR user sends duration=0
  ↓
Status = OFF
```