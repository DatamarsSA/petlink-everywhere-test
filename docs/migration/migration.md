# Data Migration — `petlink-data-migration`

> Source of truth: code in `all-repo/petlink-data-migration/src/`. This document is derived from the actual handler implementations, not from internal READMEs which may be stale.

Migrates users, pets, GPS devices, subscriptions, and historical data from legacy MySQL (Kippy EU / Petlink US) to Petlink Everywhere MongoDB.

---

## Macro Flow (ASCII)

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                    ENTRY POINTS                         │
                        └─────────────────────────────────────────────────────────┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │                                                  │
          ┌──────▼───────┐                                  ┌───────▼────────┐
          │  ON_DEMAND   │                                  │     BULK       │
          │ (direct invoke)│                                 │  bulkMigration │
          └──────┬───────┘                                  └───────┬────────┘
                 │                                                  │
                 │                                    ┌─────────────▼──────────────┐
                 │                                    │ Query MySQL: migrated != 1 │
                 │                                    │ Build SQS messages (batch) │
                 │                                    └─────────────┬──────────────┘
                 │                                                  │
                 │                                    ┌─────────────▼──────────────┐
                 │                                    │  SQS: bulkMigration queue  │
                 │                                    └─────────────┬──────────────┘
                 │                                                  │
                 │                                    ┌─────────────▼──────────────┐
                 │                                    │ bulkMigrationConsumer       │
                 │                                    │ (invokes migrationOnDemand) │
                 │                                    └─────────────┬──────────────┘
                 │                                                  │
                 └──────────────────────┬───────────────────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │   migrationOnDemand         │
                          │      (orchestrator)         │
                          └─────────────┬──────────────┘
                                        │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
  ┌──────▼───────┐              ┌────────▼────────┐              ┌───────▼───────┐
  │ 1. User      │              │ 2. Sub-migrate  │              │ 3. Post-mig   │
  │   creation   │              │   (sequential)  │              │   steps       │
  └──────┬───────┘              └────────┬────────┘              └───────┬───────┘
         │                               │                               │
         │                    ┌──────────┴───────────┐                   │
         │                    │                      │                   │
         │             ┌──────▼──────┐        ┌──────▼──────┐            │
         │             │ petsAndProd │        │  ESA mig    │            │
         │             └──────┬──────┘        └──────┬──────┘            │
         │                    │                      │                   │
         │             ┌──────▼──────┐        ┌──────▼──────┐            │
         │             │ geofenceMig │        │  subsMig    │            │
         │             └──────┬──────┘        └──────┬──────┘            │
         │                    └──────────┬───────────┘                   │
         │                               │                               │
         │                    ┌──────────▼───────────┐                   │
         │                    │ Cognito user creation │                   │
         │                    └──────────┬───────────┘                   │
         │                               │                               │
         │                    ┌──────────▼───────────┐                   │
         │                    │ MySQL: migrated = 1   │                   │
         │                    └──────────┬───────────┘                   │
         │                               │                               │
         │                    ┌──────────▼───────────┐                   │
         │                    │ Async SQS enqueue     │                   │
         │                    │ (fire-and-forget)     │                   │
         │                    └──────────┬───────────┘                   │
         │                               │                               │
         │                    ┌──────────▼───────────┐                   │
         │                    │ postCreationFunction  │                   │
         │                    │ (welcome posts)       │                   │
         │                    └──────────┬───────────┘                   │
         └───────────────────────────────┼───────────────────────────────┘
                                        │
                                 Return 200 / 500
```

---

## Entry Points

### ON_DEMAND

`migrationOnDemand/handler.ts` is invoked directly via AWS Lambda with:
```json
{ "contact": "user@example.com", "password": "xxx", "appBrand": "PETLINK", "source": "ON_DEMAND" }
```
- `contact`: email or phone (E.164)
- `password`: required for ON_DEMAND (auto-generated for BULK)
- `appBrand`: `"PETLINK"` (US) or `"KIPPY"` (EU)`
- `source`: `"ON_DEMAND"` (default) or `"BULK"`

### BULK

`bulkMigration/handler.ts` runs as a scheduled/direct Lambda:
1. Queries legacy MySQL for users where `migrated != 1` (optionally filtered by `IDS_OVERRIDE` and `BULK_LIMIT`)
2. Builds SQS messages with `{contact, appBrand, source: "BULK"}` (10 per batch)
3. Sends to `BULK_MIGRATION_QUEUE_URL`

