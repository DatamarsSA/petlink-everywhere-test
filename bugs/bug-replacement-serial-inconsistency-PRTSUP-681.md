# PRTSUP-681 — Sostituzione dispositivo: serial number prodotto e sottoscrizione divergono

## Ticket

- **Jira**: PRTSUP-681
- **Utente**: `virgi.rossi.95@outlook.it`
- **Customer Chargebee**: `KPY-33426` (Virginia Rossi)
- **UserId Petlink**: `6269a0df-dd42-4ba8-803d-36cf080ed05b`
- **Prodotto (PETLINK_GPS)**: `0e74e5c7-3a89-42d4-bb8d-fc1046100404`
- **Pet**: `cdf6aa8c-dbaf-4267-b5e7-e15bc16c1c56`
- **Sottoscrizione**: `04ea6f2e-5995-41b3-abc6-8a917b6d23aa` / Chargebee `KPY-HP-48451`
- **Dispositivo vecchio**: `ANCEEMC`
- **Dispositivo nuovo**: `AFM6M9L`

## Sintomo

- **Vecchio CCT**: mostra solo il nuovo serial `AFM6M9L`.
- **Nuovo CCT**: mostra solo il vecchio serial `ANCEEMC`.

## Spiegazione ad alto livello

Il dispositivo è stato sostituito (o la sottoscrizione è stata aggiornata) nel vecchio sistema / Chargebee, che ha scritto il nuovo serial `AFM6M9L` sulla sottoscrizione e ha generato un webhook `subscription_changed`.
La coda `subscriptionsWebhookQueue` di Core ha applicato il nuovo serial alla sottoscrizione in MongoDB, **ma non ha aggiornato il documento `PETLINK_GPS`**, che è rimasto con serial `ANCEEMC`.

Quando l'utente ha successivamente tentato la procedura di sostituzione dall'app nuova (`replacement`), la mutazione è fallita con il messaggio *"GPS not associable, AFM6M9L have subscriptions ongoing"*: il nuovo serial è già presente su una sottoscrizione attiva, che è la stessa sottoscrizione che si vuole spostare. Questo ha bloccato l'aggiornamento del prodotto, lasciando il sistema in uno stato inconsistente.

## Evidenze

### 1. Webhook Chargebee `subscription_changed` con nuovo serial

```
2026-07-13T21:22:33Z
service_name: DatamarsSubscriptionsManagerProd-webhookLambda
event_type: subscription_changed
subscription.id: KPY-HP-48451
customer.id: KPY-33426
customer.email: virgi.rossi.95@outlook.it
cf_DM_Serial_Number: AFM6M9L
```

Il payload contiene `cf_DM_Serial_Number: "AFM6M9L"`, cioè il serial del dispositivo associato alla sottoscrizione in Chargebee è stato cambiato nel vecchio sistema.

### 2. `subsWebhookQueueConsumer` aggiorna la sottoscrizione ma non il prodotto

```
2026-07-13T21:22:43Z
service_name: DatamarsPetlinkEverywhereCoreProd-subsWebhookQueueConsumer
```

Il consumer aggiorna il documento `SUBSCRIPTION` in `petlinkEverywhere`:

```json
{
  "entityType": "SUBSCRIPTION",
  "id": "04ea6f2e-5995-41b3-abc6-8a917b6d23aa",
  "productId": "0e74e5c7-3a89-42d4-bb8d-fc1046100404",
  "serialNumber": "AFM6M9L",
  "chargebeeSubscriptionId": "KPY-HP-48451",
  "status": "active",
  "updateDate": "2026-07-13T21:22:43.667Z",
  "updatedAt": "2026-07-13T21:22:33.000Z",
  "userId": "6269a0df-dd42-4ba8-803d-36cf080ed05b"
}
```

### 3. Chiamata `replacement` fallita

```
2026-07-13T21:28:41Z
service_name: DatamarsPetlinkEverywhereCoreProd-replacement
arguments:
  productId: 0e74e5c7-3a89-42d4-bb8d-fc1046100404
  newSerialNumber: AFM6M9L
  entityType: PETLINK_GPS
```

La risposta è:

```
GPS not associable, AFM6M9L have subscriptions ongoing
```

Questo è loggato dal controllo iniziale di `handlerGpsReplacement`:

```typescript
const subscriptionCount = (
  await countItems(dbSecret, {
    entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
    serialNumber: newSerialNumber,
    status: { $nin: [closed, cancelled] }
  }, COLLECTION_NAME)
).count || 0;

if (subscriptionCount > 0) {
  logger.error(`GPS not associable, ${newSerialNumber} have subscriptions ongoing`);
  return { code: '428', ... };
}
```

