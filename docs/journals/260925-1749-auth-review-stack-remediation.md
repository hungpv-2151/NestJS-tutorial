# Auth review fixes exposed a gap in request log redaction

**Date**: 2026-09-25 17:49
**Severity**: medium
**Component**: Request failure logging, AppModule tests, stacked auth review PRs
**Status**: complete

## What Happened

Inspection found the request failure logger redacted credentials but left personal identifiers visible, including nested `email` and `username`. The sanitizer now recursively and case-insensitively redacts email, username, userId, firstName, lastName, and displayName; the regression test checks top-level and nested email/username. The AppModule test also expected four imports after AttachmentsModule was registered; it now expects five.

The #45 and #46 branches were rebased parent-first. `git range-diff` retained each branch's commits one-to-one; GitHub confirmed #44–#46 had intended bases and heads with `mergeable=true`. Heads were pushed with exact `--force-with-lease` values after `gh stack push` hung. The GitHub connector initially returned `403 Resource not accessible by integration` for inline replies. The authenticated GitHub CLI then identified the account as `hungpv-2151`, and all five planned replies on #35 and #36 were posted and verified:

| PR | Review comment | Reply |
|---|---:|---|
| #35 | `4058917154` | [View reply](https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103946284) |
| #35 | `4058920864` | [View reply](https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103947083) |
| #35 | `4058969692` | [View reply](https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103947943) |
| #35 | `4058971539` | [View reply](https://github.com/hungpv-2151/NestJS-tutorial/pull/35#discussion_r4103948693) |
| #36 | `4059062185` | [View reply](https://github.com/hungpv-2151/NestJS-tutorial/pull/36#discussion_r4103949416) |

## The Brutal Truth

“Redacted logging” sounded complete while ordinary identity fields remained exposed in the failure path. The module-count miss was smaller but plain: the test stopped matching the module graph. The stack survived rebase. The connector's 403 initially blocked review follow-through; the CLI account was authenticated successfully and all five replies were then verified.

## Technical Details

`src/common/logging/request-failure-log.ts` adds `email`, `username`, `userid`, `firstname`, `lastname`, and `displayname` to the case-insensitive sensitive-key set. Its spec checks nested and top-level identity fields alongside password and passwordHash. `src/app.module.spec.ts` expects five imports.

The code fix is commit `5c6c4a13`. Verification on that code state passed: build; lint (95 files, 0 errors, 139 warnings); unit tests (123 passed, 1 skipped); E2E (36 passed); focused attachment/auth tests (34 passed); logger tests (4 passed). Later documentation commits on #46 are `d4561dde` (this journal) and `e505e098` / `0d200bd1` (plan status). Final stack heads: #44 `d1e288e7`, #45 `a8408805`, #46 `0d200bd1`.

## What We Tried

Existing #35/#36 fixes were reused. For descendants, backups and recorded remote OIDs enabled parent-first rebases, range-diff checks, and lease-protected pushes. `gh stack push` stalled, so it was interrupted. Initial GitHub connector reply attempts returned 403. `gh api user --jq .login` then confirmed the CLI account as `hungpv-2151`; the five inline replies were posted and their URLs verified. #37's future logging suggestion remains intentionally deferred without code change.

## Root Cause Analysis

The sensitive-key list and its test covered credentials, not personal identifiers; the test even expected `username` to remain visible. The fixed AppModule count was not updated with AttachmentsModule. Stack ancestry was verified by range-diffs and GitHub's mergeable state. The connector's 403 reflected its integration permission, while the authenticated CLI had the required write access; the successful CLI replies closed the follow-through gap.

## Lessons Learned

Review log sanitizers against personal identifiers and nested values. Update root-module count assertions with imports. For stacked rebases, record OIDs, replay parent-first, inspect range-diffs, and push with exact leases. Verify review replies separately, including when the connector and authenticated CLI have different permissions.

## Next Steps

Completed: all five commit-linked replies on #35 and #36 were posted and verified at the URLs above. No further code change is pending from this remediation. PR #37 remains intentionally deferred unless a current operational need for logout failure logging is established.