`bulkMigrationConsumer/handler.ts` (SQS trigger):
1. Parses each SQS record as `InvokeRequest`
2. Invokes `migrationOnDemand` Lambda synchronously (`RequestResponse`)
3. Throws on non-200 response (triggers SQS retry)

---

## Orchestrator: `migrationOnDemand/handler.ts`

<details>
<summary><b>Step-by-step orchestrator logic</b></summary>

```
migrationOnDemand handler
│
├── 1. Validate InvokeRequest (Zod)
│     └── If invalid → return 400
│
├── 2. Resolve password
│     ├── ON_DEMAND: password required from caller
│     └── BULK: auto-generate via generateBulkPassword()
│
├── 3. Check if user already exists in MongoDB
│     └── If found → return 200 "already exists" (idempotent)
│
├── 4. Look up user in legacy MySQL
│     ├── appBrand PETLINK → US connection
│     ├── appBrand KIPPY  → EU connection
│     └── If not found → return 404
│
├── 5. Start migration stats (migrationHistory collection)
│     └── sessionId = uuidv4()
│
├── 6. Create user entity (createUser in util.ts)
│     ├── Map MySQL fields → MongoDB User schema
│     ├── Download profile image from legacy S3 → Petlink S3
│     ├── Validate phone (E.164), set forceSetPhoneNumber if invalid
│     ├── Set forceChangePassword = true for BULK
│     └── Validate with Zod (User.safeParse)
│
├── 7. Insert user into MongoDB (petlinkEverywhere collection)
│     └── If fails → rollback + send error email → return 500
│
├── 8. Sequential sub-migrations (via Lambda Invoke, RequestResponse)
│     │
│     ├── 8a. petsAndProductsMigration
│     │     └── On failure → rollback + error email → return 500
│     │
│     ├── 8b. energySavingAreaMigration
│     │     └── On failure → rollback + error email → return 500
│     │
│     ├── 8c. geofenceMigration
│     │     └── On failure → rollback + error email → return 500
│     │
│     └── 8d. subscriptionMigration
│           └── On failure → rollback + error email → return 500
│
├── 9. Create Cognito user
│     ├── Set attributes: phone, email, name, surname, verified
│     └── On failure → rollback + error email → return 500
│
├── 10. Mark user as migrated in legacy MySQL
│      └── UPDATE user SET migrated = 1 WHERE id = ?
│
├── 11. End migration stats (USER target)
│
├── 12. Find migrated devices → enqueue async SQS messages
│      ├── positionHistoryMigration queue
│      ├── activitiesMigration queue
│      ├── petNotificationMigration queue
│      └── kippyRejectSubsMigration queue
│
├── 13. postCreationFunction
│      ├── Create 3 welcome posts (countId 0, 1, 2)
│      └── Create species-specific posts (DOG / CAT)
│
└── Return 200 { message, user }
```

**Rollback**: On any sub-migration failure, `rollbackUserData(idsToDelete)` deletes all inserted documents from `petlinkEverywhere` collection by `id`. The `idsSaved` array accumulates IDs across all sub-migrations.

**Error notification**: On failure, `sendEmailMigrationError()` sends via SendGrid to `CUSTOMER_FEEDBACK_EMAIL` with user details and the failure reason.

</details>

---

## Sub-migrations (Synchronous, via Lambda Invoke)

### 8a. `petsAndProductsMigration`

<details>
<summary><b>petsAndProductsMigration details</b></summary>

**File**: `migrationOnDemand/petsAndProductsMigration/handler.ts`
**Invoke payload**: `{ sessionId, userId, appBrand }`

```
petsAndProductsMigration
│
├── Find user in MongoDB by legacyId
├── Get MySQL pets (getUserPets) and products (getUserProducts)
├── Check: no product serial already exists in MongoDB
│     └── If duplicate → return 500
├── If no pets → return 200 (nothing to migrate)
│
├── Convert MySQL pets → MongoDB Pet entities
│   ├── Map fields (name, species, breed, birthDate, image, ...)
│   └── Insert into petlinkEverywhere collection
│
├── For each pet, find matching product:
│   ├── updateInventory() — update petlinkGpsInventory with device data
│   ├── convertMysqlProduct() → PetlinkGps entity
│   ├── Validate with Zod (PetlinkGps.safeParse)
│   ├── createSentinelDevice() — register device with Sentinel
│   └── Collect productsToSave[]
│
├── Insert all products into petlinkEverywhere collection
│
├── End migration stats (PETS_AND_PRODUCTS target)
│   └── Records: petsMigrated, productsMigrated, petsTotal, productsTotal
│
└── Return { code: 200, idsSaved: [petIds + productIds] }
```

