# CORE API Coverage Report

## 📊 Summary
- **Total Operations:** 127
- **Covered:** 64
- **Missing:** 63

Total -> [FETCHED-core_schema.graphql](../src/clients/petlink-infrastructure/endpoints/graphql/schema/core_schema.graphql)  
Covered -> [GENERATED-core_schema.ts](../src/clients/petlink-infrastructure/endpoints/graphql/generated/core_schema.ts)

---

### Mutations (66 Total)

| Operation                     |  Status   | Notes |
|:------------------------------|:---------:|:------|
| `acknowledgeCheckout`         | ✅ Covered |       |
| `activateDeviceInOrder`        | ❌ Missing |       |
| `addGpsPromotion`              | ❌ Missing |       |
| `appKeepAlive`                 | ❌ Missing |       |
| `sendOtp`                     | ✅ Covered |       |
| `checkOtp`                    | ✅ Covered |       |
| `signUpUser`                  | ✅ Covered |       |
| `deleteUser`                  | ✅ Covered |       |
| `updateUser`                  | ✅ Covered |       |
| `updateEmailUser`             | ✅ Covered |       |
| `updatePhoneNumberUser`       | ✅ Covered |       |
| `forgotEmail`                 | ✅ Covered |       |
| `sendOtpForgotPassword`       | ✅ Covered |       |
| `changeForgotPassword`        | ✅ Covered |       |
| `changePassword`              | ✅ Covered |       |
| `sendTokenEmail`              | ❌ Missing |       |
| `verifyEmail`                 | ✅ Covered |       |
| `updateNotificationSettings`  | ❌ Missing |       |
| `deleteRegistrationToken`     | ❌ Missing |       |
| `setReadPopupMigratedUser`    | ❌ Missing |       |
| `startMigration`              | ❌ Missing |       |
| `createPet`                   | ✅ Covered |       |
| `updatePet`                   | ✅ Covered |       |
| `deletePet`                   | ✅ Covered |       |
| `createPetlinkQrTag`          | ❌ Missing |       |
| `createPetlinkMicrochip`      | ❌ Missing |       |
| `createPetlinkGps`            | ✅ Covered |       |
| `removeProduct`               | ❌ Missing |       |
| `updatePetlinkGps`            | ✅ Covered |       |
| `resetPetlinkGps`             | ✅ Covered |       |
| `replacement`                 | ✅ Covered |       |
| `setPetIsLost`                | ❌ Missing |       |
| `setOptimizationDone`         | ❌ Missing |       |
| `setDeviceOffline`            | ❌ Missing |       |
| `setSentinelMigrationDone`    | ❌ Missing |       |
| `setSafetyTermsCat`           | ❌ Missing |       |
| `setArcaPlanetTerms`          | ❌ Missing |       |
| `qrTagHasBeenScanned`         | ❌ Missing |       |
| `registerToNewsletter`        | ❌ Missing |       |
| `forceClearCache`             | ❌ Missing |       |
| `logDisabled`                 | ❌ Missing |       |
| `publishOnForceClearCache`    | ❌ Missing |       |
| `publishOnGpsMessagePosition` | ❌ Missing |       |
| `publishOnGpsMessageStatus`   | ❌ Missing |       |
| `publishOnSubscriptionStatus` | ❌ Missing |       |
| `pushGpsMessagePositionBLE`   | ❌ Missing |       |
| `sendMessageFoundPet`         | ❌ Missing |       |
| `setPetIsFound`               | ❌ Missing |       |
| `setMacAddress`               | ❌ Missing |       |
| `pushGpsMessagePositionBLE`   | ❌ Missing |       |
| `sendCommand`                 | ✅ Covered |       |
| `sendSetting`                 | ✅ Covered |       |
| `createGeofence`              | ✅ Covered |       |
| `updateGeofence`              | ✅ Covered |       |
| `deleteGeofence`              | ✅ Covered |       |
| `appKeepAlive`                | ❌ Missing |       |
| `updateUserContact`           | ❌ Missing |       |
| `forceClearCache`             | ❌ Missing |       |
| `setSsoToken`                 | ❌ Missing |       |
| `updateBillingInfo`           | ✅ Covered |       |
| `updatePaymentSources`        | ❌ Missing |       |
| `stopRenewingSubscription`    | ✅ Covered |       |
| `stopRenewingAddon`           | ❌ Missing |       |
| `refundInvoice`               | ❌ Missing |       |
| `activateDeviceInOrder`       | ❌ Missing |       |
| `addGpsPromotion`             | ❌ Missing |       |
| `acknowledgeCheckout`         | ✅ Covered |       |
| `sendCustomerSuggestions`     | ❌ Missing |       |
| `sendCustomerFeedback`        | ❌ Missing |       |
| `setMacAddress`               | ❌ Missing |       |
| `publishOnGpsMessagePosition` | ❌ Missing |       |
| `publishOnGpsMessageStatus`   | ❌ Missing |       |
| `publishOnSubscriptionStatus` | ❌ Missing |       |
| `publishOnForceClearCache`    | ❌ Missing |       |
| `updateEndOfLife`             | ✅ Covered |       |
| `sendCustomerFeedback`        | ❌ Missing |       |
| `registerToNewsletter`        | ❌ Missing |       |
| `logDisabled`                 | ❌ Missing |       |
| `updatePetProtectionData`     | ✅ Covered |       |
| `utilityIntegrationTest`      | ✅ Covered |       |

