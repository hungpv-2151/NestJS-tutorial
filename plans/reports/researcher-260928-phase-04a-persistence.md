---
title: 'Study Report: Persistence Conventions for Phase 04A'
date: 2026-09-28
scope: 'PostgreSQL TypeORM entities, migrations, registration, migration tests, serializers'
plan: 'plans/260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md'
---

# Study Report: Persistence Conventions for Phase 04A

## Summary

**Rank 1: follow the existing handwritten PostgreSQL migration path.** Add the 4A schema in a reversible migration, register its class and entity classes in the CLI `DataSource`, keep `synchronize` and automatic migration execution disabled, and add the entities to a Nest feature module only when a later API phase begins using them. This fits the current NestJS, TypeORM, PostgreSQL, and manual-migration setup.

The existing migration unit tests check SQL strings with a mocked `QueryRunner`; they do not apply or revert a migration against PostgreSQL. Phase 4A already calls for apply/revert evidence. Prove the full cycle on a clean isolated database. Keep serializers as pure, typed allowlist projections, following the user/profile serializers; article list output must omit `body`, while detail output includes it.

## Scope and Source Quality

- **Date:** 2026-09-28.
- **Scope:** repository conventions that constrain the schema-only 4A PR; no library comparison or external documentation was needed.
- **Primary evidence:** production entities and migrations directly show current persistence practice; their tests show what is actually checked. The Phase 04 plan and Hurl contracts define the target boundaries. The 2026-09-16 journal is historical operational evidence, useful for migration risks but weaker than current code for present behavior.
- **Sources read:** more than a dozen independent project files across `src/database`, `src/users`, `src/profiles`, `src/attachments`, `test`, `spec`, `plans`, and `docs/journals`.

## Key Findings

### 1. Migration and Entity Conventions — EXTRACTED

