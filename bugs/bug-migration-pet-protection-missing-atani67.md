# Bug: Pet Protection non migrata — atani67@gmail.com

> **Status**: Unfixed
> **Affected user**: `atani67@gmail.com` (legacyId `171305`, KIPPY EU)
> **Chargebee IDs**: `KPY-73227` (new), `KPY-PPL-73227` (legacy)
> **Migration date**: 2026-07-13 23:56 locali (21:56 UTC)
> **Session ID**: `bef33a3c-9d56-4720-996c-4ddf055b05e7`

---

## Problema

La migrazione di Andrea Tani è completata con successo (200) su tutti i 9 target. La pet protection non è stata migrata: il target SUBSCRIPTIONS riporta `petProtectionsMigrated: 0`. Non ci sono errori nei log, nessun rollback, nessun warning.

---

## Fatti dai log (Grafana Loki, datasource `aeomdt6w6e0hsb`)

### Timeline subscriptionMigration (21:56:29 – 21:56:33 UTC)

| Timestamp (UTC) | Log |
|---|---|
| 21:56:29 | `SUBSCRIPTION MIGRATION: START` |
| 21:56:30 | `getUserChargebeeIds` → `cb_customer_id: KPY-73227`, `cb_legacy_customer_id: KPY-PPL-73227` |
| 21:56:30 | `Found legacy customer: KPY-PPL-73227` |
| 21:56:30 | `Obtained chargebeeIds: {"customerId":"KPY-73227","legacyCustomerId":"KPY-PPL-73227"}` |
| 21:56:30 | `User 171305 is on new business entity` → usa `KPY-73227` |
| 21:56:30 | `prepaidCustomerIds: []` |
| 21:56:31 | `Searching subs for customer KPY-73227` |
| 21:56:31 | `Collected subscriptions: [{"subscription":{"id":"KPY-MOV-73438","status":"in_trial","due_invoices_count":0,...}}]` |
| 21:56:31 | `Extracted serial numbers: ["AJRT7TU"]` |
| 21:56:31 | `No phantom order duplicates found` |
| 21:56:32 | `Converting sub WITHOUT invoice` |
| 21:56:33 | `Conversion result: {"chargebeeSubscriptionId":"KPY-MOV-73438","status":"in_trial",...}` |
| 21:56:33 | `Saving data to db` |
| 21:56:33 | `Saving subscriptions` |
| 21:56:33 | `Insert result: {"acknowledged":true,"insertedCount":1}` |
| 21:56:33 | `Updating device AJRT7TU with active subscription 58d1e472-...` |
| 21:56:33 | `Getting remaining invoices for user KPY-73227` |
| 21:56:33 | `SUBSCRIPTIONS MIGRATION: END` |

### Fatti deterministici dai log

1. Il sistema recupera entrambi i Chargebee ID: `KPY-73227` (new) e `KPY-PPL-73227` (legacy)
2. Il sistema sceglie `KPY-73227` come `chargebeeId` (log: `User 171305 is on new business entity`)
3. La ricerca subscription viene fatta solo su `KPY-73227` (log: `Searching subs for customer KPY-73227`)
4. `KPY-73227` ha 1 subscription: `KPY-MOV-73438`, stato `in_trial`, `due_invoices_count: 0`
5. Il fallback a `KPY-PPL-73227` **non scatta** — non esiste nessun log che menzioni `KPY-PPL-73227` dopo il recupero iniziale degli ID
6. La subscription viene convertita senza invoice (log: `Converting sub WITHOUT invoice`)
7. La ricerca "remaining invoices" usa `KPY-73227` (log: `Getting remaining invoices for user KPY-73227`)
8. Nei log non compaiono mai le stringhe `Saving invoices` o `Saving pet protections`
9. La migrazione termina con successo, nessun errore

---

## Fatti dal DB (`migrationHistory`)

### Target SUBSCRIPTIONS

| Campo | Valore |
|---|---|
| chargebeeSubscriptionsMigrated | 1 |
| chargebeeSubscriptionsTotal | 1 |
| invoicesMigrated | 0 |
| invoicesTotal | 0 |
| creditNotesMigrated | 0 |
| creditNotesTotal | 0 |
| petProtectionsMigrated | 0 |
| petProtectionsTotal | 0 |
| includedSubscriptionsMigrated | 0 |
| includedSubscriptionsTotal | 0 |

### Tutti i target della sessione (nessun fallimento, nessun rollback)

| Target | Migrato | Totale |
|---|---|---|
| USER | 1 | 1 |
| PETS_AND_PRODUCTS | 1 pet, 1 product | 1, 1 |
| ENERGY_SAVING_AREAS | 1 | 1 |
| GEOFENCES | 1 | 1 |
| SUBSCRIPTIONS | 1 sub, 0 invoice, 0 pet protection | 1, 0, 0 |
| PET_NOTIFICATIONS | 8 | 8 |
| ACTIVITIES | 59 | 59 |
| POSITION_HISTORY | 141 | 141 |
| RESETS_AND_REPLACEMENTS | 0 | 0 |

---

## Fatti dal codice

### Fatto 1: Il fallback al legacy customer scatta solo se il new customer ha 0 subscription

`subscriptionMigration/handler.ts:260-281`:

```typescript
if (
  userCbSubscriptions.length === 0 &&
  chargebeeId === chargebeeIds.customerId &&
  chargebeeIds.legacyCustomerId
) {
  chargebeeId = chargebeeIds.legacyCustomerId;
  // ... cerca subscription sul legacy
}
```

La condizione è `userCbSubscriptions.length === 0`. Poiché `KPY-73227` aveva 1 subscription, il fallback non scatta. `cbUserId` rimane `KPY-73227`.

