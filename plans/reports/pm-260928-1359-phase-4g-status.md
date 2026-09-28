## Project Progress: 2026-09-28

| Plan | Status | Progress | Next action |
|---|---|---:|---|
| Medium clone backend, Phase 4G | Implementation and validation complete; delivery in progress | 2 PRs ready/open, 0 merged | Merge stack in order: #54, then #55 |

### Verified
- #54: body-free article list projection support, no route, based on #53; ready/open.
- #55: only `GET /api/articles`, based on #54; API code commit `90dbca8a`; ready/open.
- #55 validation after stack rebase: unit 193 passed/1 skipped; E2E 87 passed; PostgreSQL query/hydration integration passed; build, lint (0 errors/243 warnings), OpenAPI parse, diff check, independent review, and GitHub Static analysis passed.

### Blockers and risks
- No active validation blocker. Delivery depends on stack merges in order; neither PR has merged.

### Scope drift
- Split the original 407-line production change into route-free support PR #54 and one-route API PR #55 to honor the 400-line API PR ceiling. No API scope was added.

### Next moves
1. PR owner: merge #54 before #55. Done when each is merged in stack order.
2. Delivery tracker: after merge, refresh Phase 4G/Phase 4 roadmap and changelog status from observed merge state.
