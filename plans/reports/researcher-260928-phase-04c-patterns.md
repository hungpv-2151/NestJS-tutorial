---
title: 'Study Report: Phase 04C GET Article Detail Patterns'
date: 2026-09-28
scope: 'Article entities, serializer inputs, optional auth, module metadata, bounded reads, test setup'
plan: 'plans/260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md'
conducted_at: '2026-09-28T09:11:54+07:00'
---

# Study Report: Phase 04C GET Article Detail Patterns

## Summary

**Rank 1: add a read service that reuses `serializeArticleDetail`, loads the article with its author, then loads ordered tags and aggregate/viewer state in a small fixed number of queries.** For a signed-in reader, target three or four queries: article plus author, ordered tags, favorite count, and one state query with `EXISTS` for the reader's favorite and follow relationship. A guest skips personalized state and serializes `favorited=false`, `author.following=false`; `favoritesCount` still reflects the real count.

The read route is public by contract. Add an optional-auth path so absent auth uses guest context while valid auth supplies the reader for personalized flags. Do not use the required `AuthTokenGuard` on this route. The contract does not settle invalid supplied tokens.

## Preflight and source weight

Loaded `tkm:help` and `tkm:research` from the project skill files; this session exposes no dedicated `Skill` tool. `tkm:search-docs` does not apply because no library API lookup is needed. Highest-weight evidence is the project OpenAPI and executable Hurl contract; runtime behavior comes from entities, migrations, services, and serializers; tests show verified coverage. Prior plan/research documents are secondary corroboration. Evidence spans more than three independent project files for each key behavior.

## Findings

### Serializer data contract — extracted

