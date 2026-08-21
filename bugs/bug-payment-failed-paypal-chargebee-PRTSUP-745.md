# Bug: Payment Failed via PayPal — No Subscription Created in Chargebee

## Jira Ticket
- **Ticket**: PRTSUP-745
- **Summary**: [PROD]-[KIPPY]: SUBSCRIPTION ISSUE
- **Priority**: High
- **Reporter**: Christian Prete
- **Created**: 2026-08-18T17:48:09+0200
- **Environment**: EU (KIPPY)

## Affected User
- **Name**: Paolo Buccianti
- **Email**: paolo.buccianti@gmail.com
- **UserId**: e2a74317-e784-487b-b711-1262da57d436
- **ChargebeeId**: e2a74317-e784-487b-b711-1262da57d436
- **AppBrand**: KIPPY
- **BusinessEntity**: DMDS_KIPPY
- **Device Serial**: ADMAXWC
- **ProductId**: fe4190ea-96de-4e7a-a09e-e74e86b50e9d

## Incident Date
- **Checkout attempt**: 2026-08-13 16:30:44 UTC
- **Payment failure**: 2026-08-13 17:01:41 UTC (payment intent expired)

## Observed Behaviour
The customer purchased a subscription (SUB-000C-KPR-EUR-1Y, €69.99/year) via PayPal Express Checkout through the Chargebee hosted page. **The payment was successfully completed on Adyen's side** (Adyen Customer Area shows status **SettledExternally**, PSP reference MWTKVZG55WX7XHX3, €69.99 EUR, PayPal), but **Chargebee marked the payment intent as refused** with error `resource_not_found_at_gateway` and never created the subscription.

This is a **synchronization failure between Adyen and Chargebee** for PayPal payments: the payment succeeded on Adyen/PayPal but Chargebee did not process the settlement confirmation.

At the time of the ticket, the customer has a 7-day free (NON_PAYING) subscription in MongoDB, likely added by a CCT operator via `addFreePeriod`.

## Timeline of Events (all times UTC)

| Timestamp | Event | Source |
|---|---|---|
| 2026-08-13 12:43:39 | Customer created in Chargebee | webhook `customer_created` (ev_BTLpgdVSBTbz12Y70) |
| 2026-08-13 12:51:53 | User created in MongoDB | MongoDB USER entity |
| 2026-08-13 12:55:07 | Pet "Balu" created in MongoDB | MongoDB PET entity |
| 2026-08-13 13:43:39 | GPS device ADMAXWC registered | MongoDB PETLINK_GPS entity |
| 2026-08-13 16:30:44 | User initiates checkout from iPhone (Chrome iOS) | Core `checkoutNewSubscription` |
| 2026-08-13 16:30:45 | Subscriptions Manager retrieves Chargebee customer, creates hosted page | SM `checkoutNewSubscription` |
| 2026-08-13 16:31:44 | Payment intent created: €69.99, PayPal Express Checkout, Adyen gateway | webhook `payment_intent_created` (ev_BTU6FyVSC9vP83Dbb) |
| 2026-08-13 16:31:49 | Payment attempt status: `requires_challenge` (user redirected to PayPal) | webhook `payment_intent_updated` (ev_BTUFdoVSC9wur3ECu) |
| 2026-08-13 16:32:28 | **User completes PayPal authorization** — payment created on Adyen | Adyen Customer Area (18:32:28 CEST = 16:32:28 UTC) |
| 2026-08-13 16:32:30 | Chargebee marks payment attempt as **refused**, error `resource_not_found_at_gateway` | Payment attempt modified_at: 1786638750 |
| 2026-08-13 17:01:41 | Payment intent EXPIRED (30-min timeout) | webhook `payment_intent_updated` (ev_BTLVwwVSCHU3m7P6r) |
| (later, unknown time) | **Adyen settles the payment** — status: SettledExternally | Adyen Customer Area screenshot |
| 2026-08-14 12:33:03 | 7-day free NON_PAYING subscription created in MongoDB | MongoDB SUBSCRIPTION entity |

## Relevant Logs

### Core checkoutNewSubscription (request_id: a045ccf7-90f7-484d-b438-9ed231d23877)
- User called `checkoutNewSubscription` with `productId=fe4190ea-96de-4e7a-a09e-e74e86b50e9d`, `priceIds=["SUB-000C-KPR-EUR-1Y"]`
- Source IP: 109.54.9.127 (Italy, TIM Mobile), iPhone Chrome iOS
- Core retrieved user from MongoDB, forwarded to Subscriptions Manager

