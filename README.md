# petlink-everywhere-test

End-to-end/integration tests for the Petlink system.

## Workflow

1. **Fetch schema**: Downloads GraphQL schemas from endpoints (CORE and CCT)
2. **Write operations**: Define queries/mutations in `src/clients/petlink-infrastructure/endpoints/graphql/operations/`
3. **Generate SDK**: Generates typed TypeScript SDK from schemas and operations
4. **Run tests**: Uses the generated SDK for tests

## Setup

```bash
yarn install
```

Configure environment variables in `.env.develop` or `.env.test` (see `vitest.config.ts` for the complete list).

## Brand (KIPPY/PETLINK)

The `APP_BRAND` variable (KIPPY or PETLINK) determines which brand to test. Fixtures are centralized and adapt dynamically: common data (user, pet) + brand-specific data (city, countryCode, languageId, device serialNumbers). Use `fxt.current` in tests to access the current brand's data.

## Scripts

- `yarn codegen` - Fetch schema + generate SDK
- `yarn test` - Run all tests
- `yarn pipeline:develop` - Codegen + test on develop
- `yarn pipeline:test` - Codegen + test on test

## Execution

```bash
# Default: develop
yarn test

# Specific environment
TEST_ENV=develop yarn test
TEST_ENV=test yarn test
```

## Documentation

See `docs/` for details on registration, modes, and subscriptions.
