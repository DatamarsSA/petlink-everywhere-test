# Subscription Flow — COUPON

> Discount coupon pre-assigned to a device via CCT. Applied automatically during Chargebee checkout.

---

## 1. Coupon assignment

### Entrypoint

- **CCT mutation**: `setCoupon(serialNumbers, couponId, setMode)`
  - `setMode`: `Apply` | `Simulate`
  - `authJwt` + SUPERADMIN/L2 role.

### Flow

```text
1. CCT validates serial numbers exist in petlinkGpsInventory
2. If setMode == "apply":
   → upsertManyItems({ couponId, couponMetadata }, ...)
   on petlinkGpsInventory where serialNumber in list
3. couponMetadata includes: userId, userEmail, creationDate
```

### Validation rules

- `failureList`: serials not found in inventory
- `warningList`: serials that already have a different coupon assigned

---

## 2. Coupon at purchase time

```text
1. getCheckoutData()
   → Reads GpsInventory
   → Reads couponId from inventory item
   → Includes couponId in CheckoutData response

2. getSubscriptionPlans()
   → Also reads coupon from inventory
   → Returns coupon details in response (if present)

3. checkoutNewSubscription / changeSubscriptionPlan
   → Passes couponIds: [checkoutData.couponId] to SM
   → Chargebee applies coupon discount to the invoice
```

---

## 3. Invoice with discount

After purchase, the subscription's first invoice contains:

```text
discountItems: [{
  couponId: "<coupon id>",
  discountPercentage: number,   // e.g. 20
  discountType: "percentage" | "fixed_amount",
  amount: number                // discount value
}]
```

Invoice math:
- `total = planItem.amount - discountItem.amount`
- Discount amount is within ±10 cents of exact percentage.

---

## 4. Mongo entities

| Entity | Key fields |
|---|---|
| `PETLINK_GPS_INVENTORY` | `couponId`, `couponMetadata` |
| `SUBSCRIPTION` | `subscriptionItems` (plan + addon if any) |
| `INVOICE` | `discountItems` array, `total` reflecting discount |

---

## 5. Reference files

- `@/all-repo/petlink-everywhere-cct-core/src/lambda_functions/graphql/mutation/setCoupon/handler.ts:38-107`
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkoutNewSubscription/checkoutUtil.ts:92-99` (couponId from inventory)
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/getSubscriptionPlans/util.ts:75-120` (getCoupon)
- `@/all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkoutNewSubscription/handler.ts:114-128` (passes couponIds to SM)
