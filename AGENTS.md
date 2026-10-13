# Petlink Everywhere - Architecture & Overview

## 1. System Architecture
Petlink/Kippy is a GPS pet tracking platform where users register their pets, activate GPS collars, purchase subscriptions, and monitor their pets in real-time through mobile apps.
Two brands: **Petlink** (US) and **Kippy** (EU), same backend. The `APP_BRAND` env var determines which brand the test suite runs against.

```mermaid
graph TB
  subgraph "Clients"
    Mobile[Mobile Apps<br/>Petlink US / Kippy EU]
    Web[Web App]
    CCTFront[CCT Frontend]
    Stores[External Stores<br/>Shopify / Magento]
  end

  subgraph "Backend Services (AWS Lambda)"
    Core[petlink-everywhere-core<br/>Main API]
    SubsMgr[subscriptions-manager<br/>Chargebee]
    CCTCore[petlink-everywhere-cct-core<br/>Customer Care]
  end

  subgraph "Device Infrastructure"
    Devices[GPS Devices]
    Sentinel[Sentinel<br/>Rust TCP on EKS]
    SQSConsumers[SQS Consumers<br/>Lambdas in Core repo]
  end

  subgraph "Data"
    MongoDB[(Petlink MongoDB)]
    CCTMongo[(CCT MongoDB)]
    SQS[/SQS Queues/]
  end

  Mobile & Web -->|GraphQL| Core
  CCTFront -->|GraphQL| CCTCore
  Stores -->|REST| Core

  Core <-->|R/W| MongoDB
  Core -->|GraphQL SDK| SubsMgr
  Core <-->|SQS| SQS

  CCTCore -->|Direct Read| MongoDB
  CCTCore <-->|R/W| CCTMongo
  CCTCore -->|SDK mutations| Core
  CCTCore -->|SDK| SubsMgr

  SubsMgr <-->|API| Chargebee[Chargebee]
  Chargebee -.->|Webhooks| SubsMgr
  SubsMgr -->|SQS| SQS

  Devices <-->|TCP Binary| Sentinel
  SQS <-->|commands / positions / activities| Sentinel
  SQS -->|consume| SQSConsumers
  SQSConsumers <-->|R/W| MongoDB

  Core -.->|via consumers| Twilio[Twilio] & SendGrid[SendGrid] & Firebase[Firebase]
```

## 2. Repositories (`all-repo/new-env/`)
Backend / device:
- **`petlink-everywhere-core`** — Main backend API (AppSync + Lambdas). Users, pets, devices, SQS consumers.
- **`petlink-everywhere-cct-core`** — Backend for Customer Care Tool. Reads Petlink DB, owns CCT DB.
- **`subscriptions-manager`** — Chargebee webhooks, payments, subscription states.
- **`petlink-everywhere-sentinel`** — Rust TCP server on EKS for GPS device connections.
- **`petlink-data-migration`** — Data migration service (temporary — dropped after migration completes). Migrates users, pets, devices, subscriptions, historical data from legacy MySQL to MongoDB. See `docs/migration/migration.md`.

Clients:
- **`petlink-everywhere-mobile`** — Flutter app (Petlink US / Kippy EU).
- **`petlink-everywhere-web`** — React frontend for end users.
- **`petlink-everywhere-cct`** — React frontend for support agents.

Shared/support: `petlink-everywhere-types`, `petlink-everywhere-dictionary`, `petlink-everywhere-bluetooth`, `petlink-everywhere-device-simulator`, `petlink-everywhere-databases`.

### Legacy environment (`all-repo/old-env/`)
Old PHP/MySQL stack the new env migrated *from* — still relevant for support tickets on non-migrated users and for migration debugging. Monoliths: `PID-KippyAPI-V2` (REST API + `kd2/` device ingestion), `PID-Kippy-Service` (subscriptions/checkout, Chargebee), `PID-Kippy-CustomerCareTool`, `PID-Kippy-Internal` (orders/replacements/DMOS), `PID-Kippy-Polymorphic` (C++ TCP server = old Sentinel), `PID-Kippy-Dispatcher` (push/mail router). Full per-repo minimaps, MySQL DB map and old↔new mapping table: `all-repo/old-env/AGENTS.md`. Quick equivalents: Polymorphic→Sentinel, API-V2→Core, Service→subscriptions-manager, MySQL `admin_db`→`petlinkGpsInventory`. Disposable post-migration, like `petlink-data-migration`.

