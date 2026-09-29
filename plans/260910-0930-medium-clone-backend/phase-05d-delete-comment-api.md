# Phase 05D — Delete Comment API

## Context Links

- [Phase 05 comment stack](./phase-05-comments.md)
- [Phase 05C list API](./phase-05c-list-comments-api.md)
- [Comment request/error contract](../../spec/api/hurl/comments.hurl) · [errors](../../spec/api/hurl/errors_comments.hurl)
- [Static OpenAPI contract](../../spec/api/openapi.yml)

## Overview

- Priority: P1 · Status: complete; ready PR #63 · Base: Phase 05C PR #62.
- Scope: authenticated `DELETE /api/articles/:slug/comments/:id` only.
- Success: owner deletion returns an empty 204 response and removes only the target comment.

## Key Insights and Requirements

- Resolve the article first; unknown slug returns 404 `{ errors: { article: ['not found'] } }`.
- Find the comment by both ID and article ID; missing ID or comment under another article returns 404 `{ errors: { comment: ['not found'] } }`.
- Require a valid authenticated user; reject non-owners with 403 `{ errors: { comment: ['forbidden'] } }` without mutation.
- Reject a non-integer path ID with 422 `{ errors: { id: ['must be an integer'] } }`.
- Return 204 with no body on success; map persistence failures to generic 500 `{ errors: { body: ['request failed'] } }`.
- Lock article, then the scoped comment, and delete in one transaction to preserve article/comment ownership and cascade ordering.
- Keep Swagger and static OpenAPI aligned; no create/list behavior changes.

## Architecture and Data Flow

`route + AuthTokenGuard + parsed id → CommentDeleteController → CommentDeleteService → transaction-scoped User/Article/Comment repositories → 204`.

## Related Code Files

- Modify: `src/comments/comments.controller.ts`, `src/comments/comments.module.ts`, `src/comments/comments.swagger.ts`, `spec/api/openapi.yml`, `spec/api/hurl/errors_comments.hurl`.
- Create: `src/comments/comment-delete.service.ts`, focused E2E tests for success, authorization, not found, validation and persistence.

## Implementation Steps and Todo List

- [x] Add failing E2E coverage for owner 204, selective persistence, missing/invalid auth, non-owner 403 with no mutation, unknown article, unknown/wrong-article comment, invalid ID 422 and generic 500.
- [x] Implement transactional delete, typed errors, controller mapping and Swagger/OpenAPI/Hurl alignment.
- [x] Pass focused and full unit/E2E, build, lint, static OpenAPI, formatter and diff checks; explain warning heuristics.
- [x] Capture actual HTTP 204/verification evidence, seal independent review and hard evidence gate.
- [x] Create ready [PR #63](https://github.com/hungpv-2151/NestJS-tutorial/pull/63) stacked on #62; [validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/63#issuecomment-5882455254).

## Validation

- RED-first focused E2E failed before implementation because DELETE was not registered; final focused E2E passed 6 tests. Full E2E passed 30 files / 111 tests; unit passed 202 / 1 skipped; build passed; lint exited 0 with 299 warnings and 0 errors.
- Static OpenAPI parse, Prettier, and `git diff --check` passed. Hurl CLI is unavailable; existing Hurl authorization cases were inspected and E2E exercises persistence failure.
- Targeted SunLint: 31 warnings / 0 errors, 12 new heuristics (C018 x7, C030 x1, C033 x3, S037 x1); rationale is recorded in `evidence/phase-05d/temper-results.json`.
- Independent review: **SEALED**, no findings. Hard evidence gate: **SEALED**.
- Captured actual HTTP 204 and database state: [response evidence](./evidence/phase-05d/delete-comment-result.json) · [screenshot](./evidence/phase-05d/delete-comment-result.png).

## Success Criteria, Risks and Security

- Create → list → delete → list proves only the selected comment is removed; failed authorization and not-found cases leave comments unchanged.
- Article lock precedes comment lock, matching article deletion lock order and reducing delete/cascade races.
- The token subject supplies user identity; never accept author identity from the client. Scope all comment reads/deletes by article ID.

## Next Steps

- Phase 06 starts after ready PR 5D and Phase 05 evidence is recorded.


- Final validated PR head before plan-reference sync: `0126199be18f52c02d653e52881385a6f4f9ae2b`. PR #63 is open, ready, and stacked directly on PR #62.
