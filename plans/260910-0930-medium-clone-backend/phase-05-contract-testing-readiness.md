# Phase 05 — Contract testing and readiness

## Context Links

- [Hurl runner](../../spec/api/run-api-tests-hurl.sh) · [API README](../../spec/api/README.md) · [Vitest E2E setup](../../test/app.e2e-spec.ts) · [contract-risk research](../reports/researcher-260910-0930-api-contract-risks.md)

## Overview

- Priority: P1 · Status: Pending
- Prove the integrated API against unit, Nest E2E and Hurl contract tests, then record the delivered architecture/docs.

## Key Insights

- Hurl is sequential but Vitest files may parallelize: test database/schema isolation must not rely on cleanup at test end.
- The supplied Hurl suite is source of truth, but misses invalid optional token/empty wrapper/idempotency repetitions; add regression tests for those gaps.

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

- [ ] Test isolation survives parallel Vitest execution.
- [ ] Full Hurl suite passes from clean migrated database.
- [ ] Compile/lint/unit/E2E gates pass with recorded commands.
- [ ] Docs reflect verified implementation, not planned claims.

## Success Criteria

- All four project gates and all Hurl files return zero; no credentials/tokens appear in output or committed files.

## Risk Assessment

- Missing Hurl binary/DB service is environment setup, not a reason to bypass acceptance; document exact prerequisite and fail visibly.

## Security Considerations

- Test config uses separate least-privilege credentials; logs redact Authorization and sensitive payload fields.

## Next Steps

- Hand completed code to tester and reviewer, then use the delivery tracker to sync plan/docs status.
