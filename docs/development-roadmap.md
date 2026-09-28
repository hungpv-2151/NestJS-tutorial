# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; 4A is complete and [PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47) is ready for review on #46. 4B create-article was submitted as [PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48), ready for review on #47; it is not merged or complete. Phase 4C article detail validation and independent review pass; it is ready to submit as a PR directly above #48, but the PR has not been created. The database reset was run only against `TEST_DATABASE_URL` with the project reset runner and confirmation; five migrations applied. `pnpm build` passed; `pnpm lint` reported 0 errors and 185 warnings, with retained-warning rationale recorded in the phase file. `pnpm test`: 143 passed, 1 skipped (35 passed files, one skipped); `pnpm test:e2e`: 46 passed (12 files). 4D may prepare, but implementation starts only after the 4C PR is created on #48. PR comment evidence remains pending.
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
