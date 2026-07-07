# Bug: Phone Number Normalization Mismatch Causes Duplicate Migrations

## Summary

Phone numbers are stored in MongoDB in E.164 format (e.g. `+33620704707`) by the migration service, but queried using the raw contact string from the mobile app (e.g. `+330620704707`). This mismatch causes the system to not find already-migrated users, triggering duplicate migration attempts that crash and roll back.

**Affected repos:**
- `petlink-everywhere-core` (checkMigration query, signUpUser mutation, updatePhoneNumberUser mutation, updateUserContact CCT mutation)
- `petlink-data-migration` (migrationOnDemand handler)
- `petlink-everywhere-mobile` (sends raw phone with trunk prefix)

**Severity:** High — causes duplicate migrations, user confusion, and potential data inconsistency.

---

## Background: E.164 and Trunk Prefix

### E.164 Standard

E.164 is the international telephone numbering plan defined by the ITU (International Telecommunication Union). Format: `+` + country code + national number (without trunk prefix).

Example: French number `06 20 70 47 07` → E.164: `+33620704707`

### Trunk Prefix

The "trunk prefix" is a digit (usually `0`) prepended when dialing **within** a country, but **dropped** when dialing from abroad. Most countries drop it in the international format. Italy is a notable exception that **keeps** the `0`.

| Country | Local format | International (E.164) | Trunk prefix |
|---|---|---|---|
| France | 06 20 70 47 07 | +33 6 20 70 47 07 | 0 → dropped |
| UK | 07911 123456 | +44 7911 123456 | 0 → dropped |
| Germany | 0151 12345678 | +49 151 12345678 | 0 → dropped |
| Spain | 612 345 678 | +34 612 345 678 | no trunk prefix |
| **Italy** | 06 1234 5678 | +39 06 1234 5678 | 0 → **kept** |

### libphonenumber-js

The library `libphonenumber-js` (already used in both repos) contains Google's phone number rules for every country. It knows which countries drop the trunk prefix and which don't.

```javascript
const parsed = parsePhoneNumber('+330620704707');
// parsed.number → "+33620704707"  (E.164, trunk prefix dropped for France)

const parsed = parsePhoneNumber('+390612345678');
// parsed.number → "+390612345678"  (E.164, trunk prefix kept for Italy)

const parsed = parsePhoneNumber('nathaliebolo@gmail.com');
// parsed → undefined  (not a phone number, it's an email)
```

The `.number` property always returns the E.164 canonical string. If the input is not a phone number, `parsePhoneNumber` returns `undefined`.

---

## The Bug

### How phone numbers are stored vs queried

There are two code paths that create users in MongoDB:

1. **Migration path** (`petlink-data-migration`): Legacy users from MySQL are migrated. The phone is assembled from two MySQL columns (`registrationPhoneCountry` + `registrationPhone`) which already store the national number **without** the trunk prefix. Result: `+33620704707` (E.164 compliant).

2. **App registration path** (`petlink-everywhere-core`): New users register via the mobile app. The app concatenates the selected country prefix (`+33`) with the user-typed national number (which **includes** the trunk prefix `0`). Result: `+330620704707` (NOT E.164 compliant for most countries).

Both paths store the phone in the same MongoDB collection (`petlinkEverywhere`), field `phone`, but in **different formats**.

### The query mismatch

When the app calls `checkMigration` or `startMigration`, it sends the raw contact string (e.g. `+330620704707`). The MongoDB queries use this raw string directly without normalization:

- `checkMigration` (Core): `{ phone: event.arguments.contact }` → searches for `+330620704707`
- `migrationOnDemand` (data-migration): `{ phone: contact }` → searches for `+330620704707`

But MongoDB has `+33620704707` (for migrated users). The strings don't match → the user is not found → the system thinks the user doesn't exist and triggers migration again.

### Concrete example: Nathalie Bolo

- **Email:** nathaliebolo@gmail.com
- **Legacy MySQL userId:** 204635
- **Phone (app input):** `+330620704707`
- **Phone (stored in MongoDB after migration):** `+33620704707`

