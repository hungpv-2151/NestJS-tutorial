# RealWorld API Spec

## Running API tests locally

### With Hurl

To locally run the provided [Hurl](https://hurl.dev) collection against your backend, execute:

```
HOST=http://localhost:3000 pnpm exec bash ./run-api-tests-hurl.sh
```

For more details, see [`run-api-tests-hurl.sh`](run-api-tests-hurl.sh).

### With Bruno

A [Bruno](https://www.usebruno.com) collection is also available, automatically generated from the Hurl test suite. To run it:

```
HOST=http://localhost:3000 ./run-api-tests-bruno.sh
```

For more details, see [`run-api-tests-bruno.sh`](run-api-tests-bruno.sh).

You can also open the `bruno/` folder directly in the Bruno app to run and inspect requests interactively.

> **Note:** The Hurl files are the source of truth. The Bruno collection is generated with `make bruno-generate` and kept in sync via CI (`make bruno-check`).

### Isolated contract run

`pnpm run test:contract` uses `TEST_DATABASE_URL` only. It deploys migrations, starts
the compiled API, waits for `/api/health/readiness`, runs Hurl sequentially, and stops
the API on success or failure. `pnpm install` provides the pinned Hurl runner.

Browser specs under `spec/e2e/` are intentionally excluded from Vitest. They require
their own Playwright runner and its `@playwright/test` dependency; they are not API
contract tests and must not be silently collected by `pnpm run test`.