---

### Queries (57 Total)

| Operation                    |  Status   | Notes |
|:-----------------------------|:---------:|:------|
| `changeSubscriptionPlan`     | ❌ Missing |       |
| `checkContact`               | ✅ Covered |       |
| `checkGps`                   | ✅ Covered |       |
| `checkMicrochip`             | ❌ Missing |       |
| `checkMigration`             | ❌ Missing |       |
| `checkoutAddons`             | ❌ Missing |       |
| `checkoutCareProtection`     | ❌ Missing |       |
| `checkoutNewSubscription`    | ✅ Covered |       |
| `checkoutEOLNewDevice`       | ✅ Covered |       |
| `checkoutPrepaid`            | ❌ Missing |       |
| `churnDeflection`             | ❌ Missing |       |
| `getActiveSubscriptions`     | ❌ Missing |       |
| `getActivities`              | ❌ Missing |       |
| `getActivitiesAverage`       | ❌ Missing |       |
| `getActivitiesAverageCat`     | ❌ Missing |       |
| `getActivitiesByHour`        | ❌ Missing |       |
| `getActivitiesCat`           | ❌ Missing |       |
| `getBaseConfig`              | ❌ Missing |       |
| `getUser`                    | ✅ Covered |       |
| `getPet`                     | ✅ Covered |       |
| `getPetByQrTag`              | ❌ Missing |       |
| `getPets`                    | ✅ Covered |       |
| `getPetProtection`           | ✅ Covered |       |
| `getPetHistory`              | ❌ Missing |       |
| `getPetLostInfo`             | ❌ Missing |       |
| `getPetlinkMicrochip`        | ❌ Missing |       |
| `getPetlinkQrTag`            | ❌ Missing |       |
| `getPetlinkGps`              | ✅ Covered |       |
| `getProduct`                 | ❌ Missing |       |
| `getProducts`                | ❌ Missing |       |
| `getGpsPromotions`           | ❌ Missing |       |
| `getEndOfLifeStep`           | ✅ Covered |       |
| `getPlansEOL`                | ✅ Covered |       |
| `checkoutEOLNewDevice`       | ✅ Covered |       |
| `getSubscriptionPlans`       | ✅ Covered |       |
| `getProtectionPlans`         | ❌ Missing |       |
| `getSubscriptionPlanPricing` | ✅ Covered |       |
| `getPaymentSource`           | ❌ Missing |       |
| `getBillingInfo`             | ✅ Covered |       |
| `checkoutAddons`             | ❌ Missing |       |
| `checkoutNewSubscription`    | ✅ Covered |       |
| `churnDeflection`            | ❌ Missing |       |
| `checkoutCareProtection`     | ❌ Missing |       |
| `checkoutPrepaid`            | ❌ Missing |       |
| `changeSubscriptionPlan`     | ❌ Missing |       |
| `getSubscriptions`           | ✅ Covered |       |
| `getPurchasedServices`       | ❌ Missing |       |
| `getSubscriptionByProductId` | ✅ Covered |       |
| `getOrder`                   | ❌ Missing |       |
| `getPaymentSource`           | ❌ Missing |       |
| `getPetsAndProducts`         | ❌ Missing |       |
| `getNotificationsHistory`    | ❌ Missing |       |
| `getPositionsHistory`        | ❌ Missing |       |
| `getPositionsHistoryDates`   | ❌ Missing |       |
| `checkMicrochip`             | ❌ Missing |       |
| `checkGps`                   | ✅ Covered |       |
| `getDictionary`              | ❌ Missing |       |
| `getS3UploadUrl`             | ❌ Missing |       |
| `getLogUploadUrl`            | ❌ Missing |       |
| `checkContact`               | ✅ Covered |       |
| `checkMigration`             | ❌ Missing |       |
| `getCountryState`            | ❌ Missing |       |
| `getDictionary`              | ❌ Missing |       |
| `getBreed`                   | ✅ Covered |       |
| `getColors`                  | ✅ Covered |       |
| `getEnergySavingZone`        | ✅ Covered |       |
| `getEnergySavingZones`       | ✅ Covered |       |
| `getGeofences`               | ✅ Covered |       |
| `getActivities`              | ❌ Missing |       |
| `getActivitiesAverage`       | ❌ Missing |       |
| `getActivitiesByHour`        | ❌ Missing |       |
| `getActivitiesCat`           | ❌ Missing |       |
| `getActivitiesAverageCat`    | ❌ Missing |       |
| `getActiveSubscriptions`     | ❌ Missing |       |
| `getPosts`                   | ❌ Missing |       |
| `getBaseConfig`              | ❌ Missing |       |
| `getSsoToken`                | ❌ Missing |       |
| `getBaseConfig`              | ❌ Missing |       |

---

### Subscriptions (4 Total)

| Operation                    |  Status   | Notes |
|:-----------------------------|:---------:|:------|
| `onForceClearCache`          | ❌ Missing | WebSocket subscription |
| `onGpsMessagePosition`       | ✅ Covered | WebSocket subscription |
| `onGpsMessageStatus`         | ✅ Covered | WebSocket subscription |
| `onSendingOtp`               | ❌ Missing | WebSocket subscription |
| `onSubscriptionStatus`       | ✅ Covered | WebSocket subscription |

---