**Key details**:
- Inventory update pulls imei/iccid/firmware from MySQL and writes to `petlinkGpsInventory` collection
- Sentinel device registration sends to `newGpsDevices` queue
- If pet insertion fails → delete inserted pets, return 500
- If product insertion fails → delete inserted products AND pets, return 500

</details>

### 8b. `energySavingAreaMigration`

<details>
<summary><b>energySavingAreaMigration details</b></summary>

**File**: `migrationOnDemand/energySavingAreaMigration/handler.ts`
**Invoke payload**: `{ sessionId, userId, appBrand }`

```
energySavingAreaMigration
│
├── Find user in MongoDB by legacyId
├── Get MySQL safeplaces (getUserSafeplaces)
├── Convert → EnergySavingZone entities
├── Insert into petlinkEverywhere collection
├── For each ESA: push setting to Sentinel (settings queue)
│   └── EnergySavingZoneSettingCreation with operationType: CREATE
├── End migration stats (ENERGY_SAVING_AREAS target)
│   └── Records: areasMigrated, areasTotal
│
└── Return { code: 200, idsSaved: [esaIds] }
```

</details>

### 8c. `geofenceMigration`

<details>
<summary><b>geofenceMigration details</b></summary>

**File**: `migrationOnDemand/geofenceMigration/handler.ts`
**Invoke payload**: `{ sessionId, userId, appBrand }`

```
geofenceMigration
│
├── Find user in MongoDB by legacyId
├── Get MySQL geofences (getUserGeofences)
├── Convert → Geofence entities
├── Insert into petlinkEverywhere collection
├── End migration stats (GEOFENCES target)
│   └── Records: geofencesMigrated, geofencesTotal
│
└── Return { code: 200, idsSaved: [geofenceIds] }
```

</details>

### 8d. `subscriptionMigration`

<details>
<summary><b>subscriptionMigration details</b></summary>

**File**: `migrationOnDemand/subscriptionMigration/handler.ts`
**Invoke payload**: `{ sessionId, userId, appBrand }`

```
subscriptionMigration
│
├── Find user in MongoDB by legacyId
├── Get Chargebee IDs from legacy subs DB (getUserChargebeeIds)
│   ├── customerId (new business entity)
│   └── legacyCustomerId (old business entity)
│
├── Get user IMEIs from MongoDB → find prepaid Chargebee user IDs
│
├── Fetch Chargebee subscriptions:
│   ├── If customerId exists → getSubscriptionsByCustomerId
│   │   └── If empty + legacyCustomerId exists → fallback to legacy
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
├── Get remaining invoices (not linked to any subscription)
│
├── saveEntities():
│   ├── Insert subscriptions, invoices, credit notes
│   ├── Manage pet protections (Kippy Care)
│   └── Return idsSaved
│
├── manageIncludedSubscriptions() — insurance/included subs
│
├── End migration stats (SUBSCRIPTIONS target)
│   └── Records: creditNotesMigrated, chargebeeSubscriptionsMigrated,
│       invoicesMigrated, includedSubscriptionsMigrated, petProtectionsMigrated
│
└── Return { code: 200, idsSaved }
```

**Key details**:
- Handles both new and legacy Chargebee customer IDs with fallback
- Prepaid subscriptions are always processed (even without main Chargebee account)
- Pet protections are Italy-only, 1-year independent subscriptions
- Phantom order duplicates (non-UUID userId) are cleaned before insertion

</details>

---

## Async SQS Consumers (Fire-and-forget)

Triggered by `sendMessagesToMigrationQueues()` in the orchestrator after all synchronous sub-migrations succeed. Each receives `{ sessionId, legacyUserId, appBrand, serialNumbers }`.

```
  migrationOnDemand (after success)
  │
  ├── SQS: positionHistoryMigration  ──►  positionHistoryMigration/handler.ts
  ├── SQS: activitiesMigration       ──►  activitiesMigration/handler.ts
  ├── SQS: petNotificationMigration  ──►  petNotificationMigration/handler.ts
  └── SQS: kippyRejectSubsMigration  ──►  kippyRejectSubsMigration/handler.ts
```

<details>
<summary><b>positionHistoryMigration</b></summary>

