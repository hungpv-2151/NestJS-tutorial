# Research report: Phase 04B `POST /api/articles` patterns

## Preflight

No `Skill`/skill-activation tool is exposed in this sub-agent context, so `tkm:help` and `tkm:research` could not be activated. No external documentation lookup is needed for this codebase-pattern task; findings below come from the repository. No source code was changed.

## Recommendation

Implement 4B as one protected `POST /articles` controller action backed by a focused article creation handler/service. Keep DTO validation, HTTP status and response mapping at the controller boundary. Put author lookup, slug conflict handling, and all article/tag persistence in one `DataSource.transaction`; inside the callback, obtain every repository from the transaction manager. Use a batched tag insert with conflict-ignore, reload the IDs, then insert `article_tags` with the input index as `position`. Return the existing detail serializer with the created author's public fields and ordered tags.

This matches the project’s transaction precedent in registration and avatar persistence, the boundary pattern in profile/auth handlers, and the 4A schema/serializer contract. It avoids transaction writes escaping to globally injected repositories and avoids N+1 tag writes.

## Existing patterns and constraints

### Controller, authentication, and validation

- `AuthTokenGuard` accepts the `Token <jwt>` scheme, verifies the token, and attaches typed claims to `request.auth`; `sub` is the username ([auth-token.guard.ts](../../src/auth/auth-token.guard.ts:12)). `AuthModule` exports the guard ([auth.module.ts](../../src/auth/auth.module.ts:47)). 4B should use that verified subject as the actor, never accept author identity from the body.
- Profile mutation shows the route pattern: scoped controller route, Swagger decorator, guard, and HTTP-to-service error mapping ([profiles.controller.ts](../../src/profiles/profiles.controller.ts:53)). Auth handlers show when to move request use out of controllers ([auth-current-user-handler.ts](../../src/auth/auth-current-user-handler.ts:1)); the current project rules further require that raw HTTP requests do not enter domain logic.
- The global `ValidationPipe` transforms DTOs, strips allowed fields, rejects unknown fields, and sends class-validator errors through the RealWorld 422 formatter ([create-app.ts](../../src/create-app.ts:52), [api-exception.filter.ts](../../src/common/filters/api-exception.filter.ts:44)). Follow the nested request-envelope DTO pattern (`@IsDefined`, `@ValidateNested`, `@Type`) used by auth DTOs ([user-auth.dto.ts](../../src/common/dto/user-auth.dto.ts:59)).
- The create contract is `{ article: { title, description, body, tagList? } }`; title, description, and body are required. OpenAPI declares 201, 401, 409, and 422 for this route ([openapi.yml](../../spec/api/openapi.yml:216), [openapi.yml](../../spec/api/openapi.yml:858)). Hurl expects 201 and the serialized article envelope, including ordered input tags ([articles.hurl](../../spec/api/hurl/articles.hurl:14)).

### Persistence and tag order

- 4A's `Article` has a unique slug and `author_id`; `ArticleTag` has a composite key, nonnegative position, and unique `(article_id, position)` ([article.entity.ts](../../src/articles/article.entity.ts:13), [article-tag.entity.ts](../../src/articles/article-tag.entity.ts:14)). The migration independently enforces slug/tag/link uniqueness and FKs ([4A migration](../../src/database/migrations/1710000004000-create-articles-tags-favorites.ts:5)).
- Existing multi-row transaction pattern: `AuthService.register` uses `dataSource.transaction`, gets repositories from the callback manager, and lets a failure abort the registration/outbox pair ([auth.service.ts](../../src/auth/auth.service.ts:127)). Avatar upload does the same for user/attachment writes ([user-avatar-handler.ts](../../src/auth/user-avatar-handler.ts:60)). The PostgreSQL integration test proves failed work rolls back ([welcome-mail-outbox-transaction.integration.spec.ts](../../test/welcome-mail-outbox-transaction.integration.spec.ts:12)).
- Existing database-conflict pattern: `ProfileService.follow` performs a single insert and uses `.orIgnore()` for a uniqueness-backed idempotent relation ([profile.service.ts](../../src/profiles/profile.service.ts:20)). Article creation is not idempotent, so ignore only tag-name conflicts; do not ignore article slug or article-tag failures.
- Use a batch insert for all requested tags, conflict-ignore on the unique tag name, query the resulting IDs in one `IN` query, then batch insert link rows with `position = input index`. `ArticleTag.position` and the Hurl order assertions require explicit order persistence; a plain unordered many-to-many relation is insufficient ([4A entity](../../src/articles/article-tag.entity.ts:14), [Hurl assertions](../../spec/api/hurl/articles.hurl:26)).
- The 4A detail serializer is pure and expects author, tag array, favorite state/count, and `authorFollowing` as explicit context ([article.serializer.ts](../../src/articles/article.serializer.ts:3)). For a newly created article, supply `favorited: false`, `favoritesCount: 0`, and `authorFollowing: false`; pass tags in submitted order. Never serialize a password hash or email.

### Nest module registration

- `ProfilesModule` imports `AuthModule` plus `TypeOrmModule.forFeature([UserFollow])`, and registers its controller/service ([profiles.module.ts](../../src/profiles/profiles.module.ts:9)). `AttachmentsModule` uses the same entity feature registration pattern ([attachments.module.ts](../../src/attachments/attachments.module.ts:1)).
- Add the new article module to `AppModule`; `AppModule` currently has five imports and its spec asserts that count ([app.module.ts](../../src/app.module.ts:14), [app.module.spec.ts](../../src/app.module.spec.ts:10)). Register `Article`, `ArticleTag`, and `Tag` with `TypeOrmModule.forFeature` so `autoLoadEntities` includes the 4A mappings ([database.module.ts](../../src/database/database.module.ts:7)). If the handler uses only `DataSource` and transaction-manager repositories, it does not also need injected global repositories.

