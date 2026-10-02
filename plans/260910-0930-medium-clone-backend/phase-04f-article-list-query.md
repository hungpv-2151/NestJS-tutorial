# Phase 04F — Article List Query Foundation

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md) · [4E delete](./phase-04e-delete-article.md) · [4A schema](./phase-04a-article-schema.md)
- [Contract research](../reports/researcher-260928-phase-04f-contract.md) · [repository patterns](../reports/researcher-260928-phase-04f-patterns.md)
- [OpenAPI list operation](../../spec/api/openapi.yml) · [pagination Hurl](../../spec/api/hurl/pagination.hurl)

## Overview and Dependency

- Priority: P1 · Status: Delivered as ready [PR #53](https://github.com/hungpv-2151/NestJS-tutorial/pull/53) · Effort: 3h. One **route-free foundation PR**, directly based on `phase-04e-delete-article` / [PR #52](https://github.com/hungpv-2151/NestJS-tutorial/pull/52). Its PR body states `Public API change: none`.
- 4E supplies the article schema and settled stack base; 4F supplies the query/count/page seam required by 4G `GET /api/articles`, then 4H feed may reuse its bounded query pattern. No migration or new package.
- Existing `ArticleReadService.getBySlug()` handles one detail and performs relation reads per item; do not call it for each list row. Existing `serializeArticleList()` is ready for 4G but is outside this PR.

## Requirements and Decisions

- Input to the internal service: optional exact `tag`, `authorUsername`, `favoritedUsername`; required normalized integer `offset` (0 or greater) and `limit` (1–100). The service has no defaulting or HTTP DTO. Reject unsafe/out-of-range integer inputs defensively before any query; 4G owns HTTP validation and error mapping.
- Every supplied filter is combined with AND. A missing username or tag naturally yields an empty page and count 0. Bind all filter values as query parameters. Matching uses stored values with normal PostgreSQL equality; 4G must settle any different public matching policy before exposing the route.
- Return `{ articles: Article[], articlesCount: number }`, with each article's single-valued `author` relation loaded. `articlesCount` counts distinct matching article IDs **before** `offset`/`limit`. Page order is `article.createdAt DESC, article.id DESC`; an offset past the end returns `[]` and keeps the filtered count.
- Keep controller, route, HTTP DTO, Swagger/OpenAPI, Hurl, viewer personalization, tag/favorite/follow hydration, and `search` parameter out of 4F. OpenAPI has no `search` query parameter despite the phase overview's “Search case-insensitive” note; resolve that mismatch in 4G.

## Architecture and Data Flow

`typed normalized criteria → ArticleListQueryService → filtered Article QueryBuilder → distinct count → ordered bounded page with author → internal result → 4G batch hydration/serializer`.

1. Build a base `Article` query with `innerJoinAndSelect('article.author', 'author')`. Add `author.username = :authorUsername` when supplied. Add correlated `EXISTS` predicates for `article_tags` joined to `tags` and for `article_favorites` joined to `users`, each anchored on `article.id`. Child rows never multiply the outer article rows.
2. Clone the filtered base. The count clone explicitly selects `COUNT(DISTINCT article.id)` and has no order, skip, or take. Parse the PostgreSQL count into a safe number. The page clone adds `createdAt DESC`, then `id DESC`, then TypeORM `skip(offset).take(limit)`; return hydrated `Article` rows with author. Execute count before page, so no page bounds leak into count.
3. Wrap database failures in a focused typed persistence error whose outward message has no SQL/filter details. 4G maps it to the existing redacted 500 envelope. Do not log SQL parameters, usernames, or credentials.
4. The two reads are not one snapshot during concurrent writes; counts can change between statements. This is acceptable for the existing offset pagination contract and avoids a read transaction. No N+1 exists in 4F: two bounded statements per call, independent of page size.

## File Ownership and Steps

| Owner / action | Exact file | Change |
| --- | --- | --- |
| Implementer / create | `/home/phamvanhung/projects/nestjs-tutorial/src/articles/article-list-query.service.ts` | Export typed criteria/result and one query service; predicates, count, stable page, typed persistence error. |
| Implementer / modify | `/home/phamvanhung/projects/nestjs-tutorial/src/articles/articles.module.ts` | Register the new provider for 4G; no controller registration. |
| Tester / create | `/home/phamvanhung/projects/nestjs-tutorial/test/article-list-query.integration.spec.ts` | Real PostgreSQL fixtures/assertions using `TEST_DATABASE_URL`; split a fixture helper into a second focused test file only if the 200-line limit requires it. |
| Delete | None | No schema or public API change. |

1. Confirm PR #52 is the direct base, fetch current refs, and audit the base diff. Use the existing migrated **test** database; if article tables are missing there, apply the repository migrations against `TEST_DATABASE_URL` before testing. Never print either DB URL.
2. Tester seeds isolated UUID usernames/slugs/tags, writes the integration assertions, and records a valid RED caused by the absent list query service after database setup succeeds. Keep fixture cleanup in FK-safe order: articles, tags, users. Avoid exact unfiltered-count assertions while other test files share the database.
3. Implementer adds the service and module provider. Run `pnpm build` after code edits. Keep each code/test file under 200 lines; production changed lines target ≤300 and must stay ≤400. No controller, Swagger, spec, migration, or route hunk.
4. Run focused integration GREEN with the real `TEST_DATABASE_URL`, then `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `pnpm lint` (zero errors). Hand the final code to independent reviewer; fix correctness/security findings and rerun affected gates.
5. Audit `git diff` against #52 for no-route scope and line limits, commit with a conventional message, push, create a **ready** PR based on `phase-04e-delete-article`, and attach command/exit/SHA evidence in a PR comment. Update this phase and the Phase 04 plan, roadmap, and changelog to the actual delivered state before proceeding to 4G.

## Test Matrix and Observable Done

| Layer | Required proof |
| --- | --- |
| PostgreSQL integration | No filter returns seeded rows; each of tag, author, favorited filters works; combined filters are AND; unknown value returns count 0; several tags/favorites on one article do not duplicate rows or count; count stays unchanged across page 1, page 2, and an empty page; equal timestamps order by ID descending. Use unique scoped filters for exact counts. |
| Unit | Only add if a failure branch cannot be exercised clearly in integration; do not mirror QueryBuilder calls. Validate numeric range and persistence error behavior through meaningful service tests where needed. |
| End-to-end | Existing API suite remains green; no 4F HTTP route exists. New list-route E2E contract checks belong to 4G. |
| Build/review | `pnpm build` and `pnpm lint` exit 0; reviewer signs off; PR is ready with exact #52 base; production size and per-file limits pass. |

## Risks, Compatibility, and Rollback

## Verification Checkpoint — 2026-09-28

- RED: focused integration reached PostgreSQL and fixture setup, then failed because `ArticleListQueryService` did not exist. The migrated `TEST_DATABASE_URL` database was ready; no migration was needed.
- GREEN: focused PostgreSQL integration passed (1 test); `pnpm test` passed (39 files; 161 passed, 1 skipped); `pnpm test:e2e` passed (16 files; 60 passed); `pnpm build` passed; `pnpm lint` passed with 0 errors and 223 warnings; `git diff --check` passed.
- Independent review signed off after adding assertions for unfiltered fixture results and loaded author relation. The test covers AND filters, correlated `EXISTS` cardinality, filtered count before page, empty/past-end pages, and `createdAt DESC, id DESC` ties.
- Service and integration test are 136 and 143 lines respectively; production scope is one service plus provider registration. No route/controller or migration was added.
- Ready-PR validation evidence: [PR #53 comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/53#issuecomment-5864274902). GitHub Static analysis completed successfully; PR #53 is CLEAN and ready.

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| Join multiplication gives false count/page | Medium / High | Correlated `EXISTS`, explicit distinct count, multi-tag/multi-favorite PostgreSQL fixtures. |
| Paging drifts on equal timestamps | Medium / Medium | ID tie-break and two-page tie fixture. |
| Shared test DB makes unfiltered assertions flaky | Medium / Medium | Unique fixture keys and exact count only under isolated filters; no global destructive cleanup. |
| Raw SQL or invalid pagination reaches DB | Low / High | Bound parameters and pre-query safe-integer/range checks; typed redacted persistence error. |
| Scope/size drifts into 4G | Medium / Medium | One service, one provider registration, one integration spec; route/diff audit before PR. |

- Compatibility: additive internal provider only. Existing routes, envelopes, migrations, and stored data do not change. Roll back by reverting the 4F PR; dependent 4G+ PRs must then be rebased or held. No data migration or backfill is needed.
- Next: continue with 4G `GET /api/articles` HTTP contract/API on top of PR #53; own HTTP defaults and validation, optional auth, batch relation hydration, list serialization and response contract. Keep query statements bounded as page size grows; do not introduce per-item detail reads.
