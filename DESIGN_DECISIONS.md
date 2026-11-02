# Why this repo exists — design rationale & known trade-offs

This file explains **why** the suite is built the way it is. The **how** is in the code and in `AGENTS.md`.
Read this before changing the test approach: every limitation below was a deliberate trade-off, not an oversight.

## 1. The problem

The backend is heavily serverless and distributed: GraphQL (AppSync), Lambda consumers, SQS queues, Cognito, Chargebee webhooks, and a raw-TCP service (Sentinel) talking to physical GPS devices. None of this is meaningfully testable locally, and no single service repo can host tests that span all of them.

## 2. The decision

A fully external, **black-box** suite that:

- emulates the **app** → calls the real GraphQL APIs (Cognito auth included)
- emulates the **device** → speaks raw TCP to Sentinel using a reverse-engineered protocol (`src/clients/petlink-infrastructure/packets-sentinel/packets.ts`)
- exercises the **real deployed environment**: SQS, webhooks, MongoDB, Chargebee, Twilio, Gmail — all layers in between included

### What this buys (the pros)

- Tests validate the system users actually use: service boundaries, contracts, async flows, infra included.
- No mocks to maintain: when the suite is green, the flow really works end-to-end.
- Survives internal refactors: tests only depend on public contracts (GraphQL schema, TCP protocol, webhook payloads).
- Catches cross-service desync that per-service unit tests cannot see (e.g. Chargebee webhook → SQS → consumer).
- Doubles as executable documentation of the business flows.

### Alternatives considered and rejected

- **Per-service integration tests** → cannot cover the seams between services, which is where the real bugs live.
- **Local emulation of AppSync/Cognito/Chargebee** → costly, fragile, and drifts away from the real environment.
- **Contract tests with mocked sides** → they would test the mocks, not the system.

## 3. Known limits — and how much they actually matter

### 3.1 The device is emulated

- **WHY**: physical devices cannot run in CI, so the Sentinel protocol was reverse-engineered into `packets.ts`.
- **RISK**: if firmware or the protocol changes, `packets.ts` must be updated by hand or device tests fail.
- **IMPACT — low in practice**: the protocol is stable; historically the direction is "we adapt to it", not vice versa. If device tests fail right after a Sentinel/firmware release → check `packets.ts` first.

### 3.2 Residue can survive between runs

- **WHY**: tests perform *real* registrations → real users in MongoDB, real subscriptions in Chargebee, real emails and SMS. `cleanupAll()` is inherently tricky and can leave residue that breaks the next run.
- **IMPACT — medium, manageable**: these failures mean stale env state, not product bugs.
- **DEBUG**: look at Grafana logs, Chargebee state and MongoDB docs directly. The MCP integrations (mongo / chargebee / grafana) make AI-assisted debugging of "what happened behind the scenes" much faster.

### 3.3 No parallelism

- **Across environments — fixable**: signup uses a fixed email and phone number, and cleanup wipes received mail/SMS → runs on different envs sharing the same mailbox/number step on each other. We never found a free provider for runtime-created addresses/numbers. A second email + a second phone number would make `develop`/`test` runs 100% parallel — the problem disappears entirely.
- **Within one environment — accepted trade-off, hard to fix**: all tests intentionally share the same fixtures and mocked devices, so they run sequentially by design. The suite trades speed for a much easier e2e debugging experience (one known state at a time).

### 3.4 The suite always lags the code it tests

- **WHY**: tests live outside the services they test → backend/test sync relies on discipline (whoever changes the BE must also commit the matching test change here).
- **IMPACT — structural, real**: expect desync windows after every backend change until tests catch up.
- **REAL FIX**: a monorepo of the BE microservices (versioned together, deployed separately) would let code + tests ship in the same commit/branch. Anything short of that is a process workaround.

### 3.5 Real third parties → slow and occasionally flaky

- **WHY**: real OTP via real email/SMS, real Chargebee processing → suite speed is bounded by external delivery, and failures can come from outside our code (delivery latency, rate limits).
- **MITIGATION**: `waitFor`/retry helpers absorb most of it; check Grafana logs before suspecting the product.

## 4. If you inherit this repo — the one-line version

A **green** run means the whole system works end-to-end. On a **red** run, suspect env residue or `packets.ts` drift before suspecting the product.

