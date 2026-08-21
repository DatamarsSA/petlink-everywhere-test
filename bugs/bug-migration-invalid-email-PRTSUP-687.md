# Bug: Migration fails with `User validation failed: Invalid email` when legacy MySQL email is malformed

**Primary Jira ticket:** PRTSUP-687

## Summary

The user's legacy email in MySQL (`elivez@08@gmail.com`) contains two `@` symbols, making it an invalid email address. The `createUser` function in `migrationOnDemand` builds a `User` object and validates it with `User.safeParse()` (Zod schema). The Zod schema requires `email: z.string().email()`, which rejects the malformed address. The migration fails, rolls back, and the user can retry indefinitely — same infinite retry loop pattern as PRTSUP-584.

## Affected user

- **Email (legacy MySQL)**: `elivez@08@gmail.com` (invalid — contains two `@` symbols)
- **Name / Surname**: Elisa Vezzoli
- **Phone**: 3495372051 (Italy, +39)
- **Legacy MySQL ID**: `219723` (EU / Kippy)
- **App brand**: KIPPY
- **Incident date**: 2026-08-06T21:40:44Z (2 attempts: 21:40:44 and 21:41:20)

## Root cause

The legacy MySQL database contains an email address with a typo: `elivez@08@gmail.com`. This is not a valid email format (two `@` characters). The migration flow does not sanitize or validate the email before building the `User` object:

1. `createUser` (`migrationOnDemand/util.ts:375`) sets `email: mysqlUser.email!.trim()` — it trims whitespace but does not validate the email format.
2. `User.safeParse(petlinkUser)` (`util.ts:447`) validates the object against the Zod `User` schema.
3. The `User` schema (`lib/types/mongodb/user.ts:74`) defines `email: z.string().email()`.
4. Zod's `.email()` validation rejects `elivez@08@gmail.com` because it contains two `@` symbols.
5. `safeParse` fails → `throw new Error('User validation failed: ...')` → caught by handler → rollback → 500.

The handler (`migrationOnDemand/handler.ts:202-227`) catches the error, calls `rollbackUserData` (which resets `migrated=0` in MySQL), sends an error email, and returns 500. Since `migratedIds` is empty (user was never inserted in MongoDB), the rollback only resets the MySQL flag. The user can retry indefinitely.

### Why the email is invalid

`elivez@08@gmail.com` contains:
- `@` after `elivez` (local part separator)
- `08@gmail.com` as the domain part, which itself contains `@`

Zod's `.email()` uses a standard email regex that allows only one `@` character. The email was likely a typo by the user during original registration on the legacy Kippy platform (meant to be `elivez08@gmail.com`).

## Flow (from real logs)

```
checkMigration("elivez@08@gmail.com")
  → MongoDB: count=0 (not found)
  → MySQL: WHERE migrated=0 AND email='elivez@08@gmail.com' → user 219723 found
  → returns user_can_be_migrated

App shows migration dialog → user presses "confirm"

startMigration → Lambda Invoke migrationOnDemand

migrationOnDemand:
  1. Idempotency check: MongoDB → not found
  2. getMysqlUser → user 219723
  3. setUserMigrated: migrated=0→1 (lock acquired)
  4. startMigrationStatsCollection → migrationHistory
  5. createUser → email: "elivez@08@gmail.com".trim() → User.safeParse → Zod .email() FAILS
  6. throw Error("User validation failed: [{validation:email, code:invalid_string, message:Invalid email, path:[email]}]")
  7. catch → rollbackUserData([], connection, 219723) → migrated=0 (lock released)
  8. sendEmailMigrationError → feedback email sent
  9. returns 500
```

## Real logs (Loki, 2026-08-06)

### Attempt 1 — 21:40:44 UTC

```
21:40:44.051  Returning user 219723
21:40:44.069  Lock acquired for legacyUserId 219723 (setUserMigrated)
21:40:44.090  result: migrationHistory {_id, sessionId: 5d4b6140..., userId: "219723", email: "elivez@08@gmail.com", startedAt: "2026-08-06T21:40:44.070Z"}
21:40:44.269  createUser failed: User validation failed: [{"validation":"email","code":"invalid_string","message":"Invalid email","path":["email"]}]
              stack: Error: User validation failed: ...
                  at createUser (file:///var/task/index.mjs:100658:13)
                  at Runtime.handler (file:///var/task/index.mjs:102243:20)
21:40:44.269  Rollback started for legacyUserId 219723, deleting 0 items by id: []
21:40:44.290  Rollback completed for legacyUserId 219723
21:40:44.291  send body: {appBrand: "KIPPY", email: "elivez@08@gmail.com", name: "Elisa", surname: "Vezzoli", phone: "3495372051", feedback: "User migration failed - user creation error: Error: User validation failed: ..."}
```

### Attempt 2 — 21:41:20 UTC (36 seconds later)

