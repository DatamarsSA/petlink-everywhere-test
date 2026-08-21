# Bug PRTSUP-699 — Early Termination Fee calcolata erroneamente (totalDaysPaid sottostimato)

> **Status**: Unfixed
> **Severity**: High — bug sistemico, 134 sottoscrizioni Kippy EU potenzialmente affected
> **Jira**: PRTSUP-699
> **Affected user**: `anna.deluca90@gmail.com` (KIPPY EU, businessEntityId `DMDS_KIPPY`)
> **Device serial**: `ADJX3VH`
> **Subscription ID**: `b1cb3894-080c-48b5-9759-d48bdb48f669`
> **Chargebee subscription ID**: `198eUbVL0G7pg1iD5`
> **Date discovered**: 2026-08-10

---

## Summary

Il cliente ha un abbonamento mensile Kippy EU attivo dal 2026-05-28. Ha pagato regolarmente 3 fatture da €10.99 (maggio, giugno, luglio). Il 2026-08-06 il cliente avvia la cancellazione tramite retention flow (`cancelReason: retention_flow`).

La funzione `calculateFee` in `petlink-everywhere-core/src/lib/petlink/subscriptions.ts` calcola erroneamente l'early termination fee perché `getPaidSubscriptions` conta solo i giorni del **termine corrente** della sottoscrizione (31 giorni, da `currentTermStart` a `currentTermEnd`), invece del **tempo totale pagato** (~92 giorni su 3 cicli di fatturazione).

Risultato: il sistema calcola 3 mesi mancanti invece di 1, addebitando €32.97 (3 × €10.99) come early termination fee, e estendendo `currentTermEnd` da 2026-08-28 a 2026-11-28.

**Nota:** Chargebee ha effettivamente emesso una fattura "One Time" da €32.97 (DS332628) il 2026-08-06 17:09, confermando che il codice ha chiamato `applyCharges`. Questa fattura **è presente in MongoDB** ma salvata con `entityType: "CHARGE"` (non `"INVOICE"`) — questo crea un problema nel refund successivo (vedi sezione Refund Issue).

---

## Root Cause

### Architettura: 1 documento MongoDB per subscription, aggiornato (non duplicato) a ogni rinnovo

In MongoDB esiste **un solo documento** per ogni sottoscrizione Chargebee. Non viene creato un nuovo documento a ogni rinnovo: il documento esistente viene **aggiornato** (`findOneAndUpdate`) con i nuovi valori di `currentTermStart` e `currentTermEnd`.

Questo è il comportamento **normale e previsto** dal codice, non un'anomalia di questo caso specifico:

**1. `subscriptionRenewedHandler.ts:51-70`** — gestisce l'evento `subscription_renewed` (rinnovo mensile scheduled):
```typescript
// Trova la subscription esistente tramite getActiveSubscription()
const oldSubscription = await getActiveSubscription(
  dbSecret, chargebeeSubscriptionId, serialNumber, petlinkGpsCollection
);

// Aggiorna lo STESSO documento con i nuovi termini
await findOneAndUpdate(
  dbSecret,
  { id: oldSubscription.id },         // ← stesso id, stesso documento
  {
    currentTermStart: data.subscription.currentTermStart,   // ← sovrascrive il valore precedente
    currentTermEnd: data.subscription.currentTermEnd,       // ← sovrascrive il valore precedente
    startedAt: data.subscription.startedAt,
    nextBillingAt: data.subscription.nextBillingAt,
    // ...
  },
  petlinkGpsCollection
);
```

**2. `subscriptionChangedHandler.ts:105-126`** — gestisce l'evento `subscription_changed` (cambio piano, changeTermEnd, ecc.):
```typescript
const updateSubscriptionTerms = ![
  SubscriptionStatusEnum.Enum.closed.toString(),
  SubscriptionStatusEnum.Enum.cancelled.toString(),
].includes(subscription?.status!);

await findOneAndUpdate(
  dbSecret,
  subscriptionFilter,
  {
    status: data.subscription.status,
    // ...
    ...(updateSubscriptionTerms && {
      currentTermStart: data.subscription.currentTermStart,   // ← sovrascrive
      currentTermEnd: data.subscription.currentTermEnd,       // ← sovrascrive
    }),
  },
  petlinkGpsCollection
);
```

