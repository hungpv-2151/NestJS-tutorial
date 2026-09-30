# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress. PRs #47–#59 are OPEN, non-draft, CLEAN, and directly stacked; keep the phase open until they merge. #47 (schema), #50 (update support), #53 (query foundation), and #54 (projection support) add no route. The API PRs are #48 (`POST /api/articles`), #49 (`GET /api/articles/:slug`), #51 (`PUT /api/articles/:slug`), #52 (`DELETE /api/articles/:slug`), #55 (`GET /api/articles`), #56 (`GET /api/articles/feed`), #57 (`POST /api/articles/:slug/favorite`), #58 (`DELETE /api/articles/:slug/favorite`), and #59 (`GET /api/tags`). Validation comments are linked in the [Phase 4 checkpoint](../plans/260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md). PR #59 is ready on #58. On its current head, full unit (191 passed, 1 skipped), full E2E (98 passed), build, and lint (0 errors, 258 warnings) passed; GitHub Static analysis is SUCCESS and independent review is SEALED. [Current-head evidence](https://github.com/hungpv-2151/NestJS-tutorial/pull/59#issuecomment-5904391942).
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
