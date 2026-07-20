# Bug W6 — Orphan Products Block Migration (Infinite Retry Loop)

> **Status**: Unfixed
> **Severity**: High — user permanently locked out, infinite retry loop
> **Jira**: PRTSUP-597
> **Affected user**: `martin_stubbs@hotmail.co.uk` (legacyId `142191`, KIPPY EU)
> **Date discovered**: 2026-07-16

---

## Summary

A previous migration attempt inserts `PETLINK_GPS` product entities into MongoDB but subsequently fails (timeout, downstream error, or manual cleanup). The rollback / cleanup removes the `USER` entity but **leaves the products orphaned** in MongoDB. On every subsequent migration attempt, `petsAndProductsMigration` detects the orphaned products via `countItems` by `serialNumber` and returns `500 — products already present in PE db`. The rollback then deletes only the newly created user (not the orphaned products), resetting `migrated=0` in MySQL — allowing the cycle to repeat indefinitely.

---

## Root Cause

### The orphan products check

`petsAndProductsMigration/handler.ts:179-199`:

```typescript
const countResult = await countItems(
  mongoDbSecret,
  {
    entityType: EntityTypeEnum.Enum.PETLINK_GPS,
    serialNumber: {
      $in: mysqlProducts.map((product) => product.serial_number),
    },
  },
  PETLINK_EVERYWHERE_COLLECTION_NAME
);

if (countResult.count && countResult.count > 0) {
  logger.error(`Cannot proceed - one of the user products is already in PE db`);
  return {
    code: '500',
    message: `${ErrorResponse[500]} - products already present in PE db`,
    idsSaved: idsSaved,
  };
}
```

This check looks for **any** `PETLINK_GPS` with the same `serialNumber` — regardless of whether the owning user still exists. It does not distinguish between:
- Products belonging to an active, existing user (legitimate duplicate — correct to block)
- Products orphaned by a failed previous migration (should be cleaned up, not block)

### The incomplete rollback

`migrationOnDemand/handler.ts:247-270`:

```typescript
if (petsAndProductsMigrated.code != '200') {
  await rollbackUserData(migratedIds, connection, mysqlUser.id);
  // ...
}
```

`rollbackUserData` (line 485-500) only deletes entities whose `id` is in `migratedIds`:

```typescript
async function rollbackUserData(idsToDelete, connection, mysqlUserId) {
  await Promise.all([
    deleteItems(mongoDbSecret, { id: { $in: idsToDelete } }, ...),
    connection.query('UPDATE user SET migrated = 0 WHERE id = ?', [mysqlUserId]),
  ]);
}
```

When `petsAndProductsMigration` fails with "products already present", `migratedIds` contains only the `userId` (the user was just created and inserted). The **orphaned products from the previous failed migration are not in `migratedIds`** and are therefore never cleaned up.

### How orphans are created

A previous migration attempt (outside Loki retention, so no logs visible) inserted the user + pets + products into MongoDB, then failed at a later stage:

1. **Lambda timeout (W3)**: Lambda killed after product insertion, before Cognito creation → `migrated=1` in MySQL, user + products in MongoDB, no Cognito account → user can't log in
2. **Downstream failure** (ESA / geofence / subs / Cognito): rollback called, but `deleteItems` may have partially failed or the product IDs weren't yet in `migratedIds` (race condition with `callMigrationLambda` return)
3. **Manual `userCleanup`**: executed to unblock the user, but cleanup only deletes by `userId` (Petlink UUID) — if the user was already deleted, the cleanup finds nothing and the products remain

In all cases, the `PETLINK_GPS` entities remain in MongoDB with no parent `USER`.

---

## Evidence (Grafana Loki logs, 2026-07-16)

### checkMigration — user not found in MongoDB, found in MySQL

