# Phase 03 — PR3: User, profile và private avatar

## Context Links

- [Profile contract](../../spec/api/hurl/profiles.hurl) · [profile errors](../../spec/api/hurl/errors_profiles.hurl) · [authorization risks](../reports/researcher-260910-0930-api-contract-risks.md)

## Overview

- Priority: P1 · Status: Pending · Effort: 14h · Blocked by: PR2
- Hoàn thiện update user/profile/follow; upload avatar local theo private-file API và polymorphic Attachment UUID.

## Key Insights

- Private file không đặt dưới static/public root. UUID giảm scan nhưng auth/policy mới là rào bảo vệ.
- Polymorphic FK không được DB enforce; AttachmentService phải validate owner type/id và cleanup nhất quán.

## Requirements

- APIs: `PUT /api/user`, `GET /api/profiles/:username`, `POST|DELETE /api/profiles/:username/follow`.
- Avatar API riêng `PUT /api/user/avatar` dùng Multer; giữ `PUT /api/user` JSON tương thích RealWorld.
- File read `GET /api/files/:id`: bắt buộc auth; avatar cho mọi user đã đăng nhập đọc, chỉ chủ sở hữu thay thế.
- `attachments`: UUID id, `attachable_type`, `attachable_id`, `slot`, `url`, `file_name`, `file_type`, `file_size`, timestamps; unique `(attachable_type, attachable_id, slot)`. `url` là relative API route, `file_name` là display name đã sanitize, không phải disk path.
- Chỉ JPEG/PNG/WebP, tối đa 2 MiB; xác minh magic bytes, random storage name, không tin MIME/original filename.
- Follow/unfollow idempotent, unique `(follower_id, following_id)`, cấm self-follow bằng 422.
- Profile/User serializer chuẩn hóa `bio`/`image` null; update phân biệt absent/null/empty; đổi username/email cấp token mới.

## Architecture

`multipart → Multer temp → validate bytes/size → AttachmentService → private storage → DB transaction → compensate on failure`.
`file id → auth guard → attachment policy resolver → safe stream headers`.
`profile request → optional principal → relation query → ProfileSerializer`; follow mutation dùng unique DB constraint.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/users/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/auth/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/config/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/profiles/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/attachments/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/files/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/migrations/*-create-attachments-and-follows.ts`.
- Create private runtime path config: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/storage/private/` (gitignored; no sample uploads committed).
- Create/modify tests: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/attachments/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/profiles/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/users-profiles.e2e-spec.ts`.
- Delete: none.

## Implementation Steps

1. Viết migration attachments/follows với `up/down`, UUID/index/unique; apply/revert/apply trên DB test.
2. Hoàn thiện update DTO/service/serializer và token reissue khi identity/password đổi; old token invalidation theo policy PR2.
3. Tạo private storage adapter + Multer temp upload; validate size, extension-independent signature và normalize metadata.
4. Replace avatar theo transaction + compensation: DB fail thì xóa file mới; commit xong mới best-effort xóa file cũ, có retry cleanup log.
5. Thêm protected file streaming với ownership/read policy, `Content-Type`, `Content-Length`, `Content-Disposition: inline`, `nosniff`; 404 không tiết lộ path.
6. Thêm profile/follow/unfollow với optional auth serializer, uniqueness/idempotency và tránh N+1.
7. Swagger hóa multipart/file routes; unit/E2E cover invalid content, oversize, unauthorized, replace và stale-file cleanup.

## Todo List

- [ ] Migration reversible; Attachment metadata đủ và không lưu path tùy ý từ client.
- [ ] Update/profile/follow/unfollow đúng 401/403/404/422.
- [ ] Private avatar không truy cập anonymous; owner replace được; authenticated reader xem được.
- [ ] Build, lint, unit, targeted E2E/Hurl profile green.

## Success Criteria

- Full update-user/profile flow trả serializer đúng; DB/file không orphan trong lỗi đã test.
- Upload giả MIME, quá 2 MiB, UUID lạ và unauthorized đều bị chặn, không lộ filesystem path.

## Risk Assessment

- DB/filesystem không có distributed transaction — Likelihood: Medium · Impact: High → temp file + compensation + cleanup retry có test.
- Polymorphic target dangling — Likelihood: Medium · Impact: High → service validate target, migration index và cleanup khi owner bị xóa.

## Security Considerations

- Storage root canonicalized ngoài static root; random UUID filename; chống path traversal/symlink; stream sau policy check.
- Rate/size cap upload; strip executable metadata khi cần; không dùng client filename làm disk path.

## Rollback

- Revert code + migration PR3; backup/xóa `storage/private` theo attachment rows của PR3, không recursive-delete path chưa resolve.

## Next Steps

- PR4 tái dùng User/Profile serializers và follow relation cho article author/feed.
