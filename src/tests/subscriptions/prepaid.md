# Prepaid Subscription Flow - Complete Documentation

## Overview

The prepaid subscription flow handles cases where users purchase devices from external stores (Shopify, Magento) and buy subscriptions in advance before receiving the device. The key challenge is that the person who buys the device may not be the same person who registers it in the app.

## Key Concepts

- **Temporary Serial**: `PREPAID-{itemId}` - Used as placeholder until real device serial is known
- **isPrepaid flag**: Marks subscriptions that were purchased before device registration
- **Subscription Transfer**: Mechanism to move subscription from buyer to actual user
- **Order Tracking**: Process that assigns real serial number when device ships

---

## Phase 1: External Store Purchase (Order Creation)

### API Endpoint
- `POST /api/us/v1/order` (Petlink US)
- `POST /api/eu/v1/order` (Kippy EU)

### Request Body
```typescript
{
  order_source: 'PIDUS' | 'KIPPYEU' | 'DMOS',
  external_order_id: number,
  external_order_name: string,
  status: string,
  total: string,
  currency: string,
  payment_method: string,
  customer: {
    first_name: string,
    last_name: string,
    email: string,
    phone_prefix: string,
    phone: string,
  },
  shipping_address: OrderAddress,
  billing_address: OrderAddress,
  line_items: Array<{
    external_item_id: string,
    amount: string,
    quantity: number,
    kippy_sku: string,
  }>
}
```

### Process
1. External store (Shopify/Magento) calls Core's order API
2. Core creates:
   - **Order** record with customer info, addresses, line items
   - **OrderLineItem** records with **temporary serial**: `PREPAID-{itemId}`
   - User in Chargebee via subscriptions-manager (`sdkSSM.createUser`)
3. Core returns response with:
   - `subscription_url`: `${WEBAPP_URL}/activate-order/{orderId}?&lang={lang}`
   - This URL is sent to buyer via email

### Key Code Location
`all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/orderManagerRestService/operation/post/utilOrder.ts` line 50

```typescript
const orderLineItem: OrderLineItem = {
  id: itemId,
  serialNumber: `PREPAID-${itemId}`,  // Temporary placeholder
  entityType: EntityTypeEnum.Enum.ORDER_ITEM,
  orderId: orderId,
  // ... other fields
};
```

### Database Records Created
- **Order**: `{ entityType: 'ORDER', customer: {...}, lineItems: [itemId1, itemId2] }`
- **OrderLineItem**: `{ entityType: 'ORDER_ITEM', serialNumber: 'PREPAID-{itemId}', activated: false }`

---

## Phase 2: Device Shipment (Order Tracking)

### API Endpoint
- `POST /api/us/v1/order-tracking`
- `POST /api/eu/v1/order-tracking`

### Request Body
```typescript
{
  kippy_order_id: number,
  tracking_service: string,
  tracking_code: string,
  tracking_url: string,
  line_items: Array<{
    kippy_item_id: number,
    imei: string,
  }>
}
```

### Process
1. Datamars calls order-tracking API when device ships
2. Core:
   - Updates Order with tracking info (`trackingService`, `trackingCode`, `trackingUrl`)
   - For each line item:
     - Finds device in inventory by IMEI → gets **real serialNumber**
     - Updates OrderLineItem with real serialNumber
     - **Critical**: Looks for subscription with `serialNumber: PREPAID-{itemId}`
     - If found, calls `sdkSSM.updateDMSerialNumber()` to update serial in Chargebee

### Key Code Location
`all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/orderManagerRestService/operation/post/orderTracking.ts` lines 158-181

```typescript
// Find subscription with temporary serial
const subscription = (await findItem<Subscription>(
  dbSecret,
  {
    serialNumber: `PREPAID-${item.id}`,
    entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
    status: SubscriptionStatusEnum.Enum.active,
  },
  COLLECTION_NAME
)).item;

if (subscription) {
  logger.info(
    `need to change DM_serial number on ${subscription.id} for chargebeeId ${subscription.chargebeeSubscriptionId} with new serialNumber: ${serialNumber}`
  );
  await sdkSSM.updateDMSerialNumber({
    subscriptionId: subscription.chargebeeSubscriptionId,
    serialNumber: serialNumber,
  });
}
```

### Database Records Updated
- **Order**: `{ trackingService, trackingCode, trackingUrl }`
- **OrderLineItem**: `{ serialNumber: 'REAL_SERIAL_123', imei: 'IMEI_456' }`
- **Subscription** (in Chargebee): serialNumber updated from `PREPAID-{itemId}` to real serial