### Subscriptions Manager checkoutNewSubscription (request_id: a71dcdd5-4b20-4916-b948-4ba361d7d95c)
- Received request with `userId`, `serialNumber=ADMAXWC`, `priceIds=["SUB-000C-KPR-EUR-1Y"]`, `businessEntity=DMDS_KIPPY`
- Retrieved Chargebee customer successfully (card_status: no_card, preferred_currency: EUR)
- Created Chargebee hosted page for checkout

### Webhook events (DatamarsSubscriptionsManagerProd-webhookLambda)
1. `customer_created` (ev_BTLpgdVSBTbz12Y70) — 2026-08-13 12:43:39 UTC
2. `customer_changed` (ev_BTLpgdVSC9IJa3DP1) — 2026-08-13 16:29:13 UTC (billing address update)
3. `customer_changed` (ev_BTTxs6VSC9IO83FUB) — 2026-08-13 16:29:14 UTC
4. `payment_intent_created` (ev_BTU6FyVSC9vP83Dbb) — 2026-08-13 16:31:44 UTC
   - Amount: 6999 (€69.99), Currency: EUR
   - Gateway: adyen, Payment method: paypal_express_checkout
   - Status: inited
5. `payment_intent_updated` (ev_BTUFdoVSC9wur3ECu) — 2026-08-13 16:31:49 UTC
   - Status: in_progress
   - Payment attempt: requires_challenge
6. `payment_intent_updated` (ev_BTLVwwVSCHU3m7P6r) — 2026-08-13 17:01:41 UTC
   - **Status: expired**
   - **Payment attempt: refused**
   - **Error code: resource_not_found_at_gateway**
   - **Error text: "Operation failed as the resource is not found at gateway"**

### No further events
- No `subscription_created` event
- No `payment_succeeded` event
- No `acknowledgeCheckout` call
- No second checkout attempt

## Relevant MongoDB State

### USER entity (petlinkEverywhere)
```
_id: 6a7dbde98741a27c6b8a938a
id: e2a74317-e784-487b-b711-1262da57d436
email: paolo.buccianti@gmail.com
appBrand: KIPPY
chargebeeBusinessEntityId: DMDS_KIPPY
chargebeeId: e2a74317-e784-487b-b711-1262da57d436
creationDate: 2026-08-13T12:51:53.862Z
```

### PETLINK_GPS entity (petlinkEverywhere)
```
_id: 6a7dca0b8741a27c6b8b90aa
id: fe4190ea-96de-4e7a-a09e-e74e86b50e9d
serialNumber: ADMAXWC
imei: 356941177870776
subscriptionId: d4809dc5-ce1e-4532-a563-03cc98a2a037
userId: e2a74317-e784-487b-b711-1262da57d436
```

### SUBSCRIPTION entity (petlinkEverywhere)
```
_id: 6a7f0aff8741a27c6ba4c23f
id: d4809dc5-ce1e-4532-a563-03cc98a2a037
entityType: SUBSCRIPTION
status: in_trial
billingPeriod: 7
billingPeriodUnit: days
subscriptionItems: [{ amount: 0, itemId: NON_PAYING, itemPriceId: NON_PAYING, itemType: plan }]
currentTermStart: 2026-08-14T12:33:03.831Z
currentTermEnd: 2026-08-21T12:33:03.831Z
serialNumber: ADMAXWC
businessEntityId: DATAMARS
```

This is a NON_PAYING subscription (7-day free period) created on 2026-08-14, likely by a CCT operator via `addFreePeriod`. It is NOT a Chargebee-managed subscription.

## Chargebee State
- Customer exists in Chargebee (confirmed by webhook events and SM checkout logs)
- No subscriptions in Chargebee for this customer
- No invoices in Chargebee for this customer
- No transactions in Chargebee for this customer
- Payment intent BTU6FyVSC9vOt3DbaG1f7lssc24g6UNpgS9q2H5ZFMIvWtcuYO: expired/refused

## Root Cause

This is a **synchronization failure between Adyen and Chargebee** for PayPal Express Checkout payments. The payment was actually completed and settled, but Chargebee never processed the confirmation.