**File**: `migrationOnDemand/positionHistoryMigration/handler.ts`
**Trigger**: SQS (POSITION_HISTORY_MIGRATION_QUEUE_URL)

- For each serial number:
  - Find device in MongoDB
  - Fetch position history from MySQL (`getPositionHistoryBySerialNumber`)
  - Fetch app position history from MySQL (`getAppPositionHistoryBySerialNumber`)
  - Convert both → `PositionHistoryEvent` entities
  - Insert into `POSITION_HISTORY_COLLECTION_NAME`
- Records stats: `positionHistoriesMigrated`, `positionHistoriesTotal`

</details>

<details>
<summary><b>activitiesMigration</b></summary>

**File**: `migrationOnDemand/activitiesMigration/handler.ts`
**Trigger**: SQS (ACTIVITIES_MIGRATION_QUEUE_URL)

- Find devices in MongoDB by serial numbers
- For each device:
  - Find pet, breed, determine age category (puppy/medium/adult)
  - Determine device model from firmware version (DOG/CAT/EVO)
  - Fetch activities from MySQL (`getDeviceActivities`)
  - Convert → `PetActivity` entities
- Insert into `ACTIVITY_COLLECTION_NAME`
- Records stats: `activitiesMigrated`, `activitiesTotal`

</details>

<details>
<summary><b>petNotificationMigration</b></summary>

**File**: `migrationOnDemand/petNotificationMigration/handler.ts`
**Trigger**: SQS (PET_NOTIFICATION_MIGRATION_QUEUE_URL)

- For each serial number:
  - Find device in MongoDB
  - Fetch notifications from MySQL (`getNotificationsBySerialNumber`)
  - Convert → `PetHistoryEvent` entities
  - Insert into `petlinkEverywhere` collection
- Records stats: `notificationsMigrated`, `notificationsTotal`

</details>

<details>
<summary><b>kippyRejectSubsMigration</b></summary>

**File**: `migrationOnDemand/kippyRejectSubsMigration/handler.ts`
**Trigger**: SQS (KIPPY_REJECT_SUBS_MIGRATION_QUEUE_URL)

- Find user in MongoDB by legacyId
- Fetch kippy reject subs from MySQL (`getUserKippyRejectSubs`)
- Convert → `ResetPetlinkGpsHistory` and `ReplacementPetlinkGpsHistory` entities
- Insert resets into `petlinkEverywhere` collection
- Insert replacements into `petlinkEverywhere` collection
- Records stats: `resetsMigrated`, `resetsTotal`, `replacementsMigrated`, `replacementsTotal`

</details>

---

## Standalone Migrations

### `inventoryMigration`

<details>
<summary><b>inventoryMigration details</b></summary>

**File**: `inventoryMigration/handler.ts`
**Trigger**: Direct Lambda invoke

- Reads `DB_TO_MIGRATE` env var (`EU` or `US`)
- Calls `migrateInventory()` which reads device data from legacy MySQL + legacy subs MySQL
- Writes to `petlinkGpsInventory` MongoDB collection (the device whitelist)
- This is a one-time / on-demand operation, not part of the per-user migration flow

</details>

### `orderMigration/bulk`

<details>
<summary><b>orderMigration/bulk details</b></summary>

**File**: `orderMigration/bulk/handler.ts`
**Trigger**: Direct Lambda invoke

- Runs US and EU migrations in parallel
- Queries legacy subs MySQL for all pre-orders (`abbonamenti_prevendita` JOIN `ordini`) where `imei IS NOT NULL`
- Calls `createOrders()` → creates `Order` + `OrderLineItem` entities in MongoDB
- Calls `createSubscriptionPrepaid()` → creates prepaid subscriptions in Chargebee + MongoDB

</details>

### `orderMigration/scheduled`

<details>
<summary><b>orderMigration/scheduled details</b></summary>

**File**: `orderMigration/scheduled/handler.ts`
**Trigger**: CloudWatch Events (cron)

- Same logic as bulk, but queries only records updated in the last 6 minutes (`updated_at >= NOW() - INTERVAL 6 MINUTE`)
- US: also filters `associato = 0` (not yet associated)
- EU: no `associato` filter
- Handles incremental pre-order migration for new orders arriving in legacy system

</details>

### `userCleanup`

<details>
<summary><b>userCleanup details</b></summary>

**File**: `userCleanup/handler.ts`
**Trigger**: Direct Lambda invoke with `{ userId }`

