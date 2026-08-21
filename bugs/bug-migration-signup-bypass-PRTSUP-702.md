# Bug — Cliente legacy si re-registra via signUpUser invece di migrare (abbonamento perso)

> **Status**: Unfixed
> **Severity**: High — account duplicato: il nuovo account resta senza abbonamento, l'account legacy resta non migrato (rischio doppia identità/doppia fatturazione)
> **Jira**: PRTSUP-702
> **Affected user**: `siriana1974.gioscia@gmail.com` (legacyId MySQL `214984`, KIPPY EU; nuovo userId `952500b1-d154-421f-b600-d9cf65d72bda`)
> **Incident date**: 2026-08-06 (registrazione) — ticket aperto 2026-08-12
> **Last verified**: 2026-08-13

---

## Summary

La cliente NON è mai stata migrata. Il 2026-08-06 alle 12:48 UTC si è registrata ex-novo sulla nuova app Kippy (flusso `signUpUser` con OTP), usando la stessa email dell'account legacy. `signUpUser` controlla i duplicati **solo nel nuovo MongoDB** e non interroga mai il MySQL legacy: non trovando duplicati ha creato un account nuovo. La cliente ha poi creato il pet ("Milu", gatta) e associato il device `ADHF22P` — senza alcun abbonamento, perché quello legacy (piano "Zero"/prepaid, `legacyPlanProfileId: CAT_ZERO_GDSP_EU`) non è mai stato migrato.

Coerente con il ticket: nel vecchio CCT il cliente 214984 **non** risulta "Migrated" perché la migration pipeline non è mai partita (`user.migrated = 0` in MySQL, zero record in `migrationHistory`, zero log delle lambda di migration).

---

## Timeline ricostruita (UTC)

| Data/ora | Evento | Fonte |
|---|---|---|
| 2026-08-06 12:48:14 | `signUpUser`: nuovo utente Cognito + Mongo creato (OTP flow), appBrand KIPPY | Loki `CoreProd-signUpUser` |
| 2026-08-06 12:52:07 | Pet "Milu" creato | MongoDB PET `9029985f-eca3-4c41-a906-3177513d6dfc` |
| 2026-08-06 12:53:17 | `createPetlinkGps` serial `ADHF22P` → "Subscription check - count: 0", `subscriptionIsActive: false` | Loki `CoreProd-createPetlinkGps` |
| 2026-08-09 ~10:50–12:06 | Prime chiamate `checkMigration` con la sua email → utente già presente in Mongo → `success.user_exists`, niente migration. Una chiamata con typo `ssiriana1974...` finisce su MySQL → non trovata | Loki `CoreProd-checkMigration` |
| 2026-08-12 13:21 | Support aggiunge free period 30gg → SUBSCRIPTION `d3d7fce0-92ac-4124-a4cd-c6efe7a71ec4` NON_PAYING, `in_trial`, termEnd 2026-09-11 | MongoDB + ticket |

---

## Evidence

### MongoDB prod (`petlink`)

**USER** `952500b1-d154-421f-b600-d9cf65d72bda`:
- Nessun campo `legacyId` / `migrated` (gli utenti migrati li hanno, cfr. PRTSUP-701)
- `chargebeeId: "952500b1-..."` — UUID nuovo = customer Chargebee appena creato, NON il legacy `KPY-xxxxx`
- Un solo USER con questa email nel nuovo DB (nessun duplicato interno)

**migrationHistory**: 0 documenti per `userId: "214984"`, per `email: siriana1974...`, per nuovo userId → migration mai eseguita.

**petlinkGpsInventory** `ADHF22P`: `legacyPlanProfileId: "CAT_ZERO_GDSP_EU"`, `planProfileId: "DEFAULT"`, model CAT, imei `356941171464048`.

**PETLINK_GPS_REPLACEMENT / RESET / RETURN** per `ADHF22P`: 0 documenti (no sostituzioni nel nuovo sistema).

### Loki prod (datasource "Loki Petlink", aeomdt6w6e0hsb)

