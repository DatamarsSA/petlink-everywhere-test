# Wrong Firmware Group (`groupName`) Inherited from Legacy MySQL DeviceGroups (PRTSUP-617)

> **Status**: Unfixed — workaround documented
> **Severity**: Medium — 321 EVO devices offered a wrong/downgrade firmware; users see persistent update popup
> **Jira**: PRTSUP-617
> **Affected user**: `busetti.tiziana@gmail.com` (user `0113ca50-cd42-4073-a904-f9317dc00f96`, KIPPY EU)
> **Affected device**: `AJTMAZD` (product `fc85a488-3cbb-4080-a839-e2e98b58f9d2`)
> **Date discovered**: 2026-07-29

---

## Summary

`petlinkGpsInventory.groupName` is copied verbatim from the legacy MySQL table `DeviceGroups` during migration and during inventory updates. In some cases this value is wrong: the device actually runs firmware `9.x` (evo7 branch) but the legacy DB labels it `evo6prod`, so the backend offers the evo6 firmware (`7.1.20`) and the app keeps asking the user to update.

For `AJTMAZD` the inventory shows:

| Field | Value |
|---|---|
| `serialNumber` | `AJTMAZD` |
| `groupName` | `evo6prod` (wrong) |
| `firmwareVersion` | `9.1.19` (evo7 branch) |
| `model` | `EVO` |
| `brand` | `KIPPY` |

Consequently `petlinkEverywhere.newFirmwareVersion` for the product is:

```json
{
  "newFirmwareVersion": {
    "url": ".../firmware/evo6prod/Kippy_Update_7.3.20.zip?...",
    "version": "7.1.20"
  }
}
```

which does not match the installed `9.1.19`, triggering the firmware update popup.

---

## Root Cause

### 1. `groupName` comes from MySQL, not from the device itself

`all-repo/petlink-data-migration/src/lib/util/inventoryUpdater.ts` (used both by migration and by `checkGps` inventory refresh) joins `DeviceGroups` and copies `DeviceGroups.groupName` into `petlinkGpsInventory.groupName`:

```typescript
// inventoryUpdater.ts lines 44-74 and 197-229
SELECT
  ...,
  DeviceGroups.groupName,
  ...
FROM kippy_device_live
  ...
  LEFT JOIN DeviceGroups
    ON kippy_device_live.serial_number = DeviceGroups.deviceId
  ...
```

The code never cross-checks this value against `kippy_device_live.firmware` or `plant_hw_types.hw_description`.

### 2. The firmware-lookup logic trusts `groupName`

`all-repo/petlink-everywhere-core/src/lib/petlink/petlinkGps.ts`:

```typescript
export async function getPetlinkGpsFirmwareVersione(
  serialNumber: string,
  groupName: string,
  model: string
): Promise<NewFirmwareVersion | null> {
  ...
  const firmware = firmwareParameter.filter(
    (firmwareParameter) =>
      firmwareParameter.groupName == groupName &&
      firmwareParameter.model == model
  )[0];
  ...
}
```

`all-repo/petlink-everywhere-core/src/lambda_functions/event/checkFirmwareUpdate/handler.ts` does the same lookup for every device every 5 minutes and writes the resulting version to `petlinkEverywhere.newFirmwareVersion`.

### 3. `firmwareRule.json` maps the two branches

`all-repo/petlink-everywhere-dictionary/firmware/firmwareRule.json`:

```json
{
  "groupName": "evo7prod",
  "model": "EVO",
  "brand": "KIPPY",
  "version": "9.1.20",
  "path": "evo7prod/Kippy_Update_9.3.20.zip"
},
{
  "groupName": "evo6prod",
  "model": "EVO",
  "brand": "KIPPY",
  "version": "7.1.20",
  "path": "evo6prod/Kippy_Update_7.3.20.zip"
}
```

So `evo6prod` → `7.1.20` and `evo7prod` → `9.1.20`. When `groupName` is wrong, the device is offered the wrong firmware package.

---

## Evidence

### MongoDB — product `AJTMAZD`

