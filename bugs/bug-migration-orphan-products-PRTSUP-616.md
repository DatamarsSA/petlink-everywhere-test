# Bug PRTSUP-616 — Orphan Products Block Migration (known bug PRTSUP-597)

> **Status**: Unfixed (instance of known bug PRTSUP-597)
> **Severity**: High — user permanently locked out, infinite retry loop
> **Jira**: PRTSUP-616
> **Known bug reference**: [bug-migration-orphan-products-PRTSUP-597.md](./bug-migration-orphan-products-PRTSUP-597.md)
> **Affected user**: `monika.mossad@gmx.de` (legacyId `224946`, KIPPY EU)
> **Date discovered**: 2026-07-28

---

## Summary

This is a confirmed instance of the known bug **PRTSUP-597** ("Orphan Products Block Migration"). The user `monika.mossad@gmx.de` (legacyId 224946) cannot complete migration because `petsAndProductsMigration` detects products already present in MongoDB (serial `ADJJH6F`) and returns `500 — products already present in PE db`. The products were inserted during a previous migration attempt on 2026-06-05 and were never cleaned up. Each subsequent migration attempt creates a new user, hits the product check, fails, rolls back (deleting only the newly created user), and resets `migrated=0` in MySQL — creating an infinite retry loop.

---

## Evidence

### MongoDB state (petlink.petlinkEverywhere)

**User (from June 5 migration — still present, no `legacyId`):**
```json
{
  "_id": {"$oid": "6a22aad2adc7e7818947c70a"},
  "id": "22f41270-9b31-4600-957e-a4a7c3858f2b",
  "email": "monika.mossad@gmx.de",
  "entityType": "USER",
  "appBrand": "KIPPY",
  "deleted": false,
  "creationDate": "2026-06-05T10:54:10.891Z",
  "updateDate": "2026-07-29T07:29:42.674Z",
  "phone": "+49017678290458"
}
```
- User exists with `deleted: false` but has **no `legacyId`** field.
- Querying by `legacyId: "224946"` returns 0 documents — confirming no user with this legacyId exists.

**Product (orphaned, from June 5 migration):**
```json
{
  "_id": {"$OID": "6a22b3dbadc7e7818948125f"},
  "id": "eb841740-2fb0-4a3b-bb36-fcc0dfd360f7",
  "entityType": "PETLINK_GPS",
  "serialNumber": "ADJJH6F",
  "petId": "902dd62a-790e-4d42-a405-255fdc770413",
  "userId": "22f41270-9b31-4600-957e-a4a7c3858f2b",
  "creationDate": "2026-06-05T11:32:42.971Z"
}
```

**Pet (from June 5 migration):**
```json
{
  "_id": {"$OID": "6a22b3a9adc7e78189480fac"},
  "id": "902dd62a-790e-4d42-a405-255fdc770413",
  "entityType": "PET",
  "userId": "22f41270-9b31-4600-957e-a4a7c3858f2b",
  "name": "Leni",
  "creationDate": "2026-06-05T11:31:53.182Z"
}
```

**Migration history (only July 28 session recorded):**
- `USER` migration started at `2026-07-28T15:13:22.524Z` (sessionId `26340384-a0eb-4d71-950c-2e8802dc0389`)
- `PETS_AND_PRODUCTS` migration started at `2026-07-28T15:13:25.946Z` (same sessionId)
- No migration history records from June 5 — the original migration predates the stats collection or was not recorded.

### Loki logs (2026-07-28)

**`DatamarsPetlinkEverywhereCoreProd-checkMigration`:**
Multiple `checkMigration` requests for `monika.mossad@gmx.de` between 15:12–15:19 UTC. The query searches MongoDB by email/phone:
```
query: {"entityType":"USER","deleted":{"$ne":true},"$or":[{"email":"monika.mossad@gmx.de"},{"phone":"monika.mossad@gmx.de"}]}
```
Some requests return `Count item count: 1` (user found → `success.user_exists`), others return `Count item count: 0` (user not found → migration path). The inconsistency is due to the rollback cycle: migration creates a user (count=1), rollback deletes it (count=0), user retries.

**`DatamarsPetlinkDataMigrationProd-migrationOnDemand` (session `26340384...`):**
```
15:13:22.503Z — Returning user 224946 (MySQL user found, migrated=0)
15:13:22.524Z — Lock acquired for legacyUserId 224946 (setUserMigrated)
15:13:22.524Z — result: {"migrationTarget":"USER","sessionId":"26340384...","userId":"224946","email":"monika.mossad@gmx.de"} (USER migration started)
15:13:26.867Z — Rollback started for legacyUserId 224946, deleting 1 items by id: ["673c3b5d-e16e-4dff-8e1e-bea75358b527"]
15:13:26.884Z — Rollback completed for legacyUserId 224946
15:13:26.884Z — send body: {"appBrand":"KIPPY","email":"monika.mossad@gmx.de","feedback":"User migration failed - pets and products migration error: 500 - Database Internal Server Error - products already present in PE db"}
```