---

## Phase 3: User Purchases Subscription (Hosted Page)

### Web Flow
1. User clicks email link → `/activate-order/{orderId}`
2. Web app (`ActivateOrderPage.tsx`) calls `getOrder` GraphQL query
3. User selects device (shows temporary serial `PREPAID-{itemId}`)
4. User selects plan → redirected to Chargebee hosted page
5. Chargebee creates subscription with `serialNumber = PREPAID-{itemId}`

### Chargebee Webhooks to Core
1. **subscription_created**:
   - Creates Subscription record with `isPrepaid: true` (no `productId` yet)
   - Sets `paymentStatus: PENDING`
   
2. **payment_succeeded**:
   - Updates `paymentStatus: SUCCEEDED`
   - Links to device if `productId` exists (not for prepaid initially)

### Key Code Location
`all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/utils.ts` lines 280-281

```typescript
const subscription: Subscription = {
  id: subscriptionId,
  entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
  userId: userId,
  productId: productId,  // undefined for prepaid
  isPrepaid: !productId || undefined,  // true when productId is undefined
  serialNumber: serialNumber,  // PREPAID-{itemId}
  chargebeeSubscriptionId: data.subscription.id,
  // ... other fields
};
```

### Database Records Created
- **Subscription**: `{ entityType: 'SUBSCRIPTION', isPrepaid: true, productId: null, serialNumber: 'PREPAID-{itemId}' }`

---

## Phase 4: Device Registration (User Registers Device)

### API Endpoint
- `Mutation.createPetlinkGps`

### Process
1. User receives device, registers via app using **real serialNumber**
2. App calls `createPetlinkGps` mutation with real serial
3. Core:
   - Checks for prepaid subscription by querying subscriptions with matching serialNumber
   - Looks for: `isPrepaid: true` OR `isInsurance: true` OR trial with free period
   - If found:
     - Sends `REGISTERED_GPS_PREPAID` notification (email + push)
     - Includes `currentTermEndDate` in notification
   - Sets OrderItem `activated: true`

### Key Code Location
`all-repo/petlink-everywhere-core/src/lambda_functions/graphql/mutation/createPetlinkGps/handler.ts` lines 302-346

```typescript
const subscriptionsRes = await findItems<Subscription>(
  dbSecret,
  {
    entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
    serialNumber: resPetlinkGps.petlinkGps.serialNumber,
    moved: { $ne: true },
    status: {
      $nin: [
        SubscriptionStatusEnum.Enum.closed,
        SubscriptionStatusEnum.Enum.cancelled,
      ],
    },
    $or: [
      { isPrepaid: true },
      { isInsurance: true },
      {
        businessEntityId: 'DATAMARS',
        status: SubscriptionStatusEnum.Enum.in_trial,
        addedFreePeriod: { $exists: true },
      },
    ],
  },
  COLLECTION_NAME
);

const isPrepaid = (subscriptionsRes.items?.length ?? 0) > 0;

const notificationConfig = isPrepaid
  ? {
      action: DeviceActionEnum.Enum.REGISTERED_GPS_PREPAID,
      emailData: { name: user.name },
      petName: pet.name,
      currentTermEndDate: moment(resPetlinkGps.currentTermEnd).utc().format('YYYY-MM-DD'),
    }
  : { /* regular registration */ };
```

### Database Records Updated
- **OrderLineItem**: `{ activated: true }`
- **PetlinkGps**: Device record created (subscription linking happens later)

---

## Phase 5: Subscription Transfer (Different Buyer vs User)

### Scenario
Father buys device from external store, son registers it in app with his own account.

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

### Key Code Location
`all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/subscriptionWebhookHandlers/customerChangedHandler.ts` lines 204-284

```typescript
const subscriptionsToMove = subscriptions.filter((sub) => {
  const chargebeeSubscription = chargebeeMap.get(sub.chargebeeSubscriptionId);
  return (
    chargebeeSubscription && chargebeeSubscription.userId !== chargebeeUserId
  );
});

for (const toMove of subscriptionsToMove) {
  const cloneResult = await sdkSSM.cloneSubscription({
    userId: chargebeeUserId,
    subscriptionIdToClone: toMove.chargebeeSubscriptionId,
    startDate: toMove.currentTermStart!,
    trialEnd: paymentIsFailed ? undefined : toMove.currentTermEnd!,
  });

  await sdkSSM.stopRenewingSubscription({
    subscriptionId: toMove.chargebeeSubscriptionId,
    immediately: true,
  });

  // Mark old subscription as moved
  await findOneAndUpdate(
    dbSecret,
    { chargebeeSubscriptionId: toMove.chargebeeSubscriptionId },
    { moved: subscriptionId },
    petlinkGpsCollection
  );

  // Create new subscription with movedFrom reference
  const subscription: Subscription = {
    // ... copy from old subscription
    movedFrom: toMove.id,
  };
}
```

