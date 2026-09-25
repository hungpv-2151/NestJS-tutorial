# Phase 03 — User, Profile và Private-File API Stack

## Context Links

- [Profile contract](../../spec/api/hurl/profiles.hurl) · [profile errors](../../spec/api/hurl/errors_profiles.hurl) · [Phase 02](./phase-02-database-auth-background-jobs.md)

## Overview

- Priority: P1 · Status: In progress — 3A #39 through 3E #43 submitted; 3F implementation is local on the #44 head, intended PR #45; unit 8/8, E2E 3/3, build and lint passed (0 errors, 131 warnings), final review passed; PR submission remains pending · Effort: 18h · Blocked by: Phase 02 PR 2H
- Tách update-user, profile, follow/unfollow, avatar upload và file read thành PR riêng; attachment foundation không expose API.

## Key Insights

- Private file nằm ngoài static root; auth/policy bảo vệ dữ liệu. Polymorphic FK cần service validate owner và bù trừ DB/filesystem failure.
- POST follow và DELETE unfollow là hai APIs, nên không chung PR dù dùng cùng relation/service.

## Requirements

- Tách riêng `PUT /api/user`, `GET /api/profiles/:username`, POST/DELETE follow, `PUT /api/user/avatar`, `GET /api/files/:id`.
- Avatar JPEG/PNG/WebP ≤2 MiB, kiểm magic bytes, random storage name. File read bắt buộc auth.

## Architecture and PR Dependency Graph

`2H → 3A → 3B → 3C → 3D → 3E (#43) → #44 → 3F (intended #45) → 3G`. PR #44 is an intervening agent-rules stack layer. The local 3F implementation is at the #44 head. Final implementation checks passed: unit 8/8, E2E 3/3, build, lint with 0 errors (131 warnings), and independent final review. PR submission remains pending. After 3F is submitted and its base is confirmed, 3G must target that PR. PR 2I remains deferred until the final roadmap pass. Mỗi PR rebase lên base trực tiếp trước first fix và submit.

| PR  | Only scope / public API                                   | Base | Required evidence                           |
| --- | --------------------------------------------------------- | ---- | ------------------------------------------- |
| 3A  | `PUT /api/user` only                                      | 2H   | update/reissue/error E2E screenshot         |
| 3B  | `GET /api/profiles/:username` only                        | 3A   | anonymous/auth serializer result            |
| 3C  | `POST /api/profiles/:username/follow` only                | 3B   | idempotent/self-follow result               |
| 3D  | `DELETE /api/profiles/:username/follow` only              | 3C   | idempotent/unknown-profile result           |
| 3E  | attachments migration + private storage/policy; API: none | 3D   | migration + storage unit result             |
| 3F  | `PUT /api/user/avatar` only                               | #44  | valid/fake-MIME/oversize/replace screenshot |
| 3G  | `GET /api/files/:id` only                                 | 3F (intended #45) | auth/policy/headers/path-leak result   |

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

- [ ] PRs 3A–3G rebased, one-API scoped and within line limit. 3F implementation checks and independent final review passed; PR submission and evidence comment remain open.
- [ ] Error-level findings zero; retained warnings documented per PR. 3F lint: 0 errors, 131 warnings; warnings still need review/disposition in PR evidence.
- [ ] Stack audit: confirm #44 base is #43 and confirm 3F's base is #44 before opening intended PR #45; 3G must use 3F as its direct base.
- [ ] Evidence URLs: 3A [PR #39 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/39#issuecomment-5753521154); 3B [PR #40 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/40#issuecomment-5753623421); 3C [PR #41 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/41#issuecomment-5754553474); 3D [PR #42 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/42#issuecomment-5756484390); 3E [PR #43 validation comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/43#issuecomment-5756688502); 3F results recorded: unit 8/8, E2E 3/3, build, lint 0 errors/131 warnings; independent review and PR comment pending; 3G `pending`.

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

- Main agent owns closing 3F: document disposition of 131 lint warnings, open PR #45 on #44, confirm its direct base, and record its validation comment. Checks already green: unit 8/8, E2E 3/3, build, lint 0 errors; final review passed. Done when PR #45, direct base, review, test results, and evidence comment are recorded.
- 3G remains deferred until 3F PR is submitted; then open `GET /api/files/:id` against 3F (#45). Phase 04 starts after 3G and all Phase 03 evidence comments are accepted.
