# Bug: Subscription reactivated in Chargebee but status remains "cancelled" in MongoDB/CCT

## Jira Ticket
- **Ticket**: PRTSUP-704
- **Priority**: Highest
- **Reporter**: Christian Prete
- **Created**: 2026-08-18T12:21:14+0200
- **Summary**: [PROD]-[KIPPY]: SUBSCRIPTION ISSUE

## Affected User
- **Name**: Luigino Poli
- **Email**: simona.ronca@yahoo.it (contact email), poli.luigino@gmail.com (account email)
- **MongoDB User ID**: 53b51010-6e28-4006-a752-b505cb4a5649
- **Chargebee Customer ID (migrated)**: KPY-86829
- **Chargebee Customer ID (prepaid)**: KPY-PPD-584542
- **Device Serial**: AJXHTA2
- **Chargebee Subscription ID**: KPY-SUB-92927
- **Environment**: EU (KIPPY), PROD

## Incident Date
- **Reactivation by support**: 2026-08-18 ~10:16 UTC (12:16 CEST)
- **Ticket created**: 2026-08-18T12:21:14+0200

## Observed Behaviour
Customer was in dunning, subscription was cancelled. On August 7th the customer paid but Chargebee status remained cancelled. On August 18th, support reactivated the subscription in trial mode (start: Aug 7th, end: Aug 6th 2027) via Chargebee admin console. However, CCT still shows the subscription as "cancelled".

## Relevant Logs

### Subscriptions Manager Webhook Lambda (prod)
- **Event 1**: `subscription_reactivated_with_backdating` (ev_19AKPLVSdsBbU1LbS) at 2026-08-18T10:16:53Z
  - **NOT HANDLED** — log: `event_type not supported: "subscription_reactivated_with_backdating"`
  - Source: `admin_console`, user: `christian.prete@datamars.com`
  - Subscription status in payload: `in_trial`

- **Event 2**: `subscription_reactivated` (ev_19AKPLVSdsBaM1LbR) at 2026-08-18T10:16:53Z
  - **Handled correctly** — routed to `subscriptionChangedHandler`
  - Built `ChargebeeSubscriptionChanged` payload with `status: "in_trial"`, `userId: "KPY-PPD-584542"`
  - Sent to SQS queue `DatamarsPetlinkEverywhereCoreProd-subscriptionsWebhookQueue.fifo`

### Core subsWebhookQueueConsumer (prod)
- SQS message received at ~2026-08-18T10:17:00Z
- `findOneAndUpdate` result 1 (earlier timestamp): prepaid subscription `314ab153-b8a8-427d-88de-95fefefe7a7a` — **updated to `in_trial`**, `updateDate: 2026-08-18T10:17:00.535Z`
- `findOneAndUpdate` result 2 (later timestamp): migrated subscription `bc27e764-6cd6-4cbb-94b6-94f88fccce49` — **still `cancelled`**, only `$unset` on `scheduledChanges` was applied

## Relevant MongoDB State

Two subscription documents exist for `chargebeeSubscriptionId: "KPY-SUB-92927"`:

### Document 1 — Migrated subscription (NOT updated)
- `_id`: 6a251b38ca3b1641647fd361
- `id`: bc27e764-6cd6-4cbb-94b6-94f88fccce49
- `userId`: 53b51010-6e28-4006-a752-b505cb4a5649 (MongoDB user ID)
- `status`: **cancelled**
- `paymentStatus`: FAILED
- `dunningStatus`: in_progress
- `dunningAttempts`: 4 failures (Jul 29 – Aug 4)
- `currentTermEnd`: 2026-08-04T22:19:06.099Z
- `updateDate`: 2026-08-13T13:33:56.257Z
- `isPrepaid`: true

### Document 2 — Prepaid subscription (UPDATED by webhook)
- `_id`: 69afe9d4746e0bc36f5c8a7c
- `id`: 314ab153-b8a8-427d-88de-95fefefe7a7a
- `userId`: KPY-PPD-584542 (Chargebee customer ID, NOT MongoDB user ID)
- `status`: **in_trial** (updated by webhook consumer)
- `cancelledAt`: 2026-08-13T13:34:06.757Z
- `currentTermEnd`: 2026-08-12T21:59:59.000Z (NOT updated — `updateSubscriptionTerms` was false because `findItem` found the cancelled subscription)
- `updateDate`: 2026-08-18T10:17:00.535Z
- `isPrepaid`: true
- `creationDate`: 2026-03-10T09:48:18.099Z

## Root Cause

**Duplicate subscription documents** for the same `chargebeeSubscriptionId` in MongoDB.

The `subscriptionChangedHandler` in Core uses a filter:
```javascript
const subscriptionFilter = {
    chargebeeSubscriptionId: chargebeeSubscriptionId,
    entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
    status: { $ne: SubscriptionStatusEnum.Enum.closed },
};
```

