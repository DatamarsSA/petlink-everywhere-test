# PRTSUP-767: prepaid importata dopo la registrazione e non adottata dal device

> **Status**: Unfixed
> **Severity**: High — subscription annuale pagata ma orfana; il device dipende da un free period manuale
> **Jira**: PRTSUP-767
> **Affected user**: Sandra Moreau (`sasamoreau@gmail.com`, app userId `df643a3b-2850-4725-be12-3f71a0dd630e`)
> **Device**: `ADN76EU` (`b53add19-1783-49b0-85b3-9881a2801d6c`, IMEI `356941177861056`)
> **Chargebee subscription**: `KPY-HP-149097`, ghost customer `KPY-PPD-826819`
> **Incident date**: 2026-08-14 — inconsistenza consolidata il 2026-08-17
> **Investigated**: 2026-08-21

## Summary

La cliente ha acquistato una prepaid nel legacy shop e ha registrato il device nella nuova app prima che l'IMEI dell'ordine fosse disponibile alla migration schedulata. I webhook Chargebee iniziali sono stati scartati intenzionalmente dal Core perché il ghost customer prepaid non corrisponde a un USER MongoDB. Durante `createPetlinkGps` non esisteva quindi ancora alcuna SUBSCRIPTION prepaid da adottare.

Tre giorni dopo, `orderScheduled` ha importato ordine, subscription e invoice e ha aggiornato `cf_DM_Serial_Number` da `PREPAID` ad `ADN76EU`. Il flusso di importazione, però, non esegue l'adozione se il device è già registrato: salva la subscription con il ghost `userId`, senza `productId`, e marca comunque l'ORDER_ITEM come `activated=true`. Non esiste un successivo meccanismo di riconciliazione. CCT cerca le subscription del device per `productId`, quindi mostra soltanto il free period manuale e non la prepaid pagata.

## Timeline

| Time (UTC) | Evento | Evidenza |
|---|---|---|
| 2026-08-14 09:08:23 | `invoice_generated` per `KPY-HP-149097` rifiutato: `SUBSCRIPTION NOT FOUND` | Loki Core `subsWebhookQueueConsumer`, request `da0d42ad-dec3-50a6-a5ad-205503855749` |
| 2026-08-14 09:08:23 | `subscription_created`, seriale `PREPAID`, rifiutato perché il ghost customer non è un USER MongoDB | Loki request `e7ea0365-e574-5a86-b9ae-619d38339d69` |
| 2026-08-14 09:08:24 | `payment_succeeded` rifiutato con `USER NOT FOUND` | Loki request `ace475cd-aa3b-5a35-abe1-1735777c420b` |
| 2026-08-14 09:09:49–50 | Registrazione di `ADN76EU`; log: `No prepaid subscription found` e `count: 0, isPrepaid: false` | Loki Core `createPetlinkGps`, request `053365e5-ffae-44a6-bf41-18f8f07db6a0` |
| 2026-08-14 13:40:01 | Support aggiunge free period NON_PAYING di 7 giorni e lo collega al device | Loki CCT `addFreePeriod`, request `7f5083de-0b2e-4724-a5a6-2d3bf1590091` |
| 2026-08-17 08:38:55–56 | `orderScheduled` seleziona la prevendita dopo l'aggiornamento legacy con IMEI, crea SUBSCRIPTION/INVOICE e risolve `ADN76EU` | Loki Data Migration, request `c4ba5810-ff02-4c8d-93f3-be71c82c0dd7` |
| 2026-08-17 08:38:56 | `orderScheduled` aggiorna Chargebee `cf_DM_Serial_Number` e marca l'ORDER_ITEM `activated=true`, senza collegare subscription e device | Stesso request; activity log Chargebee allegato |
| 2026-08-17 08:39:02 | `subscription_changed` viene accettato perché la migration ha appena creato la SUBSCRIPTION; aggiorna i campi ma non esegue l'adozione | Loki Core request `5995b0a5-5d79-553f-87ae-d25997ac6cfc` |

## Stato MongoDB prod

### USER

- `id`: `df643a3b-2850-4725-be12-3f71a0dd630e`
- `email`: `sasamoreau@gmail.com`
- `chargebeeId`: `df643a3b-2850-4725-be12-3f71a0dd630e`

### PETLINK_GPS `ADN76EU`

