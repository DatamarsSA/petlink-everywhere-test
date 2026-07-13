# Data Migration — Flow & Architecture

> Source of truth: code in `all-repo/petlink-data-migration/src/` and `all-repo/petlink-everywhere-core/src/`.

Migrates users, pets, GPS devices, subscriptions, and historical data from legacy MySQL (Kippy EU / Petlink US) to Petlink Everywhere MongoDB.

---

## Login/Migration Flow (App → Backend)

```
┌─────────┐     1. checkMigration(contact, password, appBrand)     ┌──────────────────┐
│  Mobile │ ──────────────────────────────────────────────────────→ │ checkMigration   │
│  App    │                                                            │ (Core, query)    │
│         │ ←────────────────────────────────────────────────────── │                  │
│         │     2. se user_can_be_migrated → mostra dialog          │                  │
│         │     se user_exists → procedi con login normale          │                  │
│         │     se user_not_found → errore                           │                  │
│         │                                                            │                  │
│         │     3. user accetta dialog →                              │                  │
│         │        startMigration(contact, password, appBrand)       │                  │
│         │ ──────────────────────────────────────────────────────→ │ startMigration   │
│         │                                                            │ (Core, mutation) │
│         │                                                            │  Lambda Invoke   │
│         │                                                            │ ──────────────→  │
│         │                                                            │                  │ migrationOnDemand │
│         │ ←────────────────────────────────────────────────────── │ ←──────────────  │ (data-migration)  │
└─────────┘                                                            └──────────────────┘                  │
```

### Fallback Flow: Cognito User Migration Trigger

Se l'app salta `checkMigration` e chiama direttamente Cognito (o se Cognito non trova l'utente), viene attivato il trigger `UserMigration_Authentication`.

**File**: `petlink-everywhere-core/src/lambda_functions/cognito/userMigration/handler.ts`

```
Cognito UserMigration Trigger (triggerSource: UserMigration_Authentication)
│
├── 1. Query MongoDB: USER where email == userName OR phone == userName
│     └── Se trovato → usa user trovato → crea utente Cognito
│
├── 2. Se non trovato in MongoDB → Lambda Invoke → migrationOnDemand
│     └── Payload: { contact: userName, appBrand }
│
└── 3. Se migrationOnDemand fallisce → throw error → login fallisce
```

Questo è un fallback edge case. Il flow principale rimane `checkMigration → startMigration → migrationOnDemand`.

### Step 1: `checkMigration` (Core, query)

**File**: `petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts`

Chiamata dall'app ad **ogni tentativo di login**.

```
checkMigration(contact, password, appBrand)
│
├── 1. Query MongoDB: USER where email == contact OR phone == contact
│     └── Se count == 1 → return success.user_exists
│         (utente già su MongoDB → login normale, nessuna migrazione)
│
├── 2. Se non trovato in MongoDB → Query MySQL legacy (migrated = 0)
│     ├── appBrand KIPPY  → EU connection
│     ├── appBrand PETLINK → US connection
│     └── Query: (registrationPhone + registrationPhoneCountry) OR email
│
├── 3. Se MySQL non trova nulla → return errors.user_not_found
│
└── 4. Se MySQL trova utente → verifica password
      ├── SHA256(SHA256(password) + salt) == password_hash?
      ├── Match → return success.user_can_be_migrated (app mostra dialog)
      └── No match → return errors.user_not_found (sicurezza: non rivela esistenza)
```

### Step 2: `startMigration` (Core, mutation)

**File**: `petlink-everywhere-core/src/lambda_functions/graphql/mutation/startMigration/handler.ts`

Thin wrapper, **nessun early return proprio**. Fa Lambda Invoke sincrono verso `migrationOnDemand`.

```
startMigration(contact, password, appBrand)
│
├── Lambda Invoke (RequestResponse) → migrationOnDemand
│     Payload: { contact, password, appBrand }
│
├── Se risposta code != 200 OR user == null → return errors.migration_failed
└── Altrimenti → return 200 + user (utente migrato)
```

