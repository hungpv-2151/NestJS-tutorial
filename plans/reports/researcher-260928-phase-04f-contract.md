# Phase 04F — Article List Query Foundation Contract

## Scope

4F builds the shared list query/count/order core only. It adds no HTTP route; 4G connects the existing OpenAPI `GET /api/articles` contract to that core. This report separates what the repository states from what is still a local implementation choice.

## Source Weight

| Rank | Source | Weight and limit |
|---|---|---|
| 1 | [`openapi.yml`](../../spec/api/openapi.yml#L181) | Canonical public parameter and response shape. It describes `tag`, `author`, `favorited`, `offset`, `limit`, and optional auth, but leaves filter matching rules and sort order unstated. |
| 2 | [`articles.hurl`](../../spec/api/hurl/articles.hurl#L45) and [`pagination.hurl`](../../spec/api/hurl/pagination.hurl#L45) | Executable examples: guest/auth success, list projection, author/tag filtering, newest-first paging, and count unaffected by paging. Coverage is illustrative: no favorited filter, combined filters, tied timestamps, invalid pagination, or empty-result case. |
| 3 | [Phase 04 overview](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L9) | Binding project decisions for stable order, AND filters, limit bounds, and the 4F/4G split. It adds behavior not fully specified by OpenAPI/Hurl, so gaps below remain explicit. |

The sources agree on list shape, filter names, pagination, and recent-first ordering. OpenAPI defines the external contract; Hurl proves concrete examples; the Phase 04 overview resolves implementation details. There is no library choice in this task, so external adoption/community risk does not apply. The overview names TypeORM `QueryBuilder` as the intended query path; adding another query library would add adoption and maintenance cost without a contract need.

## Extracted `GET /api/articles` Behavior

| Area | Extracted behavior | Evidence / confidence |
|---|---|---|
| Request | `GET /api/articles`; optional query filters: `tag`, `author` (username), `favorited` (username), plus `offset` and `limit`. Auth is optional. | OpenAPI lines 181–206; Hurl guest and authenticated requests return 200 (articles lines 45–61, 81–98). High confidence. |
| Filters | Hurl demonstrates author and tag separately. Phase 04 requires filters to combine with AND. OpenAPI documents `favorited` but Hurl does not exercise it. | Hurl lines 63–79, 100–136; overview lines 17–21. High for AND as project requirement; unverified by Hurl. |
| Matching | No source defines case sensitivity or missing-user/tag behavior for these filters. | OpenAPI gives string types only; Hurl uses exact-case positive examples. Do not infer more. |
| Ordering | Newest first. Project policy makes it deterministic: `createdAt DESC, id DESC`. | Pagination Hurl lines 45–59 establishes recent-first; overview line 14 supplies tie-breaker. High confidence for planned behavior; Hurl does not test equal timestamps. |
| Pagination | `offset` is optional, integer `>= 0`; `limit` is optional, integer `>= 1`, OpenAPI default 20. Phase 04 caps limit at 100. | OpenAPI lines 960–976; overview lines 17–21. High confidence. Hurl checks `limit=1`, `offset=1`. |
| Count | `articlesCount` is required and counts the full filtered result before limit/offset. | Pagination Hurl returns count 2 for each one-item page (lines 45–59); overview line 14 explicitly states count follows filtering and precedes paging. High confidence. |
| Response | 200 envelope requires `articles` and `articlesCount`. List item includes slug, title, description, ordered `tagList`, timestamps, `favorited`, `favoritesCount`, and author profile; `body` is absent. | OpenAPI lines 761–805; Hurl lines 49–61 checks body absence and list fields. High confidence. |

## 4F Boundary and Recommendation

Implement a route-independent query core that accepts normalized optional filters (`tag`, author username, favorited-by username) and explicit `limit`/`offset`; apply all supplied filters with AND; return the ordered page and the filtered pre-page count. Keep HTTP parsing, DTO validation, defaults, max-limit handling, auth, response serialization, controller, Swagger, and route wiring in 4G. This follows the Phase 04 split and keeps 4F integration-testable without adding a public API.

Ranked implementation choice:

1. **Recommended — normalized query input plus TypeORM QueryBuilder.** Keeps query logic reusable by 4G and the later feed, counts articles rather than joined rows, and adds no dependency. Match the overview's deterministic order and count semantics.
2. **Avoid — make 4F controller/HTTP DTO aware.** It would introduce route surface ahead of 4G and duplicate transport validation/defaulting; that breaks the explicit no-route scope.
3. **Avoid — add a new query/pagination library.** No contract or architectural gap justifies another dependency; it increases maintenance and adoption risk.

For joined filters, count distinct articles (or count from an article-ID subquery) before applying page bounds; otherwise tags/favorites joins can inflate `articlesCount`. Keep page ordering on the article row and include the `id DESC` tie-breaker before applying offset/limit.

## Decisions Still Needed in 4G

- Phase overview says “Search case-insensitive,” but OpenAPI defines no `search` query parameter and the cited Hurl files do not test text search. Do not add a search field in 4F; clarify whether a search parameter is intended and which article fields it searches before exposing it in 4G.
- OpenAPI says limit default 20 and minimum 1; Phase 04 adds maximum 100. It does not say whether over-100 values are rejected or capped. Prefer reject as 422 in 4G so the declared input constraint is visible, but record this as a local decision.
- OpenAPI omits an offset default. Use 0 in 4G as the conventional first-page value; Hurl's omitted-offset case demonstrates that omission returns the first page.
- Filter match casing and behavior for unknown author/favorited usernames are unspecified. Preserve stored tag casing and avoid inventing case-insensitive matching. Set and test these HTTP-level semantics in 4G if product behavior requires them.
- The 422 response is declared, but no cited list Hurl case defines invalid-query error envelope or messages. Reuse the project validation convention in 4G and test it there.

## Limits

This is contract research from the four assigned project artifacts, not a survey of external libraries or deployed behavior. Hurl coverage is sparse for filter composition, favorites, validation, empty pages, and ordering ties. Those gaps do not block 4F's query core; focused repository integration tests should cover AND filters, distinct count under joins, count-before-page, and stable tie ordering. No code was changed.

## Skill Activation

The required `Skill(tkm:help)` activation interface is not exposed in this agent session. `tkm --help` only reports CLI commands and does not activate a skill. No documentation/research skill was activated; analysis used the assigned local contract files directly.
