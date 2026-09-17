# Phase 02 — Audit/Rebase Gate, Foundations và Auth API Stack

## Context Links

- [Auth contract](../../spec/api/hurl/auth.hurl) · [auth errors](../../spec/api/hurl/errors_auth.hurl) · [PR1](https://github.com/hungpv-2151/NestJS-tutorial/pull/17)

## Overview

- Priority: P1 · Status: In progress — 2B.1 submitted; 2B.2 submitted in [PR #23](https://github.com/hungpv-2151/NestJS-tutorial/pull/23) · Effort: 24h · Blocked by: PR1
- 2B.1 đã submit ở [PR #22](https://github.com/hungpv-2151/NestJS-tutorial/pull/22) với migration applied trên `DATABASE_URL`. 2B.2 reset tooling đã verify; 2C–2I tiếp tục blocked theo dependency chain.

## Key Insights

- Snapshot 2026-09-15: 6 file modified, +1,102/-16; riêng `pnpm-lock.yaml` +1,067 dòng. Dependency/config work đã tách khỏi foundation; không có public API trong 2B.1.
- Không sửa tiếp trên diff này trước khi giữ một snapshot phục hồi được, refresh/rebase lên `phase-01-bootstrap-i18n-swagger`, rồi map từng hunk vào PR stack mới.
- Generated lockfile vẫn tính vào limit. PR dự kiến >400 changed lines phải tách thêm trước submit.

## Delivery Status

- 2B.1 complete locally: TypeORM data source, migration CLI wiring, `User` entity, reversible users migration, and focused migration/data-source tests.
- Validation passed: lint, build, 24 unit tests, and 6 E2E tests. Isolated temporary Neon database apply → revert → apply passed; database was dropped afterward.
- Reviewer passed; no API routes were added. Evidence: [PR #22 comment](https://github.com/hungpv-2151/NestJS-tutorial/pull/22#issuecomment-5692428675).
- 2B.2 dùng `TEST_DATABASE_URL` và bắt buộc `CONFIRM_DATABASE_RESET=yes`; refusal, reset tạm thời, build, lint, unit và E2E đã pass. 2C–2I remain blocked by the declared dependency graph.
- 2B.2 reviewer found no issues; PR evidence URL remains pending until submission.
- Registration delivery is split: 2E.1 provides the HTTP contract only. 2E.2 will add durable welcome-mail delivery with a transactional outbox or equivalent retryable record; it must never return a retry-hostile 5xx after the user transaction commits.
- PR #31 consolidates the complete registration API on top of 2C; it includes `User` metadata remediation and runtime `.env` preload. It supersedes closed PRs #26–#30 without changing PRs #17–#25.

## Requirements

- Migration viết tay có `up/down`; DB reset chỉ dev/test; không `synchronize`.
- Bốn APIs giữ riêng: `POST /api/users`, `POST /api/users/login`, `GET /api/user`, `POST /api/user/logout`.
- JWT có `sub/jti/iss/aud/iat/exp`; logout deny-list Redis TTL bằng phần token còn lại; auth lỗi không lộ secret.
- Welcome job chỉ thuộc registration API; daily training summary là foundation không có public API.

## Architecture and PR Dependency Graph

`PR1 → 2A → 2B.1 → 2B.2 → 2C → 2D → 2E → 2F → 2G → 2H → 2I`. Mỗi row là một PR ceiling; migration và reset tách thành foundation layers để rollback/review độc lập.

| PR | Only scope / public API | Base | Required evidence |
|---|---|---|---|
| Gate G2 | Preserve local work; refresh/rebase; diff-to-plan audit; no code fix | PR1 | stack screenshot + before/after diff-stat |
| 2A | Dependency/config slices; API: none | PR1 | install/compile result; size proof |
| 2B.1 | TypeORM data source, migration CLI, users entity/migration; API: none | 2A | apply/revert/apply evidence |
| 2B.2 | Guarded dev/test database reset tooling; API: none | 2B.1 | reset refusal + reset evidence |
| 2C | DTO/error/serializer/JWT/Redis primitives; API: none | 2B.2 | targeted unit/static-analysis result |
| 2D | `POST /api/users` part 1: transaction, hash, duplicate rules | 2C | service/persistence test result |
| 2E.1 | `POST /api/users` part 2: HTTP contract only | 2D | register contract result |
| 2E.1.R | Registration metadata + runtime env preload remediation; API: none | 2E.1 | real register result + startup result |
| 2E.2 | `POST /api/users` durable welcome-mail delivery; no additional public API | 2E.1 | post-commit recovery + queue result |
| 2F | `POST /api/users/login` only | 2E | valid/invalid login E2E screenshot |
| 2G | `GET /api/user` only | 2F | valid/missing/invalid token result |
| 2H | `POST /api/user/logout` only | 2G | 204/reuse-denied/TTL result |
| 2I | Daily training summary queue/scheduler; API: none | 2H | cron/idempotency unit result |

## Related Code Files

- Audit/modify sequentially: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/.env.example`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `src/app.module.ts`, `src/create-app.ts`.
- Create by owning PR: `src/database/*` (2B), `src/common/dto/*`, `src/common/filters/*`, `src/auth/*` (2C/2F–2H), `src/users/*` (2B/2D–2G), `src/mail/*`, `src/jobs/*` (2E), `src/scheduling/*` (2I).
- Tests stay with the PR/API they prove; no later catch-all test PR owns auth gaps.
- Delete: none.

## Implementation Steps

1. G2: record `gh stack view` and diff-stat; protect all uncommitted work without discard/reset. Refresh refs, rebase branch on declared PR1 base, then capture the same evidence again.
2. Audit every existing hunk against rows 2A–2I. Keep only one row per branch; move mixed or oversized work into new stacked layers. Create a remediation layer when implemented behavior differs from this plan.
3. Execute 2A–2I in order. Before each first fix and before submit, refresh/rebase on its row base and re-run the one-API/line-count audit.
4. For each PR run compile, error-level lint/static analysis, targeted unit/integration/E2E and migration checks relevant to its scope.
5. Attach one screenshot plus textual command/results to a PR comment; record comment URL in the row/checklist before review.

## Todo List

- [ ] G2 rebase/audit complete; current diff preserved and mapped, not silently marked done.
- [ ] PRs 2A–2I each stay within one API/foundation and ≤400 changed lines.
- [ ] Every PR has zero error-level findings; warnings fixed or logged with follow-up.
- [ ] Evidence comment URLs: 2A dependency foundation [PR #20](https://github.com/hungpv-2151/NestJS-tutorial/pull/20#issuecomment-5673200048); 2A required-DB configuration [PR #21](https://github.com/hungpv-2151/NestJS-tutorial/pull/21#issuecomment-5676001144); 2B.1 [PR #22](https://github.com/hungpv-2151/NestJS-tutorial/pull/22#issuecomment-5692428675); 2B.2 [PR #23](https://github.com/hungpv-2151/NestJS-tutorial/pull/23#issuecomment-5695483395); 2C `pending`; 2D and 2E.1 consolidated in [PR #31](https://github.com/hungpv-2151/NestJS-tutorial/pull/31#issuecomment-5711870434); 2E.2 `pending`; 2F `pending`; 2G `pending`; 2H `pending`; 2I `pending`.

## Success Criteria

- Fresh DB builds only from reversible migrations; each auth endpoint passes its own contract before the next PR starts.
- Registration queue failure follows documented post-commit policy; logout token cannot be reused; scheduler remains non-API work.

## Risk Assessment

- Rebase loses local work — Likelihood: Medium · Impact: Critical → recoverable snapshot first; no destructive reset.
- Oversized dependency lockfile — Likelihood: High · Impact: High → generated lines count; split dependency slices until every submitted PR ≤400.
- Mixed auth API changes — Likelihood: High · Impact: High → audit route/controller/test diffs and split before review.

## Security Considerations

- Secrets only from env; Argon2 input capped; redact password/hash/JWT/Auth header. Redis outage on protected auth fails closed.
- Reset chỉ nhận `TEST_DATABASE_URL` hợp lệ và bắt buộc explicit confirmation; không có host/name allowlist theo quyết định tối giản hóa đã xác nhận.

## Rollback

- Revert only the failing top layer; migration PR uses `down`; delete only owned Redis prefixes. Rebase descendants after base rollback.

## Next Steps

- Phase 03 begins only after 2I is green and every Phase 02 evidence comment URL is recorded.
