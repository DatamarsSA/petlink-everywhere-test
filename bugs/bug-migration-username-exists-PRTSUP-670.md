# Bug: `UsernameExistsException` during migration creates duplicate failed attempts

**Primary Jira ticket:** PRTSUP-670 (and duplicates PRTSUP-669, PRTSUP-668)

## Affected user

- `matthias.deschamps@laposte.net` (KIPPY, legacy user id `224953`)

## Symptom

Three open `Waiting for support` Jira tickets report:

```
User migration failed - cognito user creation error: UsernameExistsException: User account already exists
```

Timestamps:
- PRTSUP-668: 2026-08-02 ~06:58 UTC
- PRTSUP-669: 2026-08-02 ~06:59 UTC
- PRTSUP-670: 2026-08-02 ~07:05 UTC

A later attempt at 2026-08-02 08:14 UTC succeeded and the user was fully migrated (`usersMigrated: 1`).

## Root cause (confirmed 2026-08-07)

### Primary trigger: self-registration with same email but different phone

The user **self-registered in the KIPPY app** on 2026-08-01 at 08:13:41 UTC (`signUpUser` Lambda), creating:
- Cognito user `b50319ee-3160-4455-a3d0-32705d713b91` with email `matthias.deschamps@laposte.net` and phone `+33660874721`
- MongoDB USER document `b50319ee-...` with `deleted: false`

The **bulk migration** was triggered on 2026-08-02 using the **legacy phone number** `+33660874021` as contact (confirmed by Loki: `InvokeRequest: +33660874021, KIPPY`).

The `findItem` pre-flight check in `migrationOnDemand/handler.ts:133-145` searches MongoDB by the `contact` field only:
```ts
const findUserRes = await findItem<User>(
  mongoDbSecret,
  {
    entityType: EntityTypeEnum.Enum.USER,
    $or: [
      { email: contact },       // "+33660874021" — no match
      { phone: contact },       // "+33660874021" — no match (self-registered user has +33660874721)
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ],
    deleted: { $ne: true },
  },
  PETLINK_EVERYWHERE_COLLECTION_NAME
);
```

The self-registered user had email `matthias.deschamps@laposte.net` and phone `+33660874721` — **different phone** from the legacy `+33660874021`. So the `findItem` query did NOT find the self-registered user, and the migration proceeded.

The migration then called `createCognitoUser` with the **MySQL email** (`mysqlUser.email` → `matthias.deschamps@laposte.net`) and the **legacy phone** (`+33660874021`). Cognito rejected the creation with `UsernameExistsException` because the email alias `matthias.deschamps@laposte.net` already existed in the user pool (from the self-registered user).

### Timeline (confirmed from Loki + MongoDB)

| Time (UTC) | Event | Source |
|---|---|---|
| 2026-08-01 08:13:41 | User self-registers in KIPPY app (email + phone +33660874721) | `signUpUser` Loki log |
| 2026-08-01 13:14:56 | User confirms account (UserStatus → CONFIRMED) | Cognito UserLastModifiedDate |
| 2026-08-02 06:57:48 | Migration attempt 1: `InvokeRequest: +33660874021` | Loki |
| 2026-08-02 06:58:15 | Migration attempt 1 fails: `UsernameExistsException` | Loki |
| 2026-08-02 06:58:39 | Migration attempt 2: `InvokeRequest: +33660874021` | Loki |
| 2026-08-02 06:58:49 | Migration attempt 2 fails: `UsernameExistsException` | Loki |
| 2026-08-02 07:05:10 | Migration attempt 3: `InvokeRequest: +33660874021` | Loki |
| 2026-08-02 07:05:32 | Migration attempt 3 fails: `UsernameExistsException` | Loki |
| 2026-08-02 08:13:14 | User deletes self-registered account (`deleteUser` Lambda) | Loki |
| 2026-08-02 08:13:58 | Migration attempt 4: `InvokeRequest: matthias.deschamps@laposte.net` | Loki |
| 2026-08-02 08:14:20 | Migration attempt 4 succeeds: Cognito user created | Loki |

### Key gap: `findItem` searches by `contact`, Cognito uses MySQL email

The `findItem` check searches by the `contact` parameter (which can be phone or email). But `createCognitoUser` uses `user.email` from the MySQL record (`mysqlUser.email`), not the `contact`. When the migration is triggered by phone number, the `findItem` check cannot detect an existing user registered with the same email but a different phone.

