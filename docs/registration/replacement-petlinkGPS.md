# PetlinkGPS Replacement Flow

## Overview

PetlinkGPS replacement is the process of switching an existing GPS product to a new physical device serial number **without removing the GPS product association from the pet**.

Compared to reset:
- **Replacement** keeps the same product and pet link, but updates hardware identity (serial/IMEI/ICCID/MAC)
- **Reset** deletes the GPS product entirely

Replacement is a mixed synchronous + asynchronous flow:
- synchronous mutation updates core product state and notifies Sentinel
- asynchronous worker updates subscriptions/history and propagates serial changes to external billing systems

---

## API Entry Point

**GraphQL mutation**: `replacement(productId: String!, newSerialNumber: String!, entityType: ProductTypeEnum!)`

For GPS replacement, `entityType` must be `PETLINK_GPS`.

---

## Complete GPS Replacement Flow

### STEP 1: AUTHENTICATION, OWNERSHIP, AND INPUT CHECKS

**Backend action**: validate user and request payload

```
Client calls replacement(productId, newSerialNumber, PETLINK_GPS)
  ├─ Validates authenticated Cognito user
  ├─ Blocks demo users (403)
  ├─ Validates serial format length (must be 7 chars)
  ├─ Loads product by productId + entityType
  └─ Verifies product ownership (userId must match)
```

**Key guards**:
- Demo users are blocked (`errors.demo_user_not_allowed`)
- `newSerialNumber` must be exactly 7 characters
- If product is not owned by caller → `401`

---

### STEP 2: NEW DEVICE ELIGIBILITY VALIDATION

**Backend action**: ensure the new serial can be associated

```
Backend checks new serial:
  ├─ No ongoing subscription on new serial
  │   (only closed/cancelled are allowed)
  ├─ Device is valid/whitelisted/not already linked
  │   (checkPetlinkGps)
  ├─ planProfileId/brand/model must be present
  └─ EOL restriction check by country/model
```

**Important rules**:
- If new serial has non-closed/non-cancelled subscriptions → `428`
- If country is in EOL list and new model is `EVO` → `428`
- `checkPetlinkGps(...)` enforces inventory/business validations used by registration flows

---

### STEP 3: PRODUCT HARDWARE SWITCH (SYNCHRONOUS)

**Backend action**: update existing GPS product with new hardware data

```
Backend updates same productId:
  ├─ serialNumber = newSerialNumber
  ├─ settings.optimizationDone = false
  ├─ settings.sentinelMigrationDone = false
  ├─ newFirmwareVersion = null
  ├─ endOfLifeDevice = null
  ├─ imei / idccd / macAddress from validated inventory
  └─ Writes product history event (REPLACEMENT)
```

This is not a new product creation: the existing product record is reused.

---

### STEP 4: OLD DEVICE CLEANUP + SENTINEL EVENTS (SYNCHRONOUS)

**Backend action**: detach old hardware and register new one in device infrastructure

```
Backend cleanup:
  ├─ Optional: blacklist old EVO device in EOL countries
  ├─ Inventory old serial: subscriptionActive = false
  ├─ Send SQS RESET_DEVICE for old serial (Sentinel queue)
  ├─ Send SQS NEW_GPS_DEVICE for new serial (Sentinel queue)
  └─ Suspend old SIM through provider API (AT&T/Vodafone)
```

**SIM handling**:
- old ICCID prefix `8901` → AT&T suspend
- old ICCID prefix `8988` → Vodafone suspend

Provider calls are triggered by core lambdas through internal SIM utility modules.

---

### STEP 5: REPLACEMENT HISTORY PERSISTENCE (SYNCHRONOUS)

**Backend action**: store auditable replacement event

Creates/updates `PETLINK_GPS_REPLACEMENT` history with:
- productId, petId, userId, email
- oldSerialNumber, newSerialNumber
- timestamp fields
- reason code default `NO_CUSTOMER_CARE`
- optional `currentTermEnd` from linked subscription

If an existing incomplete replacement record exists (`oldSerialNumber` with missing `newSerialNumber`), it is completed.

---

### STEP 6: ASYNC POST-PROCESSING VIA `replacementGps` CONSUMER

After synchronous mutation, core enqueues a message to `REPLACEMENT_GPS_QUEUE_URL`.

`replacementGps` worker processes it and performs bulk consistency updates:

```
replacementGps consumer:
  ├─ Reloads product (userId + productId)
  ├─ Updates Activity collection serialNumber by petId
  ├─ Updates PositionsHistory serialNumber by petId
  ├─ Updates all subscription docs serialNumber by productId+userId
  └─ For non-DATAMARS subscriptions:
      calls SSM updateDMSerialNumber(subscriptionId, newSerialNumber)
```

This makes billing and historical data consistent with the new serial.

---

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────┐
│ App / Web                                           │
│ User requests GPS replacement                       │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ GraphQL mutation replacement(...)                   │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Core replacement handler (sync path)                │
│ - Validate user/product/new serial                  │
│ - Update product hardware fields                    │
│ - Emit RESET_DEVICE + NEW_GPS_DEVICE to Sentinel    │
│ - Suspend old SIM                                   │
│ - Save replacement history                          │
│ - Enqueue replacementGps message                    │
└─────────────────────────────────────────────────────┘
                            ↓
                ┌───────────┴───────────┐
                ↓                       ↓
┌───────────────────────────┐   ┌───────────────────────────┐
│ Sentinel queue            │   │ replacementGps queue      │
│ reset+new device actions  │   │ async data consistency    │
└───────────────────────────┘   └───────────────────────────┘
                                        ↓
                          ┌───────────────────────────────┐
                          │ replacementGps consumer       │
                          │ - activity/positions updates  │
                          │ - subscriptions serial update │
                          │ - Chargebee serial sync       │
                          └───────────────────────────────┘
```

---

## Error Scenarios

### 403
- Demo user is not allowed to run replacement

### 400
- Invalid serial length (not 7 chars)
- Invalid entity type

### 401
- Product not owned by requesting user

### 428
- New serial has ongoing subscriptions
- EOL policy blocks replacement with EVO device for specific countries

### Validation-driven errors from `checkPetlinkGps`
- New serial not valid in inventory/association checks
- New serial already linked or otherwise not eligible

---

## Business Notes

- Replacement keeps continuity of the product-pet relation and user experience.
- The old hardware is actively detached (Sentinel reset + SIM suspension).
- Some consistency updates are eventually consistent due to async queue processing.
- Subscription serial propagation includes external synchronization for non-DATAMARS entities.
