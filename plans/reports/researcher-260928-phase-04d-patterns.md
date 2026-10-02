---
title: 'Study Report: Phase 04D Article Update Patterns'
date: 2026-09-28
scope: 'Existing article mutation/read seams, auth, validation, tags, and database tests'
plan: 'plans/260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md'
conducted_at: '2026-09-28T10:41:39+07:00'
---

# Study Report: Phase 04D Article Update Patterns

## Summary

**Rank 1:** extend the current `ArticlesController` and `ArticlesModule` with one authenticated `PUT /articles/:slug`, backed by a focused `ArticleUpdateService` and partial update DTO. Keep the existing detail serializer as the output contract. The API, database entities, and test database are already present; 4D needs no migration.

Run article update and complete tag replacement in one `DataSource.transaction()` using only its `EntityManager`. If `tagList` is omitted, preserve links; if supplied, replace the whole ordered list; `[]` clears it. Extract the existing batched tag-write logic into one focused helper shared by create and update, rather than copy its case-sensitive deduplication and concurrency handling.

## Method and evidence weight

- Activated project `tkm:help`, `tkm:research`, and `tkm:organize-files`; no library API lookup or external technology selection was needed.
- Highest weight: OpenAPI is the declared contract; Hurl and Bruno are executable contract artifacts; source and tests establish current implementation and exercised behavior. Claims below cross-check these independent project sources.
- No new dependency is proposed, so third-party maturity/adoption comparison does not apply. NestJS, TypeORM, and PostgreSQL already fit the project modules and transaction tests.

## Findings

### Contract and current coverage

