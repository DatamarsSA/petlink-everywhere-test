# Bug PRTSUP-750 — Device Reassigned to New User Blocks Migration (Infinite Retry Loop)

> **Status**: Unfixed (existing case needs manual resolution; new cases prevented by old-env blocks)
> **Severity**: High — user permanently locked out, infinite retry loop
> **Jira**: PRTSUP-750
> **Known bug reference**: Related to [bug-migration-orphan-products-PRTSUP-597.md](./bug-migration-orphan-products-PRTSUP-597.md) — same infinite retry mechanism, different root cause
> **Affected user**: `mag74@hotmail.it` (legacyId `212136`, KIPPY EU)
> **Date discovered**: 2026-08-19
> **Prevention**: Blocks added on old environment (2026-08-18) prevent new registrations — this specific scenario should not recur

---

## Summary

A GPS device (serial `ADGMTXK`) was assigned to user `kresc1@hotmail.it` (Crescenzo Tuccillo) in Petlink Everywhere via a device replacement on 2026-06-19. The replacement was performed **only in MongoDB/PE** — no write-back to the legacy MySQL system. Later, on 2026-07-08, the same device `ADGMTXK` was registered to user `mag74@hotmail.it` (Giusy Di Modica, legacyId 212136) in the **old CCT/MySQL system**, which had no visibility of the PE assignment. When mag74 attempts to migrate to PE, `petsAndProductsMigration` detects `ADGMTXK` already exists in MongoDB — belonging to kresc — and returns `500 — products already present in PE db`. The rollback deletes only the newly created user and resets `migrated=0` in MySQL, creating an infinite retry loop.

**Root cause**: The PE replacement flow (`handlerGpsReplacement`) does not write back to MySQL. The old CCT checks only MySQL, not MongoDB. This created a window where the same physical device could be assigned to two different users in two different systems.

**Prevention**: Blocks added on the old environment (2026-08-18) now prevent new registrations and restrict migrated users from operating on the old env. This specific scenario (device registered in old env after being assigned in PE) should not recur.

---

## Root Cause

### The product check (same code as PRTSUP-597)

`petsAndProductsMigration/handler.ts:188-223` (version 2.3.16):

```typescript
const existingProductsResult = await findItems<PetlinkGps>(
  mongoDbSecret,
  {
    entityType: EntityTypeEnum.Enum.PETLINK_GPS,
    serialNumber: {
      $in: productSerials,
    },
  },
  PETLINK_EVERYWHERE_COLLECTION_NAME
);

const existingProducts = existingProductsResult.items ?? [];
const existingCount = existingProducts.length;

if (existingCount > 0) {
  logger.error(
    `Cannot proceed - products already in PE db. ` +
      `Serials checked: ${JSON.stringify(productSerials)}. ` +
      `Existing products: ${JSON.stringify(existingDetails)}`
  );

  return {
    code: '500',
    message: `${ErrorResponse[500]} - products already present in PE db`,
    idsSaved: idsSaved,
  };
}
```

This check finds **any** `PETLINK_GPS` with the same `serialNumber`, regardless of ownership. It does not check whether the existing product's parent user is the same user being migrated, a different active user, or an orphaned user.

### The incomplete rollback (same as PRTSUP-597)

`migrationOnDemand/handler.ts:258-270`: when `petsAndProductsMigration` fails, `rollbackUserData` only deletes entities whose `id` is in `migratedIds` (the newly created user). The pre-existing product belonging to the other user is not affected, and `migrated=0` is reset in MySQL — allowing the cycle to repeat.

### Why the old CCT allowed the registration (root cause of the conflict)

The PE replacement flow (`handlerGpsReplacement` in `replacement/handler.ts:230-550`) performs these operations:
1. `checkPetlinkGps` → verifies the new serial is not in PE MongoDB and not in MySQL with a non-migrated user
2. `upsertItem` → updates the product's `serialNumber` in MongoDB
3. `findOneAndUpdate` → deactivates the old device in `petlinkGpsInventory`
4. Sends SQS messages to Sentinel (reset old device + register new)
5. Writes `PETLINK_GPS_REPLACEMENT` record in MongoDB
6. Updates Chargebee subscriptions
7. Changes SIM states

**But it never writes to MySQL.** The legacy system is not informed that `ADGMTXK` is now assigned to kresc in PE.

