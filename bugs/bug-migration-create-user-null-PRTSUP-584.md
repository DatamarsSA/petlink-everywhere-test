# createUser Returns null — Infinite Migration Retry Loop

## Summary

`createUser` in `migrationOnDemand` throws on null fields from the legacy MySQL user record, returns `null`, triggers `rollbackUserData` which resets `migrated=0`, and allows the user to retry indefinitely. The user is never persisted in MongoDB and never appears in CCT.

## Affected User

- **Email**: `fabio.finardi@outlook.it`
- **Legacy MySQL ID**: `136398` (EU / Kippy)
- **Registration phone**: `3356670650` (Italy, country code `+39`)
- **Name / Surname in MySQL**: `null` / `null` (account incomplete)
- **Migration attempts**: ~192 (manual retries over time)

## Root Cause

`createUser` (`migrationOnDemand/util.ts:342-460`) uses non-null assertions (`!`) on MySQL fields that can be `null`. When any of these fields is null, the function throws inside the `try` block, the `catch` at line 456 logs the error as `{}` (serialized Error object), and returns `null`.

The handler (`migrationOnDemand/handler.ts:189-214`) detects `user == null`, calls `rollbackUserData` which resets `migrated=0` in MySQL, and returns 500. Since `migratedIds` is empty (user was never inserted in MongoDB), the rollback only resets the MySQL flag — nothing is deleted from MongoDB.

`checkMigration` then finds the user again (`migrated=0`), returns `user_can_be_migrated`, and the app shows the migration dialog again. The user retries, and the cycle repeats.

### Fields that can throw

| Line | Code | Throws when |
|---|---|---|
| 367 | `getKippyCountry(mysqlUser.country_id!)` | `country_id` is null → `countries.find(...)` returns undefined → `.country_code` throws |
| 373 | `getKippyLanguageId(mysqlUser.language_id)` | `language_id` is null → `languages.find(...)` returns undefined → `.code` throws |
| 368 | `mysqlUser.user_registration_date.toISOString()` | `user_registration_date` is null → `.toISOString()` throws |
| 384 | `mysqlUser.lastRecordChangeTime.toISOString()` | `lastRecordChangeTime` is null → `.toISOString()` throws |
| 381 | `getKippyState(mysqlUser.state_id ?? null)` | `state_id` is non-null but invalid → `states.find(...)` returns undefined → `.petlink_id` throws |

For user 136398, `name` and `surname` are both `null` (confirmed by the SendGrid error email), strongly suggesting other fields are also missing.

## Flow (from real logs)

```
checkMigration("fabio.finardi@outlook.it")
  → MongoDB: { email: "fabio.finardi@outlook.it" } → count=0 (not found)
  → MySQL: WHERE migrated=0 AND email='fabio.finardi@outlook.it' → user 136398 found
  → returns user_can_be_migrated

App shows migration dialog → user presses "confirm"

startMigration("fabio.finardi@outlook.it", password, KIPPY)
  → Lambda Invoke migrationOnDemand

migrationOnDemand:
  1. Idempotency check: MongoDB { email } → not found
  2. getMysqlUser → user 136398 (no filter on migrated)
  3. setUserMigrated: UPDATE migrated=1 WHERE id=136398 AND migrated=0 → affectedRows=1 (lock acquired)
  4. startMigrationStatsCollection → writes migrationHistory with startedAt
  5. createUser(appBrand, mysqlUser, ...) → THROWS on null field → catch → returns null
  6. handler: user == null → rollbackUserData([], connection, 136398)
     → deleteItems (empty array, no-op)
     → UPDATE migrated=0 WHERE id=136398 (lock released)
  7. sendEmailMigrationError (name="N/A", surname="N/A")
  8. returns 500

startMigration receives 500 → returns errors.migration_failed to app

App shows error → user retries → back to checkMigration
```

## Real Logs (2026-07-12, first 4 attempts)

### Attempt 1 — 09:19:16

```
09:19:16.894  checkMigration: query {"entityType":"USER","$or":[{"email":"fabio.finardi@outlook.it"},{"phone":"fabio.finardi@outlook.it"}]}
09:19:16.898  Count item count: 0
09:19:16.898  Failed to find user in petlinkEverywhere db. Checking for migration
09:19:17.121  Returning EU user 136398
09:19:17.121  handler success: user_can_be_migrated (227ms)

09:19:21.054  startMigration: received request
09:19:23.412  migrationOnDemand: InvokeRequest: fabio.finardi@outlook.it, KIPPY
09:19:24.510  Entered contact is an email address
09:19:24.810  Returning user 136398
09:19:24.810  USER MIGRATION: START
09:19:24.939  result: migrationHistory {_id, sessionId: e21a6a24..., userId: "136398", startedAt: "2026-07-12T09:19:24.810Z"}
09:19:24.947  {}                          ← createUser catch: error serialized as {}
09:19:24.948  Error creating user         ← handler: user == null
09:19:24.969  send body: {name: "N/A", surname: "N/A", phone: "3356670650", feedback: "User migration failed - user creation error"}
09:19:25.461  sendEmail - Email sent
09:19:26.253  dataRaw: {"code":"500","message":"User migration failed"}
09:19:26.253  handler success: 500, errors.migration_failed (5199ms)
```

### Attempt 2 — 09:19:32 (6 seconds later)