## Ranked implementation options

| Rank | Shape | Performance | Complexity / maintenance | Fit |
|---|---|---|---|---|
| 1 | Focused handler/service with `DataSource.transaction`; batch tag/link writes from transaction manager | One insert batch per relation set plus one tag-ID lookup | Low; explicit atomic boundary | Best fit: mirrors `AuthService`/avatar precedent and 4A contract |
| 2 | Inject repositories and add transaction runner/ports around them | Can be equally fast | More interfaces/factories and more ways to accidentally use non-transactional repositories | Use only if article persistence grows enough to justify a repository adapter |
| 3 | Controller writes directly through repositories | Potentially similar query count | Blurs HTTP/domain boundary and complicates atomicity/testing | Reject; conflicts with project auth-review rule and existing handler pattern |

### Evidence quality and adoption risk

- **Strongest evidence:** running project code and its tests. The transaction recommendation is independently demonstrated by auth registration, avatar persistence, and a real PostgreSQL rollback integration test. Controller/auth behavior is demonstrated by guard/controller code plus Supertest endpoint tests. The request and response contract comes from two project-owned artifacts, OpenAPI and Hurl.
- **Extracted facts:** `sub` is the verified username; article creation requires an authenticated caller; title/description/body are required; tag order is asserted; slug and tag uniqueness are enforced in PostgreSQL; tests route `TEST_DATABASE_URL` into `DATABASE_URL`.
- **Inference:** batching tag and join inserts is recommended for bounded query count and race safety. There is no existing tag-creation implementation to copy, so validate the exact TypeORM `orIgnore`/return behavior with the installed driver during 4B implementation tests.
- **Adoption risk: low** for the recommended path. It adds no dependency or new persistence abstraction and reuses the existing Nest module, TypeORM `DataSource`, manager transaction, and QueryBuilder patterns. The main risk is API edge behavior absent from the contract (slug collision and repeated tags), not framework maturity or migration cost. The adapter/port option has higher maintenance cost because it would add an abstraction without current cross-feature reuse.

## Risks and decisions 4B must settle

1. **Slug generation is unspecified.** Hurl only requires a string, OpenAPI does not prescribe an algorithm, while 4A enforces uniqueness and allows duplicate titles. Generate a readable base slug plus a collision-safe suffix, with the DB constraint as the final arbiter; map only the named slug constraint to the documented 409. A pre-check alone is race-prone. Record the chosen suffix/retry behavior in the 4B plan. This is a recommendation inferred from the constraint, not an extracted spec rule.
2. **Tag casing and duplicate inputs are unspecified.** The 4A unique constraint is exact, case-sensitive text; do not silently lowercase or normalize. Decide whether a repeated input tag is rejected with 422 or deduplicated preserving first occurrence. Rejecting duplicates is the simpler contract and avoids the composite-key failure becoming a 500, but this remains a product-contract choice.
3. **Tag limits are unspecified.** 4A intentionally uses `text`, so add no arbitrary database cap. If request limits are needed, choose and document DTO bounds without implying they came from the schema.
4. **Transaction concurrency.** Concurrent requests can create the same tag. Conflict-ignore followed by a transactional lookup handles that race. Do not use a separate availability pre-check as correctness. A slug uniqueness race must surface as the intended 409 rather than leak a database error.
5. **No route leakage.** 4B owns only `POST /api/articles`; do not add article read/update/list routes in its module/controller.

## Test setup and evidence

- Unit tests run `src/**/*.spec.ts`; endpoint tests run `*.e2e-spec.ts`; both Vitest configs load `test/setup/test-database.ts` ([vitest.config.ts](../../vitest.config.ts:8), [vitest.config.e2e.ts](../../vitest.config.e2e.ts:6)). That setup reads `.env` only when `TEST_DATABASE_URL` is absent, validates it through `getTestDatabaseConfig`, then maps it to `DATABASE_URL` for TypeORM ([test-database.ts](../../test/setup/test-database.ts:1), [database-config.ts](../../src/config/database-config.ts:27)). Existing integration tests may separately opt into `INTEGRATION_DATABASE_URL` ([outbox integration test](../../test/welcome-mail-outbox-transaction.integration.spec.ts:9)).
- Add DTO tests for missing/wrong types, empty required strings, invalid `tagList`, and unknown fields. Add isolated HTTP tests proving missing/invalid token fails before service, valid token supplies only `sub`, response is 201 with ordered tags, typed slug conflict becomes 409, and validation errors become 422. Add persistence-focused tests proving article + tags + links commit together and a link/tag failure leaves no partial article. Prefer a PostgreSQL integration test for true rollback and concurrent unique behavior; do not hardcode a different database URL when the repository's configured test URL is available.

## Limits

This report is grounded in repository code and contracts; it did not inspect a live DB or consult external NestJS/TypeORM documentation. The skill-activation tools were unavailable, as noted above. Tag duplicate semantics and slug format remain unresolved by current OpenAPI/Hurl evidence.

**Status:** DONE_WITH_CONCERNS
**Summary:** Mapped controller/auth/DTO, transaction, tag-order, serializer, module, and test conventions for the single create-article API. 4B still needs explicit slug and duplicate-tag decisions.
**Concerns/Blockers:** Repository specs do not define slug format, slug collision retry, tag case normalization, or duplicate tag behavior.
