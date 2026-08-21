# PEM-4354 — Early Termination Fee: Bug Specification

## 1. Summary

Two systemic bugs affect the Early Termination Fee (ETF) flow in Petlink Everywhere:

1. **`calculateFee` overestimates the ETF** — the calculation relies on `currentTermStart`/`currentTermEnd` from a single subscription document that is overwritten at every renewal, losing historical billing data.
2. **Refund of ETF charges is blocked** — ETF invoices are saved with `entityType: "CHARGE"` but `handleRefund` only searches for `entityType: "INVOICE"`.

Both bugs are **systemic** (affect all subscriptions, not just the one in PRTSUP-699).

---

## 2. Context: PRTSUP-699

- **User ID**: `4c1a899f-a752-46db-b8aa-783c2353afb7`
- **Subscription ID (MongoDB)**: `b1cb3894-080c-48b5-9759-d48bdb48f669`
- **Chargebee Subscription ID**: `198eUbVL0G7pg1iD5`
- **ETF Invoice ID**: `DS332628` (MongoDB id: `f5a2eb28-f17d-42f3-b793-5a267ff10982`)
- **ETF amount charged**: €32.97
- **Monthly plan**: `SUB-000C-KBA-EUR-1M` (€10.99/month)
- **Serial number**: `ADJX3VH`
- **Business entity**: `DMDS_KIPPY`

### Timeline

| Date | Event | Effect on MongoDB |
|------|-------|-------------------|
| 2026-05-28 | Subscription activated | `SUBSCRIPTION` doc created. `currentTermStart`: 2026-05-28, `currentTermEnd`: 2026-06-28 |
| ~2026-06-28 | 1st renewal (invoice DS315577) | `SUBSCRIPTION` doc updated: `currentTermStart` → 2026-06-28, `currentTermEnd` → 2026-07-28 |
| ~2026-07-28 | 2nd renewal (invoice DS322513 → DS330152) | `SUBSCRIPTION` doc updated: `currentTermStart` → 2026-07-28, `currentTermEnd` → 2026-08-28 |
| 2026-08-06 | `stopRenewingSubscription` called (retention flow) | `calculateFee` runs, computes ETF = €32.97 (3 months × €10.99) |
| 2026-08-06 | `subscription_cancellation_scheduled` webhook | Sub → `non_renewing`, `cancelReason`: `retention_flow` |
| 2026-08-06 | `invoice_generated` for DS332628 (ETF) | Saved as `entityType: "CHARGE"` |
| 2026-08-06 | `payment_succeeded` for DS332628 | Sub `currentTermEnd` extended to 2026-11-28 via `changeTermEnd` |
| Later | CCT operator attempts refund of DS332628 | **404 error** — `handleRefund` can't find the invoice |

---

## 3. Bug #1: `calculateFee` overestimates the ETF

### Root cause

All subscription webhook handlers (`subscriptionRenewedHandler`, `subscriptionChangedHandler`, `subscriptionActivatedHandler`) use `findOneAndUpdate` on the same MongoDB document. This means the subscription document is **overwritten** at every renewal — `currentTermStart` and `currentTermEnd` always reflect only the **last** billing period.

### Code location

`petlink-everywhere-core/src/lib/petlink/subscriptions.ts` — `calculateFee` function:

```typescript
// getPaidSubscriptions retrieves subscription docs for a productId
// Then for each subscription:
const totalDaysPaid = differenceInDays(
  new Date(sub.currentTermEnd),
  new Date(sub.currentTermStart)
);
```

Since `currentTermStart` and `currentTermEnd` are overwritten at each renewal, `totalDaysPaid` reflects only the last month (~30 days), not the cumulative paid period.

### Concrete example (PRTSUP-699)

The subscription was active from 2026-05-28 to 2026-08-06 (~70 days, 3 monthly payments of €10.99).

At the time `calculateFee` runs:
- `currentTermStart` = 2026-07-28 (last renewal)
- `currentTermEnd` = 2026-08-28 (end of current period)
- `totalDaysPaid` = ~31 days (only the last month)

The grace period is 120 days (4 months). The fee logic calculates:
```
missingMonths = max(0, gracePeriodMonths - totalDaysPaid / 30)
             = max(0, 4 - 31/30)
             = max(0, 4 - 1.03)
             = 2.97 months
```

