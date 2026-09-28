# Phase 04E — Delete Article

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md) · [4A schema](./phase-04a-article-schema.md) · [4D update](./phase-04d-update-article.md)
- [OpenAPI](../../spec/api/openapi.yml) · [article Hurl](../../spec/api/hurl/articles.hurl) · [error Hurl](../../spec/api/hurl/errors_articles.hurl) · [authorization Bruno](../../spec/api/bruno/errors-authorization/04-user-b-tries-to-delete-403.bru)
- [Contract research](../reports/researcher-260928-phase-04e-contract.md) · [repository patterns](../reports/researcher-260928-phase-04e-patterns.md)

## Overview, Dependencies, and Key Insights

- Priority: P1 · Status: Implementation reviewed; PR submission in progress · Scope: **`DELETE /api/articles/:slug` only** in one ready PR, directly based on `phase-04d-update-article` / [PR #51](https://github.com/hungpv-2151/NestJS-tutorial/pull/51) at `d171b124`.
- Depends on 4A's article/tag/favorite tables and cascade foreign keys, 4C's detail GET for the post-delete check, and 4D's row-lock/typed-error convention. 4F follows this PR. Continue to the next API after this PR without waiting for a manual review check, per current user direction.
- Hard-delete one article row. The existing foreign keys remove its `article_tags` and `article_favorites` rows; global `tags` rows remain. No migration, DTO, serializer, or new dependency.

## Requirements and Contract

| Case | Observable result |
| --- | --- |
| Request | Required `Authorization: Token <jwt>` and required slug path segment; no body or query contract. |
| Owner success | `204 No Content` with an empty body; subsequent `GET /api/articles/:slug` returns `404 {"errors":{"article":["not found"]}}`. |
| Missing/invalid token | Strict guard returns `401` with `errors.token: ["is missing"]` or `["is invalid"]`; a valid token whose user no longer exists maps to invalid. |
| Unknown slug | Valid subject gets `404 {"errors":{"article":["not found"]}}`. |
| Non-owner | **Local inference from 4D's owner-only mutation policy**, also asserted by article authorization Bruno: `403 {"errors":{"article":["forbidden"]}}`; leave article and joins unchanged. |

- OpenAPI's DELETE response list already has `204/401/403/404/422`, but its shared 403/404 examples use `errors.resource`. Give DELETE operation-specific article-key examples in Swagger/OpenAPI. There is no body or specified validation case: do not invent a 422 rule merely to exercise the generic listed response.
- Security: derive username only from the verified JWT subject, check owner before mutation, never pass the raw HTTP request into the service, and never expose driver errors or token contents. A bad persistence operation maps to the existing redacted 500 envelope.
- Quality gates: every code file stays under 200 lines; target ≤300 and hard limit ≤400 production changed lines for this PR. Lint has zero errors, tests and compile pass, and no secrets enter commits or PR evidence.

## Architecture and Data Flow

`AuthTokenGuard → focused delete controller(slug, auth.sub) → ArticleDeleteService → DataSource.transaction → lookup user → lock article by slug → owner check → delete article by ID → PostgreSQL FK cascades → 204 empty response`.

1. Resolve the verified username inside the transaction; absent user is a typed stale-subject error → 401. Load the article with `pessimistic_write`; absent row → typed 404, different `authorId` → typed 403. Perform no writes before these checks.
2. Delete the locked article by ID through the same transaction manager. Check the delete result if needed to avoid reporting success when a row unexpectedly disappears. Unexpected database errors become a typed persistence error; controller maps it to redacted 500. Keep cascade work in PostgreSQL and retain global tags.
3. Use a focused `ArticleDeleteController` with `@Controller('articles')`, `@Delete(':slug')`, strict guard and `@HttpCode(204)`; return `undefined`, so no body is serialized. Register it in `ArticlesModule`. Keep the existing 157-line `ArticlesController` below the file limit and do not expand its unrelated routes.
4. Put DELETE Swagger decorators in `article-delete.swagger.ts`, because `articles.swagger.ts` is already 175 lines. Document Token auth, bodyless 204, and article-specific 403/404. Reconcile the checked-in OpenAPI DELETE operation only; leave other operation contracts alone.

## File Ownership and Implementation Steps

| Action / owner | Files | Purpose |
| --- | --- | --- |
| Create / implementer | `src/articles/article-delete.service.ts`, `src/articles/article-delete.controller.ts`, `src/articles/article-delete.swagger.ts` | Locked, owner-scoped deletion; HTTP mapping; focused docs. |
| Modify / implementer | `src/articles/articles.module.ts`, `spec/api/openapi.yml` | Register service/controller; operation-specific response examples. |
| Create / tester | `src/articles/article-delete.service.spec.ts`, `test/delete-article.e2e-spec.ts` | Unit/error and real HTTP/DB assertions; reuse `test/article-detail-fixture.ts`. |
| Delete | None. | Existing schema and contracts remain compatible. |

1. Refresh/rebase against PR #51, confirm the direct base and one-API diff. Write tests first and record a valid RED failure from the absent DELETE behavior, not from DB or test setup.
2. Implement the service, focused controller/Swagger, module registration, and OpenAPI examples. Run `pnpm build` after code changes; keep each code file below 200 lines and the PR production diff within its size gate.
3. Run focused GREEN tests, then `pnpm test`, `pnpm test:e2e`, and `pnpm lint`. Use configured `TEST_DATABASE_URL`; never print credentials. If article tables are missing in the test DB, apply existing migrations there before rerunning. Do not change schema or reset the normal `DATABASE_URL`.
4. Send final tested code to an independent reviewer. Resolve security/correctness findings, rerun affected gates, audit the final PR diff, push the branch, and open a **ready** PR based directly on #51's head branch. Add PR evidence with command results, exit codes, head SHA, and an API-only screenshot note; update Phase 04 status, roadmap, and changelog to match actual delivery.

## Test Matrix and Observable Done Criteria

- Unit: typed stale-user/404/403/500 mapping; verified subject and slug are passed; owner check occurs before deletion; no response object is produced. Reject a non-owner without deleting anything.
- PostgreSQL-backed E2E: owner DELETE is exactly 204 with empty body; next GET is article-key 404; article and its tag/favorite joins are gone while shared tag rows and another article using them survive. A single SQL DELETE and FK cascades are atomic, so no separate rollback test is needed without another write step.
- HTTP E2E: missing/malformed/invalid token 401, valid token for deleted user 401, non-owner 403 with article and joins unchanged, unknown slug 404. Assert article-specific error envelopes; no artificial DELETE body/422 case.
- Done when RED/GREEN, build, full unit/integration/E2E, lint, reviewer, stack-base verification, size check, and ready PR evidence all pass; continue immediately to 4F.

## Verification Checkpoint — 2026-09-28

- Valid RED: focused E2E failed 4/4 because DELETE was absent after DB and fixtures started successfully.
- GREEN: build exit 0; full `pnpm test` exit 0 (38 files; 160 passed, 1 skipped); full `pnpm test:e2e` exit 0 (16 files; 60 passed); focused DELETE E2E exit 0 (7 passed); service unit exit 0 (5 passed).
- `pnpm lint` exit 0 with 0 errors and 218 warnings across 121 files; `git diff --check` passed; OpenAPI YAML parsed and response placement asserted. All changed code/test files are below 200 lines; production source diff is about 196 changed lines.
- Independent review accepted after removing the unsupported DELETE 422, documenting the actual redacted 500, and adding malformed-header coverage. No migration; PostgreSQL cascades and shared-tag survival are verified.

## Risks, Compatibility, Rollback, and Next Step

| Risk | Likelihood / impact | Countermeasure |
| --- | --- | --- |
| Update/delete race or non-owner data loss | Medium / High | Use the same article write lock as 4D, owner check before delete, and no-write 403 test. |
| Orphan joins or accidental shared tag deletion | Low / High | Verify migrated FK cascades and shared-tag survival with two-article DB fixture. |
| 204 accidentally serializes JSON or wrong error key | Medium / Medium | Exact empty-body/status assertions and operation-specific Swagger/OpenAPI examples. |
| Expanded controller/Swagger crosses 200 lines or PR absorbs another API | Medium / Medium | Focused files, route audit, production diff count, direct base check. |

- Compatibility: no migration, no request/response change to 4A–4D routes; DELETE is additive. Revert only the 4E PR to remove the endpoint; already deleted records cannot be restored by code revert and require backup recovery if needed. Rebase dependent 4F+ PRs if 4E is removed.
- Next step: start 4F's no-route list query foundation on top of this ready PR; keep its PR marked `Public API change: none` and continue the stack without a manual pause.
