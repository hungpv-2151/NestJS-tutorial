# Phase 4 — Stack propagation and validation

## Context and ownership

Priority P2, partially complete, 1h; depends on Phases 2 and 3. Own git integration and review evidence; no new auth behavior. The #44 rules change is scoped to the rules branch. Rebase, validation, and pushes are complete; posting five planned inline replies is blocked by GitHub write access.

## Steps

1. **Complete:** Preserved the old #45/#46 remote and local heads, then rebased `phase-03-user-avatar-pr45` onto `chore-agent-rule-refresh` and `phase-03-private-file-read-pr46` onto the new #45 head.
2. **Complete:** Local `git range-diff` checks retained the unique commits on #45 and #46 one-to-one. GitHub confirms the intended bases and heads and reports `mergeable=true` for #44, #45, and #46. The auth logging fix is in #46 commit `5c6c4a13`; plan and journal commits were added on top afterward.
3. **Complete:** Post-rebase checks passed: `pnpm build`; `pnpm lint` (95 files, 139 warnings, 0 errors); `pnpm test` (123 passed, 1 skipped); `pnpm test:e2e` (36 passed); focused attachment/auth tests (34 passed); focused request-failure logger tests (4 passed). Test evidence is in [raw-post-rebase-tests.json](./evidence/raw-post-rebase-tests.json); reviewer evidence is in [inspection-verdict.json](./evidence/inspection-verdict.json).
4. **Blocked:** Attempted all four planned #35 and one #36 commit-linked inline replies through the GitHub connector; each returned `403 Resource not accessible by integration`. `gh auth status`, `gh api user`, and `gh stack push` hung and were interrupted. No reply was posted. The branch pushes are confirmed independently by GitHub. Posting the five replies needs working GitHub write access.
5. **Complete:** PR #37's logging suggestion remains deferred for future operational need; no #37 code change or reply was made.

## Risk, proof, and rollback

The rebase risk is closed: backups were preserved, range-diffs retained the unique commits one-to-one, and GitHub confirms the pushed PR bases/heads are mergeable. The remaining completion condition is posting all five commit-linked replies after GitHub write access works. Until then, this phase and the overall plan remain partially complete. PR #37 stays deferred. If another descendant rebase is needed, verify remote leases and replay parent-first; restore from saved refs only after checking remote state, and revert a faulty fix at its source branch before replaying descendants.
