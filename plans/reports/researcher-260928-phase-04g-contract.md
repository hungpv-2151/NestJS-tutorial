# Study Report: Phase 04G Article List HTTP Contract

Date: 2026-09-28 12:58 Asia/Bangkok
Scope: Read-only study of `GET /api/articles` for Phase 04G. No code changed.

## Summary

Implement the existing list contract only: optional `tag`, `author`, `favorited`, `offset`, and `limit`; filters combine with AND; response is `{ articles, articlesCount }`; list order is newest first with the project's `id DESC` tie-breaker. **OpenAPI has no `search` query parameter. Do not add one in 4G.** The phase note “Search case-insensitive” conflicts with the actual API contract and needs a separate product decision before any search endpoint change.

Keep optional authentication: anonymous requests succeed, valid tokens personalize viewer fields, and a supplied invalid token returns 401. Use `limit=20` when omitted and reject invalid pagination with 422. `limit <= 100` is a phase/core constraint absent from OpenAPI today; update the generated and static operation docs to show the maximum. Use `offset=0` when omitted as an inference from first-page examples, not a currently declared default.

## Method and Source Weight

Skill activation interface was not exposed. Before inspecting contract sources, I read the local `tkm:help`, skill catalog, `tkm:research`, `tkm:organize-files`, and ETHOS instructions and used their report path, source-weighting, and confidence guidance. No external library research was needed: this commission is to resolve this repository's API contract, and the primary source is its OpenAPI plus its executable examples.