Then: `fee = missingMonths × monthlyFee = 2.97 × €10.99 = €32.97` (capped at €50).

**The correct fee should be**: the user paid for 3 months (May 28 → Aug 6). Grace period is 4 months. Missing = 1 month. Fee should be ~€10.99, not €32.97.

### Why it's systemic

MongoDB prod data confirms:
- **75% of users have exactly 1 subscription document** (overwritten at each renewal)
- **16,595 subscriptions have only 1 invoice** (new users or recently renewed)
- All subscription webhooks use `findOneAndUpdate` — no historical term data is preserved

### Webhook behavior (confirmed from code)

| Handler | Operation | Creates new doc? |
|---------|-----------|-----------------|
| `subscriptionRenewedHandler` | `findOneAndUpdate` | No — overwrites |
| `subscriptionChangedHandler` | `findOneAndUpdate` | No — overwrites |
| `subscriptionActivatedHandler` | `findOneAndUpdate` | No — overwrites |
| `subscriptionCreatedHandler` | Checks existing; updates if found | Only inserts if no existing doc |

---

## 4. Bug #2: Refund of ETF charges is blocked

### Root cause

**Write side** (`invoiceUpdatedHandler.ts` in core):

```typescript
const entityType: 'INVOICE' | 'CHARGE' = data.invoice?.items.find(
  (i) => i.description === 'EARLY TERMINATION FEE'
)
  ? EntityTypeEnum.Enum.CHARGE
  : EntityTypeEnum.Enum.INVOICE;
```

ETF invoices are **intentionally** saved with `entityType: "CHARGE"`.

**Read side** (`refund.ts` in cct-core):

```typescript
const invoiceRes = await findItem<Invoice>(
  dbSecret,
  { entityType: EntityTypeEnum.Enum.INVOICE, id: invoiceId },  // ← only INVOICE
  collection,
  'PETLINK'
);
```

`handleRefund` only searches for `entityType: INVOICE`. ETF charges (saved as `CHARGE`) are never found → 404 error.

### Additional blocker: `itemType` validation

Even if the `entityType` filter is fixed, `handleRefund` has a second blocker:

```typescript
const RefundItemTypeEnum = z.enum([
  'plan_item_price',
  'addon_item_price',
  'charge_item_price',
]);
```

ETF items have `itemType: "adhoc"`, which is **not in the enum** → the refund would fail at validation with `INVALID_ITEM_TYPE`.

### Impact

MongoDB prod data confirms **96 `CHARGE` documents** exist, all with `description: "EARLY TERMINATION FEE"`. **None of them can be refunded** via the CCT tool.

---

## 5. Webhook evidence from Grafana Prod

Logs from `DatamarsSubscriptionsManagerProd-webhookLambda` and `DatamarsPetlinkEverywhereCoreProd-subsWebhookQueueConsumer` for subscription `198eUbVL0G7pg1iD5`:

| Timestamp | Event type | Invoice | Details |
|-----------|------------|---------|---------|
| ~2026-07-22 | `subscription_renewal_reminder` | — | Pre-renewal reminder |
| 2026-07-28 | `unbilled_charges_created` | — | Monthly charge created |
| 2026-07-28 | `unbilled_charges_invoiced` | DS330152 | Charge → invoice (payment_due) |
| 2026-07-28 | `transaction_updated` (×2) | DS330152 | PayPal payment: in_progress → success |
| 2026-07-28 | `invoice_updated` | DS330152 | Invoice → paid, €10.99, MONTHLY |
| 2026-08-06 | `subscription_cancellation_scheduled` | — | Sub → non_renewing (retention_flow) |
| 2026-08-06 | `invoice_generated` | DS332628 | ETF €32.97, EARLY TERMINATION FEE |
| 2026-08-06 | `invoice_updated` | DS332628 | ETF invoice → paid |
| 2026-08-06 | `payment_succeeded` | DS332628 | PayPal €32.97 success. Sub currentTermEnd → 2026-11-28 |

Consumer-side logs confirm:
- DS330152 saved as `entityType: "INVOICE"` ✓
- DS332628 saved as `entityType: "CHARGE"` ✓ (by design)
- Subscription updated (not duplicated) at each webhook ✓

