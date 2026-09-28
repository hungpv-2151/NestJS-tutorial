# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; 4A is complete and [PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47) is ready for review on #46. 4B create-article is [PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48), ready for review on #47; it is not merged or complete. 4C article detail is submitted as [PR #49](https://github.com/hungpv-2151/NestJS-tutorial/pull/49), ready for review directly above #48; validation and independent review pass, with evidence in the [PR comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/49#issuecomment-5862775055). The database reset targeted only `TEST_DATABASE_URL` through the project reset runner; all five migrations applied. `pnpm build` passed; `pnpm lint` reported 0 errors and 185 warnings, with rationale in the phase file. `pnpm test`: 143 passed, 1 skipped; `pnpm test:e2e`: 46 passed. Per the user's instruction to pause after the next API PR for a separate rule-update plan, 4D has not started.
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
