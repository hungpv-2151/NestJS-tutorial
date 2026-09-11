## Review Summary

### Scope

- Files reviewed: Phase 05 plan, final tester evidence, contract runner, Hurl scripts/fixture adjustment, test configs, package/workspace dependency changes, API README, validation/filter changes, and environment-file shape.
- Depth: full-plan readiness review.

### Assessment

The API behavior is strongly verified: build, lint, unit, live E2E and the complete sequential Hurl suite pass (154/154 requests). The committed environment example remains placeholder-only. The contract runner itself is not robust on failure or interruption, however, so final commit readiness is blocked by its process-cleanup race.

### Critical

None.

### High

1. **Contract runner can hang or orphan its API child when startup/execution fails** — `spec/api/run-contract-tests.mjs:32-39`. The `finally` block calls `api.kill()` and only then attaches an `exit` listener. If Nest exits before that listener is attached (bad startup config, port conflict, crash, or readiness timeout), the already-fired event is missed and the Promise never resolves. The spawned API also has no `error` handler, and SIGINT/SIGTERM sent to the runner do not run a cleanup handler, leaving a child process holding the port/test DB connection. Implement an idempotent stop helper that observes `exitCode`/`signalCode` before waiting, attaches both `exit` and `error` handlers at spawn time, and registers signal cleanup. This is required by the Phase 05 trap-based shutdown contract.

### Medium

1. **README contradicts the installed Hurl dependency** — `spec/api/README.md:31-33`, `package.json:48`. The project installs and exposes Hurl through pnpm, but the README tells users to install a Hurl CLI separately. State that `pnpm install` supplies the runner (or make an external CLI an actual prerequisite) so the documented contract command is reproducible.

### Low

None.

### Edge Cases Turned Up

- The first contract attempt surfaced a Prisma advisory-lock timeout visibly; the successful retry did not hide that transient condition.
- Test configuration now keeps browser-only `spec/e2e` suites out of both default unit and API E2E commands, while dedicated API E2E uses the isolated test database.
- DTO/filter adjustments preserve field-specific 422 envelopes; updated login status assertions match the OpenAPI 200 contract.

### Done Well

- `test:contract` builds, deploys migrations with the test DB URL, starts test-mode Nest, readiness-polls, and invokes Hurl sequentially with an origin-only `HOST`.
- Hurl is pinned in the lockfile/workspace allowlist; all 13 fixture files and 154 requests pass.
- Environment-shape verification confirms required entries are placeholders only; no secret material was surfaced in review commands or reports.
- Contract edge tests cover invalid optional tokens, required feed auth, and repeated social idempotency beyond the Hurl fixtures.

### Actions In Order

1. Make runner startup/shutdown idempotent and signal-safe; add a failure-path test or manual verification that no child remains after a forced startup failure.
2. Align the API README with the pnpm-managed Hurl dependency.
3. Re-run `pnpm run test:contract` plus the project gates after the runner fix.

### Numbers

- Build: pass.
- Unit tests: 10/10 pass.
- API E2E: 30/30 pass.
- Hurl: 13/13 files, 154/154 requests pass (on retry after visible transient migration lock timeout).
- Lint: 0 errors, 63 warnings.

### Still Unresolved

- The High runner lifecycle flaw blocks final commit readiness.
- Default Vitest browser-suite exclusion is intentional; browser Playwright execution remains outside this API Phase 05 gate.

**Status:** DONE_WITH_CONCERNS
**Summary:** Functional/API contract gates pass and no committed secret is present, but the contract runner can hang or leak its API child on failure/interruption.
**Concerns/Blockers:** Fix signal-safe child cleanup before the final commit.

---

## Final Runner Lifecycle Addendum — 2026-09-11

### Assessment

The prior runner lifecycle High finding is resolved. **The full plan is commit-ready.**

### Verification

- The API child is observed for both `exit` and `error` immediately after spawn. Readiness fails promptly if it exits early rather than waiting for the full poll period.
- `stopApi()` is idempotent, checks already-exited state before attaching a wait, handles error/exit, applies a bounded graceful SIGTERM wait, then uses SIGKILL as a last resort. This closes the former missed-event/hang path.
- SIGINT and SIGTERM route through cleanup before the runner exits, covering interruption as well as normal Hurl failure/success in `try/finally`.
- The README now correctly states that `pnpm install` supplies pinned Hurl and uses the origin-only host command.
- Runner syntax check passes; existing final evidence remains build pass, unit 10/10, API E2E 30/30, and Hurl 13/13 files / 154/154 requests. Environment-shape verification remains placeholder-only.

### Still Unresolved

None that blocks this API plan. Browser Playwright execution remains intentionally outside the API contract gate.

**Status:** DONE
**Summary:** Phase 05 lifecycle remediation is sound; all verified API gates and Hurl contract tests are ready for final commit.
**Concerns/Blockers:** None. The full plan is ready to commit.
