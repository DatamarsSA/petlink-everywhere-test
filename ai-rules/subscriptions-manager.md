---
trigger: model_decision
description: Apply when debugging payment flows, Chargebee webhooks, subscription states, or the subscriptions-manager repo.
globs: 
---

# subscriptions-manager (Chargebee Integration)

## Folder Navigation
```
src/lambdaFunctions/
  graphql/mutations/{operationName}/handler.ts  ← createNewSubscription, changeTermEnd, createUser, etc.
  webhook/operations/post/webhook.ts            ← REST endpoint receiving Chargebee webhooks
  webhook/operations/post/webhookHandlers/       ← Handler per event type + builders
```

## Webhook Flow
Chargebee sends webhook → `webhook.ts` routes by `event_type` → handler builds normalized object → sends to SQS `subscriptionsWebhook` → Core's `subscriptionsWebhookConsumer` processes it (updates Core DB and notifies Sentinel).

**Handled webhook events**: `payment_succeeded`, `payment_failed`, `payment_refunded`, `subscription_created`, `subscription_renewed`, `subscription_cancelled`, `subscription_activated`, `subscription_started`, `subscription_changed`, `customer_changed`, `invoice_updated`, `invoice_generated`.

## Subscription Types (Brand Differences)
- **Petlink (US)**: Standard Subscriptions (Monthly, Yearly, Multi-year). No device protection addon.
- **Kippy (EU)**: 
  - Standard Subscriptions
  - **Device Protection Addon**: Optional Chargebee addon, covers device replacement.
  - **Pet Protection (Italy only)**: "Care Protection" in code. 1-year duration, independent of main sub. Requires active subscription. Handled as separate subscription in Chargebee.

## Subscription States
- **PreRegistration**: Device purchased, not activated.
- **Active**: User registers device + purchases subscription. Renews automatically if `auto_renew=true`.
- **NonRenewing**: User cancels (`auto_renew=false`). Remains active until term end.
- **Cancelled**: Payment failed or immediate cancellation.
- **Expired**: End of term reached for NonRenewing.

## Cross-Repo Communication
- Core calls `subscriptions-manager` via GraphQL SDK (`sdkSSM` with IAM auth).
- Subscriptions-manager notifies Core via SQS queues.