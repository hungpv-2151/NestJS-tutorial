# Phase 04I — POST /api/articles/:slug/favorite

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md) · [4H feed API](./phase-04h-article-feed-api.md) · [parent plan](./plan.md)
- [OpenAPI favorite operation](../../spec/api/openapi.yml) · [Hurl favorites](../../spec/api/hurl/favorites.hurl) · [Bruno favorite](../../spec/api/bruno/favorites/03-favorite-article.bru) · [Hurl errors](../../spec/api/hurl/errors_articles.hurl) · [Bruno no auth](../../spec/api/bruno/errors-articles/06-favorite-no-auth.bru) · [Bruno unknown slug](../../spec/api/bruno/errors-articles/15-favorite-unknown-slug.bru)
- [development rules](../../.claude/rules/development-rules.md) · [article read service](../../src/articles/article-read.service.ts) · [favorite entity](../../src/articles/article-favorite.entity.ts)

## Overview

- Priority: P1 · Status: Submitted · Effort: 4h · Dependency: delivered 4H [PR #56](https://github.com/hungpv-2151/NestJS-tutorial/pull/56). After PRs #31–#56 merged, this PR is based directly on `master` and contains only `POST /api/articles/:slug/favorite`. Do not implement `DELETE /api/articles/:slug/favorite` (4J).
- Before branching, PR #56 was OPEN, ready, CLEAN, Static analysis SUCCESS, head `18b1ddd3d6a0f4e873743a016ffda8b4514b468c`, base `phase-04g-article-list-api` on 2026-09-28. Branch `phase-04i-favorite-article-api` started at that exact commit.

## Key Insights and Requirements

- OpenAPI requires `Token` auth, path `slug`, no request body, 200 `{ article: Article }`, and documents 401/404/422. Hurl and Bruno require `favorited: true`, `favoritesCount: 1` after the first call, and persistence through a later GET. No-auth and unknown-slug fixtures already exist.
- Favorite is idempotent for one viewer: repeat and concurrent POSTs create one `(article_id, user_id)` row and return 200 with count 1 when there are no other favorites. A second viewer creates another row and raises the count to 2; the first viewer's repeat does not raise it further. Any authenticated user may favorite any article, including their own.
- Missing/unsupported authorization returns 401 `{ errors: { token: ['is missing'] } }`; invalid Token or deleted viewer returns 401 `token: ['is invalid']`. Unknown slug returns 404 `{ errors: { article: ['not found'] } }`. Database/read failures return redacted 500 `{ errors: { body: ['request failed'] } }`. Preserve the static 422 contract; this body-free route needs no DTO or invented validation rule.
- Return the existing **detail** serializer shape, including body, ordered tags, public author, ISO dates, viewer `favorited` and `author.following`, and current `favoritesCount`. Never expose user email, hash or token. Send `Cache-Control: private, no-store`.
- Existing `ArticleFavorite` composite primary key and index are sufficient. Add no schema change, migration, dependency, counter column, or cache.

## Architecture and Data Flow

`Token guard → verified username + slug → favorite controller → ArticleFavoriteService → transaction (lock viewer row → lock article row → INSERT ... ON CONFLICT DO NOTHING → ArticleReadService.getBySlug(slug, username, manager)) → 200 detail`.

1. Put the mutation in `ArticleFavoriteService`; the controller accepts route/auth input and delegates. The service maps typed failures to HTTP exceptions with the documented error envelopes. Resolve the viewer from the verified subject **before** the article lookup, including the unknown-slug path. Never accept a viewer ID from request data.
2. Within one PostgreSQL transaction, lock the verified viewer row first, then find the article by slug with a row lock. This prevents a concurrent username change from invalidating the serializer's second viewer lookup and prevents delete/update from changing the target before insert and detail read. Insert `(articleId, userId)` with TypeORM conflict-ignore semantics backed by the composite PK; do not perform check-then-insert. Do not swallow non-duplicate SQL failures. The locks and unique constraint make same-user concurrent POSTs safe; keep lock ordering viewer → article consistent with existing mutations.
3. Call `ArticleReadService.getBySlug(slug, username, manager)` **inside the same transaction** after the insert. Reuse its serializer and relation lookups, so the returned detail sees this viewer's favorite and no separate article response builder is needed. Roll back the insert if serialization/read fails. Keep `updatedAt` unchanged: a favorite changes a join row, not article content.
4. Register a dedicated favorite controller/service in `ArticlesModule`; retain feed route precedence. Add a dedicated Swagger decorator using the existing article detail response schema or a small shared export if practical. Document required Token, no `requestBody`, 200/401/404/422 and redacted 500 on this operation only. Keep static OpenAPI and `/docs-json` aligned without editing 4J's DELETE operation.

## File Ownership

| Owner / action | Exact path under `/home/phamvanhung/projects/nestjs-tutorial` | Purpose |
| --- | --- | --- |
| Implementer / create | `src/articles/article-favorite.service.ts` | Transaction, idempotent insert, typed HTTP errors, detail read. |
| Implementer / create | `src/articles/article-favorite.controller.ts` | POST route, required guard, cache headers, and service delegation. |
| Implementer / create | `src/articles/article-favorite.swagger.ts` | Generated POST operation contract only. |
| Implementer / modify | `src/articles/articles.module.ts` | Register favorite controller/service. |
| Implementer / modify only if needed | `src/articles/articles.swagger.ts` | Export existing detail schema to avoid a duplicate; no other route changes. |
| Tester / create | `test/article-favorite-create.e2e-spec.ts` | Success, repeat/concurrent POST, second viewer, and article-delete race on PostgreSQL. |
| Tester / create | `test/article-favorite-errors.e2e-spec.ts` | 401/404, redacted 500/rollback, `/docs-json`, and no request body contract. |
| Contract / modify | `spec/api/openapi.yml` | Add POST-local redacted 500 response if generated docs include it; preserve existing 200/401/404/422 and DELETE. |
| Delivery docs / modify after verified PR | `plans/260910-0930-medium-clone-backend/phase-04i-favorite-article-api.md`, `plans/260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md`, `plans/260910-0930-medium-clone-backend/plan.md`, `docs/development-roadmap.md`, `docs/project-changelog.md` | Record observed status, evidence link and stack progress; documentation owner checks accuracy. |
| Delete | None | No migration or backfill. |

Implementation and test ownership are disjoint. This plan file is the only planning edit before implementation. Keep each code file under 200 lines; prefer ≤300 and enforce **≤400 changed production-code lines** for the PR under the Phase 04 counting rule. If the cap is exceeded, reduce duplication or split internal support without introducing another public API.

## Implementation Steps and Dependencies

1. **Base gate:** fetch PR #56 status/head/base/checks; start 4I from its current head, preserve unrelated worktree edits, and verify the branch diff contains no 4H or 4J changes. Rebase if #56 moved. This gate precedes all 4I code.
2. **RED:** add a real-app PostgreSQL E2E that creates users/article, POSTs favorite with `Token`, and fails specifically because the route is absent. Add duplicate/second-viewer/persistence, 401/404, and a real two-request concurrency test. Record command, exit code and failing assertion; DB/setup failures do not count as RED. Existing Hurl `favorites.hurl` includes 4J DELETE, so run its POST subset or Bruno `03-favorite-article.bru` until 4J lands.
3. **GREEN:** implement service, controller, module wiring and Swagger/static operation docs in dependency order. Run `pnpm build` after each code-file change. Do not edit the favorite entity or migration.
4. **Verify:** run focused real-DB E2E/integration, `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm lint` with zero errors, static OpenAPI parse, `/docs-json` assertions, `git diff --check`, line count, and independent reviewer. Run the Bruno/Hurl POST contract against an available test app; report unavailable tooling honestly. Fix findings and rerun affected gates.
5. **Deliver:** conventional scoped commit, push, one ready PR with direct base `phase-04h-article-feed-api`; attach command/result/exit/commit SHA and screenshot evidence per Phase 04 governance. Update delivery docs only with observed results. 4J branches from delivered 4I.

## Test Matrix and Observable Done

| Layer | Required proof |
| --- | --- |
| Unit | Service typed errors, conflict-ignore path, transaction manager handed to `ArticleReadService`; no separate serializer logic. Test only logic not already covered by real-DB cases. |
| PostgreSQL-backed E2E | Same-user sequential and concurrent POSTs leave one PK row; other viewer adds exactly one; failed detail read rolls back new row; concurrent article DELETE leaves no orphan or favorite row. |
| HTTP E2E | 200 full article detail and cache header; own/non-owner favorite; repeat 200/count unchanged; second viewer count +1; later authenticated GET and favorited list reflect persisted join; guest GET sees count but `favorited: false`; no body/private fields leak. 401 missing/unsupported/invalid/stale subject, 404 unknown slug, generic 500 with no secret text. |
| Contract/regression | Static OpenAPI and `/docs-json` show POST required Token, slug, no request body, 200/401/404/422 (plus POST-local 500 when added); 4H feed and detail/list tests stay green. Ready 4I PR directly above #56, one public route, line/file caps met, review clear. |

## Risk Assessment, Compatibility, Security and Rollback

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| Duplicate check races and raises 500 or increments count twice | High / High | Composite PK + conflict-ignore insert; concurrent real-DB requests, assert one row and count. |
| Article deleted between lookup and insert/read | Medium / High | Lock article in transaction; test delete interaction; typed 404 or redacted failure only, no orphan. |
| Response reads before own insert or returns stale favorite flag | Medium / High | Read through existing `ArticleReadService` with same manager after insert; E2E and rollback proof. |
| Persistence details or private user data leak | Medium / High | Typed controller mapping, generic 500, existing serializer, redaction assertions. |
| Favorite route or Swagger changes alter 4H/4J scope | Medium / Medium | Dedicated controller/decorator; diff audit and feed/detail regression; leave DELETE operation untouched. |

- Compatibility: additive POST on existing tables; no migration or backfill. Existing readers automatically see the favorite through their current relation queries. Concurrent **different-user** writes may make the returned aggregate reflect either committed order; each response must include its own favorite and a valid committed count, while sequential tests require exact increments.
- Security: verified Token subject only; bind slug and IDs in queries; no token, hash, password, email or raw personal identifier in logs. Keep mutation response private/no-store.
- Rollback: revert only the 4I PR; favorite rows may remain harmless and remain readable by existing detail/list queries. Hold or rebase dependent 4J+ PRs before reverting 4I. No schema rollback.

## Local Validation

- `pnpm test`: passed, 193 passed / 1 skipped. `pnpm test:e2e`: passed, 91 passed. Both ran sequentially with default timeouts.
- Focused PostgreSQL E2E: 4 passed across two files, including rollback, delete race and `/docs-json`; build and Prettier checks passed; lint passed with 0 errors; static OpenAPI YAML parsed (12 paths); `git diff --check` passed. Independent review found no remaining issues.
- Lint retained 255 repository warnings. New warnings are heuristic matches for the existing DataSource/transaction service pattern (C033), wrapping DB causes in typed redacted errors (C018/C030), and decorated no-store headers not recognized by S037. No error-level finding remains.
- Production diff is within the 400-line hard cap, and each production TypeScript file is under 200 lines.

## Delivery

- Ready PR #57: https://github.com/hungpv-2151/NestJS-tutorial/pull/57
- Base `phase-04h-article-feed-api` at `18b1ddd3d6a0f4e873743a016ffda8b4514b468c`; head `7b79313fafa1100147f828b0aa324f8e123bedac` at initial validation. GitHub Static analysis SUCCESS and merge state CLEAN; PR remains open and unmerged.
- [Validation evidence](https://github.com/hungpv-2151/NestJS-tutorial/pull/57#issuecomment-5867280280)

## Todo List

- [x] Confirm live #56 base/head/checks and record valid missing-route RED. `pnpm exec vitest run --config ./vitest.config.e2e.ts test/article-favorite-create.e2e-spec.ts` exited 1 on missing POST (404) while GET detail control returned 200.
- [x] Implement only favorite POST; focused PostgreSQL E2E passes 4/4, including sequential/concurrent idempotency, 401/404/500, transaction rollback, article-delete race, cache and generated `/docs-json` contract.
- [x] Independent review found no remaining issues after the viewer lock and OpenAPI contract fixes.
- [x] Push and create ready PR #57 directly above #56; validation evidence is recorded in the PR comment.

## Next Steps

- After 4I is delivered, plan 4J `DELETE /api/articles/:slug/favorite` as a separate PR.
