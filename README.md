# petlink-everywhere-test

**Integration test suite** for the Petlink/Kippy GPS pet tracking system.

Validates the critical cross-service flows that power the application: from user onboarding through device activation, payment processing, real-time GPS tracking, and customer support operations.

---

## 🎯 What This Is

**Petlink/Kippy** is a GPS pet tracking platform where users register their pets, activate GPS collars, purchase subscriptions, and monitor their pets in real-time through mobile apps.

**This test suite** validates that backend services integrate correctly:
- Core API ↔ Subscriptions Manager ↔ Chargebee webhooks
- Sentinel TCP server ↔ Lambda consumers ↔ SQS queues
- GraphQL mutations ↔ WebSocket subscriptions ↔ real-time updates
- Authentication flow ↔ Cognito ↔ user management
- External integrations with Twilio (SMS), SendGrid (email), MongoDB

**Why integration tests?** The system involves backend services communicating via GraphQL/SQS, GPS devices connecting via TCP, payment webhooks from Chargebee, and real-time updates through WebSocket. Unit tests can't catch failures at service boundaries. These tests validate that all components work together for complete user scenarios.

**Multi-brand**: Tests run against both PETLINK (US market) and KIPPY (EU market) with brand-specific fixtures and features.

---

## 🏗️ Architecture Overview

**Quick summary**: This suite tests a distributed system with:
- **Mobile apps** (Flutter) → **AppSync GraphQL** → **Lambda services** → **MongoDB**
- **GPS devices** → **Sentinel (Rust TCP)** → **SQS queues** → **Lambda consumers**
- **Payment processing** via Chargebee webhooks

**Full system architecture**: See [📘 Architecture Docs](docs/petlink-infrastructure.md) for complete diagrams, data flows, and component details.

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
yarn install
```


### 2. Generate SDK from GraphQL schemas

This suite uses **auto-generated TypeScript clients**. Generate them before running tests:

```bash
- yarn fetch-schema   # Downloads schemas from Core/CCT APIs
- #add manual query/mutations inside src/clients/.../operations/*.graphql
- yarn generate-sdk   # Generates typed methods
```


### 3. Configure environment

Create `.env.develop` or `.env.test` with required variables (see `vitest.config.ts` for full list):

```bash
# Core API
CORE_GRAPHQL_API_URL=https://...
CORE_GRAPHQL_API_KEY=...

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# External services
TWILIO_ACCOUNT_SID=...
GMAIL_CLIENT_ID=...

# Brand selection
APP_BRAND=KIPPY  # or PETLINK
```

### 4. Run tests

```bash
# Run all tests on develop environment
yarn test

# Specific environment
TEST_ENV=develop yarn test
TEST_ENV=test yarn test

# Full pipeline (fetch schemas + generate SDK + test)
yarn pipeline:develop
```

---

## 📝 Writing Tests

Tests follow **user-centric flows** using a builder pattern. See `.cursorrules` for detailed guidelines.

**Example**:

```typescript
describe("Subscription Purchase", () => {
  let setup: TestSetup;

  beforeAll(async () => {
    setup = await testHelper.setupBuilder()
      .withUser()
      .withDog()
      .withDogDevice()
      .withSubscription()
      .build();
  });

  it("should activate device after purchase", async () => {
    const device = setup.devices.dogStandard;
    expect(device.subscriptionActive).toBe(true);
  });
});
```

**Key principles**:
- Use `testHelper.setupBuilder()` for entity creation
- Define explicit payloads (no spread operators)
- Follow mandatory status code assertion format
- Log business flow with `logger.info()`

---

## 📚 Documentation

Comprehensive documentation for the entire Petlink/Kippy system:

### Core Concepts
- **[🏗️ Architecture Overview](docs/petlink-infrastructure.md)** - System architecture, components, data flows

### User Flows
- **[👤 User Registration](docs/registration/registration-user.md)** - Sign-up with phone/email OTP verification
- **[🐕 Pet Registration](docs/registration/registration-pet.md)** - Pet profile creation
- **[📡 Device Registration](docs/registration/registration-petlinkGPS.md)** - Device setup and assignment
- **[🔐 Credentials Management](docs/registration/user-credentials-management.md)** - Password reset, contact changes

### Tracking Modes
- **[📍 Live Tracking](docs/modes/mode-live-tracking.md)** - Real-time 5-second updates via WebSocket
- **[🚧 Geofence](docs/modes/mode-geofence.md)** - Zone-based alerts (safe zones, danger zones)
- **[🔋 Energy Saving](docs/modes/mode-energy-saving-zone.md)** - Battery optimization in known zones

**👉 Start here**: Read [Architecture Overview](docs/petlink-infrastructure.md) to understand the system before writing tests.

---

## 🔧 How It Works

### Test Architecture

```
testHelper.setupBuilder()
  ├─ Creates entities in correct order (User → Pet → Device → Subscription)
  ├─ Uses parallel operations where possible (pets, devices)
  └─ Returns TestSetup with all created entities

