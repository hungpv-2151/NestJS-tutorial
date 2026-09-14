# Phase 06 — PR6: Unit, integration và E2E C2

## Context Links

- [Vitest config](../../vitest.config.e2e.ts) · [starter E2E](../../test/app.e2e-spec.ts) · [Hurl runner](../../spec/api/run-api-tests-hurl.sh) · [contract risks](../reports/researcher-260910-0930-api-contract-risks.md)

## Overview

- Priority: P1 · Status: Pending · Effort: 14h · Blocked by: PR5
- Hoàn thiện test pyramid; chọn `ArticlesController` cho E2E cấp C2 vì đi qua auth, DTO, service, PostgreSQL, serializer, search/filter/pagination và ownership.

## Key Insights

- C2 ở plan này = HTTP black-box qua Nest app thật, module/service/repository thật và PostgreSQL/Redis test riêng; chỉ fake external SMTP/clock khi cần deterministic.
- Hurl giữ vai trò compatibility supplemental; Vitest + Supertest là primary, chạy được từng case và kiểm soát lifecycle DB.

## Requirements

- `TEST_DATABASE_URL` riêng, tên DB/schema test được guard; tuyệt đối từ chối production/dev DB.
- Trước mỗi case: truncate sạch để chống residue rồi seed fake data deterministic theo fixture builder; sau mỗi case: `TRUNCATE ... RESTART IDENTITY CASCADE` trong `finally` và clear đúng Redis test prefix.
- Migration apply trước suite; không dùng `synchronize`; fake data đi qua factory/repository hợp lệ, không bypass constraint.
- Unit: DTO/serializer, auth deny-list TTL, attachment policy/validation/compensation, article query/ownership, comment delete, Bull/schedule idempotency.
- Integration: migration up/down, repositories/query/count/order, Redis deny-list/queue boundary, private file metadata/storage adapter.
- C2 ArticlesController: register/login → create → get → list/search/filter/page/feed → favorite/unfavorite → update/non-owner reject → delete → verify 404.
- Assert status, exact response envelope, persistence/side effects, 401/403/404/409/422, pagination cap/order và no secret/body leak.

## Architecture

`globalSetup → guarded test DB → migrations → createApp()`; `beforeEach → truncate + seed`; `test → Supertest HTTP → real app/DB/Redis`; `afterEach finally → truncate + Redis cleanup`; `globalTeardown → close app/data source/queues`.
Test files chạy serial nếu dùng chung DB; chỉ bật parallel khi mỗi worker có schema/Redis prefix riêng.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/vitest.config.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/vitest.config.e2e.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/app.e2e-spec.ts`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/helpers/create-test-app.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/helpers/database-cleaner.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/helpers/factories/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/helpers/redis-cleaner.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/articles-controller.c2.e2e-spec.ts`.
- Modify/add unit/integration tests: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/**/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/**/*.e2e-spec.ts`.
- Modify only if runner needs canonical origin/readiness: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/spec/api/run-api-tests-hurl.sh`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/spec/api/README.md`.
- Delete: none; thay starter-only assertion ngay trong `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/app.e2e-spec.ts` sau khi có coverage tương đương.

## Implementation Steps

1. Tạo guarded E2E config; migrate DB test; extract reusable app/DB/Redis lifecycle, luôn close handles.
2. Tạo deterministic factories cho user/follow/article/tag/favorite/comment/attachment; seed trước từng test, cleanup sau từng test dù assertion fail.
3. Bổ sung unit/integration matrix theo requirements; external SMTP dùng test adapter, Bull/Redis behavior vẫn được kiểm chứng tại boundary.
4. Viết C2 `ArticlesController` full flow, không mock controller/service/repository; cover happy path và failure/authorization/page edges.
5. Chạy build, lint, unit, integration và E2E lặp lại để phát hiện leak/flaky; sau đó chạy Hurl tuần tự trên DB vừa reset như supplemental contract check.
6. Ghi command/exit code trong PR description; không giảm assertion, không dùng test-only branch trong production code.

## Todo List

- [ ] Test DB/Redis guard chặn nhầm environment.
- [ ] Truncate + seed chạy trước, cleanup chạy sau mọi case.
- [ ] ArticlesController C2 full flow green không mock internal layers.
- [ ] Full build, lint, unit, integration và E2E green; Hurl supplemental green.

## Success Criteria

- Hai lần `pnpm run test:e2e` liên tiếp cho cùng kết quả, không open handle/residual rows/Redis keys/files.
- C2 chứng minh dữ liệu/response sau cả success và rejected mutation; coverage tập trung business risk, không chạy theo số phần trăm giả.

## Risk Assessment

- Truncate nhầm DB — Likelihood: Low · Impact: Critical → strict hostname/database allowlist + explicit test env guard trước câu lệnh destructive.
- Parallel contamination/flaky time/queue — Likelihood: Medium · Impact: High → serial mặc định, fake clock/deterministic ids, per-suite Redis prefix và teardown.
- Hurl residue — Likelihood: Medium · Impact: Medium → reset test DB trước supplemental run; Hurl không quyết định primary pass/fail diagnosis.

## Security Considerations

- Test secrets riêng, logs redact Authorization/password; fixture upload không chứa nội dung độc hại; cleanup chỉ resolve trong test storage root.

## Rollback

- Revert PR6 chỉ bỏ test/helpers/scripts; không đổi production schema. Test DB/Redis cleanup theo guarded commands.

## Next Steps

- Merge khi 6 PR theo thứ tự đều green; tester/reviewer xác nhận evidence, rồi delivery tracker cập nhật docs khi implementation thật đã ship.
