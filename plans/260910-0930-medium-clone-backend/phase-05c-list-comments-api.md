# Phase 05C — List Comments API

## Context Links

- [Phase 05 comment stack](./phase-05-comments.md)
- [Phase 05B create API](./phase-05b-create-comment-api.md)
- [Evidence artifacts](./evidence/phase-05c/)
- [Hurl comments contract](../../spec/api/hurl/comments.hurl)
- [Hurl comment errors](../../spec/api/hurl/errors_comments.hurl)
- [Static OpenAPI contract](../../spec/api/openapi.yml)

## Overview

- Priority: P1 · Status: complete; ready PR #62.
- Base: Phase 05B PR #61.
- Scope: public `GET /api/articles/:slug/comments` only. No schema changes or other public API.
- Branch: `phase-05c-list-comments`.
- Success: return `{ comments }` in stable order with public author fields and viewer-specific following state.

## Requirements and Decisions

- Allow anonymous access and optional valid `Authorization: Token <jwt>`; reject malformed or invalid supplied tokens with 401.
- Return 404 for unknown article slug; map persistence failures to the documented generic 500 response.
- Order comments by `createdAt ASC, id ASC`.
- Set `author.following` to false anonymously; for authenticated viewers, resolve follows in one batched lookup, not one query per comment.
- Expose only public comment and author fields; never return author ID, email, or password hash.
- Read article existence and comments in one `REPEATABLE READ` transaction so concurrent article deletion cannot mix snapshots.
- Document optional authentication, 200, 401, 404 and 500 in generated Swagger and static OpenAPI. Keep POST behavior intact.

## Validation Record

- `pnpm test:e2e`: exit 0; 28 files, 105 tests passed.
- `pnpm test`: exit 0; 47 files, 202 passed, 1 skipped.
- `pnpm build`: exit 0.
- `pnpm lint`: exit 0; 287 warnings, 0 errors.
- `pnpm exec sunlint --all --input=src/comments`: exit 0; 19 warnings, 0 errors. Existing create-comment code accounts for 6 C018/C033 warnings. New list code has 6 C018 findings for wrapping persistence errors into the documented generic HTTP error, 1 C030 finding for rethrowing the typed article-not-found error, and 4 C033 findings for transaction-scoped TypeORM access required to read article/comments from one snapshot and batch the follow lookup. S037 misses the explicit `Cache-Control`, `Pragma`, and `Expires` anti-cache decorators. These are documented heuristic findings; no error-level finding remains. Recheck these rules when the code path or analyzer changes.
- Static OpenAPI YAML parse: exit 0.
- Prettier check for changed TypeScript and `spec/api/openapi.yml`: exit 0. Hurl is not a supported Prettier format.
- `git diff --check`: exit 0.
- Real HTTP 200 response and fixture cleanup: passed; [response JSON](./evidence/phase-05c/list-comments-response.json) and [screenshot](./evidence/phase-05c/list-comments-response.png). The temporary capture test was removed.
- Independent review: score 9, `SEALED`, no findings. [Verdict](./evidence/phase-05c/inspection-verdict.json).
- Hard evidence gate: `SEALED`; [machine-readable check results](./evidence/phase-05c/temper-results.json) and [study context](./evidence/phase-05c/study-context.json).
- Hurl CLI evidence: no Hurl run is recorded for this phase; equivalent contract scenarios are covered by the passing E2E suite.
- PR: [#62](https://github.com/hungpv-2151/NestJS-tutorial/pull/62), ready on PR #61; latest head SHA is recorded in its validation comment.
- Validation comment: [PR #62 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/62#issuecomment-5882131176), with screenshot attachment.

## Todo List

- [x] Implement the single GET endpoint with optional authentication, stable ordering, batched follow state and consistent snapshot reads.
- [x] Pass unit, E2E, build, lint, OpenAPI, formatting and diff checks; document accepted heuristic warnings.
- [x] Capture actual HTTP 200 response and verify temporary fixture cleanup.
- [x] Complete independent review and hard evidence gate.
- [x] Submit ready PR #62 directly on PR #61 and add the validation comment with results, commit SHA and screenshot.

## Success Criteria

- Anonymous and authenticated list requests return the expected envelope and stable order; optional invalid tokens return 401 and missing articles return 404.
- Following state matches the viewer with a batched lookup; no internal author fields leak.
- Article and comment reads share a consistent snapshot; persistence errors use the generic response.
- Production change is scoped to this API and within the 400 changed-line hard limit.

## Risks

- Concurrent article deletion could otherwise yield an inconsistent response; `REPEATABLE READ` transaction keeps article and comments reads on one snapshot.
- Analyzer heuristics can obscure operationally meaningful warnings; retain the rule-by-rule rationale above and re-evaluate if the typed-error flow, transaction access, or anti-cache decorators change.

## Security Considerations

- Treat authentication as optional while rejecting invalid credentials when supplied.
- Serialize only public author properties and prevent caching of personalized responses with explicit anti-cache headers.

## Next Steps

- PR #62 is ready on PR #61. Branch 5D directly from this PR for `DELETE /api/articles/:slug/comments/:id`.
