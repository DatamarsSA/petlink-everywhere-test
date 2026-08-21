

```shell
CARDINALITA

ACQUISTO SUB (plan + N addon)  →  1 INVOICE
                                  └─ items[]: [plan, addon1, addon2, ...]   ← tutto in UNA riga-fattura

RINNOVO (ogni ciclo)           →  1 INVOICE nuova per ciclo (stessa struttura)

PET PROTECTION                 →  1 INVOICE separata (è una sub Chargebee a parte)
                                  └─ invoice.petProtectionId valorizzato, subscriptionId vuoto

ADDON comprato a metà ciclo    →  addebito one-off → invoice/charge a parte
```


```shell
═══════════════════════════ ACQUISTO SUB (V2, no hosted page) ═══════════════════════════

 APP                 CORE                 SUBS-MANAGER              CHARGEBEE
  │                    │                       │                       │
  │ createPaymentIntent│                       │                       │
  │───────────────────>│────── sdk ───────────>│──── PaymentIntent ───>│
  │<───────────────────│<──────────────────────│<────── client_secret ──│
  │  (utente paga in-app con carta)                                     │
  │                    │                       │                       │
  │ checkoutNewSubscriptionV2                  │                       │
  │───────────────────>│────── sdk ───────────>│── createForItems ────>│
  │                    │                       │                       │──┐
  │                    │                       │                       │  │ subscription_created
  │                    │                       │   webhook ────────────│<─┘ invoice_generated
  │                    │                       │<──────────────────────│   payment_succeeded
  │                    │                       │                       │
  │                    │                       │── SQS subscriptionsWebhook ──┐
  │                    │<─────────────────────────────────────────────────────│
  │                    │── Mongo: crea SUBSCRIPTION + INVOICE,                │
  │                    │   aggancia subscriptionId al PETLINK_GPS             │

  Nota: V2 fa anche "acknowledgeCheckout": ripubblica invoice_generated
  sulla coda subito dopo la create, per non aspettare il webhook asincrono.

═══════════════════════════ RINNOVO (100% automatico) ═══════════════════════════════════

 CHARGEBEE ── subscription_renewed ──┐
           ── invoice_generated ─────┼──> webhook.ts ──> SQS ──> Core consumer ──> Mongo:
           ── payment_succeeded ────┘                     aggiorna currentTerm*, crea INVOICE,
                                                          paymentStatus = SUCCEEDED

═══════════════════════════ STOP RINNOVO (disdetta a fine termine) ═══════════════════════

 APP ──> CORE stopRenewingSubscription
           │
           │── calculateFee(productId, subId)          ← early termination fee
           │── se fee>0: sdk.applyCharges ──> CHARGEBEE crea addebito "EARLY TERMINATION FEE"
           │              sdk.changeTermEnd ──> CHARGEBEE estende termine
           │── sdk.stopRenewingSubscription ──> CHARGEBEE cancelForItems(end_of_term=false)
           │
 CHARGEBEE ── subscription_cancellation_scheduled ──> SQS ──> Core ──> Mongo: non_renewing
           ── invoice_generated (la fee) ──> SQS ──> Core ──> Mongo: CHARGE

 ...alla scadenza:
 CHARGEBEE ── subscription_cancelled ──> SQS ──> Core ──> Mongo: cancelled, device senza sub attiva

═══════════════════════════ REFUND (da CCT) ═════════════════════════════════════════════

 CCT ──> cct-core ── sdkSM.refundInvoice ──> SUBS-MANAGER ──> CHARGEBEE crea Credit Note
 CHARGEBEE ── payment_refunded ──> SQS ──> Core ──> Mongo: crea CREDIT_NOTE (→ INVOICE),
                                                    marca sub isRefunded
```


```shell
CHARGEBEE                          MONGODB (petlinkEverywhere)
─────────                          ────────────────────────

Customer ◄───────────────────────── USER.chargebeeId
    │
    ├──► Subscription ◄──────────── SUBSCRIPTION.chargebeeSubscriptionId
    │       │                       SUBSCRIPTION.businessEntityId ──► BusinessEntity
    │       │
    │       ├──► Invoice ◄────────── INVOICE.chargebeeInvoiceId
    │       │       │                INVOICE.chargebeeSubscriptionId ──► Subscription
    │       │       │
    │       │       ├──► Credit Note CREDIT_NOTE.chargebeeCreditNoteId
    │       │       │   (refund)     CREDIT_NOTE.chargebeeInvoiceId ──► Invoice (rimborsata)
    │       │       │                CREDIT_NOTE.chargebeeSubscriptionId ──► Subscription
    │       │       │
    │       │       └──► (one-off)   CHARGE.chargebeeInvoiceId (= Invoice CB con ETF)
    │       │
    │       └──► (pet prot sub) ◄─── PET_PROTECTION.chargebeeSubscriptionId
    │
    └──► Order ◄─────────────────── ORDER.chargebeeId

Business Entity ◄────────────────── USER.chargebeeBusinessEntityId
                                  SUBSCRIPTION.businessEntityId
                                  INVOICE.businessEntityId
```