The `checkPetlinkGps` function (`petlinkGps.ts:339-484`) checks the legacy DBs via `findPetlinkInLegacyDbs`:
```sql
SELECT count(*) as count FROM kippy 
LEFT JOIN user ON kippy.user_id = user.id 
WHERE serial_number = ? AND user.migrated = false
```
This query checks if the serial is assigned to a **non-migrated** user in MySQL. On 2026-06-19, `ADGMTXK` was not in the `kippy` table at all (mag74 registered it on July 8, 19 days later), so the check passed correctly.

The old CCT, however, only checks MySQL — it has no visibility into MongoDB/PE. When mag74 registered `ADGMTXK` on July 8, the old CCT saw it as a free device and allowed the registration.

### Why this is different from PRTSUP-597

| | PRTSUP-597 (orphan products) | **PRTSUP-750 (this bug)** |
|---|---|---|
| **Product owner** | No parent user (deleted/orphaned) | **Different active user (created directly in PE)** |
| **Product is legitimate** | No (orphan from failed migration) | **Yes (assigned via replacement in PE)** |
| **Correct action** | Clean up orphan, proceed | **Transfer device or skip — not block** |
| **Infinite retry** | Yes | **Yes** |
| **Root cause** | Incomplete rollback leaves orphans | **PE replacement doesn't write back to MySQL; old CCT has no PE visibility** |

---

## Evidence

### Jira ticket (PRTSUP-750)

- **User**: `mag74@hotmail.it` (Giusy Di Modica)
- **Brand**: KIPPY
- **Feedback**: "User migration failed - pets and products migration error: 500 - Database Internal Server Error - products already present in PE db"
- **Date**: 2026-08-19T08:58:00.922Z

### Loki logs (Grafana, 2026-08-18 — 2026-08-19)

#### `checkMigration` — user not found in MongoDB, found in MySQL

```
08:54:08.124Z — received request: {"arguments":{"contact":"mag74@hotmail.it","password":"*********","appBrand":"KIPPY"},"identity":null}
08:54:08.124Z — query: {"entityType":"USER","deleted":{"$ne":true},"$or":[{"email":"mag74@hotmail.it"},{"phone":"mag74@hotmail.it"}]}
08:54:08.135Z — Failed to find user with contact mag74@hotmail.it in petlinkEverywhere db. Checking for migration
```

Repeats for every attempt. User is never found in MongoDB (rollback deletes the user each time).

#### `migrationOnDemand` — 5 attempts visible (3 on Aug 18, 2 on Aug 19)

| # | Timestamp (UTC) | Session ID | Result |
|---|---|---|---|
| 1 | 2026-08-18 20:31:46 | `13268ac1-11f0-4979-aebf-b6f0dbbd7323` | 500 — products already present |
| 2 | 2026-08-18 20:34:35 | `57dd213e-b793-4b31-afaf-af381703c807` | 500 — products already present |
| 3 | 2026-08-18 20:34:41 | `c9ff41fe-a45f-416e-bd89-fe55adc505bf` | 500 — products already present |
| 4 | 2026-08-19 08:54:11 | `06cd6514-04b7-45d8-a0bc-847f6a6295ed` | 500 — products already present |
| 5 | 2026-08-19 08:57:56 | `ca1b2dd1-bd8d-4335-86df-04fc36544264` | 500 — products already present |

Each attempt:
1. `Returning user 212136` — MySQL user found (migrated=0)
2. `createUser` succeeds → user inserted in MongoDB
3. `petsAndProductsMigration` invoked → finds existing product → 500
4. Rollback: deletes only the newly created user from MongoDB, resets `migrated=0` in MySQL
5. User retries → cycle repeats

#### `petsAndProductsMigration` — the blocking error

```
08:54:15.058Z — Found 1 existing products in PE db
08:54:15.058Z — Cannot proceed - products already in PE db. Serials checked: ["ADHWXRL","ADGMTXK"]. Existing products: [{"serialNumber":"ADGMTXK","userId":"c5efbbc1-8c22-4747-9fe3-ad511f252478","id":"2120f552-d619-4549-8917-2060545deec8"}]
```

Identical error on both Aug 19 attempts. The blocking product is `ADGMTXK` belonging to userId `c5efbbc1-8c22-4747-9fe3-ad511f252478`.

### MongoDB state (petlink.petlinkEverywhere)

