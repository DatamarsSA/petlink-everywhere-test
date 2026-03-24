# PetlinkGPS Reset Flow

## Overview
The GPS reset is a **destructive and irreversible operation** that completely removes a GPS device from the system. Unlike replacement (which substitutes the device while maintaining the association), reset **permanently deletes** the GPS, cancels subscriptions, and deactivates the SIM.

---

## When to Use Reset
- **Device lost/stolen**: Permanent removal of a non-recoverable device
- **Customer request**: Complete cancellation of GPS service
- **Failed device**: Removal of a malfunctioning device without replacement
- **Account cleanup**: Removal of all devices associated with a user

---

## Complete Reset Flow

### STEP 1: AUTHORIZATION & VALIDATION
**System Action**: Verify permissions and device existence

```
CCT Operator calls: resetPetlinkGps(id: "gps-id")
  ├─ Validates: CCT user authentication + roles
  ├─ Validates: GPS device exists in MongoDB
  ├─ Validates: User exists and is active
  └─ Checks: Subscription constraints
```

**Constraints**:
- **CCT-only operation**: Only authorized operators can execute reset
- **L2 restriction**: L2 operators cannot reset devices with active subscriptions
- **Device must exist**: GPS must be present in the system

---

### STEP 2: SUBSCRIPTION VALIDATION & CANCELLATION
**Backend Action**: Verify and manage associated subscriptions

```
Backend checks subscription:
  ├─ If device has subscriptionId:
  │  ├─ Verifies: Subscription exists and valid
  │  ├─ Checks: Active/Trial/Future status
  │  ├─ If active → BLOCK reset (Error 422)
  │  └─ If valid but inactive → Stop renewal (Chargebee)
  └─ If no subscription → Proceed with reset
```

**Business Rules**:
- **Active subscription = NO RESET**: Devices with active subscriptions cannot be reset
- **Future subscription = NO RESET**: Future subscriptions block reset
- **Trial subscription = NO RESET**: Trial devices cannot be reset
- **Inactive subscription**: Immediate renewal stop on Chargebee

---

### STEP 3: DEVICE DELETION & HISTORY
**Backend Action**: Permanent deletion and tracking

```
Backend performs deletion:
  ├─ Creates: ResetPetlinkGpsHistory record
  │  ├─ GPS ID, serial number, user info
  │  ├─ Timestamp, email, user ID
  │  └─ Reason: RESET_PETLINK_GPS
  ├─ Deletes: PetlinkGps document from MongoDB
  └─ Updates: All associated subscriptions to CANCELLED
```

**Data Impact**:
- **Complete deletion**: GPS is removed from main database
- **History preserved**: Permanent reset record is created
- **Subscription cancelled**: All associated subscriptions are cancelled

---

### STEP 4: SIM DEACTIVATION
**Backend Action**: Connectivity deactivation

```
Backend disables SIM:
  ├─ Finds: Device inventory by serial number
  ├─ Identifies: SIM provider by ICCID
  │  ├─ ICCID starts "8901" → AT&T (USA)
  │  └─ ICCID starts "8988" → Vodafone (EU)
  ├─ Suspends: SIM card (suspended state)
  └─ Updates: Inventory subscriptionActive = false
```

**SIM Impact**:
- **Immediate suspension**: SIM is put in `suspended` state
- **No data connectivity**: Device can no longer communicate
- **Inventory update**: Device marked as no longer active

---

### STEP 5: SENTINEL NOTIFICATION
**Backend Action**: Notify device management system

```
Backend notifies Sentinel:
  ├─ Sends: SQS message to newGpsDevicesQueue
  ├─ Type: RESET_DEVICE message group
  ├─ Payload: { serialNumber: "PETL123456" }
  └─ Action: Sentinel removes device from active connections
```

**System Impact**:
- **Connection cleanup**: Sentinel removes device from active connections
- **No more tracking**: Device will no longer send position data
- **Resource cleanup**: All associated resources are freed

