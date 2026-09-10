# Phase 04 — Social actions, comments and feed

## Context Links

- [Follow/feed contract](../../spec/api/hurl/feed.hurl) · [favorites](../../spec/api/hurl/favorites.hurl) · [comments](../../spec/api/hurl/comments.hurl) · [authorization failures](../../spec/api/hurl/errors_authorization.hurl)

## Overview

- Priority: P1 · Status: Pending
- Add follows, favorites, comments and authenticated feed while preserving article/profile contract shapes.

## Key Insights

- Follow/favorite need composite uniqueness and idempotent behavior; never increment counts with an unsafe read-modify-write.
- Feed is private, ordered by `createdAt DESC, id DESC`, paginated, includes only followed authors, and uses the same list serializer.

## Requirements

- Cover `POST|DELETE /profiles/:username/follow`, `POST|DELETE /articles/:slug/favorite`, `GET /articles/feed`, and `GET|POST /articles/:slug/comments`, `DELETE /articles/:slug/comments/:id`.
- Comments support CR-D only; comment/article owners are separate authorization boundaries.

## Architecture

Profile social service owns follow joins; article interaction service owns favorite join + serialization; comment service owns article lookup/create/list/scoped delete. Feed delegates list query construction with followed-author constraint rather than duplicating query/serializer logic.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/profiles/*` — follow/unfollow routes/service.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/articles/*` — favorite routes, aggregate-aware serializer, feed query.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/comments/*` — DTOs, controller, service, serializer/tests.
- Create/modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/social.e2e-spec.ts`, `/test/comments.e2e-spec.ts`.

## Implementation Steps

1. Resolve and mutate profile/article in one transaction or conditional write; map concurrent target removal/FK conflict to resource-specific 404. Reject self-follow if policy selected.
2. Insert/delete relation through unique composite handling in transactions; recompute `favoritesCount` from durable relation or guarded atomic operation.
3. Extend article/profile serializers with batched viewer-specific `favorited`/`following`, avoiding per-row lookups.
4. Create feed filter from authenticated user follows; retain global pagination/count/`createdAt DESC, id DESC` behavior.
5. Validate comment wrapper/body; list comments with author profile; delete only via comment id plus author id after checking article scope.
6. Assert non-owner mutation returns 403 and failed delete leaves data unchanged.

## Todo List

- [ ] Concurrent follow/favorite cases have service/integration coverage.
- [ ] Hurl `profiles`, `favorites`, `feed`, `comments`, `errors_comments`, `errors_profiles`, `errors_authorization` pass.
- [ ] Feed requires JWT and public comment/profile reads remain available.

## Success Criteria

- Relation state and counts persist across requests; feed count/pages and authorization outcomes match contract.

## Risk Assessment

- Relation races and N+1 serializers are the main risk; enforce composites and query-level aggregation/batching.

## Security Considerations

- Recheck current user identity from verified JWT for every mutation; no client-provided author/user id is trusted.

## Next Steps

- Phase 05 runs full acceptance suite against migrated isolated PostgreSQL.
