# Development Roadmap

The detailed roadmap and per-API acceptance criteria live in [the medium backend plan](../plans/260910-0930-medium-clone-backend/plan.md).

## Current Progress

- Phase 1: Complete.
- Phase 2: In progress; auth APIs through 2H submitted, 2I remains deferred.
- Phase 3: In progress; 3G is PR #46 on #45.
- Phase 4: In progress; 4A is complete and [PR #47](https://github.com/hungpv-2151/NestJS-tutorial/pull/47) is ready for review on #46. 4B create-article was submitted as [PR #48](https://github.com/hungpv-2151/NestJS-tutorial/pull/48), ready for review on #47; it is not merged or complete. Phase 4C article detail has local commits `1fe71c5a` (plan/research) and `29f47e67` (implementation), with independent review DONE, but remains in progress at the test-database validation gate; it has not been pushed as a PR. `pnpm build` passed; focused service tests passed (5/5) and focused read-only E2E passed (5/5). Lint reported 0 errors and 185 repository warnings. Full unit tests had 141 passed, 1 skipped, and 2 failed on existing integration fixture inserts because configured `TEST_DATABASE_URL` lacks the required `users.updated_at` default. Article-detail DB-backed E2E could not complete because the configured target lacks `article_favorites` and `user_follows`. No migrations or resets were run. Phase 4D remains gated until 4C is validated and submitted.
- Phases 5–6: Pending.

Update this summary only when the linked plan has verified evidence for the corresponding status change.
