# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; Phase 4A–4F are ready/open as stacked PRs [#47–#53](https://github.com/hungpv-2151/NestJS-tutorial/pulls), based in order on #46 → #47 → #48 → #49 → #50 → #51 → #52. None are merged. 4D uses [PR #50](https://github.com/hungpv-2151/NestJS-tutorial/pull/50) as a foundation (`Public API change: none`) and [PR #51](https://github.com/hungpv-2151/NestJS-tutorial/pull/51) for `PUT /api/articles/:slug`. 4E `DELETE /api/articles/:slug` is [PR #52](https://github.com/hungpv-2151/NestJS-tutorial/pull/52). 4F [PR #53](https://github.com/hungpv-2151/NestJS-tutorial/pull/53) is a reviewed query foundation with no public API or route, based directly on #52. For #53: focused PostgreSQL integration passed (1/1, `TEST_DATABASE_URL`); full unit tests passed (39 files, 161 passed / 1 skipped); full E2E passed (16 files, 60 passed); build and lint passed (0 errors, 223 warnings); diff check passed; independent review signed off. GitHub Static analysis passed. Validation evidence is in the [PR comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/53#issuecomment-5864274902). Next: Phase 4G HTTP contract and API.
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
