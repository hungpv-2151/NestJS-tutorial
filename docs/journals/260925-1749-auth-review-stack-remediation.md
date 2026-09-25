# Auth review fixes exposed a gap in request log redaction

**Date**: 2026-09-25 17:49
**Severity**: medium
**Component**: Request failure logging, AppModule tests, stacked auth review PRs
**Status**: ongoing

## What Happened

Inspection found the request failure logger redacted credentials but left personal identifiers visible, including nested `email` and `username`. The sanitizer now recursively and case-insensitively redacts email, username, userId, firstName, lastName, and displayName; the regression test checks top-level and nested email/username. The AppModule test also expected four imports after AttachmentsModule was registered; it now expects five.

The #45 and #46 branches were rebased parent-first. `git range-diff` retained each branch's commits one-to-one; GitHub confirmed #44–#46 had intended bases and heads with `mergeable=true`. Heads were pushed with exact `--force-with-lease` values after `gh stack push` hung. Five planned replies on #35 and #36 remain outstanding: GitHub returned `403 Resource not accessible by integration` for each.

## The Brutal Truth

“Redacted logging” sounded complete while ordinary identity fields remained exposed in the failure path. The module-count miss was smaller but plain: the test stopped matching the module graph. The stack survived rebase, but review follow-through is unfinished because the GitHub write path rejected every reply. That split is frustrating: green code checks cannot close a review thread.

## Technical Details

`src/common/logging/request-failure-log.ts` adds `email`, `username`, `userid`, `firstname`, `lastname`, and `displayname` to the case-insensitive sensitive-key set. Its spec checks nested and top-level identity fields alongside password and passwordHash. `src/app.module.spec.ts` expects five imports.

On the final working tree, committed as `5c6c4a13`, verification passed: build; lint (95 files, 0 errors, 139 warnings); unit tests (123 passed, 1 skipped); E2E (36 passed); focused attachment/auth tests (34 passed); logger tests (4 passed). Heads: #44 `d1e288e7`, #45 `a8408805`, #46 `5c6c4a13`.

## What We Tried

Existing #35/#36 fixes were reused. For descendants, backups and recorded remote OIDs enabled parent-first rebases, range-diff checks, and lease-protected pushes. `gh stack push` stalled, so it was interrupted. All five inline reply attempts returned 403; none was posted. #37's future logging suggestion remains deferred without code change.

## Root Cause Analysis

The sensitive-key list and its test covered credentials, not personal identifiers; the test even expected `username` to remain visible. The fixed AppModule count was not updated with AttachmentsModule. Stack ancestry was verified by range-diffs and GitHub's mergeable state. The outstanding replies are an access limitation: the connector lacks inline-reply permission, while the CLI stack push stalled.

## Lessons Learned

Review log sanitizers against personal identifiers and nested values. Update root-module count assertions with imports. For stacked rebases, record OIDs, replay parent-first, inspect range-diffs, and push with exact leases. Verify replies separately; keep the plan open after a 403.

## Next Steps

The five commit-linked replies on #35 and #36 still need to be posted after GitHub write access is available. Verify each reply URL and resolve the plan only after all five are visible. No further code change is pending from this remediation; PR #37 stays deferred unless a current operational need for logout failure logging is established.
