# Data Flows — canonical cross-service views

Stable architectural views of how data moves through the system (not implementation details). For per-domain step-by-step journeys see the other `docs/` files.

## 1. Device → User (Position Updates)
```mermaid
sequenceDiagram
    Device->>Sentinel: TCP packet (binary SiRF)
    Sentinel->>SQS: position on gpsMessages
    SQS->>Consumer: trigger gpsMessagesConsumer (in Core)
    Consumer->>MongoDB: update device position
    Consumer->>Core: publishOnGpsMessagePosition
    Core->>AppSync: publish subscription event
    AppSync->>Mobile: real-time position update
    Note over Consumer: geo-fence alerts queue notifications
```

## 2. User → Device (Send Command)
```mermaid
sequenceDiagram
    Mobile->>Core: sendCommand mutation
    Core->>MongoDB: store command
    Core->>SQS: queue on commands
    Core->>Mobile: command queued
    SQS->>commandsConsumer: trigger
    commandsConsumer->>Sentinel: HTTP POST /send_packet
    Sentinel->>Device: TCP binary command
    Device->>Sentinel: ACK
    Sentinel->>SQS: status update
    Note over Core,Mobile: status flows back via GraphQL subscription
```

## 3. Subscription Purchase
```mermaid
sequenceDiagram
    User->>Core: purchase subscription
    Core->>SubsMgr: GraphQL createSubscription
    SubsMgr->>Chargebee: create subscription
    SubsMgr->>Core: hosted page URL
    Core->>User: redirect to payment
    User->>Chargebee: enter payment
    Note over Chargebee: async webhook flow
    Chargebee->>SubsMgr: subscription_created webhook
    SubsMgr->>SQS: normalized event on subscriptionsWebhook
    SQS->>Consumer: trigger (in Core)
    Consumer->>Core: update subscription status
    Consumer->>SQS: notify on newGpsDevices
    SQS->>Sentinel: update subscription_active
```

## 4. Device Registration
```mermaid
sequenceDiagram
    User->>Mobile: scan QR / enter serial
    Mobile->>Core: createPetlinkGps
    Core->>Inventory: check serial in petlinkGpsInventory
    alt serial not in inventory
        Inventory-->>Core: not found
        Core-->>Mobile: 428 error
    else serial OK
        Core->>Core: assign device to user/pet
        Core->>SQS: newGpsDevices message
        SQS->>Sentinel: register device + WAKEUP
        Core->>Mobile: registered
    end
```

## 5. Customer Support (CCT)
```mermaid
sequenceDiagram
    Agent->>CCT: search customer / action (refund, reset…)
    CCT->>CCTCore: GraphQL
    alt query (getCustomer, getDevices…)
        CCTCore->>CoreMongo: direct read (aggregation)
    else mutation
        CCTCore->>SubsMgr: proxy via sdkSM (or sdkCore → Core)
        CCTCore->>CCTMongo: audit log
    end
```

## 6. Legacy Data Migration (petlink-data-migration)
`migrationOnDemand` orchestrates per user: check already migrated → read legacy MySQL → insert USER → sync sub-migrations via Lambda Invoke (pets+devices+Sentinel registration, ESA, geofences, subscriptions via Chargebee) → create Cognito account → `migrated=1` in MySQL → enqueue async SQS history migrations (positions, activities, notifications) → welcome posts. Bulk mode: `bulkMigration` enqueues one SQS message per non-migrated user → `bulkMigrationConsumer` invokes the orchestrator. Details: `docs/migration/migration.md`.
