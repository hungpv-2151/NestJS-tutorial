# Phase 03 — Articles, tags and listing

## Context Links

- [Article API](../../spec/api/openapi.yml) · [article Hurl](../../spec/api/hurl/articles.hurl) · [pagination](../../spec/api/hurl/pagination.hurl) · [errors](../../spec/api/hurl/errors_articles.hurl) · [tags](../../spec/api/hurl/tags.hurl)

## Overview

- Priority: P1 · Status: Complete (2026-09-11)
- Implement article CRUD, tag persistence, public/global queries and paginated list serialization.

## Key Insights

- List results must omit article `body`; detail includes it. Sort every offset page by `createdAt DESC, id DESC`, then return count before pagination.
- Omitted `tagList` keeps tags; `[]` clears tags; `null` is 422. Duplicate titles require distinct slugs.

## Requirements

- Cover `GET|POST /articles`, `GET|PUT|DELETE /articles/:slug`, `GET /tags` with tag/author/favorited/limit/offset query support.
- Only author updates/deletes; unknown article is 404 and other user is 403.

## Architecture

Article service owns slug retry, transactional ordered tag replacement, query filters and detail/list serializers. Tag service remains read-only. A single relation-aware serializer accepts viewer identity for later favorited/following flags without N+1 queries.

## Related Code Files

- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/articles/*` — controller, service, DTOs, query parser, serializer, slug helper and tests.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/tags/*` — tag controller/service.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts` — register modules.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/articles.e2e-spec.ts`, `/test/tags.e2e-spec.ts`.

## Implementation Steps

1. Validate nested article envelope, field/tag maxima and numeric query bounds; convert query filters safely.
2. Generate normalized slug with a cryptographically random unique suffix on collision; on the vanishingly unlikely database collision retry transactionally and return a defined 409 only after exhaustion. Permit concurrent repeated titles.
3. Create/update tags and ordered join rows in a transaction; preserve tags only when field absent.
4. Fetch article by slug and apply `authorId` scoped update/delete to prevent TOCTOU; map zero affected row to 403/404 after resource lookup.
5. Query global articles with filters, `createdAt DESC, id DESC` offset/limit and deterministic aggregate/relationship loading; emit `articlesCount` separately.
6. Return distinct detail/list shapes and all known tags.

## Todo List

- [x] Unit/integration tests cover slug collisions, tag absent/null/empty behavior and serializers.
- [x] Article/tag/pagination/error contract coverage passes in the live E2E suite.
- [x] List serialization omits `body`; favorite aggregation is bounded and does not fan out relation loading.

## Success Criteria

- CRUD and filters exactly satisfy OpenAPI/Hurl; transactions leave no orphan tag joins.

## Risk Assessment

- Aggregate favorite/profile mutation fields are extended in Phase 04; the serializer seam remains stable without response-mapping forks.

## Security Considerations

- Author ownership is enforced in service/database predicate. User supplied title/body/tags are never executed or rendered server-side.

## Next Steps

- Phase 04 attaches favorites, follows, comments and feed to the article service contract.

## Delivery Evidence

- Tester: [Phase 03 final report](../reports/tester-260911-0658-phase03.md) — E2E 20/20, focused tests 10/10, build and lint pass.
- Reviewer: [Phase 03 final remediation review](../reports/reviewer-260911-0658-phase03.md) — ownership scoping, slug collision handling, bounded favorite loading and tag updates resolved; no remaining Phase 03 blockers.