- Migrations implement `MigrationInterface` and issue handwritten SQL with `QueryRunner.query`. Identifiers use quoted lower snake case. `up` declares the table, foreign keys, checks, and indexes; `down` drops the owning table. The user migration creates `pgcrypto` before using `gen_random_uuid()`. Evidence: [users migration](../../src/database/migrations/1710000000000-create-users.ts#L1), [follows migration](../../src/database/migrations/1710000002000-create-user-follows.ts#L1), [attachments migration](../../src/database/migrations/1710000003000-create-attachments.ts#L1), and [outbox migration](../../src/database/migrations/1710000001000-create-welcome-mail-outbox.ts#L1).
- Entities name tables explicitly and use snake-case database column names where needed. UUID identifiers, explicit `timestamptz`, unique keys, FK relations, and delete cascades are established. Nullable properties use explicit TypeORM types in `User`; a past `Object` metadata failure is recorded in the migration recovery journal. Evidence: [User entity](../../src/users/user.entity.ts#L9), [UserFollow entity](../../src/profiles/user-follow.entity.ts#L5), [Attachment entity](../../src/attachments/attachment.entity.ts#L12), and [recovery journal](../../docs/journals/260916-1215-users-migration-recovery.md#L16).
- Relation uniqueness is represented in the database: `user_follows` has a composite primary key and a self-follow check; `attachments` has a unique storage key and a nonnegative-size check. `ProfileService.follow()` relies on the pair constraint and `orIgnore()` to make repeated follow requests idempotent. Evidence: [follows migration](../../src/database/migrations/1710000002000-create-user-follows.ts#L5), [attachments migration](../../src/database/migrations/1710000003000-create-attachments.ts#L6), [Attachment entity](../../src/attachments/attachment.entity.ts#L17), and [ProfileService](../../src/profiles/profile.service.ts#L20).

### 2. Migration Order and Registration — EXTRACTED

- Registered migrations currently run in the explicit sequence `1710000000000` through `1710000003000`. Add a unique later migration class and add it to the explicit migration list in `data-source.ts`. Migration CLI scripts build the project and use that DataSource to run or revert migrations. Evidence: [DataSource registrations](../../src/database/data-source.ts#L8), [migration scripts](../../package.json), and the four [existing migration files](../../src/database/migrations/).
- The CLI DataSource explicitly lists entity classes and migrations and has `synchronize: false`. The Nest runtime instead uses `autoLoadEntities: true`, `synchronize: false`, and `migrationsRun: false`; feature modules add entities with `TypeOrmModule.forFeature`. These are separate registration paths. Evidence: [DataSource options](../../src/database/data-source.ts#L13), [DatabaseModule](../../src/database/database.module.ts#L7), [ProfilesModule](../../src/profiles/profiles.module.ts#L7), and [AttachmentsModule](../../src/attachments/attachments.module.ts#L8).
- Phase 04A is explicitly schema and shared serializers with no API. Keep it at that boundary: register schema classes for the migration CLI, but add no route/controller. Register repositories through a feature module when a later article API phase needs them. This preserves the planned API-per-PR split. Evidence: [Phase 04A scope and PR table](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L12).
- **INFERRED:** one migration file for the 4A foundation is the simplest fit for one schema-only PR. In `up`, create referenced parent tables before relation tables; in `down`, drop favorites and article-tag relations before articles and tags. Do not drop or alter `users`, `attachments`, or the shared `pgcrypto` extension. The Phase 04 rollback note explicitly protects users and attachments and requires joins-first teardown. Evidence: [Phase 04 rollback](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L63), [follows migration](../../src/database/migrations/1710000002000-create-user-follows.ts#L5), and [attachments migration](../../src/database/migrations/1710000003000-create-attachments.ts#L19).

### 3. Migration Test Coverage — EXTRACTED

- Existing migration unit tests use Vitest, mock `query`, call `up`/`down`, and assert SQL fragments or query order. The pattern is fast and consistent, but it does not validate SQL against PostgreSQL. Evidence: [users migration spec](../../src/database/migrations/1710000000000-create-users.spec.ts#L4), [outbox migration spec](../../src/database/migrations/1710000001000-create-welcome-mail-outbox.spec.ts#L5), and [attachments migration spec](../../src/database/migrations/1710000003000-create-attachments.spec.ts#L5).
- `user_follows` currently has no migration spec. `data-source.spec.ts` builds TypeORM metadata without connecting and asserts hard-coded entity and migration counts. Reset tests mock the `runMigrations` call. The existing database integration test opts in with `INTEGRATION_DATABASE_URL` and constructs a DataSource without migrations. Evidence: [migration file inventory](../../src/database/migrations/), [DataSource spec](../../src/database/data-source.spec.ts#L9), [reset spec](../../src/database/reset-database.spec.ts#L33), and [transaction integration spec](../../test/welcome-mail-outbox-transaction.integration.spec.ts#L9).
- A manual clean-database apply → revert → apply cycle was recorded for the earlier migration phase. The recovery journal documents a separate shared-database schema/history drift incident, so an existing table alone is not proof that migration history is correct. Evidence: [Phase 02 delivery record](../260910-0930-medium-clone-backend/phase-02-database-auth-background-jobs.md#L18), [recovery journal](../../docs/journals/260916-1215-users-migration-recovery.md#L10), and [Phase 04A required evidence](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L18).

### 4. Shared Serializer Style — EXTRACTED

- Serializers are exported pure functions with explicit interfaces and explicit object literals. They return the API envelope (`user` or `profile`) and select public fields instead of returning an entity. Tests assert the full output and prove `passwordHash` is absent. Evidence: [user serializer](../../src/users/user.serializer.ts#L1), [user serializer spec](../../src/users/user.serializer.spec.ts#L4), [profile serializer](../../src/profiles/profile.serializer.ts#L1), and [profile serializer spec](../../src/profiles/profile.serializer.spec.ts#L5).
- The article contract requires the list item to omit `body`, while detail and favorite responses include it. It also names `tagList`, timestamps, `favorited`, `favoritesCount`, and nested author fields. Evidence: [article contract list/detail](../../spec/api/hurl/articles.hurl#L45), [article detail/update contract](../../spec/api/hurl/articles.hurl#L145), and [favorite contract](../../spec/api/hurl/favorites.hurl#L28).
- **INFERRED:** use explicit article projection types and allowlist fields. Make list/detail body presence structural (for example, preview/detail response types), rather than serializing the entity or returning a property whose value is `undefined`. Share common projection logic only where it stays obvious.

## Trade-off Matrix and Ranked Call

| Rank  | Approach                                                                                                         | Performance                                   | Complexity                           | Maintenance                                                                | Operational cost and risk                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **1** | One handwritten, reversible migration for the 4A schema; explicit CLI registration; typed projection serializers | Direct PostgreSQL DDL; no runtime schema work | Lowest fit with current code         | Requires entity/DDL parity and registry updates; matches existing practice | One isolated apply/revert cycle; low adoption risk because no new dependency or pattern |
| 2     | Several migration files split by table/dependency                                                                | Same resulting database performance           | More ordering and registration steps | Finer rollback boundaries, but more files and specs to keep aligned        | Additional apply/revert cases; useful only if pieces must ship independently            |
| 3     | Runtime schema synchronization or unregistered implicit discovery                                                | No demonstrated query advantage               | Looks shorter initially              | Schema changes become harder to review and reproduce                       | Conflicts with both DataSource and runtime `synchronize: false`; high drift risk        |

**Recommendation:** choose rank 1. The schema, serializer, and rollback boundaries all belong to the planned 4A foundation; splitting them further adds migration sequence and test overhead without an independent deployment need. Use one migration with clear DDL order, and keep the rollback confined to 4A-owned tables.

## Adoption Risk and Architectural Fit

- **Library adoption risk: low.** TypeORM, PostgreSQL, Nest `TypeOrmModule`, Vitest, and manual migration scripts are already used. No new library or support surface is needed.
- **Schema change risk: medium.** Entity and migration metadata can drift, the `user_follows` migration has no unit spec, and no current automated test applies/reverts migrations on PostgreSQL. Reduce this risk with entity metadata assertions plus the required clean isolated apply/revert evidence.
- **Query/index risk: unresolved.** The later contract needs author, tag, favorited-user, feed, and stable `(createdAt DESC, id DESC)` access paths. A unique pair constraint is required for favorite idempotency; choose composite-key ordering and secondary indexes with the 4F/4H query shape. Avoid speculative indexes before that query path is settled. Evidence: [Phase 04 key insights and data flow](../260910-0930-medium-clone-backend/phase-04-articles-search-pagination.md#L12), [article filters](../../spec/api/hurl/articles.hurl#L63), and [favorite filters](../../spec/api/hurl/favorites.hurl#L60).
- **Serializer risk: low to medium.** Existing pure serializers and their allowlist tests are a close fit. The main contract trap is including `body` in list JSON or leaking persistence fields.

## Actionable Recommendations

1. Add the article, tag, article-tag, and favorite persistence classes that 4A needs; choose explicit database types for nullable fields.
2. Add a uniquely named later migration class to `data-source.ts`; create parents before foreign-key dependents and reverse that order in `down`.
3. Put database uniqueness/check/FK rules at the persistence boundary. For favorites, use a unique `(user_id, article_id)` pair; finalize index order with the planned 4F/4H repository queries.
4. Extend `data-source.spec.ts` to assert expected new classes/migrations and build metadata; avoid treating only a changed array length as proof of the right entries.
5. Add focused `up`/`down` SQL assertions. Then run migration apply → revert → apply against a clean isolated PostgreSQL database and attach the evidence required by Phase 04A. Do not infer clean history from a shared database's visible schema.
6. Implement typed allowlist serializers with list/detail projections; test exact envelopes, body omission/presence, and that internal fields stay absent.

## Limits and Unresolved Questions

- The current article/tag/favorite implementation does not exist, so exact SQL types, length limits, and relationship entity design must come from the accepted API/spec decisions rather than be copied from an existing Article entity.
- 4F/4H repository query shapes are not implemented yet; final composite-key ordering and query-specific indexes remain open.
- This report evaluates the repository's conventions, not current upstream TypeORM documentation or external Postgres benchmarks. No external library comparison was in scope.
