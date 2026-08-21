# Bug: `changeForgotPassword` fails with `InvalidParameterException` when password contains leading/trailing whitespace

**Primary Jira ticket:** PRTSUP-694

## Affected user

- **Email:** `lallabattaglia83@gmail.com`
- **User ID:** `d77fe090-c2cd-46fa-9a30-809198e7bb0d`
- **App brand:** KIPPY (EU)
- **Migration status:** Migrated (`migrated: true`)
- **Legacy ID:** 210326

## Incident date

- Ticket created: 2026-08-07 14:46 CEST
- Last successful password reset observed in logs: 2026-08-06 ~16:59 UTC
- Multiple `InvalidParameterException` errors observed across all users from at least 2026-08-05 through 2026-08-07

## Observed behaviour

User reports: "I am unable to reset my password because the link I am receiving to change it is always expired, or the page fails to load." CS team also sent a password reset link, but the same thing happened.

## Relevant logs

### `sendOtpForgotPassword` for this user (Aug 6, 2026)

1. **12:06 UTC** (request_id: `37384976-...`) — request received with `contact: lallabattaglia83@gmail.com`, `appBrand: KIPPY`. No OTP creation log visible (possibly returned 422 "wait for new OTP" or other early exit).
2. **16:56 UTC** (request_id: `ebe169f2-...`) — same request, no OTP creation log.
3. **16:58 UTC** (request_id: `abda752e-...`) — OTP successfully created: `otp: 51596`, `expires_at: 1786047796` (5 min later). OTP record ID: `3b5cdeb7-98d3-4871-b54b-ec85618c18ef`.

### `changeForgotPassword` for this user (Aug 6, 2026)

4. **16:59 UTC** (request_id: `be829699-...`) — OTP verified (`verification: true`), user found in MongoDB, `changeForgotPassword` called, `forceChangePassword` set to false. **This succeeded.**

### `changeForgotPassword` errors (systemic, all users)

Multiple `InvalidParameterException` errors in `changeForgotPassword` Lambda (production):

```
InvalidParameterException: 1 validation error detected: Value at 'password' failed to satisfy constraint:
Member must satisfy regular expression pattern: ^[\S]+.*[\S]+$
    at changeForgotPassword (file:///var/task/index.mjs:191612:3)
```

Observed at (UTC):
- 2026-08-05 ~23:25 (trace: `279dcf7d...`)
- 2026-08-05 ~23:31 (trace: `e0f34c20...`)
- 2026-08-05 ~23:39 (trace: `e9c5beda...`)
- 2026-08-05 ~23:47 (trace: `e55706c8...`)
- 2026-08-05 ~23:55 (trace: `96b06dbb...`)
- 2026-08-06 ~01:25 (trace: `7d2bf521...`)
- 2026-08-07 ~01:36 (trace: `7d2bf521...`)
- 2026-08-07 ~02:48 (trace: `4ce1d8c4...`)
- 2026-08-07 ~02:49 (trace: `54b3208b...`)
- 2026-08-07 ~02:50 (trace: `9407386d...`)
- 2026-08-07 ~10:04 (trace: `1a61eb5d...`)

These are from different users (different request_ids/trace_ids), confirming a systemic issue.

## Relevant MongoDB state

User document (`petlinkEverywhere` collection, `entityType: USER`):

- `email`: `lallabattaglia83@gmail.com`
- `phone`: `+393316482823`
- `contactVerified`: `{phone: true, email: true}`
- `forceChangePassword`: false
- `forceSetUserData`: true
- `migrated`: true
- `appBrand`: KIPPY
- `legacyId`: 210326
- `chargebeeId`: KPY-111445

## Root cause

### Primary issue: password whitespace not trimmed (systemic bug, inferred)

> **NOTA:** Il bug del whitespace è **inferito** dal pattern regex nell'errore, non confermato direttamente per questa specifica utente. I log di questa utente mostrano che il reset password ha avuto **successo** il 6 ago. Gli errori `InvalidParameterException` nei log sono di **altri utenti**. Non ci sono log di `changeForgotPassword` per questa utente il 7 ago.

The `changeForgotPassword` handler passes `event.arguments.password` directly to Cognito's `AdminSetUserPassword` API without trimming:

