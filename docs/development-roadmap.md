# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; Phase 4A–4E are submitted as a ready stack, PRs [#47–#52](https://github.com/hungpv-2151/NestJS-tutorial/pulls), based in order on #46 → #47 → #48 → #49 → #50 → #51. None are merged. 4D uses [PR #50](https://github.com/hungpv-2151/NestJS-tutorial/pull/50) as a foundation (`Public API change: none`) and [PR #51](https://github.com/hungpv-2151/NestJS-tutorial/pull/51) for `PUT /api/articles/:slug`. 4E `DELETE /api/articles/:slug` is [PR #52](https://github.com/hungpv-2151/NestJS-tutorial/pull/52), ready directly above #51. For #52: build passed; full unit tests passed (38 files, 160 passed / 1 skipped); full E2E passed (16 files, 60 passed); focused DELETE E2E passed (7 tests); service unit tests passed (5 tests); lint reported 0 errors and 218 warnings across 121 files; OpenAPI YAML parsing/placement and diff checks passed; independent review signed off. Validation evidence is in the [PR comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/52#issuecomment-5863972597). Next: Phase 4F.
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
