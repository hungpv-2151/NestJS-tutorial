# Phase 05 — Comment API Stack

## Context Links

- [Comments](../../spec/api/hurl/comments.hurl) · [errors](../../spec/api/hurl/errors_comments.hurl) · [authorization](../../spec/api/hurl/errors_authorization.hurl)

## Overview

- Priority: P1 · Status: Pending · Effort: 10h · Blocked by: Phase 04 PR 4K
- Comment create/list/delete là ba APIs và ba PRs; migration/shared serializer là foundation riêng.

## Key Insights

- Delete phải phân biệt unknown article, wrong article/comment và non-owner. Public list dùng optional auth cho author `following`.

## Requirements

- Tách `POST /api/articles/:slug/comments`, `GET /api/articles/:slug/comments`, `DELETE /api/articles/:slug/comments/:id`.
- Body trim/non-empty/capped; list stable `createdAt ASC, id ASC`; delete owner-only 204.

## Architecture and PR Dependency Graph

`4K → 5A → 5B → 5C → 5D`.

| PR | Only scope / public API | Base | Required evidence |
|---|---|---|---|
| 5A | Comment schema/shared serializer; API: none | 4K | migration apply/revert screenshot |
| 5B | `POST /api/articles/:slug/comments` only | 5A | validation/auth/persistence result |
| 5C | `GET /api/articles/:slug/comments` only | 5B | anonymous/auth/order/no-N+1 result |
| 5D | `DELETE /api/articles/:slug/comments/:id` only | 5C | owner/403/404/persistence screenshot |

## Data Flow

`slug → article lookup → comment service → TypeORM → serializer`; delete uses article scope plus conditional owner delete.

## Related Code Files

- Create/modify sequentially: `src/comments/*`, comments migration, `src/articles/*`, `src/app.module.ts`.
- Each endpoint PR owns only its controller/DTO/service path, Swagger row and focused tests. Delete: none.

## Implementation Steps

1. Refresh/rebase each row on declared base and audit inherited diff before code fixes.
2. Land 5A schema without route; implement 5B, 5C and 5D separately through existing article/profile seams.
3. Keep production-code size preferred ≤300 and hard limit ≤400; spec, Markdown, JSON, test, migration, YAML, lockfile and supporting artifacts do not count. Split oversized code only into same-API suffix PRs.
4. Require zero error-level lint/static findings; fix warnings or document reason/follow-up.
5. Attach command/results and screenshot to each PR comment; record URL before review.

## Todo List

- [ ] PRs 5A–5D rebased, one-API scoped and within line limit.
- [ ] Create/list/delete status, envelope and failed-mutation persistence proven.
- [ ] Evidence URLs: 5A `pending`; 5B `pending`; 5C `pending`; 5D `pending`.

## Success Criteria

- Create → list → delete → list passes; wrong/non-owner deletion changes no data; list leaks no internal fields.

## Risk Assessment

- Wrong article/owner scope — Medium/High → conditional delete and focused integration tests in 5D.
- Concurrent article deletion — Low/Medium → FK/transaction mapping to 404 without DB leakage.

## Security Considerations

- Never accept author ID from client; cap content size; serialize only public profile fields.

## Rollback

- Revert top API layer only; 5A `down` removes comment objects without touching article/user tables.

## Next Steps

- Phase 06 starts after 5D and all Phase 05 evidence comments are accepted.