Il serial `AFM6M9L` è sulla sottoscrizione `04ea6f2e-...`, attiva e riferita allo stesso prodotto: la sostituzione si auto-blocca.

### 4. Prodotto rimasto con serial vecchio

Log di `DatamarsCctCoreProd-getReplacementPetlinkGpsHistory` e `DatamarsCctCoreProd-getDevices` mostrano:

- `PETLINK_GPS`:
  - `id`: `0e74e5c7-3a89-42d4-bb8d-fc1046100404`
  - `serialNumber`: `ANCEEMC`
- `SUBSCRIPTION` collegata:
  - `id`: `04ea6f2e-5995-41b3-abc6-8a917b6d23aa`
  - `serialNumber`: `AFM6M9L`

### 5. `getDevices` del nuovo CCT mostra il serial del prodotto

Il pipeline di `getDevices` in `petlink-everywhere-cct-core/src/lambda_functions/graphql/query/getDevices/handler.ts` mappa:

```
serialId: "$serialNumber"
```

ove `$serialNumber` è il campo del documento `PETLINK_GPS`. Quindi il nuovo CCT mostra `ANCEEMC`.

## Cause tecniche

1. **`subscriptionChangedHandler` non propaga il serial al prodotto.**
   In `petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/subscriptionChangedHandler.ts` il consumer aggiorna solo il documento `SUBSCRIPTION`:

   ```typescript
   await findOneAndUpdate(
     dbSecret,
     subscriptionFilter,
     {
       serialNumber: data.serialNumber,
       status: data.subscription.status,
       ...
       updateDate: new Date().toISOString()
     },
     petlinkGpsCollection
   );
   ```

   Non esiste alcun aggiornamento del corrispondente `PETLINK_GPS.serialNumber`.

2. **`replacement` non riesce a riallineare il prodotto.**
   In `petlink-everywhere-core/src/lambda_functions/graphql/mutation/replacement/handler.ts` la funzione `handlerGpsReplacement` esegue un controllo globale che non distingue la sottoscrizione del prodotto che si sta sostituendo:

   ```typescript
   const subscriptionCount = (
     await countItems(dbSecret, {
       entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
       serialNumber: newSerialNumber,
       status: { $nin: [...] }
     }, COLLECTION_NAME)
   ).count || 0;
   ```

   Se il nuovo serial è già scritto sulla sottoscrizione del prodotto corrente (ad esempio per via di un webhook precedente), il conteggio è `> 0` e la mutazione restituisce `428`. Il prodotto non viene mai aggiornato.

## Impatto

- Disallineamento tra serial del prodotto in MongoDB e serial della sottoscrizione in Chargebee / MongoDB.
- Il nuovo CCT mostra il dispositivo vecchio, mentre il vecchio CCT / Chargebee mostra quello nuovo.
- L'utente non riesce a completare autonomamente la sostituzione dall'app nuova.

## Possibili fix

1. **Nel `replacement` mutation escludere dal conteggio la sottoscrizione del prodotto che si sta sostituendo**, oppure confrontare `productId`/`subscriptionId` per non considerare la sottoscrizione corrente come sottoscrizione "esterna" già associata al nuovo serial. Questo permetterebbe alla mutazione di riallineare il prodotto anche dopo un aggiornamento della sottoscrizione avvenuto fuori dal flusso.

2. **Aggiornare anche il prodotto in `subscriptionChangedHandler`**: se il payload del webhook contiene `serialNumber` e la sottoscrizione ha `productId`, sincronizzare `PETLINK_GPS.serialNumber` e inserire un `PETLINK_GPS_REPLACEMENT` history coerente, oppure almeno segnalare l'inconsistenza.

3. **Rendere il flusso di sostituzione idempotente e resistente a stati intermedi**: separare il controllo "nuovo serial già usato da altro utente" dal caso in cui il serial è già presente solo sulla sottoscrizione che si sta spostando.

## Note aggiuntive

- La sostituzione è stata avviata dal sistema legacy/Chargebee, non dal nuovo flusso `replacement` di Core.
- La migrazione delle storicizzazioni (`kippyRejectSubsMigration`) ha creato replacement history con `productId: UNKNOWN_MIGRATED` e `petId` non corretto a causa di un `findItem<Pet>` senza filtri; questo però non è la causa principale di PRTSUP-681.
