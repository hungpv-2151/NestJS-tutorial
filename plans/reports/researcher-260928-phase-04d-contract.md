# Phase 4D Contract Research — `PUT /api/articles/:slug`

**Date:** 2026-09-28
**Scope:** Contract evidence for the update route only. No code or phase plan changed.
**Recommendation:** Implement the explicit OpenAPI/Hurl behavior below; resolve the listed title/slug and partial-update gaps before adding assertions that would invent behavior.

## Sources and confidence

| Source | Weight | Evidence |
| --- | --- | --- |
| `spec/api/openapi.yml` | Primary machine-readable contract | Route/status/security: 242–304; Article schemas: 562–629; shared errors: 812–841; request wrapper: 891–902 |
| `spec/api/hurl/articles.hurl` | Primary executable acceptance cases | Update/persistence/tag behavior: 160–245 |
| `spec/api/hurl/errors_articles.hurl` | Primary negative HTTP cases | Missing auth: 20–29; unknown slug: 139–175 |
| Phase 04 parent | Scope authority | One API per PR; 4D is PUT only and owner/non-owner/slug result: `phase-04-articles-search-pagination.md` 19–39 |
| 4A/4B/4C plans | Supporting data and inherited conventions | Tag order/storage: `phase-04a-article-schema.md` 25–40; create slug/tag decisions: `phase-04b-article-create.md` 14–25; detail serializer/owner fields: `phase-04c-article-detail.md` 16–30 |

These are project primary records. External sources would not settle project-specific contract gaps, so none were used. Exact route behavior is strongest where OpenAPI and Hurl agree; planning-only decisions are marked as such.

## Contract findings

### Request and scope

- Exact route: `PUT /api/articles/{slug}`; required path parameter `slug` is a string. Request body is required JSON with a required top-level `article` object. (OpenAPI 276–304, 891–902.)
- Nested update fields are all optional: `title`, `description`, `body` are strings; `tagList` is an array of strings. OpenAPI gives no nested required field, minimum length, array uniqueness, or `additionalProperties: false`. (OpenAPI 617–629.)
- The Phase 04 dependency map limits 4D to this route. Hurl files contain other article verbs as setup, later-route coverage, and cleanup; those do not enlarge 4D's API scope. Only PUT behavior belongs in this phase's new assertions. (Parent plan 25–39.)

### Authentication, ownership, and statuses

- Authentication is required: security is `Token`; missing credentials return `401` with `errors.token[0] == "is missing"` in Hurl. Invalid-token `401` follows the existing strict auth behavior/4C policy, but this PUT route has no invalid-token Hurl case. (OpenAPI 302–304; errors Hurl 20–29; 4B 18–20; 4C 26–29.)
- The OpenAPI route declares `403` Forbidden. The shared example is `{errors:{resource:["forbidden"]}}`; the parent phase names owner/non-owner outcome as 4D acceptance. No current Hurl case asserts non-owner denial or the exact error key. (OpenAPI 294–301, 812–821; parent plan 30–33.)
- Unknown slug returns `404` with `errors.article[0] == "not found"`; the authenticated case is present in Hurl. It is duplicated at lines 139–149 and 165–175. (OpenAPI 298–301, 822–831; errors Hurl 139–175.)
- Success is `200` with the single-article envelope. Other declared statuses: `401`, `403`, `404`, `422`; no `409` is declared for update. (OpenAPI 291–301.)

### Success response and persisted fields

- Response uses `SingleArticleResponse` / Article detail shape: `slug`, `title`, `description`, `body`, ordered `tagList`, ISO `createdAt` / `updatedAt`, `favorited`, `favoritesCount`, and public `author`. (OpenAPI 292–293, Article schema 562–599; 4A 34–40.)
- Hurl proves a body-only update returns 200, preserves title/description/slug/createdAt/tags, changes body and `updatedAt`, and returns author/favorite fields. A follow-up GET proves persistence. (articles Hurl 160–200.)
- Article tags have persisted `position`; detail serialization preserves position order. The body-only Hurl assertions check both original tags but do not check their order after update. (4A 25–39; 4B 19, 24; articles Hurl 174–179.)

