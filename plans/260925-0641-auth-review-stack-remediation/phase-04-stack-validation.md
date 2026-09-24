# Phase 4 — Stack propagation and validation

## Context and ownership

Priority P2, pending, 1h; depends on Phases 2 and 3. Own git integration and review evidence; no new auth behavior. Phase 1 rules branch remains separate.

## Steps

1. For each child after #35, save `oldParent` and `oldChild` refs before replay. Rebase `phase-02-current-user` onto updated `phase-02-login` using its old parent; add the #36 fix; rebase `phase-02-logout` onto updated #36. Continue parent-first through every open descendant identified from PR base metadata and branch ancestry, including later profile/attachment branches; resolve conflicts on the child's branch only.
2. For each replay, run `git range-diff oldParent..oldChild newParent..newChild`, compare changed-file scope, and verify no child-only commit or unrelated change disappeared. Verify every PR base/head pair and no unexpected code diff in #37. Stop on an ambiguous conflict and inspect the original commit before continuing.
3. Run `pnpm build`, `pnpm lint`, focused auth unit tests, `pnpm test`, and `pnpm test:e2e` where required services are available. Record exact command, exit code, and SHA; failed infrastructure is reported separately from a product regression. Check redacted logs and no secret files in the diff. Run reviewer pass, then update PR evidence and reply to #35/#36 threads with commit links. Mark #37 comment as future scope without code.
4. Push #35 normally if it only gained commits. For rebased descendants, use `git push --force-with-lease` after confirming the saved remote head still matches. Never use unconditional force. Leave existing untracked backup files untouched.

## Risk, proof, and rollback

High likelihood/impact: a descendant rebase may drop a unique commit or overwrite a newer remote update. Backup refs, `range-diff`, remote lease, and parent-first replay are mandatory. Done when all five active comments have responses, #37 is explicitly deferred, each PR shows its intended diff, all required gates pass, and every open descendant retains its unique commits. Restore from saved refs only after checking remote state; revert a faulty fix at its source branch and replay descendants again.
