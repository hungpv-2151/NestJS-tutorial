# Research: Phase 04E article deletion patterns

**Date:** 2026-09-28
**Scope:** Repo-specific implementation, persistence, authorization, and test patterns for `DELETE /api/articles/:slug`. No code changed.

## Recommendation

Add one `ArticleDeleteService` and one guarded controller method. In a TypeORM transaction, resolve the authenticated username to a user, lock the article row by slug, return typed 404/403 errors before mutation, then delete the article row. Let PostgreSQL cascade `article_tags` and `article_favorites`; return no body with HTTP 204. This follows the existing update path, gives delete/update requests one row-lock ordering, and avoids manual cleanup queries for dependent joins.

There is no reason to add a migration, DTO, response serializer, or read-after-delete step. The DELETE contract is already present in OpenAPI and Bruno/Hurl files; reconcile its resource-specific error examples as described below.

## Findings

### Contract and authorization — extracted

- Success is `204` with an empty body. Missing auth is `401`; an existing article owned by another user is `403 {errors:{article:["forbidden"]}}`; unknown slug is `404 {errors:{article:["not found"]}}`. The Bruno cases assert these envelopes; Hurl also covers unauthenticated and unknown-slug cases. See [article DELETE Bruno](../../spec/api/bruno/articles/16-delete-article.bru), [unknown-slug Bruno](../../spec/api/bruno/errors-articles/18-delete-unknown-slug.bru), [authorization Bruno](../../spec/api/bruno/errors-authorization/04-user-b-tries-to-delete-403.bru), and [Hurl article errors](../../spec/api/hurl/errors_articles.hurl).
- The OpenAPI path already declares DELETE with Token security and 204/401/403/404/422 responses. Its shared `Forbidden` and `NotFound` response examples use `errors.resource`; the article Bruno checks use `errors.article`. Prefer operation-specific examples in the delete Swagger decorator and OpenAPI path, matching the tested article envelope. The bodyless request makes the existing 422 response look generic, but there is no evidence requiring a new 422 case. The generic error response set also does not document a persistence 500; keep the runtime failure redacted and decide whether to add that response only if the neighboring operation conventions require it. Sources: [OpenAPI DELETE](../../spec/api/openapi.yml), [shared responses](../../spec/api/openapi.yml), and the Bruno/Hurl cases above.

### Persistence and cascade behavior — extracted

- Deleting one `articles` row is sufficient for dependent link cleanup. Both `article_tags.article_id` and `article_favorites.article_id` have `ON DELETE CASCADE` in the migration and corresponding entity relations. The global `tags` rows are independent; article deletion must not delete tag names. Sources: [ArticleTag entity](../../src/articles/article-tag.entity.ts), [ArticleFavorite entity](../../src/articles/article-favorite.entity.ts), [article/tag/favorite migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts), and [Tag entity](../../src/tags/tag.entity.ts).
- `ArticleUpdateService` already uses `DataSource.transaction`, `pessimistic_write`, owner comparison, typed errors, and transaction-scoped repositories. Deletion can reuse that pattern but does not need `ArticleReadService`: it returns 204 and has no response payload. Sources: [update service](../../src/articles/article-update.service.ts), [update controller mapping](../../src/articles/articles.controller.ts), and [OpenAPI DELETE](../../spec/api/openapi.yml).
- The strict guard verifies token syntax/signature but does not check that the JWT subject still names a user. The update service resolves that user and maps a missing subject to 401. Deletion should do the same, so a still-valid token for a deleted account is not misreported as 403/404. Sources: [AuthTokenGuard](../../src/auth/auth-token.guard.ts), [AuthService.authenticate](../../src/auth/auth.service.ts), [update service](../../src/articles/article-update.service.ts), and [update controller](../../src/articles/articles.controller.ts).

### Test harness and cleanup — extracted

- Unit and PostgreSQL integration tests run under `pnpm test`; integration files live at `test/**/*.integration.spec.ts`. E2E files run separately through `pnpm test:e2e` and `vitest.config.e2e.ts`. Sources: [Vitest unit/integration config](../../vitest.config.ts), [E2E Vitest config](../../vitest.config.e2e.ts), and [package scripts](../../package.json).
- `test/setup/test-database.ts` loads `.env` only when `TEST_DATABASE_URL` is not already exported, then sets `DATABASE_URL` from `getTestDatabaseConfig()`. I checked only whether the variable was present, never printed its value: it is configured after `.env` loads. Migration state was not checked. The test environment therefore uses the test URL; no 4E migration is needed. If existing article tables are missing, apply the existing migrations to the test DB only. Sources: [test setup](../../test/setup/test-database.ts), [database config](../../src/config/database-config.ts), [data source/migration registry](../../src/database/data-source.ts), and [integration DB pattern](../../test/update-article-transaction.integration.spec.ts).
- `createArticleFixture` inserts the author, viewer, article, tags, and ordered links in a transaction. `cleanArticleFixture` deletes the article first, then its uniquely named fixture tags and users; after a successful DELETE, the repeated article delete is harmless. It can be reused for 4E. Sources: [shared article fixture](../../test/article-detail-fixture.ts), [GET article E2E](../../test/get-article.e2e-spec.ts), and [update article E2E](../../test/update-article.e2e-spec.ts).