```
received request: {"arguments":{"contact":"martin_stubbs@hotmail.co.uk","password":"*********","appBrand":"KIPPY"},"identity":null}
query: {"entityType":"USER","deleted":{"$ne":true},"$or":[{"email":"martin_stubbs@hotmail.co.uk"},{"phone":"martin_stubbs@hotmail.co.uk"}]}
Failed to find user with contact martin_stubbs@hotmail.co.uk in petlinkEverywhere db. Checking for migration
```

This repeats for every attempt. The user is never found in MongoDB (email query is correct — not a phone normalization issue).

### migrationOnDemand — 7 attempts, all identical

| # | Timestamp (UTC) | Session ID | Result |
|---|---|---|---|
| 1 | 18:39:11 | c468b892-04c6-4c28-9918-8019f77621a6 | 500 — products already present |
| 2 | 18:39:41 | 3ee6d01e-9d22-4759-8394-4c9215f74e1d | 500 — products already present |
| 3 | 18:41:01 | 39bdbd59-22df-4b9a-b7aa-54b450bdb47e | 500 — products already present |
| 4 | 18:42:03 | 47114fa2-6a52-4fc0-a7bd-7179c7b5a2eb | 500 — products already present |
| 5 | 18:43:01 | 60eb5e42-fd10-4fbe-a66f-1c8785f99728 | 500 — products already present |
| 6 | 19:55:53 | e5d66642-a800-41c8-825f-02aab93f4fd8 | 500 — products already present |
| 7 | 20:26:55 | db95564b-eda3-4532-82f3-6def2b592719 | 500 — products already present |

Each attempt:
1. `Returning user 142191` — MySQL user found (migrated=0)
2. `createUser` succeeds → user inserted in MongoDB
3. `petsAndProductsMigration` invoked → finds orphaned products → 500
4. Rollback: deletes user from MongoDB, resets `migrated=0` in MySQL
5. User retries → cycle repeats

### No logs before 2026-07-16

Searched Loki from 2026-07-10 to 2026-07-16T18:39:00Z — no logs for this user. The original migration that created the orphan products happened before Loki retention window or via a path that doesn't log to these services (e.g. BULK migration).

---

## Differentiation from known bugs

| | W1 (phone norm) | W2 (createUser null) | **W6 (this bug)** |
|---|---|---|---|
| **Sintomo** | Re-migrazione → crash prodotti | createUser throw → 500 | **Prodotti orfani → 500** |
| **createUser** | OK | **Fallisce (null fields)** | **OK** |
| **User in MongoDB** | Sì (ma non trovato per phone mismatch) | No (mai inserito) | **No (cancellato da rollback/cleanup precedente)** |
| **Products in MongoDB** | Sì (dalla prima migrazione) | No | **Sì (orfani — utente cancellato, prodotti rimasti)** |
| **migrated dopo fail** | 1 (stuck) | 0 (rollback reset) | **0 (rollback reset)** |
| **Retry possible** | No | Sì (infinito) | **Sì (infinito)** |
| **Root cause** | Phone normalization mismatch | Null MySQL fields → throw | **Prodotti orfani non puliti da rollback/cleanup** |
| **Contatto** | Phone (E.164 vs raw) | Email | **Email (phone norm irrilevante)** |

**Verdetto**: nuovo bug, non rientra in W1 né W2. È una nuova variante di W3 (timeout/failure che lascia residui).

---

## Fix Plan

### 1. Recovery immediato (per utente 142191)

Cancellare manualmente i prodotti orfani da MongoDB, poi resettare MySQL:

```javascript
// 1. Find orphan products
db.petlinkEverywhere.find({
  entityType: "PETLINK_GPS",
  legacyUserId: "142191"
})

// 2. Delete orphan products
db.petlinkEverywhere.deleteMany({
  entityType: "PETLINK_GPS",
  legacyUserId: "142191"
})

// 3. Also check for orphan pets
db.petlinkEverywhere.deleteMany({
  entityType: "PET",
  legacyUserId: "142191"
})
```

```sql
-- 4. Reset migrated flag
UPDATE user SET migrated = 0 WHERE id = 142191;
```

Then the user can log in and trigger a clean migration.

