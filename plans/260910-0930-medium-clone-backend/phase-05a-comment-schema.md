# Phase 05A — Comment Schema Foundation

## Context Links

- [Phase 05 comment stack](./phase-05-comments.md)
- [Evidence artifacts](./evidence/phase-05a/)
- [Comment OpenAPI schema](../../spec/api/openapi.yml)

## Overview

- Priority: P1 · Status: complete; ready PR #60 · Base: Phase 04K / PR #59
- Add the comment persistence schema and shared serializer. `Public API change: none`.

## Scope and Architecture

- Reversible comments migration and TypeORM entity with integer identity ID, required body/article/author fields, cascading article and author foreign keys, timestamps, and article/creation/id index.
- Shared serializer exposes only OpenAPI comment fields and public author profile fields; the caller supplies following state.
- Do not add a controller, route, or API behavior. 5B–5D own the three comment APIs separately.

## Validation Record

- Applied and inspected the migration on `TEST_DATABASE_URL`, then reverted it successfully; `.env` and the regular `DATABASE_URL` were unchanged.
- `pnpm test`: passed, 45 files; 197 passed, 1 skipped.
- `pnpm test:e2e`: passed, 25 files; 98 passed.
- `pnpm build`: passed.
- `pnpm lint`: passed, 268 warnings and 0 errors. One S012 warning on fixed `CREATE INDEX` SQL is a false positive; the literal contains no credentials.
- Independent inspection verdict: `SEALED`, score 9, no findings.
- Hard evidence gate: `SEALED`; migration apply/revert screenshot and machine-readable test, build, lint, migration, study, and inspection records are in [phase-05a evidence](./evidence/phase-05a/).
- `git diff --check`: passed for this tracking update.

## Todo List

- [x] Implement the comment schema, migration, and shared serializer without an HTTP route.
- [x] Apply, inspect, and revert the migration using `TEST_DATABASE_URL`.
- [x] Pass unit, E2E, build, and lint checks; record the reviewer verdict and hard-gate evidence.
- [x] Submit ready PR #60 on PR #59 and add its validation comment.

## Success Criteria

- Migration applies and reverts cleanly; entity constraints and serializer contract match the spec.
- No comment HTTP API is introduced; production code stays within the file-size and changed-line limits.
- PR contains only the 5A foundation scope and declares `Public API change: none`.

## Next Steps

- PR #60 is ready on PR #59. PR #61 implements `POST /api/articles/:slug/comments`.
## Delivery Record

- PR: [#60](https://github.com/hungpv-2151/NestJS-tutorial/pull/60), ready, stacked on #59.
- Validation comment: https://github.com/hungpv-2151/NestJS-tutorial/pull/60#issuecomment-5881124944
