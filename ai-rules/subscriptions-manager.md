---
trigger: model_decision
description: Apply when debugging payment flows, Chargebee webhooks, subscription states, or the subscriptions-manager repo.
globs: 
---

# subscriptions-manager (Chargebee Integration)

> **Domain Knowledge Note:** For business logic about subscription types, states, and flows, read `docs/subscriptions/subscriptions.md` and the Subscriptions section in `docs/petlnk-infrastructure.md`.

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

## Subscription Types & States
Detailed definitions of subscription types (Petlink vs Kippy) and states (PreRegistration, Active, NonRenewing, etc.) are documented in `docs/petlnk-infrastructure.md`. 

## Cross-Repo Communication
- Core calls `subscriptions-manager` via GraphQL SDK (`sdkSSM` with IAM auth).
- Subscriptions-manager notifies Core via SQS queues.