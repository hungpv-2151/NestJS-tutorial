# Phase 4C Contract Research: GET /api/articles/:slug

**Conducted:** 2026-09-28  
**Scope:** Contract and test expectations for article detail only.

## Findings

| Rank | Finding | Evidence and weight |
|---|---|---|
| 1 | **Public detail endpoint.** `slug` is a required string path parameter. A found article returns HTTP 200 as `{ "article": Article }`. The operation has no `security` requirement. | OpenAPI is the normative route/schema source ([route](../../spec/api/openapi.yml#L242-L262), [response envelope and Article schema](../../spec/api/openapi.yml#L549-L586), [single-article envelope](../../spec/api/openapi.yml#L694-L704)). Hurl and Bruno each exercise the endpoint without auth and expect 200 ([Hurl](../../spec/api/hurl/articles.hurl#L145-L158), [Bruno](../../spec/api/bruno/articles/09-get-single-article.bru#L7-L28)). The Phase 04 roadmap calls 4C the public/optional-auth detail result ([plan](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L27-L33)). |
| 2 | **Missing article returns 404.** Error body is `errors.article[0] = "not found"`. OpenAPI declares 404; both error suites assert the exact error, and the main Hurl flow also checks GET after deletion. | [OpenAPI](../../spec/api/openapi.yml#L256-L262), [Hurl unknown slug](../../spec/api/hurl/errors_articles.hurl#L14-L18), [Bruno unknown slug](../../spec/api/bruno/errors-articles/02-get-unknown-slug.bru#L7-L19), [Hurl after delete](../../spec/api/hurl/articles.hurl#L247-L256). |
| 3 | **Detail includes article body.** Required detail fields are `slug`, `title`, `description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount`, and `author`. Timestamps are date-time strings; tag list is an array of strings; favorite state is boolean and count integer. | OpenAPI marks those fields required ([Article schema](../../spec/api/openapi.yml#L549-L586)); Hurl and Bruno assert body, timestamps, tags, favorite fields, and author username on a detail response ([Hurl](../../spec/api/hurl/articles.hurl#L145-L158), [Bruno](../../spec/api/bruno/articles/09-get-single-article.bru#L17-L28)). The Phase 04A plan and serializer unit test independently distinguish detail (includes body) from list (omits it) ([plan](../260910-0930-medium-clone-backend/phase-04a-article-schema.md#L14-L19), [serializer test](../../src/articles/article.serializer.spec.ts#L30-L62)). |
| 4 | **Author output is a public Profile projection.** It contains `username`, nullable `bio`, nullable `image`, and `following`; it does not declare user email, token, or password fields. The existing serializer explicitly projects only those fields. | OpenAPI references `Profile` from `Article.author` ([Profile and Article schemas](../../spec/api/openapi.yml#L529-L586)); the Phase 04A plan says author uses the profile shape with no private user fields ([plan](../260910-0930-medium-clone-backend/phase-04a-article-schema.md#L16-L19)); serializer code and its fixture test confirm email/password hash are omitted ([serializer](../../src/articles/article.serializer.ts#L52-L68), [test](../../src/articles/article.serializer.spec.ts#L8-L50)). Note: OpenAPI does not set `additionalProperties: false`, so the schema does not formally forbid undeclared extra keys; serializer and unit test provide the stronger privacy check. |
| 5 | **Authentication is optional for anonymous reads; invalid-token behavior is unspecified.** OpenAPI says auth is not required and defines no security requirement or 401 response for this GET. Hurl and Bruno explicitly send no auth and expect 200; Phase 04A’s guest serializer test expects `favorited=false` and `following=false`. No supplied detail test sends a valid token or an invalid token. | [OpenAPI](../../spec/api/openapi.yml#L242-L262), [Hurl](../../spec/api/hurl/articles.hurl#L145-L158), [Bruno](../../spec/api/bruno/articles/09-get-single-article.bru#L7-L15), [Phase 04 plan](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L27-L33), [guest serializer test](../../src/articles/article.serializer.spec.ts#L64-L79). None establishes whether a malformed/invalid token should be ignored or rejected. The current controller only implements POST; its strict guard rejects missing/invalid tokens when used, but that protected-route behavior does not define the not-yet-implemented GET ([controller](../../src/articles/articles.controller.ts#L29-L49), [guard](../../src/auth/auth-token.guard.ts#L22-L37)). |

OpenAPI also lists 422 with a generic error for GET, but the requested Hurl cases do not define a GET-specific 422 trigger. There is no declared 401 or 403 for this operation.

## Relevant verification already present

- `spec/api/hurl/articles.hurl`: anonymous detail success and response fields at lines 145–158; GET after update at 184–200; missing-after-delete 404 at 247–256.
- `spec/api/hurl/errors_articles.hurl`: anonymous unknown-slug 404 and exact error at 14–18. Its missing-auth cases are for POST/PUT/DELETE/feed, not detail GET.
- `src/articles/article.serializer.spec.ts`: detail field/redaction assertion at 30–50; list body omission at 53–62; guest favorite/following defaults at 64–79.
- Bruno duplicates the anonymous success and missing-slug scenarios in `spec/api/bruno/articles/09-get-single-article.bru` and `spec/api/bruno/errors-articles/02-get-unknown-slug.bru`.
- There is no article-detail HTTP e2e file in `test/` yet; the current article controller contains only POST. 4C therefore needs its own HTTP coverage in addition to the existing serializer test.

## Contract gap to resolve

Choose and test what GET detail does when an Authorization header is present but invalid. The current contract supports anonymous access but supplies no evidence to rank “ignore invalid token and serve anonymously” against “return 401.” Do not treat the required-route guard’s behavior as an answer for this public route.

For 4C, preserve the existing anonymous 200 and 404 assertions; add a valid-token case if detail is meant to personalize `favorited` / author `following`. Add an invalid-token case only after that policy is decided.

## Sources and credibility

1. **OpenAPI** — authoritative declared HTTP contract and schema.
2. **Hurl** — executable API scenarios; strongest current behavior checks.
3. **Bruno** — independent runner artifact with matching success/404 expectations; corroborates, though it mirrors the same intended cases.
4. **Phase 04 / 04A plans** — intended scope and privacy rules, lower authority than executable checks.
5. **Serializer and unit test** — implemented response projection and guest defaults; relevant to output shape, not evidence that the GET route currently exists.

This is contract extraction, not a technology comparison: no library or architectural option is being selected, so performance, cost, and adoption comparisons do not apply.