```
21:41:20.069  Returning user 219723
21:41:20.083  Lock acquired for legacyUserId 219723 (setUserMigrated)
21:41:20.094  result: migrationHistory {_id, sessionId: b7fdd386..., userId: "219723", email: "elivez@08@gmail.com", startedAt: "2026-08-06T21:41:20.083Z"}
21:41:20.096  createUser failed: User validation failed: [{"validation":"email","code":"invalid_string","message":"Invalid email","path":["email"]}]
21:41:20.097  Rollback started for legacyUserId 219723, deleting 0 items by id: []
21:41:20.130  send body: {appBrand: "KIPPY", email: "elivez@08@gmail.com", ...}
21:41:20.130  Rollback completed for legacyUserId 219723
```

## MongoDB state

- **`petlinkEverywhere`**: No USER document found for `elivez@08@gmail.com`, `elivez08@gmail.com`, or phone `+393495372051`. User was never persisted.
- **`migrationHistory`**: 2 sessions found, both with no `endedAt` (failed during USER step):
  1. Session `5d4b6140-e7e5-4153-9606-ef53b627075a`, started `2026-08-06T21:40:44.070Z`
  2. Session `b7fdd386-eaf2-4e17-8ae2-9d5685fa1a4a`, started `2026-08-06T21:41:20.083Z`

## Production code version

- **Repo**: `petlink-data-migration`
- **Commit**: `773d33f` (version 2.3.16, 2026-07-20)
- **Previous commit**: `70e3a6f` — "refactor(user): improve error handling in createUser function" (2026-07-20)
- The improved error logging from PRTSUP-584 is present: `createUser` now logs `error?.message` and `stack` instead of serializing as `{}`.

## Code references

| File | Line(s) | Role |
|---|---|---|
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts` | 375 | `email: mysqlUser.email!.trim()` — no email format validation |
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts` | 447-461 | `User.safeParse()` → fails on invalid email → throws |
| `petlink-data-migration/src/lib/types/mongodb/user.ts` | 74 | `email: z.string().email()` — Zod email validation |
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` | 194-227 | Catches `createUser` error → rollback → 500 |
| `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` | 477-492 | `rollbackUserData` — resets `migrated=0` |

## Difference from known bugs

| | PRTSUP-584 (createUser null) | PRTSUP-683 (password policy) | **This bug (invalid email)** |
|---|---|---|---|
| Root cause | Null MySQL fields → throw | Weak legacy password → Cognito rejects | **Malformed email in MySQL → Zod rejects** |
| Always fails | Yes | Yes | **Yes** |
| `migrated` after failure | 0 (rollback resets) | 0 (rollback resets) | **0 (rollback resets)** |
| User in MongoDB | No | No | **No** |
| Retry possible | Yes, infinite | Yes, infinite | **Yes, infinite** |
| Validation layer | createUser (Zod) | Cognito (AWS) | **createUser (Zod)** |

## Fix options

### Option A: Sanitize/repair invalid email in `createUser` (minimal)

Before building the `User` object, validate the email with `validator.isEmail()`. If invalid, attempt to repair common typos (e.g., remove extra `@` characters) or set a placeholder and flag `forceSetUserData: true` so the user is prompted to correct it on first login:

```typescript
let email = mysqlUser.email!.trim();
if (!isEmailStrict(email)) {
  logger.info(`Legacy email ${email} is invalid, attempting repair`);
  // Attempt to fix common typos: multiple @ symbols
  const atCount = (email.match(/@/g) || []).length;
  if (atCount > 1) {
    // Keep the last @ as separator, replace earlier ones
    const lastAtIndex = email.lastIndexOf('@');
    const localPart = email.substring(0, lastAtIndex).replace(/@/g, '');
    const domain = email.substring(lastAtIndex + 1);
    email = `${localPart}@${domain}`;
  }
  if (!isEmailStrict(email)) {
    // Still invalid — use placeholder and force update
    email = `invalid-${mysqlUser.id}@placeholder.kippy.eu`;
    // Ensure forceSetUserData is true (already set)
  }
}
```

### Option B: Pre-flight email validation in `checkMigration` (complementary)

In `checkMigration` (`petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts`), validate the legacy email before returning `user_can_be_migrated`. If the email is invalid, return a specific error code (e.g., `errors.invalid_legacy_email`) so the app can show a targeted message instead of allowing the user to enter an endless retry loop.

### Option C: Fix the email directly in MySQL (operational)

For this specific user, update the email in the legacy MySQL database from `elivez@08@gmail.com` to `elivez08@gmail.com` (the likely intended address). This is the immediate fix to unblock the user.

## Proposed immediate action

1. **Fix the email in MySQL**: Update `user` table for ID `219723` to correct the email to `elivez08@gmail.com` (pending confirmation from the user).
2. **Apply Option A** to prevent future occurrences with other users who may have malformed emails in the legacy database.

## Remaining uncertainty

- We cannot verify the exact content of the MySQL `email` field without database access. The Loki logs and Jira ticket both show `elivez@08@gmail.com`, which is consistent.
- The user's intended email is likely `elivez08@gmail.com` but this should be confirmed with the user before modifying MySQL.
- There may be other legacy users with similarly malformed emails who have not yet attempted migration.

## Description for CCT support if that user contact them

```shell
@Christian Prete @Omar El Sharkawy (Kippy) 
he problem during this migration is that the email elivez@08@gmail.com is not valid (in this case I think the main problem was the double @).
The user should come back on old app, correct email with one valide (example elivez08@gmail.com, that would pass), then retry migration from old app.
```