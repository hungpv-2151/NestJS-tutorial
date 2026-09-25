# Phase 3F review found avatar replacement could leak files and race

**Date**: 2026-09-25 15:31
**Severity**: medium
**Component**: `PUT /api/user/avatar` and attachment cleanup
**Status**: resolved

## What Happened

The Phase 3F review found that avatar replacement could leave the previous file and attachment metadata behind. A storage write that created a partial file and then rejected could also leave an orphan. Concurrent replacements could both read the same prior avatar state and race while saving the user's image pointer. Cleanup failures were logged but did not leave a retryable record, so an old file could remain indefinitely.

## The Brutal Truth

The ugly part was that the endpoint could return success while storage and database state quietly accumulated debris. The first implementation treated cleanup as best effort without preserving enough state to try again. That made the failure easy to miss in normal requests and pushed the cost onto whoever eventually had to reconcile private files by hand. It stings because these were lifecycle gaps in the central replace path, not exotic behavior at the edge.

## Technical Details

`src/auth/user-avatar-handler.ts` now locks the user row with `pessimistic_write` before reading stale attachments and replacing the image. It records stale attachment rows until storage removal succeeds, allowing a later upload to retry failed old-avatar cleanup. If a write rejects, it removes the unique upload key; if that removal also fails, it saves a cleanup marker attachment. The unit cases exercise the concrete failures `disk full` and `storage unavailable` in `src/auth/user-avatar-handler.spec.ts`. Verification completed: 8 unit tests, 3 E2E tests, and build passed; lint reported 0 errors and 131 warnings.

## What We Tried

The review rejected silently discarding cleanup failures because that loses the only durable pointer to the orphan. The chosen repair keeps the new avatar successful when removal of an older avatar fails, retaining its attachment row for a later retry. For failed partial writes, it attempts immediate removal and stores a marker only if that cleanup also fails. The user-row lock serializes replacement; allowing concurrent replacement work without the lock was set aside because each request could otherwise act on stale avatar state.

## Root Cause Analysis

Replacement treated the database pointer update, attachment metadata, and private storage file as though they changed atomically. They do not: the database transaction cannot roll back a storage operation, and requests can overlap. Without serialization and durable cleanup state, both ordinary cleanup failure and partial-write failure could strand files.

## Lessons Learned

For file replacement, define recovery for each boundary separately: storage write, metadata save, pointer update, and old-file removal. Give every upload a unique key, serialize changes to the owning record, and preserve a retry row whenever cleanup fails. A swallowed cleanup error without durable state is deferred data loss, not successful best effort.

## Next Steps

Phase 3F's avatar upload review is resolved. The next PR owns `GET /api/files/:id`; keep that file-read boundary separate from this upload PR, as the Phase 3 plan specifies.
