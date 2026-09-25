# Phase 03 — User, Profile và Private-File API Stack

## Context Links

- [Profile contract](../../spec/api/hurl/profiles.hurl) · [profile errors](../../spec/api/hurl/errors_profiles.hurl) · [Phase 02](./phase-02-database-auth-background-jobs.md)

## Overview

- Priority: P1 · Status: In progress — 3A #39 through 3F #45 submitted; 3G implementation/review complete, intended PR #46 stack submission pending · Effort: 18h · Blocked by: Phase 02 PR 2H
- Tách update-user, profile, follow/unfollow, avatar upload và file read thành PR riêng; attachment foundation không expose API.

## Key Insights

- Private file nằm ngoài static root; auth/policy bảo vệ dữ liệu. Polymorphic FK cần service validate owner và bù trừ DB/filesystem failure.
- POST follow và DELETE unfollow là hai APIs, nên không chung PR dù dùng cùng relation/service.

## Requirements

- Tách riêng `PUT /api/user`, `GET /api/profiles/:username`, POST/DELETE follow, `PUT /api/user/avatar`, `GET /api/files/:id`.
- Avatar JPEG/PNG/WebP ≤2 MiB, kiểm magic bytes, random storage name. File read bắt buộc auth.

## Architecture and PR Dependency Graph

`2H → 3A → 3B → 3C → 3D → 3E (#43) → #44 → 3F (#45) → 3G (intended #46)`. PR #44 is an intervening agent-rules stack layer. PR #45 targets `chore-agent-rule-refresh` (#44) at base SHA `a6a17f2`; its head is `0f01b4f`. 3G implements `GET /api/files/:id` with owner-only access: JWT `sub` resolves to the user by username before comparing the owner UUID. Unauthorized and missing files return non-disclosing 404s; successful private-file responses set safe private response headers. Validation: 10 unit/storage tests, 3 E2E tests, build pass, lint 0 errors/139 warnings, diff-check pass; independent review passed. Intended PR #46 must target #45; it is not open yet and stack submission is pending. The avatar URL is not fetchable until #46 merges. PR 2I remains deferred until the final roadmap pass. Mỗi PR rebase lên base trực tiếp trước first fix và submit.

| PR  | Only scope / public API                                   | Base | Required evidence                           |
| --- | --------------------------------------------------------- | ---- | ------------------------------------------- |
| 3A  | `PUT /api/user` only                                      | 2H   | update/reissue/error E2E screenshot         |
| 3B  | `GET /api/profiles/:username` only                        | 3A   | anonymous/auth serializer result            |
| 3C  | `POST /api/profiles/:username/follow` only                | 3B   | idempotent/self-follow result               |
| 3D  | `DELETE /api/profiles/:username/follow` only              | 3C   | idempotent/unknown-profile result           |
| 3E  | attachments migration + private storage/policy; API: none | 3D   | migration + storage unit result             |
| 3F  | `PUT /api/user/avatar` only                               | #44  | [PR #45](https://github.com/hungpv-2151/NestJS-tutorial/pull/45); unit/E2E/build/lint/review evidence below |
| 3G  | `GET /api/files/:id` only                                 | #45 | Implemented/reviewed; 10 unit/storage + 3 E2E, build, lint, diff-check pass. Intended #46 not submitted. |

## Data Flow

`request → DTO/guard → service → TypeORM → serializer`; `multipart → temp → validation → private storage → DB transaction → compensation`; `file id → guard → policy → safe stream`.

## Related Code Files

- Modify sequentially: `src/users/*`, `src/auth/*`, `src/app.module.ts`, `src/config/*`, `package.json`.
- Create by owner: `src/profiles/*` (3B–3D), `src/attachments/*` and migrations (3C/3E), `src/files/*` (3G), `storage/private/` runtime path (3E).
- Tests stay in the PR for the one API/foundation they prove. Delete: none.

## Implementation Steps

1. Refresh/rebase each row, inspect inherited diff, confirm one API/foundation only.
2. Implement 3A–3D through shared auth/error/serializer seams; 3E has no route; 3F and 3G remain separate.
3. Keep production-code size preferred ≤300 and hard limit ≤400 changed lines; spec, Markdown, JSON, test, migration, YAML, lockfile and supporting artifacts do not count. Oversized code splits into suffix PRs for the same API.
4. Run compile, zero-error lint/static analysis, targeted tests/contract; attach screenshot/result comment and record URL.

## Todo List

- [ ] PRs 3A–3G rebased, one-API scoped and within line limit. 3F #45 is submitted/reviewed; 3G is implemented and reviewed but intended #46 submission remains pending.
- [ ] Error-level findings zero; retained warnings documented per PR. 3F lint: 0 errors, 131 warnings across 90 files; see PR #45 validation comment. 3G lint: 0 errors, 139 warnings; record retained-warning evidence with intended #46 submission.
- [ ] Stack audit: #44 targets #43; #45 targets #44; intended #46 must target #45 (submission pending).
- [ ] Evidence URLs: 3A [PR #39 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/39#issuecomment-5753521154); 3B [PR #40 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/40#issuecomment-5753623421); 3C [PR #41 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/41#issuecomment-5754553474); 3D [PR #42 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/42#issuecomment-5756484390); 3E [PR #43 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/43#issuecomment-5756688502); 3F [PR #45 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/45#issuecomment-5829598488); 3G validation supplied, intended PR #46 evidence comment pending.

## Success Criteria

- Contracts pass; failed mutations preserve data; invalid or unauthorized file operations leak no path.

## Risk Assessment

- DB/filesystem split-brain — Medium/High → temp file, compensation and focused tests in 3E/3F.
- Mixed follow/unfollow diff — Medium/High → separate controller/test hunks and bases 3C/3D.
- Private file authorization — High/High → resolve JWT `sub` by username, compare owner UUID, and return non-disclosing 404; covered in 3G implementation/review.

## Security Considerations

- Canonicalized storage root, random disk names, `nosniff`, safe headers and rate/size caps.

## Rollback

- Revert top layer only; 3E migration uses `down`; cleanup resolves IDs only inside configured root.

## Next Steps

- 3F PR #45 is open and based directly on #44. 3G is implemented and reviewed; submit as intended PR #46 targeting #45. The image URL from PR #45 is not fetchable before #46 merges.
- Phase 04 starts after 3G and all Phase 03 evidence comments are accepted.