### Database Records Updated
- **Subscription** (old): `{ moved: 'newSubscriptionId' }`
- **Subscription** (new): `{ movedFrom: 'oldSubscriptionId', userId: 'newUserId' }`
- **Invoice/CreditNote**: `subscriptionId` updated to new subscription ID

---

## Phase 6: Prepaid Keep-Alive

### Scheduled Lambda
- `keepAlivePrepaid` - Runs periodically (e.g., daily)

### Purpose
Extends prepaid subscriptions that are about to expire (within 7 days) by 1 month to prevent service interruption.

### Process
1. Finds prepaid subscriptions:
   - `status: active`
   - `paymentStatus: SUCCEEDED`
   - `productId: undefined` (prepaid indicator)
   - `currentTermEnd` within next 7 days
2. For each subscription:
   - Extends `currentTermEnd` by 1 month
   - Calls `sdkSSM.changeTermEnd()` to update in Chargebee

### Key Code Location
`all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/keepAlivePrepaid/handler.ts`

```typescript
export const findPrepaidToKeepAlive = async () => {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const query = {
    entityType: EntityTypeEnum.Enum.SUBSCRIPTION,
    status: SubscriptionStatusEnum.Enum.active,
    paymentStatus: PaymentStatusTypeEnum.Enum.SUCCEEDED,
    productId: undefined,  // Prepaid indicator
    currentTermEnd: {
      $gte: now.toISOString(),
      $lte: sevenDaysFromNow.toISOString(),
    },
  };

  const prepaidRes = await findItems(dbSecret, query, COLLECTION_NAME);
  return prepaidRes.items as Subscription[];
};

// In handler:
for (const prepaid of prepaidSubscriptions) {
  const newTermEndDate = new Date(prepaid.currentTermEnd!);
  newTermEndDate.setMonth(newTermEndDate.getMonth() + 1);
  await sdkSSM.changeTermEnd({
    subscriptionId: prepaid.chargebeeSubscriptionId,
    newTermEnd: newTermEndDate.toISOString(),
  });
}
```

---

## Complete Data Flow Diagram

```
┌─────────────────┐
│ External Store  │
│ (Shopify/Magento)│
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
┌─────────────────┐
│ Email to Buyer  │
│ with activate   │
│ order link      │
└────────┬────────┘
         │ User clicks link
         ↓
┌─────────────────────────────────┐
│ Web App: ActivateOrderPage       │
│ - GET /activate-order/{orderId}  │
│ - Call getOrder GraphQL          │
│ - Show devices with PREPAID serial│
│ - User selects plan               │
└────────┬────────────────────────┘
         │ Redirect to Chargebee
         ↓
┌─────────────────────────────────┐
│ Chargebee Hosted Page            │
│ - User completes purchase        │
│ - Create subscription            │
│   serialNumber: PREPAID-{itemId} │
└────────┬────────────────────────┘
         │ Webhooks to Core
         ↓
┌─────────────────────────────────┐
│ Core: Webhook Consumer           │
│ - subscription_created webhook    │
│ - Create Subscription record     │
│   isPrepaid: true                │
│   productId: null                │
│ - payment_succeeded webhook      │
│   paymentStatus: SUCCEEDED       │
└────────┬────────────────────────┘
         │ Device ships
         ↓
┌─────────────────────────────────┐
│ Datamars: Order Tracking         │
│ POST /api/us/v1/order-tracking   │
│ - Provide IMEI and real serial   │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Core: Order Tracking Handler     │
│ - Update OrderItem with real     │
│   serialNumber                   │
│ - Find subscription with         │
│   PREPAID-{itemId}               │
│ - Call updateDMSerialNumber()    │
│   to update Chargebee            │
└────────┬────────────────────────┘
         │ User receives device
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
         │ If different user
         ↓
┌─────────────────────────────────┐
│ Chargebee: customer_changed      │
│ webhook (when payment method     │
│ changes)                         │
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

## Key File Locations

### Order Management
- `all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/orderManagerRestService/`
  - `server.ts` - REST API endpoints
  - `operation/post/order.ts` - Order creation handler
  - `operation/post/orderTracking.ts` - Order tracking handler
  - `operation/post/utilOrder.ts` - Order creation logic

### Webhook Handlers
- `all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/subscriptionsWebhookConsumer/`
  - `handler.ts` - Main webhook dispatcher
  - `utils.ts` - Shared utilities (handlerNewSubscription, linkToDevice)
  - `subscriptionWebhookHandlers/`
    - `subscriptionCreatedHandler.ts` - subscription_created webhook
    - `customerChangedHandler.ts` - customer_changed webhook (transfer logic)

### Device Registration
- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/mutation/createPetlinkGps/handler.ts`