- `id`: `b53add19-1783-49b0-85b3-9881a2801d6c`
- `userId`: app user `df643a3b-2850-4725-be12-3f71a0dd630e`
- `subscriptionId`: free period `963448e5-cf4d-43fc-9d63-cfb3fdda17c7`
- `creationDate`: `2026-08-14T09:09:50.049Z`

### Prepaid pagata `KPY-HP-149097`

- `id`: `a371f8c8-4438-4a50-a423-9b1bafd04656`
- `status`: `active`
- `paymentStatus`: `SUCCEEDED`
- `isPrepaid`: `true`
- `serialNumber`: `ADN76EU`
- `userId`: ghost customer `KPY-PPD-826819`
- `productId`: assente
- `creationDate`: `2026-08-17T08:38:56.158Z`
- `currentTermEnd`: `2027-08-13T21:59:59.000Z`

### Free period manuale

- `id`: `963448e5-cf4d-43fc-9d63-cfb3fdda17c7`
- `businessEntityId`: `DATAMARS`
- `status`: `in_trial`
- `productId`: device `b53add19-1783-49b0-85b3-9881a2801d6c`
- `userId`: app user `df643a3b-2850-4725-be12-3f71a0dd630e`
- `currentTermEnd`: `2026-08-21T13:40:01.337Z`

### ORDER_ITEM

- `id`: `1dd87645-b610-4276-ba87-a02e4811f3f4`
- `serialNumber`: `ADN76EU`
- `imei`: `356941177861056`
- `activated`: `true`, nonostante la prepaid non sia collegata al device

## Root Cause

Il flow assume implicitamente che `createPetlinkGps` avvenga dopo la creazione/importazione della SUBSCRIPTION prepaid. L'adozione è un side effect one-shot della registrazione:

1. `handlePrepaidSubscription` cerca una SUBSCRIPTION attiva/in trial con stesso seriale e senza `productId`;
2. se la trova, collega device, subscription e invoice all'app user;
3. se non la trova, termina senza registrare un'attività da riconciliare.

Nel percorso inverso, `orderScheduled` importa la SUBSCRIPTION usando il customer ghost, aggiorna il seriale Chargebee e marca l'ORDER_ITEM attivato, ma non cerca un PETLINK_GPS già esistente. Anche `subscriptionChangedHandler` aggiorna soltanto la SUBSCRIPTION. Il risultato è una race/out-of-order gap permanente.

## Codice e versioni di produzione ispezionati

### Core

Commit durante gli eventi del 14 e 17 agosto:

- `472ad1c80af7f49997669bad1d979a5659127697` — merge `v2.3.34`, 2026-07-13

File coinvolti:

- `src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/handler.ts` — `checkAcceptedEvents` rifiuta gli eventi USER del ghost customer;
- `src/lambda_functions/graphql/mutation/createPetlinkGps/handler.ts` — registra il device e avvia il controllo prepaid;
- `src/lib/petlink/subscriptions.ts` — `handlePrepaidSubscription`, adozione one-shot;
- `src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionChangedHandler.ts` — update senza riconciliazione.

### Data migration

Commit durante l'import del 17 agosto:

- `84c5a02e3e7e31096fe7cb7f5b188652265ee816` — merge `v2.3.16`, 2026-07-20

File coinvolti:

- `src/lambda_functions/orderMigration/scheduled/handler.ts` — seleziona le prevendite EU con IMEI aggiornate negli ultimi sei minuti;
- `src/lambda_functions/orderMigration/util.ts` — `createSubscriptionPrepaid` salva ghost `userId`, non valorizza `productId`, aggiorna Chargebee e attiva l'ORDER_ITEM senza adottare il device.

### CCT Core

Commit al ticket:

- `a1b5b5d6a2a4ede3587b7c5eadfbb7f9e403c330`, 2026-08-17

`getSubscriptions` filtra per `productId === deviceId`. La prepaid senza `productId` è quindi correttamente assente; CCT non è la causa.

## Bug Classification

**Nuovo bug documentato correttamente sotto PRTSUP-767**: ordine/import prepaid successivo alla registrazione del device.

Una precedente scheda locale, già eliminata nel working tree prima di questa indagine, associava erroneamente gli stessi dati a PRTSUP-752. Jira PRTSUP-752 è invece un ticket diverso (`[PROD]-[KIPPY]: MIGRATION ISSUE`, utente Giusy Di Modica). Non va considerato un known bug valido per questa classificazione.