**Blocking product (belongs to different active user):**
```json
{
  "_id": {"$oid": "6a339cdeb8f25419b7c39144"},
  "id": "2120f552-d619-4549-8917-2060545deec8",
  "entityType": "PETLINK_GPS",
  "serialNumber": "ADGMTXK",
  "userId": "c5efbbc1-8c22-4747-9fe3-ad511f252478",
  "petId": "fd685916-12ff-416f-9584-b890c8099552",
  "creationDate": "2026-06-18T07:23:10.521Z",
  "lastKnownStatus": { "battery": 100, "firmwareVersion": "11.1.70", ... },
  "lastKnownPosition": { "lat": 40.96035, "lng": 14.366817, "date": "2026-08-19T12:47:19..." }
}
```
- Product is **actively tracking** (lastKnownPosition updated Aug 19, battery 100%)

**Owner of blocking product (active user, created directly in PE — NOT migrated):**
```json
{
  "id": "c5efbbc1-8c22-4747-9fe3-ad511f252478",
  "email": "kresc1@hotmail.it",
  "name": "Crescenzo",
  "surname": "Tuccillo",
  "entityType": "USER",
  "appBrand": "KIPPY",
  "deleted": false,
  "creationDate": "2026-06-18T05:45:19.588Z",
  "phone": "+393284261752"
}
```
- User is **active** (`deleted: false`), **created directly in PE** (not migrated — no records in `migrationHistory`)
- `chargebeeId` matches `id` — user registered natively in PE

**Replacement record in MongoDB:**
```json
{
  "id": "78eda94c-d0fb-440e-8d74-4904d53204f6",
  "entityType": "PETLINK_GPS_REPLACEMENT",
  "oldSerialNumber": "ADDJCRN",
  "newSerialNumber": "ADGMTXK",
  "userId": "c5efbbc1-8c22-4747-9fe3-ad511f252478",
  "email": "kresc1@hotmail.it",
  "creationDate": "2026-06-19T03:54:19.429Z",
  "reasonCode": ["NO_CUSTOMER_CARE"]
}
```
- Replacement done on 2026-06-19 at 03:54 UTC, replacing `ADDJCRN` with `ADGMTXK`

**Inventory state:**
- `ADGMTXK`: `subscriptionActive: true`, `simStatus: live`, `lastConnectionDate: 2026-08-19` — **actively tracking**
- `ADDJCRN`: `subscriptionActive: false`, `simStatus: suspended`, `lastConnectionDate: 2026-06-19` — **deactivated after replacement**

**Subscription:** `efb0b110-09d6-4e53-9ca6-7e64e78a3def`, status `active`, `chargebeeSubscriptionId: 199FaCVMsxmVs1ONS`, `serialNumber: ADGMTXK`

**Second serial `ADHWXRL`:** Not found in MongoDB — only `ADGMTXK` is blocking.

**Migration history:** 90 documents for userId `212136` (≈45 attempts: USER + PETS_AND_PRODUCTS per session). Earliest visible attempts on 2026-08-18, but likely more attempts before Loki retention window.

### Code version inspected

- **Version**: 2.3.16 (deployed 2026-07-20)
- **Commit**: `84c5a02` (Merge tag 'v2.3.16' into prod)
- **File**: `src/lambda_functions/migrationOnDemand/petsAndProductsMigration/handler.ts`

---

## Sequence of events

1. **2026-06-18**: User `kresc1@hotmail.it` (Crescenzo Tuccillo) registers **directly in PE** (not via migration — no `migrationHistory` records). Product `ADGMTXK` is created in MongoDB with userId `c5efbbc1-8c22-4747-9fe3-ad511f252478`.

2. **2026-06-19 03:54 UTC**: kresc performs a device replacement in PE: `ADDJCRN → ADGMTXK`. The replacement updates MongoDB only — **no write-back to MySQL**. `ADDJCRN` is suspended in inventory, `ADGMTXK` is activated.

3. **2026-07-08**: The old CCT registers `ADGMTXK` to user `mag74@hotmail.it` (legacyId 212136) in MySQL. The old CCT checks only MySQL, where `ADGMTXK` appears unassigned — **it has no visibility of the PE/MongoDB assignment**.

4. **2026-08-18 ~20:31**: User `mag74@hotmail.it` attempts to log in → `checkMigration` → user not found in MongoDB → MySQL user found with `migrated=0` → `migrationOnDemand` triggered.

