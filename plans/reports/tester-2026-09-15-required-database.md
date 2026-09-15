# Required database validation

- `pnpm lint`: PASS (SunLint, all checks passed; ESLint emitted only the existing missing-config warning).
- `pnpm build`: PASS (`nest build`, exit 0).
- `pnpm test:cov`: PASS, 3 files / 23 tests; 97.10% statements/lines, 93.02% branches, 100% functions.
- `pnpm test:e2e`: PASS, 1 file / 6 tests; connected to the configured allowlisted Neon test database.
- `isDatabaseEnabled` and `DATABASE_ENABLED`: no matches in tracked source/config/example/test paths.
- Staged files/secrets: no staged files; no tracked dotenv secret file detected.
- Test database guard: `getTestDatabaseConfig` requires `TEST_DATABASE_ALLOWED_HOSTS` and `TEST_DATABASE_ALLOWED_NAMES`, then rejects mismatched host and database name; unit tests cover both rejection paths and missing allowlists. Current local test target resolves to the configured host/database and is accepted.

Non-blocking warning: the PostgreSQL driver emits a warning that `sslmode=require` semantics will change in a future driver major version; this is from the supplied connection URL/dependency and did not fail the suite.
