---
title: 'Auth review feedback across stacked PRs'
description: 'Resolve login and current-user review comments while preserving the stacked PR history and recording reusable generation rules.'
status: completed
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

This is a bounded remediation of [the backend roadmap](../260910-0930-medium-clone-backend/plan.md), not a replacement for it. Verify four resolved review comments on PR #35 and one on PR #36 against their fixes, tests, and commit history; add commit-linked replies where none exists. Record the PR #37 logging suggestion as future consideration with no code change. Turn resolved PR #31 feedback into tracked generation rules without reopening its code.

## Phases

| Phase | Work | Dependency | Status |
| --- | --- | --- | --- |
| 1 | [Capture baseline and generation rules](./phase-01-baseline-and-rules.md) | None | Complete — baseline captured and batched persistence rule pushed on #44 |
| 2 | [Resolve PR #35 login feedback](./phase-02-login-review.md) | Baseline from 1 | Verified complete in existing #35 fix commit `336c78c` |
| 3 | [Resolve PR #36 current-user feedback](./phase-03-current-user-review.md) | 2 propagated to #36 | Verified complete in existing #36 implementation commit `b71cab5` |
| 4 | [Propagate and validate the stack](./phase-04-stack-validation.md) | 2 and 3 | Complete — #44–#46 pushed and validated; five commit-linked replies posted and verified |

## Data flow and compatibility

Login: HTTP DTO and request IP → controller → AuthService orchestration → rate limiter, credential repository, token issuer → user and token → serializer → unchanged `POST /api/users/login` response. Current user: guard validates token → controller passes claims → AuthService obtains user via UserService → controller serializes with presented token → unchanged `GET /api/user` response. Typed service errors map to the existing 401, 429 and 500 bodies at the controller boundary. Keep the fixed dummy password hash so unknown accounts still follow the password verification path; never log credentials, JWTs or raw identifiers.

## Stack policy

Keep PR #31 (`phase-02-register-complete`) as the base, #35 (`phase-02-login`) above it, #36 (`phase-02-current-user`) above #35, and #37 (`phase-02-logout`) above #36. PR #34 does not exist; GitHub confirms #35 directly targets #31. Generation rules are carried by #44 (`chore-agent-rule-refresh`); keep that change scoped to agent rules and plan evidence rather than mixing in auth implementation changes. Existing #35 and #36 fix commits already satisfy the review comments, so do not duplicate those changes. The #45 and #46 descendants were rebased parent-first onto #44 and #45, respectively. Their local range-diffs retained each branch's unique commits one-to-one. GitHub confirms the intended bases and heads and reports `mergeable=true` for #44, #45, and #46. If the rules branch changes again, record old SHAs and rebase only affected descendants with `git rebase --onto <new-parent> <old-parent> <child>` in parent-first order. Compare each replay with `git range-diff`, then push changed heads with `--force-with-lease` only after validation. Do not reset or cherry-pick whole child branches.

## Delivery status (2026-09-25)

The rules branch (#44, `d1e288e7`), avatar branch (#45, `a8408805`), and private-file branch (#46) are pushed. The auth logging fix is in #46 commit `5c6c4a13`, followed by plan and journal commits. The rebased descendant PRs retain their unique commits one-to-one; GitHub confirms the intended bases and heads and `mergeable=true` for all three. Post-rebase build, lint, unit, E2E, and focused checks pass; see [post-rebase test evidence](./evidence/raw-post-rebase-tests.json), [tempering results](./evidence/temper-results.json), and [inspection verdict](./evidence/inspection-verdict.json).

All five planned commit-linked inline replies are posted. GitHub API verification confirmed each reply's `in_reply_to_id` matches its intended root review comment:

- #35 comment `4058917154`: https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103946284
- #35 comment `4058920864`: https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103947083
- #35 comment `4058969692`: https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103947943
- #35 comment `4058971539`: https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103948693
- #36 comment `4059062185`: https://github.com/hungpv-2151/NestJS-tutorial/pull/36#discussion_r4103949416

PR #37's logging suggestion remains deferred as future consideration, with no code change or reply requested.

## Rollback

Save remote heads and local backup refs before rebasing. Revert the new #35 or #36 fix commit on its branch and repeat descendant propagation if a fix fails review. Restore a mistakenly replayed descendant from its saved ref only after checking remote lease and its unique commits. The rules commit can be reverted independently.
