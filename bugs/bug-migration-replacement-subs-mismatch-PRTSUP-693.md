# Bug — Legacy Chargebee Customer Not Migrated (Active Subscriptions Lost)

> **Status**: Unfixed
> **Severity**: High — user's active subscriptions not migrated, devices have no subscription link
> **Jira**: PRTSUP-693
> **Affected user**: `mitchell@photoflyer.com` (legacyId `190110`, KIPPY EU)
> **Date discovered**: 2026-07-28
> **Last verified**: 2026-08-07

---

## Summary

The user has two Chargebee customer accounts due to a business entity migration:
- `KPY-91336` (new business entity `DMDS_KIPPY`) — at migration time (Jul 28) contained 2 **cancelled** subscriptions; as of Aug 7 now returns **0 subscriptions**
- `KPY-AXL-91336` (legacy business entity `DMHQ_KIPPY`) — contains **2 active** subscriptions

The `subscriptionMigration` code retrieves both customer IDs from MySQL, but only queries the "new" customer (`KPY-91336`). At migration time, that customer returned 2 cancelled subscriptions, so the fallback logic to the legacy customer was **not triggered** — it only falls back when zero subscriptions are found. The 2 active subscriptions under `KPY-AXL-91336` were never migrated.

---

## Root Cause

### The two Chargebee customers

The MySQL `cb_customer` table stores both IDs:

```
getUserChargebeeIds - chargebeeData: {
  "cb_customer_id": "KPY-91336",           // new business entity
  "cb_legacy_customer_id": "KPY-AXL-91336" // legacy business entity
}
```

### The fallback logic that never fires

`subscriptionMigration/handler.ts:233-281`:

```typescript
// Step 1: Pick the "new" customer ID if it exists
if (!chargebeeIds.customerId) {
  chargebeeId = chargebeeIds.legacyCustomerId!;  // only if no new ID
} else {
  chargebeeId = chargebeeIds.customerId;          // picks KPY-91336
}

// Step 2: Get subscriptions for the chosen customer
let userCbSubscriptions = await getSubscriptionsByCustomerId(chargebeeId, ...);

// Step 3: Fall back to legacy ONLY if zero subscriptions found
if (
  userCbSubscriptions.length === 0 &&              // ← 2 found, not 0
  chargebeeId === chargebeeIds.customerId &&
  chargebeeIds.legacyCustomerId
) {
  // Fallback to legacy customer — NEVER EXECUTED
  chargebeeId = chargebeeIds.legacyCustomerId;
  userCbSubscriptions = await getSubscriptionsByCustomerId(chargebeeId, ...);
}
```

The condition `userCbSubscriptions.length === 0` evaluated to `false` because `KPY-91336` had 2 cancelled subscriptions at migration time. The code assumes that finding *any* subscriptions under the new customer means the legacy customer is not needed. It doesn't check whether the found subscriptions are all cancelled/inactive.

**Note**: As of Aug 7, `KPY-91336` now returns 0 subscriptions, meaning a re-migration would trigger the fallback. However, the original migration already ran and the cancelled subs were persisted to MongoDB as `closed`.

### What was migrated vs what was not

| Chargebee Sub ID | Customer | Serial | Status | Migrated? |
|---|---|---|---|---|
| KPY-SUB-97824 | KPY-91336 (new) | AJZFUC9 | cancelled (at migration time) | Yes (as `closed`) |
| KPY-SUB-98144 | KPY-91336 (new) | AJZCA2V | cancelled (at migration time) | Yes (as `closed`) |
| KPY-SUB-AXL-97824 | KPY-AXL-91336 (legacy) | AJZFUC9 | **active** | **No — never queried** |
| KPY-SUB-AXL-98144 | KPY-AXL-91336 (legacy) | AJZCA2V | **active** | **No — never queried** |

### Device serial context

The user had device replacements:
- `AJZFUC9` → `AFFE23W` (replaced 2026-05-05)
- `AJZCA2V` → `AFERLC6` (replaced 2026-03-31)

Both legacy active subscriptions still have the **old serials** (`AJZFUC9`, `AJZCA2V`) in Chargebee's `cf_DM_Serial_Number` field — the serials were **not** updated to the replacement device serials.

The `PETLINK_GPS` devices in MongoDB (`AFERLC6` and `AFFE23W`) have no `subscriptionId` because:
1. The active subscriptions were never migrated (legacy customer not queried)
2. The cancelled subscriptions that were migrated have old serials (`AJZFUC9`, `AJZCA2V`) that don't match any current device

### Login issue

From Loki logs, the user **can** log in. The `preAuthenticationTrigger` fired successfully at 14:07, 14:12, and 21:04 on Jul 28-29. The login complaint was likely transient or confusion from the `forceSetUserData: true` flag.

---

## Evidence

### Loki logs (2026-07-28T14:06:50 → 14:06:53)

