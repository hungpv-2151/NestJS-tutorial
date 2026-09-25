# Phase 4 — Stack propagation and validation

## Context and ownership

Priority P2, in progress, 1h; depends on Phases 2 and 3. Own git integration and review evidence; no new auth behavior. Phase 1 rules branch remains separate.

## Steps

1. #35–#43 are unchanged by this plan and already retain their direct parent links. Before replay, preserve remote/local heads for #45 and #46. Rebase `phase-03-user-avatar-pr45` onto updated `chore-agent-rule-refresh` with `git rebase --onto <new-rules-head> <old-rules-head> phase-03-user-avatar-pr45`, then rebase `phase-03-private-file-read-pr46` onto the new #45 head. Resolve conflicts only on the affected child branch.
2. For each replay, run `git range-diff oldParent..oldChild newParent..newChild`, compare changed-file scope, and verify no child-only commit or unrelated change disappeared. Verify every PR base/head pair and no unexpected code diff in #37. Stop on an ambiguous conflict and inspect the original commit before continuing.
3. Run `pnpm build`, `pnpm lint`, focused auth unit tests, `pnpm test`, and `pnpm test:e2e` where required services are available. Record exact command, exit code, and SHA; report infrastructure failures separately from product failures. Check redacted logs and no secret files in the diff. Run reviewer pass, update PR evidence, and reply to the four #35 and one #36 threads with the verified commit links. Keep #37 logging deferred and unchanged.
4. Push the #44 rules update normally. For rebased #45/#46 descendants, use `git push --force-with-lease` after confirming each saved remote head still matches. Never use unconditional force. Leave pre-existing untracked backup files untouched.

## Risk, proof, and rollback

High likelihood/impact: a descendant rebase may drop a unique commit or overwrite a newer remote update. Backup refs, `range-diff`, remote lease, and parent-first replay are mandatory. Done when all five actionable review comments have commit-linked replies, #37 is explicitly deferred, each PR shows its intended diff, all required gates pass, and every open descendant retains its unique commits. Restore from saved refs only after checking remote state; revert a faulty fix at its source branch and replay descendants again.
