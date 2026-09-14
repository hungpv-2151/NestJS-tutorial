# Phase 05 — PR5: Comment CRD

## Context Links

- [Comment contract](../../spec/api/hurl/comments.hurl) · [comment errors](../../spec/api/hurl/errors_comments.hurl) · [authorization cases](../../spec/api/hurl/errors_authorization.hurl)

## Overview

- Priority: P1 · Status: Pending · Effort: 8h · Blocked by: PR4
- Thêm Create/Read/Delete comment cho article, giữ response/authorization nhất quán.

## Key Insights

- Không có update comment trong scope. Delete phải phân biệt article không tồn tại, comment không thuộc article và non-owner.
- Public list comment vẫn nhận optional JWT để serialize `following` cho author.

## Requirements

- APIs: `POST|GET /api/articles/:slug/comments`, `DELETE /api/articles/:slug/comments/:id`.
- Create/delete protected; list public. Body DTO trim, non-empty, max length; comment id/slug params được validate.
- Comment serializer trả id/body/timestamps/author profile; không lộ email/internal ids.
- Delete chỉ comment owner, trả 204; non-owner 403, unknown article/comment 404; failed delete không đổi dữ liệu.
- List order deterministic `createdAt ASC, id ASC`; query load author/following theo batch.

## Architecture

`article slug → ArticleService lookup → CommentService → TypeORM → CommentSerializer`.
Delete resolve article scope trước, sau đó conditional delete `commentId + articleId + authorId`; map zero affected theo lookup rõ ràng.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/articles/*`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/comments/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/migrations/*-create-comments.ts`.
- Create/modify tests: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/comments/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/comments.e2e-spec.ts`.
- Delete: none.

## Implementation Steps

1. Viết migration comments/FK/index với `up/down`; article delete cascade comment, user delete policy explicit; apply/revert/apply.
2. Tạo route/param/body DTO và Swagger schemas/errors.
3. Implement create/list qua existing article lookup và profile serializer; không duplicate auth/serialization logic.
4. Implement scoped delete + 403/404 mapping và transaction behavior khi article bị xóa concurrent.
5. Unit/E2E cover anonymous list, protected create/delete, owner/non-owner, wrong article, invalid body và persistence.

## Todo List

- [ ] Migration reversible và cascade policy có test.
- [ ] Comment CRD đúng response/error/status.
- [ ] List không N+1; failed delete giữ dữ liệu.
- [ ] Build, lint, unit, targeted E2E/Hurl comments green.

## Success Criteria

- Create → list → delete → list chạy full flow; comment đúng bị xóa, comment khác còn nguyên.
- Swagger và serializer khớp RealWorld comment envelope.

## Risk Assessment

- Scope comment sai article/owner — Likelihood: Medium · Impact: High → composite lookup/conditional delete + integration test.
- Article xóa concurrent — Likelihood: Low · Impact: Medium → transaction và FK mapping về 404, không lộ DB error.

## Security Considerations

- Không tin author id từ client; validate body size; output không chứa entity metadata.

## Rollback

- Revert code + comment migration; down chỉ xóa comments/index liên quan.

## Next Steps

- PR6 kiểm tra controller integration trên database/Redis test thật.
