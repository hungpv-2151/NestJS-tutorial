# Phase 02 — PR2: Migration, auth và background jobs

## Context Links

- [Auth contract](../../spec/api/hurl/auth.hurl) · [auth errors](../../spec/api/hurl/errors_auth.hurl) · [stack research](../reports/researcher-260910-0930-medium-backend-stack.md)

## Overview

- Priority: P1 · Status: Pending · Effort: 20h · Blocked by: PR1
- Dựng PostgreSQL/TypeORM migration thủ công; register/login/logout/current-user; Redis deny-list; một mail queue và một scheduled teaching job.

## Key Insights

- Chọn TypeORM vì Nest integration quen thuộc và migration class có `up/down` rõ; Prisma không đáp ứng mục tiêu học migration thủ công.
- Bull và JWT deny-list dùng cùng Redis server nhưng khác prefix; TTL deny-list không vượt `exp` token.

## Requirements

- Scripts: `db:migration:add`, `db:migration:apply`, `db:migration:revert`, `db:migration:reset`, `db:migration:show`.
- `add` tạo migration rỗng để developer tự viết `up/down`; `reset` chỉ dev/test, drop schema rồi apply lại toàn bộ migration, có guard DB name/env.
- User table: UUID, unique username/email, Argon2id hash, bio/image nullable, timestamps; không dùng `synchronize: true`.
- APIs: `POST /api/users`, `POST /api/users/login`, `POST /api/user/logout`, `GET /api/user`.
- JWT HS256 có `sub`, `jti`, issuer, audience, `iat`, `exp`; logout lưu `auth:denylist:{jti}` với TTL `exp-now` và trả 204 idempotent.
- DTO nested wrapper + transform/validation; UserSerializer trả đúng envelope, không lộ hash/entity fields.
- Welcome mail: register commit thành công mới enqueue `@nestjs/bull` job trên Redis; retry/backoff hữu hạn, stable job id, SMTP adapter cấu hình bằng env.
- Schedule: `@nestjs/schedule` cron mỗi ngày enqueue summary số user mới đến `TRAINING_REPORT_EMAIL`; feature flag, timezone và duplicate job id theo ngày; không thêm public API.

## Architecture

`request → DTO → AuthController → AuthService → TypeORM transaction → UserSerializer`.
`logout → verify JWT → Redis SET EX deny-list`; guard verify signature/claims rồi check deny-list, Redis lỗi thì fail closed.
`register commit → Bull producer → mail processor → SMTP`; `ScheduleService → same queue`, scheduler không gửi mail trực tiếp.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/config/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/create-app.ts`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/data-source.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/database.module.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/migrations/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/scripts/reset-database.ts`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/users/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/auth/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/common/dto/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/common/filters/*`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/mail/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/jobs/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/scheduling/*`.
- Create/modify tests: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/auth/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/mail/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/auth.e2e-spec.ts`.
- Delete: none.

## Implementation Steps

1. Cấu hình `@nestjs/typeorm`, `typeorm`, PostgreSQL driver và `typeorm-ts-node-esm`; DataSource CLI/runtime dùng chung options, entity glob chạy được cả TS/dev và JS/dist.
2. Viết initial migration bằng tay với `up/down`; chứng minh add → apply → revert → apply và guarded reset trên DB dev/test.
3. Tạo DTO/error filter/serializer chung; map validation 422, duplicate 409, credentials/token 401.
4. Hash/register/login, ký token 15 phút và guard parse đúng `Token <jwt>`; supplied malformed/expired/forged/revoked token luôn 401.
5. Thêm logout `jti` deny-list với TTL; tách Redis key prefix cho auth và Bull.
6. Thêm Bull mail producer/processor và scheduled summary; test handler/producer, retry và idempotency không cần SMTP thật.
7. Swagger hóa routes/schema/security; chạy unit, auth E2E và Hurl auth phần tương thích (logout test bằng Supertest).

## Todo List

- [ ] Bốn thao tác migration chạy/reversible, reset từ chối production/DB không đúng suffix.
- [ ] Register/login/logout/current-user pass; token logout không dùng lại được.
- [ ] Welcome/scheduled jobs bounded và idempotent.
- [ ] Build, lint, unit, targeted E2E green.

## Success Criteria

- Database mới dựng chỉ từ migrations; migration gần nhất revert không mất object ngoài phạm vi.
- Auth response đúng contract; Redis key hết hạn cùng token; queue/schedule không làm chậm hoặc rollback register đã commit.

## Risk Assessment

- TypeORM CLI ESM/glob mismatch — Likelihood: Medium · Impact: High → test command trên source và build output ngay PR2.
- Redis outage — Likelihood: Medium · Impact: High → protected auth fail closed; queue failure được log/metric, register xử lý theo post-commit policy.
- Mail duplicate — Likelihood: Medium · Impact: Medium → deterministic `jobId`, retry hữu hạn, processor idempotent.

## Security Considerations

- Secret/SMTP/Redis URL chỉ từ env; Argon2 input có max; không log password, hash, JWT, Authorization hay SQL params nhạy cảm.
- `reset` kiểm tra `NODE_ENV`, hostname/database allowlist và yêu cầu flag xác nhận.

## Rollback

- Revert code; chạy `db:migration:revert` cho migration PR2. Xóa Redis keys theo prefix riêng; không flush toàn Redis.

## Next Steps

- PR3 dùng User entity, auth guard, serializer/error contract và migration scripts.
