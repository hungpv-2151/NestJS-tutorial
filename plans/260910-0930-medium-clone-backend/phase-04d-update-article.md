# Phase 04D — Update Article

## Context Links

- [Phase 04 roadmap](./phase-04-articles-search-pagination.md) · [4A schema](./phase-04a-article-schema.md) · [4B create](./phase-04b-article-create.md) · [4C detail](./phase-04c-article-detail.md)
- [OpenAPI](../../spec/api/openapi.yml) · [article Hurl](../../spec/api/hurl/articles.hurl) · [error Hurl](../../spec/api/hurl/errors_articles.hurl)
- [Contract research](../reports/researcher-260928-phase-04d-contract.md) · [repository patterns](../reports/researcher-260928-phase-04d-patterns.md)

## Overview and Dependencies

- Priority: P1 · Status: In progress · Scope: **`PUT /api/articles/:slug` only** plus one supporting foundation PR with no public API change. The foundation stacks directly on `phase-04c-article-detail` / [PR #49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49); the PUT PR stacks directly above that foundation. No delete, list, feed, favorite, or tag route.
- Depends on 4A article/tag/favorite tables and serializer, 4B authenticated create and batch tag behavior, and 4C detail reader. User direction: continue creating the subsequent API PRs without pausing for a manual check. 4E follows the PUT PR.
- Existing schema supports every operation. No migration, backfill, new package, or `AppModule` change. Keep code files under 200 lines; Phase 04 production diff target ≤300 lines, hard gate ≤400.

## Contract and Explicit Local Decisions

| Case | Required result |
| --- | --- |
| Request | `Authorization: Token <jwt>`; required JSON `{ "article": { "title"?: string, "description"?: string, "body"?: string, "tagList"?: string[] } }`; path slug is required. All nested fields are optional. Only supplied fields change. |
| Owner success | `200 { article: { slug, title, description, body, tagList, createdAt, updatedAt, favorited, favoritesCount, author } }` using the existing detail serializer. Preserve `createdAt`, author, favorite count, viewer favorite/follow flags, and public author allowlist. Persist changes so subsequent GET returns them. |
| Authentication | Missing token: `401 { errors: { token: ["is missing"] } }`; invalid/malformed/revoked token or deleted token subject: `401 { errors: { token: ["is invalid"] } }`, using the strict guard and existing stale-user mapping. |
| Authorization / missing | Existing article with a different owner: `403 { errors: { article: ["forbidden"] } }` (local resource-specific key under the shared Forbidden response). Unknown slug: `404 { errors: { article: ["not found"] } }`. Check both before mutation. |
| Validation | `tagList: null` returns `422` as Hurl requires. Missing or malformed `article`, wrong scalar/array/item types, and unknown fields use the existing global validation pipe and `errors.<field>` envelope. Optional string fields follow OpenAPI's `string` type; do not add create-only nonblank constraints or arbitrary limits. |

- **Slug:** keep it stable when title changes. The body-only Hurl case proves a stable slug there; title-change semantics are unspecified. Stable identity is the 4D local policy, so old URLs continue working. Do not call `createArticleSlug` on update or add a 409 route response.
- **Empty update:** `{ "article": {} }` is valid under OpenAPI and returns current detail with `200`; skip article/link writes and do not force `updatedAt` forward. A real field/tag change updates `updatedAt` while `createdAt` remains fixed. Omitted scalar fields and omitted `tagList` retain stored values.
- **Tags:** omitted `tagList` preserves links and positions; explicit `[]` clears links; a supplied nonempty list replaces the whole ordered list. Reuse 4B's exact-case name matching, first-seen deduplication, and rejection of blank tag names as a local consistency policy. `null`, wrong item types, and whitespace-only names return `422`. Leave unused global tag rows intact. Hurl directly proves omit/clear/null; replacement order follows 4A/4B persistence policy.
- OpenAPI declares `200/401/403/404/422` for PUT. Its shared Forbidden example uses `resource`; the resource-specific `article` key above follows existing article 404 convention and needs a focused E2E assertion. Document only this PUT policy in Swagger/OpenAPI; no other verb's contract changes.

## Stacked PR Split

The complete implementation exceeds the 400 production changed-line hard gate, so an independent review approved two sequential PRs:

1. **Foundation PR** (`Public API change: none`, 202 production changed lines): extract `ArticleTagPersistence`; delegate existing POST tag writes to it; allow `ArticleReadService` to read through a supplied transaction manager. Base is PR #49. Keep all PUT endpoint code, OpenAPI changes, and 4D-specific tests out of this PR. Preserve and run existing create/detail regression tests.
2. **PUT API PR** (319 production changed lines, below the 400 hard gate): add the DTO, update service, controller/module route, Swagger/OpenAPI, and all Phase 4D tests. Base is the foundation PR. This PR adds exactly `PUT /api/articles/:slug`. Its 19-line overage of the 300-line target covers unchanged-tag timestamp handling and strict generated `/docs-json` validation parity.

Push and open the foundation PR before pushing the API branch. Do not advance the foundation branch to include the API commit. After each PR is ready and its evidence comment is posted, continue to the next planned API without waiting for manual user review.

## Architecture and Data Flow

`strict AuthTokenGuard → nested UpdateArticleRequestDto/global ValidationPipe → controller(slug, verified auth.sub, DTO) → ArticleUpdateService → DataSource.transaction(EntityManager) → owner check + locked article → conditional article/tag writes → detail reader on same manager → serializeArticleDetail → 200`.

1. Keep the controller at the HTTP boundary: accept slug and validated body, pass verified username and DTO to the service, map typed stale-user/forbidden/missing errors to 401/403/404, and let generic persistence failures become the existing redacted 500. Never accept owner, slug, author ID, timestamps, or favorite state from JSON.
2. In one transaction, resolve the verified username; missing user is invalid token. Load the article by unique slug with a PostgreSQL write lock; missing slug is 404. Compare immutable `authorId` with the resolved user ID before any write; non-owner is 403. The row lock serializes concurrent updates to the same article and prevents an ownership check followed by an unsafe write.
3. Patch only present scalar fields on the locked article; never regenerate slug. For a body with no supplied fields, avoid writes. For supplied tags, use a shared focused helper extracted from 4B: dedupe names in input order, batch insert missing global tags with conflict-ignore, batch load IDs, delete this article's links, and batch insert replacement links with positions `0..n-1`. `[]` only deletes links. Use transaction-manager repositories for every read/write; if any step fails, article fields and old tag links roll back together.
4. Reuse `ArticleReadService` and `serializeArticleDetail` for the return value. Give the read service an optional transaction manager so the update response is assembled before commit from the same transaction, while 4C GET keeps its current default data source. Read tags by `position`, count favorites separately, and resolve viewer favorite/follow flags; never return raw entities or create-only zero/false defaults for an existing article.

## File Ownership and Size Gate

| Action | Files | Purpose |
| --- | --- | --- |
| Foundation PR | `src/articles/article-tag-persistence.ts`, `src/articles/article-create.service.ts`, `src/articles/article-read.service.ts` | Shared batch tag persistence, unchanged POST behavior, optional manager-backed detail reads; no new route. |
| PUT API PR | `src/articles/article-update.dto.ts`, `src/articles/article-update.service.ts`, controller/module/Swagger and `spec/api/openapi.yml` | Partial nested validation; locked, owner-scoped transaction; exactly one PUT contract. |
| PUT API PR | `src/articles/article-update.service.spec.ts`, `test/update-article.e2e-spec.ts`, `test/update-article-errors.e2e-spec.ts`, `test/update-article-transaction.integration.spec.ts` | Focused unit, HTTP, and PostgreSQL evidence. Reuse `test/article-detail-fixture.ts` where possible. |

- No file deletions. Implementation owns production files, tester owns test files, and reviewer reads the finished diff sequentially. Documentation updates to parent roadmap/changelog follow verified implementation. Do not edit migration/entity/serializer files without a demonstrated defect.

## RED-First Implementation and Test Matrix

1. Confirm #49 direct base and clean scope. Write focused failing tests for the missing PUT behavior; RED must be a requested assertion failure, not test setup/database failure. Add only PUT-specific assertions to Hurl/Bruno if useful; their full suites include future endpoints and cannot serve as 4D's isolated gate.
2. Unit: DTO accepts partial fields and `{article:{}}`, rejects malformed envelope, `tagList:null`, wrong types/items, blank tag names, and unknown fields; service maps stale user/404/403, keeps slug and omitted fields unchanged, dedupes supplied tags in first-seen order, and does not write on empty update. Verify the controller passes only verified subject, slug, and DTO.
3. PostgreSQL integration: owner scalar update and ordered tag replacement persist; omitted tags retain old links/positions; `[]` removes them; duplicate/case-distinct tag names behave as 4B; forced failure after link deletion rolls back both article and links; two concurrent updates to one article serialize without partial mixed state. Keep unrelated/shared tag rows untouched.
4. HTTP E2E: owner 200 full detail and subsequent GET persistence; changed `updatedAt` and fixed `createdAt`/slug; title edit keeps slug; `{article:{}}` leaves timestamp unchanged; missing/invalid/stale token 401, non-owner 403 with no state change, unknown slug 404, invalid tag/wrapper 422, public author allowlist and current favorite/follow values. Assert exact Hurl envelopes where Hurl specifies them.
5. Implement DTO, helper, service, controller/module/Swagger, then run `pnpm build` after code edits. Run focused tests GREEN, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, and available isolated PUT Hurl cases; retain real exit codes. If Hurl is unavailable, report that and use the equivalent Supertest assertions. Do not report the full article Hurl suite as green while 4E–4K are absent.
6. Vitest's `test/setup/test-database.ts` maps configured `TEST_DATABASE_URL` to `DATABASE_URL` for tests. Use a disposable target with 4A migrations applied and unique fixtures/cleanup; never reset a shared or normal `DATABASE_URL`. If a disposable test target needs migration repair, use the guarded `pnpm db:migration:reset` only with `CONFIRM_DATABASE_RESET=yes` and `TEST_DATABASE_URL`. This phase adds no migration.
7. Send final code to an independent reviewer, resolve correctness/security findings, rerun affected gates, and audit each split diff and production line count. Submit the no-route foundation PR above #49, then the PUT PR above the foundation. Attach command results, exit codes, commit SHA, and validation evidence in both PR comments; update Phase 04 progress and changelog after verification.

## Risks, Security, Compatibility, Rollback

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| Non-owner write or concurrent check/write race | Medium / High | Strict verified subject, transaction row lock, owner check before writes, 403/no-change and concurrent integration tests. |
| Partial tag replacement or reordered/duplicate links | Medium / High | One manager/transaction, batch helper, `article_tags.position`, rollback injection, ordered read and exact-case/duplicate tests. |
| PUT returns stale or private response fields | Medium / High | Read through the same manager, reuse allowlist serializer and current favorite/follow queries; assert no private author fields in E2E. |
| Local choices tighten undocumented contract or POST regresses during helper extraction | Medium / Medium | Preserve OpenAPI optional-string permissiveness; document stable slug/no-op/tag policy as local choices; rerun POST create tests and PUT contract assertions. |
| Stack diff leaks another API or grows too large | Medium / High | Verify #49 ancestry, changed routes, <200-line code files, and ≤400 production changed lines before review/submit. |

- Compatibility: PUT is additive over the existing schema. Stable slugs preserve article URLs. Existing POST and GET response behavior remains covered by regressions; no data migration or integration version change.
- Rollback: revert only 4D's PR/commit; existing article data, 4A tables, POST and GET remain valid. Updates already committed are ordinary rows and are not automatically undone. Rebase dependent 4E+ PRs if 4D is removed.

## Observable Done Criteria and Next Step

- [ ] Foundation PR directly bases on [PR #49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49), has `Public API change: none`, and meets the size gate; PUT PR directly bases on the foundation and adds exactly `PUT /api/articles/:slug`.
- [ ] RED and GREEN evidence proves statuses/envelopes, owner/non-owner isolation, stable slug and timestamps, omitted/replace/clear tags, rollback, response privacy, and persistence through GET.
- [ ] Build, focused and full tests, E2E, and lint finish with real exit codes; no errors are waived. Test database cleanup leaves no fixture rows.
- [ ] Independent review accepts the final code; both ready stacked PRs have validation evidence and commit SHA. Then 4E may begin without a manual pause.
