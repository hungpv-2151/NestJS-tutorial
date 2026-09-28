# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; 4A is complete and [PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47) is ready for review on #46. 4B create-article is [PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48), ready for review on #47; it is not merged or complete. 4C article detail is submitted as [PR #49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49), ready for review directly above #48; validation and independent review pass, with evidence in the [PR comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/49#issuecomment-5862775055). 4D is split to keep each PR within the production-change limit: [PR #50](https://github.com/hungpv-2151/NestJS-tutorial/pull/50) is a ready foundation PR based on #49 with `Public API change: none`; [PR #51](https://github.com/hungpv-2151/NestJS-tutorial/pull/51) is the ready `PUT /api/articles/:slug` API PR based on #50. Neither PR is merged. #50 build passed; unit tests passed (35 files, 143 passed / 1 skipped); E2E passed (12 files, 46 passed); lint reported 0 errors and 206 warnings. #51 build passed; unit tests passed (37 files, 155 passed / 1 skipped); E2E passed (14 files, 53 passed); transaction integration passed (2 tests); focused PUT E2E passed (7 tests); lint reported 0 errors and 206 warnings. Evidence is recorded in the respective PR validation comments and [Phase 4D checkpoint](../plans/260910-0930-medium-clone-backend/phase-04d-update-article.md). Continue with the next planned API on top of this stack.
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