```json
// petlinkEverywhere (entityType PETLINK_GPS, id fc85a488-...)
{
  "serialNumber": "AJTMAZD",
  "newFirmwareVersion": {
    "url": ".../firmware/evo6prod/Kippy_Update_7.3.20.zip?...",
    "version": "7.1.20"
  },
  "lastKnownStatus": {
    "firmwareVersion": "9.1.19"
  }
}
```

### MongoDB — inventory `AJTMAZD`

```json
// petlinkGpsInventory (serialNumber AJTMAZD)
{
  "serialNumber": "AJTMAZD",
  "groupName": "evo6prod",
  "firmwareVersion": "9.1.19",
  "model": "EVO",
  "brand": "KIPPY",
  "hwDescription": "Kippy EVO Rev.6.2 NewPlastic clips"
}
```

### Affected device count

As of 2026-07-29:

- **321** KIPPY EVO devices have `firmwareVersion` `9.*` but `groupName` **not** `evo7prod`:
  - 320 are `evo6prod`
  - 1 is `rev6`
- **0** KIPPY EVO devices have `firmwareVersion` `7.*` but `groupName` **not** `evo6prod`.

### Loki — replacement log

`DatamarsPetlinkEverywhereCoreProd-replacement` on 2026-07-24 shows the replacement process already used the wrong group:

```
check newFirmwareVersion: serialNumber: AJTMAZD, groupName: evo6prod, model: EVO
Setting Firmware: {"groupName":"evo6prod","model":"EVO","brand":"KIPPY","version":"7.1.20",...} for serialNumber: AJTMAZD
```

This confirms the issue predates the replacement and comes from `petlinkGpsInventory`.

---

## Workaround / Immediate Fix

### Step 1 — Count affected devices (read-only)

```js
// KIPPY EVO devices with firmware 9.* but not in evo7prod
// Expected: 321 (2026-07-29)
db.petlinkGpsInventory.countDocuments({
  brand: "KIPPY",
  model: "EVO",
  firmwareVersion: /^9\./,
  groupName: { $ne: "evo7prod" }
});

// KIPPY EVO devices with firmware 7.* but not in evo6prod
// Expected: 0
db.petlinkGpsInventory.countDocuments({
  brand: "KIPPY",
  model: "EVO",
  firmwareVersion: /^7\./,
  groupName: { $ne: "evo6prod" }
});

// Distribution of wrong groups for 9.*
db.petlinkGpsInventory.aggregate([
  {
    $match: {
      brand: "KIPPY",
      model: "EVO",
      firmwareVersion: /^9\./,
      groupName: { $ne: "evo7prod" }
    }
  },
  { $group: { _id: "$groupName", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

### Step 2 — Fix `groupName` in inventory

```js
// 9.* -> evo7prod
db.petlinkGpsInventory.updateMany(
  {
    brand: "KIPPY",
    model: "EVO",
    firmwareVersion: /^9\./,
    groupName: { $ne: "evo7prod" }
  },
  { $set: { groupName: "evo7prod" } }
);

