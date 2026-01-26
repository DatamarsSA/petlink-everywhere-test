# Petlink Core API Coverage Report

## 📊 Summary
- **Total Operations:** 115
- **Covered:** 38
- **Missing:** 77
- **Coverage Rate:** ~33%

---

## 📋 API Coverage Details

| Type     | Operation                   |  Status   |
|:---------|:----------------------------|:---------:|
| Mutation | sendOtp                     | ✅ Covered |
| Mutation | checkOtp                    | ✅ Covered |
| Mutation | signUpUser                  | ✅ Covered |
| Mutation | deleteUser                  | ✅ Covered |
| Mutation | updateUser                  | ✅ Covered |
| Mutation | updateEmailUser             | ✅ Covered |
| Mutation | updatePhoneNumberUser       | ✅ Covered |
| Mutation | forgotEmail                 | ✅ Covered |
| Mutation | sendOtpForgotPassword       | ✅ Covered |
| Mutation | changeForgotPassword        | ✅ Covered |
| Mutation | changePassword              | ✅ Covered |
| Mutation | sendTokenEmail              | ❌ Missing |
| Mutation | verifyEmail                 | ✅ Covered |
| Mutation | updateNotificationSettings  | ❌ Missing |
| Mutation | deleteRegistrationToken     | ❌ Missing |
| Mutation | setReadPopupMigratedUser    | ❌ Missing |
| Mutation | startMigration              | ❌ Missing |
| Mutation | createPet                   | ✅ Covered |
| Mutation | updatePet                   | ✅ Covered |
| Mutation | deletePet                   | ✅ Covered |
| Mutation | createPetlinkQrTag          | ❌ Missing |
| Mutation | createPetlinkMicrochip      | ❌ Missing |
| Mutation | createPetlinkGps            | ✅ Covered |
| Mutation | removeProduct               | ❌ Missing |
| Mutation | updatePetlinkGps            | ✅ Covered |
| Mutation | resetPetlinkGps             | ✅ Covered |
| Mutation | replacement                 | ❌ Missing |
| Mutation | setPetIsLost                | ❌ Missing |
| Mutation | setOptimizationDone         | ❌ Missing |
| Mutation | setDeviceOffline            | ❌ Missing |
| Mutation | setSentinelMigrationDone    | ❌ Missing |
| Mutation | setSafetyTermsCat           | ❌ Missing |
| Mutation | setArcaPlanetTerms          | ❌ Missing |
| Mutation | qrTagHasBeenScanned         | ❌ Missing |
| Mutation | sendMessageFoundPet         | ❌ Missing |
| Mutation | setPetIsFound               | ❌ Missing |
| Mutation | setMacAddress               | ❌ Missing |
| Mutation | pushGpsMessagePositionBLE   | ❌ Missing |
| Mutation | sendCommand                 | ✅ Covered |
| Mutation | sendSetting                 | ✅ Covered |
| Mutation | createEnergySavingZone      | ❌ Missing |
| Mutation | updateEnergySavingZone      | ❌ Missing |
| Mutation | deleteEnergySavingZone      | ❌ Missing |
| Mutation | isActiveEnergySavingZone    | ❌ Missing |
| Mutation | createGeofence              | ✅ Covered |
| Mutation | updateGeofence              | ❌ Missing |
| Mutation | deleteGeofence              | ❌ Missing |
| Mutation | appKeepAlive                | ❌ Missing |
| Mutation | updateUserContact           | ❌ Missing |
| Mutation | forceClearCache             | ❌ Missing |
| Mutation | setSsoToken                 | ❌ Missing |
| Mutation | updateBillingInfo           | ✅ Covered |
| Mutation | updatePaymentSources        | ❌ Missing |
| Mutation | stopRenewingSubscription    | ✅ Covered |
| Mutation | stopRenewingAddon           | ❌ Missing |
| Mutation | refundInvoice               | ❌ Missing |
| Mutation | activateDeviceInOrder       | ❌ Missing |
| Mutation | addGpsPromotion             | ❌ Missing |
| Mutation | acknowledgeCheckout         | ❌ Missing |
| Mutation | sendCustomerSuggestions     | ❌ Missing |
| Mutation | publishOnGpsMessagePosition | ❌ Missing |
| Mutation | publishOnGpsMessageStatus   | ❌ Missing |
| Mutation | publishOnSubscriptionStatus | ❌ Missing |
| Mutation | publishOnForceClearCache    | ❌ Missing |
| Mutation | updateEndOfLife             | ❌ Missing |
| Mutation | sendCustomerFeedback        | ❌ Missing |
| Mutation | registerToNewsletter        | ❌ Missing |
| Mutation | logDisabled                 | ❌ Missing |
| Mutation | updatePetProtectionData     | ✅ Covered |
| Mutation | utilityIntegrationTest      | ✅ Covered |
| Query    | getUser                     | ✅ Covered |
| Query    | getPet                      | ✅ Covered |
| Query    | getPetByQrTag               | ❌ Missing |
| Query    | getPets                     | ✅ Covered |
| Query    | getPetProtection            | ✅ Covered |
| Query    | getPetHistory               | ❌ Missing |
| Query    | getPetLostInfo              | ❌ Missing |
| Query    | getPetlinkMicrochip         | ❌ Missing |
| Query    | getPetlinkQrTag             | ❌ Missing |
| Query    | getPetlinkGps               | ✅ Covered |
| Query    | getProduct                  | ❌ Missing |
| Query    | getProducts                 | ❌ Missing |
| Query    | getGpsPromotions            | ❌ Missing |
| Query    | getEndOfLifeStep            | ❌ Missing |
| Query    | getPlansEOL                 | ❌ Missing |
| Query    | checkoutEOLNewDevice        | ❌ Missing |
| Query    | getSubscriptionPlans        | ✅ Covered |
| Query    | getProtectionPlans          | ❌ Missing |
| Query    | getSubscriptionPlanPricing  | ✅ Covered |
| Query    | getPaymentSource            | ❌ Missing |
| Query    | getBillingInfo              | ✅ Covered |
| Query    | checkoutAddons              | ❌ Missing |
| Query    | checkoutNewSubscription     | ❌ Missing |
| Query    | churnDeflection             | ❌ Missing |
| Query    | checkoutCareProtection      | ❌ Missing |
| Query    | checkoutPrepaid             | ❌ Missing |
| Query    | changeSubscriptionPlan      | ❌ Missing |
| Query    | getSubscriptions            | ✅ Covered |
| Query    | getPurchasedServices        | ❌ Missing |
| Query    | getSubscriptionByProductId  | ✅ Covered |
| Query    | getOrder                    | ❌ Missing |
| Query    | getPetsAndProducts          | ❌ Missing |
| Query    | getNotificationsHistory     | ❌ Missing |
| Query    | getPositionsHistory         | ❌ Missing |
| Query    | getPositionsHistoryDates    | ❌ Missing |
| Query    | checkMicrochip              | ❌ Missing |
| Query    | checkGps                    | ✅ Covered |
| Query    | getDictionary               | ❌ Missing |
| Query    | getS3UploadUrl              | ❌ Missing |
| Query    | getLogUploadUrl             | ❌ Missing |
| Query    | checkContact                | ✅ Covered |
| Query    | checkMigration              | ❌ Missing |
| Query    | getCountryState             | ❌ Missing |
| Query    | getBreed                    | ✅ Covered |
| Query    | getColors                   | ✅ Covered |
| Query    | getEnergySavingZone         | ❌ Missing |
| Query    | getEnergySavingZones        | ❌ Missing |
| Query    | getGeofences                | ❌ Missing |
| Query    | getActivities               | ❌ Missing |
| Query    | getActivitiesAverage        | ❌ Missing |
| Query    | getActivitiesByHour         | ❌ Missing |
| Query    | getActivitiesCat            | ❌ Missing |
| Query    | getActivitiesAverageCat     | ❌ Missing |
| Query    | getActiveSubscriptions      | ❌ Missing |
| Query    | getPosts                    | ❌ Missing |
| Query    | getSsoToken                 | ❌ Missing |
| Query    | getBaseConfig               | ❌ Missing |



per ora no tutto ciò ceh riguarda:
- microchip
- qrtag



sicuro SI:
-sendTokenEmail