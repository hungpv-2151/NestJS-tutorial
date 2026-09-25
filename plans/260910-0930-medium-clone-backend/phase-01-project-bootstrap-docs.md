# Phase 01 — PR1: Bootstrap, i18n, Swagger và `GET /api/hello`

## Context Links

- [Starter app](../../src/main.ts) · [package](../../package.json) · [OpenAPI baseline](../../spec/api/openapi.yml)

## Overview

- Priority: P1 · Status: Complete · Effort: 6h · PR: [#17](https://github.com/hungpv-2151/NestJS-tutorial/pull/17)
- Chuẩn hóa starter NestJS 12 ESM, giữ một hello API, thêm i18n và Swagger chạy được.
- Lịch sử implementation giữ nguyên. Nếu audit phát hiện gap, tạo remediation PR mới chỉ cho `GET /api/hello` hoặc foundation; không amend/rewrite PR1.

## Key Insights

- Project đã được scaffold; “init” là làm sạch cấu hình starter, không generate project lần hai.
- HTTP bootstrap phải dùng lại được cho production và E2E để tránh khác prefix/pipe/filter.

## Requirements

- `GET /api/hello` trả response ổn định, chọn locale từ `Accept-Language`, fallback `en`.
- Swagger UI `/docs`, JSON `/docs-json`; document hello, locale header và error shape.
- Env validation tối thiểu, global prefix `/api`, body-size limit và `ValidationPipe` cơ bản.
- Unit test controller/service và bootstrap smoke; không thêm DB/Redis trong PR này.

## Architecture

`main.ts → create-app.ts → global prefix/i18n/validation → hello controller → serializer → JSON`.
`nestjs-i18n` load JSON từ `src/i18n/{en,vi}`; Swagger chỉ bật ngoài production hoặc qua config rõ ràng.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/main.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.controller.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.service.ts`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/create-app.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/config/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/i18n/en/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/i18n/vi/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/common/serializers/*`.
- Modify/create tests: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.controller.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/app.e2e-spec.ts`.
- Delete: none.

## Implementation Steps

1. Chốt Node/pnpm scripts và ESM imports `.js`; bỏ credential placeholder của Observe khỏi starter hoặc chuyển thành env-guarded config.
2. Tách `createApp()` dùng chung; cấu hình prefix, request limit, validation và shutdown hooks.
3. Thêm `nestjs-i18n`, hai translation file và hello response serializer.
4. Thêm `@nestjs/swagger`; expose UI/JSON theo config, không hard-code secret hay internal host.
5. Viết unit + smoke E2E cho `en`, `vi`, fallback và Swagger boot.

## Todo List

- [x] Fresh clone install/start được; `/api/hello` hoạt động.
- [x] i18n và Swagger có test.
- [x] Build, lint, targeted unit/E2E green.

## Success Criteria

- Developer setup project bằng README/scripts hiện có và gọi được hello ở hai locale.
- Swagger render đúng route/response; E2E dùng cùng bootstrap với runtime.

## Validation

- `pnpm build` passed.
- `pnpm lint` passed (SunLint; ESLint config advisory only).
- `pnpm test` passed: 10 tests.
- `pnpm test:e2e` passed: 6 tests covering default/vi/fallback locale and production Swagger gating.

## PR Definition of Done & Evidence

- API boundary: chỉ `GET /api/hello`; i18n/Swagger/bootstrap là foundation đi kèm, không có API thứ hai.
- Implementation, compile, lint, unit và E2E đã complete theo validation trên; Phase 02 không được làm đổi lịch sử này.
- Trước release, backfill một PR #17 comment: commit SHA, changed-line count, command/exit-code summary, warning ledger và screenshot kết quả. Ghi URL comment tại đây: `pending`.
- Nếu evidence audit thấy error-level lint/static-analysis hoặc diff ngoài scope: mở remediation layer mới sau PR1, rebase layer đó trên PR1; không sửa lịch sử PR1.

## Risk Assessment

- I18n asset thiếu trong `dist` — Likelihood: Medium · Impact: Medium → cấu hình Nest assets và test `start:prod` build output.
- Observe placeholder gửi dữ liệu/boot fail — Likelihood: Low · Impact: High → mặc định tắt khi thiếu config.

## Security Considerations

- Swagger production mặc định tắt; request body cap; config/error không lộ env.

## Rollback

- Revert PR1 về starter; không có DB/data cần phục hồi.

## Next Steps

- Phase 02 audit nhánh hiện tại trên base PR1 trước khi sửa code; PR2 phụ thuộc `createApp()`, config và validation seam từ PR1.
