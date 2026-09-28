# Phase 04B — Create Article

## Context Links

- [Phase 04 roadmap](./phase-04-articles-search-pagination.md) · [4A foundation](./phase-04a-article-schema.md) · [OpenAPI](../../spec/api/openapi.yml) · [article Hurl](../../spec/api/hurl/articles.hurl) · [error Hurl](../../spec/api/hurl/errors_articles.hurl)
- [Contract research](../reports/researcher-260928-phase-04b-contract.md) · [code patterns](../reports/researcher-260928-phase-04b-patterns.md)

## Overview and Dependency

- Priority: P1 · Status: Submitted · PR scope: **`POST /api/articles` only** · [PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48) is ready for review on [PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47) / `phase-04a-article-schema` · Branch: `phase-04b-create-article`.
- Requires 4A tables, entity mappings, and detail serializer. PR 4C (`GET /api/articles/:slug`) starts only after 4B is submitted on #47. No other article, feed, favorite, or tag route belongs here.
- Before code, refresh the remote, confirm #47 is the immediate stack base, rebase 4B if needed, and audit `git diff` for this one-API boundary.

## API Contract and Decisions

| Case | Required behavior |
| --- | --- |
| Request | `Authorization: Token <jwt>` and `{ "article": { "title": string, "description": string, "body": string, "tagList"?: string[] } }`. Required fields must be nonblank; missing `tagList` means `[]`. Reject unknown fields with the existing global pipe. |
| Success | `201 { article: { slug, title, description, body, tagList, createdAt, updatedAt, favorited: false, favoritesCount: 0, author } }`. `author` has only `username`, `bio`, `image`, `following: false`; timestamps are ISO. Preserve the order of submitted unique tags. |
| Auth / validation | Missing or invalid token: `401` in the existing token-error envelope. Missing/empty/wrong-type title, description, body, malformed envelope, wrong-type `tagList` or item, or blank tag name: `422` in the existing field-error envelope. Hurl requires exactly `errors.<field>[0] == "can't be blank"` for empty required strings. |
| Conflict | Two creates with the same title both return `201` with different slugs. If the named `uq_articles_slug` constraint still collides, return `409 { errors: { slug: ["has already been taken"] } }`; do not map unrelated database failures to 409. |

- **Slug:** make a URL-safe, lowercase title base (Unicode NFKD, remove combining marks, replace non-ASCII alphanumeric runs with `-`, trim separators, cap base at 80 characters, fallback `article`) and append a full random UUID. No availability pre-query or retry: the suffix makes duplicate-title collisions negligible, and the unique constraint remains authoritative. This format is an implementation choice; OpenAPI/Hurl require only a string and distinct slugs.
- **Tags:** retain the exact submitted spelling and case because 4A's unique `tags.name` is case-sensitive; reject blank/whitespace-only names. Deduplicate repeated exact names in first-seen order before writes and return that order. OpenAPI does not declare `uniqueItems`, so a repeated name is accepted while the relation stays unique. Do not impose arbitrary per-field length or count limits absent from the contract; the existing request-body limit still applies.
- `409` has no article-specific example in OpenAPI. The chosen `slug` error key follows the conflicting field and is tested as 4B behavior; it must not turn duplicate *titles* into a conflict.

## Architecture and Data Flow

`AuthTokenGuard → nested DTO/global ValidationPipe → controller extracts request.auth.sub → ArticleCreateService → DataSource.transaction(manager) → users/articles/tags/article_tags → serializeArticleDetail → 201`.

1. Controller owns only the HTTP boundary: guard, DTO, Swagger, typed error mapping, and serialization. Pass the verified username and DTO fields to the service, never the raw HTTP request or an author ID from the body.
2. Inside one transaction, find the author by verified username using the transaction manager; if absent, map a typed failure to `401 errors.token = ["is invalid"]`. Generate the slug and insert one article linked to that author. Use only repositories from the transaction manager.
3. For nonempty tags, insert distinct names in one batch with conflict-ignore on the unique name, then fetch their IDs in one query in the same transaction. Insert all `article_tags` in one batch with the deduplicated input index as `position`. Never ignore article or link failures. Empty tags require no tag/link writes.
4. Return the committed article, author, and ordered tag names to the pure 4A detail serializer. Supply `favorited=false`, `favoritesCount=0`, `authorFollowing=false`; no extra DB reads after commit are needed. A failed article/tag/link write rolls back the article and any newly inserted tags.
5. Register an `ArticlesModule` in `AppModule`; import `AuthModule` and `TypeOrmModule.forFeature([Article, ArticleTag, Tag])` for runtime metadata. Do not change 4A's migration or enable `synchronize`.

## File Ownership and Size Gate