---

## 3. Repo Minimaps
> Goal: get the AI to the **right folder on first try**. Function names and exact lists are intentionally omitted — discover them on demand.

### 3.1 `petlink-everywhere-test` (this repo — integration test suite)
Node/TS + Vitest; `APP_BRAND` = `PETLINK` | `KIPPY`. Tests in `src/tests/{domain}/`, fixtures `src/fixtures/` (`fxt`), API/OTP clients in `src/clients/`. Conventions, builder pattern, cleanup, CI: `README.md`.

### 3.2 `petlink-everywhere-core` (Node/TS, AppSync + Lambdas)
- **GraphQL endpoints** (1 Lambda per op): `src/lambda_functions/graphql/{mutation|query}/{name}/handler.ts`
- **Business logic** (most bugs live here): `src/lib/petlink/*.ts` (user, pet, petlinkGps, subscriptions, …)
- **DB layer**: `src/lib/mongoDb/`
- **SQS consumers**: `src/lambda_functions/sentinel/*` (positions, notifications, activities) and `src/lambda_functions/subscriptions/*` (Chargebee webhook events, expired checker)
- **Handler pattern**: `handler.ts → createAppSyncHandler → getUserFromCognito → lib/petlink → mongoDb`
- **MongoDB**: single collection `petlinkEverywhere` with `entityType` discriminator (`USER`, `PET`, `PETLINK_GPS`, `SUBSCRIPTION`, …); separate collection `petlinkGpsInventory` is the **device whitelist** (serial → imei/iccid/firmware). Missing serial → `createPetlinkGps` 428.
- **Gotcha**: SQS consumers that process Sentinel data live **here**, not in Sentinel.
- **Test-only**: `utilityIntegrationTest` mutation (IAM auth) for signup/cleanup/buy-subscription bypassing OTP/Chargebee.
- **`publishOn*` mutations** don't write to DB — they only trigger AppSync WebSocket subscriptions.

### 3.3 `petlink-everywhere-cct-core` (Node/TS, AppSync + Lambdas)
- **Layout**: same as Core — `src/lambda_functions/graphql/{mutation|query}/{name}/handler.ts`
- **Dual MongoDB** via `MongoDbSingleton`:
  - `'PETLINK'` → reads Core's MongoDB directly (customers, devices, subscriptions, inventory)
  - `'CCT'` → its own DB (CCT users, audit logs, tickets)
- **Read pattern**: `getCustomer`, `getDevices`, etc. read Petlink MongoDB **directly** — no proxy to Core. `getDevices` is an aggregation pipeline JOINing `petlinkEverywhere` (`entityType=PETLINK_GPS`) with `petlinkGpsInventory`.
- **Write pattern**: mutations **proxy** to Core via `sdkCore` (e.g. delete customer, reset device, hide pet) and to subscriptions-manager via `sdkSM` (refunds, coupons), then log the action in CCT DB for audit.

### 3.4 `subscriptions-manager` (Node/TS, Chargebee)
- **GraphQL mutations**: `src/lambdaFunctions/graphql/mutations/{name}/handler.ts`
- **Chargebee webhook (REST)**: `src/lambdaFunctions/webhook/operations/post/webhook.ts` + per-event handlers in `webhookHandlers/`
- **Flow**: Chargebee POST → `webhook.ts` routes by `event_type` → handler builds normalized payload → SQS `subscriptionsWebhook` → consumed by Core (`subscriptionsWebhookConsumer`).
- **Cross-repo**: Core ↔ subscriptions-manager via GraphQL SDK (IAM); async side-effects via SQS.

### 3.5 `petlink-everywhere-sentinel` (Rust, TCP server)
- TCP server on AWS EKS + Global Accelerator; parses **SiRF binary** from GPS devices.
- **Gotcha**: Lambda consumers of the outbound queues live in **Core**, not here.
- **SQS queue map** (all async flows pass through these):

| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| `gpsMessages` | Sentinel Rust | Core `gpsMessagesConsumer` | GPS positions + device status |
| `activities` | Sentinel Rust | Core `activitiesConsumer` | Pet activity data |
| `notifications` | Sentinel + Core | Core `notificationsConsumer` | Push, SMS, email dispatch |
| `commands` | Core `sendCommand` | Sentinel Rust | Commands to device (torch, sound, liveTracking) |
| `newGpsDevices` | Core `createPetlinkGps` | Sentinel Rust | New device registration |
| `settings` | Core `sendSetting` | Sentinel Rust | Device configuration updates |
| `subscriptionsWebhook` | subscriptions-manager | Core `subscriptionsWebhookConsumer` | Chargebee payment events |

### 3.6 `petlink-everywhere-mobile` (Flutter, end-user app)
- **Stack**: Flutter + **GetX** (state/DI/routing) + `graphql_flutter` + AWS Cognito.
- **Entrypoint**: `lib/main.dart`.
- **Feature-driven clean arch** under `lib/features/{feature}/{binding,data,domain,presentation}/`. Key features: `auth`, `home`, `pet_profile`, `gps_settings`, `new_registration`, `products`, `lost_pet`, `activity_pets`, `history`, `settings`, `user_profile`, `menu`.
- **Shared code**: `lib/core/` (widgets, utils, generated GraphQL schema in `lib/core/schema.graphql.dart`) and `lib/base/` (network, router, extensions, namespaces).
- **Network**: `lib/base/network/client_service.dart` + `cognito_manager.dart`.
- **Routing**: `lib/base/router/app_router.dart` + `app_routes.dart`.
- Talks to **Core** GraphQL only (not to cct-core / subs-manager directly).

### 3.7 `petlink-everywhere-web` (React, end-user web app)
- **Stack**: React + TypeScript + **Redux Toolkit + RTK Query** + TailwindCSS.
- **Entrypoint**: `src/index.tsx` → `src/App.tsx`.
- **UI**: pages in `src/components/pages/`, layout in `src/components/layout/`, reusable in `src/components/{common,shared}/`.
- **State + API**: `src/store/store.ts`; slices in `src/store/slices/`; **GraphQL endpoints wrapped as RTK Query** in `src/store/api/`.
- **GraphQL operations** (generated): `src/graphql/operations/{queries,mutations,subscriptions}.ts`.
- **Routing**: `src/routing/`. Custom hooks: `src/hooks/`. i18n: `src/locales/` + `src/i18n/`.
- Talks to **Core** GraphQL only.

### 3.8 `petlink-everywhere-cct` (React, Customer Care frontend)
- Same stack as web (React + TS + RTK Query + Tailwind), built with **Vite**.
- **Entrypoint**: `src/index.tsx` → `src/components/App.tsx`.
- **UI**: `src/components/{pages,layout,common,shared}/` (same convention as web).
- **State + API**: `src/store/store.ts`; `src/store/api/` is split **per domain** (`customers/`, `devices/`, `pets/`, `subscriptions/`, `coupons/`, `logs/`, `orders/`, `shelters/`, `users/`, `petProtections/`, `planProfiles/`, `migrations/`, `preregFreePeriod/`, `profile/`).
- **Routing**: `src/routing/appRouter.tsx` + `appPaths.ts` + `appRoutesId.ts` + `useAppMenuList.ts`.
- Talks to **`cct-core`** GraphQL — never directly to Core.

### 3.9 `petlink-data-migration` (Node/TS, Lambdas — temporary repo)
- **Purpose**: migrates users, pets, GPS devices, subscriptions, history from legacy MySQL (`old-env`) to MongoDB.
- **Entrypoint**: `migrationOnDemand/handler.ts` — orchestrator; invoked directly or via `bulkMigration` → SQS → `bulkMigrationConsumer` (one user per message). Sub-migrations (pets+devices, ESA, geofences, subscriptions) invoked synchronously via Lambda Invoke; history (positions, activities, notifications) via fire-and-forget SQS consumers.
- **Gotcha**: stats in `migrationHistory` collection; rollback deletes all inserted docs on failure. `userCleanup` rolls back a migrated user (MongoDB + Cognito + `migrated=0` in MySQL).
- **Deep-dive**: `docs/migration/migration.md`

---