### 2. Fix strutturale

**Opzione A — `petsAndProductsMigration` (raccomandata)**: invece di fallire quando trova prodotti già in MongoDB, verificare se sono orfani:

```typescript
if (countResult.count && countResult.count > 0) {
  // Check if the existing products are orphans (no parent user)
  const existingProducts = await findItems<PetlinkGps>(
    mongoDbSecret,
    {
      entityType: EntityTypeEnum.Enum.PETLINK_GPS,
      serialNumber: { $in: mysqlProducts.map((p) => p.serial_number) },
    },
    PETLINK_EVERYWHERE_COLLECTION_NAME
  );

  // Find the parent user for each product
  const parentUserIds = [...new Set(existingProducts.items.map(p => p.userId))];
  const parentUsers = await findItems<User>(
    mongoDbSecret,
    {
      entityType: EntityTypeEnum.Enum.USER,
      id: { $in: parentUserIds },
      deleted: { $ne: true },
    },
    PETLINK_EVERYWHERE_COLLECTION_NAME
  );

  if (parentUsers.items.length === 0) {
    // All products are orphans — clean up and proceed
    logger.warn(`Found orphan products for legacyUserId ${userId}, cleaning up`);
    await deleteItems(
      mongoDbSecret,
      {
        entityType: EntityTypeEnum.Enum.PETLINK_GPS,
        serialNumber: { $in: mysqlProducts.map((p) => p.serial_number) },
      },
      PETLINK_EVERYWHERE_COLLECTION_NAME
    );
    // Also clean up orphan pets
    await deleteItems(
      mongoDbSecret,
      { entityType: EntityTypeEnum.Enum.PET, legacyUserId: String(userId) },
      PETLINK_EVERYWHERE_COLLECTION_NAME
    );
  } else {
    // Products belong to an active user — legitimate duplicate, block
    logger.error(`Cannot proceed - products already belong to existing user`);
    return {
      code: '500',
      message: `${ErrorResponse[500]} - products already present in PE db`,
      idsSaved: idsSaved,
    };
  }
}
```

**Opzione B — `rollbackUserData`**: quando `petsAndProductsMigration` fallisce, il rollback dovrebbe anche cancellare eventuali prodotti orfani per `legacyUserId`:

```typescript
async function rollbackUserData(idsToDelete, connection, mysqlUserId) {
  await Promise.all([
    deleteItems(mongoDbSecret, { id: { $in: idsToDelete } }, ...),
    // Also clean up any orphan products/pets for this legacy user
    deleteItems(mongoDbSecret, {
      entityType: EntityTypeEnum.Enum.PETLINK_GPS,
      legacyUserId: String(mysqlUserId),
    }, ...),
    deleteItems(mongoDbSecret, {
      entityType: EntityTypeEnum.Enum.PET,
      legacyUserId: String(mysqlUserId),
    }, ...),
    connection.query('UPDATE user SET migrated = 0 WHERE id = ?', [mysqlUserId]),
  ]);
}
```

**Opzione C — `userCleanup`**: assicurarsi che `cleanupDatabase()` cancelli anche i `PETLINK_GPS` e `PET` per `legacyUserId` (non solo per `userId` del Petlink UUID, che potrebbe non esistere più).

### 3. Fix preventivo (W3-related)

Mitigare il rischio di timeout Lambda (W3) che crea orfani in primo luogo:
- Aumentare il timeout della Lambda `migrationOnDemand`
- Oppure spezzare la migrazione in step indipendenti con stato persistente (resume capability)
- Aggiungere un check di consistenza post-migrazione: se `USER` non esiste, cancellare tutti i `PETLINK_GPS` e `PET` con lo stesso `legacyUserId`

---

## Affected files

- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/petsAndProductsMigration/handler.ts` — check at lines 179-199
- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` — rollback at lines 247-270, `rollbackUserData` at 485-500
- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts` — query at lines 52-58 (no phone normalization fix, but irrelevant for this bug since contact is email)
