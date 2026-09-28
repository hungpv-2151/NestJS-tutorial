# Phase 04K — Get Tags API

## Context Links

- [Phase 04 stack](./phase-04-articles-search-pagination.md)
- [OpenAPI](../../spec/api/openapi.yml)
- [Tags contract](../../spec/api/hurl/tags.hurl)

## Overview

- Priority: P1 · Status: In progress · Dependency: 4J PR #58 · Local implementation and checks pass; PR submission pending
- Add only public `GET /api/tags` on a new branch above PR #58. No migration or write route.

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
6. Submit as a ready PR directly above #58 and add the required PR validation comment. (Pending.)

## Todo List

- [x] Confirm #58 is the clean, open stack tip; branch from it.
- [x] Record missing-route RED (HTTP 404).
- [x] Implement GET-only tags endpoint and focused E2E contract.
- [x] Pass full unit and E2E suites, build, lint, focused static analysis, OpenAPI parse, formatting, and diff checks.
- [x] Obtain independent review and record evidence artifacts.
- [ ] Submit the ready API PR on the current stack.

## Validation Record

- `pnpm test`: passed — 43 files; 193 passed, 1 skipped.
- `pnpm test:e2e`: passed — 25 files; 98 passed.
- `pnpm build`: passed.
- `pnpm lint`: passed with 267 warnings and 0 errors.
- `pnpm exec sunlint --all --input=src/tags`: passed with 0 warnings.
- Static `spec/api/openapi.yml` parse and route check: passed.
- Prettier check for changed TypeScript, Markdown, and JSON files: passed. Whole-file OpenAPI formatting check reports pre-existing formatting differences in the unchanged baseline.
- `git diff --check`: passed.
- Independent review: SEALED; no open correctness or security findings.
- Test raw results, normalized temper results, study context, and inspection verdict are stored under [`evidence/phase-04k`](./evidence/phase-04k/).
- PR URL, commit SHA, validation comment, and response screenshot: pending PR submission.

## Success Criteria

- Anonymous `GET /api/tags` returns all stored tag names in stable ascending order.
- Generated Swagger advertises the required `tags` array and no auth requirement.
- No production code file exceeds 200 lines; production diff remains under 400 changed lines.

## Risk Assessment

- Unstable results from unordered database reads → explicitly order by tag name and assert order in PostgreSQL E2E.

## Security Considerations

- Return only public tag names; never serialize tag entities or internal IDs.

## Next Steps

- After submitting 4K, continue to Phase 5A comment schema foundation, then one PR per comment API.