```
09:19:32.273  checkMigration: count=0 → user_can_be_migrated (236ms)
09:19:33.859  startMigration: received request
09:19:33.928  migrationOnDemand: InvokeRequest
09:19:34.147  Returning user 136398
09:19:34.147  USER MIGRATION: START
09:19:34.175  result: migrationHistory {sessionId: 508fe6c4..., startedAt: "2026-07-12T09:19:34.147Z"}
09:19:34.178  {}                          ← createUser catch
09:19:34.178  Error creating user
09:19:34.188  send body: {name: "N/A", surname: "N/A", phone: "3356670650"}
09:19:34.293  dataRaw: {"code":"500"} (434ms)
```

### Attempt 3 — 09:21:54 (2.5 minutes later)

```
09:21:54.893  checkMigration: count=0 → user_can_be_migrated (301ms)
09:21:58.857  startMigration: received request
09:21:59.552  migrationOnDemand: InvokeRequest
09:21:59.964  Returning user 136398
09:21:59.964  USER MIGRATION: START
09:21:59.998  result: migrationHistory {sessionId: a6f949cc..., startedAt: "2026-07-12T09:21:59.964Z"}
09:21:59.998  {}                          ← createUser catch
09:21:59.998  Error creating user
09:22:00.005  send body: {name: "N/A", surname: "N/A", phone: "3356670650"}
09:22:00.654  dataRaw: {"code":"500"} (1797ms)
```

### Attempt 4 — 09:22:07 (9 seconds later)

```
09:22:03.505  checkMigration: count=0 → user_can_be_migrated (241ms)
09:22:07.704  checkMigration: count=0 → user_can_be_migrated (249ms)  ← user didn't press confirm immediately
09:22:13.424  startMigration: received request
09:22:13.532  migrationOnDemand: InvokeRequest
09:22:13.631  Entered contact is an email address
09:22:13.999  Returning user 136398
09:22:13.999  USER MIGRATION: START
09:22:14.027  result: migrationHistory {sessionId: 6f50b819..., startedAt: "2026-07-12T09:22:13.999Z"}
09:22:14.027  {}                          ← createUser catch
09:22:14.027  Error creating user
09:22:14.030  send body: {name: "N/A", surname: "N/A", phone: "3356670650"}
09:22:14.155  dataRaw: {"code":"500"} (731ms)
```

### Pattern

Every attempt is identical:
1. `checkMigration` → MongoDB count=0 → MySQL user 136398 (migrated=0) → `user_can_be_migrated`
2. `migrationOnDemand` → `setUserMigrated` (lock acquired) → `startMigrationStatsCollection` → `createUser` throws `{}` → `Error creating user` → `rollbackUserData` (lock released, migrated=0) → 500
3. App shows error → user retries

The `{}` is the serialized Error object from the `catch` block in `createUser` (`util.ts:456-458`):
```typescript
} catch (error: any) {
  logger.error(error);  // Error objects serialize as {} in JSON
  return null;
}
```

## Why 192 Attempts?

**Manual retries.** Evidence from logs:
- Intervals between attempts are irregular: 6s, 2.5min, 3s, 4s, 6s, 9s
- `checkMigration` is called before each `startMigration` (app flow requires user interaction on dialog)
- Some `checkMigration` calls are not followed by `startMigration` (user opened app but didn't press confirm)
- No automated loop would produce this pattern

192 attempts spread over days/weeks is plausible for a frustrated user repeatedly trying to log in.

## Why User Not in CCT

`createUser` fails **before** `insertItem` in MongoDB (`handler.ts:217`). The user object is never persisted. `migratedIds` is `[]` at rollback time, so `deleteItems` is a no-op. The user has never existed in Petlink Everywhere MongoDB at any point.

## Difference from Known Bugs

| | Mode A (blocked) | Mode B (duplicate crash) | **This bug (createUser null)** |
|---|---|---|---|
| First migration | Succeeds | Succeeds | **Always fails** |
| `migrated` after failure | 1 (stuck) | 1 (stuck) | **0 (rollback resets)** |
| User in MongoDB | Yes | Yes | **No (never inserted)** |
| User in CCT | Yes | Yes | **No** |
| Retry possible | No | No | **Yes, infinite** |
| Root cause | Phone norm mismatch | Phone norm + race | **Null MySQL fields → createUser throw** |

## Fix Options

### Option A: Defensive null handling in `createUser` (minimal)

Add fallbacks for null fields:
- `mysqlUser.country_id!` → `mysqlUser.country_id ?? 0` (with fallback country code)
- `mysqlUser.language_id` → `mysqlUser.language_id ?? 0` (with fallback language)
- `mysqlUser.user_registration_date.toISOString()` → `mysqlUser.user_registration_date?.toISOString() ?? new Date(0).toISOString()`
- `mysqlUser.lastRecordChangeTime.toISOString()` → `mysqlUser.lastRecordChangeTime?.toISOString() ?? new Date(0).toISOString()`

### Option B: Circuit breaker (complementary)

After N consecutive failures for the same user, mark `migrated=2` (failed permanent) instead of `migrated=0`. This blocks `checkMigration` from returning `user_can_be_migrated` and stops the retry loop. Requires manual intervention to reset.

### Option C: Better error logging (diagnostic)

Log the actual error message and stack trace in `createUser` catch block instead of `logger.error(error)` which serializes as `{}`:
```typescript
logger.error(`createUser failed: ${error?.message ?? error}`, { stack: error?.stack });
```

## Files Involved

| File | Role |
|---|---|
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts:342-460` | `createUser` — throws on null MySQL fields |
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:181-214` | Handler — detects `user == null`, calls rollback, returns 500 |
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:477-492` | `rollbackUserData` — resets `migrated=0` unconditionally |
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts:303-309` | `setUserMigrated` — atomic lock (`migrated=0→1`), released by rollback |
| `petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts` | `checkMigration` — finds user in MySQL with `migrated=0`, returns `user_can_be_migrated` |
