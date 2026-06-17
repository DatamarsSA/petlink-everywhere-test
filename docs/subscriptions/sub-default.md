# Subscription Flow — DEFAULT

> Standard paid subscription via Chargebee. Covers buy, change plan, renew, stop renew, refund.

---

## 1. Buy (new subscription)

### Entrypoints

- **App/Web**: `checkoutNewSubscription` GraphQL query (`authJwt`).
- **Test bypass**: `utilityIntegrationTest(BuyNewSubscription)` (`authIam`).

### Flow

```text
1. getCheckoutData()
   - Reads PetlinkGps and GpsInventory
   - Resolves planProfile from inventory.planProfileId (falls back to DEFAULT)
   - Determines: paymentMethodRequired, trialTermEnd, couponId, businessEntity
   - If a current subscription exists, resolves chargebeeSubscriptionId for plan change

2. If paymentMethodRequired === false:
     → sdk.createNewSubscription() (SM) → Chargebee creates sub without payment method
   Else if currentSubscriptionId exists:
     → sdk.changeSubscriptionPlan() (SM) → hosted page for plan change
   Else:
     → sdk.checkoutNewSubscription() (SM) → hosted page for new sub

3. Chargebee emits webhook subscription_created
   → SM normalizes → SQS subscriptionsWebhook
   → Core: subscriptionCreatedHandler.ts
      → handlerNewSubscription()
         - Upserts Subscription doc (status from Chargebee, paymentStatus=PENDING)
         - If trial: paymentStatus=SUCCEEDED
         - If productId known: linkToDevice() → sets PetlinkGps.subscriptionId
         - If payment_succeeded webhook already arrived: paymentStatus=SUCCEEDED

4. Chargebee emits webhook payment_succeeded
   → Core: paymentSucceededHandler.ts
      → handlerNewSubscription() again (paymentStatus=SUCCEEDED)
      → linkToDevice() if not already linked
      → Sends notification push/email: ACTIVE_SUBSCRIPTION
      → publishOnSubscriptionStatus (AppSync WebSocket)
      → Sets inventory.subscriptionActive = true
      → SQS expiredSubscriptions → Sentinel (subscription_active=true)
```

### Mongo entities created / updated

| Entity | Key fields |
|---|---|
| `SUBSCRIPTION` | `chargebeeSubscriptionId`, `status`, `paymentStatus`, `subscriptionItems`, `currentTermStart/End`, `nextBillingAt` |
| `PETLINK_GPS` | `subscriptionId` (link) |
| `INVOICE` | Created by webhook `invoice_updated` |

### Reference

- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkoutNewSubscription/handler.ts:40-140`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkoutNewSubscription/checkoutUtil.ts:45-178`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/utils.ts:255-405`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/paymentSucceededHandler.ts`

---

## 2. Change Plan (upgrade/downgrade)

### Entrypoint

- `changeSubscriptionPlan` GraphQL query.

### Flow

```text
1. Core checks: no blocking subscriptions (future or with scheduledChanges) on the device
2. If currentSubscriptionId exists:
     → sdk.changeSubscriptionPlan() (SM) → Chargebee schedules change for next term
3. Webhook subscription_changed → Core:
   - Updates status, billingPeriod/Unit, nextBillingAt
   - Sets scheduledChanges blob (from Chargebee retrieveWithScheduledChanges)
4. When term ends, Chargebee activates the scheduled plan
   - Webhook subscription_activated / subscription_started
   - Core: changePlanHandler() stops the old subscription via SM
```

### Constraints

- Only **one** scheduled change at a time. Second attempt returns error.
- Current sub stays active/unchanged until term end.

### Reference

- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/changeSubscriptionPlan/handler.ts:120-149`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionChangedHandler.ts:128-145`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/utils.ts:407-433`

---

## 3. Automatic Renew

### Flow

```text
1. Chargebee attempts renewal at next_billing_at
2. If payment succeeds:
   → webhook payment_succeeded + subscription_renewed
   → Core updates currentTermStart/End, creates new INVOICE
3. If payment fails:
   → webhook payment_failed
   → Core: dunningStatus populated, dunningAttempts appended
   → paymentStatus=FAILED
   → Term does NOT shift (currentTermEnd unchanged)
```

### Reference

- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/paymentFailedHandler.ts`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionRenewedHandler.ts`

---

## 4. Stop Renew

### Entrypoint

- `stopRenewingSubscription` GraphQL mutation (`authJwt`).

### Flow

```text
1. Core validates subscription is NOT payment pending
2. If subscription.status is active or in_trial:
   - If businessEntityId !== 'DATAMARS' (Chargebee managed):
       * calculateFee() → may apply charges + changeTermEnd
       * sdk.stopRenewingSubscription() (SM) → Chargebee non_renewing
   - If DATAMARS (free period/insurance): DB update only, no Chargebee call
3. If scheduledChanges exists:
   → Sets status=to_stop_renew, nextBillingAt=null (does NOT call Chargebee)
4. Sends push/email notification OFF_SUBSCRIPTION
```

### Final state

- `status=non_renewing` (or `to_stop_renew` if scheduled changes)
- `nextBillingAt=null`
- `currentTermEnd` unchanged (subscription active until term end)

### Reference

- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/mutation/stopRenewingSubscription/handler.ts:58-230`

---

## 5. Refund

### Entrypoint

- `refundInvoice` GraphQL mutation from CCT (`authJwt`, SUPERADMIN/L2).

### Flow

```text
1. CCT: handleRefund()
   - Finds INVOICE and linked SUBSCRIPTION (or PET_PROTECTION)
   - Validates refund amount ≤ refundable amount (invoice item - credit notes - discounts)
   - If subscription is future (status=future / to_stop_renew_addon):
       * Requires FULL refund of plan + addon items
       * Merges future refunds into single plan_item_price refund
   - Sorts refunds alphabetically by itemType (plan last)

2. For each refund item:
   → sdkSsm.refundInvoice() (SM) → Chargebee credit note
   → Generates local CREDIT_NOTE doc in Mongo

3. If refunding a charge_item_price (pet protection):
   → Sets PetProtection.status=REFUNDED, currentTermEnd=now
   → Removes petProtectionId from PET
```

### Reference

- `@/all-repo/petlink-everywhere-cct-core/src/lib/petlink/refund.ts:134-509`

---

## 6. Dunning (failed renew)

When a renew fails, Chargebee enters dunning:
- Core receives `payment_failed` webhook.
- `paymentStatus=FAILED`, `dunningStatus` and `dunningAttempts` populated.
- `nextPaymentRetryAt` set.
- If all retries fail, Chargebee cancels the subscription (`subscription_cancelled`).

### Reference

- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/paymentFailedHandler.ts`