- Create `src/articles/articles.controller.ts`, `src/articles/articles.module.ts`, `src/articles/article-create.service.ts`, `src/articles/article-create.dto.ts`, and `src/articles/articles.swagger.ts`. Keep slug logic in the service unless its size warrants a focused `article-create-slug.ts`.
- Modify `src/app.module.ts` and its registration expectation in `src/app.module.spec.ts`. Reuse the existing `Article`, `ArticleTag`, `Tag`, `AuthTokenGuard`, and `serializeArticleDetail`; touch 4A files only if a demonstrated contract gap requires it.
- Tests own `src/articles/article-create.service.spec.ts`, `test/create-article.e2e-spec.ts`, and `test/create-article-transaction.integration.spec.ts` (or equally scoped files). No delete. Keep each code file under 200 lines; production changed lines target ≤300 and hard gate ≤400 per [roadmap](./plan.md).

## RED-First Test Matrix and Execution

1. Write failing controller/DTO tests first: valid authenticated create returns the full `201` detail envelope and ordered tags; omitted tags return `[]`; missing/invalid token gives `401`; blank required fields give the exact Hurl `422` messages; malformed envelope, unknown fields, and invalid tag values give `422`. Assert the service receives only the verified subject and validated values.
2. Write failing service tests for duplicate titles yielding distinct slugs, case-sensitive tag names, repeated names deduplicated in first-seen order, batch tag/link operations, and typed mapping of only `uq_articles_slug` to 409. Cover author disappearance after a valid token and an unrelated persistence failure without leaking database details.
3. Write a PostgreSQL integration test proving article, tags, and ordered links persist, plus a forced link failure proving the whole transaction rolls back. Use unique fixture names and clean up created rows; do not reset a shared database. A concurrency case for shared tag insertion should prove both articles link to one tag row.
4. Run focused tests RED for requested assertions, implement the route, then rerun GREEN. Run `pnpm build`, focused Vitest, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, and a create-only OpenAPI/Hurl contract check. Do not claim all of `articles.hurl` passes: it contains later 4C–4K routes. If Hurl is unavailable, cover the exact create cases with isolated Supertest E2E and record that the Hurl command was not run.
5. Vitest already loads `test/setup/test-database.ts`: use the configured `TEST_DATABASE_URL` from the environment or `.env`; that setup maps it to `DATABASE_URL` for tests. The integration test must use the same configured test database with 4A migrations already applied. `DATABASE_URL` is for the app and migration CLI; 4B adds no migration, so no apply/revert cycle is needed. Never hardcode a phase-specific URL or overwrite the configured test target. Local verification used an isolated PostgreSQL override because the configured environment URLs point to shared Neon data.

## Risks, Security, Compatibility, Rollback

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| Concurrent tag creates or partial article writes | Medium / High | Single transaction; batch conflict-ignore only for tag names; reselect IDs; integration test for rollback and shared-tag race. |
| Slug collision or wrong 409 classification | Low / Medium | UUID suffix, `uq_articles_slug` database constraint, match that named constraint only, targeted failure test. |
| Invalid DTO/unknown author leaks data or returns 500 | Medium / High | Global nested validation, verified JWT subject, typed stale-author 401, public serializer and redacted fixed-category logs; never log title/body/tags, token, or user identifiers. |
| 4B diff leaks another API or exceeds line budget | Medium / High | Inspect changed routes and production line count before review and submit; split same-API support into another PR if >400. |

- Compatibility: additive POST route over 4A schema; existing endpoints and data are unchanged. Tags are exact-case, and no future API semantics are preimplemented.
- Rollback: revert only 4B commit/PR while retaining 4A tables; no schema down on this PR. If later PRs depend on 4B, rebase them before removal. Article rows created during a deployed 4B remain valid 4A data.

## Done Criteria and Handoff

- [x] #47 is the direct PR base; diff contains exactly one new public API, and production line budget passes.
- [x] Build, full tests, focused tests, e2e, and lint pass with real exit codes. Full unit/integration suite: 35 files, 138 passed, 0 failed/skipped; focused service regression: 6 passed; full e2e: 11 files, 39 passed, 0 failed/skipped; lint: 0 errors (warnings remain).
- [x] PostgreSQL verifies ordered tags, duplicate-title unique slugs, atomic rollback, and concurrent shared tags; `TEST_DATABASE_URL` pointed to disposable local PostgreSQL and all fixture counts returned to zero.
- [x] Swagger documents only POST create with `201/401/409/422`; independent review found no remaining production correctness/security/transaction defect. Targeted lint reports 0 errors and 17 warnings in `src/articles`: four `C033` warnings reflect the required `DataSource.transaction` unit of work; `C018/C030` catch-path warnings reflect propagation of typed errors to the shared exception filter.
- [x] Hurl was unavailable (`command -v hurl` returned no path). Isolated Supertest E2E covers missing auth, validation envelopes, and authenticated persistence. OpenAPI 409 example was manually reviewed against its route/error envelope.
- [x] [PR #48 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/48#issuecomment-5861778843) records commands/results, exit codes, and commit SHAs. A UI screenshot does not apply to this backend-only API. 4B is submitted on #47 via the stack workflow; 4C can now use #48 as its base.