// 7.* -> evo6prod (defensive, currently 0 matches)
db.petlinkGpsInventory.updateMany(
  {
    brand: "KIPPY",
    model: "EVO",
    firmwareVersion: /^7\./,
    groupName: { $ne: "evo6prod" }
  },
  { $set: { groupName: "evo6prod" } }
);
```

### Step 3 — Wait for `newFirmwareVersion` to refresh

`all-repo/petlink-everywhere-core/cdk/stacks/common-stack.ts` configures the `checkFirmwareUpdate` event rule to run every **5 minutes**:

```typescript
const checkFirmwareUpdateLambdaRule = new Rule(
  this,
  `${Config.prefix}-checkFirmwareUpdateRule`,
  {
    schedule: Schedule.expression('rate(5 minutes)'),
  }
);
```

The Lambda matches `petlinkGpsInventory.groupName` → `firmwareRule.json` → `petlinkEverywhere.newFirmwareVersion`. Therefore, within 5 minutes of fixing `groupName`, the product document for `AJTMAZD` (and the other 320 devices) will be updated to the correct evo7 firmware (`9.1.20`).

To force an immediate refresh, manually invoke the `checkFirmwareUpdate` Lambda from the AWS Console or CLI instead of waiting.

---

## Structural Fix (to prevent re-migrations from having the same issue)

### Where to add the check

Do **not** add it in `checkMigration` or in the `migrationOnDemand` orchestrator. Those paths only decide whether a user can migrate; they do not build the device record.

The right place is the **inventory creation/update step**, because every migrated `PETLINK_GPS` is created from a `GpsInventory` document:

- `all-repo/petlink-data-migration/src/lib/util/inventoryUpdater.ts` — shared function `updateInventory` called by `petsAndProductsMigration/handler.ts` and by the legacy queue receiver.
- `all-repo/petlink-data-migration/src/lambda_functions/migrationOnDemand/petsAndProductsMigration/handler.ts` — calls `updateInventory` and then passes `inventoryItem` to `convertMysqlProduct`.

Fixing `groupName` inside `inventoryUpdater.ts` fixes both migration and any future inventory refresh.

### Implementation

Add a guard that derives the expected `groupName` from the actual firmware version for the models where the mapping is unambiguous. For EVO KIPPY:

- `9.*` → `evo7prod`
- `7.*` or `6.*` → `evo6prod`

Then, before writing the `GpsInventory` document, if the MySQL `DeviceGroups.groupName` does not match the expected one, override it and log a warning.

```typescript
// all-repo/petlink-data-migration/src/lib/util/inventoryUpdater.ts

function deriveExpectedGroupName(
  firmwareVersion: string | null | undefined,
  model: string,
  brand: string
): string | undefined {
  if (!firmwareVersion || model !== ModelNameEnum.Enum.EVO || brand !== 'KIPPY') {
    return undefined;
  }
  const major = firmwareVersion.split('.')[0];
  if (major === '9') return 'evo7prod';
  if (major === '7' || major === '6') return 'evo6prod';
  return undefined;
}

// inside updateInventory, after building ingestionItem:
const expectedGroupName = deriveExpectedGroupName(
  ingestionItem.firmwareVersion,
  ingestionItem.model,
  ingestionItem.brand
);

if (expectedGroupName && ingestionItem.groupName !== expectedGroupName) {
  logger.warn(
    `groupName mismatch for ${ingestionItem.serialNumber}: ` +
      `MySQL DeviceGroups says ${ingestionItem.groupName}, ` +
      `firmware ${ingestionItem.firmwareVersion} expects ${expectedGroupName}. ` +
      `Overriding.`
  );
  ingestionItem.groupName = expectedGroupName;
}
```

### Extra defense for product creation

`convertMysqlProduct` in `productUtil.ts` receives the corrected `inventoryItem`, so it will produce the right `newFirmwareVersion`. As an extra safety net, you can also validate right before calling `getPetlinkGpsFirmwareVersion` from `product.firmware` and `inventoryItem.groupName`, and override `inventoryItem.groupName` if they disagree. This covers any future caller that bypasses `updateInventory`.

### Why not a generic firmware-rule-based check

`firmwareRule.json` maps `groupName` → latest available `version`, not installed version → group. For EVO the major version is enough. For DOG/CAT, multiple groups share the same major version (e.g., DOG 10.x has `dog6v2_EU`, `DogSocketTest`, etc.), so deriving the group from the installed version alone is not safe without extra hardware/SKU data.

---

## Affected files

- `all-repo/petlink-data-migration/src/lib/util/inventoryUpdater.ts` — reads `DeviceGroups.groupName`
- `all-repo/petlink-everywhere-core/src/lib/petlink/petlinkGps.ts` — `getPetlinkGpsFirmwareVersione`
- `all-repo/petlink-everywhere-core/src/lambda_functions/event/checkFirmwareUpdate/handler.ts` — scheduled updater
- `all-repo/petlink-everywhere-dictionary/firmware/firmwareRule.json` — group → firmware mapping
- `all-repo/petlink-everywhere-core/cdk/stacks/common-stack.ts` — `rate(5 minutes)` schedule
