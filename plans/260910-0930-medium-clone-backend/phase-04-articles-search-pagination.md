# Phase 04 — Article, Feed, Favorite và Tag API Stack

## Context Links

- [Articles](../../spec/api/hurl/articles.hurl) · [feed](../../spec/api/hurl/feed.hurl) · [favorites](../../spec/api/hurl/favorites.hurl) · [pagination](../../spec/api/hurl/pagination.hurl)

## Overview

- Priority: P1 · Status: In progress (4A–4F PRs #47–#53, 4G support/API PRs #54/#55, 4H API PR #56, 4I API PR #57, and 4J API PR #58 are ready; 4K implementation and local validation pass, PR submission pending) · Effort: 26h · Blocked by: Phase 03 PR 3G
- Một endpoint mỗi PR. `GET /api/articles` được tách hai PR vì query/filter/pagination có rủi ro và kích thước cao.

## Key Insights

- List không có `body`; detail có. Stable order `createdAt DESC, id DESC`; count sau filter, trước page.
- Favorite và unfavorite là hai APIs. Feed và global list dùng chung query seam nhưng không chung PR.

## Requirements

- Create/get/update/delete/list/feed/favorite/unfavorite/tags đều là API riêng.
- Filters AND; limit default 20, max 100; ownership và idempotency dựa DB constraints. Case-insensitive search remains out of scope until OpenAPI defines a query parameter and searchable columns.
- Migration article/tag/favorite tách foundation, không thêm route.

## Architecture and PR Dependency Graph

`3G → 4A → 4B → 4C → 4D → 4E → 4F → 4G → 4H → 4I → 4J → 4K`.

| PR | Only scope / public API | Base | Required evidence |
|---|---|---|---|
| 4A | Article/tag/favorite schema and shared serializers; API: none | 3G | migration apply/revert screenshot |
| 4B | `POST /api/articles` only ([PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48)) | 4A / #47 | [create/slug/tag transaction validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/48#issuecomment-5861778843) |
| 4C | `GET /api/articles/:slug` only | 4B | public/optional-auth detail result |
| 4D | `PUT /api/articles/:slug` only ([PR #51](https://github.com/hungpv-2151/NestJS-tutorial/pull/51)); no-route support in [PR #50](https://github.com/hungpv-2151/NestJS-tutorial/pull/50) | 4C / #49 | owner/non-owner/slug result |
| 4E | `DELETE /api/articles/:slug` only | 4D | 204/403/404/persistence result |
| 4F | `GET /api/articles` part 1: query/count/order core, no route | 4E | repository integration result |
| 4G support | Body-free list projection and serializer typing; no route ([PR #54](https://github.com/hungpv-2151/NestJS-tutorial/pull/54)) | 4F / #53 | PostgreSQL body-free result + serializer regression |
| 4G API | `GET /api/articles` part 2: HTTP/filter/page contract ([PR #55](https://github.com/hungpv-2151/NestJS-tutorial/pull/55)) | 4G support / #54 | [local validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/55#issuecomment-5865020735), [CI](https://github.com/hungpv-2151/NestJS-tutorial/pull/55#issuecomment-5865035968) |
| 4H | `GET /api/articles/feed` only | 4G | auth/follow/order result |
| 4I | `POST /api/articles/:slug/favorite` only | 4H | idempotency/count result |
| 4J | `DELETE /api/articles/:slug/favorite` only | 4I | idempotency/count result |
| 4K | `GET /api/tags` only | 4J | envelope/order/result screenshot; local tests/build/lint/review pass |

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

- [ ] PRs 4A–4K rebased and scoped within hard line limits. 4A PR #47 is ready on #46; 4B POST create is PR #48 ready on #47; 4C PR #49, 4D PRs #50/#51, 4E PR #52, 4F foundation PR #53, and 4G support/API PRs #54/#55 are ready. 4H `GET /api/articles/feed` is ready as PR #56 directly on #55; 4I `POST /api/articles/:slug/favorite` is ready as PR #57 directly on #56; 4J `DELETE /api/articles/:slug/favorite` is ready as PR #58 directly on #57; 4K implementation and local checks pass, PR submission pending.
- [ ] Error-level findings zero; retained warnings carry reason/follow-up.
- [ ] Stable paging/count/no-N+1 and ownership/idempotency proven.
- [ ] Evidence URLs: 4A [PR #47 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/47#issuecomment-5861324933); 4B [PR #48 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/48#issuecomment-5861778843); 4C [PR #49 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/49#issuecomment-5862775055); 4D foundation [PR #50 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/50#issuecomment-5863552132) and PUT [PR #51 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/51#issuecomment-5863610040); 4E [PR #52 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/52#issuecomment-5863972597); 4F [PR #53 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/53#issuecomment-5864274902); 4G support [PR #54 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/54#issuecomment-5865006355); 4G API [PR #55 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/55#issuecomment-5865020735), [CI](https://github.com/hungpv-2151/NestJS-tutorial/pull/55#issuecomment-5865035968); 4H [PR #56 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/56#issuecomment-5865756862); 4I [PR #57 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/57#issuecomment-5867280280); 4J [PR #58 validation](https://github.com/hungpv-2151/NestJS-tutorial/pull/58#issuecomment-5867761340); 4K implementation verified locally, PR comment `pending`.

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

- Submit 4K above PR #58 with its validation comment, then continue to Phase 05; keep the overall Phase 04 status open until the 4K PR evidence is recorded.