### Step 3: `migrationOnDemand` (data-migration, orchestrator)

**File**: `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts`

```
migrationOnDemand(contact, password, appBrand, source)
│
├── 1. Validate payload (Zod)
│     └── Invalid → return 400
│
├── 2. Resolve password
│     ├── ON_DEMAND: password required → se manca → return 400
│     └── BULK: auto-generate via generateBulkPassword()
│
├── 3. IDEMPOTENCY: Query MongoDB per email/phone
│     └── Se utente già esiste → return 200 "already exists" (skip)
│
├── 4. Query MySQL (getMysqlUser)
│     └── Se non trovato → return 404
│
├── 5. CLAIM ATOMICO: UPDATE user SET migrated = 1 WHERE id = ? AND migrated = 0
│     └── Se affectedRows == 0 → return 409 (race condition, già in corso)
│
├── 6. createUser() → mappa MySQL → MongoDB User schema
│     ├── Download immagine profilo da legacy S3 → Petlink S3
│     ├── Valida phone (E.164), setta forceSetPhoneNumber se invalido
│     └── Se fallisce → rollback + email errore → return 500
│
├── 7. Insert user in MongoDB (petlinkEverywhere)
│     └── Se fallisce → rollback + email errore → return 500
│
├── 8. Sub-migrations sequenziali (Lambda Invoke sincrono):
│     │
│     ├── 8a. petsAndProductsMigration
│     │     └── Fallimento → rollback + email → return 500
│     ├── 8b. energySavingAreaMigration
│     │     └── Fallimento → rollback + email → return 500
│     ├── 8c. geofenceMigration
│     │     └── Fallimento → rollback + email → return 500
│     └── 8d. subscriptionMigration
│           └── Fallimento → rollback + email → return 500
│
├── 9. createCognitoUser (phone, email, name, surname, verified)
│     └── Fallimento → rollback + email → return 500
│
├── 10. Enqueue async SQS (fire-and-forget):
│      ├── positionHistoryMigration
│      ├── activitiesMigration
│      ├── petNotificationMigration
│      └── kippyRejectSubsMigration
│
├── 11. postCreationFunction (welcome posts)
│
└── Return 200 { message, user }
```

**Rollback**: `rollbackUserData(idsToDelete)` cancella tutti i documenti inseriti in MongoDB + resetta `migrated = 0` in MySQL.

**Error notification**: `sendEmailMigrationError()` invia email via SendGrid con dettagli utente e motivo fallimento.

---

## Entry Points

### ON_DEMAND (login-driven)

L'app chiama `checkMigration` → se `user_can_be_migrated` → l'utente accetta → l'app chiama `startMigration` → che invoca `migrationOnDemand` con `{ contact, password, appBrand, source: "ON_DEMAND" }`.

### BULK (batch migration)

```
bulkMigration/handler.ts (scheduled/direct Lambda)
│
├── Query MySQL: users WHERE migrated != 1 (con IDS_OVERRIDE e BULK_LIMIT opzionali)
├── Build SQS messages: { contact, appBrand, source: "BULK" } (10 per batch)
└── Send to BULK_MIGRATION_QUEUE_URL
      │
      ▼
bulkMigrationConsumer/handler.ts (SQS trigger)
│
├── Parse SQS record come InvokeRequest
├── Invoke migrationOnDemand (sincrono, RequestResponse)
└── Throw on non-200 (triggers SQS retry)
```

---

## Sub-migrations (Synchronous, via Lambda Invoke)

### 8a. `petsAndProductsMigration`

**File**: `migrationOnDemand/petsAndProductsMigration/handler.ts`
**Payload**: `{ sessionId, userId, appBrand }`

