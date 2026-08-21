# PRTSUP-751: Subscription PLG-HP-9260 not linked in new CCT

## Summary

User Cheryl Fonda (`jcfonda@outlook.com`, legacyId `185259`) purchased a subscription for device `APADTKA` on Aug 14, 2026 — minutes after her migration to the new system completed. The purchase created a **new Chargebee customer** (`PLG-PPD-583718`) instead of using the existing migrated customer (`PLG-86613`). This caused all webhook events for subscription `PLG-HP-9260` to be **rejected** by the Core `subsWebhookQueueConsumer`, so the subscription was never created in MongoDB and never linked to the device in CCT.

## Timeline

| Time (UTC) | Event |
|---|---|
| Aug 14 16:51:26 | Migration starts for user 185259 |
| Aug 14 16:51:42 | Subscription migration runs. Chargebee API returns only `PLG-HP-7485` (serial `APK3XFF`) for customer `PLG-86613`. No subscription for `APADTKA` exists yet. |
| Aug 14 16:51:45 | Subscription migration completes: 1 sub, 1 invoice migrated. |
| Aug 14 16:59:16 | **New Chargebee customer `PLG-PPD-583718` created** (same email, different customer ID) |
| Aug 14 16:59:20 | Subscription `PLG-HP-9260` created under `PLG-PPD-583718` via hosted page. `cf_DM_Serial_Number` = `"PREPAID"`. |
| Aug 14 16:59:30 | All 6 webhook events (subscription_created, payment_succeeded, invoice_generated, invoice_updated, customer_changed x2) arrive at Core `subsWebhookQueueConsumer`. **All rejected**: "Event for userId PLG-PPD-583718 not accepted." |
| Aug 19 12:29:30 | Support agent (christian.prete@datamars.com) manually updates `PLG-HP-9260` in Chargebee admin: changes `cf_DM_Serial_Number` from `"PREPAID"` to `"APADTKA"`. `subscription_changed` webhook also rejected. |
| Aug 19 19:41:14 | A new `checkoutNewSubscription` request is made via subscriptions-manager using correct customer `PLG-86613` for serial `APADTKA`. |

## Root Cause

The `subsWebhookQueueConsumer` handler in Core processes webhook events from Chargebee via SQS. For each event:

1. It calls `getUserIdByChargebeeUserId(body.userId)` — which looks up a MongoDB USER with `chargebeeId === body.userId` (`@/all-repo/petlink-everywhere-core/src/lib/petlink/user.ts:347-362`)
2. If no user is found, `userId` falls back to the raw Chargebee customer ID
3. It then calls `checkAcceptedEvents(businessEntityId, user, type, chargebeeId)` (`@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/handler.ts:110-146`)

The `checkAcceptedEvents` guard:
- Returns `true` if `user` is found in MongoDB
- If `user` is null AND `businessEntityId` is in `CHECK_ACCEPTED_EVENTS_BUSINESS_ENTITY_IDS` (`DMINC_KIPPY`, `DMDS_KIPPY`, `DMHQ_KIPPY`):
  - For `SUBSCRIPTION` events: checks if a SUBSCRIPTION entity with `chargebeeSubscriptionId` exists in MongoDB
  - For `USER` events: returns `false`
  - If not found → **rejects the event** (logs error, `continue`)

In this case:
- `body.userId` = `"PLG-PPD-583718"` (the new Chargebee customer)
- MongoDB user has `chargebeeId: "PLG-86613"` (the migrated customer)
- No user with `chargebeeId: "PLG-PPD-583718"` exists → `user` = null
- `businessEntityId` = `"DMINC_KIPPY"` → guard is active
- No SUBSCRIPTION with `chargebeeSubscriptionId: "PLG-HP-9260"` in MongoDB → **all events rejected**

**The subscription_created event** (which would have created the subscription in MongoDB) was rejected because it uses type `'USER'` (line 376-381), and no user was found. **The payment_succeeded event** (which would have created the subscription via `handlerNewSubscription`) was also rejected because it uses type `'USER'` (line 193-198). This is a chicken-and-egg problem: the subscription can't be created because the user doesn't exist, and the user can't be found because the Chargebee customer ID doesn't match.

## Why a New Chargebee Customer Was Created

The subscription was purchased via a hosted page checkout (`source: "hosted_page"` in the webhook). The hosted page checkout flow (`checkoutNewSubscription` query in subscriptions-manager) retrieves the Chargebee customer by `userId`:

```typescript
// subscriptions-manager/src/lambdaFunctions/graphql/queries/checkoutNewSubscription/handler.ts:53-54
const retriveCustomerResponse = await chargebeeClient.customer.retrieve(userId);
customer = retriveCustomerResponse.customer;
```

If the web app passed the wrong `userId` (e.g. a Cognito sub or a new customer ID instead of the migrated `chargebeeId`), or if the user completed checkout without being logged in as the migrated user, Chargebee would create a new customer. The hosted page flow creates a new customer if the provided `customer.id` doesn't match an existing one.

