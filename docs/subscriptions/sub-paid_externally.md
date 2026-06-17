# Subscription Flow — PAID_EXTERNALLY (Insurance)

> Subscription fully paid by a third party (e.g. insurance partner like AXA or EuropAss). No Chargebee involvement. Subscription is auto-created in Mongo at device registration.

---

## 1. Plan profile definition

`PlanProfileInventory` in `petlinkGpsInventory`:

```text
planProfileType: "PAID_EXTERNALLY"
paymentMethodRequired: boolean   // typically false
startingPlans: string[]          // not used for purchase flow
upgradePlans: string[]           // not used
insuranceFreePeriod: InsuranceFreePeriodEnum
  - FREE_54_WEEKS  → 54 weeks
  - FREE_12_YEARS  → 12 years
saveOnChargebee: boolean         // false
```

Known profiles:
- `AXA_12_YEARS` → 12 years free period
- `EuropAss` → 54 weeks free period

---

## 2. Entrypoint

- `setPlanProfiles` CCT mutation assigns planProfileId to serial numbers.
- At device registration (`createPetlinkGps`), Core reads the inventory profile and triggers `checkDeviceSubscription()`.

---

## 3. Flow

```text
1. CCT sets planProfileId on petlinkGpsInventory (e.g. AXA_12_YEARS or EuropAss)

2. User registers device (createPetlinkGps)
   → Core calls checkDeviceSubscription()
   → planProfileType === "PAID_EXTERNALLY"
   → handleInsuranceSubscription()

3. handleInsuranceSubscription() creates locally:
   * SUBSCRIPTION:
     - id = uuidv4()
     - businessEntityId = "DATAMARS"
     - planChangeNotAllowed = true
     - isInsurance = true
     - status = "in_trial"
     - chargebeeSubscriptionId = subscriptionId (self-referencing, no Chargebee)
     - billingPeriod = N (from insuranceFreePeriod)
     - billingPeriodUnit = "weeks" | "years"
     - currentTermStart = now
     - currentTermEnd = now + freePeriod
     - subscriptionItems = [{ itemType:"plan", itemId:planProfile.id, amount:0, unitPrice:0 }]
     - currencyCode = "USD"

   * INVOICE:
     - status = "paid_externally"
     - total = 0
     - items = [{ itemType:"plan", description:"Insurance Subscription", amount:0 }]
     - currencyCode = "USD"

   * Links PetlinkGps.subscriptionId

4. No webhooks, no hosted page, no Chargebee calls.
```

---

## 4. Mongo entities

| Entity | Key fields |
|---|---|
| `SUBSCRIPTION` | `isInsurance=true`, `planChangeNotAllowed=true`, `status="in_trial"`, `businessEntityId="DATAMARS"`, `chargebeeSubscriptionId=<self>` |
| `INVOICE` | `status="paid_externally"`, `total=0` |
| `PETLINK_GPS` | `subscriptionId` linked, `subscriptionPlan=Insurance` |
| `PETLINK_GPS_INVENTORY` | `planProfileId` set by CCT |

---

## 5. Reference files

- `@/all-repo/petlink-everywhere-core/src/lib/petlink/subscriptions.ts:631-752` (handleInsuranceSubscription)
- `@/all-repo/petlink-everywhere-core/src/lib/petlink/subscriptions.ts:256-316` (checkDeviceSubscription switch)
- `@/all-repo/petlink-everywhere-core/src/lib/types/petlinkGpsInventory.ts:117-143` (PlanProfileInventory schema)
- `@/all-repo/petlink-everywhere-cct-core/src/lambda_functions/graphql/mutation/setPlanProfiles/handler.ts:61-229`