### Fatto 2: La ricerca "remaining invoices" usa `cbUserId`

`subscriptionMigration/handler.ts:526-532`:

```typescript
if (cbUserId) {
  logger.info(`Getting remaining invoices for user ${cbUserId}`);
  const remainingInvoices = await getInvoicesExcludingSubscriptionIds(
    cbSubscriptions.map((sub) => sub.subscription.id),
    cbUserId,
    chargebeeClient
  );
```

`cbUserId` è `KPY-73227`. Le invoice sono cercate solo per questo customer.

### Fatto 3: Le pet protection vengono costruite solo se esistono invoice

`subscriptionMigration/util.ts:1200-1256`:

```typescript
if (invoices.length > 0) {
  // salva invoice
  // filtra invoice con item matching PET_PROTECTION_IDS
  // per ogni invoice matching → buildPetProtectionFromChargebee
  // salva pet protection
}
```

L'intero blocco che costruisce e salva le pet protection è dentro `if (invoices.length > 0)`. Con 0 invoice, il blocco non viene eseguito.

### Fatto 4: `buildPetProtectionFromChargebee` riceve un invoice come input

`subscriptionMigration/util.ts:683-694`:

```typescript
export async function buildPetProtectionFromChargebee(
  invoice: Invoice,
  chargebeeClient: Chargebee,
  ...
): Promise<PetProtection | null> {
```

La funzione richiede un `Invoice` come parametro obbligatorio. Senza invoice, non può essere chiamata.

---

## Catena causale (deterministica)

1. `KPY-73227` ha 1 subscription (`KPY-MOV-73438`, `in_trial`, 0 invoice)
2. Il fallback a `KPY-PPL-73227` non scatta perché la condizione richiede 0 subscription (ne ha 1)
3. `cbUserId` = `KPY-73227`
4. Ricerca invoice per subscription → 0 (subscription in trial)
5. Ricerca "remaining invoices" per `KPY-73227` → 0
6. `invoices` array vuoto
7. `saveEntities` salta il blocco `if (invoices.length > 0)` → 0 pet protection
8. Migration completa con successo, 0 pet protection

---

## Subscription migrata

```
chargebeeSubscriptionId: KPY-MOV-73438
status: in_trial
serialNumber: AJRT7TU
itemPriceId: SUB-0000-KPR-EUR-1Y
trial_start: 2026-06-02
trial_end: 2026-12-02
next_billing_at: 2026-12-02
due_invoices_count: 0
```

## Dati utente sul nuovo DB

```json
{
  "id": "d710b3e2-f43e-4091-b3ea-c0a17da1e168",
  "name": "Andrea",
  "surname": "Tani",
  "email": "atani67@gmail.com",
  "phone": "+393284790180",
  "language": "IT",
  "countryCode": "IT",
  "chargebeeId": "KPY-73227",
  "appBrand": "KIPPY",
  "legacyId": "171305"
}
```

---

## Cosa NON sappiamo (da log e DB)

- Se `KPY-PPL-73227` ha subscription o invoice
- Se la pet protection sul vecchio DB è collegata a un invoice di `KPY-PPL-73227` o di `KPY-73227`
- Se esiste un record in `kcare_pet_protection` per questo utente in MySQL

---

## Verifiche da fare

1. **MySQL `kcare_pet_protection`**: verificare se esiste un record per `id_account` 73227 e a quale `id_ordine` / `cb_invoice_id` è collegato
2. **MySQL `cb_invoice`**: verificare se l'`id_ordine` della pet protection mappa a un `cb_invoice_id` sotto `KPY-PPL-73227` o `KPY-73227`
3. **Chargebee `KPY-PPL-73227`**: verificare se esistono subscription e/o invoice sotto questo account

---

## Fix options

### Opzione A — Fallback al legacy anche con subscription ma 0 invoice

Estendere la condizione di fallback per scattare anche quando il new customer ha subscription ma 0 invoice.

**File**: `subscriptionMigration/handler.ts:260-281`

```typescript
// Attuale:
if (
  userCbSubscriptions.length === 0 &&
  chargebeeId === chargebeeIds.customerId &&
  chargebeeIds.legacyCustomerId
)

// Proposta:
if (
  chargebeeId === chargebeeIds.customerId &&
  chargebeeIds.legacyCustomerId &&
  (userCbSubscriptions.length === 0 || totalInvoicesFound === 0)
)
```

### Opzione B — Cercare pet protection direttamente in MySQL

Scollegare la pet protection dalla presenza di invoice in Chargebee, query `kcare_pet_protection` per `id_account`:

```sql
SELECT kcare_pet_europass.*, kcare_pet_protection.*
FROM kcare_pet_protection
LEFT JOIN kcare_pet_europass ON kcare_pet_protection.id_europass = kcare_pet_europass.id
WHERE kcare_pet_protection.id_account = ?
```

### Opzione C — Pet protection da dati MySQL per subscription in_trial

Quando una subscription è `in_trial` senza invoice, ma esiste un record in `kcare_pet_protection`, costruire la pet protection direttamente dai dati MySQL.

---

## Files coinvolti

| File | Riga | Ruolo |
|---|---|---|
| `subscriptionMigration/handler.ts` | 260-281 | Fallback legacy customer — condizione `userCbSubscriptions.length === 0` |
| `subscriptionMigration/handler.ts` | 526-532 | Remaining invoices — usa `cbUserId` (sempre `KPY-73227` in questo caso) |
| `subscriptionMigration/util.ts` | 1200-1256 | `saveEntities` — pet protection costruita dentro `if (invoices.length > 0)` |
| `subscriptionMigration/util.ts` | 683-694 | `buildPetProtectionFromChargebee` — richiede `Invoice` come parametro obbligatorio |
