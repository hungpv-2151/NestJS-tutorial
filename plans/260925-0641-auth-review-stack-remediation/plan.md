---
title: 'Auth review feedback across stacked PRs'
description: 'Resolve login and current-user review comments while preserving the stacked PR history and recording reusable generation rules.'
status: pending
priority: P2
effort: 6h
branch: chore-agent-rule-refresh
tags: [auth, backend, refactor, docs]
blockedBy: []
blocks: []
work_type: deliverable
created: 2026-09-25
---

# Auth review feedback across stacked PRs

## Scope and relationship

This is a bounded remediation of [the backend roadmap](../260910-0930-medium-clone-backend/plan.md), not a replacement for it. Address four open comments on PR #35 and one on PR #36. Record the PR #37 logging suggestion as a future consideration with no code change. Turn resolved PR #31 feedback into tracked generation rules without reopening its code.

## Phases

| Phase | Work | Dependency | Status |
| --- | --- | --- | --- |
| 1 | [Capture baseline and generation rules](./phase-01-baseline-and-rules.md) | None | Pending |
| 2 | [Resolve PR #35 login feedback](./phase-02-login-review.md) | Baseline from 1 | Pending |
| 3 | [Resolve PR #36 current-user feedback](./phase-03-current-user-review.md) | 2 propagated to #36 | Pending |
| 4 | [Propagate and validate the stack](./phase-04-stack-validation.md) | 2 and 3 | Pending |

## Data flow and compatibility

Login: HTTP DTO and request IP → controller → AuthService orchestration → rate limiter, credential repository, token issuer → user and token → serializer → unchanged `POST /api/users/login` response. Current user: guard validates token → controller passes claims → AuthService obtains user via UserService → controller serializes with presented token → unchanged `GET /api/user` response. Typed service errors map to the existing 401, 429 and 500 bodies at the controller boundary. Keep the fixed dummy password hash so unknown accounts still follow the password verification path; never log credentials, JWTs or raw identifiers.

## Stack policy

Keep PR #34 (`phase-02-register-complete`) as the base, #35 (`phase-02-login`) above it, #36 (`phase-02-current-user`) above #35, and #37 (`phase-02-logout`) above #36. Apply the rules change on the separate `chore-agent-rule-refresh` branch; do not mix it into the auth PRs. Record old SHAs before changes. Add the #35 fix as a new commit; rebase each descendant with `git rebase --onto <new-parent> <old-parent> <child>` in parent-first order, then add the #36 fix and continue through all still-open descendants. Compare each replay with `git range-diff`, then push rebased heads with `--force-with-lease` only after validation. Do not reset or cherry-pick whole child branches.

## Rollback

Save remote heads and local backup refs before rebasing. Revert the new #35 or #36 fix commit on its branch and repeat descendant propagation if a fix fails review. Restore a mistakenly replayed descendant from its saved ref only after checking remote lease and its unique commits. The rules commit can be reverted independently.