## 4. Subscriptions Domain

### Brand differences
- **Petlink (US)**: standard subscriptions only (Monthly / Yearly / Multi-year). No protection addons.
- **Kippy (EU)**: standard subscriptions + optional **Device Protection** addon (same duration, covers device replacement).
- **Pet Protection** (a.k.a. *Care Protection* in code): **Italy only**, 1-year independent subscription, requires an active main subscription, covers veterinary expenses.

### State machine
```mermaid
stateDiagram-v2
    [*] --> PreRegistration: Device sold,<br/>not activated
    PreRegistration --> Active: User activates device<br/>+ subscription
    PreRegistration --> Cancelled: Refund before activation
    Active --> Active: Renewal succeeded
    Active --> NonRenewing: User cancels (auto_renew=false)
    Active --> Cancelled: Payment failed /<br/>immediate cancel
    NonRenewing --> Expired: End of term
    Active --> Expired: Subscription ends
    Expired --> Active: User reactivates
    Cancelled --> [*]
    Expired --> [*]
```

### Key flows
- **Pre-registration**: external store (Shopify/Magento) calls Core REST API with serial + plan → Core creates pre-registered subscription in Chargebee → activates when user registers the device.
- **Renewal**: Chargebee triggers renewal → `subscription_renewed` webhook → SubsMgr → SQS → Core updates term end → Sentinel keeps device active.
- **Cancellation**: user/CCT cancels → `auto_renew=false` in Chargebee → device active until term end → at term end `subscription_cancelled` webhook → Sentinel deactivates device.

---

## 5. External Integrations
- **AWS Cognito** — auth for mobile/web (end users) and CCT (separate user pool for support staff). Integrated via AWS Amplify.
- **Chargebee** — payments + subscription lifecycle + addons + hosted pages + webhooks. SDK in `subscriptions-manager`.
- **Firebase Cloud Messaging** — push notifications. Separate FCM projects per brand (Petlink / Kippy).
- **Twilio** — SMS (OTP signup, critical alerts). Env-based whitelists for testing.
- **SendGrid** — transactional email (welcome, receipts, alerts). Templates stored in MongoDB.
- **LocationIQ** — reverse geocoding (GPS → address). Called by **Sentinel** when processing positions.

---

## 6. Domain Knowledge (deep-dives in `docs/`)
Read on demand when fine-grained business logic matters:
- **Data flows (canonical sequence diagrams)**: `docs/flows.md`
- **Entity model**: `docs/entities-and-relations.md`
- **Auth**: `docs/auth/` (signup/login, JWT revocation)
- **Registration (user / pet / device)**: `docs/registration/`
- **Subscriptions deep-dive**: `docs/subscriptions/`
- **Device modes & commands**: `docs/modes/`, `docs/commands/`
- **End of life**: `docs/end-of-life/`
- **Data migration**: `docs/migration/migration.md`

---

## 7. AI Agent Debugging & Troubleshooting Rules
When an API call fails or a test breaks, **DO NOT make assumptions, guess the cause, or suggest blind fixes**. You must autonomously investigate by following these steps:

1. **Inspect Backend Logic**: Locate and read the actual AWS Lambda resolver or backend service code (in `petlink-everywhere-core`, `petlink-everywhere-cct-core`, or `subscriptions-manager`) that handles the failing API. Analyze exactly how the payload is processed, validated, and where the error is thrown.
2. **Verify Frontend/App Usage**: Search the frontend or mobile repositories (`petlink-everywhere-web`, `petlink-everywhere-mobile`, or `petlink-everywhere-cct`) to see how the user or CCT operator actually calls this endpoint in the real application flow.
3. **Compare Flows**: Compare the exact GraphQL/REST request (payload, headers, sequence of operations) made by the real client with the one being made in the failing test suite. Identify any missing or malformed parameters.
4. **Trace the Architecture**: If necessary, follow the data flow through AppSync, SQS queues, MongoDB or all of necessary microservices to understand the exact state of the system during the request.
5. **Trce the Data and Logs**: If some test break in local, you have access to mcp of Dev & Test env of Grafana, Mongo and ChargeBee, inspect yourself logs, data on Dbs and on Chargebee data to understand clearly also what's really happened under the hood on the backend system.
