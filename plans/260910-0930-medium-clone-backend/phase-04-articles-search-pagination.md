# Phase 04 — Article, Feed, Favorite và Tag API Stack

## Context Links

- [Articles](../../spec/api/hurl/articles.hurl) · [feed](../../spec/api/hurl/feed.hurl) · [favorites](../../spec/api/hurl/favorites.hurl) · [pagination](../../spec/api/hurl/pagination.hurl)

## Overview

- Priority: P1 · Status: Pending · Effort: 26h · Blocked by: Phase 03 PR 3G
- Một endpoint mỗi PR. `GET /api/articles` được tách hai PR vì query/filter/pagination có rủi ro và kích thước cao.

## Key Insights

- List không có `body`; detail có. Stable order `createdAt DESC, id DESC`; count sau filter, trước page.
- Favorite và unfavorite là hai APIs. Feed và global list dùng chung query seam nhưng không chung PR.

## Requirements

- Create/get/update/delete/list/feed/favorite/unfavorite/tags đều là API riêng.
- Search case-insensitive; filters AND; limit default 20, max 100; ownership và idempotency dựa DB constraints.
- Migration article/tag/favorite tách foundation, không thêm route.

## Architecture and PR Dependency Graph

`3G → 4A → 4B → 4C → 4D → 4E → 4F → 4G → 4H → 4I → 4J → 4K`.

| PR | Only scope / public API | Base | Required evidence |
|---|---|---|---|
| 4A | Article/tag/favorite schema and shared serializers; API: none | 3G | migration apply/revert screenshot |
| 4B | `POST /api/articles` only | 4A | create/slug/tag transaction result |
| 4C | `GET /api/articles/:slug` only | 4B | public/optional-auth detail result |
| 4D | `PUT /api/articles/:slug` only | 4C | owner/non-owner/slug result |
| 4E | `DELETE /api/articles/:slug` only | 4D | 204/403/404/persistence result |
| 4F | `GET /api/articles` part 1: query/count/order core, no route | 4E | repository integration result |
| 4G | `GET /api/articles` part 2: HTTP/filter/page contract | 4F | search/filter/page screenshot |
| 4H | `GET /api/articles/feed` only | 4G | auth/follow/order result |
| 4I | `POST /api/articles/:slug/favorite` only | 4H | idempotency/count result |
| 4J | `DELETE /api/articles/:slug/favorite` only | 4I | idempotency/count result |
| 4K | `GET /api/tags` only | 4J | envelope/order/result screenshot |

## Data Flow

`query DTO → query service → QueryBuilder → count/page → list serializer`; `mutation → scoped guard/service → transaction → detail serializer`; favorites use relation aggregate.

## Related Code Files

- Create/modify sequentially: `src/articles/*`, `src/tags/*`, `src/profiles/*`, `src/app.module.ts`, article/tag/favorite migrations.
- Controller/Swagger/test hunks belong only to the endpoint row. Shared query work belongs 4F and exposes no route.
- Delete: none.

## Implementation Steps

1. Refresh/rebase and audit diff before fixing each row; confirm declared base, one API and line limit.
2. Land 4A schema first; implement endpoint rows in order. Route `/feed` stays ahead of `/:slug` without editing unrelated contracts.
3. Split any row above 400 changed lines of production code into suffix PRs serving the same API only; preferred size ≤300. Spec, Markdown, JSON, test, migration, YAML, lockfile and supporting artifacts do not count.
4. Run compile, error-free lint/static analysis, focused tests and contract checks. Attach screenshot/results in PR comment; record URL.

## Todo List

- [ ] PRs 4A–4K rebased, scoped and within line limit.
- [ ] Error-level findings zero; retained warnings carry reason/follow-up.
- [ ] Stable paging/count/no-N+1 and ownership/idempotency proven.
- [ ] Evidence URLs: 4A `pending`; 4B `pending`; 4C `pending`; 4D `pending`; 4E `pending`; 4F `pending`; 4G `pending`; 4H `pending`; 4I `pending`; 4J `pending`; 4K `pending`.

## Success Criteria

- Each API passes its exact envelope/status/persistence tests in its own PR; pages are deterministic and capped.

## Risk Assessment

- Join duplicate/count error — Medium/High → distinct/subquery fixtures in 4F/4G.
- Mixed endpoint controller edits — High/High → route ownership audit before every submit.

## Security Considerations

- Bind query params; cap body/query input; derive identity only from verified JWT; scoped mutations avoid TOCTOU.

## Rollback

- Revert top endpoint PR independently. 4A `down` removes joins before parents and never touches users/attachments.

## Next Steps

- Phase 05 begins after 4K and all Phase 04 evidence comments are accepted.