**Confirmed by Adyen Customer Area screenshot** (provided in the Jira ticket):
- PSP reference: `MWTKVZG55WX7XHX3`
- Merchant reference: `CB_BTUFdoVSC9wc43EC0` (same as Chargebee payment attempt ID)
- Amount: 69.99 EUR
- Payment method: PayPal
- Status: **SettledExternally** (green dot)
- Date: Aug 13, 2026 18:32:28 CEST (16:32:28 UTC)

"SettledExternally" in Adyen means the payment was settled by the payment method (PayPal) — **the money was actually taken from the customer's PayPal account**.

**The sequence of events:**
1. User initiated checkout → Chargebee hosted page created ✓
2. Payment intent created in Chargebee ✓
3. User redirected to PayPal (`requires_challenge`) ✓
4. **User completed PayPal authorization at 16:32:28 UTC** ✓ (visible in Adyen)
5. **Chargebee tried to verify the payment with Adyen 2 seconds later (16:32:30) but got `resource_not_found_at_gateway`** ✗ — the PayPal resource was not yet available/visible to Adyen
6. Payment intent expired after 30 minutes (17:01:41) ✗
7. **Adyen later settled the payment** (status: SettledExternally) ✓
8. **Chargebee never processed the settlement** because the payment intent was already in a terminal state (expired/refused) ✗

**Why this happened**: There is a race condition in the Adyen-Chargebee integration for PayPal payments. When the user completes the PayPal authorization, Adyen needs a moment to register the payment resource. Chargebee's polling/verification at 16:32:30 was too fast — the PayPal resource wasn't yet available, so Chargebee received `resource_not_found_at_gateway` and marked the payment as refused. The payment then settled on Adyen's side, but Chargebee had already given up on the payment intent.

This is likely a known issue with the Chargebee-Adyen integration for asynchronous payment methods like PayPal, where the payment confirmation can arrive after Chargebee has already timed out the payment intent.

## Code Files and Functions Involved

This is not a code bug. The checkout flow worked as designed. The failure occurred at the payment gateway level (Adyen/PayPal).

The relevant code path is:
- `petlink-everywhere-core`: `src/lambda_functions/graphql/query/checkoutNewSubscription/handler.ts` → forwards to SM
- `subscriptions-manager`: `src/lambdaFunctions/graphql/mutations/checkoutNewSubscription/handler.ts` → creates Chargebee hosted page
- Chargebee hosted page → Adyen gateway → PayPal Express Checkout
- `subscriptions-manager`: `src/lambdaFunctions/webhook/operations/post/webhook.ts` → receives Chargebee webhooks

## Production Code Version
- Incident date: 2026-08-13
- The code running at the time of the incident was the production version deployed before 2026-08-13

## Proposed Fix / Action

**This is a real issue — the customer paid €69.99 but has no subscription.** Recommended actions:

1. **Immediate — Manual subscription creation**: Create a subscription in Chargebee for this customer (customer ID: `e2a74317-e784-487b-b711-1262da57d436`, plan: SUB-000C-KPR-EUR-1Y, amount: €69.99) and manually mark it as paid. This will trigger the normal webhook flow and create the SUBSCRIPTION entity in MongoDB.
2. **Alternative — Refund**: If the subscription cannot be created manually, refund the payment via Adyen (PSP reference: `MWTKVZG55WX7XHX3`).
3. **Chargebee support**: Open a ticket with Chargebee support about the PayPal-Adyen integration — the payment succeeded on Adyen but Chargebee marked it as refused due to `resource_not_found_at_gateway`. Reference payment attempt `CB_BTUFdoVSC9wc43EC0` and payment intent `BTU6FyVSC9vOt3DbaG1f7lssc24g6UNpgS9q2H5ZFMIvWtcuYO`.
4. **Preventive**: Monitor for other cases of PayPal payments with `resource_not_found_at_gateway` in Chargebee. If recurring, this is a systemic issue in the Chargebee-Adyen PayPal integration.

## Remaining Uncertainty

- **Exact settlement time**: The Adyen Customer Area screenshot shows the current status as SettledExternally, but we don't know exactly when Adyen settled the payment (it happened after the payment intent expired at 17:01:41 UTC). The payment detail page in Adyen would show the full status history.
- **Whether this is a recurring issue**: This could be an isolated incident or a systemic problem with PayPal payments through Chargebee-Adyen. Checking other PayPal transactions around the same date would clarify.
- **Chargebee MCP**: The Chargebee MCP server connected to the "dev-test" environment could not find this customer (likely because it's a different Chargebee site than production). All Chargebee data in this report comes from webhook logs in Grafana, not from direct Chargebee API queries.