```typescript
// changeForgotPassword/handler.ts:67-71
await changeForgotPassword(
  getEnv('USER_POOL_ID'),
  userResponse.item.id,
  event.arguments.password  // ← no .trim()
);
```

```typescript
// cognito.ts:151-163
export const changeForgotPassword = async (
  userPool: string,
  username: string,
  password: string
) => {
  const input: AdminSetUserPasswordCommandInput = {
    UserPoolId: userPool,
    Username: username,
    Password: password,  // ← passed as-is
    Permanent: true,
  };
  await client.adminSetUserPassword(input);
};
```

Cognito's `AdminSetUserPassword` API enforces the regex `^[\S]+.*[\S]+$` on the password field, which rejects passwords with leading or trailing whitespace. When a user (or mobile keyboard autocorrect) accidentally includes a space at the start or end of the password, the API throws `InvalidParameterException`.

The handler does not catch this error — it propagates as an unhandled Lambda failure, so the AppSync client receives a generic 500 error with no useful translation code. The user sees a vague error and retries, getting the same result.

### Secondary issue: "link" vs OTP — analysis of possible reset link flows

The user's description mentions a "link" that is "expired" or "page fails to load." **Il nuovo sistema Petlink Everywhere NON invia link di reset password — invia un codice OTP a 5 cifre via email** (SendGrid template `RESET_PASSWORD_OTP`).

**Il flusso legacy (link) viene triggerato SOLO per utenti non migrati.** Nel handler `sendOtpForgotPassword`:
- Se l'utente è trovato in MongoDB (`resUser.code == '200' && resUser.item`), viene inviato un OTP via email/SMS (template `RESET_PASSWORD_OTP` / `SEND_OTP`).
- Se l'utente **NON** è trovato in MongoDB, viene interrogato il MySQL legacy con `WHERE migrated = 0`, e solo allora viene chiamato `request_forgot_password_token.php` (che invia un link).

Poiché questa utente è `migrated: true` ed è presente in MongoDB, il sistema nuovo **non può** inviare un link legacy — può solo inviare un OTP.

**Il CCT NON ha alcuna funzionalità di reset password per utenti finali.** Verificato:
- `petlink-everywhere-cct-core/src/lambda_functions/` — nessun handler per `sendOtpForgotPassword` o `changeForgotPassword`.
- `petlink-everywhere-cct/src/store/api/` — nessuna API per reset password end-user.
- Il CCT ha solo `changePassword` e `updatePassword` per gli agenti CCT stessi (tramite Cognito Amplify).
- Lo schema GraphQL del CCT (`core_schema.graphql:886-888`) definisce `sendOtpForgotPassword` e `changeForgotPassword`, ma **non esistono handler che le implementano** nel CCT core.

**L'app web non ha UI per il forgot password.** Verificato: nessun componente `.tsx` in `petlink-everywhere-web/src/components/` usa `sendOtpForgotPassword` o `changeForgotPassword`. Le mutation GraphQL sono definite ma non utilizzate. Il forgot password è disponibile solo nell'app mobile.

Le possibili spiegazioni per la lamentela della utente sono:

1. **L'utente sta usando il vecchio sito/app Kippy.** Se l'utente va sul vecchio sito Kippy o usa la vecchia app, il sistema legacy invia un link di reset. Per un utente migrato, questo link non funziona perché il sistema legacy non gestisce più l'utente (il flag `migrated=1` in MySQL fa sì che la query `WHERE migrated = 0` non lo trovi).
2. **L'utente sta usando Cognito hosted UI.** Se l'utente prova ad accedere tramite la Cognito hosted UI (non l'app), Cognito ha un suo flusso "forgot password" che invia un codice di verifica via email. Questo non è un link, ma l'email di Cognito potrebbe contenere un link alla hosted UI.
3. **L'utente confonde l'OTP con un link.** L'email SendGrid con template `RESET_PASSWORD_OTP` contiene un codice a 5 cifre. Se l'utente non capisce che deve inserire il codice nell'app, potrebbe pensare che sia un link scaduto.
4. **Il team CS ha usato il vecchio sistema.** Il ticket dice "CS team also sent her a password reset link". Poiché il CCT non ha questa funzionalità, il CS potrebbe aver usato il vecchio pannello Kippy per inviare il link, che non funziona per gli utenti migrati.

### What actually happened for this user

The logs show that on Aug 6 at ~16:58 UTC, the OTP flow succeeded: an OTP was generated, and at ~16:59 UTC the password was successfully changed. The user's password reset **did work** at least once. The continued complaint on Aug 7 may be due to:

1. The user not realizing the reset succeeded.
2. The user trying again and hitting the `InvalidParameterException` (whitespace in password).
3. The CS team sending a legacy reset link that doesn't work for migrated users.

## Code files and functions involved

| File | Role |
|---|---|
| `petlink-everywhere-core/src/lambda_functions/graphql/mutation/changeForgotPassword/handler.ts:67-71` | Passes `event.arguments.password` to Cognito without trimming |
| `petlink-everywhere-core/src/lib/aws/cognito.ts:151-163` | `changeForgotPassword` — calls `AdminSetUserPassword` with untrimmed password |
| `petlink-everywhere-core/src/lambda_functions/graphql/mutation/sendOtpForgotPassword/handler.ts:71-165` | Sends OTP for migrated users (works correctly) |
| `petlink-everywhere-core/src/lib/notification/generalNotification.ts:114-179` | Sends reset password OTP email via SendGrid |
| `petlink-everywhere-core/cdk/stacks/common-stack.ts:376-382` | Cognito password policy (minLength: 6, requireLowercase, requireDigits) |
| `petlink-everywhere-mobile/lib/features/auth/presentation/view_model/auth_view_model.dart:874-878` | Mobile app calls `changeForgotPassword` with `newPasswordController.text` |

## Evidence and reasoning

1. **Confirmed:** The user is migrated and exists in MongoDB with `contactVerified.email: true`.
2. **Confirmed:** `sendOtpForgotPassword` successfully generated an OTP for this user on Aug 6 at 16:58 UTC.
3. **Confirmed:** `changeForgotPassword` succeeded for this user on Aug 6 at 16:59 UTC (OTP verified, `forceChangePassword` set to false).
4. **Confirmed:** Multiple `InvalidParameterException` errors exist in the `changeForgotPassword` Lambda across many users, caused by passwords with whitespace failing the Cognito regex `^[\S]+.*[\S]+$`.
5. **Reasonable inference:** The user's complaint about "expired link" and "page fails to load" likely refers to either the legacy reset flow (which sends a link) or a misunderstanding of the OTP email. The new system's OTP flow does not send links.
6. **Reasonable inference:** If the user tried again after the successful reset on Aug 6, she may have hit the `InvalidParameterException` by including whitespace in the new password, receiving a generic error with no clear guidance.

## Proposed fix

### Fix 1: Trim password in `changeForgotPassword` handler (primary)

In `petlink-everywhere-core/src/lambda_functions/graphql/mutation/changeForgotPassword/handler.ts`, trim the password before passing it to Cognito:

```typescript
await changeForgotPassword(
  getEnv('USER_POOL_ID'),
  userResponse.item.id,
  event.arguments.password.trim()
);
```

### Fix 2: Catch `InvalidParameterException` and return a clear error

In `petlink-everywhere-core/src/lib/aws/cognito.ts`, the `changeForgotPassword` function should catch `InvalidParameterException` and return a user-friendly error code instead of letting it propagate as an unhandled Lambda failure.

### Fix 3: Validate password client-side before submission

The mobile app should validate the password against the Cognito policy (min 6 chars, at least 1 lowercase, at least 1 digit, no leading/trailing whitespace) before calling `changeForgotPassword`, and show a clear error message to the user.

### Fix 4: Clarify to CS team that migrated users should use the OTP flow

The CS team should be informed that migrated users cannot use the legacy reset link flow. The CCT tool should use `sendOtpForgotPassword` (OTP) for migrated users, not the legacy `request_forgot_password_token.php`.

## Remaining uncertainty

- Whether the user's "expired link" complaint is specifically about the legacy system or a misunderstanding of the OTP email — cannot be confirmed without seeing the actual email the user received.
- Whether the user tried to reset again on Aug 7 and hit the whitespace bug — no logs found for this user on Aug 7 in `sendOtpForgotPassword` or `changeForgotPassword`.
- The exact content of the SendGrid `RESET_PASSWORD_OTP` email template — not available in this repository.
- Whether the CS team used the legacy system or the CCT tool to send the reset link — not documented in the Jira ticket.