```
│
├── Find user in MongoDB by legacyId
├── Get MySQL pets + products
├── Check: no serial già in MongoDB → se duplicato → return 500
├── Se no pets → return 200 (nothing to migrate)
│
├── Convert MySQL pets → MongoDB Pet entities → insert
│
├── For each pet, find matching product:
│   ├── updateInventory() → petlinkGpsInventory (imei/iccid/firmware)
│   ├── convertMysqlProduct() → PetlinkGps entity
│   ├── createSentinelDevice() → newGpsDevices queue
│   └── Collect productsToSave[]
│
├── Insert all products in MongoDB
└── Return { code: 200, idsSaved: [petIds + productIds] }
```

### 8b. `energySavingAreaMigration`

**File**: `migrationOnDemand/energySavingAreaMigration/handler.ts`
**Payload**: `{ sessionId, userId, appBrand }`

```
│
├── Find user in MongoDB by legacyId
├── Get MySQL safeplaces
├── Convert → EnergySavingZone entities → insert
├── For each ESA: push setting to Sentinel (settings queue, operationType: CREATE)
└── Return { code: 200, idsSaved: [esaIds] }
```

### 8c. `geofenceMigration`

**File**: `migrationOnDemand/geofenceMigration/handler.ts`
**Payload**: `{ sessionId, userId, appBrand }`

```
│
├── Find user in MongoDB by legacyId
├── Get MySQL geofences
├── Convert → Geofence entities → insert
└── Return { code: 200, idsSaved: [geofenceIds] }
```

### 8d. `subscriptionMigration`

**File**: `migrationOnDemand/subscriptionMigration/handler.ts`
**Payload**: `{ sessionId, userId, appBrand }`

```
│
├── Find user in MongoDB by legacyId
├── Get Chargebee IDs from legacy subs DB
│   ├── customerId (new business entity)
│   └── legacyCustomerId (old business entity)
│
├── Get user IMEIs from MongoDB → find prepaid Chargebee user IDs
│
├── Fetch Chargebee subscriptions:
│   ├── customerId → getSubscriptionsByCustomerId
│   │   └── If empty + legacyCustomerId → fallback to legacy
│   ├── Fetch prepaid subs (active / in_trial only)
│   └── Delete phantom order duplicates (non-UUID userId)
│
├── For each subscription (grouped by serial number):
│   ├── Find device in MongoDB by serialNumber
│   ├── Get invoices by subscription ID
│   │   ├── If no invoices → convert sub without invoice
│   │   └── For each invoice:
│   │       ├── Build Invoice entity
│   │       ├── Get credit notes by invoice ID → convert
│   │       └── Convert subscription (first invoice = active flag)
│   └── Collect subscriptions[], invoices[], creditNotes[]
│
├── saveEntities(): insert subs, invoices, credit notes + manage pet protections
├── manageIncludedSubscriptions() — insurance/included subs
└── Return { code: 200, idsSaved }
```

**Note**:
- Gestisce sia new che legacy Chargebee customer IDs con fallback
- Prepaid subs sempre processate (anche senza main Chargebee account)
- Pet protections: Italy-only, 1-year independent subscriptions

---

## Async SQS Consumers (Fire-and-forget)

Triggered by `sendMessagesToMigrationQueues()` dopo che tutte le sub-migrations sincrone sono completate. Ogni consumer riceve `{ sessionId, legacyUserId, appBrand, serialNumbers }`.

```
  migrationOnDemand (after success)
  │
  ├── SQS → positionHistoryMigration  ──►  positionHistoryMigration/handler.ts
  ├── SQS → activitiesMigration       ──►  activitiesMigration/handler.ts
  ├── SQS → petNotificationMigration  ──►  petNotificationMigration/handler.ts
  └── SQS → kippyRejectSubsMigration  ──►  kippyRejectSubsMigration/handler.ts
```

| Consumer | Source | Dest collection | What it migrates |
|---|---|---|---|
| `positionHistoryMigration` | MySQL `getPositionHistoryBySerialNumber` + `getAppPositionHistoryBySerialNumber` | `positionsHistory` | GPS position history |
| `activitiesMigration` | MySQL `getDeviceActivities` | `activity` | Pet activity data (needs pet/breed/age/model lookup) |
| `petNotificationMigration` | MySQL `getNotificationsBySerialNumber` | `petlinkEverywhere` | Pet notification history |
| `kippyRejectSubsMigration` | MySQL `getUserKippyRejectSubs` | `petlinkEverywhere` | Device resets & replacements |