La documentazione `docs/subscriptions/sub-prepaid.md` copre order/buy/tracking/register, ma non l'ordine `order → buy → register → tracking/import`. In quella doc "Flow C" indica già lo scenario buyer ≠ registrant (transfer/clone); lo scenario di questo bug è quindi denominato **Flow D** nei test per evitare collisione.

## Proposed Fix

### Fix strutturale raccomandato

Estrarre l'adozione prepaid in un'operazione idempotente e richiamarla:

1. da `createPetlinkGps`, come oggi;
2. da `createSubscriptionPrepaid` dopo l'upsert della SUBSCRIPTION;
3. come fallback da `subscriptionChangedHandler` quando arriva un seriale reale e manca `productId`.

L'operazione deve:

- trovare PETLINK_GPS e registrazione per seriale;
- verificare che la prepaid sia pagata, attiva e non già adottata;
- impostare `SUBSCRIPTION.productId` e `SUBSCRIPTION.userId` all'app user;
- impostare `PETLINK_GPS.subscriptionId` alla prepaid;
- riallineare `INVOICE.userId`;
- chiudere/supersedere l'eventuale free period NON_PAYING;
- impostare `ORDER_ITEM.activated=true` soltanto dopo un'adozione riuscita.

### Recovery per PRTSUP-767

4 update MongoDB su `petlinkEverywhere` (prod). Goal: prepaid attiva e linkata, free period cancellato, nessun trial.

```javascript
// 1. Linkare la prepaid al device e all'app user
db.petlinkEverywhere.updateOne(
  { id: "a371f8c8-4438-4a50-a423-9b1bafd04656", entityType: "SUBSCRIPTION" },
  { $set: {
      productId: "b53add19-1783-49b0-85b3-9881a2801d6c",
      userId: "df643a3b-2850-4725-be12-3f71a0dd630e",
      updateDate: new Date().toISOString()
  }}
)

// 2. Ripuntare il device alla prepaid (attualmente punta al free period)
db.petlinkEverywhere.updateOne(
  { id: "b53add19-1783-49b0-85b3-9881a2801d6c", entityType: "PETLINK_GPS" },
  { $set: {
      subscriptionId: "a371f8c8-4438-4a50-a423-9b1bafd04656",
      updateDate: new Date().toISOString()
  }}
)

// 3. Riallineare l'invoice all'app user
db.petlinkEverywhere.updateOne(
  { id: "1540021e-019a-44ec-b32b-315c7dae9779", entityType: "INVOICE" },
  { $set: {
      userId: "df643a3b-2850-4725-be12-3f71a0dd630e",
      updateDate: new Date().toISOString()
  }}
)

// 4. Cancellare il free period manuale (già scaduto 2026-08-21)
db.petlinkEverywhere.updateOne(
  { id: "963448e5-cf4d-43fc-9d63-cfb3fdda17c7", entityType: "SUBSCRIPTION" },
  { $set: {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      updateDate: new Date().toISOString()
  }}
)
```

Non toccare: `USER.chargebeeId` (il ghost customer è parte del modello prepaid), Chargebee (la sub è già attiva e pagata), ORDER_ITEM (già `activated: true` con serial corretto).

Verifica post-recovery: CCT `getSubscriptions` per `ADN76EU` mostra solo la prepaid attiva; app `getSubscriptionByProductId` ritorna `currentTermEnd: 2027-08-13`; Sentinel riceve `subscription_active`.

## Testing Philosophy

Aggiungere test di integrazione per:

1. Flow A — `order → tracking → buy → register`;
2. Flow B — `order → buy → tracking → register`;
3. Flow D — `order → buy → register → tracking/import` (scenario PRTSUP-767; denominato D per evitare collisione con il Flow C "buyer ≠ registrant" di `sub-prepaid.md`);
4. retry/duplicazione di `orderScheduled` e `subscription_changed`;
5. device con free period già presente.

Asserzioni finali: una sola subscription operativa per device, prepaid con `productId` e app `userId`, backlink del device corretto, invoice riallineata e ORDER_ITEM attivato solo a collegamento completato.

## Remaining Uncertainty

- Il timestamp esatto di `abbonamenti_prevendita.updated_at` non è nel payload loggato; la query prova però che era nei sei minuti precedenti al run del 17 agosto.
- Non è determinabile dai log perché la cliente abbia potuto registrare il device prima dell'associazione IMEI alla prevendita.
- Il server MCP `chargebee-prod` non era disponibile; gli eventi sono stati verificati tramite allegati, payload SQS prod e risposta API Chargebee loggata da `orderScheduled`.
