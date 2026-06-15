# Test Coverage – pragmatic use-case list

One line per test: what you do → what should happen.

## Flows

- [User](#user)
- [Pet](#pet)
- [Petlink GPS](#petlink-gps)
- [CCT Tool](#cct-tool)
- [Commands (Torch - Sound)](#commands)
- [Track Mode - Geofence](#geofence)
- [Track Mode - Live Tracking](#live-tracking)
- [Track Mode - Energy Saving Zone](#energy-saving-zone)
- [Subscriptions](#subscriptions)
- [End of Life](#end-of-life)



---

<a id="user"></a>
<details>
<summary><b>User</b></summary>

### Registration
- **Verify Phone & Email availability** → `checkContact` returns 200 for both before signup.
- **Send OTP to phone** → `sendOtp` returns a verificationId.
- **Wait to receive OTP via SMS** → Twilio client fetches an OTP matching `^\d{4,6}$`.
- **Verify phone number** → `checkOtp` returns 200 with the received OTP.
- **Register User** → `signUpUser` returns 200.
- **Try login new user (with PHONE)** → login with phone works; `getUser` shows phone verified, email not yet verified.
- **Wait to receive confirmation email** → MailTM client gets a link containing uuid, otp and verificationId.
- **Verify Email** → `verifyEmail` returns 200.
- **Try login new user (with EMAIL)** → login with email works; `getUser` shows both contacts verified.
- **Verify user created has all values equal to input payload** → `getUser` matches signup payload plus generated id/creationDate/updateDate.
- **Verify contacts are no longer available** → `checkContact` returns 400 for phone and email after registration.
- **Delete User** → `deleteUser` fails while a pet is associated; succeeds after pet is deleted.

### Profile Management
- **Change profile info (all fields)** → `updateUser` returns 200; `getUser` reflects name, surname, city, country, zip, street, language.
- **Change timezone** → `updateUser` with timezone returns 200; `getUser` shows the new timezone and preserves other fields.
- **Change email** → `updateEmailUser` returns 200; login with old email fails; verification link arrives; login with new email works.
- **Change phone number** → OTP flow + `updatePhoneNumberUser` returns 200; login with new phone works.
- **Change password** → `changePassword` returns 200; old password login throws; new password login works.

### Recovery
- **Reset password (forgot) → OTP flow** → `sendOtpForgotPassword` returns 200; OTP received; `changeForgotPassword` returns 200; new password login works.

</details>

---

<a id="pet"></a>
<details>
<summary><b>Pet</b></summary>

- **Create DOG and CAT for the user** → `createPet` returns 200, fields match payload, auto-generated id present.
- **Create PETs with wrong combinations data** → PUREBREED with 2 breeds, MIXED_BREED with 1 breed, MIXED_BREED with 2 equal breeds, CAT with DOG breed, DOG with CAT breed all return 400.
- **Update PET** → `updatePet` changes name/weight, id stays the same, persisted in DB.
- **Delete PET** → `deletePet` returns 200, pet no longer appears in `getPets`.
- **Pet should not be removable if he has device associated** → `deletePet` fails with a non-200 code when a `PetlinkGPS` is linked.

</details>

---

<a id="petlink-gps"></a>
<details>
<summary><b>Petlink GPS</b></summary>

### Registration
- **Verify device is available before registration** → `checkGps` returns 200 with imei, idccd and firmwareVersion for both DOG and CAT devices.
- **Associate PetlinkGPS to both DOG and CAT** → `createPetlinkGps` returns 200, payload matches (serial, petId, country, timezone, userId) and id is generated.
- **Should not allow to register old devices (Kippy only)** → `createPetlinkGps` fails for VITA, FINDER and EVO6 serials.
- **Associate EVO device to DOG (Kippy only)** → `createPetlinkGps` succeeds for EVO serial and fields match payload.
- **PetlinkGPS should not be available anymore** → re-registering an already-bound DOG or CAT device returns non-200.
- **Update PetlinkGps** → `updatePetlinkGps` changes timezone, `getPetlinkGps` reflects the new value.

### Reset
- **Reset should be blocked with active subscription** → CCT `resetPetlinkGps` returns 422; device still exists in Core.
- **Reset should succeed without active subscription** → CCT `resetPetlinkGps` returns 200; `getDevice` shows deviceId/customerId/petId/registrationDate all null.

### Replacement
- **User buys another device and replaces old** → `replacement` returns 200; CCT replacement history tracks old→new serial; `getPetlinkGps` shows the updated serial.
- **User opens CCT replacement ticket then replaces from app** → CCT `createIssue` with action Replacement creates a pending record without newSerialNumber; app `replacement` fills it; `getPetlinkGps` reflects the new serial.

### Settings
- **Update frequency setting → device receives packet 0x01 and DB is updated** → `sendSetting` (UPDATE_FREQUENCY) returns 200; `getPetlinkGps` shows `updateFrequency` and `enableGpsOnDefault` persisted.

</details>

---

<a id="cct-tool"></a>
<details>
<summary><b>CCT Tool</b></summary>

### Customers
- **Find a Customer in the list** → `getCustomers` filtered by email returns the user.
- **View Customer details** → `getCustomer` matches id, email, name, surname, appBrand, countryCode, phone.
- **View Customer Devices and verify associations** → `getDevices` shows the device linked to the correct customerId, petId and serialId.
- **Update Customer** → `updateCustomer` changes email and language; `getCustomer` reflects updates.
- **Delete Customer** → deleting a customer with pet/device fails; deleting a customer without them succeeds and `getCustomer` returns 404.

### Devices
- **Find a Device in the list** → `getDevices` filtered by serialId shows the device.
- **View Device details** → `getDevice` matches deviceId, serialId, customerId, petId.
- **View Device Pet info** → `getPet` returns the correct pet with userId.
- **View Device Owner info** → `getCustomer` returns the correct owner.
- **View Device Subscriptions** → `getSubscriptions` by deviceId returns a defined list.

### Last Connections
- **Heartbeat updates device connection timestamp in CCT list** → after Sentinel heartbeat, `getDevices` shows a recent `lastConnectionDate`, correct lat/lng, imei, iccid and customer info.
- **Retrieve Connections History** → `getConnectionsHistory` returns at least one record.
- **Retrieve Last Connections via specific query** → `getLastConnections` filtered by serialId returns the device.

### Users (CCT Operators)
- **Create a new Operator User** → `createUser` returns 200; user created with all fields.
- **GET details of created User** → `getUser` matches payload (name, surname, email, phone, role, active, visibility).
- **FIND created User in the list** → `getUsers` filtered by email contains the created user.
- **Retrieve current Admin info via GetMyInfo** → `getMyInfo` returns the currently logged-in admin with expected role/visibility.
- **UPDATE created User** → `updateUser` changes name/surname; reflected in response.
- **DELETE created User** → `deleteUser` returns 200; subsequent `getUser` returns 404.
- **Retrieve User Log Activity** → `getLogActivityUser` contains CREATE_USER, UPDATE_USER and DELETE_USER logs for the test user.

</details>

---

<a id="commands"></a>
<details>
<summary><b>Commands</b></summary>

### Torch
- **Activate Torch (duration=60)** → `sendCommand` returns 200; device receives packet 0x10 with `torch_duration=1` and evo_tasks bit 0x01 set; app WebSocket subscription receives `flashlight=ON`.
- **Deactivate Torch (duration=0)** → `sendCommand` returns 200; device receives packet 0x10 with `torch_duration=0` and evo_tasks bit 0x01 set.

### Sound
- **Activate Sound (duration=30)** → `sendCommand` returns 200; device receives packet 0x10 with `sound_duration=30`, `sound_command=1` and evo_tasks bit 0x04 set; app WebSocket receives `sound=ON`.
- **Mute Sound (duration=0)** → `sendCommand` returns 200; device receives packet 0x10 with `sound_duration=0`, `sound_command=0` and evo_tasks bit 0x04 set.

</details>

---

<a id="geofence"></a>
<details>
<summary><b>Geofence</b></summary>

- **Create Geofence** → `createGeofence` returns 200; geofence id generated.
- **Activate Geofence** → `sendSetting` ACTIVATE returns 200; device receives packet 0x01 with `requested_operating_status=GEOFENCE_ON` and 6 coordinates matching payload.
- **Device inside geofence** → heartbeat with `NInsideFence` triggers app WebSocket `inGeofence=true` and `geofence=ON`.
- **Device exits geofence** → heartbeat with `NOutsideFence` triggers app WebSocket `inGeofence=false` and auto-activates Live Tracking (`liveTracking=ON`); device receives packet 0x01 with `FAST_TRACKING`.
- **Deactivate Geofence** → `sendSetting` DEACTIVATE returns 200; device receives packet 0x01 with `DEFAULT`.
- **Update Geofence** → `updateGeofence` returns 200 with new name/coordinates; `getGeofences` reflects the update.
- **Delete Geofence** → `deleteGeofence` returns 200; `getGeofences` no longer contains it.

</details>

---

<a id="live-tracking"></a>
<details>
<summary><b>Live Tracking</b></summary>

- **Activate Live Tracking (duration=900)** → `sendCommand` returns 200; device receives packet 0x01 with `FAST_TRACKING`; app WebSocket receives `liveTracking=ON`.
- **Device sends position** → heartbeat with lat/lng triggers app WebSocket `onGpsMessagePosition` with matching coordinates.
- **Deactivate Live Tracking (duration=0)** → `sendCommand` returns 200; after polling heartbeats device receives packet 0x01 with `DEFAULT`; app WebSocket receives `liveTracking=OFF`.

</details>

---

<a id="energy-saving-zone"></a>
<details>
<summary><b>Energy Saving Zone</b></summary>

- **Create ESZ** → `sendSetting` CREATE returns 200; zone id generated and stored.
- **Activate ESZ** → `sendSetting` ACTIVATE returns 200; device receives packet 0x15 (zones data) and 0x10 with `energy_saving_area_enabled=1`.
- **Device enters ESZ (WiFi detect)** → heartbeat with `spare_c5=NDetached` triggers app WebSocket `inEnergySavingZone=true` and `energySavingMode=ON`.
- **Device leaves ESZ (WiFi lost)** → heartbeat with `spare_c5=0x00` triggers app WebSocket `inEnergySavingZone=false` and `energySavingMode=ON`.
- **Deactivate ESZ** → `sendSetting` DEACTIVATE returns 200; device receives packet 0x10 with `energy_saving_area_enabled=0`; app WebSocket receives `energySavingMode=OFF`.
- **Update ESZ** → `sendSetting` UPDATE returns 200; `getEnergySavingZone` and `getEnergySavingZones` reflect new name, radius and ssid.
- **Delete ESZ** → `sendSetting` DELETE returns 200; `getEnergySavingZone` returns 404; `getEnergySavingZones` no longer contains the zone.

</details>

---

<a id="subscriptions"></a>
<details>
<summary><b>Subscriptions</b></summary>

### Setup & Prerequisites
- **Each device type should have at least 1 sub plan available** → `availablePlans` array length > 0 for DOG, CAT and (Kippy) EVO.
- **Price adjusted to user's billing currency** → `getSubscriptionPlanPricing` with CH country returns CHF (or USD) and preserves plan item/period.
- **Get and Update Billing Info** → `updateBillingInfo` returns 200; `getBillingInfo` reflects the updated city/address.

### Buy
- **Buy sub and verify it becomes active** → utilityIntegrationTest `BuyNewSubscription` returns 200; WebSocket `onSubscriptionStatus` shows `subscriptionIsActive=true`; final sub status is Active, payment Succeeded, plan item matches priceId.
- **Buy sub + DEVICE-protection (Kippy)** → subscription has 2 items (plan + addon), amounts match chosen plan and addon.
- **Buy sub + PET-protection (Kippy IT)** → sub active; pet gets `petProtectionId`; `getPetProtection` matches plan name/price/period and status Open.
- **Buy sub + DEVICE-protection + PET-protection (Kippy IT)** → subscription has 2 items (plan + addon); pet gets `petProtectionId`; both protections verified.
- **Buy PET-protection alone (Kippy IT)** → regular sub purchased first; pet protection bought with `isOnlyProtection=true`; `updatePetProtectionData` persists owner/pet data; `getPetProtection` matches.

### Change Plan
- **Buy MONTHLY → Buy YEARLY creates scheduled change** → first change returns 200; `getSubscriptions` shows exactly 1 sub with `scheduledChanges` containing the yearly plan; current sub remains monthly/active; scheduled change start aligns with current term end.
- **Second change while one is already scheduled should fail** → first change to yearly succeeds; second change attempt returns non-200; scheduled change still targets the yearly plan.

### Automatic Renew (todo / skipped)
- **Succeeded renew** → time-travel nextBillingDate to now; poll until term shifts; sub stays Active/Succeeded; new invoice is Paid.
- **Dunning – failed payment** → swap to no-funds card, force renew; poll until dunning appears; paymentStatus Failed, dunningStatus truthy, term end unchanged.

### Stop Renew
- **Stop renew** → `stopRenewingSubscription` returns 200; sub becomes `non_renewing`, `nextBillingAt` null, term end unchanged.

### Cancel/Refund
- **Refund plan item** → CCT `refundInvoice` returns 200; sub status becomes Cancelled.

### Prepaid (external store)
- **Flow A: order → tracking → buy → register → sub active** → REST `createOrder` creates temp serial; `trackOrder` swaps to real serial; `buyPrepaidSubscription` activates; device registration links sub; order shows `activated=true`.
- **Flow B: order → buy → tracking → register → sub active** → buy before tracking creates orphan sub with PREPAID serial; tracking realigns serial to real one; registration links and activates the sub.

### Not Paying (Free Period)
- **Add Free period on device WITHOUT sub** → `addFreePeriod` returns 200; new sub status InTrial, billingPeriod equals free days, term matches duration.
- **Add Free period on device WITH active sub** → `addFreePeriod` extends current sub term end; `addedFreePeriod` accumulates; sub stays Active/Succeeded.

### Coupon
- **Coupon pre-assigned to device applies discount on purchase** → `setCoupon` returns 200; purchase subscription; invoice contains a 20% discount item; invoice total = plan amount − discount.

### Trial (Kippy)
- **Esselunga – 365d trial** → `setPlanProfiles` ESSELUNGA; only yearly plans available; bypass purchase creates InTrial sub; no invoices; trialEnd ≈ 365 days; nextBillingAt aligns with trialEnd.
- **Trial_1_month – 30d trial** → `setPlanProfiles` TRIAL_1_MONTH; monthly+yearly plans available; bypass purchase creates InTrial sub; no invoices; trialEnd ≈ 30 days; nextBillingAt aligns with trialEnd.

### Paid Externally (Kippy)
- **Axa** → `setPlanProfiles` AXA_12_YEARS; device shows `subscriptionPlan=Insurance`; auto-created sub has 1 item, invoice status PaidExternally, billingPeriod 12 years.
- **Europass** → `setPlanProfiles` EuropAss; device shows `subscriptionPlan=Insurance`; auto-created sub has 1 item, invoice status PaidExternally.

</details>

---

<a id="end-of-life"></a>
<details>
<summary><b>End of Life</b></summary>

> **Note:** entire suite is `describe.skip` (Kippy only).

### Flow 1: Device-Only Replacement (Active Long Subscription)
- **Step 1: Eligibility Check** → `getPlansEOL` returns empty plans list and a devicePrice.
- **Step 2: Device Selection** → `updateEndOfLife` to `SHIPPING_INFO_FROM_ONLY_DEVICE` returns 200; `getEndOfLifeStep` confirms the step.
- **Step 3: Shipping Info** → `updateEndOfLife` with shipping info moves to `SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE`.
- **Step 4: Generate Shop URL** → `checkoutEOLNewDevice` returns a URL.
- **Step 5: External Page** → `updateEndOfLife` to `EXTERNAL_PAGE` returns 200; step confirmed.
- **Step 6: Completion** → `updateEndOfLife` to `COMPLETED_SUCCESS` returns 200; step confirmed.

### Flow 2: Device + Subscription Replacement (Expired/No Subscription)
- **Step 1: Eligibility Check** → `getPlansEOL` returns plans and devicePrice.
- **Step 2: Init Flow** → `updateEndOfLife` to `SHIPPING_INFO_FROM_PLAN` returns 200; `getEndOfLifeStep` confirms.
- **Step 3: Shipping Info** → `updateEndOfLife` with shipping info moves to `PLAN_SUMMARY_PAGE`.
- **Step 4: checkoutNewSubscription API** → returns 200 with a Chargebee URL.
- **Step 5: Purchase Subscription** → utility purchase simulates buy.
- **Step 6: Acknowledge Checkout** → mock call to `acknowledgeCheckout` (expected failure).
- **Step 7: Transition to Waiting** → `updateEndOfLife` to `WAITING_PLAN_PURCHASE` returns 200.
- **Step 8: Polling** → `getPlansEOL` eventually shows `subscriptionId`.
- **Step 9: Generate Shop URL** → `checkoutEOLNewDevice` returns URL.
- **Step 10: External Page** → `updateEndOfLife` to `EXTERNAL_PAGE` returns 200.
- **Step 11: Completion** → `updateEndOfLife` to `COMPLETED_SUCCESS` returns 200.

</details>

---
