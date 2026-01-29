# CCT API Coverage Report

## 📊 Summary
- **Total Operations:** 55
- **Covered:** 17
- **Missing:** 38

Total -> `petlink-everywhere-test/src/clients/petlink-infrastructure/endpoints/graphql/schema/cct_schema.graphql`   
Covered -> `petlink-everywhere-test/src/clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.ts`
---

## 📋 API Coverage Details

### Mutations (20 Total)

| Operation                    |  Status   | Notes |
|:-----------------------------|:---------:|:------|
| `createUser`                 | ✅ Covered |       |
| `deleteUser`                 | ✅ Covered |       |
| `updateUser`                 | ✅ Covered |       |
| `deleteCustomer`             | ✅ Covered |       |
| `updateCustomer`             | ✅ Covered |       |
| `updateRoleUser`             | ❌ Missing |       |
| `createSubscription`         | ❌ Missing |       |
| `refundInvoice`              | ❌ Missing |       |
| `updateCurrentTermEnd`       | ❌ Missing |       |
| `resetPetlinkGps`            | ❌ Missing |       |
| `addFreePeriod`              | ❌ Missing |       |
| `createIssue`                | ❌ Missing |       |
| `addTicketToIssue`           | ❌ Missing |       |
| `stopRenewingSubscription`   | ❌ Missing |       |
| `stopRenewingAddon`          | ❌ Missing |       |
| `renewInsuranceSubscription` | ❌ Missing |       |
| `hidePet`                    | ❌ Missing |       |
| `logEnabled`                 | ❌ Missing |       |
| `setPlanProfiles`            | ❌ Missing |       |
| `setCoupon`                  | ❌ Missing |       |

### Queries (35 Total)

| Operation                         |  Status   | Notes |
|:----------------------------------|:---------:|:------|
| `getUser`                         | ✅ Covered |       |
| `getUsers`                        | ✅ Covered |       |
| `getMyInfo`                       | ✅ Covered |       |
| `getLastConnections`              | ✅ Covered |       |
| `getDevices`                      | ✅ Covered |       |
| `getDevice`                       | ✅ Covered |       |
| `getConnectionsHistory`           | ✅ Covered |       |
| `getCustomers`                    | ✅ Covered |       |
| `getCustomer`                     | ✅ Covered |       |
| `getPet`                          | ✅ Covered |       |
| `getLogActivityUser`              | ✅ Covered |       |
| `getSubscriptions`                | ✅ Covered |       |
| `getDevicesMap`                   | ❌ Missing |       |
| `getInsuranceDevicesInfo`         | ❌ Missing |       |
| `getActivities`                   | ❌ Missing |       |
| `getBreed`                        | ❌ Missing |       |
| `getColors`                       | ❌ Missing |       |
| `getIssues`                       | ❌ Missing |       |
| `getPetProtections`               | ❌ Missing |       |
| `getPetProtection`                | ❌ Missing |       |
| `getSubscription`                 | ❌ Missing |       |
| `getSubscriptionsCancelled`       | ❌ Missing |       |
| `getSubscriptionsPrepaid`         | ❌ Missing |       |
| `getSubscriptionsPreregistration` | ❌ Missing |       |
| `getOrders`                       | ❌ Missing |       |
| `getOrder`                        | ❌ Missing |       |
| `getPlanProfiles`                 | ❌ Missing |       |
| `getCoupons`                      | ❌ Missing |       |
| `getDevicesWithCoupon`            | ❌ Missing |       |
| `getReplacementPetlinkGpsHistory` | ❌ Missing |       |
| `getDeviceProtectionReplacements` | ❌ Missing |       |
| `getShelterOrder`                 | ❌ Missing |       |
| `getShelterOrders`                | ❌ Missing |       |
| `getMigrationSessions`            | ❌ Missing |       |
| `getMigrationSession`             | ❌ Missing |       |
