# Phase 04G — GET /api/articles

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md) · [4F query foundation](./phase-04f-article-list-query.md) · [parent plan](./plan.md)
- [HTTP contract study](../reports/researcher-260928-phase-04g-contract.md) · [integration patterns](../reports/researcher-260928-phase-04g-patterns.md)
- [static OpenAPI](../../spec/api/openapi.yml) · [Hurl articles](../../spec/api/hurl/articles.hurl) · [Hurl pagination](../../spec/api/hurl/pagination.hurl)

## Overview and Dependency

- Priority: P1 · Status: implementation, tests, review, and CI complete; ready PRs #54/#55 are open and unmerged · Effort: 4h. Because the combined production change was 407 lines, split out the route-free body-free projection support as a separate PR above ready [PR #53](https://github.com/hungpv-2151/NestJS-tutorial/pull/53). The API PR contains exactly `GET /api/articles` and follows that support PR in the stack.
- 4F supplies AND filters, distinct pre-page count, stable `createdAt DESC, id DESC` order and a 100-item cap. 4G supplies the HTTP boundary, viewer personalization, batch relation reads and list serialization. 4H feed depends on this delivery but owns its route separately. No schema migration or package addition.
- Public contract has only `tag`, `author`, `favorited`, `offset`, `limit`. The umbrella note “Search case-insensitive” has no corresponding OpenAPI parameter or defined columns; defer search to a separate contract decision. Existing filter values use exact equality.

## Requirements and HTTP Contract

- `GET /api/articles` returns 200 `{ articles, articlesCount }`. List articles omit `body`; include public author profile, ordered `tagList`, `favorited`, `favoritesCount`, ISO dates. A valid filter with no matches returns `{ articles: [], articlesCount: 0 }`; no 404 for empty collections.
- Optional token: guest and valid token both succeed; any supplied malformed/invalid token is 401. Resolve a verified token subject to a current user **before** querying the page, including an empty page; a deleted subject returns 401. Never pass the raw request into the service.
- Query DTO accepts only the five documented keys. Convert `author` to `authorUsername` and `favorited` to `favoritedUsername` for 4F. Omitted `offset=0`, `limit=20`; `offset` is a safe integer ≥0, `limit` an integer 1–100. Reject malformed, fractional, negative, zero-limit, unsafe and over-100 values with 422 and the existing `{ errors: { field: [message] } }` envelope. Do not silently clamp. Preserve exact filter strings; do not invent trim, casing or length rules.
- Filter composition is AND. Count is after all filters and before offset/limit. Keep 4F ordering even for equal timestamps. Return `Cache-Control: private, no-store` because viewer fields vary. Map stale viewer to redacted token 401, query validation to 422, query/hydration failures to redacted 500 `{ errors: { body: ['request failed'] } }`. No list 404.
- Generated `/docs-json` and static OpenAPI show the same five query parameters, optional token alternatives, 200/401/422/500 responses, limit maximum 100 and defaults. Give the list operation its **own** limit/offset schema instead of changing shared `limitParam`/`offsetParam`, which feed also references. No `search` parameter.

## Architecture and Data Flow

`query DTO + verified optional subject → list controller → list service (resolve viewer once) → 4F count/page → batch tags/favorite totals/viewer favorites/follows → serializeArticleList → 200`.

1. Keep `ArticleListQueryService` as the filter/count/order owner. Project only list columns (`id`, `authorId`, `slug`, `title`, `description`, timestamps) and public author fields (`id`, `username`, `bio`, `image`); avoid reading unbounded `article.body` or private user fields for 100 rows. Expose a typed list-row result. Do not change its existing predicates, distinct count or page order.
2. `ArticleListService` resolves `viewerUsername` with one bound user lookup if present. Run 4F query. On an empty page, serialize `[]` with unchanged count and skip relation queries.
3. For a non-empty page, batch by page article IDs: one ordered `ArticleTag` + `Tag` query; one grouped `ArticleFavorite` query supplying counts and viewer-favorite membership (or one fixed additional viewer lookup if clearer); one `UserFollow` query for the distinct page author IDs only when authenticated. Default absent relations to `[]`, `0`, `false`. Validate parsed aggregate counts as safe nonnegative integers. Feed inputs to `serializeArticleList` without per-article detail reads. Guest relation work is independent of page length; authenticated work adds only a fixed viewer/follow cost.
4. Narrow the list serializer input type so `body` is required only for detail serialization. Leave detail output unchanged. Errors from any database read become a typed, non-sensitive list persistence error; controller maps it to the redacted 500 envelope. Bind every supplied filter, ID and viewer value.
5. `ArticleListController` owns route, optional guard, DTO, cache headers and typed error mapping. Register it and the list service in `ArticlesModule`. Keep the current detail/create/update/delete controllers and routes unchanged.

