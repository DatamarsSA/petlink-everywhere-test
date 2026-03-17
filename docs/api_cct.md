# CCT API Coverage Report

## 📊 Summary
- **Total Operations:** 54
- **Covered:** 17
- **Missing:** 37

Total -> [FETCHED-cct_schema.graphql](../src/clients/petlink-infrastructure/endpoints/graphql/schema/cct_schema.graphql)   
Covered -> [GENERATED-cct_schema.ts](../src/clients/petlink-infrastructure/endpoints/graphql/generated/cct_schema.ts)
---

## 📋 API Coverage Details

### Mutations (19 Total)

| Operation                    |  Status   | Notes |
|:-----------------------------|:---------:|:------|
| `createUser`                 | ✅ Covered |       |
| `deleteUser`                 | ✅ Covered |       |
| `updateUser`                 | ✅ Covered |       |
| `deleteCustomer`             | ✅ Covered |       |
| `updateCustomer`             | ✅ Covered |       |
| `createSubscription`         | ❌ Missing |       |
| `refundInvoice`              | ❌ Missing |       |
| `updateCurrentTermEnd`       | ❌ Missing |       |
| `resetPetlinkGps`            | ❌ Missing |       |
| `addFreePeriod`              | ❌ Missing |       |
| `createIssue`                | ❌ Missing |       |
| `addTicketToIssue`           | ❌ Missing |       |
| `hidePet`                    | ❌ Missing |       |
| `logEnabled`                 | ❌ Missing |       |
| `setCoupon`                  | ❌ Missing |       |
| `stopRenewingSubscription`   | ❌ Missing |       |
| `stopRenewingAddon`          | ❌ Missing |       |
| `renewInsuranceSubscription` | ❌ Missing |       |
| `setPlanProfiles`            | ❌ Missing |       |

### Queries (35 Total)

| Operation                         |  Status   | Notes |
|:----------------------------------|:---------:|:------|
| `getUser`                         | ✅ Covered |       |
| `getUsers`                        | ✅ Covered |       |
| `getBreed`                        | ❌ Missing |       |
| `getColors`                       | ❌ Missing |       |
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
| `getDevicesWithCoupon`            | ❌ Missing |       |
| `getInsuranceDevicesInfo`         | ❌ Missing |       |
| `getIssues`                       | ❌ Missing |       |
| `getActivities`                   | ❌ Missing |       |
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
| `getDeviceProtectionReplacements` | ❌ Missing |       |
| `getMigrationSession`             | ❌ Missing |       |
| `getMigrationSessions`            | ❌ Missing |       |
| `getReplacementPetlinkGpsHistory` | ❌ Missing |       |
| `getShelterOrder`                 | ❌ Missing |       |
| `getShelterOrders`                | ❌ Missing |       |

---

### Subscriptions (0 Total)

CCT API currently has no WebSocket subscriptions.

---
