# Phase 04J — Unfavorite Article API

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md) · [Phase 04I favorite](./phase-04i-favorite-article-api.md) · [OpenAPI](../../spec/api/openapi.yml) · [favorites Hurl](../../spec/api/hurl/favorites.hurl)

## Overview

- Priority: P1 · Status: In progress · Dependency: ready [PR #57](https://github.com/hungpv-2151/NestJS-tutorial/pull/57). Add only `DELETE /api/articles/:slug/favorite`, as one ready PR directly on `phase-04i-favorite-article-api`.
- No migration or schema change. `POST /api/articles/:slug/favorite` remains owned by 4I.

## Requirements and Contract

| Case                                | Observable result                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Request                             | Required `Authorization: Token <jwt>`, required slug, no body.                                                                              |
| Existing favorite                   | Delete only the authenticated viewer's join row; return 200 with full article detail, `favorited: false`, and decremented `favoritesCount`. |
| Missing favorite                    | Idempotent 200 detail response; count and other viewers' favorites stay unchanged.                                                          |
| Missing/invalid/stale token subject | 401 with redacted token error.                                                                                                              |
| Unknown slug                        | 404 with article error.                                                                                                                     |
| Persistence or detail-read failure  | Generic 500; transaction rolls back the join deletion and does not disclose database details.                                               |

## Architecture

`AuthTokenGuard → favorite controller(slug, auth.sub) → focused delete service → transaction (lock viewer → lock article → delete viewer/article join → ArticleReadService.getBySlug in same transaction) → 200 detail`.

1. Follow 4I's viewer-then-article lock order. The article lock serializes favorite mutations and article deletion; deleting by `(articleId,userId)` keeps other viewers' rows intact.
2. Treat zero affected favorite rows as success. Build the response through `ArticleReadService` inside the transaction so counts and viewer state match the committed mutation; any read failure rolls back.
3. Keep the controller at the HTTP boundary. Add focused DELETE Swagger metadata and update only the static DELETE contract, including a redacted 500. Preserve required Token security and no request body; generated POST documentation remains unchanged.

## Files and Validation

- Modify `src/articles/article-favorite.controller.ts`, `src/articles/article-favorite.swagger.ts`, `src/articles/articles.module.ts`, and `spec/api/openapi.yml`.
- Create `src/articles/article-favorite-delete.service.ts`, `test/article-favorite-delete.e2e-spec.ts`, and a focused error/docs E2E file only if keeping each file under 200 lines requires it.
- Reuse the article fixture and existing PostgreSQL `TEST_DATABASE_URL`; no database reset or migration is expected.
- Test first: missing-route RED, owner/unfavorite state and counts, idempotency, other-viewer isolation, auth/unknown slug, generic 500 rollback, docs contract, and concurrent POST/DELETE consistency.
- Run focused E2E, full unit and E2E suites sequentially, build, Prettier, lint (zero errors), static OpenAPI parse, `git diff --check`, independent review, line/file limits, and GitHub Static analysis.
- Keep production diff at or below 400 changed lines; every TypeScript file below 200 lines. Push and open a ready PR based directly on #57, record the final SHA/checks in its evidence comment and update the phase/roadmap/changelog before continuing to 4K.

## Local Validation — 2026-09-28

- Valid RED: before implementation, authenticated DELETE returned 404 for the absent route; missing-token call also returned 404 because routing had not yet been registered.
- Focused PostgreSQL E2E passed: 6 tests across the main and error/docs files, including idempotency, other-viewer isolation, stale subject, read-failure rollback, generated docs, concurrent POST/DELETE consistency, and article-delete race. Full `pnpm test` passed (193 passed, 1 skipped); full `pnpm test:e2e` passed (24 files, 97 tests).
- `pnpm build`, Prettier checks, `pnpm lint` and `git diff --check` passed. Lint reported 0 errors and 267 repository warnings. Static OpenAPI YAML parsed; DELETE has required Token security, no body, and 200/401/404/422/500 responses; POST's generated 500 description remains unchanged. Hurl and Bruno CLIs are unavailable; PostgreSQL-backed Supertest E2E covers the contract.
- New warning rationale: C033 reflects the existing DataSource transaction/service pattern; C018/C030 flags preserving the database cause inside a typed persistence error while returning a redacted HTTP response; S037 does not recognize Nest `@Header` decorators (the E2E asserts `Cache-Control: private, no-store`).
- Production changes are below 400 lines; all touched TypeScript and test files are below 200 lines. Independent review passed; PR submission remains pending.

## Risks and Rollback

- Concurrent POST/DELETE returning stale `favorited` or count → acquire viewer and article locks in the same order as 4I and serialize detail inside the transaction.
- Leaking another viewer's row → delete by both article and authenticated user IDs; assert the other viewer remains favorited.
- Roll back only the 4J PR if needed; it adds no schema state. Rebase 4K if 4J is reverted.

## Todo

- [x] Record valid missing-route RED and implement only the DELETE favorite API.
- [x] Pass focused/full gates and independent review; PR submission is pending.
- [ ] Push and create ready stacked PR directly above #57; record evidence and continue with 4K.