## RED Checkpoint — 2026-09-28

- Valid RED: `pnpm exec vitest run --config ./vitest.config.e2e.ts test/article-list.e2e-spec.ts --reporter=dot` exits 1 after the app/database and fixtures start: list GET returns missing-route 404; existing article detail control passes (1 passed, 1 failed).
- The hydration test's RED reaches the current missing list route after PostgreSQL setup. Its query-count and body-free projection assertions await the implementation.

## Delivery Evidence — 2026-09-28

- Route-free projection support is ready as [PR #54](https://github.com/hungpv-2151/NestJS-tutorial/pull/54) on #53, current support head `1bfcfdfdce5cd33e6fb240db58a2ff547c0203b7`; it contains the projection, body-free/clamp regressions, and a stable unique-author integration assertion. It adds no HTTP route; Static analysis passed.
- API is ready as [PR #55](https://github.com/hungpv-2151/NestJS-tutorial/pull/55) on #54; API implementation commit `90dbca8a`, request-log privacy fix `46580bb9`. Source-only API diff is 368 changed lines, under the 400-line hard cap. Later commits on the PR record plan/delivery evidence.
- Tests: `pnpm test` passed (193 passed, 1 skipped); `pnpm test:e2e` passed (20 files, 87 tests); `pnpm build` passed; `pnpm lint` passed (0 errors, 243 warnings); real PostgreSQL query/hydration integration passed; static OpenAPI parsed; `git diff --check` passed. GitHub Static analysis passed on #54 and #55.
- Independent review found no remaining code findings after the logging redaction fix. PR #54 validation: [initial comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/54#issuecomment-5865006355); latest head check passed. PR #55 validation: [local evidence](https://github.com/hungpv-2151/NestJS-tutorial/pull/55#issuecomment-5865020735), [CI result](https://github.com/hungpv-2151/NestJS-tutorial/pull/55#issuecomment-5865035968); add a post-rebase checkpoint comment before starting 4H implementation.

## Exact File Ownership and Implementation Steps

| Owner / action | Exact path under `/home/phamvanhung/projects/nestjs-tutorial` | Purpose |
| --- | --- | --- |
| Implementer / modify | `src/articles/article-list-query.service.ts` | Body-free list projection and typed row only; preserve 4F behavior. |
| Implementer / modify | `src/articles/article.serializer.ts` | Permit body-free list inputs while preserving detail output. |
| Implementer / create | `src/articles/article-list.dto.ts` | Strict five-key HTTP query validation and defaults. |
| Implementer / create | `src/articles/article-list.service.ts` | Viewer lookup, 4F call, orchestration and typed failures. |
| Implementer / create | `src/articles/article-list-hydrator.ts` | Fixed-count batch tags/favorites/follows and serialization inputs. |
| Implementer / create | `src/articles/article-list.controller.ts` | One `GET /articles` handler, optional guard, cache and error mapping. |
| Implementer / create | `src/articles/article-list.swagger.ts` | Focused operation docs, optional security, 200/401/422/500 and limit cap. |
| Implementer / modify | `src/articles/articles.module.ts` | Register list controller/service; reuse existing entities/guard/query provider. |
| Implementer / modify | `spec/api/openapi.yml` | List-only query/default/security/error docs; do not alter feed/shared parameter contracts. |
| Tester / create | `src/articles/article-list.dto.spec.ts` | Strict pagination conversion and validation boundaries. |
| Tester / modify | `src/articles/article.serializer.spec.ts` | Body-free list input and public-only output regression. |
| Tester / create | `test/article-list.e2e-spec.ts` | Real-DB list/filter/page/viewer/serializer and `/docs-json` assertions. |
| Tester / create | `test/article-list-errors.e2e-spec.ts` | Invalid query/token/stale viewer/persistence response paths. |
| Tester / create | `test/article-list-hydration.integration.spec.ts` | Real-DB batch correctness and recorded SQL query-count comparison. |
| Tester / modify | `spec/api/hurl/articles.hurl`, `spec/api/hurl/pagination.hurl` | Executable positive examples for list filters/page when useful. |
| Delete | None | No migration or data backfill. |

1. Confirm local branch and PR #53 head/base; audit `git diff` for unrelated work. All 4G code/test file ownership above is disjoint by role. Reuse the migrated `TEST_DATABASE_URL`; migrate only that test database if tables are absent. Never print either database URL.
2. Tester writes route E2E assertions first and records a **valid RED**: database/fixtures and app initialize, then requested list behavior fails because the route is absent. Existing `GET /articles/:slug` must remain green. Use unique fixture slugs/usernames and FK-safe cleanup; do not assert an exact global unfiltered count while parallel suites share the DB.
3. Implementer adds the route and batch service, then `pnpm build` immediately. Keep every code file <200 lines. Production changed lines target ≤300 and must remain ≤400. The route-free support split was required and is delivered first above #53; the API PR follows it and adds no other public API.
4. Run focused real-DB E2E/integration GREEN; then `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm lint` (zero errors), OpenAPI YAML parse, `/docs-json` contract assertions and `git diff --check`. Hand final code to an independent reviewer, fix correctness/security findings and rerun affected gates.
5. Commit scoped conventional changes, push, create the support PR based on #53, then create the **ready** API PR with the support branch as its direct base. Attach command/exit/commit-SHA evidence to the API PR. Update this phase, Phase 04 stack plan, roadmap and changelog to observed delivery before starting 4H; do not pause for manual review.

## Test Matrix and Observable Done

| Layer | Required proof |
| --- | --- |
| Unit | Strict DTO parsing for omitted, valid boundary and invalid offset/limit; list serializer omits `body` and private user fields. Add only tests that catch a real transformation or error-path risk. |
| PostgreSQL integration | 1-row and 3-row populated pages have equal recorded list/hydration SQL counts (guest and authenticated separately); ordered/missing tags, favorite totals/flags and follows correct. Query logger starts **after** fixtures. Empty page skips hydration. |
| HTTP E2E | Guest/authenticated 200, optional-token 401 including malformed token, stale valid subject 401, exact five filters and AND combination, unknown tag/author/favorited 200 empty, defaults, `limit=1` next page, max 100, past-end count, timestamp tie order, 422 invalid input, redacted 500, no `body` or private fields. Verify response cache header. |
| Contract and regression | Static OpenAPI and `/docs-json` list operation declare optional security, five keys, defaults/cap and 200/401/422/500; no 404/search/second route. Existing suites, build/lint and reviewer pass; PR ready with base #53 and scoped diff. |

## Risks, Compatibility, Security and Rollback

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| N+1 relation reads or large body transfer | Medium / High | Body-free projection, ID-batched hydration, SQL count invariant for page sizes 1 and 3. |
| Duplicate join rows distort counts/page | Medium / High | Keep 4F predicates/count untouched; hydrate after page and prove multi-tag/multi-favorite fixtures. |
| Token verifies after user deletion | Medium / High | Resolve viewer before page, even when results are empty; stale-subject E2E. |
| Query coercion admits `''`, decimals or unsafe integers | Medium / Medium | Strict DTO parsing and 422 boundary matrix; 4F defensive range check remains. |
| Swagger change silently changes feed contract | Medium / Medium | List-local parameter schemas; static/generated operation comparison and feed diff audit. |
| PostgreSQL aggregate count exceeds JS-safe range | Low / High | Parse and validate grouped counts before serialization; redacted 500 on impossible/failed read. |

- Compatibility: additive route on the existing schema; no existing route, stored data, migration or API envelope changes. Existing clients gain list support. Query semantics remain exact-match until an explicit search contract exists.
- Security: optional auth validates any supplied credential; public response projects only public fields; bind SQL parameters; no password/hash/JWT/raw identifiers in logs; private no-store cache; redacted persistence response.
- Rollback: revert the 4G PR and retain #53 internal foundation; dependent 4H+ PRs must be held or rebased. No data rollback is required.

## Todo List

- [x] Valid RED and real-DB GREEN evidence recorded.
- [x] Query count stable with page growth; full response shape and errors proven.
- [x] Static/generated docs and all required gates pass; reviewer signs off.
- [x] Route-free support PR above #53 and ready 4G API PR above support PR, with evidence URLs recorded here.
