# CORE API Coverage Report

## 📊 Summary
- **Total Operations:** 111
- **Covered:** 38
- **Missing:** 73

---

### Mutations (57 Total)

| Operation                     |  Status   | Notes |
|:------------------------------|:---------:|:------|
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
| `replacement`                 | ❌ Missing |       |
| `setPetIsLost`                | ❌ Missing |       |
| `setOptimizationDone`         | ❌ Missing |       |
| `setDeviceOffline`            | ❌ Missing |       |
| `setSentinelMigrationDone`    | ❌ Missing |       |
| `setSafetyTermsCat`           | ❌ Missing |       |
| `setArcaPlanetTerms`          | ❌ Missing |       |
| `qrTagHasBeenScanned`         | ❌ Missing |       |
| `sendMessageFoundPet`         | ❌ Missing |       |
| `setPetIsFound`               | ❌ Missing |       |
| `setMacAddress`               | ❌ Missing |       |
| `pushGpsMessagePositionBLE`   | ❌ Missing |       |
| `sendCommand`                 | ✅ Covered |       |
| `sendSetting`                 | ✅ Covered |       |
| `createGeofence`              | ✅ Covered |       |
| `updateGeofence`              | ❌ Missing |       |
| `deleteGeofence`              | ❌ Missing |       |
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
| `acknowledgeCheckout`         | ❌ Missing |       |
| `sendCustomerSuggestions`     | ❌ Missing |       |
| `publishOnGpsMessagePosition` | ❌ Missing |       |
| `publishOnGpsMessageStatus`   | ❌ Missing |       |
| `publishOnSubscriptionStatus` | ❌ Missing |       |
| `publishOnForceClearCache`    | ❌ Missing |       |
| `updateEndOfLife`             | ❌ Missing |       |
| `sendCustomerFeedback`        | ❌ Missing |       |
| `registerToNewsletter`        | ❌ Missing |       |
| `logDisabled`                 | ❌ Missing |       |
| `updatePetProtectionData`     | ✅ Covered |       |
| `utilityIntegrationTest`      | ✅ Covered |       |

---

### Queries (54 Total)

| Operation                    |  Status   | Notes |
|:-----------------------------|:---------:|:------|
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
| `getEndOfLifeStep`           | ❌ Missing |       |
| `getPlansEOL`                | ❌ Missing |       |
| `checkoutEOLNewDevice`       | ❌ Missing |       |
| `getSubscriptionPlans`       | ✅ Covered |       |
| `getProtectionPlans`         | ❌ Missing |       |
| `getSubscriptionPlanPricing` | ✅ Covered |       |
| `getPaymentSource`           | ❌ Missing |       |
| `getBillingInfo`             | ✅ Covered |       |
| `checkoutAddons`             | ❌ Missing |       |
| `checkoutNewSubscription`    | ❌ Missing |       |
| `churnDeflection`            | ❌ Missing |       |
| `checkoutCareProtection`     | ❌ Missing |       |
| `checkoutPrepaid`            | ❌ Missing |       |
| `changeSubscriptionPlan`     | ❌ Missing |       |
| `getSubscriptions`           | ✅ Covered |       |
| `getPurchasedServices`       | ❌ Missing |       |
| `getSubscriptionByProductId` | ✅ Covered |       |
| `getOrder`                   | ❌ Missing |       |
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
| `getBreed`                   | ✅ Covered |       |
| `getColors`                  | ✅ Covered |       |
| `getEnergySavingZone`        | ❌ Missing |       |
| `getEnergySavingZones`       | ❌ Missing |       |
| `getGeofences`               | ❌ Missing |       |
| `getActivities`              | ❌ Missing |       |
| `getActivitiesAverage`       | ❌ Missing |       |
| `getActivitiesByHour`        | ❌ Missing |       |
| `getActivitiesCat`           | ❌ Missing |       |
| `getActivitiesAverageCat`    | ❌ Missing |       |
| `getActiveSubscriptions`     | ❌ Missing |       |
| `getPosts`                   | ❌ Missing |       |
| `getSsoToken`                | ❌ Missing |       |
| `getBaseConfig`              | ❌ Missing |       |

---
