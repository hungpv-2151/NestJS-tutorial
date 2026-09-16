# Required database validation

- `pnpm lint`: PASS (SunLint, all checks passed; ESLint emitted only the existing missing-config warning).
- `pnpm build`: PASS (`nest build`, exit 0).
- `pnpm test:cov`: PASS, 3 files / 21 tests; 98.18% statements/lines, 94.59% branches, 100% functions.
- `pnpm test:e2e`: PASS, 1 file / 6 tests using `TEST_DATABASE_URL`.
- `isDatabaseEnabled` and `DATABASE_ENABLED`: no matches in tracked source/config/example/test paths.
- Staged files/secrets: no staged files; no tracked dotenv secret file detected.
- Test database configuration: `getTestDatabaseConfig` requires `TEST_DATABASE_URL` and validates that it is a PostgreSQL URL. The former host/database allowlist guard was removed to keep configuration minimal.

Non-blocking warning: the PostgreSQL driver emits a warning that `sslmode=require` semantics will change in a future driver major version; this is from the supplied connection URL/dependency and did not fail the suite.
