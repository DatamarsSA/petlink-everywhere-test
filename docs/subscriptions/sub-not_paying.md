# Subscription Flow — NOT_PAYING (addFreePeriod)

> Free period added by a CCT operator. No Chargebee involvement. Subscription lives entirely in Mongo.

---

## 1. Entrypoint

- **CCT mutation**: `addFreePeriod(freePeriod, productId?, serialNumber?)`
  - `authJwt` + SUPERADMIN/L2 role.

---

## 2. Free period enum

```text
ADD_7_DAYS   → 7 days
ADD_14_DAYS  → 14 days
ADD_30_DAYS  → 30 days
ADD_60_DAYS  → 60 days
ADD_90_DAYS  → 90 days
ADD_1_YEAR   → 365 days
```

---

## 3. Flow A — Device WITHOUT subscription

```text
1. CCT receives addFreePeriod with productId OR serialNumber
2. If no existing active subscription found:
   → createFreeTrialSubscription()
      * Creates SUBSCRIPTION locally:
        - businessEntityId = "DATAMARS"
        - status = "in_trial"
        - chargebeeSubscriptionId = subscriptionId (self-referencing, no Chargebee)
        - billingPeriod = N (days from enum)
        - billingPeriodUnit = "days"
        - subscriptionItems = [{ itemType:"plan", itemId:"NON_PAYING", amount:0, unitPrice:0 }]
        - addedFreePeriod = N
        - currentTermStart = now, currentTermEnd = now + N days
      * Creates INVOICE locally:
        - status = "non_paying"
        - total = 0
        - items = [{ itemType:"plan", description:"Non Paying Subscription", amount:0 }]
      * If productId provided: links PetlinkGps.subscriptionId
```

### Mongo entities

| Entity | Key fields |
|---|---|
| `SUBSCRIPTION` | `businessEntityId="DATAMARS"`, `status="in_trial"`, `chargebeeSubscriptionId=<self>`, `addedFreePeriod`, `subscriptionItems` with NON_PAYING plan |
| `INVOICE` | `status="non_paying"`, `total=0`, items with description="Non Paying Subscription" |
| `PETLINK_GPS` | `subscriptionId` (linked if productId provided) |

---

## 4. Flow B — Device WITH active subscription

```text
1. CCT finds the latest subscription by currentTermEnd
2. evaluateFreePeriod(currentTermEnd, freePeriod) → newEndDate
3. If subscription.businessEntityId !== "DATAMARS" (Chargebee managed):
   → sdkSSM.changeTermEnd({ subscriptionId: chargebeeSubscriptionId, newTermEnd })
   → Chargebee term extended
4. If subscription.businessEntityId === "DATAMARS" (local free period):
   → upsertItemById({ currentTermEnd: newEndDate, updateDate: now })
5. In both cases:
   → addedFreePeriod += N days
```

### Constraints

- Extends the **existing** subscription; does NOT create a new one.
- For Chargebee subs, `changeTermEnd` is called on SM.
- For DATAMARS subs, DB update is direct.

---

## 5. Final states

| Scenario | status | paymentStatus | businessEntityId | chargebeeSubscriptionId |
|---|---|---|---|---|
| No prior sub | `in_trial` | `PENDING` (default) or absent | `DATAMARS` | self UUID |
| Extending Chargebee sub | unchanged | unchanged | e.g. `KIPPYEU` | real CB id |
| Extending DATAMARS sub | unchanged | unchanged | `DATAMARS` | self UUID |

---

## 6. Reference files

- `@/all-repo/petlink-everywhere-cct-core/src/lambda_functions/graphql/mutation/addFreePeriod/handler.ts:239-423`
- `@/all-repo/petlink-everywhere-cct-core/src/lambda_functions/graphql/mutation/addFreePeriod/handler.ts:115-237` (createFreeTrialSubscription)
