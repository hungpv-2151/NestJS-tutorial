# Phase 03 — User, Profile và Private-File API Stack

## Context Links

- [Profile contract](../../spec/api/hurl/profiles.hurl) · [profile errors](../../spec/api/hurl/errors_profiles.hurl) · [Phase 02](./phase-02-database-auth-background-jobs.md)

## Overview

- Priority: P1 · Status: Pending · Effort: 18h · Blocked by: Phase 02 PR 2I
- Tách update-user, profile, follow/unfollow, avatar upload và file read thành PR riêng; attachment foundation không expose API.

## Key Insights

- Private file nằm ngoài static root; auth/policy bảo vệ dữ liệu. Polymorphic FK cần service validate owner và bù trừ DB/filesystem failure.
- POST follow và DELETE unfollow là hai APIs, nên không chung PR dù dùng cùng relation/service.

## Requirements

- Tách riêng `PUT /api/user`, `GET /api/profiles/:username`, POST/DELETE follow, `PUT /api/user/avatar`, `GET /api/files/:id`.
- Avatar JPEG/PNG/WebP ≤2 MiB, kiểm magic bytes, random storage name. File read bắt buộc auth.

## Architecture and PR Dependency Graph

`2I → 3A → 3B → 3C → 3D → 3E → 3F → 3G`. Mỗi PR rebase lên base trực tiếp trước first fix và submit.

| PR | Only scope / public API | Base | Required evidence |
|---|---|---|---|
| 3A | `PUT /api/user` only | 2I | update/reissue/error E2E screenshot |
| 3B | `GET /api/profiles/:username` only | 3A | anonymous/auth serializer result |
| 3C | `POST /api/profiles/:username/follow` only | 3B | idempotent/self-follow result |
| 3D | `DELETE /api/profiles/:username/follow` only | 3C | idempotent/unknown-profile result |
| 3E | attachments migration + private storage/policy; API: none | 3D | migration + storage unit result |
| 3F | `PUT /api/user/avatar` only | 3E | valid/fake-MIME/oversize/replace screenshot |
| 3G | `GET /api/files/:id` only | 3F | auth/policy/headers/path-leak result |

## Data Flow

`request → DTO/guard → service → TypeORM → serializer`; `multipart → temp → validation → private storage → DB transaction → compensation`; `file id → guard → policy → safe stream`.

## Related Code Files

- Modify sequentially: `src/users/*`, `src/auth/*`, `src/app.module.ts`, `src/config/*`, `package.json`.
- Create by owner: `src/profiles/*` (3B–3D), `src/attachments/*` and migrations (3C/3E), `src/files/*` (3G), `storage/private/` runtime path (3E).
- Tests stay in the PR for the one API/foundation they prove. Delete: none.

## Implementation Steps

1. Refresh/rebase each row, inspect inherited diff, confirm one API/foundation only.
2. Implement 3A–3D through shared auth/error/serializer seams; 3E has no route; 3F and 3G remain separate.
3. Keep preferred size ≤300 and hard limit ≤400 changed lines; oversized work splits into suffix PRs for the same API.
4. Run compile, zero-error lint/static analysis, targeted tests/contract; attach screenshot/result comment and record URL.

## Todo List

- [ ] PRs 3A–3G rebased, one-API scoped and within line limit.
- [ ] Error-level findings zero; retained warnings documented per PR.
- [ ] Evidence URLs: 3A `pending`; 3B `pending`; 3C `pending`; 3D `pending`; 3E `pending`; 3F `pending`; 3G `pending`.

## Success Criteria

- Contracts pass; failed mutations preserve data; invalid or unauthorized file operations leak no path.

## Risk Assessment

- DB/filesystem split-brain — Medium/High → temp file, compensation and focused tests in 3E/3F.
- Mixed follow/unfollow diff — Medium/High → separate controller/test hunks and bases 3C/3D.

## Security Considerations

- Canonicalized storage root, random disk names, `nosniff`, safe headers and rate/size caps.

## Rollback

- Revert top layer only; 3E migration uses `down`; cleanup resolves IDs only inside configured root.

## Next Steps

- Phase 04 starts after 3G and all Phase 03 evidence comments are accepted.