| Rank | Source | Credibility and limit |
|---:|---|---|
| 1 | [OpenAPI `GET /articles`](../../spec/api/openapi.yml#L181-L213), shared pagination parameters [L960-L976](../../spec/api/openapi.yml#L960-L976), list schema [L761-L809](../../spec/api/openapi.yml#L761-L809) | Canonical declared public request/response contract. It omits search, filter-composition semantics, sort order, and max limit. |
| 2 | [Hurl article examples](../../spec/api/hurl/articles.hurl#L45-L144), [Hurl pagination](../../spec/api/hurl/pagination.hurl#L45-L59) | Executable behavior examples for anonymous/authenticated reads, author/tag filters, projection, page order and count. Examples do not cover validation, `favorited`, combined filters, or tie ordering. |
| 3 | [Phase 04 plan](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L12-L21) and [4F contract report](researcher-260928-phase-04f-contract.md#L17-L47) | Project-level decisions fill some OpenAPI gaps. The plan also contains the conflicting “Search case-insensitive” phrase, so it cannot override the absent public parameter. |
| 4 | [4F query core](../../src/articles/article-list-query.service.ts#L10-L16) and [Postgres integration coverage](../../test/article-list-query.integration.spec.ts#L39-L105) | Current implementation evidence for AND filtering, maximum limit 100, deterministic order, count, and empty results. This is service-level behavior; it does not prove the 4G HTTP mapping. |
| 5 | [Optional auth guard](../../src/auth/optional-auth-token.guard.ts#L16-L31), [exception filter](../../src/common/filters/api-exception.filter.ts#L44-L69), [Bruno list examples](../../spec/api/bruno/articles/03-list-all-articles.bru#L7-L30) | Existing HTTP/auth and error-envelope conventions. The Bruno list suite mirrors the Hurl coverage rather than adding invalid-query cases. |

These are distinct project artifacts, not independent external implementations. The repository contract and its runtime examples are the right authority for this task; where they disagree or omit behavior, the report marks the gap instead of treating inference as extracted fact.

## Extracted Contract

| Area | Finding and confidence |
|---|---|
| Query keys | `tag`, `author` (username), `favorited` (username), `offset`, `limit`. There is **no `search` parameter** in the operation. [EXTRACTED: 1.0] OpenAPI L189-L206; Hurl L63-L79/L119-L136. |
| Filters | The phase plan requires supplied filters to combine with AND. The 4F core does so; its integration test exercises all three together. Hurl/Bruno only exercise `author` and `tag` separately. [EXTRACTED: 0.98] Plan L17-L21; [4F service L78-L111](../../src/articles/article-list-query.service.ts#L78-L111); [integration L77-L105](../../test/article-list-query.integration.spec.ts#L77-L105). |
| Matching | Current 4F SQL uses equality for usernames/tag name. The API docs and examples do not promise case sensitivity or case-insensitivity. Preserve current exact-value query behavior; do not advertise a casing rule until tested and agreed. [EXTRACTED implementation / AMBIGUOUS public contract] Service L82-L110; OpenAPI L190-L204; Hurl exact-case positive examples L63-L79/L119-L136. |
| Search | Phase plan line 20 says “Search case-insensitive,” but OpenAPI and Hurl expose no search key. 4F notes the mismatch too. No supportable search field or searchable columns can be extracted. [AMBIGUOUS: 0.1] Plan L17-L21; 4F report L41-L47; OpenAPI L189-L206. **Exclude search from 4G.** |
| Pagination | `limit` is optional integer, minimum 1, default 20 in OpenAPI; project plan and 4F service set a max of 100. `offset` is optional integer >=0; no default or maximum is declared. [EXTRACTED: 1.0] OpenAPI L960-L976; plan L17-L21; 4F service L115-L132. |
| Pagination defaults | Omitted `limit` should produce 20. Omitted `offset` should produce 0: Hurl/Bruno omit it for the first page, while the core requires an explicit number. [INFERRED: 0.82] OpenAPI L960-L976; Hurl pagination L45-L59; [Bruno pagination L7-L20](../../spec/api/bruno/pagination/04-list-with-limit-1-most-recent-first-so-slug2.bru#L7-L20); 4F service L10-L16. |
| Invalid pagination | OpenAPI declares 422, and the project maps validation failures to 422 with `{ errors: { field: [message] } }`. Non-integers, negative `offset`, `limit < 1`, and `limit > 100` should fail with 422. The over-100 outcome is a project decision inferred from the core validator, not yet an HTTP test. [INFERRED: 0.86] OpenAPI L207-L213; [core validation L115-L132](../../src/articles/article-list-query.service.ts#L115-L132); [global validation/error mapping](../../src/create-app.ts#L52-L62) and filter L44-L69. |
| Over-limit choice | **Reject >100 with 422 and document `maximum: 100`.** This matches the existing core validator and makes the cap visible. Clamping silently changes the requested page size; unbounded values contradict the phase cap and can return an oversized result. No new dependency or adoption risk. [INFERRED: 0.9] Service L120-L128; plan L17-L21; OpenAPI currently lacks a maximum at L968-L976. |
| Order/count | Newest first; stable order is `createdAt DESC, id DESC`. Count is after all filters and before offset/limit. Hurl tests newest-first and count on two pages; the plan states the tie-break/count rule; the 4F integration test covers same timestamps and past-end paging. [EXTRACTED: 0.98] Plan L12-L15; Hurl pagination L45-L59; [integration L87-L105](../../test/article-list-query.integration.spec.ts#L87-L105); [core L53-L69](../../src/articles/article-list-query.service.ts#L53-L69). |
| Response | 200 envelope requires `articles` and `articlesCount`. Each item includes `slug`, `title`, `description`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount`, and `author` profile; list items omit `body`. [EXTRACTED: 1.0] OpenAPI L761-L809; Hurl L49-L61; [serializer L42-L67](../../src/articles/article.serializer.ts#L42-L67). |
| No matches | A valid filter with no matches returns `articles: []`, `articlesCount: 0` in the 4F core; its real-DB test proves that for an absent tag. The public endpoint has no documented 404 for a filter miss. Empty collection response is the recommended HTTP mapping; unknown author/favorited values are not separately tested. [EXTRACTED core / INFERRED HTTP: 0.8] Integration L90-L105; OpenAPI L207-L213; Hurl success envelope L45-L51. |
| Authentication | No OpenAPI `security` requirement on this operation; description says optional auth. Hurl and Bruno demonstrate anonymous and valid-token 200. The optional guard allows no header and rejects any supplied invalid token as 401. [EXTRACTED: 0.98] OpenAPI L185-L213; Hurl L81-L98/L138-L144; [guard L20-L30](../../src/auth/optional-auth-token.guard.ts#L20-L30); Bruno L7-L19. |
| HTTP errors | Declared statuses: 200, 401, 422. `401` should cover a supplied invalid token; `422` the invalid list query. The shared error model is `{ errors: { [key]: string[] } }`. The OpenAPI currently uses generic examples and does not define exact query error keys/messages. No 500 is declared for this operation. [EXTRACTED: 0.98] OpenAPI L207-L213/L700-L710; optional guard L24-L28; exception filter L44-L69. |

## Ranked Contract Decisions

| Rank | Decision | Performance | Complexity / maintenance | Compatibility and adoption risk |
|---:|---|---|---|---|
| 1 | Reject invalid values and values above 100 with 422; publish the 100 maximum. | Bounds response/page work; no silent overfetch. | Small explicit parser/DTO rule; matches 4F core. | Low: route is not yet shipped; aligns runtime and docs. No package added. |
| 2 | Clamp `limit > 100` to 100. | Bounded work. | Slightly simpler response path but hidden rewrite of caller input. | Medium: surprising client behavior and mismatch between requested and returned page size. Reject. |
| 3 | Accept arbitrary `limit`. | Unbounded serialization and DB page cost. | Less validation initially; harder to protect later. | High: contradicts project max and core validator. Reject. |

For `offset`, use 0 when omitted and reject values that do not parse as a safe non-negative integer with 422. Do not invent a business maximum; OpenAPI sets no upper bound. Keep filter matching semantics as the current exact-value query. Do not apply lowercase/ILIKE search behavior to any field.

No technology/library choice is being evaluated. The query core uses existing TypeORM/PostgreSQL, so maturity, community-size, abandonment, and dependency breakage risks are not introduced by this contract work. The only adoption decision is a new public route whose behavior remains unshipped; sync static OpenAPI, generated Swagger, and tests before exposing it.

## 4G Test Gaps to Close

- Exercise `favorited` over HTTP and combine tag + author + favorited; assert AND semantics and the pre-page count.
- Test omitted defaults (`limit=20`, `offset=0`), `limit=1` pages, max `limit=100`, page beyond end, and stable order when timestamps tie.
- Test 422 for malformed, fractional, negative, zero-limit, and over-100 inputs. Assert the project error envelope; add the documented `maximum: 100` to both spec sources.
- Test anonymous success, valid-token success, invalid supplied token 401, and viewer-specific `favorited` / `author.following` values. Existing list examples check only that fields are booleans or that author username is present.
- Test unknown tag, author, and favorited usernames as an empty 200 result or explicitly decide otherwise. Only unknown tag is currently covered in the 4F service integration test.
- Decide whether list-query persistence failure gets a documented 500 response. The global filter emits a generic internal-server error envelope, but the OpenAPI list operation currently omits 500.
- Add query-count/bounded-hydration evidence if 4G response assembly touches per-article relations; current contract examples do not prove absence of N+1 reads.

## Recommendation

Implement only the five declared query keys. Reuse the 4F query core with parsed defaults `offset=0`, `limit=20`; enforce integer/range validation and a maximum of 100; combine filters with AND; preserve `createdAt DESC, id DESC` and pre-page count; return empty arrays/counts for valid filters with no matches; use optional auth and reject invalid supplied tokens. Update both generated Swagger and static OpenAPI. Keep `search` out of the endpoint until its parameter name, searchable fields, case rule, and validation are confirmed as a separate contract change.

## Unresolved Questions

1. Is case-insensitive search an intended future API? If yes, what query parameter and which fields? Existing sources do not answer this; 4G should not guess.
2. Should unknown author/favorited usernames explicitly return an empty list? This follows current query shape but is not directly tested.
3. Should the public OpenAPI operation document a generic 500 for list persistence failures?