5. **2026-08-18 20:31:46**: `migrationOnDemand` creates new user in MongoDB → invokes `petsAndProductsMigration` → finds `ADGMTXK` already in PE db belonging to kresc → returns `500 — products already present in PE db`.

6. **2026-08-18 20:31:51**: Rollback deletes only the newly created user. MySQL `migrated` reset to 0.

7. **2026-08-18 – 2026-08-19**: User retries multiple times (at least 5 visible attempts, 90 migration history records ≈45 sessions). Every attempt fails identically.

8. **2026-08-19 08:58**: Support email sent to Kippy with the error feedback (ticket PRTSUP-750 created).

9. **2026-08-18 (approx)**: Blocks added on old environment — no new registrations allowed, migrated users restricted from old env. **This prevents new cases of the same conflict.**

---

## Resolution for current case (mag74 / legacyId 212136)

### State summary

| Entity | System | Owner | Status |
|---|---|---|---|
| `ADGMTXK` (PETLINK_GPS) | PE/MongoDB | kresc (`c5efbbc1...`) | Active, tracking, subscription active |
| `ADGMTXK` (kippy table) | MySQL/legacy | mag74 (212136) | Registered 2026-07-08 via old CCT |
| `ADDJCRN` (old device) | PE/MongoDB inventory | kresc (suspended) | Suspended after replacement |
| `ADHWXRL` | Not in MongoDB | mag74 (MySQL) | Not blocking — would migrate normally |
| mag74 user | Not in MongoDB | — | Rollback deleted all PE entities; `migrated=0` in MySQL |
| kresc subscription | PE/Chargebee | kresc | `199FaCVMsxmVs1ONS`, active, currentTermEnd 2028-06-17 |

### Key question: who is the legitimate owner of the physical device `ADGMTXK`?

kresc received `ADGMTXK` as a replacement for `ADDJCRN` on 2026-06-19 in PE. mag74 registered `ADGMTXK` on 2026-07-08 in the old system. **kresc had the device first** (19 days earlier). The device is currently actively tracking under kresc (lastKnownPosition updated 2026-08-19, battery 100%).

This suggests mag74 may have received the physical device from kresc (e.g., resale, gift, return) after kresc replaced it — but kresc never returned or deactivated it in PE. Alternatively, mag74 may have registered a device she didn't physically possess, or there was a mix-up in the old CCT.

### Option A — kresc keeps the device (most likely correct)

If kresc is the legitimate owner (device actively tracking, subscription active until 2028):

1. **Remove `ADGMTXK` from mag74's products in MySQL** (kippy table):
   ```sql
   -- Verify current state
   SELECT * FROM kippy WHERE serial_number = 'ADGMTXK' AND user_id = 212136;
   -- Remove the assignment
   DELETE FROM kippy WHERE serial_number = 'ADGMTXK' AND user_id = 212136;
   ```