### Subscription Plans
- `all-repo/petlink-everywhere-core/src/lambda_functions/graphql/query/getSubscriptionPlans/handler.ts`
  - Handles prepaid flow detection (`isPrepaid = serialNumber && !productId`)

### Keep-Alive
- `all-repo/petlink-everywhere-core/src/lambda_functions/subscriptions/keepAlivePrepaid/handler.ts`
- `all-repo/petlink-everywhere-core/src/lib/petlink/subscriptions.ts` (findPrepaidToKeepAlive)

### Type Definitions
- `all-repo/petlink-everywhere-core/src/lib/types/order.ts`
- `all-repo/petlink-everywhere-core/src/lib/types/subscription.ts`

### Web App
- `all-repo/petlink-everywhere-web/src/components/pages/Order/ActivateOrderPage.tsx`
- `all-repo/petlink-everywhere-web/src/components/pages/Order/ActivateOrderSummaryPage.tsx`

---

## Potential Issues and Edge Cases

### 1. Timing Dependency
**Issue**: If user purchases subscription BEFORE order tracking updates serial, the subscription has `PREPAID-{itemId}` serial. If order tracking happens AFTER, it updates the serial in Chargebee.

**Current Handling**: The `orderTracking` handler calls `updateDMSerialNumber()` to update the serial in Chargebee, which should handle this case.

**Risk**: If subscription is created with `PREPAID-{itemId}` but order tracking never happens (e.g., device lost), the subscription remains with temporary serial.

### 2. User Mismatch Handling
**Issue**: The `customerChangedHandler` only transfers subscriptions when payment method changes. If the son registers the device but never changes payment method, the subscription might remain under father's Chargebee account.

**Current Handling**: Transfer only happens on `customer_changed` webhook.

**Risk**: Subscriptions may remain under wrong Chargebee user if payment method never changes.

### 3. Registration Timing
**Issue**: The comment in `subs.md` says "la durata parte dal giorno di registrazione, non di acquisto" (duration starts from registration day, not purchase day). However, the subscription is created in Chargebee when purchased, not when registered.

**Current Handling**: The `currentTermStart` is set by Chargebee at purchase time. No adjustment happens during registration.

**Risk**: Users might expect subscription to start when they register the device, not when they purchased it.

### 4. Multiple Devices in Order
**Issue**: An order can have multiple line items (multiple devices). Each gets its own `PREPAID-{itemId}` serial.

**Current Handling**: The flow handles multiple devices correctly - each has its own subscription.

**Risk**: User might purchase subscription for wrong device if they select incorrectly in the web app.

### 5. Subscription Before Order Tracking
**Issue**: If user purchases subscription before device ships, the subscription has `PREPAID-{itemId}` serial. When order tracking happens, it updates the serial in Chargebee.

**Current Handling**: The `updateDMSerialNumber()` call in order tracking handles this.

**Risk**: If order tracking fails or is delayed, the subscription remains with temporary serial.

---

## Testing Considerations

### Test Scenarios
1. **Happy Path**: External store purchase → order tracking → subscription purchase → device registration
2. **Subscription Before Tracking**: User purchases subscription before device ships
3. **User Transfer**: Father buys, son registers (with payment method change)
4. **User Transfer Without Payment Change**: Father buys, son registers (no payment method change)
5. **Multiple Devices**: Order with multiple devices, different users register each
6. **Order Tracking Failure**: Device ships but order tracking never called
7. **Keep-Alive**: Prepaid subscription approaching expiration

### Key Assertions
- Order created with `PREPAID-{itemId}` serial
- OrderLineItem `activated` becomes `true` after registration
- Subscription has `isPrepaid: true` when `productId` is null
- Subscription serial updates from `PREPAID-{itemId}` to real serial after order tracking
- Subscription transfers when user changes payment method
- Keep-Alive extends subscription nearing expiration

---

## Related Documentation
- `src/tests/subscriptions/subs.md` - High-level subscription flow notes
- `ai-rules/overview-project.md` - System architecture overview
- `docs/petlink-infrastructure.md` - Infrastructure documentation
