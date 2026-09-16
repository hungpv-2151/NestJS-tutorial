# Users migration recovered from TypeORM metadata and shared-database drift

**Date**: 2026-09-16 12:15
**Severity**: medium
**Component**: TypeORM users migration and database CLI
**Status**: resolved

## What Happened

Phase 2B.1 started with a failed migration run. TypeORM reflected a nullable union property as `Object`, so PostgreSQL rejected the generated metadata before the migration could be applied. After that was fixed, the shared TEST database still contained a `users` table without the corresponding migration history. Applying the migration there was unsafe because it could collide with an existing table whose provenance was unclear. We verified the full apply/revert/apply path in a temporary Neon database, removed that temporary database, and only then applied the migration to `DATABASE_URL` after the user explicitly confirmed.

## The Brutal Truth

The first failure was ours: the entity relied on inferred metadata where the database contract needed an explicit type. The second problem was more uncomfortable: “the table exists” did not mean “the migration ran.” That shared database had drifted from the repository. It would have been easy to force the migration through and call the green command a success. The relief came only after testing against a clean temporary database and getting explicit permission before touching the configured database.

## Technical Details

The hard failure was TypeORM’s PostgreSQL metadata error: `Data type "Object" in "User.email" is not supported by "postgres" database.` The repair set the nullable field to explicit `varchar` metadata and kept the entity and migration definitions in parity. The temporary verification covered `apply → revert → apply → show applied`; the final configured database received the migration only after confirmation. No credentials, connection strings, or tokens are recorded here.

## What We Tried

We first ran the migration as authored and hit the `Object` type error. We changed the entity metadata and migration together, then reran against a temporary Neon database. We did not drop or overwrite the pre-existing shared TEST `users` table; its missing migration history made that path unsafe. After the clean database passed the cycle, we applied the migration to `DATABASE_URL` with explicit user approval.

## Root Cause Analysis

Two separate assumptions failed: TypeScript inference was treated as sufficient database typing, and the shared TEST database was assumed to represent migration history. Neither assumption was true. The repository lacked a clean-environment gate before the configured database was considered ready.

## Lessons Learned

Use explicit TypeORM column types whenever nullable unions or inferred types cross the database boundary. Check both schema state and migration history before applying anything to a shared database. Prove destructive or state-changing migration paths in an isolated database first, then require explicit confirmation for the real target.

## Next Steps

The implementation owner should keep migration apply/revert/show checks in CI or the release checklist and investigate the origin of the shared TEST schema drift before the next migration. The current users migration is applied and the temporary verification database is removed.
