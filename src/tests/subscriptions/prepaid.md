# Prepaid Subscription Flow - Complete Documentation

## Executive Summary

The prepaid subscription flow enables users who purchase devices from external stores to buy subscriptions in advance. The system uses a temporary serial number (`PREPAID-{itemId}`) as a placeholder until the real device serial number is known during order tracking. When the device is registered, the system checks for prepaid subscriptions and links them appropriately. If the person who bought the device differs from the person who registers it, the subscription can be transferred via the customer changed webhook handler.

---

## Phase 1: External Store Purchase (Order Creation)

### API Endpoint
- `POST /api/us/v1/order` (Petlink US)
- `POST /api/eu/v1/order` (Kippy EU)


### Process
1. External store calls Core's order API
2. Core creates:
   - **Order** record with customer info, addresses, line items
   - **OrderLineItem** records with **temporary serial**: `PREPAID-{itemId}`
   - User in Chargebee via subscriptions-manager (`sdkSSM.createUser`)
3. Core returns response with:
   - `subscription_url`: `${WEBAPP_URL}/activate-order/{orderId}?&lang={lang}`


### Database Records Created
- **Order**: `{ entityType: 'ORDER', customer: {...}, lineItems: [itemId1, itemId2] }`
- **OrderLineItem**: `{ entityType: 'ORDER_ITEM', serialNumber: 'PREPAID-{itemId}', activated: false }`

---

## Phase 2: Order Tracking (Device Shipment)

### API Endpoint
- `POST /api/us/v1/order-tracking`
- `POST /api/eu/v1/order-tracking`

### Process
1. Order tracking API is called with IMEI and tracking information
2. Core:
   - Updates Order with tracking info (`trackingService`, `trackingCode`, `trackingUrl`)
   - For each line item:
     - Finds device in inventory by IMEI → gets **real serialNumber**
     - Updates OrderLineItem with real serialNumber
     - Looks for subscription with `serialNumber: PREPAID-{itemId}`
     - If found, calls `sdkSSM.updateDMSerialNumber()` to update serial in Chargebee


### Database Records Updated
- **Order**: `{ trackingService, trackingCode, trackingUrl }`
- **OrderLineItem**: `{ serialNumber: 'REAL_SERIAL_123', imei: 'IMEI_456' }`
- **Subscription** (in Chargebee): serialNumber updated from `PREPAID-{itemId}` to real serial

---

## Phase 3: User Purchases Subscription (Hosted Page)

### Web Flow
1. User navigates to `/activate-order/{orderId}`
2. Web app (`ActivateOrderPage.tsx`) calls `getOrder` GraphQL query
3. User selects device (shows temporary serial `PREPAID-{itemId}`)
4. User selects plan → redirected to Chargebee hosted page
5. Chargebee creates subscription with `serialNumber = PREPAID-{itemId}`

### Chargebee Webhooks to Core
1. **subscription_created**:
   - Creates Subscription record with `isPrepaid: true` when `productId` is `undefined`
   
2. **payment_succeeded**:
   - Updates `paymentStatus: SUCCEEDED`


### Database Records Created
- **Subscription**: `{ entityType: 'SUBSCRIPTION', isPrepaid: true, productId: null, serialNumber: 'PREPAID-{itemId}' }`

---

## Phase 4: Device Registration

### API Endpoint
- `Mutation.createPetlinkGps`

### Process
1. User registers device via app using **real serialNumber**
2. App calls `createPetlinkGps` mutation with real serial
3. Core:
   - Checks for prepaid subscription by querying subscriptions with matching serialNumber
   - Looks for: `isPrepaid: true` OR `isInsurance: true` OR trial with free period
   - If found:
     - Sends `REGISTERED_GPS_PREPAID` notification (email + push)
     - Includes `currentTermEndDate` in notification
   - Sets OrderItem `activated: true`


### Database Records Updated
- **OrderLineItem**: `{ activated: true }`
- **PetlinkGps**: Device record created (subscription linking happens later)

---

## Phase 5: Subscription Transfer

### Trigger
Chargebee sends `customer_changed` webhook when payment method is updated.

### Process
1. Core's `customerChangedHandler` detects mismatch:
   - Compares Chargebee subscription's userId with user's chargebeeId
   - If different, subscription needs transfer
2. Core:
   - Calls `sdkSSM.cloneSubscription()` to create new subscription for correct user
   - Stops old subscription (immediately if payment failed, otherwise at term end)
   - Updates old subscription with `moved: newSubscriptionId`
   - Creates new subscription with `movedFrom: oldSubscriptionId`
   - Links new subscription to device
   - Transfers invoices and credit notes to new subscription


### Database Records Updated
- **Subscription** (old): `{ moved: 'newSubscriptionId' }`
- **Subscription** (new): `{ movedFrom: 'oldSubscriptionId', userId: 'newUserId' }`
- **Invoice/CreditNote**: `subscriptionId` updated to new subscription ID

---

## Phase 6: Prepaid Keep-Alive

### Scheduled Lambda
- `keepAlivePrepaid` - Runs periodically

### Purpose
Finds prepaid subscriptions with `currentTermEnd` within next 7 days and extends `currentTermEnd` by 1 month via `sdkSSM.changeTermEnd()`.

