# Phase 05 — Contract testing and readiness

## Context Links

- [Hurl runner](../../spec/api/run-api-tests-hurl.sh) · [API README](../../spec/api/README.md) · [Vitest E2E setup](../../test/app.e2e-spec.ts) · [contract-risk research](../reports/researcher-260910-0930-api-contract-risks.md)

## Overview

- Priority: P1 · Status: Complete (2026-09-11)
- Prove the integrated API against unit, Nest E2E and Hurl contract tests, then record the delivered architecture/docs.

## Key Insights

- Hurl is sequential but Vitest files may parallelize: the contract runner uses a dedicated migrated test database and generated run identifiers; isolation does not rely on cleanup at test end.
- The supplied Hurl suite remains the HTTP contract source of truth. Invalid optional token, empty-wrapper, idempotency, and token-version invalidation gaps are covered by live E2E regression tests.

## Requirements

- Run compilation, lint, unit/Vitest E2E and all `spec/api/hurl/*.hurl` against a fresh migrated test DB/process.
- Test expected responses, 401/403/404/409/422 envelopes, persistence and serialization, not internal implementation details.

## Architecture

`test bootstrap → dedicated DATABASE_URL → Prisma migrate deploy/reset → Nest process → bounded readiness poll → Hurl runner (jobs 1) → trap-based shutdown`. Unit tests mock repository seams only; integration uses PostgreSQL. CI never points at developer/production databases.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/app.e2e-spec.ts` — replace starter assertion with real bootstrap/shared helpers or retire it.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/helpers/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/contract-edge-cases.e2e-spec.ts` — isolated DB/app helpers and uncovered cases.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json` — deterministic test/migration/Hurl orchestration scripts.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/spec/api/README.md` — one origin-only Hurl command; never append `/api` to `HOST`.
- Modify after implementation: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/docs/development-roadmap.md`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/docs/project-changelog.md`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/docs/system-architecture.md`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/docs/code-standards.md` — actual delivered state only.

## Implementation Steps

1. Create reusable Vitest lifecycle that creates/cleans a dedicated migrated database or schema per worker and invokes the same extracted HTTP bootstrap as production; never share production credentials.
2. Add tests for error mapper, prefix, optional/protected auth, malformed/expired/forged/wrong-claim JWTs, throttling, ownership, size bounds, slug/tag edges, no-body list serializer, equal-timestamp page order/count and concurrent relation/delete races.
3. Add one orchestration script: migrate before launch, capture PID, poll readiness with bounded timeout, run `HOST=http://localhost:<port> ./spec/api/run-api-tests-hurl.sh` where HOST is origin only, and stop the process through `trap` on every exit path.
4. Execute `pnpm run build`, `pnpm run lint`, `pnpm run test`, `pnpm run test:e2e`, and the Hurl command. Fix real failures; do not weaken assertions.
5. Review final diff, update required project documentation based on shipped behavior, and record any explicit deviations from OpenAPI/Hurl.

## Todo List

- [x] Test isolation survives parallel Vitest execution.
- [x] Full Hurl suite passes from clean migrated database.
- [x] Compile/lint/unit/E2E gates pass with recorded commands.
- [x] Docs and plan artifacts reflect verified implementation, not planned claims.

## Success Criteria

- All four project gates and all Hurl files return zero; no credentials/tokens appear in output or committed files.

## Final Verification — 2026-09-11

- `pnpm run build` — exit 0; Nest compilation passed.
- `pnpm run lint` — exit 0; 39 source files, 0 errors, 63 warnings.
- `pnpm run test` — exit 0; 4 files, 10/10 tests passed.
- `pnpm run test:e2e` — exit 0; 8 files, 30/30 live API tests passed.
- `pnpm run test:contract` — first attempt exposed a transient Prisma P1002 advisory-lock timeout; retry passed after the database lock cleared.
- Hurl acceptance — 13/13 files and 154/154 requests passed with `--jobs 1` against a clean migrated test database; the runner readiness poll and idempotent signal-safe shutdown were reviewed and sealed.
- No credentials or token values were printed or committed. Browser Playwright suites remain intentionally outside this API gate.

### Explicit token invalidation fixture decision

No additional Hurl fixture was added for password-update token invalidation. The behavior is already asserted end-to-end in `test/auth.e2e-spec.ts` (old token returns 401, new password login succeeds, and a fresh token is issued). Hurl remains focused on the published HTTP contract fixtures; the live E2E suite owns this stateful token-version regression.

## Risk Assessment

- Missing Hurl binary/DB service is environment setup, not a reason to bypass acceptance; document exact prerequisite and fail visibly.

## Security Considerations

- Test config uses separate least-privilege credentials; logs redact Authorization and sensitive payload fields.

## Next Steps

- Hand completed code to tester and reviewer, then use the delivery tracker to sync plan/docs status.