`serializeArticleDetail` takes `slug`, `title`, `description`, `body`, `createdAt`, `updatedAt`, an author `User`, and explicit context: ordered tag names, `favorited`, `favoritesCount`, and `authorFollowing`. It is pure and allowlists author `username`, `bio`, and `image`; it converts dates to ISO strings. The guest serializer test fixes all personalized flags to false/zero. Evidence: [serializer](../../src/articles/article.serializer.ts#L3), [serializer tests](../../src/articles/article.serializer.spec.ts#L30), [4A serializer contract](../reports/researcher-260928-phase-04a-persistence.md#L34).

### Persistence and relation shape — extracted

- `Article` owns its author through `authorId` / `ManyToOne`; it has no declared tags or favorites collection. Load the author with the article and select only public author fields where practical. Evidence: [Article entity](../../src/articles/article.entity.ts#L13), [User entity](../../src/users/user.entity.ts#L9), [serializer allowlist](../../src/articles/article.serializer.ts#L62).
- Tags are stored through `ArticleTag`, with `position` and a unique `(articleId, position)` constraint. Join `article_tags` to `tags` and explicitly order by `position`; do not assume relation order. Evidence: [ArticleTag entity](../../src/articles/article-tag.entity.ts#L14), [4A migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L22), [4A plan risk](../260910-0930-medium-clone-backend/phase-04a-article-schema.md#L70).
- `ArticleFavorite` has `(articleId, userId)` as its primary key; its migration also indexes `(user_id, article_id)`. Count rows for the article, and check the reader's row independently. `UserFollow` has a `(follower_id, following_id)` key, so the reader-to-author pair is a direct existence lookup. Evidence: [favorite entity](../../src/articles/article-favorite.entity.ts#L5), [article/favorite migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L32), [follow entity and migration](../../src/profiles/user-follow.entity.ts#L5) / [follow migration](../../src/database/migrations/1710000002000-create-user-follows.ts#L5).

### Optional authentication — contract and gap

OpenAPI marks `GET /articles/{slug}` “Auth not required” and declares 200/404/422, without a security requirement. Hurl fetches the detail without an Authorization header; its guest expectation is `favorited=false`, `favoritesCount=0` for the fixture. Existing `AuthTokenGuard` throws 401 for a missing or invalid token; the unguarded profile GET is the closest public-route pattern, but it does not personalize the response. Evidence: [OpenAPI detail route](../../spec/api/openapi.yml#L242), [Hurl detail case](../../spec/api/hurl/articles.hurl#L145), [required guard](../../src/auth/auth-token.guard.ts#L18), [public profile route](../../src/profiles/profiles.controller.ts#L41).

**Implementation implication:** do not attach `AuthTokenGuard` to the detail route. Use an optional guard/request context: no header means guest; a valid token supplies verified `sub`. Keep token parsing and verification in auth code, and pass only the optional username into the read service. The contract does not settle whether a malformed or expired optional token returns 401 or guest defaults; resolve and document that edge. Evidence: [guard token parsing](../../src/auth/auth-token.guard.ts#L22), [AuthService token verification](../../src/auth/auth.service.ts#L80), [public profile default](../../src/profiles/profile.serializer.ts#L12), [OpenAPI response list](../../spec/api/openapi.yml#L256).

### Bounded query plan — recommendation, inferred

| Rank | Shape | Query bound | Trade-offs |
| --- | --- | --- | --- |
| 1 | Article joined to author; ordered tag query; favorite count query; one personalized `EXISTS` query for reader-favorite and reader-follows-author | 3 guest queries; 4 authenticated queries | Clear mapping to existing entities and serializer context. No dependency or migration. Fits one detail result. |
| 2 | Same base/tag reads, with separate favorite and follow existence queries (and optional viewer lookup) | 4–6 fixed queries | Simplest repository calls; still O(1), but has more round trips. Use when it keeps code clearer. |
| 3 | Join tags and all favorite rows into one wide result, then aggregate in application code | Depends on relation cardinality | Reject: tag × favorite rows multiply, risk inflated counts/duplicate mapping, and more fragile row hydration. |

Keep reads keyed by the one article ID/slug; use `ArticleTag.position` for tags. Calculate `favoritesCount` independently from tag joins so multiple tags cannot inflate it. If personalized flags are combined, use scalar subqueries/`EXISTS` rather than joining every favorite row. The signed-in state query can correlate username (`TokenClaims.sub`) to a user row, or the service can resolve the viewer ID once and use the two composite keys. The simpler version is preferable while query count remains fixed. No article-read query helper exists yet; these are inferred from the schema and the existing service patterns. Evidence: [serializer context](../../src/articles/article.serializer.ts#L3), [join/favorite schema](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L22), [follow key](../../src/database/migrations/1710000002000-create-user-follows.ts#L5), [4A warning on aggregate joins](../260910-0930-medium-clone-backend/phase-04a-article-schema.md#L72).

Avoid per-tag repository calls and avoid loading all favorites to count them. Return a typed not-found result for an unknown slug before serialization; the Hurl contract expects 404 with `errors.article[0] == "not found"`. Evidence: [Hurl unknown article assertion](../../spec/api/hurl/articles.hurl#L252), [OpenAPI 404](../../spec/api/openapi.yml#L256), [shared error envelope](../../src/common/filters/api-exception.filter.ts#L44).

## Module and service fit

`ArticlesController` currently exposes only POST create. Add the detail GET action, typed 404 mapping, and its Swagger decorator. `ArticlesModule` is already imported by `AppModule`; it imports `AuthModule` and registers `Article`, `ArticleTag`, `ArticleFavorite`, and `Tag` through `TypeOrmModule.forFeature`. Add the read provider here. If using an injected `UserFollow` repository, add `UserFollow` to `forFeature`; alternatively follow `ArticleCreateService` and use `DataSource` repositories. Register/export any optional guard from `AuthModule`, which ArticlesModule already imports. `AuthModule` exports the required guard and `UserService`; `ProfilesModule` registers `UserFollow` locally, so `ProfileService` is not a reusable exported path. Evidence: [ArticlesController](../../src/articles/articles.controller.ts#L29), [ArticlesModule](../../src/articles/articles.module.ts#L12), [AuthModule exports](../../src/auth/auth.module.ts#L163), [ProfilesModule](../../src/profiles/profiles.module.ts#L9), [AppModule registration](../../src/app.module.ts#L15), [registration test](../../src/app.module.spec.ts#L10).

For a read-only service, `DataSource` is a good fit: it matches the current article create service and avoids expanding module/provider abstractions. No transaction is needed for this one read. `DatabaseModule` uses `autoLoadEntities`, with `synchronize` and `migrationsRun` disabled; preserve the hand-written migration path. Evidence: [ArticleCreateService](../../src/articles/article-create.service.ts#L27), [DatabaseModule](../../src/database/database.module.ts#L5), [4A persistence report](../reports/researcher-260928-phase-04a-persistence.md#L31).

## Test and verification patterns

- Vitest unit tests cover `src/**/*.spec.ts`; E2E covers `**/*.e2e-spec.ts`. Both load `test/setup/test-database.ts`, which maps configured `TEST_DATABASE_URL` to `DATABASE_URL`. Evidence: [unit Vitest config](../../vitest.config.ts#L8), [E2E config](../../vitest.config.e2e.ts#L7), [test DB setup](../../test/setup/test-database.ts#L1).
- Article creation has a mocked `DataSource`/`EntityManager` service unit fixture and real-Postgres transaction integration tests. HTTP E2E uses `createApp`, `supertest`, an `AuthService.authenticate` spy, UUID fixtures, and cleanup in `afterEach`. Reuse that split: unit test missing slug + context hydration/serializer input; E2E test guest GET, valid-token personalization, and 404; real DB coverage for ordered tags and favorite/follow flags if the endpoint needs query confidence. Evidence: [service unit test](../../src/articles/article-create.service.spec.ts#L24), [transaction integration test](../../test/create-article-transaction.integration.spec.ts#L23), [article E2E setup](../../test/create-article.e2e-spec.ts#L14).
- No existing query-count assertion or article read service was found. Keep query count bounded by design; if an explicit budget is added, test it through TypeORM query logging or a query-runner spy, not through serializer unit tests.

## Trade-offs, risk, and fit

| Option | Performance | Complexity / maintenance | Cost and adoption risk | Fit |
| --- | --- | --- | --- | --- |
| Fixed small set of TypeORM reads (recommended) | Constant round trips, indexed slug and composite-key lookups | Low; each query maps to a serializer field | No package or schema cost; uses mature stack already in production | Strong |
| One aggregate SQL query with correlated subqueries | Lowest round trips | Medium; raw aliases/type conversions and SQL hydration need care | No new dependency; query can be harder to change | Good only if measured need appears |
| New repository/ORM abstraction or dependency | Unproven for one endpoint | Highest ongoing surface | Adds migration/adoption risk without demonstrated reuse | Weak; YAGNI |

Architecture fit is strong for NestJS + TypeORM + PostgreSQL: existing entities and migrations already represent every needed fact, and the serializer deliberately requires context rather than querying. The main adoption risk is behavioral, not library maturity: optional auth has no precedent, especially for invalid supplied tokens. Avoid introducing a new data-access abstraction until multiple article reads need it.

## Limits and next steps

No source code was changed, no tests were run, and no external docs were needed: this task concerns local project patterns. I did not inspect a live database or benchmark alternate SQL shapes. The API does not define invalid-token behavior for public detail GET, and there is no existing article read implementation or query-count budget. Resolve the invalid-token case in the 4C contract, then add `GET /articles/:slug` with the existing serializer and fixed-query read service.
