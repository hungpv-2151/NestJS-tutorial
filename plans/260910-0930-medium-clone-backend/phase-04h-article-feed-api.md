# Phase 04H — GET /api/articles/feed

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md) · [4F query foundation](./phase-04f-article-list-query.md) · [4G list API](./phase-04g-article-list-api.md) · [parent plan](./plan.md)
- [static OpenAPI](../../spec/api/openapi.yml) · [feed Hurl](../../spec/api/hurl/feed.hurl) · [feed Bruno](../../spec/api/bruno/feed/07-main-checks-feed.bru) · [no-auth example](../../spec/api/bruno/errors-articles/05-get-feed-no-auth.bru)
- Base: ready [Phase 4G PR #55](https://github.com/hungpv-2151/NestJS-tutorial/pull/55), branch `phase-04g-article-list-api`, verified current head `f473dbb368d7cfb04fb94f1b1c0875ad8aa92bce` on 2026-09-28; its Static analysis check passed.

## Overview

- Priority: P1 · Status: Pending · Effort: 4h · Dependency: Phase 4G PR #55. Deliver **one ready PR stacked directly on `phase-04g-article-list-api`**, adding only `GET /api/articles/feed`. No foundation PR, migration, dependency, or second public route.
- Reuse 4F count/page ordering and 4G body-free projection, batch hydration, serialization, typed errors, and viewer lookup. Feed adds an internal followed-author predicate and a required-auth HTTP boundary.

## Key Insights and Contract Decisions

- OpenAPI `GetArticlesFeed` explicitly requires Token auth, accepts only `offset` and `limit`, documents 200/401/422, and uses `MultipleArticlesResponse`. Hurl/Bruno prove an empty feed, two followed-author articles, `limit=1`, `offset=1`, omitted `body`, and `author.following=true`.
- OpenAPI gives `limit` default 20 and minimum 1. It gives `offset` minimum 0 but **no explicit default**, and no feed maximum. Phase 04 and existing 4F/4G pagination establish effective `offset=0` and `limit≤100`; document those values in the feed operation itself. This is a contract clarification, not a claim that static OpenAPI already says it. Keep shared `offsetParam`/`limitParam` untouched.
- Static OpenAPI has no feed 500 response. A redacted 500 follows the existing 4G persistence-error policy; add this response to the **feed operation only**. No feed search, tag, author, or favorited query is defined; reject extra keys with 422. Searchable fields and behavior remain unspecified and outside 4H.

## Requirements

- Authenticated `GET /api/articles/feed` returns 200 `{ articles, articlesCount }` containing only articles whose `authorId` belongs to a user followed by the verified viewer. No follows or no matches returns `{ articles: [], articlesCount: 0 }`, never 404. An offset past the page returns `[]` with the pre-page filtered count.
- Stable order: `createdAt DESC, id DESC`. Defaults: `offset=0`, `limit=20`; integer bounds: offset safe and ≥0, limit safe and 1–100. Malformed, zero/negative, fractional, unsafe, over-limit, or unknown query inputs return the existing field-keyed 422 envelope. No filters beyond pagination.
- Missing token returns `{ errors: { token: ['is missing'] } }` 401; malformed/invalid token and verified token for a deleted user return redacted `token: ['is invalid']` 401. Resolve the current user before querying, including an empty feed. Query/hydration failures return `{ errors: { body: ['request failed'] } }` 500.
- Reuse list item shape: public author profile, ordered tags, ISO dates, `favorited`, `favoritesCount`, `author.following`; omit article `body`, email, hash and private user fields. Return `Cache-Control: private, no-store`.

## Architecture and Data Flow

`Token guard → verified subject + pagination DTO → feed controller → list service resolves viewer ID → 4F query with EXISTS(follow for viewer, article.authorId) → distinct count + stable page → 4G batch hydrator → list serializer → 200`.

1. Add an **internal** `followedByUserId` criterion to `ArticleListQueryService`. Apply a bound `EXISTS` against `user_follows(follower_id, following_id)` before cloning count/page queries. Keep other filters, projection, count semantics, and order unchanged. `EXISTS` avoids duplicate articles and leaves future tag/favorite joins independent.
2. Add a `feed` entry point to `ArticleListService` that shares its existing viewer resolution, query, empty-page shortcut, hydration, serialization, and typed error path with `list`. Pass the resolved viewer **database ID** into the internal criterion; never trust an ID or follow target from a query parameter. Preserve global list behavior.
3. Extract the current strict offset/limit parsing and decorators into a small shared pagination DTO; let `ArticleListQueryDto` inherit it and let feed use only the pagination DTO. This keeps validation identical without accepting global-list filters on feed.
4. Add a dedicated feed controller and Swagger decorator. Register the feed controller before the dynamic `GET /articles/:slug` controller in `ArticlesModule`, then prove `/feed` is never captured as a slug. Use `AuthTokenGuard`, not optional auth; keep the controller at the HTTP boundary.
5. Document only the feed operation in static OpenAPI and generated `/docs-json`: required Token, exactly two parameters, defaults/cap, 200/401/422/500, and no `body` in list items. Keep list/detail docs and routes unchanged.

## File Ownership

| Owner / action | Exact path under `/home/phamvanhung/projects/nestjs-tutorial` | Purpose |
| --- | --- | --- |
| Implementer / modify | `src/articles/article-list-query.service.ts` | Bound follower `EXISTS` criterion in count/page query. |
| Implementer / modify | `src/articles/article-list.service.ts` | Shared list/feed orchestration, resolve viewer once, typed failures. |
| Implementer / modify | `src/articles/article-list.dto.ts` | Inherit shared pagination DTO without changing list filters. |
| Implementer / create | `src/articles/article-pagination.dto.ts` | Strict shared offset/limit transform, defaults, and cap. |
| Implementer / create | `src/articles/article-feed.controller.ts` | Only feed route, required auth, cache and typed HTTP errors. |
| Implementer / create | `src/articles/article-feed.swagger.ts` | Feed-only generated operation contract. |
| Implementer / modify | `src/articles/articles.module.ts` | Register feed controller before slug controller. |
| Implementer / modify | `spec/api/openapi.yml` | Feed operation parameters/defaults/cap and 500 only. |
| Tester / modify | `src/articles/article-list.dto.spec.ts` | Regression for inherited list pagination validation. |
| Tester / create | `src/articles/article-pagination.dto.spec.ts` | Feed-only boundary/unknown-key validation. |
| Tester / create | `test/article-feed-query.integration.spec.ts` | PostgreSQL follower predicate, count/order/page, no duplicates. |
| Tester / create | `test/article-feed.e2e-spec.ts` | Authenticated feed, shape, pagination, route precedence, `/docs-json`. |
| Tester / create | `test/article-feed-errors.e2e-spec.ts` | 401/422/stale subject/redacted 500. |
| Tester / modify | `spec/api/hurl/feed.hurl` | Existing executable feed scenarios; add focused boundary assertion if useful. |
| Delete | None | No data migration or backfill. |

Implementation and test ownership are disjoint; no two parallel workers edit the same file. Keep each code file <200 lines. This PR targets ≤300 and must stay ≤400 changed production-code lines under the parent plan's counting rule. If it exceeds 400, reduce duplication or scope before opening the PR; do not add another public API or hide code in tests.

## Implementation Steps and Dependencies

1. **Base gate:** refresh and verify PR #55 remains ready and the direct stack base; branch from its current head, rebase if it moved, and audit the diff. Do not overwrite unrelated working-tree changes. Base was verified at `f473dbb368d7cfb04fb94f1b1c0875ad8aa92bce`; confirm again before implementation.
2. **RED:** tester adds a real-database feed E2E that reaches the initialized app/fixtures, fails on missing `GET /feed`, and keeps `GET /articles/:slug` green. Record exact command, exit code and route assertion. Add focused query/validation cases; a DB setup failure is not valid RED.
3. **GREEN:** implement shared pagination DTO, bound follow predicate, feed service entry point, controller, registration and docs in that order; run `pnpm build` after each code-file change. Keep unrelated global-list behavior green.
4. **Verify:** run focused PostgreSQL integration/E2E, then `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm lint` (zero errors), static OpenAPI parse, generated `/docs-json` assertions, `git diff --check`, production-line count, and independent review. Fix findings and rerun affected gates. Run Hurl feed against the available test app when configured; record if unavailable rather than claiming it passed.
5. **Deliver:** conventional scoped commit, push, ready PR with **direct base** `phase-04g-article-list-api`, then PR evidence comment with command/result/exit/commit SHA and screenshot per parent governance. Update this plan, Phase 04 status, roadmap and changelog only to observed results. 4I starts from the delivered 4H branch.

## Test Matrix and Observable Done

| Layer | Required proof |
| --- | --- |
| Unit | Shared parser preserves list defaults/boundaries; feed DTO permits only pagination; unknown keys and invalid numeric forms produce 422. |
| PostgreSQL integration | Followed vs non-followed/own authors, zero follows, unfollow change, multiple followed authors, equal-timestamp `id` tie, pre-page distinct count, past-end page, and 1 vs 3 row bounded query count. |
| HTTP E2E | 200 envelope/fields, omitted body/private fields, `favorited` and `following` viewer state, defaults/limit/offset/cap, 401 missing/invalid/stale subject, 422 invalid/extra query, redacted 500, cache header, `/feed` route wins over `/:slug`. |
| Contract/regression | Static and generated feed docs agree on exactly two params, required Token, defaults/cap and 200/401/422/500; global list/detail tests remain green; build/lint/review pass; one ready PR based directly on #55 within line cap. |

## Risk Assessment, Compatibility, Security and Rollback

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| `/feed` resolves as article slug | Medium / High | Register static controller first; HTTP regression verifies correct route. |
| Follow join duplicates articles or distorts count | Medium / High | Use bound `EXISTS`, retain distinct pre-page count, test multi-author/timestamp/page fixtures. |
| Feed leaks articles for stale/deleted viewer | Medium / High | Required guard plus current-user lookup before count, even for zero rows; stale-subject E2E. |
| N+1 hydration or body transfer | Low / High | Reuse 4G body-free projection and batched hydrator; SQL-count and response-shape assertions. |
| Shared pagination extraction changes global list validation | Medium / Medium | Inheritance regression for every prior boundary; full 4G E2E suite. |
| Static/generated contracts drift | Medium / Medium | Feed-local OpenAPI parameters, `/docs-json` comparison; no edits to shared parameter definitions. |

- Compatibility: additive route on existing `articles`, `users` and `user_follows` data; no migration or client behavior change to global list/detail. Count and page are two reads, so concurrent writes may change them between statements, as in 4F.
- Security: only verified token subject determines follower scope; all SQL values bound; no raw token, hash, password or personal identifier in logs; private no-store response and redacted persistence errors.
- Rollback: revert the 4H PR from the stack, leaving #55 list behavior and schema intact. Hold or rebase dependent 4I+ PRs before removing 4H; no data rollback.

## Todo List

- [ ] Confirm #55 base/head and record valid feed RED.
- [ ] Implement only feed route within production line/file caps; focused/full gates and reviewer pass.
- [ ] Ready 4H PR directly above #55 with evidence URL; update observed phase status.

## Next Steps

- After 4H delivery, begin 4I `POST /api/articles/:slug/favorite` on the 4H branch; do not include it in 4H.
