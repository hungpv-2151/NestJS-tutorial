---
title: 'NestJS RealWorld backend API-granular PR roadmap'
description: 'Triển khai backend RealWorld bằng stack PR nhỏ, mỗi PR chỉ phục vụ một API hoặc một lớp nền tảng không có API.'
status: in-progress
priority: P1
effort: 96h
branch: phase-02-database-auth-background-jobs
tags: [feature, backend, database, api, auth]
blockedBy: []
blocks: []
work_type: feature
spec_waived: 'SDD mode disabled (takumi.sddMode: off)'
created: 2026-09-14
---

# NestJS RealWorld Backend API-Granular PR Roadmap

## Overview

Giữ nguyên lịch sử PR1 đã hoàn thành, audit phần Phase 02 đang dở, rồi tiếp tục bằng stack PR nhỏ. Một PR chỉ được chạm một public API; API phức tạp có thể đi qua nhiều PR. PR nền tảng không được lén thêm route.

## Non-Negotiable PR Governance

- Một API → một hoặc nhiều PR; không PR nào chứa từ hai API trở lên. Foundation PR phải có `Public API change: none`.
- Mục tiêu ≤300 và hard gate ≤400 changed lines **chỉ tính file code production**. Không tính spec, Markdown, JSON, test (`*.spec.*`, `test/**`), migration, YAML, lockfile, generated file hoặc configuration/supporting artifact. Vượt ngưỡng code production thì tách trước review.
- Trước mọi code fix: refresh remote, rebase PR lên đúng base, xác nhận lại bằng stack view, rồi audit diff với phase hiện hành. Không rewrite lịch sử PR1; gap của PR đã hoàn thành đi vào remediation layer mới.
- Error-level lint/static-analysis = 0 trước submit. Warning sửa khi hợp lý; warning giữ lại phải ghi rule, file, lý do và follow-up trong PR evidence.
- Mỗi PR phải có một PR comment chứa command/result, exit code, commit SHA và screenshot đính kèm. Link comment được ghi vào checklist phase.

## Phases / PR Waves

| Phase | PR scope                                                                              | Effort | Blocked by | Status                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------- | -----: | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | [PR1 bootstrap + `GET /api/hello`](./phase-01-project-bootstrap-docs.md)              |     6h | —          | Complete                                                                                                                |
| 2     | [Audit/rebase, foundations và auth APIs](./phase-02-database-auth-background-jobs.md) |    24h | PR1        | In progress: G2 stack audit complete; 2I daily training-summary remains deferred; auth APIs through 2H are submitted  |
| 3     | [User, profile và private-file APIs](./phase-03-user-profile-private-avatar.md)       |    18h | Phase 02H  | In progress: 3G `GET /api/files/:id` implementation and independent review pass; intended PR #46 submission pending on #45 |
| 4     | [Article/feed/favorite/tag APIs](./phase-04-articles-search-pagination.md)            |    26h | Phase 3    | Pending                                                                                                                 |
| 5     | [Comment APIs](./phase-05-comments.md)                                                |    10h | Phase 4    | Pending                                                                                                                 |
| 6     | [Stack-wide verification and remediation routing](./phase-06-unit-e2e-c2-testing.md)  |    12h | Phase 5    | Pending                                                                                                                 |

## Dependency and Data Flow

`PR1 → Phase 02 stack → Phase 03 stack → Phase 04 stack → Phase 05 stack → release audit`. Trong mỗi phase, từng row PR khai báo base trực tiếp; request đi `DTO → guard → service → repository/storage/queue → serializer`, còn schema chỉ đổi qua migration `up/down`.

## Definition of Done Applied to Every PR

- Rebased on declared base before first fix and again before submit; diff re-audited for one-API boundary and ≤400 changed lines of production code.
- Migration liên quan apply/revert/apply; compile, targeted tests và contract check green; Swagger chỉ đổi cho đúng API của PR.
- Lint/static-analysis không còn error. Warning đã sửa hoặc được liệt kê có lý do/follow-up.
- PR comment có screenshot + textual results; comment URL được ghi trong phase. Reviewer xác nhận API scope, security, rollback và không có unrelated changes.

## Compatibility and Rollback

- Giữ RealWorld request/response/status; logout, avatar, file và search là additive. Không `synchronize`, không sửa migration đã apply.
- Mỗi PR revert độc lập trên base trực tiếp. Remediation chỉ sửa một API hoặc một foundation; không tạo catch-all cleanup PR xuyên nhiều API.

## Handoff

Chạy `/tkm:takumi /home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/plans/260910-0930-medium-clone-backend/plan.md`; bắt đầu tại Phase 02 audit gate, không tiếp tục code trên diff local trước khi gate pass.