### Secondary issue: rollback does not clean Cognito

The rollback in `migrationOnDemand` (`rollbackUserData`) only deletes documents from MongoDB and resets `user.migrated = 0` in MySQL:

```ts
async function rollbackUserData(...) {
  const [deleteResult] = await Promise.all([
    deleteItems(mongoDbSecret, { id: { $in: idsToDelete } }, PETLINK_EVERYWHERE_COLLECTION_NAME),
    connection.query('UPDATE user SET migrated = 0 WHERE id = ?', [mysqlUserId]),
  ]);
}
```

There is no `deleteCognitoUser` step, so a half-migrated account can leave an orphan Cognito user behind. However, in this specific incident, the Cognito conflict was caused by the user's own self-registered account, not by a previous migration attempt.

### Orphan DEVICE_REGISTRATION_FLOW document

MongoDB also contains an orphan `DEVICE_REGISTRATION_FLOW` document (`id: 172d98cb-b33d-4037-99ca-7cdb58519259`) linked to the deleted self-registered user `b50319ee-...`. This was created during self-registration and was not cleaned up by `deleteUser`.

## Code references

- `petlink-data-migration/src/lib/aws/cognito.ts:31-70` (`createCognitoUser`)
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:397-434` (create Cognito user and rollback)
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:517-544` (`rollbackUserData` — does not touch Cognito)
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:133-155` (only checks MongoDB, not Cognito)

## Evidence from Loki

`DatamarsPetlinkDataMigrationProd-migrationOnDemand` logs show:

- Attempts 1-3: `InvokeRequest: +33660874021, KIPPY` (phone contact) → `UsernameExistsException`
- Attempt 4: `InvokeRequest: matthias.deschamps@laposte.net, KIPPY` (email contact) → `Created user` with status `FORCE_CHANGE_PASSWORD` and `Username: 4dc6101b-4403-4d61-9b4a-de4a1f99744a`

`DatamarsPetlinkEverywhereCoreProd-signUpUser` logs show:
- 2026-08-01 08:13:41 UTC: self-registration with email `matthias.deschamps@laposte.net`, phone `+33660874721`, Cognito username `b50319ee-3160-4455-a3d0-32705d713b91`

`DatamarsPetlinkEverywhereCoreProd-deleteUser` logs show:
- 2026-08-02 08:13:14 UTC: user self-deletes account `b50319ee-...` (sets `deleted: true` in MongoDB, deletes Cognito user)

The 08:14 migration attempt succeeded because the user deleted their self-registered account at 08:13, clearing the Cognito email alias conflict.

## Fix options

1. **Search `findItem` by MySQL email too (PRIMARY FIX)**
   - After fetching `mysqlUser` via `getMysqlUser`, perform a second `findItem` search using `mysqlUser.email` before proceeding to Cognito creation.
   - This catches the case where a user self-registered with the same email but a different phone number.
   - Also search by the legacy phone from MySQL (`+countryCode + registrationPhone`), not just the `contact` field.

2. **Pre-flight Cognito existence check**
   - Before `adminCreateUser`, call `adminGetUser` with the user's email.
   - If a Cognito user already exists, either fail fast with a clear message or reuse the account after confirming it matches the legacy user.

3. **Idempotent Cognito creation in migration**
   - If `adminCreateUser` throws `UsernameExistsException`, call `adminGetUser` to retrieve the existing user and treat it as success (or update attributes and continue) instead of failing.

4. **Delete Cognito user on rollback**
   - Add `deleteCognitoUser(userPoolId, user.id)` to `rollbackUserData`.
   - This prevents orphan Cognito accounts from blocking future attempts.
   - Be careful not to delete a user that was created by a different flow (e.g. direct sign-up).

5. **Close duplicates**
   - PRTSUP-668/669/670 are the same incident. Two should be closed as duplicates of the third.

## Orphan BILLING_INFO documents (new finding 2026-08-06)

MongoDB inspection reveals **3 orphan `BILLING_INFO` documents** left behind by the 3 failed migration attempts. The successful attempt also created a 4th BILLING_INFO (correctly linked to the final user).

| Orphan userId | BILLING_INFO id | Session |
|---|---|---|
| `404c2e66-6961-4dd6-933f-9fa9e7bde870` | `b34ef6b0-3103-44f0-b741-43877d911a59` | `741d99c0` (06:57 UTC) |
| `9aef8fa3-7aca-4bb1-b146-42aa6576bfaf` | `a4ad4f75-2cb2-4ba7-a697-c76e68e8d059` | `43f24d83` (06:58 UTC) |
| `fb6216ef-5525-487e-b6e1-8ade5d68a379` | `397cd2ff-ffce-4e23-a589-cf0627ca2b55` | `62ee58fc` (07:05 UTC) |
| `4dc6101b-...` (correct) | `5baa5fd9-...` | `764141cf` (08:14 UTC, success) |

No other orphan entities (PET, PETLINK_GPS, SUBSCRIPTION, INVOICE) remain — rollback correctly deleted those. Only BILLING_INFO was left behind.

### Root cause of orphans

`updatePetlinkUserCbData` in `subscriptionMigration/util.ts:153-172` creates a `BILLING_INFO` document via `insertItem` but **does not return the id**. The `subscriptionMigration` handler does not include the BILLING_INFO id in its `idsSaved` response. Therefore `migrationOnDemand` never adds it to `migratedIds`, and `rollbackUserData` — which deletes by `{ id: { $in: idsToDelete } }` — never deletes it.

### Migration history evidence

`migrationHistory` collection shows 4 sessions for legacy user `224953`:

1. Session `741d99c0` — started 06:57:55Z, USER has no `endedAt` (failed at Cognito), SUBSCRIPTIONS completed
2. Session `43f24d83` — started 06:58:44Z, USER has no `endedAt` (failed at Cognito), SUBSCRIPTIONS completed
3. Session `62ee58fc` — started 07:05:12Z, USER has no `endedAt` (failed at Cognito), SUBSCRIPTIONS completed
4. Session `764141cf` — started 08:14:00Z, USER ended with `usersMigrated: 1` (success)

Each failed session completed SUBSCRIPTIONS (which creates BILLING_INFO) before failing at Cognito. Rollback deleted all entities except BILLING_INFO.

### Additional fix

5. **Return BILLING_INFO id from `updatePetlinkUserCbData` and include it in `idsSaved`**
   - Modify `updatePetlinkUserCbData` to return the `billingInfo.id`.
   - In `subscriptionMigration/handler.ts`, push the returned id to `idsSaved`.
   - This ensures `rollbackUserData` will delete the BILLING_INFO on failure.

### Data cleanup

The 3 orphan BILLING_INFO documents should be manually deleted from production:
```js
db.petlinkEverywhere.deleteMany({
  entityType: "BILLING_INFO",
  userId: { $in: [
    "404c2e66-6961-4dd6-933f-9fa9e7bde870",
    "9aef8fa3-7aca-4bb1-b146-42aa6576bfaf",
    "fb6216ef-5525-487e-b6e1-8ade5d68a379"
  ]}
})
```

## Impact

- 3 open duplicate tickets for a single user who is now migrated.
- Every failed retry creates a new Jira ticket and an error email.
- Without a fix, any partial migration that fails after Cognito creation can lock the user until the orphan account is manually removed.
- **3 orphan BILLING_INFO documents accumulate in MongoDB per failed attempt** (data pollution).

## Recovery

1. Close PRTSUP-668 and PRTSUP-669 as duplicates of PRTSUP-670.
2. Verify in Cognito / MongoDB that `matthias.deschamps@laposte.net` is in a consistent migrated state (USER `4dc6101b-...` with `migrated: true`, `deleted: false`).
3. Delete the 3 orphan BILLING_INFO documents (see Data cleanup above).
4. Delete the orphan DEVICE_REGISTRATION_FLOW document (`id: 172d98cb-b33d-4037-99ca-7cdb58519259`, `userId: b50319ee-...`).
5. Soft-delete or hard-delete the orphan self-registered USER document (`id: b50319ee-3160-4455-a3d0-32705d713b91`, already `deleted: true`).
6. Apply fix options 1-2 (findItem by email + Cognito pre-flight check) and option 5 (BILLING_INFO rollback) before the next wave of migrations.

## Production code version

- Commit `773d33f` (v2.3.16, 2026-07-20) — no changes between this and the incident date.
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` — `findItem` at lines 133-145, Cognito creation at lines 397-410.
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts` — `getMysqlUser` at lines 314-343, `createUser` at lines 345+ (uses `mysqlUser.email` at line 375).
- `petlink-data-migration/src/lib/aws/cognito.ts` — `createCognitoUser` at lines 31-70.
