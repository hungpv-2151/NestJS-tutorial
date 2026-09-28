# Phase 04C — Get Article Detail

## Context Links

- [Phase 04 roadmap](./phase-04-articles-search-pagination.md) · [4B create article](./phase-04b-article-create.md) · [OpenAPI](../../spec/api/openapi.yml) · [article Hurl](../../spec/api/hurl/articles.hurl) · [error Hurl](../../spec/api/hurl/errors_articles.hurl)
- [Contract research](../reports/researcher-260928-phase-04c-contract.md) · [repository research](../reports/researcher-260928-phase-04c-patterns.md)

## Overview and Dependencies

- Priority: P1 · Status: Submitted as [PR #49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49) (ready for review) · PR scope: **`GET /api/articles/:slug` only** · Planned base: `phase-04b-create-article` / [PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48). Submit one ready PR above #48; do not add list, feed, update, delete, favorite, or tag routes.
- Requires 4A article/tag/favorite tables and serializer, plus 4B `ArticlesModule`. 4D update-article work begins only after 4C is submitted. Before code, refresh the remote, confirm #48 is the direct stack base, and audit the branch diff.
- No migration, package, cache, or new public DTO is needed. Keep each code file under 200 lines and the PR within the Phase 04 production-line budget (target ≤300; hard gate ≤400).

## Key Insights

- The existing detail serializer already defines the response and private-field allowlist. `ArticleTag.position` defines tag order; favorite and follow composite keys support direct existence checks. No new schema or serializer is needed.
- The existing auth guard requires a token. Public detail needs a small optional wrapper, with an explicit policy for credentials that are supplied but invalid.

## Contract and Decisions

| Case                                        | Observable result                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anonymous existing slug                     | `200 { article: { slug, title, description, body, tagList, createdAt, updatedAt, favorited: false, favoritesCount, author } }`. `author` contains only `username`, nullable `bio`, nullable `image`, and `following: false`. The count reflects all persisted favorites; `tagList` follows `article_tags.position`. Dates are ISO strings. |
| Valid `Authorization: Token <jwt>`          | Same shape. `favorited` reflects this viewer's `article_favorites` row; `author.following` reflects this viewer-to-author `user_follows` row. Both are false when absent, including when the viewer is the author.                                                                                                                         |
| Unknown slug                                | `404 { errors: { article: ["not found"] } }` for guests and valid viewers. No article or author data escapes.                                                                                                                                                                                                                              |
| Malformed or invalid supplied Authorization | `401` with the existing `errors.token` envelope. **Inference:** OpenAPI/Hurl require anonymous success but say nothing about invalid supplied credentials. This choice reuses strict token verification, including revocation checks; only a truly absent header is anonymous. An empty header is supplied and invalid.                    |
| Validation / transport                      | OpenAPI declares generic `422` but specifies no GET-specific trigger. Preserve global validation/error handling; do not invent slug rules or a request body. The route requires the path segment.                                                                                                                                          |

- OpenAPI does not require auth for GET. Represent optional auth as two security alternatives: the Token scheme or an empty requirement. Runtime `401` for supplied invalid credentials is an explicit local policy; document it in route Swagger and OpenAPI with the invalid-token envelope.
- Reuse `serializeArticleDetail`; do not return a raw entity. This preserves the public author projection and keeps `body` present only in detail responses.

## Architecture and Data Flow

`GET /api/articles/:slug → optional token guard → controller(slug, optional subject) → ArticleReadService → fixed article/tag/favorite/viewer/follow reads → serializeArticleDetail → HTTP 200`.

1. Add a focused optional guard that allows a request only when the Authorization header is absent; for a present header, delegate to the existing `AuthTokenGuard`. It attaches verified claims using the existing request contract. Do not parse or verify JWTs in the article service or pass the raw request into it.
2. The controller reads only `slug` and the optional verified subject, calls the read service, and maps a typed missing-article error to the exact 404 envelope. If a verified subject has since been deleted, map a typed stale-viewer error to the existing invalid-token 401 envelope. Let unexpected persistence failures flow through the existing exception filter without logging private values.
3. The service fetches one article by indexed unique slug with its author in one joined query. Fetch ordered tags through `ArticleTag → Tag` using the article ID and `position ASC`; fetch the article's favorite count with `COUNT`, never by loading all favorite rows. For a guest, supply `favorited=false` and `authorFollowing=false`.
4. For a verified subject, resolve one viewer by username, then check existence of the `(articleId, viewerId)` favorite and `(viewerId, authorId)` follow keys. The read budget is **3 queries for guests, at most 6 for signed-in viewers**, independent of tag/favorite cardinality. These independent lookups may run concurrently after the article and viewer IDs are known. No tag × favorite join, per-tag query, or read transaction. The existing foreign keys and unique/composite indexes serve these lookups.
5. Future `/articles/feed` must be registered before `/:slug` to prevent `feed` being interpreted as a slug. Phase 4C adds only `/:slug` and leaves future route work to 4H.

## File Ownership and Size Gate

| Action | File                                        | Purpose                                                                                                                                              |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `src/auth/optional-auth-token.guard.ts`     | Allow missing header; delegate present header to the exported strict guard.                                                                          |
| Create | `src/articles/article-read.service.ts`      | Bounded data reads, typed missing/stale-viewer errors, serializer call. Split a focused query helper only if needed to stay under 200 lines.         |
| Modify | `src/articles/articles.controller.ts`       | Add GET boundary and typed HTTP error mapping; keep POST behavior intact.                                                                            |
| Modify | `src/articles/articles.module.ts`           | Register read service and optional guard; ensure `UserFollow` metadata is registered if queried through its entity.                                  |
| Modify | `src/articles/articles.swagger.ts`          | Describe detail path, public success, 404, generic 422, and optional credential policy. Reuse the existing article response example where practical. |
| Modify | `spec/api/openapi.yml`                      | Keep only the `GET /articles/{slug}` contract aligned with the optional header and chosen 401 behavior.                                              |
| Create | `src/articles/article-read.service.spec.ts` | Focused read/error/query-behavior tests.                                                                                                             |
| Create | `test/get-article.e2e-spec.ts`              | Real HTTP response, persistence, ordered tags, favorite/follow state, 404 and invalid token.                                                         |
| Create | `test/article-detail-fixture.ts`            | Build and clean unique article fixtures atomically so failed setup leaves no partial rows.                                                           |

- Do not edit 4A migrations, the article serializer, or other API controllers unless a concrete test exposes a defect. Do not add a second route while refactoring Swagger or auth.
- Implementation, tests, then independent reviewer have sequential ownership of these files. Documentation owner may update the parent phase/roadmap/changelog after verification; that is a later closeout step, not part of the code worker's edits.

## Implementation and Verification Order

1. Confirm stack base #48 and isolate branch 4C. Write failing focused tests for guest detail, unknown slug envelope, valid viewer favorite/following, supplied invalid token, stale viewer, ordered tags, and no private author fields. Confirm failures are caused by the missing behavior.
2. Implement the guard, read service, controller route, module registration, Swagger, and this route's OpenAPI contract. Run `pnpm build` after code changes. Keep controller at the HTTP boundary and the service free of Express request objects.
3. Run focused tests through the project setup: `test/setup/test-database.ts` maps configured `TEST_DATABASE_URL` to `DATABASE_URL`. If existing test tables have no migration history, use the guarded project reset runner (`pnpm db:migration:reset`) with `CONFIRM_DATABASE_RESET=yes` and `TEST_DATABASE_URL` only; never target the normal `DATABASE_URL`, print credentials, or substitute a phase-specific URL. For this phase, the test target had existing tables and empty migration history; the guarded runner was used and applied all five registered migrations. 4C adds no migration. Use unique fixtures and atomic setup/cleanup.
4. Run `pnpm build`, `pnpm lint`, focused tests, `pnpm test`, and `pnpm test:e2e`; retain real exit codes. Check the exact anonymous 200 and missing-slug 404 Hurl cases if Hurl is installed. If it is absent, use isolated Supertest assertions for those same contract cases and report the unavailable command. Do not claim the full article Hurl suite passes before 4D–4K exist.
5. Hand final code to an independent reviewer; fix correctness/security findings and rerun affected gates. Audit one-route scope, production-line count, and direct PR base. Submit one ready stacked PR above #48, attach validation evidence and commit SHA in a PR comment, then update Phase 04 checklist and roadmap/changelog with the PR and evidence link.

| Test layer             | Required proof                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                   | Guard distinguishes absent and supplied-invalid headers; service maps missing article/stale viewer and supplies correct serializer context without cardinality-dependent loops. |
| PostgreSQL integration | Ordered tags, actual favorite count with multiple tags/favorites, and direct viewer favorite/follow existence reads. Use configured disposable test target.                     |
| HTTP E2E               | Anonymous 200, valid-token personalized 200, invalid-token 401, exact missing-slug 404, complete public response and no private fields.                                         |

## Risks, Security, Compatibility, Rollback

| Risk                                                                     | Likelihood / impact | Countermeasure                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest GET accidentally requires auth or bad supplied token becomes guest | Medium / High       | Optional guard checks header absence exactly; HTTP tests cover absent, malformed, invalid, and valid headers.                                       |
| Favorite count multiplies across tags or query count grows with data     | Medium / Medium     | Separate COUNT and existence checks; assert two tags plus several favorites return exact count and ordered list; fixed six-query ceiling by design. |
| Private author fields leak from ORM hydration                            | Medium / High       | Reuse allowlist serializer; E2E asserts email, password hash, token, and user ID are absent from JSON. Never log headers or raw identifiers.        |
| Deleted viewer token or missing article yields wrong status              | Medium / Medium     | Distinct typed errors and controller mappings; tests cover both independently.                                                                      |
| 4C shadows later `/feed` route                                           | Low / High          | Reserve static-route-before-parameter ordering in 4H and add feed precedence coverage there.                                                        |

- Compatibility: additive GET over the existing 4A schema; POST and stored article data retain their behavior. Optional-auth policy affects only this new route. No schema or data backfill.
- Rollback: revert the 4C PR/commit, leaving 4A tables and 4B POST intact. Rebase dependent 4D+ PRs if 4C is removed. No data loss or migration rollback is required.

## Done Criteria and Next Step

- [x] Branch is based directly on PR #48; diff exposes exactly `GET /api/articles/:slug` and stays within line limits.
- [x] Anonymous 200, valid-viewer flags, invalid-header 401, missing 404, ordered tags, exact favorite count, and public author projection pass HTTP/E2E; service behavior and fixed query shape pass focused tests.
- [x] Build, lint with zero errors, full unit/integration and E2E suites pass; database fixtures are cleaned. Reset ran only against `TEST_DATABASE_URL` using the project runner and confirmation; five migrations applied. Retained warnings are recorded with reason and follow-up.
- [x] Independent review accepts security, scope, and rollback.
- [x] Submitted ready PR [#49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49) directly above #48; validation evidence: [comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/49#issuecomment-5862775055). Work paused here on the user's earlier instruction and later resumed; 4D is now submitted in [PR #50](https://github.com/hungpv-2151/NestJS-tutorial/pull/50) and [PR #51](https://github.com/hungpv-2151/NestJS-tutorial/pull/51).

## Verification Checkpoint — 2026-09-28

- The configured `TEST_DATABASE_URL` target had existing tables but an empty migration history. The project reset runner was run with `CONFIRM_DATABASE_RESET=yes` against `TEST_DATABASE_URL` only; all five registered migrations applied. The normal `DATABASE_URL` was never used as the reset target.
- `pnpm test` passed: 143 tests passed and 1 skipped across 35 files. `pnpm test:e2e` passed: 46 tests across 12 files. This includes the previously blocked database-backed article-detail and create-article integration coverage.
- `pnpm build` passed. `pnpm lint` reported 0 errors and 185 repository warnings.
- Retained changed-file lint warnings: `ArticleReadService` uses `DataSource` repository reads to match the existing article service and avoid a one-use repository abstraction (C033); the optional guard rethrows upstream guard errors after translating only the malformed-header case (C030); the controller maps typed errors and lets unexpected failures reach the shared exception filter, while route cache headers are present (C018/C030/S037 analyzer warnings). Revisit if the project introduces a shared repository abstraction or the analyzer recognizes these patterns.
- Independent review completed with no remaining critical, high, or medium findings. Phase 4C validation is complete; [PR #49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49) is ready for review above #48. [Validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/49#issuecomment-5862775055). 4D has not started because the user requested a pause for a separate rule-update plan.
