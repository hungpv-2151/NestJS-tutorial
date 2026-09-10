## Finding 1: The plan leaves two incompatible Hurl base-URL contracts
- **Severity:** Critical
- **Location:** Phase 05, section "Implementation Steps", step 3
- **Flaw:** The plan prescribes `HOST=http://localhost:<port> ./spec/api/run-api-tests-hurl.sh`, but every Hurl request appends `/api` itself. The runner passes `HOST` straight to Hurl without adding a prefix.
- **Failure scenario:** Running the documented final gate against the planned Nest global prefix sends `POST http://localhost:<port>/api/users` only when `HOST` is the origin. This part is actually correct. However the project's API README instead documents a host already ending in `/api`, while the Hurl files append `/api`, producing `/api/api/users`. The plan declares the Hurl suite authoritative but neither reconciles nor corrects this contradictory execution contract. A developer following the repository README gets a systematic 404; a developer following the plan gets different behavior. The release gate is not reproducible.
- **Evidence:** `spec/api/hurl/auth.hurl:2` appends `/api/users`; `spec/api/run-api-tests-hurl.sh:5,15-19` forwards `HOST` unchanged; `spec/api/README.md:10` sets `HOST=http://localhost:3000/api`; Phase 05 step 3 is `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:37`.
- **Suggested fix:** Establish one canonical command using an origin-only `HOST` (for example `http://localhost:3000`), correct the README or Hurl paths, and make the package script call that exact command.

## Finding 2: Hurl can race application readiness and migration completion
- **Severity:** High
- **Location:** Phase 05, sections "Architecture" and "Implementation Steps", step 3
- **Flaw:** The plan sequences “start application” then immediately invokes Hurl, but defines no readiness signal, bounded wait, failure cleanup trap, or rule that migrations finish before the listening process is treated as ready.
- **Failure scenario:** On a cold PostgreSQL or CI worker, the shell launches Nest and Hurl begins its first registration before the listener or migration is ready. The runner calls `hurl --test` immediately and has no retry/readiness behavior, so an intermittent connection refusal fails the acceptance stage. A failed process can also remain bound to the configured port and poison the next run.
- **Evidence:** `spec/api/run-api-tests-hurl.sh:1-19` has only `set -euo pipefail` and immediate `hurl --test`; `src/main.ts:4-9` exposes only asynchronous factory/listen startup and no readiness endpoint; Phase 05 says start then run Hurl at `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:24,37`.
- **Suggested fix:** Specify a single orchestration script with migration completion before server launch, bounded polling of a defined readiness endpoint/socket, PID capture, and `trap`-based shutdown on both success and failure.

## Finding 3: Pagination order is nondeterministic on equal timestamps
- **Severity:** High
- **Location:** Phase 03, sections "Key Insights" and "Implementation Steps", step 5; Phase 04, step 4
- **Flaw:** The plan requires only “newest-first” ordering. It does not define a stable secondary key, although offset pagination relies on an unambiguous total ordering.
- **Failure scenario:** Two articles created within the same timestamp resolution receive identical `createdAt`. PostgreSQL is free to return either row first for `ORDER BY createdAt DESC`; offset page 0 and page 1 can swap, repeat, or skip entries across identical requests. The problem carries directly into the feed because it reuses the same list behavior.
- **Evidence:** The plan calls for newest-first offset pagination at `plans/260910-0930-medium-clone-backend/phase-03-articles-tags-listing.md:14,39` and reuses it for feed at `plans/260910-0930-medium-clone-backend/phase-04-social-comments-feed.md:15,38`; acceptance asserts that two adjacent pages identify distinct creation-order slugs at `spec/api/hurl/pagination.hurl:45-59`.
- **Suggested fix:** Require `ORDER BY createdAt DESC, id DESC` (or an equivalent immutable unique tie-breaker) for every global/feed query and add an integration test with deliberately equal timestamps.

## Finding 4: Social mutations have a target-deletion race with no required outcome
- **Severity:** High
- **Location:** Phase 04, section "Implementation Steps", steps 1-2
- **Flaw:** The plan requires a target lookup before the social mutation, then relation insertion/deletion in a transaction, but does not require the target existence check and write to be a single transaction with a defined foreign-key-conflict mapping.
- **Failure scenario:** Request A resolves an article/profile; request B deletes that target before A writes its favorite/follow. A's relation write then hits a foreign-key failure or a zero-row delete. The generic error mapper can surface a 500/incorrect success instead of the contract's 404, and idempotency is not preserved under the race.
- **Evidence:** The vulnerable split is explicit in `plans/260910-0930-medium-clone-backend/phase-04-social-comments-feed.md:35-36`; the contract requires 404 for a missing favorite target at `spec/api/openapi.yml:407-415` and the Hurl suite asserts it at `spec/api/hurl/errors_articles.hurl:151-163`; profile mutation likewise requires 404 at `spec/api/openapi.yml:126-134`.
- **Suggested fix:** Define a transaction/conditional-write algorithm that locks or atomically verifies the target, handles FK/unique outcomes, and maps a concurrently removed target to the resource-specific 404. Add a concurrent delete-versus-follow/favorite test.

## Finding 5: The proposed Nest E2E path bypasses production HTTP setup
- **Severity:** High
- **Location:** Phase 05, sections "Related Code Files" and "Implementation Steps", steps 1-2
- **Flaw:** The plan intends to replace the starter E2E test with app helpers but never requires those helpers to apply the same prefix, `ValidationPipe`, exception filter, and configuration startup path promised in Phase 01. The existing test constructs a bare testing application, not `main.ts` bootstrap.
- **Failure scenario:** E2E tests can pass controller/service behavior while never exercising `/api`, whitelist/forbid-extra behavior, transformed queries, or contract error serialization. Conversely, they may call unprefixed routes that production does not expose. The final “unit/Vitest E2E” gate therefore cannot demonstrate the public behavior it claims to cover.
- **Evidence:** Production startup is the only existing bootstrap path at `src/main.ts:4-9`; the current E2E harness creates and initializes an application directly at `test/app.e2e-spec.ts:10-17`; Phase 01 places prefix/pipe/filter in `src/main.ts` at `plans/260910-0930-medium-clone-backend/phase-01-foundation-data.md:30-34,42-43`; Phase 05 only names generic helpers at `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:28-38`.
- **Suggested fix:** Extract HTTP bootstrap configuration into an explicit reusable function used by both `main.ts` and E2E setup, then make route-prefix and representative 401/422 envelope assertions mandatory.

**Status:** DONE_WITH_CONCERNS
**Summary:** Five material failure paths were found in acceptance orchestration, pagination, concurrent social mutations, and E2E bootstrap fidelity.
**Concerns/Blockers:** Findings 1 and 4 block a reliable contract-ready implementation until the plan is amended.
