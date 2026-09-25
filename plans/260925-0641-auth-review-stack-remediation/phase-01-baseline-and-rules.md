# Phase 1 — Baseline and rules

## Context and ownership

Priority P2, in progress, 1h. Read PR #31 resolved feedback and open #35–#37 threads, [roadmap](../260910-0930-medium-clone-backend/plan.md), `AGENTS.md`, and relevant auth files. Rules owner: `AGENTS.md` only. Auth owners in later phases do not edit it. Keep ignored `.claude/rules/` out of the commit. See [baseline and review synthesis](./reports/baseline-and-review-synthesis.md).

## Steps

1. Confirmed GitHub heads/bases and review-thread state; captured local heads, merge bases, clean status, remote URL, and backup refs for #45/#46 before stack propagation.
2. Reviewed recurring #31 feedback against tracked `AGENTS.md`. Service boundaries, focused constants/interfaces, and redacted operational logging were already covered. Added the missing conditional rule for batched collection persistence. Logging remains need-driven, so PR #37 gets no speculative code.
3. Review the rules diff for consistency with existing project rules and ensure no accidental behavior change.

## Risk, proof, and rollback

Risk low likelihood/medium impact: a broad rule could impose unnecessary refactors. Keep each instruction conditional on relevant work and verify it against PR #31 outcomes. Done when the rule diff is scoped to `AGENTS.md`, the PR map and old SHAs are recorded, and the rules commit is independent. Revert that commit alone if wording needs revision.