Rolls back a migrated user completely:

```
userCleanup
│
├── Find user in MongoDB
├── Pre-condition check: no active/trial/future subscriptions on any device
│   └── If active subs found → return 422
│
├── Get related IDs (pets, petlinkGps, serials)
├── cleanupDatabase():
│   ├── Delete from petlinkEverywhere (by userId)
│   ├── Delete from notificationsHistory (by userId)
│   ├── Delete from post collection (by userId)
│   ├── Delete from activity collection (by petId)
│   ├── Delete from positionsHistory (by petlinkGpsId)
│   └── Disable subscription in petlinkGpsInventory (by serialNumber)
│
├── deleteUserFromDbAndCognito():
│   ├── Delete user from Cognito
│   └── Delete user from MongoDB
│
└── Reset legacy MySQL: UPDATE user SET migrated = 0 WHERE id = ?
```

</details>

---

## Migration Stats Collection

Every sub-migration (synchronous and async) records stats in the `migrationHistory` MongoDB collection:

```
migrationHistory document structure:
{
  sessionId:    UUID (shared across all sub-migrations for one user)
  userId:       legacy MySQL user ID (string)
  migrationTarget: USER | PETS_AND_PRODUCTS | ENERGY_SAVING_AREAS | GEOFENCES |
                   SUBSCRIPTIONS | POSITION_HISTORY | ACTIVITIES |
                   PET_NOTIFICATIONS | RESETS_AND_REPLACEMENTS
  startedAt:    ISO timestamp
  endedAt:      ISO timestamp
  email:        (USER only)
  // target-specific fields:
  petsMigrated, productsMigrated, areasMigrated, geofencesMigrated,
  chargebeeSubscriptionsMigrated, invoicesMigrated, creditNotesMigrated,
  petProtectionsMigrated, positionHistoriesMigrated, activitiesMigrated,
  notificationsMigrated, resetsMigrated, replacementsMigrated, ...
}
```

- `startMigrationStatsCollection()` — upserts with `startedAt`
- `endMigrationStatsCollection()` — upserts with `endedAt` + target-specific stats

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
  │                                 │       │    ENERGY_SAVING_ZONE, ...)      │
  │ Chargebee (API)                 │       │                                  │
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

---

## Key Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `MYSQL_US_SECRET` / `MYSQL_EU_SECRET` | All | Secrets Manager ref for legacy MySQL |
| `MONGO_DB_SECRET` | All | Secrets Manager ref for MongoDB |
| `KIPPY_SUBSCRIPTIONS_EU_DB_SECRET` / `US_DB_SECRET` | petsAndProducts, subs, orders | Legacy subs MySQL |
| `CHARGEBEE_SECRET` | subscriptionMigration, orderMigration | Chargebee API key + site |
| `SENDGRID_SECRET` | migrationOnDemand | Error notification emails |
| `PETS_AND_PRODUCTS_MIGRATION_FUNCTION_NAME` | migrationOnDemand | Lambda name to invoke |
| `ESA_MIGRATION_FUNCTION_NAME` | migrationOnDemand | Lambda name to invoke |
| `GEOFENCE_MIGRATION_FUNCTION_NAME` | migrationOnDemand | Lambda name to invoke |
| `SUBS_MIGRATION_FUNCTION_NAME` | migrationOnDemand | Lambda name to invoke |
| `MIGRATION_ON_DEMAND_FUNCTION_NAME` | bulkMigrationConsumer | Lambda name to invoke |
| `BULK_REGION` | bulkMigration | `"US"` or `"EU"` |
| `BULK_LIMIT` | bulkMigration | Max users per run (optional) |
| `IDS_OVERRIDE` | bulkMigration | JSON array of specific user IDs |
| `DB_TO_MIGRATE` | inventoryMigration | `"EU"` or `"US"` |
| `USER_POOL_ID` | migrationOnDemand, userCleanup | Cognito user pool |
| `POSITION_HISTORY_MIGRATION_QUEUE_URL` | migrationOnDemand | SQS URL |
| `ACTIVITIES_MIGRATION_QUEUE_URL` | migrationOnDemand | SQS URL |
| `PET_NOTIFICATION_MIGRATION_QUEUE_URL` | migrationOnDemand | SQS URL |
| `KIPPY_REJECT_SUBS_MIGRATION_QUEUE_URL` | migrationOnDemand | SQS URL |
| `BULK_MIGRATION_QUEUE_URL` | bulkMigration | SQS URL |