**Run 1 (12:04:06 → 12:04:27):**
1. App sends `contact = "+330620704707"` to `checkMigration`
2. MongoDB query: `{ phone: "+330620704707" }` → not found (user doesn't exist yet)
3. MySQL query (with `migrated = 0`): finds user 204635
4. App shows "Let's start" dialog → user confirms → `startMigration` called
5. `migrationOnDemand` MongoDB query: `{ phone: "+330620704707" }` → not found → proceeds
6. `getMysqlUser` uses `parsePhoneNumber` to split into country=33, national=620704707 → finds MySQL user
7. `createUser` assembles phone from MySQL fields: `+33` + `620704707` = `+33620704707` → saves to MongoDB
8. Migration completes, `setUserMigrated(mysqlUser.id)` sets `migrated = 1` in MySQL

**Run 2 (12:04:47, 20 seconds after Run 1 completed):**
1. App sends `contact = "+330620704707"` to `checkMigration` again (user pressed login again)
2. MongoDB query: `{ phone: "+330620704707" }` → **not found** (MongoDB has `+33620704707`)
3. MySQL query (with `migrated = 0`): user has `migrated = 1` now → **not found**
4. `checkMigration` returns `errors.user_not_found`
5. But if `migrated` wasn't set yet (or app calls `startMigration` directly): `migrationOnDemand` MongoDB query also fails → creates a **second** user → `petsAndProductsMigration` crashes ("products already present") → rollback

### Why Italian users are not affected

Italy keeps the trunk prefix `0` in international format. So `+390612345678` parsed by `parsePhoneNumber` returns `+390612345678` — identical to the raw input. The mismatch only occurs for countries that **drop** the trunk prefix (France, UK, Germany, etc.).

---

## Architecture: Repos and Files Involved

### petlink-everywhere-core

This is the main backend API (AppSync + Lambdas). It handles GraphQL queries and mutations from the mobile app and web.

**`src/lambda_functions/graphql/query/checkMigration/handler.ts`**
- Called by the app on every login attempt.
- Checks if user exists in MongoDB by contact (email or phone).
- If not found in MongoDB, queries legacy MySQL for users with `migrated = 0`.
- Returns `success.user_exists` (login), `success.user_can_be_migrated` (show dialog), or `errors.user_not_found`.
- **BUG:** MongoDB query used raw `event.arguments.contact` without normalization.
- **FIX APPLIED:** Now uses `parsePhoneNumber(event.arguments.contact).number` before querying MongoDB. Also reuses the parsed result for the MySQL query below (was calling `parsePhoneNumber` twice).

**`src/lambda_functions/graphql/mutation/signUpUser/handler.ts`**
- New user registration from the app.
- Checks for duplicate contacts in MongoDB before creating.
- **BUG:** Duplicate check query uses raw `event.arguments.user.phone` without normalization.
- **FIX NEEDED:** Normalize phone before the duplicate check query.

**`src/lib/petlink/user.ts` → `createPetlinkUser()`**
- Creates the User document in MongoDB for new app registrations.
- Spreads `userProps` (from Zod validation) directly into the User object, including `phone`.
- **BUG:** Saves `userIn.phone` raw (as sent by the app, e.g. `+330620704707`).
- **FIX NEEDED:** Normalize `userIn.phone` before saving to MongoDB.

**`src/lambda_functions/graphql/mutation/updatePhoneNumberUser/handler.ts`**
- User updates their phone number.
- Saves `event.arguments.phone` directly to MongoDB.
- **BUG:** No normalization before saving.
- **FIX NEEDED:** Normalize phone before saving.

**`src/lambda_functions/graphql/cct/updateUserContact/handler.ts`**
- CCT (Customer Care Tool) agent updates a user's contact.
- For PHONE type: queries MongoDB with raw `contact` and saves raw `contact`.
- **BUG:** No normalization in query or save.
- **FIX NEEDED:** Normalize phone in both the duplicate check query and the save.

### petlink-data-migration

This is the migration service that migrates legacy users from MySQL to MongoDB.

**`src/lambda_functions/migrationOnDemand/handler.ts`**
- Main migration orchestrator. Called by `startMigration` (Core) via Lambda Invoke.
- Checks if user already exists in MongoDB (idempotency check).
- If not found, fetches legacy user from MySQL, creates new user in MongoDB, runs sub-migrations.
- **BUG:** MongoDB idempotency query used raw `contact` without normalization.
- **FIX APPLIED:** Now uses `parsePhoneNumber(contact).number` before querying MongoDB.

**`src/lambda_functions/migrationOnDemand/util.ts` → `createUser()`**
- Creates the User document in MongoDB for migrated users.
- Assembles phone from MySQL fields: `+${mysqlUser.registrationPhoneCountry}${mysqlUser.registrationPhone}`.
- MySQL stores `registrationPhone` without trunk prefix, so the result is accidentally E.164 compliant.
- **No fix needed here** — this is already producing correct E.164 output.

**`src/lambda_functions/migrationOnDemand/util.ts` → `getMysqlUser()`**
- Fetches legacy user from MySQL.
- Uses `parsePhoneNumber(contact)` to split the contact into `nationalNumber` and `countryCallingCode` for the two MySQL columns.
- **No fix needed** — already using `parsePhoneNumber` correctly for MySQL queries.

### petlink-everywhere-mobile

**`lib/features/auth/presentation/view_model/auth_view_model.dart`**
- On login button press, calls `fieldValidation()`.
- Constructs contact: `isPhoneNumber.value ? selectedPrefix.value + emailController.text : emailController.text`
- For phone: `selectedPrefix` is e.g. `+33`, `emailController.text` is what the user typed (e.g. `0620704707` with trunk prefix).
- Result: `+330620704707` (not E.164 for most countries).
- Calls `checkMigration` with this contact.
- If `success.user_can_be_migrated`, shows dialog, then calls `startMigration`.
- **No fix needed on mobile side** if the backend normalizes consistently. Alternatively, the app could normalize client-side, but backend normalization is more robust.

---

## Fix Plan

### Part 1: Query normalization (PARTIALLY DONE)

Normalize the contact string before any MongoDB query that searches by phone.

**Already applied:**

1. **`petlink-everywhere-core/src/lambda_functions/graphql/query/checkMigration/handler.ts`**
   ```typescript
   const phoneNumberParsed = parsePhoneNumber(event.arguments.contact);
   const normalizedContact = phoneNumberParsed
     ? phoneNumberParsed.number
     : event.arguments.contact;

   const query: any = {
     entityType: EntityTypeEnum.Enum.USER,
     deleted: { $ne: true },
     $or: [
       { email: normalizedContact },
       { phone: normalizedContact },
     ],
   };
   ```
   Also removed the duplicate `parsePhoneNumber` call that was used for the MySQL query below — now reuses `phoneNumberParsed`.

2. **`petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts`**
   ```typescript
   import parsePhoneNumber from 'libphonenumber-js';
   // ...
   const parsedPhone = parsePhoneNumber(contact);
   const normalizedContact = parsedPhone ? parsedPhone.number : contact;

   const findUserRes = await findItem<User>(
     mongoDbSecret,
     {
       entityType: EntityTypeEnum.Enum.USER,
       $or: [{ email: normalizedContact }, { phone: normalizedContact }],
       deleted: { $ne: true },
     },
     PETLINK_EVERYWHERE_COLLECTION_NAME
   );
   ```

**Still needed:**

3. **`petlink-everywhere-core/src/lambda_functions/graphql/mutation/signUpUser/handler.ts`** (line ~93)
   - Normalize `event.arguments.user.phone` before the duplicate check query.

4. **`petlink-everywhere-core/src/lambda_functions/graphql/cct/updateUserContact/handler.ts`** (line ~99)
   - Normalize `contact` before the duplicate check query (PHONE case).

5. **`petlink-everywhere-core/src/lib/petlink/user.ts` → `deletePetlinkUser()`** (line ~218)
   - Normalize `username` before querying by phone.

### Part 2: Save normalization (NOT YET DONE)

Normalize the phone before saving to MongoDB, so that all phone numbers are stored in E.164 format regardless of source.

**Needed:**

1. **`petlink-everywhere-core/src/lib/petlink/user.ts` → `createPetlinkUser()`** (line ~181)
   - Before constructing the `user` object, normalize `userIn.phone`:
   ```typescript
   const parsedPhone = parsePhoneNumber(userIn.phone);
   if (parsedPhone) {
     userIn.phone = parsedPhone.number;
   }
   ```
   - Also normalize the `phone_number` attribute sent to Cognito (line ~158).

2. **`petlink-everywhere-core/src/lambda_functions/graphql/mutation/updatePhoneNumberUser/handler.ts`** (line ~109)
   - Normalize `phoneNumber` before saving to MongoDB and Cognito:
   ```typescript
   const parsedPhone = parsePhoneNumber(phoneNumber);
   const normalizedPhone = parsedPhone ? parsedPhone.number : phoneNumber;
   ```
   - Use `normalizedPhone` in the `upsertItemById` call and the Cognito `updateUser` call.

3. **`petlink-everywhere-core/src/lambda_functions/graphql/cct/updateUserContact/handler.ts`** (line ~103)
   - Normalize `contact` before saving to MongoDB and Cognito (PHONE case).

### Part 3: Backfill existing MongoDB data (NOT YET DONE)

Users already registered via the app may have phone numbers stored with the trunk prefix (e.g. `+330620704707` instead of `+33620704707`). These need to be normalized in MongoDB and Cognito.

**MongoDB backfill script (Node.js, using `libphonenumber-js`):**

```javascript
// Run with: node backfill-phone-numbers.js
// Requires: mongodb, libphonenumber-js

const { MongoClient } = require('mongodb');
const parsePhoneNumber = require('libphonenumber-js');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  const collection = db.collection('petlinkEverywhere');

  const users = await collection.find({
    entityType: 'USER',
    deleted: { $ne: true },
    phone: { $exists: true, $ne: null }
  }).toArray();

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const parsed = parsePhoneNumber(user.phone);
    if (!parsed) {
      console.log(`SKIP (unparseable): ${user.phone} — ${user.email}`);
      skipped++;
      continue;
    }

    if (parsed.number === user.phone) {
      // Already normalized
      skipped++;
      continue;
    }

    console.log(`UPDATE: ${user.phone} → ${parsed.number} — ${user.email}`);

    // Uncomment to apply:
    // await collection.updateOne(
    //   { _id: user._id },
    //   { $set: { phone: parsed.number } }
    // );
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Total: ${users.length}`);
  await client.close();
}

