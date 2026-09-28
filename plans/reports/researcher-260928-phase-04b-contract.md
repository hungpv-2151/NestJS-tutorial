---
date: 2026-09-28
scope: "Phase 04B — POST /api/articles contract only"
status: DONE
---

# Phase 04B Contract Research — Create Article

## Summary

Phase 04B owns only `POST /api/articles`. The request is authenticated and uses the `{ article: ... }` envelope. `title`, `description`, and `body` are required non-empty values; `tagList` is optional. Success returns `201` and the full article detail envelope. Duplicate titles are allowed, and repeated creates with the same title must receive different slugs.

The strongest contract evidence is the repository OpenAPI plus executable Hurl cases, cross-checked against the parallel Bruno cases. The plan additionally requires the create/slug/tag work to be verified as a transaction. No other article endpoint belongs in this PR.

## Source assessment

| Source | Credibility for this task | Limits |
|---|---|---|
| `spec/api/openapi.yml` | Normative repository API definition for method, auth, request schema, response schema, and declared statuses. | Declares a `409` for creation but does not say which article conflict causes it. |
| `spec/api/hurl/articles.hurl` | Executable contract checks for successful create, tag order, response fields, and timestamps. | File also exercises list/detail/update/delete endpoints; only its create scenario is in 4B. |
| `spec/api/hurl/errors_articles.hurl` | Executable checks for missing auth, blank required fields, and same-title unique slugs. | Does not test missing properties, bad types, tag validation, or a `409` case. |
| `spec/api/bruno/articles/02-create-article-with-tags.bru` | Independent runner representation of successful-create envelope, ordered tags, timestamps, favorite defaults, and author. | Mirrors the Hurl success case and therefore does not resolve its untested edges. |
| `spec/api/bruno/errors-articles/12-duplicate-titles-are-allowed-each-gets-a-unique-slug.bru` and `13-post-articles.bru` | Second runner's paired cases confirm both creates return `201` and the second slug differs from the first. | Still mirrors the same project contract rather than defining an independent external standard. |

No external technology comparison was needed: this is a repository contract study, not a library or architecture selection.

## Contract findings

### Request and authentication

- The route is `POST /api/articles`, with a JWT in `Authorization: Token <token>`; OpenAPI defines `Authorization` as the `Token` header (`spec/api/openapi.yml:214-233`, `912-921`). Hurl confirms the request header and missing-token `401` at `spec/api/hurl/articles.hurl:14-25` and `spec/api/hurl/errors_articles.hurl:1-12`.
- The JSON shape is `{ "article": { ... } }`; the request body and `article` property are required (`spec/api/openapi.yml:858-869`).
- `title`, `description`, and `body` are required strings (`spec/api/openapi.yml:579-595`). Empty values return `422`; each exact error is asserted as `errors.<field>[0] == "can't be blank"` in `spec/api/hurl/errors_articles.hurl:68-108`.
- No-auth create returns `401` with `errors.token[0] == "is missing"` (`spec/api/hurl/errors_articles.hurl:1-12`).
- `tagList` is optional and, when supplied, is an array of strings (`spec/api/openapi.yml:592-595`). The duplicate-title Hurl requests omit it and still expect `201` (`spec/api/hurl/errors_articles.hurl:110-135`).

### Success response

- Success status is `201`; the response is `{ "article": ... }` (`spec/api/openapi.yml:220-224`, `686-696`).
- The create response uses the full `Article` schema, which requires `slug`, `title`, `description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount`, and `author` (`spec/api/openapi.yml:541-578`). In particular, `body` is required in this single-article response.
- The nested author uses `Profile`, whose required fields are `username`, `bio`, `image`, and `following` (`spec/api/openapi.yml:521-540`). Existing Hurl/Bruno create assertions check the author's username but do not assert the other required profile fields (`spec/api/hurl/articles.hurl:26-43`; Bruno file lines `28-49`).
- Initial favorite state is `favorited: false` and `favoritesCount: 0` (`spec/api/hurl/articles.hurl:37-39`; mirrored in Bruno lines `46-48`).
- Timestamps must be date-time values by schema; executable create checks require ISO-style `YYYY-MM-DDT...` strings (`spec/api/openapi.yml:567-572`; `spec/api/hurl/articles.hurl:35-36`). The tests do not require `createdAt == updatedAt`.
- If tags are provided, response order must match request order: the Hurl and Bruno cases assert the first and second positions explicitly (`spec/api/hurl/articles.hurl:31-34`; Bruno lines `40-45`).