petlink.core.graphql.authJwt.createPet(...)
  ├─ Authenticates via Cognito (cached JWT)
  ├─ Calls AppSync GraphQL endpoint
  ├─ Logs request/response automatically
  └─ Tracks performance metrics
```

### SDK Generation Workflow

The test client uses auto-generated TypeScript from GraphQL schemas:

```
1. fetch-schema    → Downloads GraphQL schemas from Core/CCT APIs
2. write operation → Add query/mutation in operations/*.graphql (manual)
3. generate-sdk    → Codegen creates typed TypeScript methods
4. use in tests    → petlink.core.graphql.authJwt.createPet(...)
```

**Example - Adding a new mutation**:

```graphql
// Add to: src/clients/.../operations/core/mutations.graphql
mutation CreatePet($pet: PetIn!) {
  createPet(pet: $pet) {
    code
    message
    pet { id name species }
  }
}
```

```bash
yarn generate-sdk  # Regenerate typed SDK
```

```typescript
// Now fully typed in tests
const response = await petlink.core.graphql.authJwt.createPet({ 
  pet: petPayload 
});
```

**Generated SDK location**: `src/clients/petlink-infrastructure/endpoints/graphql/generated/`

### Cleanup Strategy

Tests run with `cleanupAll()` in `beforeAll` (not `afterAll`) to:
- Ensure fresh state before each test file
- Allow manual DB inspection after failures
- Clean: MongoDB users/pets/devices, Gmail inbox, Twilio SMS, Sentinel DB

---

## 🎭 Brand Testing

The system supports two brands with different markets:

| Brand | Market | Devices | Special Features |
|-------|--------|---------|------------------|
| **PETLINK** | US | Dog, Cat | Standard subscriptions |
| **KIPPY** | EU (IT) | Dog, Cat, EVO | + Device protection addon<br/>+ Pet insurance (IT only) |

**Brand selection**: Set `APP_BRAND=KIPPY` or `APP_BRAND=PETLINK` in env.

**Fixtures adapt automatically**: `fxt.current` provides brand-specific data (countryCode, languageId, device serials).

---

## 📊 Test Reports

After running tests, check `test-reports/`:

- `index.html` - Interactive HTML report (open in browser)
- `junit.xml` - CI/CD integration (GitHub Actions annotations)

---

## 🐛 Troubleshooting

**Tests fail with auth errors**:
- Check Cognito credentials in env
- Verify JWT token hasn't expired
- Run `petlink.logoutUser()` to clear cached tokens

**OTP/SMS not received**:
- Verify Twilio credentials
- Check phone number is whitelisted for test environment
- Twilio delays can reach 30-60 seconds

**Subscription webhook timeout**:
- Chargebee webhooks are async (can take 10-20 seconds)
- Tests use polling with 30s timeout
- Check Chargebee dashboard for webhook delivery status

**Schema generation fails**:
- Verify API keys and endpoints in env
- Check network access to GraphQL endpoints
- Run with `DEBUG=* yarn fetch-schema` for detailed logs

---

## 🤝 Contributing

See `.cursorrules` for:
- Test writing philosophy (user-centric flows)
- Coding standards (TypeScript best practices)
- Logging strategy (info for tests, debug for clients)
- Anti-patterns to avoid

---

## 📦 Project Structure

```
petlink-everywhere-test/
├── src/
│   ├── clients/           # API clients (Core, CCT, Gmail, Twilio, Sentinel)
│   ├── tests/             # Test suites (user/, cct/, debug/)
│   ├── fixtures/          # Test data (brand-specific)
│   ├── helpers/           # Utilities (performance tracking, waitFor)
│   └── config/            # Setup/teardown, logger
├── docs/                  # Architecture and flow documentation
├── test-reports/          # Generated after test runs
└── .cursorrules           # Test writing guidelines (read this!)
```
