# Phase 04F — Article-list query foundation patterns

Date: 2026-09-28
Scope: read-only repository research for the no-route foundation behind `GET /api/articles`. No code changed.

## Preflight

The required `Skill(tkm:help)` / `Skill(tkm:research)` / `Skill(tkm:search-docs)` activator is not exposed in this agent's callable tools. `tkm --help` lists CLI setup/config commands, not skill activation. I used the repository files and primary TypeORM/PostgreSQL documentation as fallback. This is a tooling limitation, not a research blocker.

## Recommendation

Add one internal `ArticleListQueryService` in 4F. It should take typed query criteria and pagination, compose all supplied criteria with AND, run a filtered count and a deterministically ordered page query, and expose no controller/route. Keep the HTTP DTO, query parsing/validation, Swagger and Hurl changes in 4G.

Use correlated `EXISTS` for collection-backed filters (tag and favorited user), while keeping the outer rowset one row per article. Join only the single-valued article author relation for list entities. Count from the same filtered criteria before applying page bounds; order every page by `createdAt DESC, id DESC`. Do not return/expose a mutable `SelectQueryBuilder` to the controller.

For 4G response serialization, hydrate page relations in a bounded number of batch queries keyed by the page's article IDs: ordered tags, favorite counts/viewer-favorite flags, and viewer-follow flags. Reuse `serializeArticleList`; do not call `getBySlug()` once per list item. A list read does not need a write transaction. Keep viewer identity as a verified user ID/subject passed into the service; keep `Request`, guards and HTTP exceptions at the controller edge.

## Evidence and findings