**Conseguenza:** dopo N rinnovi mensili, il documento MongoDB contiene solo i valori dell'**ultimo termine** (es. `currentTermStart` = inizio del 3° mese, `currentTermEnd` = fine del 3° mese). I termini dei mesi precedenti sono **persi** — non esiste alcuno storico.

### Funzione `calculateFee` (subscriptions.ts:890-1078)

La funzione:
1. Verifica se sono passati >30 giorni dalla creazione della sottoscrizione (grace period, basato su `createdAt`) → **sì** (~68 giorni)
2. Chiama `getPaidSubscriptions(productId)` per ottenere tutte le sottoscrizioni pagate per quel prodotto
3. Per ogni subscription trovata, calcola `currentTermEnd - currentTermStart` e somma per ottenere `totalDaysPaid`
4. Calcola `missingDays = requiredDays - totalDaysPaid` (dove `requiredDays = FEE_GRACE_PERIOD_MONTHS * 30 = 120`)
5. Calcola `missingMonths = Math.round(missingDays / 30)`
6. Fee = `missingMonths * monthlyFee` (dove `monthlyFee` viene dalla prima invoice trovata)
7. Estende `currentTermEnd` di `missingMonths` mesi

### Bug in `getPaidSubscriptions` (subscriptions.ts:854-879)

```typescript
const paidSubscriptions = await collection
  .find({
    entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
    productId: productId,
    paymentStatus: PaymentStatusTypeEnum.Enum.SUCCEEDED,
    isRefunded: { $ne: true },
    businessEntityId: { $ne: 'DATAMARS' },
  })
  .sort({ currentTermStart: 1 })
  .toArray();
```

La query restituisce **un solo documento** (la sottoscrizione corrente), perché:
- In MongoDB esiste un solo documento per sottoscrizione Chargebee (vedi sezione architettura sopra)
- `productId` identifica un singolo dispositivo/petto
- Non esiste uno storico dei termini precedenti

Il `.sort({ currentTermStart: 1 })` e il `.reduce()` su `terms` suggeriscono che il codice **presumeva** di trovare più documenti (uno per ogni ciclo di fatturazione), ma questo non avviene mai nella realtà.

### Calcolo errato per PRTSUP-699

| Valore | Atteso | Calcolato |
|---|---|---|
| Mesi pagati | 3 (mag, giu, lug) | 1 (solo termine corrente: lug→ago) |
| `totalDaysPaid` | ~92 giorni | 31 giorni |
| `requiredDays` (FEE_GRACE_PERIOD_MONTHS=4) | 120 | 120 |
| `missingDays` | ~28 | 89 |
| `missingMonths` | 1 | 3 |
| Fee | €10.99 | €32.97 |
| `newTermEnd` | 2026-09-28 | 2026-11-28 |

### Flusso di cancellazione (stopRenewingSubscription/handler.ts:160-193)

```typescript
if (subscription.businessEntityId != 'DATAMARS') {
  const { fee, newTermEnd } = await calculateFee(
    subscription.productId!,
    subscriptionId,
    subscription.chargebeeSubscriptionId
  );
  if (fee > 0 && newTermEnd) {
    await sdk.applyCharges({ subscriptionId, amount: fee });        // → addebita €32.97
    await sdk.changeTermEnd({ subscriptionId, newTermEnd });        // → estende currentTermEnd a 2026-11-28
    isFailed = false;
  }
}
```

Il `cancelReason: retention_flow` **non bypassa** il calcolo della fee — viene solo salvato come metadato.

---
## Evidence

### MongoDB — Subscription (petlink.petlinkEverywhere)

```json
{
  "id": "b1cb3894-080c-48b5-9759-d48bdb48f669",
  "chargebeeSubscriptionId": "198eUbVL0G7pg1iD5",
  "entityType": "SUBSCRIPTION",
  "status": "non_renewing",
  "cancelReason": "retention_flow",
  "cancelReasonCode": "RETENTION_FLOW",
  "businessEntityId": "DMDS_KIPPY",
  "productId": "3047db24-84bf-46b7-86e8-c5d2c6c3806b",
  "createdAt": "2026-05-29T10:19:57.000Z",
  "startedAt": "2026-05-28T22:00:00.000Z",
  "activatedAt": "2026-05-28T22:00:00.000Z",
  "currentTermStart": "2026-07-28T22:00:00.000Z",
  "currentTermEnd": "2026-11-28T22:59:59.000Z",   // ← anomalia: 4 mesi da currentTermStart
  "nextBillingAt": null,
  "billingPeriod": 1,
  "billingPeriodUnit": "month",
  "paymentStatus": "SUCCEEDED",
  "updatedAt": "2026-08-06T15:09:55.000Z"
}
```