---

## Standalone Migrations

### `inventoryMigration`

**File**: `inventoryMigration/handler.ts` — Direct Lambda invoke

One-time operation: reads device data from legacy MySQL → writes to `petlinkGpsInventory` MongoDB collection (device whitelist). Not part of per-user flow.

### `orderMigration/bulk`

**File**: `orderMigration/bulk/handler.ts` — Direct Lambda invoke

- US + EU in parallel
- Queries legacy subs MySQL for pre-orders (`abbonamenti_prevendita` JOIN `ordini` where `imei IS NOT NULL`)
- Creates `Order` + `OrderLineItem` in MongoDB + prepaid subscriptions in Chargebee

### `orderMigration/scheduled`

**File**: `orderMigration/scheduled/handler.ts` — CloudWatch Events (cron)

Same as bulk but queries only last 6 minutes (`updated_at >= NOW() - INTERVAL 6 MINUTE`). US also filters `associato = 0`.

### `userCleanup`

**File**: `userCleanup/handler.ts` — Direct Lambda invoke with `{ userId }`

Rolls back a migrated user completely:

```
│
├── Find user in MongoDB
├── Pre-condition: no active/trial/future subscriptions → se ci sono → return 422
│
├── cleanupDatabase():
│   ├── Delete from petlinkEverywhere (by userId)
│   ├── Delete from notificationsHistory (by userId)
│   ├── Delete from post collection (by userId)
│   ├── Delete from activity collection (by petId)
│   ├── Delete from positionsHistory (by petlinkGpsId)
│   └── Disable subscription in petlinkGpsInventory (by serialNumber)
│
├── Delete user from Cognito + MongoDB
└── Reset MySQL: UPDATE user SET migrated = 0 WHERE id = ?
```

---

## Data Sources & Destinations

```
  ┌─────────────────────────────────┐       ┌──────────────────────────────────┐
  │       Legacy (Source)           │       │      Petlink (Destination)       │
  ├─────────────────────────────────┤       ├──────────────────────────────────┤
  │ MySQL US (Petlink)              │       │ MongoDB: petlinkEverywhere       │
  │ MySQL EU (Kippy)                │ ────► │   (USER, PET, PETLINK_GPS,       │
  │ MySQL Subs EU (kippy_subs)      │       │    SUBSCRIPTION, INVOICE,        │
  │ MySQL Subs US (kippy_subs)      │       │    CREDIT_NOTE, GEOFENCE,        │
  │ Chargebee (API)                 │       │    ENERGY_SAVING_ZONE, ...)      │
  │ Legacy S3 (profile images)      │       │ MongoDB: petlinkGpsInventory     │
  │                                 │       │ MongoDB: positionsHistory        │
  │                                 │       │ MongoDB: activity                │
  │                                 │       │ MongoDB: post                    │
  │                                 │       │ MongoDB: migrationHistory        │
  │                                 │       │ AWS Cognito (user pool)          │
  │                                 │       │ Petlink S3 (profile images)      │
  │                                 │       │ Sentinel (device registration)   │
  └─────────────────────────────────┘       └──────────────────────────────────┘
```

---

## SQS Queue Map (Migration-specific)

| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| `bulkMigration` | `bulkMigration` Lambda | `bulkMigrationConsumer` | Dispatch per-user migration jobs |
| `positionHistoryMigration` | `migrationOnDemand` | `positionHistoryMigration` | GPS position history (async) |
| `activitiesMigration` | `migrationOnDemand` | `activitiesMigration` | Pet activity data (async) |
| `petNotificationMigration` | `migrationOnDemand` | `petNotificationMigration` | Pet notification history (async) |
| `kippyRejectSubsMigration` | `migrationOnDemand` | `kippyRejectSubsMigration` | Device resets & replacements (async) |