- `{service_name=~"DatamarsPetlinkDataMigrationProd-.*"} |= "214984"` e `|= "siriana1974"` (Aug 1–13): **zero risultati** — `migrationOnDemand` / `subscriptionMigration` mai invocate per questo utente.
- `{service_name="DatamarsPetlinkEverywhereCoreProd-signUpUser"}`: "received request" con email + OTP `42782`, poi "Created user" Cognito `FORCE_CHANGE_PASSWORD` → registrazione standard.
- `createPetlinkGps`: "No prepaid subscription found for serial number: ADHF22P" (lookup prepaid nel nuovo sistema; la sub prepaid è nel legacy).

### Codice (branch `prod`, commit `e18444fe` del 2026-07-06, v2.3.26 — versione in produzione all'incident date)

- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/mutation/signUpUser/handler.ts:88-104` — duplicate check solo su MongoDB (`countItems` su `petlinkEverywhere`); **zero** riferimenti a MySQL/legacy nel file (verificato con `git show prod:...`).
- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts:84-112` — il gate della migration interroga MySQL (`SELECT user.* FROM user WHERE migrated = 0 AND ... user.email = ?`) ma è una **query** che l'app invoca solo nel flusso di login con password; il flusso di registrazione lo salta.
- Se la migration fosse partita, `subscriptionMigration` avrebbe migrato la sub prepaid "Zero" via `getChargebeePrepaidUsersByImei` (`all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/subscriptionMigration/util.ts:1074-1101` + handler.ts:216-311 — funziona anche senza customer Chargebee principale). `CAT_ZERO_GDSP_EU` mappa a profilo DEFAULT/prepaid (`all-repo/petlink-data-migration/src/lib/util/inventoryUpdater.ts:431`).

---

## Root Cause

**`signUpUser` non verifica l'esistenza dell'email nel MySQL legacy.** Un cliente legacy non migrato che sceglie "Registrati" (invece di fare login e innescare `checkMigration` → `startMigration`/`userMigration` Cognito trigger → `migrationOnDemand`) crea un'identità duplicata:

1. Nuovo account senza abbonamento (quello legacy resta nel vecchio sistema)
2. Account legacy 214984 con `migrated = 0` → vecchio CCT correttamente non mostra "Migrated"
3. Il device viene riassociato al nuovo account (`createPetlinkGps` non verifica ownership legacy del seriale)
4. Se la sub legacy è pagante/attiva, rischio fatturazione su un account orfano

### Uncertainty / Missing evidence

- Stato attuale della sottoscrizione legacy del cliente 214984 (attiva/prepagata/scaduta): MySQL legacy non accessibile da MCP. Il `legacyPlanProfileId: CAT_ZERO_GDSP_EU` indica un piano "Zero" (servizio bundled/prepaid, sub in Chargebee agganciata a un customer prepaid per IMEI). Da verificare nel vecchio CCT pagina payments del ticket.
- Perché la cliente ha scelto registrazione invece di login: non determinabile dai log.

---

## Proposed Fix

### 1. Recovery per questa cliente
- Verificare nel vecchio CCT / MySQL se 214984 ha sub attiva o prepaid (IMEI `356941171464048` → tabella prepaid, cfr. `getChargebeePrepaidUsersByImei`).
- Se sì: migrare manualmente la sub nel nuovo sistema (creare SUBSCRIPTION entity linkata al device `a31feb51-9396-4806-ae91-50e47cc8c611`, aggiornare `chargebeeId` utente al customer legacy, marcare `migrated = 1` in MySQL) — simile al recovery di PRTSUP-693.
- NON rilanciare `migrationOnDemand` secco: l'utente esiste già in Mongo/Cognito → fallirebbe a `createUser` (cfr. PRTSUP-670). Alternativa: `userCleanup` + re-migration, ma si perderebbe il free period manuale già attivo.

### 2. Fix strutturale (code)
In `signUpUser/handler.ts`, dopo il check duplicati su MongoDB, aggiungere check su MySQL legacy (stessa query di `checkMigration`: `migrated = 0 AND email = ?`, filtrato per brand):
- se l'email esiste in legacy e non è migrata → ritornare errore dedicato (es. `errors.user_should_migrate`) così l'app redirige al flusso di migration invece di creare un duplicato.

---

## Related bugs

- `bug-migration-replacement-subs-mismatch-PRTSUP-693.md` — altra variante di "sub legacy persa" (lì migration eseguita ma customer Chargebee legacy non interrogato)
- `bug-migration-username-exists-PRTSUP-670.md` — rilevante per la strategia di recovery (migrationOnDemand fallisce se l'utente esiste già)
