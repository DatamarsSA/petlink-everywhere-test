# Bug: `DataRaw response is null` during `petsAndProductsMigration`

**Primary Jira ticket:** PRTSUP-657

## Affected user

- `nadinebaue38@gmail.com` (KIPPY, `+33630682285`, legacy user id `146454`)

Also observed in other environments:
- `bettonimartina@yahoo.it` (PRTSUP-620, 619, PETLINK / DEVELOP)
- `p.mastrangelo_10400@yopmail.com` (PRTSUP-72, DEVELOP, now Cancelled)

## Trigger source

**User-initiated via app** (not bulk migration). The user opened the KIPPY app and entered legacy credentials, triggering the `startMigration` GraphQL mutation in Core, which invoked `migrationOnDemand` with `source: ON_DEMAND` (default). Confirmed by Loki logs: `DatamarsPetlinkEverywhereCoreProd-startMigration` received `{"arguments":{"contact":"nadinebaue38@gmail.com","password":"*********","appBrand":"KIPPY"},"identity":null}` at `22:06:13Z`. No `bulkMigration` or `bulkMigrationConsumer` logs were present in the same time window. Only 3 total `migrationOnDemand` invocations occurred between 21:00–23:00 UTC.

## Symptom

The `migrationOnDemand` Lambda finishes the user-creation step, invokes `petsAndProductsMigration`, and then returns:

```
User migration failed - pets and products migration error: 500 - DataRaw response is null
```

No `PETS_AND_PRODUCTS` migration log is emitted for the session, so the real sub-Lambda failure is hidden.

## Root cause (confirmed)

The **immediate cause** is a MySQL `Too many connections` error in the `petsAndProductsMigration` sub-Lambda. The **masking bug** in `callMigrationLambda` hides the real error behind a generic `DataRaw response is null` message.

### Evidence from Loki `dataRaw` log

At `2026-07-31T22:07:25.689Z`, `migrationOnDemand` logged the raw response from the sub-Lambda invocation:

```json
{"errorType":"Error","errorMessage":"Too many connections","trace":["Error: Too many connections","    at Object.createConnectionPromise [as createConnection] (file:///var/task/index.mjs:68383:35)","    at _MysqlSingleton.getKippySubscriptionsEuClient (file:///var/task/index.mjs:79318:82)","    at file:///var/task/index.mjs:82865:44","    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)"]}
```

This is a Lambda `FunctionError` response — the sub-Lambda threw during **module-level initialization** (top-level `await` at line 88 of `handler.ts`, before the `handler` function is entered). That's why `petsAndProductsMigration` has **no log lines** for this session: `setRequestContext` and all logging happen inside the handler, which was never reached.

At `2026-07-31T22:07:25.690Z`, `migrationOnDemand` logged the Zod parse error:
```json
{"issues":[{"code":"invalid_type","expected":"string","received":"undefined","path":["code"],"message":"Required"},{"code":"invalid_type","expected":"string","received":"undefined","path":["message"],"message":"Required"}],"name":"ZodError"}
```

The `MigrationLambdaInvokeResponse` schema expects `{code, message, idsSaved}` but the payload contains `{errorType, errorMessage, trace}` — a Lambda error envelope, not a migration response.

### Why the MySQL connection failed

The `petsAndProductsMigration` handler (`handler.ts:74-100`) creates **4 MySQL connections at module top-level** (outside the handler):
- `MysqlSingleton.getMysqlUsClient`
- `MysqlSingleton.getMysqlEuClient`
- `MysqlSingleton.getKippySubscriptionsEuClient` ← **this one failed**
- `MysqlSingleton.getKippySubscriptionsUsClient`

`MysqlSingleton` (`src/lib/mysql/client.ts`) uses single persistent connections (not pools). If the MySQL server's `max_connections` limit is reached — e.g. due to concurrent migration Lambdas or other workloads — `mysql.createConnection()` throws `Too many connections`.

### Masking bug in `callMigrationLambda`

In `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts:255-304`, the helper `callMigrationLambda` does the following:

```ts
const res = await lambdaClient.send(
  new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(invokeRequest),
  })
);
const blob: Uint8ArrayBlobAdapter = res.Payload!;
const dataRaw = blob.transformToString();

if (!dataRaw) {
  logger.error('Null response');
  return { code: '500', message: 'DataRaw response is null', idsSaved: null };
}

const toCheck = MigrationLambdaInvokeResponse.safeParse(JSON.parse(dataRaw));
if (!toCheck.success) {
  return { code: '500', message: 'DataRaw response is null', idsSaved: null };
}
```

Problems:

1. **The code does not inspect `res.FunctionError`.** If the invoked Lambda throws (timeout, out-of-memory, unhandled exception, etc.), the response payload still contains a JSON error object and `FunctionError` is set. Without checking `FunctionError`, the parse fails and the generic message is returned.
2. **The parse error is logged but not with the raw payload or `FunctionError` detail**, so operators cannot see the original exception.
3. **The message returned to the user is always `DataRaw response is null`**, which is not actionable.

## Evidence from Loki

