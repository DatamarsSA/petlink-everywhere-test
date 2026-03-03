---
trigger: model_decision
description: Apply when working on petlink-everywhere-cct-core, customer care features, support tool tests, or querying customer data from the admin side.
globs: 
---

# petlink-everywhere-cct-core (Customer Care API)

> **Domain Knowledge Note:** For the business logic of how the CCT flow operates and proxies requests, read `docs/api_cct.md` and the CCT Flow section in `docs/petlnk-infrastructure.md`.

## Folder Navigation
Same as Core: Every GraphQL endpoint is a Lambda function.
```
src/lambda_functions/graphql/
  mutation/{name}/handler.ts
  query/{name}/handler.ts
```

## Dual Database Architecture
CCT-core has a `MongoDbSingleton` with **two distinct connections**:
- `'PETLINK'`: Reads directly from the Core's MongoDB (customer data, devices, subscriptions, inventory).
- `'CCT'`: Reads/writes its own separate CCT DB (CCT users, activity logs, issues, tickets).

**Important Queries**: `getCustomer`, `getDevices`, etc. read the Petlink MongoDB **directly** — there is no proxy to Core for these queries.

### `getDevices` Aggregation Pipeline
To return device info, CCT uses a MongoDB **aggregation pipeline** that JOINs the main `petlinkEverywhere` collection (`entityType=PETLINK_GPS`) with the `petlinkGpsInventory` collection. 
This provides `imei`, `iccid`, and `firmware`. In tests, when calling `enrich()`, we poll `getDevices` waiting for the firmware to be populated in the inventory by Sentinel.

## Cross-Repo Proxying (Mutations)
For write operations, CCT acts as a proxy:
- Calls Core GraphQL API via `sdkCore` for **mutations** (e.g., `deleteCustomer`, `resetPetlinkGps`, `hidePet`, `logEnabled`, `updateCustomer`).
- Calls subscriptions-manager via `sdkSM` for subscription operations (e.g., `refundInvoice`, `stopRenewing`, `getCoupons`).
- After proxying, it logs the support action in the CCT MongoDB for audit trails.