## Minimal shape and test plan

1. `ArticleDeleteService.delete(slug, username)`:
   - Start a transaction; look up `User` by verified username. Missing user → `ArticleDeleteUserNotFoundError`.
   - Select `Article` by slug with `pessimistic_write`. Missing → `ArticleDeleteArticleNotFoundError`; owner mismatch → `ArticleDeleteForbiddenError`.
   - Delete the row by `id` through the same manager. Wrap unexpected persistence failures in a typed `ArticleDeletePersistenceError` without exposing driver details.
2. `ArticlesController` adds only `@Delete(':slug')`, `AuthTokenGuard`, `@HttpCode(HttpStatus.NO_CONTENT)`, and mappings to the established 401/403/404/500 error envelopes. Pass `request.auth.sub`; do not pass the raw request into the service. The exact path has one segment, so it does not consume the later `/favorite` path.
3. Add the module provider and operation-specific Swagger responses. Keep success bodyless. No request DTO or output serializer is needed.
4. Cover owner 204/empty response, subsequent GET 404, deleted tag-link and favorite rows, and preserved global tag rows; non-owner 403 with article and joins unchanged; unknown slug 404; missing/invalid auth 401; valid-token missing subject 401; and a service-level persistence failure mapping. Use the fixture's owner/viewer and add favorite rows in the test. A database-backed E2E assertion is enough to prove FK cascades; a separate rollback integration test is unnecessary for this single `DELETE` statement because PostgreSQL executes the statement and its FK cascades atomically. Sources for these harness patterns: [update service spec](../../src/articles/article-update.service.spec.ts), [update transaction integration tests](../../test/update-article-transaction.integration.spec.ts), [article fixture](../../test/article-detail-fixture.ts), [GET article E2E](../../test/get-article.e2e-spec.ts), and [delete contract cases](../../spec/api/bruno/articles/16-delete-article.bru).

## Trade-off matrix

| Approach | DB work / performance | Complexity and race behavior | Fit and adoption risk |
|---|---|---|---|
| **Transaction + user lookup + locked article lookup + delete (recommended)** | Three small application queries plus FK cascades. Low cost for a single resource mutation; not benchmarked. | Clear 401/403/404 mapping. Shares the row lock with 4D update, so concurrent update/delete serializes; after deletion a waiting update sees 404. | Uses existing TypeORM/PostgreSQL patterns in 4D; no dependency or schema change. Low adoption risk. |
| Scoped single DELETE followed by a lookup when no row was deleted | Usually fewer statements for owner success. | Must distinguish missing from non-owner after a zero-row delete; without a transaction/lock the fallback can race with another delete. More conditional SQL and harder tests. | Possible PostgreSQL optimization, but unnecessary for this low-volume API and less consistent with current code. Medium complexity risk. |
| Read owner, then delete without lock/transaction | Two simple repository calls. | Read/delete gap permits concurrent mutation or deletion before the delete. Error results depend on the affected-row handling. | Lowest initial code, weakest concurrency guarantee. Avoid; this departs from the immediately preceding update API. |

This is not a new technology choice: TypeORM and PostgreSQL are already pinned project dependencies, and the row-lock/cascade behavior is represented in the current service and migration. Their maintenance/adoption risk is low for this change. No external benchmark or version-changelog research was done because the task is to reuse the checked-in implementation and contract.

## Size and integration risks

- A 4E API-only PR should stay under the ≤300 preferred / ≤400 hard production-line cap; likely production additions are the service, one route/error mapping, provider registration, and Swagger metadata. No migration, new entity, or endpoint test contract files are needed.
- Existing [articles controller](../../src/articles/articles.controller.ts) is 157 lines; adding imports and a route/error mapping may approach 200. Existing [articles Swagger module](../../src/articles/articles.swagger.ts) is 175 lines; appending a full decorator likely crosses the repo's 200-line file limit. Check both after the patch; keep each code file below 200, extracting a focused delete Swagger module only if required.
- Global article deletion only removes `ArticleTag` and `ArticleFavorite` rows via schema cascade. Do not delete global `Tag` rows in production. Fixture cleanup may remove its uniquely named test tags afterward.
- There is no article comment entity/table in the current schema; Phase 05 is still pending. No comment cleanup code belongs in 4E. Sources: [migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts), [phase roadmap](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md), and [phase 05 plan](../260910-0930-medium-clone-backend/phase-05-comments.md).

## Source assessment and limits

The checked-in OpenAPI/Hurl/Bruno contracts are the primary behavioral record; migrations are authoritative for database constraints; current services/controllers show the accepted local architecture; executable tests show the DB harness and fixture lifecycle. Evidence cross-checks each conclusion across at least three artifacts. I did not run tests or connect to the database, so table/migration readiness remains unverified; 4E itself adds no migration. There are no unresolved design questions beyond whether to document the pre-existing generic 422 and the new generic persistence 500 in the DELETE OpenAPI response list.