### `migrationOnDemand` logs (session `d94e94de-28bf-462e-8718-8cbe37358685`)

| Timestamp (UTC) | Log line |
|---|---|
| 22:07:19.845 | `InvokeRequest: nadinebaue38@gmail.com, KIPPY` |
| 22:07:21.343 | `Returning user 146454` |
| 22:07:21.360 | `Lock acquired for legacyUserId 146454 (setUserMigrated)` |
| 22:07:21.401 | `result: {"_id":"6a6d1c99...","userId":"146454","migrationTarget":"USER","sessionId":"d94e94de-...","startedAt":"2026-07-31T22:07:21.360Z"}` |
| 22:07:25.689 | `dataRaw: {"errorType":"Error","errorMessage":"Too many connections","trace":[...]}` |
| 22:07:25.690 | `parse error: {"issues":[...ZodError...],"name":"ZodError"}` |
| 22:07:25.690 | `Rollback started for legacyUserId 146454, deleting 1 items by id: ["8c44dd18-a78d-4e4e-9879-4eab82b12c14"]` |
| 22:07:25.705 | `Rollback completed for legacyUserId 146454` |
| 22:07:25.705 | `send body: {..."feedback":"User migration failed - pets and products migration error: 500 - DataRaw response is null"...}` |

### `petsAndProductsMigration` logs

**No log lines** for session `d94e94de-28bf-462e-8718-8cbe37358685` or userId `146454`. The sub-Lambda crashed during module initialization (top-level MySQL connection), before the handler function was entered. Nearby session `f95f054c-d920-4595-8327-5432018b0f2c` (userId 185697) completed normally ~5 minutes later.

## Production code version inspected

- Branch: `prod`, commit `84c5a02` (v2.3.16, merged 2026-07-20)
- The code in `callMigrationLambda` at this commit matches the current `develop` branch — the `dataRaw` logging was already present but `res.FunctionError` is still not checked.

## Code references

- `petlink-data-migration/src/lambda_functions/migrationOnDemand/util.ts:255-304` (`callMigrationLambda`)
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/handler.ts:245-282` (call site and rollback)
- `petlink-data-migration/src/lambda_functions/migrationOnDemand/petsAndProductsMigration/handler.ts:120-` (sub-handler returns the expected schema)

## Fix options

1. **Improve error reporting in `callMigrationLambda`.**
   - Log `res.FunctionError` when present.
   - Log the raw `dataRaw` string before attempting `JSON.parse` / `safeParse`.
   - Return a message that includes the original Lambda error (truncated if necessary) instead of `DataRaw response is null`.

2. **Add a `FunctionError` branch.**
   ```ts
   if (res.FunctionError) {
     const errorPayload = JSON.parse(dataRaw);
     logger.error('Sub-Lambda function error', { functionName, errorPayload });
     return {
       code: '500',
       message: `Lambda invocation failed: ${errorPayload.errorType} - ${errorPayload.errorMessage}`,
       idsSaved: null,
     };
   }
   ```

3. **Add retry / circuit-breaker for transient invocation failures.**
   - If the sub-Lambda is throttled or the payload is empty due to a network blip, a small, idempotent retry could recover.

4. **Ensure the sub-Lambda emits logs on every invocation (or every failure)**, for example by moving `setRequestContext` and `logger.info('PETS AND PRODUCTS MIGRATION: START')` as early as possible and logging the incoming `event` before any secret/client initialization.

## MongoDB state

### Failed session (`d94e94de-28bf-462e-8718-8cbe37358685`, 2026-07-31)
- `migrationHistory` has only a `USER` record with `startedAt` but no `endedAt` — migration was rolled back.
- User document `8c44dd18-a78d-4e4e-9879-4eab82b12c14` was deleted by rollback.

### Successful re-migration (session `6f074163-b21c-4723-bbea-6ceb1b65f456`, 2026-08-02)
- User `3239abce-75e4-44b5-a993-fd30aeb9f96b` exists in `petlinkEverywhere` with `legacyId: "146454"`, `migrated: true`.
- `migrationHistory` shows all migration targets completed: USER, PETS_AND_PRODUCTS, ENERGY_SAVING_AREAS, GEOFENCES, SUBSCRIPTIONS, POSITION_HISTORY (3508 records), ACTIVITIES (429), PET_NOTIFICATIONS (8), RESETS_AND_REPLACEMENTS (1).
- User has `chargebeeId: "KPY-50081"`, 3 mobile device tokens (iOS), and a GPS replacement record.

## Impact

- The user `nadinebaue38@gmail.com` was **successfully migrated on 2026-08-02** ~10 hours after the initial failure.
- The initial failure was caused by a transient MySQL `Too many connections` error, not a data-dependent bug.
- The generic `DataRaw response is null` error message masked the real cause and made debugging harder.

## Recovery

1. ✅ The migration was re-run on 2026-08-02 and completed successfully.
2. The fix to `callMigrationLambda` (checking `res.FunctionError`) should still be applied to improve future debugging.
3. Consider moving MySQL connection initialization inside the handler with try/catch to emit logs on connection failures.
