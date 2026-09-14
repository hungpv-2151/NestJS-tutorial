# Phase 01 — Foundation and data model

## Context Links

- [OpenAPI](../../spec/api/openapi.yml) · [stack research](../reports/researcher-260910-0930-medium-backend-stack.md) · [contract risks](../reports/researcher-260910-0930-api-contract-risks.md)

## Overview

- Priority: P1 · Status: Pending
- Replace the starter-only app with configuration, database access, migrations and contract-wide HTTP error/validation foundations.

## Key Insights

- PostgreSQL relations/constraints are needed for favorites, follows, tags, feed and ownership.
- Hurl requires `{ errors: { field: string[] } }`, exact 401/403/404/409/422 behavior, and `Token`, not Bearer.

## Requirements

- Add PostgreSQL/Prisma, migrations, environment validation, Argon2/JWT/DTO dependencies and a test database path.
- Persist users, articles, comments, tags, ordered article-tags, follows and favorites with timestamps/FKs.
- Apply global prefix `/api`, validation and exception mapping without exposing ORM errors.

## Architecture

`request → global pipe/filter → controller → domain service → Prisma transaction → serializer → contract JSON`.
Schema constraints: unique email/username/slug; unique follow/favorite/article-tag joins; tag join has `position`; cascade only dependent article/comment/join data. Index newest articles by `createdAt DESC, id DESC`, author+time, comments by article, and relation lookups.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json` — approved runtime/dev dependencies and scripts.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/main.ts` — prefix, global pipe/filter, shutdown.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts` — root module wiring; retire starter controller/service only when replacements exist.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/prisma/schema.prisma` and `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/prisma/migrations/*` — versioned schema.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/prisma.service.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/common/filters/api-exception.filter.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/common/dto/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/config/*` — each focused below 200 LOC.
- Delete: starter `src/app.controller.ts`, `src/app.service.ts`, and their unit test after health/feature coverage replaces them.

## Implementation Steps

1. Add pinned, compatible package versions; document `DATABASE_URL`, 256-bit random `JWT_SECRET`, issuer/audience and test DB variables in an example file without secrets.
2. Model tables, FKs, unique composites and indexes; generate a reviewed migration, never use production schema push.
3. Configure Prisma lifecycle and Nest Config validation; fail boot for missing production secrets/DB URL.
4. Add request-wrapper DTO helpers and `ValidationPipe` (transform query, strip unknown fields but do not reject them because OpenAPI permits additional fields) plus one filter mapping validation, conflict, forbidden and absent resources to API errors.
5. Configure explicit body-size limits, field/array maxima, capped `limit`/offset work budget, and a public readiness endpoint; over-bound values return the established 422 envelope.
6. Extract reusable HTTP bootstrap configuration (prefix, pipes, filter, config) for `main.ts` and E2E setup; configure graceful Prisma disconnect.

## Todo List

- [ ] Schema and migration reviewed against every relation.
- [ ] Runtime config has no committed secret.
- [ ] Error and validation contract has unit coverage.
- [ ] `pnpm run build` and `pnpm run lint` pass.

## Success Criteria

- Fresh PostgreSQL database migrates reproducibly; invalid request payload returns 422 contract JSON.
- Unique/index constraints support later services; generated client compiles under NodeNext ESM.

## Risk Assessment

- Prisma/Nest ESM generation mismatch → prove compilation in this phase.
- Wrong cascade/index → review migration SQL and test deletion/EXPLAIN fixtures before relying on it.

## Security Considerations

- Secrets stay env/runtime-store only. Parameters are ORM-bound; error output never includes stack traces/database details.

## Next Steps

- Phase 02 owns auth/users/profile modules on this schema.
