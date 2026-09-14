---
title: "NestJS RealWorld backend learning roadmap"
description: "Triển khai backend RealWorld theo 6 pull request tuần tự, từ bootstrap đến E2E C2."
status: in-progress
priority: P1
effort: 80h
branch: master
tags: [feature, backend, database, api, auth]
blockedBy: []
blocks: []
work_type: feature
spec_waived: "SDD mode disabled (takumi.sddMode: off)"
created: 2026-09-14
---

# NestJS RealWorld Backend Learning Roadmap

## Overview

Xây backend NestJS/PostgreSQL theo đúng 6 PR có thể review và rollback độc lập. RealWorld OpenAPI là baseline hành vi; Swagger sinh từ code là tài liệu runtime. Vitest + Supertest là test chính, Hurl chỉ bổ trợ kiểm tra tương thích.

## Decisions

- Persistence: PostgreSQL + TypeORM. Migration viết tay bằng `typeorm-ts-node-esm`, mỗi file có `up/down`; scripts chuẩn hóa `add/apply/revert/reset`. Không dùng Prisma/schema-push.
- File: private local storage, không expose static folder. `GET /api/files/:id` bắt buộc JWT và policy; Attachment UUID polymorphic quản lý metadata.
- Auth: JWT access token có `jti`; logout ghi deny-list Redis với TTL đúng phần thời gian token còn hiệu lực.
- Async teaching scope: PR2 gửi welcome mail qua Bull + Redis; scheduler mỗi ngày enqueue một training summary đến email cấu hình, không thêm public API hay notification preference.

## Phases / Pull Requests

| PR | Deliverable | Effort | Blocked by | Status |
|---|---|---:|---|---|
| 1 | [Bootstrap, i18n và Swagger](./phase-01-project-bootstrap-docs.md) | 6h | — | Complete |
| 2 | [Migration, auth và background jobs](./phase-02-database-auth-background-jobs.md) | 20h | PR1 | Pending |
| 3 | [User, profile và private avatar](./phase-03-user-profile-private-avatar.md) | 14h | PR2 | Pending |
| 4 | [Articles, search/filter/pagination](./phase-04-articles-search-pagination.md) | 18h | PR3 | Pending |
| 5 | [Comment CRD](./phase-05-comments.md) | 8h | PR4 | Pending |
| 6 | [Unit, integration và E2E C2](./phase-06-unit-e2e-c2-testing.md) | 14h | PR5 | Pending |

## Dependency Graph

`PR1 → PR2 → PR3 → PR4 → PR5 → PR6`. Không merge PR sau khi PR trước chưa green; shared files (`package.json`, `app.module.ts`, migrations) chỉ sửa trong PR đang mở.

## Learning Coverage

| Kiến thức | PR |
|---|---|
| Setup NestJS, hello world, i18n, Swagger | 1 |
| Migration add/apply/revert/reset, auth, Redis logout | 2 |
| Serializer, DTO validation, Multer/private file, polymorphic attachment | 2–3 |
| REST CRUD, search, filter, “pagy” bằng offset pagination có cap | 4 |
| `@nestjs/bull` mail + Redis, `@nestjs/schedule` | 2 |
| Unit/integration/E2E, test DB, seed/truncate, C2 controller | 1–6; hardening ở 6 |

## Global Contract and Quality Gates

- Prefix `/api`; `Authorization: Token <jwt>`; response qua serializer, không trả TypeORM entity trực tiếp.
- Validation lỗi theo `{ errors: { field: string[] } }`; phân biệt 401/403/404/409/422, không lộ stack, SQL, hash, token hay secret.
- Public optional-auth route: thiếu token vẫn anonymous; đã gửi token nhưng invalid/revoked thì 401.
- Mỗi PR: migration liên quan apply/revert được, build, lint và unit targeted green; Swagger phản ánh route mới; Hurl group tương ứng chạy khi contract đã hỗ trợ.
- Sau PR6: full `build`, `lint`, `test`, `test:e2e` green; Hurl chạy supplemental trên DB sạch.

## Compatibility

- Starter chưa có persistence/user data; PR1 thay hello test bằng route `/api/hello`, không migrate dữ liệu cũ.
- Route RealWorld giữ request/response/status hiện có. Logout, avatar file và `search` là extension additive, được Swagger ghi rõ.
- Mỗi schema PR chỉ đi qua migration `up/down`; không dùng auto-sync hay edit migration đã apply.

## Out of Scope

- Refresh token, OAuth/RBAC, Cloudinary, public static upload, production deployment và UI.
- Hệ notification/digest cho end-user; scheduled mail chỉ là use case học tập có feature flag.

## Handoff

Chạy `/tkm:takumi /home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/plans/260910-0930-medium-clone-backend/plan.md` để triển khai tuần tự.
