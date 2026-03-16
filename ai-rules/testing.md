---
trigger: model_decision
description: Apply when writing, debugging, or executing Vitest integration tests in the petlink-everywhere-test repository.
globs: 
---

# Testing Philosophy & Guide

## Test Philosophy: User-Centric Flows
Our tests validate the system through **end-to-end user journeys**, not isolated technical layers.

**Core Entity Flow**: The system follows a clear entity sequence. Tests must respect this dependency:
1.  **User**: A user is created first.
2.  **Pet**: A pet is created and associated with a user.
3.  **Device**: A device is registered and associated with a pet.
4.  **Subscription**: A subscription is purchased to activate a device.
5.  **Activities**: Now activities of pet (through device) can be tracked.

Tests are organized by actor (`user/`, `cct/`) and journey (`registration/`, `subscriptions/`, `commands/`, `mode/`, `eol/`).

## How to Write a Test

### Step 1: Setup with `TestSetupBuilder` in `beforeAll`
Use the `testHelper` builder to create a clean state before tests run. This is the **only** recommended way to set up test entities.

```typescript
import { describe, expect, it, beforeAll } from "vitest";

describe.sequential("User Subscription Purchase Flow", () => {
  let setup: TestSetup;

  beforeAll(async () => {
    // Build the necessary entities for this test flow
    setup = await testHelper.setupBuilder()
      .withUser()
      .withDog()
      .withDogDevice()
      .build();
  });
});
```
- **Clean First**: `cleanupAll()` runs *before* tests (as a config of setupFiles - beforeAll), ensuring a fresh start.
- **Use the Builder**: `.withUser()`, `.withDog()`, `.withCatDevice()`, etc. abstract away entity creation.

### Step 2: Define Explicit Payloads (No Spread Operator)
Define all API payloads by explicitly listing each required field. **Never use the spread operator (`...`) with fixtures.**

```typescript
import { fixtures } from "../../../fixtures/fixtures.js";
import type { PetIn } from "../../../generated/core_schema.js";

const catPayload: PetIn = {
  name: fixtures.pet.cat.name,
  species: fixtures.pet.cat.species,
  // ... and other required fields explicitly
};
```

### Step 3: Write Assertions
**Status Code Assertions (MANDATORY FORMAT)**: All API response code checks MUST follow this format. It provides essential debugging information directly in the test failure output.

```typescript
// ✅ CORRECT: For a success case
expect(
  response.createPet.code,
  `createPet should succeed - Error: ${response.createPet.message}${response.createPet.translationCode ? ` (${response.createPet.translationCode})` : ''}`
).toBe("200");

// ✅ CORRECT: For an expected failure case
expect(
  response.deletePet.code,
  `deletePet should fail - Error: ${response.deletePet.message}${response.createPet.translationCode ? ` (${response.createPet.translationCode})` : ''}`
).not.toBe("200");
```

## Core Principles & TypeScript Usage

- **Clients are the Interface**: Interact with the backend **only** through provided clients (`petlink`, `testHelper`, `sentinelTcpSocketClient`).
  - **GraphQL HTTP**: `petlink.core.graphqlHttp.authJwt.getUser()`, `petlink.core.graphqlHttp.authIam.utilityIntegrationTest()`
  - **GraphQL WebSocket**: `petlink.core.graphqlWS.authJwt.subscribeUntil(...)`
  - **Sentinel TCP**: `petlink.sentinel.connectAndHandshake(device)`
- **TypeScript Best Practices**:
  - Always Type Payloads (`as TypeName`).
  - Use Enums (e.g., `SpeciesEnum.DOG`), avoid raw strings.
- **Logging Strategy**:
  - **`logger.info()`** in tests: Log payloads before API calls, responses after.
  - **`logger.debug()`** in clients only: Low-level flow (auth, caching).
  - **`logger.error()`** in clients only: Actual failures (catch blocks, timeouts).

## Anti-Patterns to Avoid
1.  **❌ Don't use spread operators (`...fixtures`) for payloads.**
2.  **❌ Don't create opaque assertion helpers.** All `expect` statements must be visible.
3.  **❌ Don't bypass the clients.** Never make direct `fetch` or `axios` calls.
4.  **❌ Don't write silent `catch` blocks.** If an operation is expected to fail, assert the failure.

## GraphQL & Microservices Workflow

### Schema Source of Truth
- **Schemas**: Located in `src/clients/petlink-infrastructure/endpoints/graphql/schema/`.
- Verify fields against `.graphql` files.

### Adding New Operations
- **Location**: `src/clients/petlink-infrastructure/endpoints/graphql/operations/{microservice}/`.
- **Field Selection**: ALWAYS select ALL available fields defined in the schema to ensure SDK has full data availability.
- Run `yarn generate-sdk` after changes.

### Usage in Code/Tests
- **Strict Access Rule**: NEVER use `getSdk` directly in tests.
- **Facade**: ALWAYS access methods via the `petlink` singleton from `client-petlink-infrastructure.ts`.