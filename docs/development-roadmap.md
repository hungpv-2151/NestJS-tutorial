# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; 4A is complete and [PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47) is ready for review on #46. 4B create-article is ready to submit on #47; it is not yet submitted or merged. `pnpm build` passed; full `pnpm test` passed (35 files; 138 passed, 0 failed/skipped); full `pnpm test:e2e` passed (11 files; 39 passed, 0 failed/skipped); focused service tests passed (6/6); all used disposable local PostgreSQL and Redis. Lint reported 0 errors and 17 warnings in `src/articles` transaction design/custom typed-error paths; retained C018/C030 heuristic warnings and S037 despite explicit headers. Hurl was unavailable, so isolated Supertest E2E was used. See the [latest validation correction](https://github.com/hungpv-2151/NestJS-tutorial/pull/47#issuecomment-5861324933).
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