### Tag update behavior

- Omitted `tagList` preserves the current tag set (Hurl case); `tagList: []` clears all tags and a follow-up GET confirms persistence. (articles Hurl 202–235.)
- `tagList: null` is rejected with `422`. Hurl asserts status only, not the error envelope/key. This matches the OpenAPI non-null array type. (articles Hurl 237–245; OpenAPI 626–629.)
- 4B creation retains exact tag spelling/case, deduplicates exact repeats in first-seen order, and rejects blank names; OpenAPI has no `uniqueItems`. Whether updates must reuse all those tag rules is an inference, not an update-specific assertion. (4B 23–25; 4A 28–29.)

### Validation behavior

- OpenAPI requires the body and `article` wrapper, but no update property; it allows an empty `article: {}` under the declared schema. It specifies only scalar types and generic `422`, not validation triggers or error wording. (OpenAPI 617–629, 891–902, 300–301.)
- Hurl establishes `422` for null `tagList` only. It does not establish behavior for missing/malformed wrapper, wrong field types, blank title/description/body, blank tag items, empty update object, duplicate tags, or unknown fields.
- 4B's create-specific nonblank and unknown-field choices must not be silently treated as explicit PUT contract. OpenAPI omits `additionalProperties: false`, and update fields are optional. (OpenAPI 617–629; 4B 18–25.)

## Evidence matrix and ranked next decisions

| Rank | Decision | Evidence / trade-off | Recommendation |
| --- | --- | --- | --- |
| 1 | Owner vs non-owner | OpenAPI has 403; parent explicitly requires owner/non-owner result; Hurl is missing the case. | Add one authenticated non-owner PUT case asserting 403 and the chosen shared forbidden envelope. |
| 2 | Title change and slug | Request permits title; Hurl only updates body and proves slug remains stable in that case. No source says whether a title edit regenerates slug. Regeneration risks breaking existing URLs; stable slug preserves route identity. | Decide explicitly before title-update assertion; default to stable slug unless product requires rename-derived slugs. This default is a recommendation, not an extracted rule. |
| 3 | Empty update and blank optional strings | OpenAPI permits `article: {}` and empty strings; no Hurl case decides. Rejecting them adds constraints; accepting them may create no-op or blank data. | Either follow schema permissiveness or amend contract/Hurl with explicit 422 rules. Do not infer create's required-field rules for partial update. |
| 4 | Update tag normalization | Omission/empty/null are settled; duplicate, whitespace-only and order replacement cases are not. Reusing 4B rules avoids inconsistent tag behavior; stricter rejection is not in OpenAPI. | Reuse exact-case, first-seen dedupe and stored order if tagList is supplied, and document that as a 4D local decision. |
| 5 | Unknown fields | OpenAPI permits extras by default; 4B says global validation rejects them. Strict rejection can break additive clients. | Align DTO/global validation with the chosen project-wide rule and explicitly document/test it; the spec currently does not authorize rejection. |

## Hurl route scope and uncovered proof

- Valid PUT coverage belongs in `articles.hurl`: existing fixture article gives a captured slug/token, and the current PUT block already proves body update, omitted-tag preservation, empty-array clearing, null rejection, and persistence.
- Negative PUT coverage belongs in `errors_articles.hurl`: it already proves missing-auth 401 and unknown-slug 404. Add only the missing owner/invalid-token/selected validation assertions needed for PUT. The file also covers POST, GET, DELETE, feed and favorites; do not change their contracts in 4D.
- Current Hurl has no non-owner 403, invalid-token PUT, title/description update, empty update object, field-level 422 envelope, or update tag replacement/order case. Hurl was recorded unavailable during 4B, so its tests need the same isolated HTTP assertions if the runner remains unavailable. (4B 48, 69.)

## Limits

This research reads local contract and phase records only. It does not inspect the live implementation or runtime validation pipe, so it cannot confirm which 422 errors the current app already emits. Title-to-slug behavior, empty updates, blank optional values, update deduplication, and unknown-field handling remain open.