This filter matches **both** subscription documents. The `findOneAndUpdate` function (which uses MongoDB's native `findOneAndUpdate` with no sort) updates only the **first** document MongoDB returns in natural order. In this case, it updated the prepaid subscription (`314ab153...`, userId: `KPY-PPD-584542`) instead of the migrated subscription (`bc27e764...`, userId: `53b51010-6e28-4006-a752-b505cb4a5649`).

The CCT queries subscriptions by the MongoDB user ID (`53b51010...`), so it sees the migrated subscription which is still `cancelled`.

Additionally, `findItem` (called before `findOneAndUpdate` to check `updateSubscriptionTerms`) found the migrated subscription (status: `cancelled`), so `updateSubscriptionTerms` was set to `false`, meaning `currentTermStart` and `currentTermEnd` were not updated even on the prepaid subscription that was updated.

### Secondary issue
The `subscription_reactivated_with_backdating` event type is **not handled** by the webhook handler in subscriptions-manager. However, the `subscription_reactivated` event was handled correctly, so this is not the primary cause. The backdating event carries the same subscription data.

## Code Files and Functions Involved

### subscriptions-manager (prod: `c6ee9bb`, v2.3.10)
- `src/lambdaFunctions/webhook/operations/post/webhook.ts` — webhook handler switch statement
  - Line 109: `subscription_reactivated` is handled (falls through to `subscriptionChangedHandler`)
  - **Missing**: `subscription_reactivated_with_backdating` is NOT in the switch — falls to `default` and is dropped
- `src/lambdaFunctions/webhook/operations/post/webhookHandlers/builder.ts` — `chargebeeSubscriptionChangedBuilder` (line 214)
- `src/lambdaFunctions/webhook/operations/post/webhookHandlers/subscriptionChangedHandler.ts` — builds payload and sends to SQS

### petlink-everywhere-core (prod: `f4a3cc67`, v2.3.46)
- `src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/handler.ts` — SQS consumer
  - Line 396: `subscription_reactivated` routed to `subscriptionChangedHandler`
  - Line 155: `getUserIdByChargebeeUserId("KPY-PPD-584542")` — may not find the migrated user (chargebeeId is `KPY-86829`)
- `src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionChangedHandler.ts` — **KEY FILE**
  - Line 86-90: `subscriptionFilter` matches both documents (no `userId` in filter)
  - Line 93-97: `findItem` found the migrated subscription (status: `cancelled`)
  - Line 100-103: `updateSubscriptionTerms = false` because status is `cancelled`
  - Line 105-126: `findOneAndUpdate` updated the prepaid subscription (not the migrated one)
- `src/lib/mongoDb/crud.ts` — `findOneAndUpdate` (line 35)
  - Uses `upsert: true`, `returnDocument: AFTER`, no sort — updates first matching document

## Evidence and Reasoning

1. **Webhook received and processed**: Grafana logs confirm both `subscription_reactivated` and `subscription_reactivated_with_backdating` events were received. The `subscription_reactivated` event was handled and sent to SQS.

2. **SQS message consumed**: Core consumer received the SQS message and processed it.

3. **Two subscription documents**: MongoDB query confirms two documents with `chargebeeSubscriptionId: "KPY-SUB-92927"` and `entityType: "SUBSCRIPTION"`.

4. **Wrong document updated**: Consumer logs show `findOneAndUpdate` returned the prepaid subscription (`314ab153...`) with `status: "in_trial"` and `updateDate: 2026-08-18T10:17:00.535Z`, while the migrated subscription (`bc27e764...`) remained `cancelled`.

5. **CCT shows migrated subscription**: CCT queries by MongoDB user ID, finding the cancelled migrated subscription.

## Proposed Fix

### Immediate (data fix)
Remove or merge the duplicate prepaid subscription document (`314ab153...`) and update the migrated subscription (`bc27e764...`) to `status: "in_trial"` with the correct term dates from the Chargebee webhook payload.

### Code fix (prevent recurrence)
1. **`subscriptionChangedHandler.ts`**: Add `userId` to the `subscriptionFilter` to ensure only the correct subscription document is updated. The `userId` from the webhook payload (`body.userId`) should be resolved to the MongoDB user ID and used in the filter.

2. **Alternatively**: Use `updateMany` instead of `findOneAndUpdate` to update all matching documents, or add a unique index on `chargebeeSubscriptionId` for `entityType: "SUBSCRIPTION"` to prevent duplicates.

3. **`webhook.ts` (subscriptions-manager)**: Add `subscription_reactivated_with_backdating` to the switch statement (fall through to `subscriptionChangedHandler` same as `subscription_reactivated`).

4. **Investigate root cause of duplicate**: Determine why two subscription documents were created for the same Chargebee subscription. The prepaid subscription was created on `2026-03-10` while the migrated subscription was created on `2025-07-29` (migration date). This suggests the prepaid flow created a new subscription document instead of updating the existing migrated one.

## Remaining Uncertainty
- Why exactly were two subscription documents created? The prepaid subscription (`314ab153...`) has `creationDate: 2026-03-10T09:48:18.099Z` and `userId: "KPY-PPD-584542"` (Chargebee customer ID). This suggests a prepaid flow created a separate document. Need to investigate the prepaid subscription creation flow.
- Whether `getUserIdByChargebeeUserId("KPY-PPD-584542")` returned the correct MongoDB user ID or null. If it returned null, the `checkAcceptedEvents` function still accepted the event because a subscription with that `chargebeeSubscriptionId` exists in the DB.