main().catch(console.error);
```

**Cognito backfill:**

For each user whose phone was updated in MongoDB, the corresponding Cognito `phone_number` attribute should also be updated. This requires iterating over the updated users and calling `adminUpdateUserAttributes` with the normalized phone number.

```javascript
// Pseudo-code for Cognito backfill
const { CognitoIdentityServiceProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const cognito = new CognitoIdentityServiceProviderClient({ region: process.env.AWS_REGION });

for (const user of updatedUsers) {
  await cognito.send(new AdminUpdateUserAttributesCommand({
    UserPoolId: process.env.USER_POOL_ID,
    Username: user.id,  // Cognito username is the user's UUID
    UserAttributes: [
      { Name: 'phone_number', Value: user.normalizedPhone }
    ]
  }));
}
```

**Important:** Run the MongoDB backfill first (dry run to verify, then apply), then the Cognito backfill. Test on staging before production.

---

## Edge Cases and Considerations

### Italian phone numbers

Italy is an exception: the trunk prefix `0` is **kept** in international format. `parsePhoneNumber('+390612345678').number` returns `+390612345678` — no change. Italian users are not affected by this bug and the fix does not alter their phone numbers.

### Email contacts

`parsePhoneNumber('user@example.com')` returns `undefined`. The normalization code falls back to the raw contact string. Email-based queries and logins are unaffected.

### Invalid phone numbers

Some legacy users may have invalid or malformed phone numbers in MongoDB. `parsePhoneNumber` returns `undefined` for these, and the fallback to the raw string preserves the current behavior. The backfill script logs these for manual review.

### `forceSetPhoneNumber` flag

The migration code (`createUser` in `util.ts`) sets `forceSetPhoneNumber: true` when the legacy phone is not a valid mobile phone (`isMobilePhoneStrict` fails). This prompts the user to update their phone in the app. When they do, `updatePhoneNumberUser` is called — which is one of the handlers that needs the save normalization fix.

---

## Summary of Changes

| File | Repo | Type | Status |
|---|---|---|---|
| `checkMigration/handler.ts` | core | Query normalization | ✅ Done |
| `migrationOnDemand/handler.ts` | data-migration | Query normalization | ✅ Done |
| `signUpUser/handler.ts` | core | Query normalization | ❌ Needed |
| `updateUserContact/handler.ts` (CCT) | core | Query + Save normalization | ❌ Needed |
| `deletePetlinkUser` in `user.ts` | core | Query normalization | ❌ Needed |
| `createPetlinkUser` in `user.ts` | core | Save normalization | ❌ Needed |
| `updatePhoneNumberUser/handler.ts` | core | Save normalization | ❌ Needed |
| MongoDB backfill script | — | Data migration | ❌ Needed |
| Cognito backfill script | — | Data migration | ❌ Needed |
