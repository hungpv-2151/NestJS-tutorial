# Phase 06 — Private-file metadata/storage integration test

## Scope

One test-only foundation PR, stacked after PR #68. No public API, production behavior, schema, or migration changes. Prove that persisted attachment metadata and bytes in private storage stay consistent across upload and owner read.

## Data flow

`UUID-scoped owner + foreign user → direct fixture inserts through User/Attachment repositories + PrivateAttachmentStorage(temp root) → FileReadHandler + UserService + repository + access policy → private bytes and stored metadata`

Use real `UserService`, `Attachment` repository, `FileReadHandler`, access policy, PostgreSQL and filesystem storage. Seed one attachment row and its file directly; this isolates the metadata/storage read boundary from the separate avatar upload and HTTP tests.

## Files

- Create `test/private-file-boundary.integration-test.ts`: seed two UUID-scoped real users, write fixture bytes with `PrivateAttachmentStorage`, and persist the matching attachment metadata; read through `FileReadHandler` and assert exact bytes and metadata; assert a second real user gets the same non-disclosing 404 as an unavailable file; delete the backing file and assert the owner also gets 404.
- Create `vitest.config.private-files.ts`: include only this test, use `test/setup/test-database.ts`, and set `fileParallelism: false`.
- Modify `package.json`: add `test:private-files` for the dedicated config.
- Add `evidence/phase-06/private-file-boundary-report.json` with commands, exit codes, result, and tested commit.
- Update only the open integration-matrix TODO in `phase-06-unit-e2e-c2-testing.md` to link this plan.

## Isolation and cleanup

- Require the existing guarded `TEST_DATABASE_URL` setup and an already migrated test database. Do not run migrations from this test.
- Avoid `SET`/`RESET search_path`, DDL, `synchronize`, `DROP`, and shared-table truncation. Use unique usernames/emails and transaction-generated UUIDs; delete only fixture users in `finally` and rely on the attachment FK cascade.
- Create storage beneath a unique `mkdtemp()` directory in the OS temp root, never `storage/private`. In nested `finally` cleanup, delete only the seeded attachment/user IDs, remove that directory, and close the DataSource even if DB cleanup fails.
- The dedicated config prevents concurrent Vitest files from touching the shared Neon test database while this integration runs.

## Dependencies and compatibility

- PR #68 migration coverage and PR #67 test-database guard must be in the base stack.
- The test uses the current `Attachment`, `FileReadHandler`, `UserService`, and `PrivateAttachmentStorage` contracts. It adds no runtime dependency and makes no API or data migration for existing users.

## Acceptance checks

- `pnpm test:private-files` passes and proves persisted metadata/body round-trip, owner-only access, missing-file handling, and teardown.
- `pnpm test`, `pnpm build`, `pnpm lint`, and `git diff --check` pass; the default test command does not select this isolated test.
- After the run, fixture rows and the temporary storage directory are absent. The evidence report records the command, exit code, and commit SHA.
- Reviewer confirms the diff contains only the test, its dedicated config/script, evidence, and plan updates.

## Risk and rollback

- Neon session/search-path leakage: no session setting or schema mutation is used; all data operations stay in the migrated public schema and use fixture-scoped rows.
- Leaked DB rows or files after assertion failure: cleanup is in `finally`, user deletion cascades attachment rows, and filesystem removal is independent of DB cleanup.
- Revert the test/config/script/evidence/plan commit to roll back. No application data or production behavior changes.
