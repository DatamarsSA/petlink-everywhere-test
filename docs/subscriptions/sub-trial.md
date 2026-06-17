# Subscription Flow — TRIAL

> Subscription with an initial trial period before billing starts. Driven by `planProfileType: TRIAL` in `petlinkGpsInventory`.

---

## 1. Plan profile definition

`PlanProfileInventory` in `petlinkGpsInventory` collection:

```text
planProfileType: "TRIAL"
paymentMethodRequired: boolean   (usually true, user still adds card)
startingPlans: string[]          // plan IDs available at first purchase
upgradePlans: string[]           // plan IDs available when changing
trialDuration: number            // in days
saveOnChargebee: boolean
```

Known profiles:
- `TRIAL_1_MONTH` → ~30 days trial, any plan types allowed
- `ESSELUNGA` → ~365 days trial, **only yearly** plans allowed

---

## 2. Entrypoint

- `getSubscriptionPlans` → returns `trialDuration` in response
- `checkoutNewSubscription` → passes `trialTermEnd` to SM

---

## 3. Flow

```text
1. getCheckoutData()
   - Reads planProfile from GpsInventory
   - If trialDuration exists and no current subscription:
       * trialTermEnd = now + trialDuration days
   - paymentMethodRequired from planProfile (true for TRIAL profiles tested)

2. checkoutNewSubscription (SM)
   - Chargebee creates subscription with trial_start / trial_end
   - User still goes through hosted page (card required)

3. Webhook subscription_created → Core
   - handlerNewSubscription()
   - status = "in_trial"
   - paymentStatus = "SUCCEEDED" (no immediate charge)
   - trialStart / trialEnd populated
   - linkToDevice() called

4. Webhook payment_succeeded may also arrive
   - Reinforces paymentStatus=SUCCEEDED

5. Subscription state:
   - currentTermStart == trialStart
   - currentTermEnd == trialEnd
   - nextBillingAt == trialEnd (first payment scheduled at trial end)
   - invoices = null (no invoice until trial ends and first charge occurs)
```

---

## 4. Plan availability

- `ESSELUNGA`: only yearly plans (`periodUnit === "year"`)
- `TRIAL_1_MONTH`: multiple plan types (monthly + yearly)

---

## 5. Mongo entities

| Entity | Key fields |
|---|---|
| `SUBSCRIPTION` | `status="in_trial"`, `paymentStatus="SUCCEEDED"`, `trialStart`, `trialEnd`, `nextBillingAt` |
| `INVOICE` | None until trial ends |
| `PETLINK_GPS` | `subscriptionId` linked |

---

## 6. Reference files

- `@/all-repo/petlink-everywhere-core/src/lib/types/petlinkGpsInventory.ts:117-143` (PlanProfileInventory schema)
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkoutNewSubscription/checkoutUtil.ts:110-124` (trialTermEnd calculation)
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/utils.ts:348-354` (trial paymentStatus logic)
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionCreatedHandler.ts:131-153` (trialStart/trialEnd update)
