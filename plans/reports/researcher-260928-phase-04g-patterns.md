# Study Report: Phase 04G Article List Integration Patterns

**Studied:** 2026-09-28
**Scope:** Read-only study of `GET /api/articles`; query/page foundation, list hydration, optional auth, controller and test seams.

## Summary

Keep `ArticleListQueryService` as the filter/count/order seam. Add a thin list orchestration path that gets one page, hydrates relation state in bounded batch queries, and calls the existing `serializeArticleList`. Do not loop over `ArticleReadService.getBySlug`: that method loads tags, favorites and follow state for one article at a time. Use the existing optional-token guard, then resolve the verified subject to a user once so a deleted account still returns 401.

One real 4F cost surfaced: its page query uses `getMany()` without a projection, so it loads `article.body` even though the list serializer and contract omit body. `body` is unbounded `text`; a 100-item page can read unnecessary large values. Adjust the list query result projection before exposing it, with a list-specific result type that omits `body`; otherwise keep its filters, distinct count, and ordering intact.

## Findings

### Existing seams

- `ArticleListQueryService.list(criteria)` owns AND filters, distinct count before pagination, deterministic `createdAt DESC, id DESC` order, `limit <= 100`, and typed validation/persistence errors. Its current contract returns `Article[]`, with author joined. [`article-list-query.service.ts`](../../src/articles/article-list-query.service.ts#L10)
- `serializeArticleList` already emits `articles`/`articlesCount`, ISO dates, ordered `tagList`, favorite fields and public author fields while omitting `body`. Keep serialization there. [`article.serializer.ts`](../../src/articles/article.serializer.ts#L21)
- Detail reads establish exact behavior and errors, but run separate relation lookups per article: tags, favorite count, viewer favorite, and author follow. Reusing this inside a list loop creates N+1 calls. This is an inference from the detail service’s single-article API and call pattern. [`article-read.service.ts`](../../src/articles/article-read.service.ts#L18)
- `OptionalAuthTokenGuard` allows a missing header and rejects malformed/invalid supplied tokens. Its verified subject is a username. `AuthService.authenticate` checks claims/denylist but not whether the user row still exists; detail reads catch that later with `ArticleViewerNotFoundError`. [`optional-auth-token.guard.ts`](../../src/auth/optional-auth-token.guard.ts#L16) · [`auth.service.ts`](../../src/auth/auth.service.ts)
- `ArticlesModule` already imports `AuthModule`, registers `Article`, `ArticleTag`, `ArticleFavorite`, `Tag`, and `UserFollow`, and provides the optional guard and list query service. It uses `DataSource`-based services. [`articles.module.ts`](../../src/articles/articles.module.ts#L19)
- The static OpenAPI contract names filters `tag`, `author`, `favorited`, `offset`, `limit`; default limit is 20. The Hurl files exercise global/author/tag lists and pagination; no search parameter is defined. [`openapi.yml`](../../spec/api/openapi.yml#L181) · [`articles.hurl`](../../spec/api/hurl/articles.hurl) · [`pagination.hurl`](../../spec/api/hurl/pagination.hurl)
- Existing DB integration style uses `TEST_DATABASE_URL`, real PostgreSQL entities, isolated fixture rows and cleanup. The 4F integration test proves distinct filtered counts and deterministic tie ordering, but it does not count SQL statements. [`article-list-query.integration.spec.ts`](../../test/article-list-query.integration.spec.ts#L11)

### Recommended batch hydration

1. Convert validated HTTP query fields into the existing criteria (`author` → `authorUsername`, `favorited` → `favoritedUsername`). Preserve 4F's filters and paging; do not add a search parameter.
2. Resolve `request.auth?.sub` to `User` once when present. Return the existing stale-viewer error path as 401 if no row exists, including for an empty page. The guard verifies the token, not the user's continued existence.
3. Call `ArticleListQueryService.list`; collect page article IDs and distinct author IDs.
4. For a non-empty page, run a fixed set of batch queries:
   - Ordered tags: one `ArticleTag`/`Tag` raw query filtered by all article IDs and ordered by article ID then `position`; initialize missing tag lists as `[]`.
   - Favorites: one grouped `ArticleFavorite` aggregate per article ID. Return total count and, for an authenticated viewer, a boolean aggregate for their favorite row. Missing aggregate rows become count `0`, flag `false`.
   - Follows: for an authenticated viewer, one `UserFollow` query filtered by `followerId` and all distinct page author IDs. Missing rows mean `following: false`.
5. Build `ArticleSerializationInput` values and pass them with the unchanged total count to `serializeArticleList`.

This keeps relation query count fixed as page size grows. The schema supports these lookups: article tags have article/position keys, favorites have an `(article_id, user_id)` primary key and `(user_id, article_id)` index, and follows have `(follower_id, following_id)` primary key. [`article-tag.entity.ts`](../../src/articles/article-tag.entity.ts) · [`1710000004000-create-articles-tags-favorites.ts`](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L22) · [`1710000002000-create-user-follows.ts`](../../src/database/migrations/1710000002000-create-user-follows.ts#L6)

## Ranked Approaches

| Rank | Approach | Performance | Complexity | Maintenance | Cost / risk |
|---|---|---|---|---|---|
| 1 | Keep the page query; batch tags, favorite aggregates and follows by page IDs | Fixed query count; bounded rows for tags/follows, aggregate favorites | Low to medium | Reuses current criteria and serializer | No new dependency; a few focused SQL builders |
| 2 | Join all collections into the paged article query | Could use fewer round trips | High | Count/order/page logic becomes coupled to several one-to-many joins | Duplicate article rows can distort paging/count; distinct and `take/skip` behavior needs careful proof |
| 3 | Call detail read once per article | At least relation reads grow with page size | Low initially | Repeats logic and error behavior | N+1; reject |

Rank 1 fits the existing PostgreSQL + TypeORM design. TypeORM supports raw grouped aggregates and query logging through `QueryBuilder`; PostgreSQL supports grouped counts and aggregate `FILTER`, so one favorite aggregate can provide both count and viewer flag. These docs corroborate the local pattern; they are not benchmark evidence. [TypeORM QueryBuilder](https://typeorm.io/docs/query-builder/select-query-builder/) · [TypeORM efficient QueryBuilder use](https://typeorm.io/docs/performance-optimization/efficient-use-of-query-builder/) · [PostgreSQL aggregate functions](https://www.postgresql.org/docs/current/functions-aggregate.html)

## HTTP, Errors, and Module Changes

- Prefer a dedicated `ArticleListController` or keep the new handler small enough to leave `articles.controller.ts` below the 200-line rule; that controller is already 157 lines. A dedicated controller mirrors the existing delete-controller split. `GET /articles` is an exact path and does not conflict with `GET /articles/:slug`.
- Add a list query DTO for the documented names. Use number conversion plus integer/range validators for `offset` and `limit` (`limit` defaults to 20 and caps at 100). Global `ValidationPipe` maps DTO errors to the project's RealWorld 422 envelope.
- Put list Swagger decorators in a focused `article-list.swagger.ts`; the existing `articles.swagger.ts` is 175 lines. Document public access plus optional token security, 200/401/422, and the redacted 500 if persistence errors are mapped explicitly.
- Add the list controller/service provider to `ArticlesModule`; entities and guard dependencies are already registered.
- Map stale viewer to 401 `{ errors: { token: ['is invalid'] } }`, `ArticleListQueryValidationError` to 422, and query/hydration persistence errors to the existing redacted 500 body `{ errors: { body: ['request failed'] } }`. Do not pass the raw request into domain logic.
- Since response personalization depends on the optional viewer, use `Cache-Control: private, no-store`, matching article detail behavior.
- Keep static OpenAPI and runtime `/docs-json` aligned. The static list operation currently has no optional-token `security` alternatives even though it documents 401 and says auth is optional.

## Query-Count Evidence

No current test measures query count. Add one real-PostgreSQL integration assertion around the composed list service using a recording TypeORM logger (or a logger spy) and fixture pages of different sizes. Clear the record after setup, then assert that fetching one row and multiple rows uses the same count of page/hydration SQL calls; separately assert populated tags, favorites and follows so the test cannot pass by omitting hydration. The 4F count/page query contributes two statements. Expected totals from the proposed design are four guest statements and six authenticated statements for a non-empty page; empty pages skip hydration, and guests skip viewer/follow lookups. Treat these totals as design expectations until the test records them.

## Size and Files

- Keep `src/articles/article-list-query.service.ts` focused; it is 136 lines. Change its selection/result type only to stop loading `body`, while preserving its current filters/count/order behavior.
- Likely additions: list query DTO, batch list service, list controller, list Swagger decorator, and focused service/integration/E2E tests. Update `articles.module.ts`, `spec/api/openapi.yml`, and Hurl coverage as needed. Keep every production file under 200 lines; target the API PR at ≤300 production lines and split before 400.
- Do not grow `articles.controller.ts` (157 lines) or `articles.swagger.ts` (175 lines) past the limit.

## Source Assessment and Limits

Primary evidence is the repo's OpenAPI/Hurl contracts, current query/detail/serializer implementation, entity/migration constraints, and real-DB integration test. TypeORM and PostgreSQL vendor docs support the aggregate/raw-query and query-logging mechanics. No new library is recommended, so maturity/community/abandonment risk is nil beyond the project's pinned TypeORM 1.1.1. PostgreSQL-specific aggregates fit the existing Postgres-only database config.

The fixed query-count total is inferred, not measured. No production-sized benchmark or query plan was run. The article list has no current HTTP controller/E2E test, so invalid query envelope details should follow DTO/global-pipe conventions and be asserted in 4G. Filter matching remains exact, consistent with the existing 4F criteria; no casing or search behavior is added here.

## Actionable Next Steps

1. Add the body-free page projection and list-result type without changing 4F filter/count/order semantics.
2. Add the controller/DTO/Swagger edge and batch service described above.
3. Test ordered/missing tags, counts, favorite/follow flags, guest/auth/invalid/stale tokens, AND filters, pagination, empty pages, 422 and redacted 500.
4. Record a database-backed query-count comparison for page sizes 1 and 3, and verify runtime `/docs-json` matches static OpenAPI.