The rollback deleted item `673c3b5d-e16e-4dff-8e1e-bea75358b527` — this is the **newly created user** from the July 28 attempt, NOT the June 5 user (`22f41270-9b31-4600-957e-a4a7c3858f2b`). The June 5 user and its products remain untouched.

**`DatamarsPetlinkDataMigrationProd-petsAndProductsMigration`:**
```
15:13:26.004Z — Retrieving pets and products for userId 224946
15:13:26.004Z — result: {"migrationTarget":"PETS_AND_PRODUCTS","sessionId":"26340384...","userId":"224946","startedAt":"2026-07-28T15:13:25.946Z"}
```
No explicit "Cannot proceed - products already in PE db" log line was found (likely truncated or not retained), but the error message propagated to `migrationOnDemand` confirms the failure.

### Code (version 2.3.16, deployed before 2026-07-28)

`petsAndProductsMigration/handler.ts:188-223` — the product check:
```typescript
const existingProductsResult = await findItems<PetlinkGps>(
  mongoDbSecret,
  {
    entityType: EntityTypeEnum.Enum.PETLINK_GPS,
    serialNumber: { $in: productSerials },
  },
  PETLINK_EVERYWHERE_COLLECTION_NAME
);
const existingProducts = existingProductsResult.items ?? [];
const existingCount = existingProducts.length;
if (existingCount > 0) {
  logger.error(`Cannot proceed - products already in PE db. ...`);
  return { code: '500', message: `${ErrorResponse[500]} - products already present in PE db`, idsSaved };
}
```

This check does not distinguish between:
- Products belonging to an active user (legitimate duplicate — correct to block)
- Products orphaned by a failed previous migration (should be cleaned up, not block)

---

## Sequence of events

1. **2026-06-05**: First migration attempt for `monika.mossad@gmx.de` (legacyId 224946). User (`22f41270...`), pet "Leni", and product `ADJJH6F` inserted into MongoDB. This migration either completed partially or failed at a later stage. The user document has no `legacyId` — suggesting a possible code difference at the time or a non-standard migration path. The products remain in MongoDB.

2. **2026-07-28 ~15:06**: User attempts to log in → `checkMigration` → user not found in MongoDB (count=0) → MySQL user found with `migrated=0` → password matches → `user_can_be_migrated` returned.

3. **2026-07-28 15:13:22**: `migrationOnDemand` triggered → creates new user (`673c3b5d...`) with `legacyId: "224946"` → succeeds.

4. **2026-07-28 15:13:25**: `petsAndProductsMigration` invoked → finds new user by `legacyId: "224946"` → checks for existing products by `serialNumber: ["ADJJH6F"]` → **finds the June 5 product** → returns `500 — products already present in PE db`.

5. **2026-07-28 15:13:26**: Rollback deletes only the newly created user (`673c3b5d...`). The June 5 user (`22f41270...`), pet, and product are NOT in `migratedIds` and are not cleaned up. MySQL `migrated` reset to 0.

6. User retries → cycle repeats from step 2.

---

## Differentiation from PRTSUP-597

This is the **same root cause** as PRTSUP-597. The only difference is that in PRTSUP-597 the original user was deleted by rollback/cleanup (true orphan products), while in PRTSUP-616 the original June 5 user still exists with `deleted: false` but has no `legacyId`. In both cases, the products from a previous failed migration block subsequent attempts, and the rollback only cleans up the newly created user — not the pre-existing products.

The absence of `legacyId` on the June 5 user is an additional anomaly that may indicate the original migration used a different code version or path, but it does not change the fundamental bug: `petsAndProductsMigration` blocks on any existing product by serial number without checking ownership.

---

## Fix

This bug is already documented in [bug-migration-orphan-products-PRTSUP-597.md](./bug-migration-orphan-products-PRTSUP-597.md) with three proposed fix options. The recommended fix (Option A) modifies `petsAndProductsMigration` to detect and clean up orphan products instead of blocking.

### Immediate recovery for this user

```javascript
// 1. Delete orphan products by serialNumber
db.petlinkEverywhere.deleteMany({
  entityType: "PETLINK_GPS",
  serialNumber: "ADJJH6F"
})

// 2. Delete orphan pet
db.petlinkEverywhere.deleteMany({
  entityType: "PET",
  userId: "22f41270-9b31-4600-957e-a4a7c3858f2b"
})

// 3. Delete the June 5 user (no legacyId, not properly migrated)
db.petlinkEverywhere.deleteMany({
  entityType: "USER",
  id: "22f41270-9b31-4600-957e-a4a7c3858f2b"
})
```

```sql
-- 4. Reset migrated flag
UPDATE user SET migrated = 0 WHERE id = 224946;
```

Then the user can log in and trigger a clean migration.

---

## Affected files

- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/petsAndProductsMigration/handler.ts` — product check at lines 188-223
- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` — rollback logic
- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts` — migration trigger
