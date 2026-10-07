# Phase 04K — Get Tags API

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md)
- [OpenAPI](../../spec/api/openapi.yml)
- [Tags contract](../../spec/api/hurl/tags.hurl)

## Overview

- Priority: P1 · Status: Submitted, ready, open and unmerged as PR #59 · Dependency: 4J PR #58
- Add only public `GET /api/tags` above PR #58. No migration or write route.

## Key Insights

- The `tags` table and `Tag` entity already exist; the endpoint only reads tag names.
- Hurl requires `{ tags: string[] }` and public access. The phase contract also requires stable ordering.

## Requirements

- Return every tag name in `{ tags: [...] }`, sorted ascending by name.
- Require no authentication and expose the response in generated Swagger docs.
- Do not add routes or modify article/tag persistence behavior.

## Architecture

`GET /api/tags → TagsController → TagsService → Tag repository (name ASC) → { tags }`.

## Related Code Files

- Modify: `src/app.module.ts`, `spec/api/openapi.yml`.
- Create: `src/tags/tags.controller.ts`, `src/tags/tags.module.ts`, `src/tags/tags.service.ts`, `src/tags/tags.swagger.ts`, `test/get-tags.e2e-spec.ts`.
- No schema or migration changes.

## Implementation Steps

1. Confirm clean stack tip and PR #58 base; record the missing-route RED.
2. Implement the public route and name-only ordered query.
3. Verify envelope, ordering, no-auth behavior, and generated OpenAPI contract against PostgreSQL test DB.
4. Run build, unit and E2E suites, lint, formatting, static OpenAPI validation, line-count and diff checks. (Passed locally; see Validation Record.)
5. Obtain independent review and add validation evidence. (Review verdict SEALED; evidence artifacts recorded.)
6. Submit as a ready PR directly above #58 and add the required PR validation comment. (Complete; see [current-head evidence](https://github.com/hungpv-2151/NestJS-tutorial/pull/59#issuecomment-5904391942).)

## Todo List

- [x] Confirm #58 is the clean, open stack tip; branch from it.
- [x] Record missing-route RED (HTTP 404).
- [x] Implement GET-only tags endpoint and focused E2E contract.
- [x] Pass full unit and E2E suites, build, lint, focused static analysis, OpenAPI parse, formatting, and diff checks.
- [x] Obtain independent review and record evidence artifacts.
- [x] Submit ready API PR #59 on the current stack; keep it open and unmerged for review.

## Validation Record

- `pnpm test`: passed on current head — 43 files passed, 1 skipped; 191 tests passed, 1 skipped.
- `pnpm test:e2e`: passed on current head — 25 files; 98 tests passed.
- `pnpm build`: passed on current head.
- `pnpm lint`: passed on current head with 0 errors and 258 warnings.
- `pnpm exec sunlint --all --input=src/tags`: passed with 0 warnings.
- Static `spec/api/openapi.yml` parse and route check: passed.
- Prettier check for changed TypeScript, Markdown, and JSON files: passed. Whole-file OpenAPI formatting check reports pre-existing formatting differences in the unchanged baseline.
- `git diff --check`: passed.
- Independent review: SEALED; no open correctness or security findings.
- Test raw results, normalized temper results, study context, and inspection verdict are stored under [`evidence/phase-04k`](./evidence/phase-04k/).
- PR #59 is OPEN, ready, CLEAN, and based directly on #58. Current head: `78cc953ea83b5ff4dae64e297127e141892f9ac1`; GitHub Static analysis: SUCCESS. Validation comment: https://github.com/hungpv-2151/NestJS-tutorial/pull/59#issuecomment-5904391942. Response screenshot is stored in `evidence/phase-04k/get-tags-response.png`.

## Success Criteria

- Anonymous `GET /api/tags` returns all stored tag names in stable ascending order.
- Generated Swagger advertises the required `tags` array and no auth requirement.
- No production code file exceeds 200 lines; production diff remains under 400 changed lines.

## Risk Assessment

- Unstable results from unordered database reads → explicitly order by tag name and assert order in PostgreSQL E2E.

## Security Considerations

- Return only public tag names; never serialize tag entities or internal IDs.

## Next Steps

- Continue from the existing Phase 5A comment schema PR #60, stacked above #59; Phase 4 remains in progress until #47–#59 are merged.