**Count conferma 1 solo documento:** `db.petlinkEverywhere.count({entityType: 'SUBSCRIPTION', chargebeeSubscriptionId: '198eUbVL0G7pg1iD5'})` → 1

### MongoDB — Invoices (3 fatture, tutte €10.99)

| Invoice | Date | Amount | Period |
|---|---|---|---|
| DS315577 | 2026-05-29 | €10.99 | (no dateFrom/dateTo) |
| DS322513 | 2026-06-28 | €10.99 | 2026-06-28 → 2026-07-28 |
| DS330152 | 2026-07-28 | €10.99 | 2026-07-28 → 2026-08-28 |

**Totale pagato**: 3 × €10.99 = €32.97 (per 3 mesi di abbonamento)

### Chargebee — Activity Log (verificato con screenshot prod)

> **Fonte**: screenshot della pagina Subscription Activity Log di Chargebee prod fornito dall'utente.

| Data/Ora (CEST) | Evento | Source | Note |
|---|---|---|---|
| 29-May-2026 12:19 | Active subscription created for SUB-000C-KBA-EUR-1M plan | Hosted page | Creazione iniziale |
| 29-Jun-2026 00:03 | Subscription modified | Scheduled activity | Rinnovo giugno |
| 29-Jul-2026 00:07 | Subscription modified | Scheduled activity | Rinnovo luglio |
| **06-Aug-2026 17:09** | **Subscription modified** | **API — Subscription Manager** | **`changeTermEnd` applicato** |
| **06-Aug-2026 17:09** | **Subscription scheduled for cancellation** | **API — chargebee_retention** | **Stop renew a fine termine esteso** |

### Chargebee — Events tab (confirma il flusso)

Eventi significativi nella timeline Chargebee:

| Data/Ora (CEST) | Evento | Source | Note |
|---|---|---|---|
| 29-May-2026 12:19 | Subscription created | Hosted page | Creazione iniziale |
| 29-May-2026 12:19 | Invoice generated DS315577 | Hosted page | Prima fattura €10.99 |
| 29-Jun-2026 00:03 | Subscription renewed | Scheduled job | Rinnovo giugno |
| 29-Jun-2026 00:08 | Invoice generated DS322513 | Scheduled job | Seconda fattura €10.99 |
| 29-Jul-2026 00:07 | Subscription renewed | Scheduled job | Rinnovo luglio |
| 29-Jul-2026 00:11 | Invoice generated DS330152 | Scheduled job | Terza fattura €10.99 |
| **06-Aug-2026 17:09** | **Subscription changed** | API — Subscription Manager | `changeTermEnd` applicato |
| **06-Aug-2026 17:09** | **Invoice generated DS332628** | API — Subscription Manager | **Early termination fee €32.97** |
| **06-Aug-2026 17:09** | **Subscription cancellation scheduled** | API — chargebee_retention | Stop renew a fine termine |