2. **Reset `migrated=0`** for mag74 (already 0 due to rollback)
3. **Trigger migration** for mag74 — she will migrate with `ADHWXRL` only (the other serial that doesn't conflict)
4. If mag74 also needs `ADGMTXK`, she must obtain the physical device from kresc and kresc must release it in PE first

### Option B — Transfer device from kresc to mag74 (if mag74 is legitimate owner)

If mag74 is the legitimate owner (e.g., kresc returned/sold the device):

1. **In PE**: perform a replacement for kresc, removing `ADGMTXK` (give kresc a dummy or no device)
2. **In PE**: cancel or transfer kresc's subscription on `ADGMTXK`
3. **In MongoDB**: delete or reassign the `PETLINK_GPS` document for `ADGMTXK`
4. **Then migrate mag74** — she will get `ADGMTXK` and `ADHWXRL` as new products

This is complex and risky — requires coordinating with kresc, Chargebee, and Sentinel.

### Option C — Migrate mag74 without ADGMTXK (pragmatic)

1. In MySQL, remove `ADGMTXK` from mag74's kippy records (or mark it as not-to-migrate)
2. Trigger migration for mag74 with only `ADHWXRL`
3. If mag74 later proves she owns `ADGMTXK`, handle the transfer separately

**Recommended**: Option A or C (pragmatic, minimal risk). Need business confirmation on who owns the physical device.

---

## Prevention (already in place)

Blocks added on the old environment (2026-08-18) prevent:
- New registrations on the old env
- Migrated users from performing actions on the old env

This closes the window that allowed the conflict: no device can be registered in MySQL after being assigned in PE. **No code fix needed for prevention** — the blocks are sufficient.

However, as a defensive measure, `petsAndProductsMigration` should still be modified to:
1. Distinguish orphan products (PRTSUP-597) from active-user products (this bug)
2. Return a specific error code (409 Conflict) instead of generic 500 for active-user conflicts
3. Stop the infinite retry loop by not resetting `migrated=0` on conflict errors

See the structural fix code proposal below (kept for reference).

---

## Structural fix (defensive, lower priority since blocks prevent new cases)

Il fix proposto per PRTSUP-597 (verificare se i prodotti sono orfani) non risolve questo caso, perché qui il prodotto **non è orfano** — appartiene a un utente attivo.

**Fix raccomandato**: modificare `petsAndProductsMigration` per distinguere tre casi:

```typescript
if (existingCount > 0) {
  // 1. Check if products belong to the SAME user being migrated (by legacyId)
  const ownProducts = existingProducts.filter(p => p.legacyUserId === String(message.data.userId));
  
  if (ownProducts.length === existingCount) {
    // All products belong to this user — previous partial migration, clean up and proceed
    logger.warn(`Found own products from previous attempt, cleaning up`);
    await deleteItems(mongoDbSecret, { id: { $in: ownProducts.map(p => p.id) } }, ...);
    // Continue with migration
  } else {
    // 2. Check if remaining products are orphaned (parent user deleted/missing)
    const otherProducts = existingProducts.filter(p => p.legacyUserId !== String(message.data.userId));
    const parentUserIds = [...new Set(otherProducts.map(p => p.userId))];
    const parentUsers = await findItems<User>(mongoDbSecret, {
      entityType: EntityTypeEnum.Enum.USER,
      id: { $in: parentUserIds },
      deleted: { $ne: true },
    }, ...);
    
    if (parentUsers.items.length === 0) {
      // All orphaned — clean up and proceed (PRTSUP-597 fix)
      logger.warn(`Found orphan products, cleaning up`);
      await deleteItems(mongoDbSecret, { id: { $in: otherProducts.map(p => p.id) } }, ...);
      // Continue with migration
    } else {
      // 3. Products belong to another ACTIVE user — device conflict
      // Return a SPECIFIC error code (not generic 500) so support can distinguish
      logger.error(`Device conflict — products belong to active user(s): ${JSON.stringify(parentUsers.items.map(u => u.email))}`);
      return {
        code: '409', // Conflict — distinguish from generic 500
        message: `Device conflict — product ${otherProducts[0].serialNumber} belongs to active user ${parentUsers.items[0].email}`,
        idsSaved: idsSaved,
      };
    }
  }
}
```

**Fix aggiuntivo — evitare il loop infinito**: Il rollback in `migrationOnDemand` dovrebbe **non resettare** `migrated=0` quando il codice di errore è `409` (conflitto dispositivo), ma impostare `migrated=-1` per bloccare ulteriori tentativi automatici e richiedere intervento manuale.

---

## Affected files

- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/petsAndProductsMigration/handler.ts` — product check at lines 188-223
- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` — rollback logic at lines 258-270, `rollbackUserData`
- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts` — migration trigger

---

## Remaining uncertainty

- **Who is the legitimate owner of the physical device `ADGMTXK`?** kresc lo ha ricevuto come replacement il 19 giugno ed è attivamente in tracking. mag74 lo ha registrato nel vecchio sistema l'8 luglio. Serve conferma business su chi è il legittimo proprietario prima di procedere con la risoluzione.
- **How many attempts before Aug 18?** Ci sono 90 record in migrationHistory ma solo 5 tentativi visibili nei log Loki (retention ~30 giorni). I tentativi precedenti potrebbero essere fuori dalla finestra di retention.
- **Is `ADHWXRL` also reassigned?** Il serial `ADHWXRL` non è in MongoDB, quindi non blocca. Si dovrebbe verificare in MySQL se appartiene effettivamente a mag74 o se è stato riassegnato da un altro utente.
- **Loki logs for June 19 unavailable**: I log del replacement del 19 giugno sono fuori dalla finestra di retention di Loki. L'analisi si basa su MongoDB state e codice.