### Slug and conflicts

- Two separate creates with the exact same title must both return `201` and different `article.slug` values (`spec/api/hurl/errors_articles.hurl:110-137`). Therefore article title is not unique; the persistence slug must be unique across those creates.
- The Bruno pair repeats that result (`spec/api/bruno/errors-articles/12-duplicate-titles-are-allowed-each-gets-a-unique-slug.bru:17-32`; `13-post-articles.bru:17-34`), and the 4A entity has a unique slug index (`src/articles/article.entity.ts:13-16`). These corroborate the Hurl case, with the DB index as implementation evidence rather than a separate API contract.
- The slug is only asserted to be a string and distinct for repeated titles. The contract does not prescribe slug normalization, suffix format, determinism, retry strategy, or behavior for case/punctuation collisions (`spec/api/hurl/articles.hurl:27-28`; `spec/api/hurl/errors_articles.hurl:110-137`).
- OpenAPI declares `409 Conflict` for create, but its shared example is a username conflict (`spec/api/openapi.yml:223-230`, `781-790`). The article-specific reason and conditions are unspecified. Duplicate titles cannot be the reason because the Hurl scenario explicitly allows them.

### Transaction scope and PR boundary

- Phase 04B is explicitly `POST /api/articles` only, based on 4A; required evidence is a create/slug/tag transaction result (`plans/260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md:27-39`). The plan's data flow calls for mutation → transaction → detail serializer (`:41-43`).
- Keep route/controller changes limited to create. `spec/api/hurl/articles.hurl` is a combined workflow that continues into list at line 45, detail at line 145, update at line 160, and later delete; a 4B validation run should isolate its create case and create-specific errors rather than claim the whole file is 4B coverage.
- A focused persistence test should show the article, its ordered tag associations, and response serialize from the committed create result. Whether to force a particular rollback fault is not defined by the external API contract; transaction atomicity is an internal plan requirement and can be verified with an appropriate repository/service test.

## Testable acceptance criteria

1. Authenticated valid request with title, description, body, and two tags returns `201`, envelope `article`, all required detail fields, correct author username, `favorited=false`, `favoritesCount=0`, and ISO date-time timestamps.
2. Returned `tagList` preserves input order.
3. Omitted `tagList` is accepted and the response still includes a list-valued `tagList` (the exact empty-list expectation is not currently asserted by Hurl, so confirm this against response-schema semantics before locking a test).
4. Missing auth returns `401` with the asserted token error.
5. Blank title, description, or body returns `422` with the exact field error asserted in Hurl.
6. Two creates with identical titles both succeed and produce different slugs.
7. Article, tags, and ordered article-tag associations persist consistently through the 4A schema, with create and tag linking covered in one transaction as required by the plan.
8. No GET, PUT, DELETE, feed, favorite, unfavorite, or tags route is added or changed in the 4B PR.

## Unresolved contract edges

- `409` is declared but the article conflict condition and response error key are undefined. Keep collision handling internal unless a concrete API conflict is specified; do not turn duplicate titles into `409`.
- Slug format/normalization and collision retry behavior are unspecified beyond unique output for repeated identical titles.
- The contract does not say whether duplicate tag names, blank tag names, `tagList: null`, or non-string tag entries should be rejected, normalized, or deduplicated. The schema only types the field as an optional array of strings.
- A successful create omitting `tagList` is observed only through status `201`; no current Hurl assertion checks its returned value. Response schema requires `tagList`, but the exact default should be pinned only if the API implementation or governing RealWorld contract establishes it.
- Timestamp equality on initial create is not specified or asserted.
- OpenAPI's response schema requires the full nested profile fields; current executable create tests only assert `author.username`, leaving `bio`, `image`, and `following` unverified.

## Next step

Implement and validate only `POST /api/articles`; carry unresolved slug/tag decisions as implementation-local defaults or seek clarification only if they affect observable behavior beyond the stated contract.