The new customer `PLG-PPD-583718` has:
- Same email: `Jcfonda@outlook.com`
- Same name: Cheryl Fonda
- Same address: 195 King Hill Rd, Landaff
- Different phone: `+15185881302` (vs `+15188789788` in MongoDB)
- Different state: `NY` (vs `US_NH` in MongoDB)

This suggests the user entered slightly different billing information during checkout, which may have triggered a new customer creation.

## MongoDB State

**User** (`petlinkEverywhere`):
- `id`: `20e217d7-e3d9-4e15-958d-44efe28cb4ba`
- `chargebeeId`: `PLG-86613`
- `email`: `jcfonda@outlook.com`
- `legacyId`: `185259`
- `migrated`: `true`

**Device PETLINK_GPS** (APADTKA):
- `id`: `07e38dac-94a2-4d64-a4d2-aef5fb4fc42b`
- `serialNumber`: `APADTKA`
- `subscriptionId`: `ad718507-131d-4e15-a488-e7b3f95a8285`

**Subscription for APADTKA** in MongoDB:
- `id`: `ad718507-131d-4e15-a488-e7b3f95a8285`
- `chargebeeSubscriptionId`: `199NcgVSm0nK23oDS`
- `serialNumber`: `APADTKA`
- `status`: `active`

> Note: `199NcgVSm0nK23oDS` does not match `PLG-HP-9260`. This subscription was likely created by a separate checkout attempt (Aug 19 19:41) using the correct customer `PLG-86613`. The `retrieve_subscription` call for `199NcgVSm0nK23oDS` returned "resource not found" — possibly because it belongs to a different Chargebee site or was cancelled.

**Subscription for APK3XFF** (migrated):
- `id`: `e14f95b7-0b49-4228-ac32-e89ddba2a7b4`
- `chargebeeSubscriptionId`: `PLG-HP-7485`
- `serialNumber`: `APK3XFF`
- `status`: `active`

## Chargebee State

**Customer `PLG-86613`** (migrated):
- Has subscription `PLG-HP-7485` (APK3XFF, 2-year, active)

**Customer `PLG-PPD-583718`** (created during checkout):
- Has subscription `PLG-HP-9260` (APADTKA after manual update, 1-year, active)
- Invoice `INC188372` (paid, $99.00 USD)

## Impact

- Subscription `PLG-HP-9260` is active and paid in Chargebee but **not reflected in MongoDB** or CCT
- The device `APADTKA` shows as having subscription `199NcgVSm0nK23oDS` in MongoDB, which may not exist in Chargebee
- Support agents cannot manage the subscription through CCT
- The user may be double-charged if both subscriptions are active

## Fix Options

### Option 1: Merge Chargebee customers (recommended)
Merge customer `PLG-PPD-583718` into `PLG-86613` in Chargebee admin. This will move subscription `PLG-HP-9260` under the correct customer. Then trigger a webhook replay or manually create the subscription entity in MongoDB.

### Option 2: Update MongoDB user's chargebeeId
Update the user's `chargebeeId` in MongoDB from `PLG-86613` to `PLG-PPD-583718`. This would allow webhook events to be accepted, but would break the existing subscription `PLG-HP-7485` (APK3XFF) which is under `PLG-86613`. Not recommended.

### Option 3: Manual data fix
1. Cancel/clean up subscription `199NcgVSm0nK23oDS` in MongoDB if it doesn't exist in Chargebee
2. Create a new SUBSCRIPTION entity in MongoDB for `PLG-HP-9260` linked to user `20e217d7-e3d9-4e15-958d-44efe28cb4ba` and device `APADTKA`
3. Update the device's `subscriptionId` to point to the new entity
4. Replay webhook events or manually trigger `subscriptionCreatedHandler`

## Code References

- **Webhook consumer guard**: `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/handler.ts:110-146`
- **User lookup by Chargebee ID**: `@/all-repo/petlink-everywhere-core/src/lib/petlink/user.ts:347-362`
- **Subscription created handler**: `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionCreatedHandler.ts`
- **Payment succeeded handler**: `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/paymentSucceededHandler.ts`
- **Checkout query (hosted page)**: `@/all-repo/subscriptions-manager/src/lambdaFunctions/graphql/queries/checkoutNewSubscription/handler.ts`
- **Checkout V2 (API)**: `@/all-repo/subscriptions-manager/src/lambdaFunctions/graphql/mutations/checkoutNewSubscriptionV2/handler.ts`

## Bug Classification

**New bug** — not previously documented. The root cause is a **customer ID mismatch** between the migrated Chargebee customer and a new customer created during a post-migration hosted page checkout. The `checkAcceptedEvents` guard correctly rejects events for unknown users, but there is no recovery path for subscriptions created under a wrong customer ID.

## Related Tickets

- PRTSUP-750 (device reassigned) — similar pattern of data inconsistency after migration
