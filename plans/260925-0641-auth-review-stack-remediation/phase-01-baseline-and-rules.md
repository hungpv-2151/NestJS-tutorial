# Phase 1 — Baseline and rules

## Context and ownership

Priority P2, pending, 1h. Read PR #31 resolved feedback and open #35–#37 threads, [roadmap](../260910-0930-medium-clone-backend/plan.md), `AGENTS.md`, and relevant auth files. Rules owner: `AGENTS.md` only. Auth owners in later phases do not edit it. Keep ignored `.claude/rules/` out of the commit.

## Steps

1. Fetch and confirm each PR head/base and review-thread state. Capture `git rev-parse` for every stack head, `git merge-base`, `git status`, and remote URLs. Preserve the current untracked backup files.
2. Add concise, reusable instructions to tracked `AGENTS.md`: controllers handle transport and map typed errors; services own authentication and registration decisions; module-specific constants and interfaces live outside dense implementation files when this improves clarity; use batched DB operations for collections rather than query per item; log meaningful failures with credentials, tokens, and personal identifiers redacted. State that logging follows current observability needs, so PR #37 gets no speculative code.
3. Review the rules diff for consistency with existing project rules and ensure no accidental behavior change.

## Risk, proof, and rollback

Risk low likelihood/medium impact: a broad rule could impose unnecessary refactors. Keep each instruction conditional on relevant work and verify it against PR #31 outcomes. Done when the rule diff is scoped to `AGENTS.md`, the PR map and old SHAs are recorded, and the rules commit is independent. Revert that commit alone if wording needs revision.
