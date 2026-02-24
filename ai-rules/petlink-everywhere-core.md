---
trigger: model_decision
description: Apply when debugging or writing tests for petlink-everywhere-core, user/pet/device registration, or SQS consumers.
globs: 
---

# petlink-everywhere-core (Main API)

## Folder Navigation
Every GraphQL endpoint is one Lambda function:
```
src/lambda_functions/graphql/
  mutation/{operationName}/handler.ts   ← e.g. createPetlinkGps, sendCommand, signUpUser
  query/{operationName}/handler.ts      ← e.g. getUser, getGeofences, getSubscriptionPlans
```

**Business logic layer** (where most bugs live):
```
src/lib/petlink/
  user.ts            ← createPetlinkUser, getUserFromCognito
  pet.ts             ← createPetlinkPet (validates breeds, colors, weight g→kg conversion)
  petlinkGps.ts      ← createPetlinkGps, checkPetlinkGps (inventory whitelist), checkPetAlreadyLinked
  subscriptions.ts   ← checkDeviceSubscription, findProduct, calculateAndSetNewTermEnd
```
**Handler pattern**: `handler.ts → createAppSyncHandler() → getUserFromCognito() → business logic in lib/petlink/*.ts → MongoDB via lib/mongoDb/crud.ts`

## SQS Consumers (Async Data)
Located in `src/lambda_functions/` of Core (not in Sentinel):
- `sentinel/gpsMessagesConsumer/handler.ts` — GPS positions → MongoDB + publishes via `publishOnGpsMessagePosition`
- `sentinel/notificationsConsumer/handler.ts` — Push/SMS/email via Firebase/Twilio/SendGrid
- `sentinel/activitiesConsumer/handler.ts` — Pet activity data
- `subscriptions/subscriptionsWebhookConsumer/handler.ts` — Chargebee events from subscriptions-manager
- `subscriptions/subscriptionExpiredChecker/handler.ts` — Scheduled: checks expired subs

> **`publishOn*` mutations**: Special mutations that don't write to DB. They only trigger AppSync WebSocket subscriptions so connected clients receive real-time updates.

## MongoDB Structure
Single main collection `petlinkEverywhere` with `entityType` discriminator (`USER`, `PET`, `PETLINK_GPS`, `SUBSCRIPTION`, etc.). 

Separate collection `petlinkGpsInventory` is the **device whitelist/inventory**: maps serial → imei, iccid, model, brand, firmware, simStatus. If a serial is not in this collection, `createPetlinkGps` fails with **428**. Firmware is populated async by Sentinel.

## Authentication & Test Setup
User signup (`signUpUser`) creates the user in **AWS Cognito** + MongoDB. Normal flow requires OTP (Twilio) + email verification.

**`utilityIntegrationTest`** (Test-only endpoint, IAM auth):
- `SIGN_UP` — Creates user in Cognito + MongoDB, auto-confirms email and phone (no OTP needed)
- `CLEAN_UP_USER` — Deletes user from Cognito + all MongoDB entities
- `BUY_NEW_SUBSCRIPTION` — Purchases subscription bypassing Chargebee hosted page