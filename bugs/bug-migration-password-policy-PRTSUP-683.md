# Bug: Migration fails with `InvalidPasswordException` when the legacy password does not satisfy the Cognito password policy

**Primary Jira tickets:**

- PRTSUP-683 — `a.nelli20@alice.it` (1 ticket)
- PRTSUP-684 — `serenaroberti73@gmail.com` (17 tickets; keep this one, close PRTSUP-662-680)
- PRTSUP-661 — `chiaraferrera3@hotmail.it` (39 tickets; keep this one, close PRTSUP-622-660)

## Affected users (open `[PROD]-[KIPPY]: MIGRATION ISSUE` tickets)

- `serenaroberti73@gmail.com` — 17 duplicate tickets (PRTSUP-684, 680-679, 678-662, 667, 666, 665)
- `chiaraferrera3@hotmail.it` — 39 duplicate tickets (PRTSUP-661-624, except PRTSUP-657)
- `a.nelli20@alice.it` — 1 ticket (PRTSUP-683)

**Feedback seen in Jira:**

- `User migration failed - cognito user creation error: InvalidPasswordException: Password did not conform with password policy: Password not long enough`
- `User migration failed - cognito user creation error: InvalidPasswordException: Password did not conform with password policy: Password must have numeric characters`

## Root cause

The migration flow uses the **legacy Kippy password** as the new Cognito password:

1. In the mobile app, `auth_view_model.dart` calls `startMigration` with the same `passwordController.text` that the user entered for the legacy account (after `checkMigration` verified the SHA256 hash against MySQL).
2. `petlink-everywhere-core/src/lambda_functions/graphql/mutation/startMigration/handler.ts` forwards `event.arguments.password` unchanged to the `migrationOnDemand` Lambda.
3. `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts` builds `effectivePassword` as:
   ```ts
   const effectivePassword =
     password ?? (source === 'BULK' ? generateBulkPassword() : undefined);
   ```
   For `ON_DEMAND` source it uses the user-supplied password.
4. `petlink-data-migration/src/lib/aws/cognito.ts` calls `adminCreateUser` with `TemporaryPassword: effectivePassword`, then `adminSetUserPassword` with the same password.
5. The Cognito User Pool (defined in `petlink-everywhere-core/cdk/stacks/common-stack.ts`) has the policy:
   ```ts
   passwordPolicy: {
     minLength: 6,
     requireLowercase: true,
     requireUppercase: false,
     requireDigits: true,
     requireSymbols: false,
   }
   ```

When the legacy password is shorter than 6 characters or does not contain a digit, `adminCreateUser` throws `InvalidPasswordException` and the whole migration is rolled back (MongoDB user deleted, MySQL `migrated` flag reset). The user can retry indefinitely, creating the large set of duplicate Jira tickets.

## Code references

- `petlink-everywhere-core/src/lambda_functions/graphql/mutation/startMigration/handler.ts` (passes `password` to data-migration)
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:114-115` (`effectivePassword`)
- `petlink-data-migration/src/lib/aws/cognito.ts:31-70` (`createCognitoUser`)
- `petlink-everywhere-core/cdk/stacks/common-stack.ts:376-382` (Cognito password policy)
- `petlink-everywhere-mobile/lib/features/auth/presentation/view_model/auth_view_model.dart:440-457` (`fieldValidation` — the regex is not enforced before migration)
- `petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts:155-173` (only verifies password hash, not Cognito policy)

## Why the mobile validation does not stop this

`auth_view_model.dart` contains the regex:

```dart
RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$')
```

but `fieldValidation` does not block submission when the password fails this regex. It only sets `isPasswordCriteria = false`; the flow still calls `checkMigration` and, if the legacy hash matches, `startMigration`.

## Fix options

### Short-term (defensive)

- In `startMigration` / `migrationOnDemand`, validate the provided password against the Cognito policy **before** creating the user. If it does not comply, return a clear error/translation code and do not attempt Cognito creation, avoiding false Jira tickets.
- Make the mobile (and web) `startMigration` flow enforce the policy upfront and guide the user to create a compliant password.

### Recommended structural fix

- For `ON_DEMAND` migration, do **not** reuse the legacy password as the Cognito password. Instead:
  1. Generate a strong compliant password with `generateBulkPassword()` (already used for `BULK`).
  2. Set `forceChangePassword: true` in the created `User` document.
  3. After successful migration, force the user to set a new password on first login (the app already supports `forceChangePassword` and `forceSetUserData`).

This decouples the legacy password (which may be weak) from the Cognito pool policy. If the user is supposed to keep the same password, the app must collect it and validate it against the policy before sending it to `startMigration`.

## Impact

- 57 open, unassigned, duplicated tickets for only 3 distinct users.
- Each retry also triggers an email to `info@kippy.eu`, generating noise.
- Users with weak legacy passwords are completely blocked from migration.

## Recovery

1. Close the duplicate Jira tickets, keeping one per user (e.g., PRTSUP-683, PRTSUP-684, PRTSUP-657).
2. Apply the fix.
3. After deployment, ask the affected users to retry migration; if a generated-password approach is chosen, send them a one-time secure password or force a reset in the app.

## Related bug files

- `bug-migration-create-user-null-PRTSUP-584.md` — different error but same flow (`createUser` validation)
- `bug-migration-phone-number.md` — similar pattern of duplicate migration attempts
