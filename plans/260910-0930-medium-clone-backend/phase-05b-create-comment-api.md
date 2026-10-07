# Phase 05B — Create Comment API

## Context Links

- [Phase 05 comment stack](./phase-05-comments.md)
- [Phase 05A schema foundation](./phase-05a-comment-schema.md)
- [Evidence artifacts](./evidence/phase-05b/)
- [Hurl comment contract](../../spec/api/hurl/comments.hurl)
- [Static OpenAPI contract](../../spec/api/openapi.yml)

## Overview

- Priority: P1 · Status: complete; ready PR #61.
- Base: Phase 05A PR #60.
- Scope: authenticated `POST /api/articles/:slug/comments` only. Do not add comment list or delete routes.
- Success: return HTTP 201 with `{ comment }` from the shared serializer and persist the comment atomically.

## Requirements and Decisions

- Require a valid authenticated user token; set author from the token user, never from request input.
- Require comment body; trim surrounding whitespace, reject empty/whitespace-only content, and cap the trimmed value at 10,000 characters. Validation failures return 422.
- Unknown article slug returns 404. Persistence failures map to the documented generic 500 error response.
- Lock the article row and insert the comment within one transaction so article deletion cannot race the insert. Keep the transaction-scoped repository access in the manager transaction.
- Serialize only the public comment fields using the shared serializer; return 201.
- OpenAPI documents authentication, request maxLength 10000, and 201/401/404/422/500 responses. No GET or DELETE comment route is added.

## Validation Record

- `pnpm test`: exit 0; 202 passed, 1 skipped.
- `pnpm test:e2e`: exit 0; 101 passed.
- `pnpm build`: exit 0.
- `pnpm lint`: exit 0; 275 warnings, 0 errors.
- `pnpm exec sunlint --all --input=src/comments`: exit 0; seven heuristic warnings, 0 errors. C033 x3 flags transaction-scoped TypeORM repositories needed for atomic locking and insert; C018 x3 flags the typed persistence-error wrapper; S037 x1 misses explicit `Cache-Control`, `Pragma`, and `Expires` decorators. These were reviewed and recorded as false positives for this implementation.
- Static OpenAPI YAML parse: passed; includes the 500 response and matching generic error example.
- Hurl CLI unavailable in the environment; equivalent request, auth, validation, and persistence scenarios passed in the E2E suite.
- Real HTTP 201 response captured at [response JSON](./evidence/phase-05b/post-comment-response.json) and [screenshot](./evidence/phase-05b/post-comment-response.png). Test fixtures were removed and database cleanup verified.
- Independent review: score 9, `SEALED`, no findings. [Verdict](./evidence/phase-05b/inspection-verdict.json).
- Hard evidence gate: `SEALED`; [machine-readable test and check results](./evidence/phase-05b/temper-results.json) and [study context](./evidence/phase-05b/study-context.json).

## Todo List

- [x] Implement the single POST endpoint with auth, validation, transaction, and shared serialization.
- [x] Pass unit, E2E, build, lint, OpenAPI, and evidence checks; document accepted lint heuristics.
- [x] Capture a real HTTP 201 response and verify fixture cleanup.
- [x] Complete independent review and hard evidence gate.
- [x] Submit ready PR #61 directly on PR #60 and add its [validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/61#issuecomment-5881610776).

## Success Criteria

- Authenticated create trims and persists valid input, uses the token user as author, and returns the documented 201 envelope.
- Missing/invalid auth, unknown article, blank/oversized body, and client-supplied author identity are rejected without a comment write.
- Production changes stay scoped to this endpoint and fit the PR line limit; no list/delete route is introduced.

## Risks

- Article deletion racing comment creation: transaction-scoped row lock and insert preserve the atomic boundary.
- Lint heuristic warnings: seven targeted warnings are explicitly documented above; no error-level finding remains.

## Next Steps

- PR #61 is ready on PR #60. Branch 5C directly from this PR for `GET /api/articles/:slug/comments`.