- OpenAPI already defines authenticated `PUT /articles/{slug}`, a required `{ article: ... }` envelope, `200` detail response, and `401/403/404/422` outcomes ([route](../../spec/api/openapi.yml#L276), [request body](../../spec/api/openapi.yml#L891)). Its `UpdateArticle` schema is a partial update shape ([schema](../../spec/api/openapi.yml#L617)). The phase roadmap limits 4D to this one route ([plan](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L24)).
- Hurl proves an omitted `tagList` preserves existing tags, an empty list removes all links, and `tagList: null` returns 422; it also checks unchanged `createdAt`, changed `updatedAt`, and the detail response ([update assertions](../../spec/api/hurl/articles.hurl#L160), [replacement cases](../../spec/api/hurl/articles.hurl#L202)). Bruno has matching preserve/clear cases ([preserve](../../spec/api/bruno/articles/12-update-article-without-taglist-tags-should-be-preserved.bru), [clear](../../spec/api/bruno/articles/13-update-article-remove-all-tags-with-empty-array.bru)).
- No update controller, service, DTO, or update-specific HTTP test exists yet (`src/articles/` currently has create/read only). Existing API contract artifacts do not exercise owner versus non-owner updates; add those 403/404/401 cases to focused HTTP coverage.

### Minimal architecture and ownership

| Action | File | Reason |
| --- | --- | --- |
| Create | `src/articles/article-update.dto.ts` | Required nested envelope; optional title/description/body/tagList validators. Do not reuse create DTO, whose content fields are required ([create DTO](../../src/articles/article-create.dto.ts#L13)). |
| Create | `src/articles/article-update.service.ts` | Owner-scoped transaction, field patch, tag replacement, typed expected errors, detail result. Follow `ArticleCreateService`'s `DataSource` unit-of-work pattern ([create service](../../src/articles/article-create.service.ts#L27)). |
| Create | `src/articles/article-tag-persistence.ts` | Small shared batch helper for exact-name dedupe, insert-on-conflict, ID lookup, ordered link insert; extend it to replace/clear existing links. |
| Modify | `src/articles/articles.controller.ts` | Add only `@Put(':slug')`, strict `AuthTokenGuard`, verified `auth.sub`, typed 403/404/500 mapping ([controller](../../src/articles/articles.controller.ts#L73)). |
| Modify | `src/articles/articles.module.ts`, `src/articles/articles.swagger.ts` | Register update provider and document this route's 200/401/403/404/422 contract. Article, join, tag, and auth metadata are already loaded ([module](../../src/articles/articles.module.ts#L15)). |
| Modify | `src/articles/article-create.service.ts` | Move current private tag batch-write logic to the shared helper; preserve create behavior and its same transaction boundary ([tag writes](../../src/articles/article-create.service.ts#L71)). |
| Create | `src/articles/article-update.service.spec.ts`, `test/update-article.e2e-spec.ts`, `test/update-article-transaction.integration.spec.ts` | Keep unit, HTTP, and PostgreSQL proofs scoped to 4D. `AppModule`/migration/entity definitions need no change. |

`ArticleTag.position` and `(articleId, position)` uniqueness are the ordering contract; explicitly order reads by position as `ArticleReadService` already does ([entity](../../src/articles/article-tag.entity.ts#L14), [read query](../../src/articles/article-read.service.ts#L65)). Reuse `serializeArticleDetail` so body, ISO dates, tag order, and the public author allowlist stay consistent ([serializer](../../src/articles/article.serializer.ts#L3), [serializer tests](../../src/articles/article.serializer.spec.ts#L30)).

### Transaction and tag replacement semantics

1. Begin one transaction; find the article by slug with an update lock, then compare its `authorId` with the user resolved from the verified token subject. Missing article → typed 404; existing article owned by someone else → typed 403. Perform every read/write through the transaction manager. The phase rules call out owner-scoped mutation and TOCTOU protection ([roadmap](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L63)); creation already confines all persistence to one transaction ([create service](../../src/articles/article-create.service.ts#L31)).
2. Patch only fields that are present. Keep slug, author, ID, and `createdAt` immutable; let the mapped update timestamp change. Reject unknown properties via the existing global validation pipe. For optional fields, validate when value is not `undefined`; this pattern also rejects explicit `null` for `tagList` ([DTO](../../src/articles/article-create.dto.ts#L32), [Hurl null case](../../spec/api/hurl/articles.hurl#L237)).
3. `tagList === undefined`: do not delete or rewrite `article_tags`. Supplied list: dedupe exact strings in first-seen order (consistent with create and case-sensitive `uq_tags_name`), batch-insert missing `tags` with conflict-ignore, fetch IDs in one query, delete this article's old links, then batch-insert replacement links with positions `0..n-1`. Empty list deletes links and inserts none. Keep all steps in the same transaction; rollback must restore old links on any failure. Keep unused global `Tag` rows: no cleanup policy is specified ([4A plan](../260910-0930-medium-clone-backend/phase-04a-article-schema.md#L12)).
4. Serialize a complete detail response. Do not hardcode create defaults (`favorited=false`, `favoritesCount=0`) for an existing article; load current favorite/follow context using the detail read pattern, which counts favorites separately from tag joins ([read context](../../src/articles/article-read.service.ts#L34)). Current Hurl checks their types, not personalized values, so exact update-response personalization remains under-specified.

### Ranked tag-write approaches

| Rank | Approach | Performance | Complexity / maintenance | Fit and risk |
| --- | --- | --- | --- | --- |
| 1 | Extract a small shared tag-write helper used by create and update | Same bounded batch operations; no query-per-tag loop | One implementation of dedupe, conflict-ignore, lookup, and positions | Best DRY fit; small refactor, low adoption risk, existing TypeORM APIs only. |
| 2 | Copy create's tag logic into update | Similar query cost | Lowest initial edit, then two copies to keep aligned | Avoid: behavior can drift on duplicate/case/order/concurrent tag creation. |

Do not add a generic repository layer or a schema migration for this endpoint. The existing entities already encode the needed keys and ordering constraints ([article/tag entities](../../src/articles/article.entity.ts#L13), [join entity](../../src/articles/article-tag.entity.ts#L14)).

## Security and error boundaries

- Use strict `AuthTokenGuard`; never take author identity from request JSON or pass the raw HTTP request into the service. The guard parses `Token <jwt>`, verifies through `AuthService`, and attaches claims; missing/malformed credentials map to 401 ([guard](../../src/auth/auth-token.guard.ts#L18)).
- Owner-check in the transaction, before writes. Do not turn a non-owner's existing slug into 404 unless the project deliberately changes the declared OpenAPI 403 behavior.
- Map typed update errors to the contract's 403/404. Wrap unexpected persistence failures as a generic 500 without exposing SQL/driver details; preserve `tagList` and body in logs only if operationally necessary, and never log token or raw identifiers. Create already separates its expected errors from generic persistence failures ([controller mapping](../../src/articles/articles.controller.ts#L89), [service wrapping](../../src/articles/article-create.service.ts#L64)).

## Focused test matrix

| Layer | Required proof |
| --- | --- |
| DTO/controller unit | Valid partial body; missing outer `article`; blank supplied strings; non-string/list item; `tagList: null`; unknown field rejected; verified `auth.sub` passed to service. |
| Service unit | Owner succeeds; not-found and non-owner typed errors; omitted fields and tags remain untouched; supplied tags replace in first-seen order; `[]` clears; slug/author/createdAt stay fixed; errors do not expose DB cause in HTTP response. |
| HTTP e2e | Auth missing/invalid → 401; owner → 200 full detail; another user → 403; unknown slug → 404; patch persists while omitted fields remain; preserve/replace/clear tags; null and unknown fields → 422. Use unique fixtures and `article-detail-fixture` cleanup pattern ([fixture](../../test/article-detail-fixture.ts#L15)). |
| PostgreSQL integration | Replacement positions and stored article fields; forced failure after old-link deletion rolls back to the original links; shared existing tag remains valid. Current integration tests use `TEST_DATABASE_URL`, unique fixtures, real TypeORM transactions, and skip without a configured target ([create transaction test](../../test/create-article-transaction.integration.spec.ts#L14)). |

Vitest setup maps configured `TEST_DATABASE_URL` to `DATABASE_URL` before tests ([setup](../../test/setup/test-database.ts#L1)); runtime `DatabaseModule` keeps `synchronize` and automatic migrations disabled ([module](../../src/database/database.module.ts#L5)). Use the configured test target with 4A migrations applied; do not reset a shared database for this migration-free API.

## Limits / unresolved

- The OpenAPI route defines status codes but not exact update error bodies or whether detail personalization on PUT must reflect the current viewer. Preserve existing error envelope conventions and add a test for chosen response semantics.
- Existing Hurl/Bruno prove tag preservation and clearing, but not arbitrary replacement, exact output order after replacement, owner authorization, or rollback of a failed replacement. Those are the highest-value new 4D cases.