```
getUserChargebeeIds - chargebeeData: {
  "cb_customer_id": "KPY-91336",
  "cb_legacy_customer_id": "KPY-AXL-91336"
}
Obtained chargebeeIds: {"customerId":"KPY-91336","legacyCustomerId":"KPY-AXL-91336"}
User 190110 is on new business entity
Searching subs for customer KPY-91336
Collected subscriptions: [
  KPY-SUB-98144 — cancelled, serial AJZCA2V,
  KPY-SUB-97824 — cancelled, serial AJZFUC9
]
chargebeeSubscriptionsMigrated: 2, chargebeeSubscriptionsTotal: 2
```

No query for `KPY-AXL-91336` appears in the logs. The fallback was never attempted.

### MongoDB data

**Subscriptions** (both `closed`, both with old serials):
| Chargebee ID | Serial | Status |
|---|---|---|
| KPY-SUB-97824 | AJZFUC9 (old) | closed |
| KPY-SUB-98144 | AJZCA2V (old) | closed |

**Devices** (neither has `subscriptionId`):
| Serial | IMEI |
|---|---|
| AFERLC6 (new) | 350903784900335 |
| AFFE23W (new) | 350903784690654 |

**Replacements**:
| Old Serial | New Serial | currentTermEnd |
|---|---|---|
| AJZCA2V | AFERLC6 | 2026-10-05 |
| AJZFUC9 | AFFE23W | 2026-09-28 |

### Chargebee data (confirmed manually)

**Customer `KPY-91336`** (new business entity `DMDS_KIPPY`):
- As of Aug 7: **0 subscriptions** (both cancelled subs removed/cleaned up since migration)
- At migration time (Jul 28): 2 cancelled subscriptions (`KPY-SUB-97824`, `KPY-SUB-98144`)

**Customer `KPY-AXL-91336`** (legacy business entity `DMHQ_KIPPY`):
- `KPY-SUB-AXL-97824` — **ACTIVE**, serial `AJZFUC9` (old, not updated to replacement), currentTermEnd `2026-09-28`, plan `SUB-0000-KPR-EUR-1Y`, MRR €4.82
- `KPY-SUB-AXL-98144` — **ACTIVE**, serial `AJZCA2V` (old, not updated to replacement), currentTermEnd `2026-10-05`, plan `SUB-0000-KPR-EUR-1Y`, MRR €4.82

---

## Fix Plan

### 1. Recovery for this user

Both active subscriptions under `KPY-AXL-91336` need to be migrated manually:
- `KPY-SUB-AXL-97824` (serial `AJZFUC9` → device `AFFE23W` after replacement)
- `KPY-SUB-AXL-98144` (serial `AJZCA2V` → device `AFERLC6` after replacement)

For each:
- Create a `SUBSCRIPTION` entity in MongoDB with the correct data from Chargebee
- Link it to the corresponding `PETLINK_GPS` device (set `subscriptionId` on the device), mapping old serial → replacement serial
- Update the user's `chargebeeId` to `KPY-AXL-91336` since the active subscriptions are under the legacy customer

The serial-to-device mapping (from replacement records):
- `AJZFUC9` → `AFFE23W` (IMEI 350903784690654)
- `AJZCA2V` → `AFERLC6` (IMEI 350903784900335)

### 2. Structural fix

**In `subscriptionMigration/handler.ts:260-281`**: The fallback logic should always query both customer IDs and merge results, or at minimum trigger when all found subscriptions are cancelled/inactive, not just when zero are found:

```typescript
if (
  chargebeeId === chargebeeIds.customerId &&
  chargebeeIds.legacyCustomerId
) {
  const allInactive = userCbSubscriptions.every(
    (s) => !['active', 'in_trial', 'future', 'non_renewing'].includes(s.subscription.status)
  );

  if (userCbSubscriptions.length === 0 || allInactive) {
    logger.info(
      `No active subscriptions found for customerId ${chargebeeId}, ` +
        `falling back to legacyCustomerId ${chargebeeIds.legacyCustomerId}`
    );
    chargebeeId = chargebeeIds.legacyCustomerId;
    // ... fetch legacy subscriptions and MERGE with existing ones
  }
}
```

**Important**: The legacy subscriptions should be **merged** with the new ones, not replace them. Both sets of subscriptions (cancelled from new + active from legacy) should be migrated to preserve full history.

**Alternative simpler fix**: Always query both customer IDs and merge the results:

```typescript
const allSubscriptions = [
  ...await getSubscriptionsByCustomerId(chargebeeIds.customerId, chargebeeClient),
  ...(chargebeeIds.legacyCustomerId
    ? await getSubscriptionsByCustomerId(chargebeeIds.legacyCustomerId, chargebeeClient)
    : []),
];
```

This is safer but makes an extra Chargebee API call for every user with a legacy customer ID.

---

## Affected files

- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/subscriptionMigration/handler.ts:226-281` — customer ID selection and fallback logic
- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/subscriptionMigration/util.ts:59-121` — `getUserChargebeeIds` retrieves both IDs from MySQL
- `all-repo/petlink-data-migration/src/lib/chargebee/chargebeeService.ts:58-93` — `getSubscriptionsByCustomerId` queries Chargebee API
