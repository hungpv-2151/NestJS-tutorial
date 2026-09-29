# Phase 06 — PR6: Unit, integration và E2E C2

## Context Links

- [Vitest config](../../vitest.config.e2e.ts) · [starter E2E](../../test/app.e2e-spec.ts) · [Hurl runner](../../spec/api/run-api-tests-hurl.sh) · [contract risks](../reports/researcher-260910-0930-api-contract-risks.md)

## Overview

- Priority: P1 · Status: In progress · Effort: 14h · Blocked by: PR5
- Hoàn thiện test pyramid; chọn `ArticlesController` cho E2E cấp C2 vì đi qua auth, DTO, service, PostgreSQL, serializer, filter/pagination và ownership.

## Key Insights

- C2 ở plan này = HTTP black-box qua Nest app thật, module/service/repository thật và PostgreSQL/Redis test riêng; chỉ fake external SMTP/clock khi cần deterministic.
- Hurl giữ vai trò compatibility supplemental; Vitest + Supertest là primary, chạy được từng case và kiểm soát lifecycle DB.

## Requirements

- `TEST_DATABASE_URL` riêng, tên DB/schema test được guard; tuyệt đối từ chối production/dev DB.
- E2E files currently run in parallel against one test database; use unique fixture IDs and `finally` cleanup with database cascades. Do not truncate shared tables from parallel tests. Move to schema-per-worker isolation before adding destructive global cleanup.
- Migration apply trước suite; không dùng `synchronize`; fake data đi qua factory/repository hợp lệ, không bypass constraint.
- Unit: DTO/serializer, auth deny-list TTL, attachment policy/validation/compensation, article query/ownership, comment delete, Bull/schedule idempotency.
- Integration: migration up/down, repositories/query/count/order, Redis deny-list/queue boundary, private file metadata/storage adapter.
- C2 ArticlesController: register two users → create → get → list/filter/page/feed → favorite/unfavorite → update/non-owner reject → delete → verify 404. Use registration-issued signed tokens; login is covered separately. Search is not part of the current list API contract and unknown `search` is rejected.
- Assert status, exact response envelope, persistence/side effects, 401/403/404/409/422, pagination cap/order và no secret/body leak.

## Architecture

`globalSetup → guarded test DB → migrations → createApp()`; `test → Supertest HTTP → real app/DB/Redis`; `afterEach finally → fixture-scoped cleanup`; `globalTeardown → close app/data source/queues`.
Test files currently run in parallel and share the test database. Keep UUID-scoped fixtures until per-worker schemas and Redis namespaces are available; do not globally truncate concurrent workers.
The C2 journey sets a UUID-scoped welcome-mail queue before app creation, waits for app shutdown, then removes only that queue. The runtime queue defaults to `welcome-mail` unless explicitly overridden.

## Related Code Files

- Modify: `src/jobs/welcome-mail-queue.ts` to support a private test queue and honor the configured Redis database.
- Create: `src/jobs/redis-database.ts`, `src/jobs/redis-database.spec.ts`, `test/articles-controller.c2.e2e-spec.ts`, `test/articles-controller-c2-helpers.ts`, and `test/welcome-mail-queue-cleaner.ts`.
- Modify/add unit and integration tests as the remaining matrix is implemented; no package or E2E runner changes are required for the current C2 journey.
- Hurl remains supplemental; no Hurl runner changes were needed for this C2 scope.

## Implementation Steps

1. Tạo guarded E2E config; migrate DB test; extract reusable app/DB/Redis lifecycle, luôn close handles.
2. Tạo deterministic factories cho user/follow/article/tag/favorite/comment/attachment; seed trước từng test, cleanup sau từng test dù assertion fail.
3. Bổ sung unit/integration matrix theo requirements; external SMTP dùng test adapter, Bull/Redis behavior vẫn được kiểm chứng tại boundary.
4. Viết C2 `ArticlesController` full flow, không mock controller/service/repository; cover happy path và failure/authorization/page edges.
5. Chạy build, lint, unit, integration và E2E lặp lại để phát hiện leak/flaky; sau đó chạy Hurl tuần tự trên DB vừa reset như supplemental contract check.
6. Ghi command/exit code trong PR description; không giảm assertion, không dùng test-only branch trong production code.

## Todo List

- [x] Add explicit test-only DB target isolation before introducing destructive global cleanup; reject the configured application database by normalized host, port, and database name. C2 uses a private per-run welcome-mail queue.
- [ ] Replace shared-table truncate requirement with UUID-scoped fixtures until per-worker schema isolation exists.
- [x] ArticlesController C2 HTTP flow passes without mocking internal layers.
- [x] Full build, lint, unit and E2E pass; two full E2E runs produce the same result. Hurl remains supplemental and its CLI is unavailable in this environment.
- [ ] Complete remaining integration matrix: migration up/down and private-file metadata/storage boundaries remain open. Redis deny-list has a real Redis integration test; queue idempotency has unit coverage.

## Success Criteria

- Hai lần `pnpm run test:e2e` liên tiếp cho cùng kết quả; C2 fixtures clean up through user/tag deletion and migration-backed FK cascades.
- C2 chứng minh dữ liệu/response sau cả success và rejected mutation; coverage tập trung business risk, không chạy theo số phần trăm giả.

## Risk Assessment

- Truncate nhầm DB — Likelihood: Low · Impact: Critical → strict hostname/database allowlist + explicit test env guard trước câu lệnh destructive.
- Parallel contamination/flaky time/queue — Likelihood: Medium · Impact: High → UUID fixture IDs, private C2 welcome-mail queue and teardown; use per-worker schemas before destructive shared DB cleanup.
- Hurl residue — Likelihood: Medium · Impact: Medium → reset test DB trước supplemental run; Hurl không quyết định primary pass/fail diagnosis.

## Security Considerations

- Test secrets riêng, logs redact Authorization/password; fixture upload không chứa nội dung độc hại; cleanup chỉ resolve trong test storage root.

## Rollback

- Revert this C2 PR to remove its test/helpers/evidence and restore the default-only queue configuration; it changes no production schema or public API. Test DB and Redis cleanup remain fixture-scoped.

## Next Steps

- Merge khi 6 PR theo thứ tự đều green; tester/reviewer xác nhận evidence, rồi delivery tracker cập nhật docs khi implementation thật đã ship.

## Phase 06 Progress

- The current Phase 06 branch adds the real HTTP/PostgreSQL ArticlesController C2 journey. It checks three matching rows across distinct pages in descending creation order, list filters, detail/feed/favorite/update/delete flow, and registration response redaction. Existing E2E tests reject `limit=101`; the article-list query integration test covers timestamp ties and page boundaries.
- The test uses UUID-scoped users/articles/tags, registers usernames before HTTP setup, and relies on verified FK cascades for teardown. Its welcome-mail queue is private per run and cleaned after app shutdown. Test setup requires `TEST_DATABASE_URL` and rejects matching `DATABASE_URL` targets after normalizing loopback host aliases. It loads `.env` only when the test URL is absent, so an explicit CI test URL works without an `.env` file. Migration up/down and private-file metadata/storage integration remain open.
- Test DB isolation evidence: [validation report](./evidence/phase-06/test-database-isolation-report.json) · [result screenshot](./evidence/phase-06/test-database-isolation-results.png).
- A real Redis deny-list integration test verifies write/read and expiry using a UUID key, and removes only that key in teardown. It prefers `TEST_REDIS_URL` and falls back to the app's configured `REDIS_URL` when the test-specific variable is absent.