---

## Data Flow: Reset Complete

```
┌─────────────────────────────────────────────────────┐
│ CCT Frontend                                        │
│ Operator clicks "Reset GPS Device"                 │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ GraphQL Mutation: resetPetlinkGps(id: "gps-id")    │
│ Auth: CCT JWT (IAM authorization)                  │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ CCT Core Handler                                    │
│ - Validate CCT user + roles                         │
│ - Check device exists                               │
│ - Validate subscription constraints                 │
│ - Call Core resetPetlinkGps()                       │
└─────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│ Core Backend Handler                                │
│ - Validate device + user                            │
│ - Check subscription status                         │
│ - Create ResetHistory record                        │
│ - Delete PetlinkGps document                        │
│ - Cancel all subscriptions                         │
│ - Suspend SIM (AT&T/Vodafone)                      │
│ - Update inventory                                  │
│ - Send SQS to Sentinel                             │
└─────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ SQS: Sentinel    │  │ SIM Providers    │
        │ RESET_DEVICE     │  │ (AT&T/Vodafone)  │
        └──────────────────┘  └──────────────────┘
                    ↓               ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Sentinel         │  │ SIM Cards        │
        │ Removes device   │  │ Suspended        │
        │ Cleans up        │  │ No connectivity  │
        └──────────────────┘  └──────────────────┘
```

---

## Key Differences: Reset vs Replacement

| Aspect | Reset | Replacement |
|--------|-------|-------------|
| **Device deletion** | ✅ Permanent deletion | ❌ Device updated with new serial |
| **Pet association** | ❌ Pet loses GPS | ✅ Pet keeps GPS association |
| **Subscription** | ❌ All cancelled | ✅ Transferred to new device |
| **SIM handling** | ❌ Suspended permanently | ❌ Old SIM suspended, new activated |
| **History tracking** | ✅ ResetPetlinkGpsHistory | ✅ ReplacementPetlinkGpsHistory |
| **User access** | ❌ CCT-only operation | ✅ User can request replacement |

---

## Error Scenarios & Edge Cases

### 422 - Reset Not Allowed
```typescript
// Device has active subscription
if (subscription.status === 'active' || 
    subscription.status === 'in_trial' || 
    subscription.status === 'future') {
  return { code: '422', message: 'RESET_NOT_ALLOWED' };
}
```

### 403 - Not Authorized (CCT)
```typescript
// L2 user trying to reset device with subscription
if (cctUserRoles.includes('L2') && 
    !cctUserRoles.includes('SUPERADMIN') && 
    product.subscriptionId != null) {
  return { code: '403', message: 'NOT_AUTHORIZED' };
}
```

### 404 - Device Not Found
```typescript
// GPS device doesn't exist
if (!resProduct.item) {
  return { code: '404', message: 'DEVICE_NOT_FOUND' };
}
```

---

## Business Rules Summary

### ✅ Reset Allowed When:
- Device exists and is valid
- No active/trial/future subscriptions
- CCT operator has sufficient permissions
- User account is active

### ❌ Reset Blocked When:
- Device has active subscription
- Device is in trial period
- Device has future subscription
- CCT operator lacks permissions (L2 with subscription)
- Device doesn't exist

---

## Post-Reset State

### Device Status:
- **Deleted**: Removed from PetlinkGps collection
- **SIM Suspended**: No connectivity possible
- **Inventory Updated**: `subscriptionActive = false`
- **History Created**: Permanent reset record

### User Impact:
- **Pet loses GPS**: Pet no longer has tracking device
- **Subscription cancelled**: All billing stopped
- **No tracking**: Real-time position unavailable
- **Can register new GPS**: User can add different device later

### System Impact:
- **Sentinel cleanup**: Device removed from active connections
- **Resources freed**: Bandwidth, storage, processing
- **Audit trail**: Complete reset history preserved