**Conclusione dai Chargebee events:**
- I webhook per i 3 rinnovi mensili sono **arrivati** correttamente.
- I webhook per la cancellazione / `changeTermEnd` / `applyCharges` sono **arrivati** correttamente (altrimenti l'evento non sarebbe in Chargebee).
- L'evento `invoice_generated` per DS332628 sembra non essere stato sincronizzato in MongoDB.

### Chargebee — Invoices tab (verificato con screenshot prod)

> **Fonte**: screenshot della pagina Invoices di Chargebee prod fornito dall'utente.

| ID | Status | Type | Created On | Total |
|---|---|---|---|---|
| DS315577 | PAID | Recurring | 29-May-2026 00:00 | €10,99 |
| DS322513 | PAID | Recurring | 29-Jun-2026 00:06 | €10,99 |
| DS330152 | PAID | Recurring | 29-Jul-2026 00:10 | €10,99 |
| **DS332628** | **PAID** | **One Time** | **06-Aug-2026 17:09** | **€32,97** |

La fattura **DS332628** di tipo **One Time** conferma che l'early termination fee di **€32.97** è stata realmente addebitata e pagata. L'importo €32.97 corrisponde esattamente a `3 mesi mancanti × €10.99`, coerente con il calcolo errato di `calculateFee` (`missingMonths = 3`).

### MongoDB — Early termination fee salvata come CHARGE (non INVOICE)

La fattura DS332628 **è presente in MongoDB** ma con `entityType: "CHARGE"`, non `"INVOICE"`. By design in `invoiceUpdatedHandler.ts:166-170`. Vedi sezione Refund Issue per dettagli.

### Code references

- `calculateFee`: `petlink-everywhere-core/src/lib/petlink/subscriptions.ts:890-1078`
- `getPaidSubscriptions`: `petlink-everywhere-core/src/lib/petlink/subscriptions.ts:854-879`
- `FEE_GRACE_PERIOD_MONTHS = 4`: `petlink-everywhere-core/src/lib/petlink/subscriptions.ts:50`
- `stopRenewingSubscription` handler: `petlink-everywhere-core/src/lambda_functions/graphql/mutation/stopRenewingSubscription/handler.ts:160-193`
- `subscriptionRenewedHandler`: `petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionRenewedHandler.ts:17-75`
- `subscriptionChangedHandler`: `petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionChangedHandler.ts:100-145`
- `getActiveSubscription`: `petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/utils.ts:92-125`
- `applyCharges` handler: `subscriptions-manager/src/lambdaFunctions/graphql/mutations/applyCharges/handler.ts`
- `changeTermEnd` handler: `subscriptions-manager/src/lambdaFunctions/graphql/mutations/changeTermEnd/handler.ts`

---

## Impact — Bug sistemico (non caso isolato)

### Conferma: la sovrascrittura è il comportamento normale

La sovrascrittura di `currentTermStart`/`currentTermEnd` a ogni rinnovo è **by design** nel codice (`subscriptionRenewedHandler` e `subscriptionChangedHandler` usano entrambi `findOneAndUpdate` sullo stesso `id`). Non è un webhook mancante né un'anomalia di questo caso. **Ogni** cliente Kippy EU con abbonamento mensile che ha subito almeno un rinnovo ha lo stesso pattern nel DB.

### Quanti clienti sono affected

**134 sottoscrizioni** Kippy EU mensili in stato `non_renewing` (cancellate) trovate in MongoDB al 2026-08-12.

Non tutte sono necessariamente affected dal bug della fee errata. Lo sono quelle che:
1. Hanno pagato **meno di 4 mesi** (sotto la soglia `FEE_GRACE_PERIOD_MONTHS`)
2. Sono state cancellate **dopo il grace period di 30 giorni** dalla creazione
3. Mostrano la segnatura del bug: `currentTermEnd` esteso di >1 mese rispetto a `currentTermStart`

Su un campione di 20 (su 134), **almeno 8 mostrano chiaramente la segnatura del bug**:

| Subscription ID | Chargebee ID | startedAt | Mesi pagati (da startedAt) | currentTermStart | currentTermEnd | Estensione anomala |
|---|---|---|---|---|---|---|
| `536742e9` | `198XsVVJ1kcHc1pNq` | 2026-05-07 | 3 | 2026-08-07 | 2026-11-07 | +3 mesi |
| `ff7833a9` | `BTU84tVNRMeMhgVD` | 2026-06-23 | 2 | 2026-07-23 | 2026-11-23 | +4 mesi |
| `6afabc63` | `BTceR3VNO1q5h3VoD` | 2026-06-22 | 2 | 2026-07-22 | 2026-11-22 | +4 mesi |
| `3f861772` | `BTcR80VM4Af4V3Ti3` | 2026-06-08 | 3 | 2026-08-08 | 2026-12-08 | +4 mesi |
| `a5a7833c` | `BTU1S7VL5Co0n53ri` | 2026-05-29 | 3 | 2026-07-29 | 2026-11-29 | +4 mesi |
| `9efb750d` | `BTctDBVJEZzpDADpO` | 2026-05-09 | 3 | 2026-08-09 | 2026-11-09 | +3 mesi |
| `d31e00d8` | `BTcvrJVKk4mt930Me` | 2026-05-25 | 3 | 2026-07-25 | 2026-11-25 | +4 mesi |
| `b1cb3894` (PRTSUP-699) | `198eUbVL0G7pg1iD5` | 2026-05-28 | 3 | 2026-07-28 | 2026-11-28 | +4 mesi |

**Segnatura del bug**: `currentTermEnd` = `currentTermStart` + 4 mesi (invece di +1 mese per un abbonamento mensile). Questo indica che `calculateFee` ha calcolato `missingMonths = 3` e ha esteso il termine di 3 mesi.

Le sottoscrizioni **non** affected nel campione sono:
- **Molto vecchie** (>4 mesi pagati, es. `2fa98435` startedAt 2024-11-05) → `totalDaysPaid` ≥ 120 → no fee
- **Molto nuove** (<30 giorni, entro grace period) → `calculateFee` skip → no fee
- **1 solo mese pagato** (es. `0d15f01a` startedAt 2026-08-07) → `currentTermEnd` = `currentTermStart` + 1 mese → fee corretta (3 × €10.99 = €32.97, che in questo caso è giusta perché ha pagato solo 1 mese su 4)

### Query MongoDB per recuperare tutte le sottoscrizioni potenzialmente affected

**Query 1 — Tutte le `non_renewing` Kippy EU mensili (134 totali):**
```javascript
db.petlinkEverywhere.find({
  entityType: 'SUBSCRIPTION',
  businessEntityId: { $ne: 'DATAMARS' },
  status: 'non_renewing',
  billingPeriod: 1,
  billingPeriodUnit: 'month'
}, {
  id: 1, chargebeeSubscriptionId: 1, startedAt: 1, activatedAt: 1,
  currentTermStart: 1, currentTermEnd: 1, createdAt: 1, updatedAt: 1,
  cancelReason: 1, businessEntityId: 1
}).sort({ updatedAt: -1 })
```

**Query 2 — Solo quelle con segnatura del bug (currentTermEnd esteso >1 mese):**
Questa aggregation calcola la differenza in mesi tra `currentTermEnd` e `currentTermStart` e filtra quelle con >1 mese di estensione (la segnatura del bug):
```javascript
db.petlinkEverywhere.aggregate([
  {
    $match: {
      entityType: 'SUBSCRIPTION',
      businessEntityId: { $ne: 'DATAMARS' },
      status: 'non_renewing',
      billingPeriod: 1,
      billingPeriodUnit: 'month'
    }
  },
  {
    $addFields: {
      termDurationMs: { $subtract: [{ $dateFromString: { dateString: '$currentTermEnd' } }, { $dateFromString: { dateString: '$currentTermStart' } }] },
      termDurationDays: {
        $floor: {
          $divide: [
            { $subtract: [{ $dateFromString: { dateString: '$currentTermEnd' } }, { $dateFromString: { dateString: '$currentTermStart' } }] },
            86400000
          ]
        }
      }
    }
  },
  {
    $match: {
      termDurationDays: { $gt: 35 }  // >35 giorni = più di 1 mese (con margine)
    }
  },
  {
    $project: {
      id: 1, chargebeeSubscriptionId: 1, startedAt: 1,
      currentTermStart: 1, currentTermEnd: 1,
      termDurationDays: 1, cancelReason: 1, businessEntityId: 1
    }
  },
  { $sort: { termDurationDays: -1 } }
])
```

**Query 3 — Per verificare se è stata addebitata una fee (incrociare con Chargebee):**
Per ogni subscription risultante dalla Query 2, verificare in Chargebee se esiste una fattura "One Time" con importo > €10.99. Se sì, il cliente è stato addebitato erroneamente.

---

## Proposed Fixes

Il problema fondamentale è che `calculateFee` usa `currentTermEnd - currentTermStart` della subscription per calcolare `totalDaysPaid`, ma questi campi riflettono solo l'ultimo termine (vengono sovrascritti a ogni rinnovo).

Di seguito 4 proposte con pro/contro. La scelta richiede valutazione del team.

### Opzione A — Usare le fatture pagate (più precisa)

Sostituire il calcolo di `totalDaysPaid` con la somma dei giorni coperti da tutte le fatture pagate (campo `items[].dateFrom` → `items[].dateTo`):

```typescript
// In calculateFee, sostituire getPaidSubscriptions con query sulle invoice
const paidInvoices = await collection
  .find({
    entityType: EntityTypeEnum.Enum.INVOICE,
    subscriptionId: subscriptionId,
    status: InvoiceStatusEnum.Enum.paid,
    isRefunded: { $ne: true },
  })
  .toArray();

const totalDaysPaid = paidInvoices.reduce((sum, invoice) => {
  const planItem = invoice.items?.find(i => i.itemType === 'plan_item_price');
  if (planItem?.dateFrom && planItem?.dateTo) {
    return sum + Math.floor(
      (new Date(planItem.dateTo).getTime() - new Date(planItem.dateFrom).getTime())
      / (1000 * 60 * 60 * 24)
    );
  }
  return sum;
}, 0);
```

**Pro:**
- Calcolo esatto: conta i giorni effettivamente pagati
- Gestisce edge case: trial, free period, coupon, rimborsi parziali
- Non dipende dai termini della subscription (che vengono sovrascritti)

**Contro:**
- La prima fattura (DS315577 nel caso PRTSUP-699) **non ha** `dateFrom`/`dateTo` → viene saltata, sottostimando di 1 mese. Bisogna gestire questo caso (es. fallback su `createdAt` della fattura o su `startedAt` della subscription)
- Richiede che tutte le invoice siano sincronizzate in MongoDB (sappiamo che almeno una one-time fee non è arrivata — bug secondario)
- Cambia la firma di `calculateFee`: invece di `getPaidSubscriptions(productId)` serve `subscriptionId` (che è già disponibile come parametro)
- Più complessa da testare

### Opzione B — Usare `startedAt` della subscription (più semplice)

Calcolare `totalDaysPaid` come differenza tra `now` e `startedAt` della sottoscrizione:

```typescript
// In calculateFee, sostituire getPaidSubscriptions con:
const subscription = currentSubscriptions[0]; // già recuperata sopra
const totalDaysPaid = Math.floor(
  (now.getTime() - new Date(subscription.startedAt).getTime())
  / (1000 * 60 * 60 * 24)
);
```

**Pro:**
- Fix minimale: 3-4 righe di codice
- `startedAt` non viene mai sovrascritto (è la data di attivazione originale)
- Nessuna query aggiuntiva su MongoDB
- Semplice da testare

**Contro:**
- Include i giorni di trial/free period nei giorni "pagati". Se un cliente ha avuto 30 giorni di trial prima di pagare, `totalDaysPaid` sarebbe sovrastimato di 30 giorni → fee sottostimata
- Non distingue tra periodi pagati e non pagati (es. dunning, pause)
- Potrebbe azzerare la fee per clienti che hanno avuto trial lunghi ma hanno pagato poco
- Meno precisa dell'Opzione A

### Opzione C — Usare `activatedAt` + numero di invoice pagate

Contare le invoice pagate e moltiplicare per `billingPeriod` in giorni:

```typescript
const paidInvoices = await collection.countDocuments({
  entityType: EntityTypeEnum.Enum.INVOICE,
  subscriptionId: subscriptionId,
  status: InvoiceStatusEnum.Enum.paid,
  isRefunded: { $ne: true },
});

const billingPeriodDays = subscription.billingPeriodUnit === 'month'
  ? subscription.billingPeriod * 30
  : subscription.billingPeriod === 1 && subscription.billingPeriodUnit === 'year'
    ? 365
    : 30;

const totalDaysPaid = paidInvoices * billingPeriodDays;
```

**Pro:**
- Semplice e robusta: conta le fatture, non dipende dai termini
- Non richiede `dateFrom`/`dateTo` sulle invoice (risolve il problema della prima fattura senza date)
- Più precisa dell'Opzione B (conta solo periodi effettivamente pagati)

**Contro:**
- Approssimata: usa 30 giorni fissi per mese invece della durata reale (28-31 giorni)
- Non gestisce rimborsi parziali (una fattura rimborsata parzialmente verrebbe comunque contata)
- Richiede che le invoice siano sincronizzate in MongoDB

### Opzione D — Salvare lo storico dei termini (fix strutturale)

Modificare `subscriptionRenewedHandler` per salvare i termini precedenti in un array `termHistory` invece di sovrascriverli:

```typescript
// In subscriptionRenewedHandler, prima di findOneAndUpdate:
await findOneAndUpdate(
  dbSecret,
  { id: oldSubscription.id },
  {
    $push: {
      termHistory: {
        currentTermStart: oldSubscription.currentTermStart,
        currentTermEnd: oldSubscription.currentTermEnd,
        updatedAt: oldSubscription.updatedAt,
      }
    }
  },
  petlinkGpsCollection
);
// Poi l'update normale con i nuovi termini
```

E in `calculateFee`, sommare i giorni da `termHistory` + termine corrente.

**Pro:**
- Fix strutturale: preserva lo storico per qualsiasi uso futuro
- Calcolo esatto in `calculateFee`
- Non dipende dalle invoice

**Contro:**
- Richiede migration del schema (aggiunta campo `termHistory`)
- Non risolve retroattivamente i dati esistenti (i termini passati sono già persi)
- Modifica un handler critico (più rischio di regression)
- Over-engineering se l'unico consumer è `calculateFee`

### Raccomandazione

- **Fix immediato (hotfix):** Opzione B (`startedAt`) — minimale, nessun rischio di regression, risolve il caso PRTSUP-699 e la maggior parte dei casi. Da integrare con un test che verifica il calcolo con 3 mesi pagati.
- **Fix di medio termine:** Opzione A (fatture) o C (count invoice) — più precisa, gestisce trial/free period. Richiede prima di risolvere il bug secondario della sincronizzazione one-time invoice.
- **Fix strutturale (futuro):** Opzione D (termHistory) — solo se serve lo storico per altri scopi oltre alla fee.

---

## Refund Issue — CCT refundInvoice 404 Error

### Sintomo

L'operatore CCT (christian.prete@datamars.com) ha tentato di rimborsare la fattura della early termination fee (DS332628, €32.97) tramite il frontend CCT. La mutation `refundInvoice` ha restituito:

```json
{
  "data": {
    "refundInvoice": {
      "code": "404",
      "message": "The resource cannot be found",
      "translationCode": null
    }
  }
}
```

### Root Cause del 404

Il flusso di refund è:

1. **CCT frontend** → `refundInvoice($invoiceId, $reason, $refunds)` mutation (CCT-core GraphQL)
2. **CCT-core** `refundInvoice/handler.ts` → `handleRefund()` in `refund.ts`
3. `handleRefund` cerca la invoice in MongoDB: `findItem({entityType: INVOICE, id: invoiceId})`
4. **Se non trovata → return 404 "The resource cannot be found"**
5. (Solo se trovata) → chiama `sdkSsm.refundInvoice()` su subscriptions-manager → Chargebee

La invoice della early termination fee (`f5a2eb28-f17d-42f3-b793-5a267ff10982` / DS332628) **è in MongoDB ma con `entityType: "CHARGE"`**, non `"INVOICE"`. `handleRefund` cerca solo `INVOICE` -> non la trova -> 404.

| MongoDB ID | Chargebee ID | Amount | entityType | Type |
|---|---|---|---|---|
| `c6dc9efa-...` | DS315577 | €10.99 | INVOICE | Recurring |
| `c04db35a-...` | DS322513 | €10.99 | INVOICE | Recurring |
| `841bccd5-...` | DS330152 | €10.99 | INVOICE | Recurring |
| `f5a2eb28-...` | DS332628 | €32.97 | **CHARGE** | One Time (ETF) |

Il rimborso non raggiunge mai Chargebee perché `handleRefund` filtra per `entityType: INVOICE` e il documento è salvato come `CHARGE`.

### Conferma dai log Grafana (Loki)

**Servizio:** `DatamarsCctCoreProd-refundInvoice`
**Request ID:** `9fa0a9d7-9e2b-4381-a8be-3705696341b7`
**Timestamp:** 2026-08-12T15:11:31Z (primo tentativo), 2026-08-12T15:07:57Z (secondo tentativo)

Log rilevanti (in ordine temporale):
```
received request: {"arguments":{"invoiceId":"f5a2eb28-f17d-42f3-b793-5a267ff10982","reason":"errore sw non doveva esser emessa la fee ma solo addebito della 4 rata","refunds":[{"chargebeeInvoiceItemId":"li_BTLbqMVRWtd0c32Kg","amount":2198}]}}
Invoice not found for id: f5a2eb28-f17d-42f3-b793-5a267ff10982
Refund result: {"code":"404","message":"The resource cannot be found"}
handler response_info code: 404 message: The resource cannot be found
```

**Nota:** L'operatore ha tentato di rimborsare €21.98 (amount: 2198 cent), non l'intero €32.97. Questo suggerisce che stava cercando di rimborsare solo la differenza (€32.97 - €10.99 = €21.98), ma il sistema non può procedere perché la invoice non esiste in MongoDB.

### Codice coinvolto

- **CCT-core handler:** `petlink-everywhere-cct-core/src/lambda_functions/graphql/mutation/refundInvoice/handler.ts:79-88`
- **handleRefund:** `petlink-everywhere-cct-core/src/lib/petlink/refund.ts:142-532`
  - **Lookup MongoDB (line 159-171):** `findItem({entityType: INVOICE, id: invoiceId})` → 404 se non trovata
- **Subscriptions-manager handler:** `subscriptions-manager/src/lambdaFunctions/graphql/mutations/refundInvoice/handler.ts:24-157`
  - **Chargebee refund (line 37-42):** `chargebeeClient.invoice.refund(invoiceId, {...})`
- **CCT frontend:** `petlink-everywhere-cct/src/components/common/ModalConfirmRefund.tsx:62-67`

### Bug del refund: mismatch entityType CHARGE vs INVOICE

La fattura DS332628 è una **One Time** invoice creata da `applyCharges` (subscriptions-manager). I webhook di Chargebee (`invoice_generated`, `invoice_updated`, `payment_succeeded`) sono **tutti arrivati correttamente** e processati dal SQS consumer, come confermato dai log Grafana.

L'`invoiceUpdatedHandler` salva intenzionalmente le fatture con description "EARLY TERMINATION FEE" come `entityType: "CHARGE"` (linea 166-170). Questo è by design per distinguere le charge adhoc dalle invoice ricorrenti.

Il problema è che `handleRefund` in `refund.ts:159-164` cerca solo `entityType: INVOICE`:
```typescript
const invoiceRes = await findItem<Invoice>(
  dbSecret,
  { entityType: EntityTypeEnum.Enum.INVOICE, id: invoiceId },  // solo INVOICE
  collection, 'PETLINK'
);
```

**Fix:** cambiare il filter per includere `CHARGE`:
```typescript
{ entityType: { $in: [EntityTypeEnum.Enum.INVOICE, EntityTypeEnum.Enum.CHARGE] }, id: invoiceId }
```

### Workaround per il rimborso

Poiché il CCT non può processare il rimborso (mismatch entityType), il rimborso deve essere effettuato **manualmente in Chargebee** fino al deploy del fix:
1. Aprire Chargebee → Customer → anna.deluca90@gmail.com
2. Invoice DS332628 → Refund → Credit Note con reason "other"
3. Importo: €32.97 (rimborso completo) o €21.98 (differenza)

---

## Additional Notes

- Il `cancelReason: retention_flow` non bypassa il calcolo della fee. Se il retention flow dovrebbe esentare il cliente dall'early termination fee, è necessario aggiungere un check nel `stopRenewingSubscription` handler.
- L'early termination fee invoice (Chargebee DS332628, €32.97, One Time) **è in MongoDB** ma salvata come `entityType: "CHARGE"` (by design in `invoiceUpdatedHandler.ts:166-170`). Il bug del refund 404 è un mismatch: `handleRefund` cerca solo `INVOICE`, non `CHARGE`. Fix: aggiungere `CHARGE` al filter.
- La teoria del collega "Chargebee non ha mai mandato eventi sul webhook" è **smentita** dalle evidenze: i 3 rinnovi mensili, il `subscription_changed`, l'`invoice_generated` DS332628 e la `subscription_cancellation_scheduled` sono tutti presenti in Chargebee.
- **Audit completo necessario**: identificare tutti i clienti affected tra i 134 `non_renewing` e pianificare rimborsi. Usare la Query 2 sopra per filtrare quelli con segnatura del bug, poi incrociare con Chargebee per confermare l'addebito della fee.
- **Jira comment pubblicato** su PRTSUP-699 con il summary completo dell'analisi (2026-08-12).
