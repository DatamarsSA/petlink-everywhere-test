# PetlinkGPS Registration Flow

## Overview

PetlinkGPS registration is the process of associating a GPS tracking device with a pet. Unlike pet registration (which is simple data entry), GPS registration involves **hardware validation, SIM activation, and subscription management**. The device must be whitelisted, the pet can only have one GPS, and some devices require accepting ArcaPlanet terms.

---

## Complete User Journey

### STEP 1: USER SELECTS PET & ENTERS SERIAL NUMBER

**User Action**: Selects a pet from their list and enters the GPS device serial number

```
User: "I want to add a GPS device"
  ↓
App displays: Pet selector
  ↓
User selects: A pet (e.g., "Max the Dog")
  ↓
App shows: Serial number input field
  ↓
User enters: "PETL123456"
  ↓
✅ Ready to create GPS
```

**Constraints**:
- Pet must exist and belong to the user
- Serial number format: uppercase alphanumeric (e.g., `PETL123456`, `KIPPY987654`)
- A pet can only have **one GPS device** (if pet already has GPS → error)

---

### STEP 2: APP VERIFIES DEVICE & CREATES GPS

**App Action**: Checks device firmware, then sends creation request to backend

```
App: "Verifying device..."
  ├─ Calls: homeRepository.checkGPS(serialNumber)
  │  └─ Gets: Firmware version and device info
  ├─ If OK: Proceeds to createGps()
  └─ If NO: Shows error
  ↓
App: "Creating GPS..."
  ├─ Calls: createPetlinkGps({
  │    serialNumber: "PETL123456",
  │    petId: "dog-pet-id",
  │    countryCode: "IT" (optional),
  │    timezone: "Europe/Rome" (optional)
  │  })
  ├─ Backend processes...
  └─ Response: { code: "200"|"400"|"428", petlinkGps, message }
  ↓
✅ GPS created (or error returned)
```

**API**: `createPetlinkGps(petlinkGps: PetlinkGpsIn!, appBrand: AppBrand!)`
- **Auth**: JWT required (user must be authenticated)
- **Response**: `{ code, petlinkGps, currentTermEnd, url, message }`

---

### STEP 3: BACKEND VALIDATES & CREATES DEVICE

**Backend Processing**: Validates device, activates SIM, checks subscription, sends notifications

```
Backend:
  ├─ Verifies user is authenticated (JWT)
  ├─ Checks: Pet exists and belongs to user
  ├─ Checks: Device is whitelisted (in inventory)
  ├─ Checks: Device not already registered
  ├─ Checks: Pet doesn't already have a GPS
  ├─ Checks: If ArcaPlanet device → user accepted terms
  ├─ Creates: PetlinkGps document in MongoDB
  ├─ Activates: SIM card (AT&T or Vodafone based on ICCID)
  ├─ Checks: Device subscription status
  ├─ Sends: SQS message to Sentinel (device registration)
  ├─ Sends: Notifications (email + push)
  │  ├─ If prepaid subscription: "GPS registered (prepaid)"
  │  └─ If no subscription: "GPS registered (buy subscription)"
  └─ Returns: PetlinkGps document + subscription info
  ↓
✅ Device ready to use
```

---

### STEP 4: APP INITIALIZES BLUETOOTH & NAVIGATES

**App Action**: Loads permissions and starts Bluetooth connection

```
App receives: GPS created successfully
  ├─ Adds device to local products list
  ├─ Reloads products (forceNetwork: true)
  ├─ Calls: _loadPermissionsAsync()
  ├─ Registers device: multiBluetoothController.addDevice(serialNumber)
  ├─ Starts: Bluetooth connection attempt
  └─ Navigates: To permissionScreen
  ↓
✅ GPS ready for tracking
```

---

## Data Flow: App → Backend → Services

```
┌─────────────────────────────────────────────────────┐
│ Flutter App                                         │
│ User enters serial number and clicks "Create GPS"  │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ GraphQL Mutation: createPetlinkGps                  │
│ Input: {                                            │
│   serialNumber, petId,                              │
│   countryCode (optional),                           │
│   timezone (optional)                               │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Backend Handler                                     │
│ - Validates user & pet                             │
│ - Validates device (whitelist, not duplicate)      │
│ - Validates pet constraints (1 GPS only)           │
│ - Creates PetlinkGps in MongoDB                    │
│ - Activates SIM (AT&T or Vodafone)                 │
│ - Checks subscription                              │
└─────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ SQS: Sentinel    │  │ SQS: Notif.      │
        │ (device reg.)    │  │ (email + push)   │
        └──────────────────┘  └──────────────────┘
                    ↓               ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Sentinel         │  │ Notification     │
        │ Registers device │  │ Service          │
        │ Awaits TCP conn. │  │ Sends email/push │
        └──────────────────┘  └──────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Response to App                                     │
│ {                                                   │
│   code: "200",                                      │
│   petlinkGps: { id, serialNumber, ... },           │
│   currentTermEnd: "2025-12-31",                     │
│   url: "https://buy-subscription.com"              │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Flutter App                                         │
│ - Adds device to local list                        │
│ - Starts Bluetooth connection                      │
│ - Navigates to permissions screen                  │
└─────────────────────────────────────────────────────┘
```

---

## Key Behaviors & Constraints

### Device Whitelist
- **Every GPS must be whitelisted** in the device inventory before registration
- If device is not in whitelist → **Error 400** (`product_not_exist`)
- Whitelisting is done by admin (not user-facing)

### One GPS Per Pet
- A pet can have **exactly one active GPS device**
- If pet already has a GPS → **Error 428** (`pet_already_linked`)
- To switch devices: delete old GPS first, then create new one

### SIM Activation
- SIM activation is **automatic** based on device ICCID:
  - ICCID starts with `8901` → **AT&T** (USA)
  - ICCID starts with `8988` → **Vodafone** (Europe)
- If SIM activation fails → Device still created, but tracking may not work

### ArcaPlanet Terms
- Some GPS devices (ArcaPlanet brand) require **user acceptance of terms**
- If user hasn't accepted → **Error 400** (`not_accepted_arcaplanet_terms`)
- App shows dialog to accept terms, then retries creation

### Subscription
- GPS devices can work **without a subscription** (limited features)
- With subscription (prepaid or insurance):
  - Full tracking enabled
  - Notifications active
  - Geofence & ESZ features available
- Backend checks subscription and includes `currentTermEnd` and `url` in response

---