Logs from May 2026 (subscription creation, 1st renewal) are outside Loki retention (~30 days).

---

## 6. Proposed solutions

### Bug #1: `calculateFee`

#### Option A: Use accumulated invoices (recommended)

Instead of relying on `currentTermStart`/`currentTermEnd` from the subscription document, calculate `totalDaysPaid` from the **invoices** associated with the subscription:

```typescript
// Fetch all paid invoices for this subscription/productId
const invoices = await findItems<Invoice>(dbSecret, {
  entityType: { $in: [EntityTypeEnum.Enum.INVOICE, EntityTypeEnum.Enum.CHARGE] },
  subscriptionId: sub.id,
  status: 'paid',
}, collection, 'PETLINK');

// Sum the date ranges from invoice items
const totalDaysPaid = invoices.reduce((sum, inv) => {
  return sum + inv.items
    .filter(item => item.itemType === 'plan_item_price')
    .reduce((s, item) => s + differenceInDays(
      new Date(item.dateTo),
      new Date(item.dateFrom)
    ), 0);
}, 0);
```

**Pros**: Uses data that is already correctly accumulated (invoices are never overwritten). Accurate.
**Cons**: Requires additional DB query. Need to handle edge cases (overlapping periods, refunds via credit notes).

#### Option B: Append to subscription history array

Add a `termHistory` array to the subscription document, updated at each renewal:

```typescript
termHistory: [
  { termStart: "2026-05-28", termEnd: "2026-06-28" },
  { termStart: "2026-06-28", termEnd: "2026-07-28" },
  { termStart: "2026-07-28", termEnd: "2026-08-28" },
]
```

**Pros**: Self-contained in the subscription document.
**Cons**: Requires modifying all webhook handlers. Historical data is already lost for existing subscriptions.

#### Option C: Query Chargebee directly

Call Chargebee API to get the full subscription term history.

**Pros**: Source of truth, no MongoDB dependency.
**Cons**: Adds latency and API rate limit risk. Chargebee API may not expose historical terms directly.

### Bug #2: Refund blocked for CHARGE entityType

#### Option A: Expand the query filter (minimal fix)

```typescript
const invoiceRes = await findItem<Invoice>(
  dbSecret,
  { entityType: { $in: [EntityTypeEnum.Enum.INVOICE, EntityTypeEnum.Enum.CHARGE] }, id: invoiceId },
  collection,
  'PETLINK'
);
```

Then map `itemType: "adhoc"` → `"charge_item_price"` before validation:

```typescript
const itemType = invoiceItem.itemType === 'adhoc' 
  ? 'charge_item_price' as RefundItemTypeEnum 
  : invoiceItem.itemType;
```

**Pros**: Minimal change, unblocks refund immediately.
**Cons**: Need to verify that `refundInvoiceForItem` and the subscriptions-manager `refundInvoice` handler accept `charge_item_price` for adhoc items.

#### Option B: Add `"adhoc"` to `RefundItemTypeEnum`

```typescript
const RefundItemTypeEnum = z.enum([
  'plan_item_price',
  'addon_item_price',
  'charge_item_price',
  'adhoc',
]);
```

**Pros**: More explicit.
**Cons**: Requires changes in subscriptions-manager to accept and pass `adhoc` to Chargebee. Larger blast radius.

#### Option C: Stop saving ETF as CHARGE

Change `invoiceUpdatedHandler` to save ETF invoices as `INVOICE` like all others.

**Pros**: No changes needed in refund flow.
**Cons**: Breaks the semantic distinction between recurring invoices and one-time charges. May affect other code that filters by `entityType`. Would require data migration for existing 96 CHARGE documents.

---

## 7. MongoDB prod data summary

| Metric | Value |
|--------|-------|
| Total subscription documents | ~14,000+ |
| Users with 1 subscription | 11,342 (75%) |
| Subscriptions with 1 invoice | 16,595 |
| Total CHARGE (ETF) documents | 96 |
| Distinct subscriptions with ETF | 93 |
| ETF amounts range | €32.97 – €50.00 |

All 96 ETF charges are affected by the refund bug. All subscriptions with monthly renewals are affected by the `calculateFee` bug.