| Finding | Evidence from this repository | Independent primary reference |
|---|---|---|
| Paging needs a stable tie-breaker and the matching indexes already exist. | The phase contract specifies `createdAt DESC, id DESC` and count-after-filter/before-page ([phase 04 plan](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L12)); pagination Hurl expects newest-first and stable page boundaries ([pagination.hurl](../../spec/api/hurl/pagination.hurl#L45)); Article entity declares created/author composite indexes ([article.entity.ts](../../src/articles/article.entity.ts#L13)) and migration creates both indexes with descending keys ([article migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L38)). PostgreSQL documents B-tree ordered scans and mixed-direction multicolumn index behavior ([Indexes and ORDER BY](https://www.postgresql.org/docs/15/indexes-ordering.html)). | PostgreSQL ordering docs + the repository's three contract/schema sources above. |
| Filters are known, but filter-combination and favorite-filter coverage are missing. | OpenAPI exposes `tag`, `author`, `favorited`, `offset`, and `limit` ([openapi.yml](../../spec/api/openapi.yml#L181)); Hurl currently covers author, tag, and page count/order but has no `favorited=` or combined-filter request ([articles.hurl](../../spec/api/hurl/articles.hurl#L63), [pagination.hurl](../../spec/api/hurl/pagination.hurl#L45)); the roadmap says filters are AND ([phase 04 plan](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L17)). | TypeORM documents parameterized and composable `.andWhere()` predicates ([Select Query Builder](https://typeorm.io/docs/query-builder/select-query-builder/)); the OpenAPI, Hurl and roadmap sources above define repository-specific behavior. |
| Existing constraints/indexes support single-value collection filters without a schema change. | `article_tags` has PK `(article_id, tag_id)`, unique position, and `(tag_id, article_id)` lookup index ([ArticleTag](../../src/articles/article-tag.entity.ts#L14), [migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L21)); tag names are unique ([Tag](../../src/tags/tag.entity.ts#L3)); favorites have PK `(article_id, user_id)` plus reverse `(user_id, article_id)` index ([ArticleFavorite](../../src/articles/article-favorite.entity.ts#L5), [migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts#L31)). | PostgreSQL `EXISTS` preserves at most one outer row even with multiple matching child rows and can stop after finding a match ([Subquery Expressions](https://www.postgresql.org/docs/current/functions-subquery.html)); TypeORM QueryBuilder supports parameterized predicates and subqueries ([Select Query Builder](https://typeorm.io/docs/query-builder/select-query-builder/)); entity and migration declarations above confirm fit. |
| List serialization already omits `body`; detail reads are not safe to loop over for a page. | `serializeArticleList` maps list entries without `body` ([article.serializer.ts](../../src/articles/article.serializer.ts#L21)); detail read performs tag, favorite-count, optional favorite and follow reads for one article ([article-read.service.ts](../../src/articles/article-read.service.ts#L18)); list Hurl expects tags, favorite fields and public author in each item ([articles.hurl](../../spec/api/hurl/articles.hurl#L45)). | TypeORM recommends avoiding repeated per-record queries with QueryBuilder joins/raw selection ([Efficient use of QueryBuilder](https://typeorm.io/docs/performance-optimization/efficient-use-of-query-builder/)); the serializer, read implementation and contract above show the local impact. |
| List personalization should use the established verified-subject boundary. | Optional auth guard leaves requests anonymous only when the header is absent; malformed supplied auth is rejected ([optional-auth-token.guard.ts](../../src/auth/optional-auth-token.guard.ts#L12)); the controller passes `auth.sub` to the read service and maps typed errors at the HTTP boundary ([articles.controller.ts](../../src/articles/articles.controller.ts#L64)); detail reader resolves viewer and personalizes favorite/follow values ([article-read.service.ts](../../src/articles/article-read.service.ts#L33)). | The update path passes its transaction `EntityManager` to the detail reader only where transaction consistency is required ([article-update.service.ts](../../src/articles/article-update.service.ts#L25)); TypeORM supports query builders on a manager ([Select Query Builder](https://typeorm.io/docs/query-builder/select-query-builder/)). |

### Query and count shape

1. Build one typed criteria object; bind every value. `author` can use the joined `ManyToOne` author. Use `EXISTS` subqueries for exact tag membership and favorites-by-user so the outer Article query remains one row per article. Compose each supplied predicate with `AND`.
2. Clone/use the filtered query for the count without `skip`/`take`; use a second clone for `skip(offset).take(limit)` and explicit `orderBy(createdAt, DESC).addOrderBy(id, DESC)`. TypeORM explicitly warns that SQL `limit`/`offset` can misbehave with joins/subqueries and recommends `take`/`skip` for QueryBuilder pagination ([official docs](https://typeorm.io/docs/query-builder/select-query-builder/)).
3. If a collection join must enter the outer query, count distinct article IDs and page distinct IDs before loading relation data. Do not aggregate favorites over a join that also expands tags: the tag × favorite row product inflates favorite counts.
4. Use the existing index set first. Article global/author sort indexes, tag reverse lookup index, favorite user reverse index, and favorites primary key all align with current access paths. Add no migration until realistic `EXPLAIN (ANALYZE, BUFFERS)` evidence shows a gap. PostgreSQL notes that leading columns govern multicolumn B-tree efficiency ([Multicolumn Indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html)).

### Trade-off matrix (ranked)

| Rank | Pattern | Performance | Complexity / maintenance | Adoption risk / project fit |
|---:|---|---|---|---|
| 1 | Filter with `EXISTS`; separate filtered count/page; batch-hydrate page fields. | Stable one-row article cardinality; indexes can serve tag/favorite membership; query count stays bounded as page size grows. | Moderate, explicit and testable; avoids distinct/grouping work and count surprises. | Low: PostgreSQL + TypeORM QueryBuilder are already in use; no dependency or schema migration. Best fit. |
| 2 | Join child relations, then use `COUNT(DISTINCT article.id)` and page article IDs before hydration. | Can work, but expands rows and may require distinct/sort work. Tag/favorite aggregation can multiply. | Moderate-to-high; distinct/count/page ordering must stay aligned. | Low package risk, medium correctness risk. Keep only if query plan proves it faster and integration tests prove cardinality. |
| 3 | Fetch a page then call `ArticleReadService.getBySlug()` for each row. | N+1: every item repeats relation lookups; load grows with page size. | Very simple initially; expensive and slower to fix once route tests depend on it. | No adoption risk, poor fit for the required 20–100 item page and roadmap's no-N+1 criterion. Reject. |
| 4 | One custom SQL CTE/lateral-aggregate query for page + all response fields. | Potentially fewest round trips and a single statement snapshot. | Highest SQL/type mapping burden; harder to evolve alongside TypeORM entities. | No new package risk, but unnecessary at current scale and contrary to KISS until measured bottlenecks justify it. Defer. |

## 4F / 4G boundary and tests

- **4F (no route):** query service and real-Postgres integration tests only; no controller, DTO, route, OpenAPI, or Hurl mutation. Keep each source file under 200 lines and production diff under 300 preferred / 400 hard. `article-read.service.ts` is already 130 lines, so do not append list query + hydration there; use a focused service/module provider.
- **4F integration tests:** same `TEST_DATABASE_URL` setup used by article mutation integration tests; seed through isolated UUID names and clean by article/user IDs. Existing integration tests initialize explicit entity sets and skip only when the test DB URL is absent ([create transaction test](../../test/create-article-transaction.integration.spec.ts#L1), [test DB setup](../../test/setup/test-database.ts#L1)).
- **4G contract/E2E tests:** tie `createdAt` on multiple articles and assert `id DESC` tie-break; assert limit/offset pages do not overlap; filtered count remains identical on each page and on an empty page beyond the end; combine tag + author + favorited filters (AND); create multiple tags/favorites per articles and assert one article row, exact count and accurate `favoritesCount`; check ordered tags, body omission, guest/valid-viewer flags, invalid supplied token, and query count bounded for one versus several results.
- Add a test that makes the page count query include all filters but no pagination; do not test only serializer output. Confirm real PostgreSQL execution because the core risk is SQL cardinality/order, not DTO formatting.

## Adoption, source credibility, and limits

- **Credibility:** highest are the project's OpenAPI/Hurl contracts, migrations, and tests; they define this repository's expected behavior. Next are TypeORM and PostgreSQL primary docs. The repository pins installed TypeORM `1.1.1` through `pnpm-lock.yaml` ([package.json](../../package.json#L31), lock entry at `pnpm-lock.yaml#L3235`); validate behavior on that installed version. No new library is recommended. Older community issue reports about `getCount()` were not used as evidence because they target older versions and are lower-confidence than current official docs + a real-DB test.
- **Performance limit:** no production data volume or query plan was available, so index adequacy is structural only. Do not claim a benchmark win; check `EXPLAIN ANALYZE` after representative fixtures or staging data exist.
- **Unresolved contract mismatch:** the phase summary says “Search case-insensitive,” but current OpenAPI exposes no search term and Hurl has no search test. Do not silently add a `search` query parameter. Resolve this in 4G's contract/scope before implementation.
- Current OpenAPI documents `limit` default 20 and minimum 1, while the phase requirement adds max 100; `offset` has minimum 0 but no maximum. 4G should make the runtime and schema limits agree.
- Hurl does not specify case matching or behavior for unknown `author` / `favorited` usernames. Treat those as 4G contract decisions; do not let 4F bake in unspecified behavior.

## References

- [TypeORM Select Query Builder](https://typeorm.io/docs/query-builder/select-query-builder/)
- [TypeORM efficient QueryBuilder use](https://typeorm.io/docs/performance-optimization/efficient-use-of-query-builder/)
- [TypeORM find options](https://typeorm.io/docs/working-with-entity-manager/find-options/)
- [PostgreSQL EXISTS/subquery expressions](https://www.postgresql.org/docs/current/functions-subquery.html)
- [PostgreSQL multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
- [PostgreSQL indexes and ORDER BY](https://www.postgresql.org/docs/15/indexes-ordering.html)