### Process
1. Finds prepaid subscriptions:
   - `status: active`
   - `paymentStatus: SUCCEEDED`
   - `productId: undefined` (prepaid indicator)
   - `currentTermEnd` within next 7 days
2. For each subscription:
   - Extends `currentTermEnd` by 1 month
   - Calls `sdkSSM.changeTermEnd()` to update in Chargebee


---

## Data Flow Diagram

```
┌─────────────────┐
│ External Store  │
└────────┬────────┘
         │ POST /api/us/v1/order
         ↓
┌─────────────────────────────────┐
│ Core: Order Manager Service      │
│ - Create Order                   │
│ - Create OrderLineItem           │
│   serialNumber: PREPAID-{itemId} │
│ - Create Chargebee User          │
└────────┬────────────────────────┘
         │ Return subscription_url
         ↓
[PARALLEL FLOWS - ORDER NOT DEFINED IN CODE]

┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│ Order Tracking API               │     │ Web App: ActivateOrderPage       │
│ POST /api/us/v1/order-tracking   │     │ - GET /activate-order/{orderId}  │
│ - Provide IMEI and real serial   │     │ - Call getOrder GraphQL          │
└────────┬────────────────────────┘     │ - Show devices with PREPAID serial│
         │                               │ - User selects plan               │
         ↓                               └────────┬────────────────────────┘
┌─────────────────────────────────┐              │
│ Core: Order Tracking Handler     │             │ Redirect to Chargebee
│ - Update OrderItem with real     │             ↓
│   serialNumber                   │   ┌─────────────────────────────────┐
│ - Find subscription with         │   │ Chargebee Hosted Page            │
│   PREPAID-{itemId}               │   │ - Create subscription            │
│ - Call updateDMSerialNumber()    │   │   serialNumber: PREPAID-{itemId} │
│   to update Chargebee            │   └────────┬────────────────────────┘
└─────────────────────────────────┘            │
                                               │ Webhooks to Core
                                               ↓
                                        ┌─────────────────────────────────┐
                                        │ Core: Webhook Consumer          │
                                        │ - subscription_created webhook   │
                                        │ - Create Subscription record     │
                                        │   isPrepaid: true                │
                                        │   productId: null                │
                                        │ - payment_succeeded webhook      │
                                        │   paymentStatus: SUCCEEDED       │
                                        └─────────────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ Mobile App: Device Registration  │
│ Mutation.createPetlinkGps        │
│ - Provide real serialNumber      │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Core: createPetlinkGps Handler    │
│ - Find prepaid subscription by   │
│   serialNumber                   │
│ - Send REGISTERED_GPS_PREPAID    │
│   notification                   │
│ - Set OrderItem activated: true  │
└────────┬────────────────────────┘
         │ If payment method changes
         ↓
┌─────────────────────────────────┐
│ Chargebee: customer_changed      │
│ webhook                          │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Core: customerChangedHandler     │
│ - Detect userId mismatch         │
│ - Clone subscription to new user │
│ - Stop old subscription          │
│ - Link new subscription to device│
│ - Transfer invoices              │
└─────────────────────────────────┘
```

---

## Database Schema Summary

### Order
```typescript
{
  id: string,
  entityType: 'ORDER',
  kippyId: number,
  externalOrderId: number,
  customer: {
    email: string,
    chargebeeId: string,
    // ...
  },
  lineItems: string[],  // Array of OrderLineItem IDs
  trackingService: string,
  trackingCode: string,
  trackingUrl: string,
  // ...
}
```

### OrderLineItem
```typescript
{
  id: string,
  entityType: 'ORDER_ITEM',
  orderId: string,
  serialNumber: string,  // PREPAID-{itemId} → real serial
  imei: string,
  activated: boolean,  // Set to true on device registration
  kippySku: string,
  model: 'DOG' | 'CAT',
  appBrand: 'PETLINK' | 'KIPPY',
  // ...
}
```

### Subscription
```typescript
{
  id: string,
  entityType: 'SUBSCRIPTION',
  userId: string,
  productId: string | null,  // null for prepaid
  serialNumber: string,  // PREPAID-{itemId} → real serial
  chargebeeSubscriptionId: string,
  isPrepaid: boolean | null,  // true for prepaid
  isInsurance: boolean | null,
  status: 'active' | 'in_trial' | 'future' | ...,
  paymentStatus: 'SUCCEEDED' | 'FAILED' | 'PENDING',
  currentTermStart: string,
  currentTermEnd: string,
  moved: string | null,  // Set when transferred
  movedFrom: string | null,  // References old subscription
  // ...
}
```

### PetlinkGps (Device)
```typescript
{
  id: string,
  entityType: 'PETLINK_GPS',
  serialNumber: string,
  userId: string,
  petId: string,
  subscriptionId: string | null,  // Linked subscription
  // ...
}
```

---

## Testing Considerations

### Key Assertions
Based on code analysis:
- Order created with `PREPAID-{itemId}` serial in OrderLineItem
- OrderLineItem `activated` becomes `true` after device registration
- Subscription has `isPrepaid: true` when `productId` is `null`
- Subscription serial updates from `PREPAID-{itemId}` to real serial after order tracking (via `updateDMSerialNumber`)
- Subscription transfers when `customer_changed` webhook is triggered (payment method change)
- Keep-Alive extends subscription `currentTermEnd` by 1 month when within 7 days of expiration

