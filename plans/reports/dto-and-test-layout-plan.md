---
title: 'Centralize DTOs and relocate source tests'
description: 'Move DTOs to src/common/dto and existing source specs to test/unit while retaining runtime and test behavior.'
status: completed
priority: P2
effort: 1h
branch: master
tags: [refactor, dto, tests]
created: 2026-10-07
work_type: deliverable
---

# DTO and test layout blueprint

## Baseline and scope

Working tree was clean at inspection. Both discovered backend/auth plans were completed; there was no open dependency to update. This is a structural refactor with no API, schema, or DTO decorator changes. The private-file integration assertion was aligned with the existing `StreamableFile` return contract after its suite exposed the stale POJO expectation.

All 44 `src/**/*.spec.ts` files are Vitest tests. One carries an integration suffix; preserve its suffix and execution behavior. Five DTO sources remain outside `src/common/dto`; `user-auth.dto.ts` is already centralized.

## Architecture and compatibility

Request → existing controller imports centralized DTO → unchanged validation/transformation → existing service/serializer. Unit tests in `test/unit/<original src-relative path>` import production files from `src`, retaining `.js` ESM specifiers. DTO specs mirror the resulting DTO location under `test/unit/common/dto`. The `api-exception.integration.spec.ts` remains under `test/integration/common/filters` and matches the existing integration glob. No aliases or barrels are needed.

Keep `test/setup/test-database.ts` unchanged: it loads the existing environment and selects TEST_DATABASE_URL. Existing special migration/private-file/E2E runners retain their include globs. Production tsconfig already includes only `src` and excludes `test`/specs; do not change it unnecessarily.

## Phase 1 — DTO movement

Dependency: baseline captured. Owner: DTO/source import implementer.

- [x] Move `article-create.dto.ts`, `article-update.dto.ts`, `article-list.dto.ts`, `article-pagination.dto.ts`, and `comment-create.dto.ts` into `src/common/dto`.
- [x] Update all production/test imports and relevant maintained source-path documentation. Preserve relative sibling pagination import and `.js` extensions.
- [x] Leave DTO logic, class names, metadata and public response schemas unchanged.

Risk: medium likelihood/high impact from stale runtime imports; mitigate by source import audit and production build before phase 2. Rollback: reverse only this phase's renames/import edits, retaining unrelated changes.

## Phase 2 — Spec movement and runner discovery

Dependency: phase 1 complete. Owner: test/config implementer, sequential after phase 1 because test imports overlap.

- [x] Move all 44 source specs into `test`: 43 unit specs under `test/unit`, mirroring module folders; the integration spec under `test/integration/common/filters`. DTO specs mirror `common/dto`.
- [x] Resolve every relative import from its original absolute target to its new relative path; retain `.js` ESM suffixes and test helper relationships.
- [x] Update the package fixture in `runtime-start-scripts.spec.ts`: `new URL('../../package.json', import.meta.url)` from the new `test/unit` location.
- [x] Change main Vitest includes to `['test/unit/**/*.spec.ts', 'test/**/*.integration.spec.ts']`. Vitest deduplicates matches; preserve existing test integration discovery.
- [x] Retain shared setup, alias plugin, specialized config globs, and build excludes.

Risk: high likelihood/medium impact from silent discovery loss or broken relative fixture paths. Compare discovered test file counts before/after; run all existing specs. Rollback: reverse relocations and main Vitest include change as one unit.

## Scope Contract and validation

Changed — DTO file paths, imports, source spec paths, fixture path, main Vitest discovery.
Impacted — production compilation/Swagger decorator imports, every relocated spec, shared test setup/discovery.
Will verify — build and full main Vitest suite; E2E plus existing migration/private-file suites because imports cover authentication, configuration, and migration modules; existing tests suffice, no new tests.
Deliberately skipped — video rendering, database reset, new assertions and unrelated performance/coverage sweeps; none verifies file relocation.

Commands, in order:

1. Capture `git status --short`; enumerate original source specs (44) and DTO sources (6 total).
2. `pnpm build`.
3. `pnpm exec vitest list --filesOnly` and compare original/main runner discovery count (including unchanged external integration specs).
4. `pnpm test`.
5. `pnpm test:e2e`, `pnpm test:migrations`, `pnpm test:private-files`, sequential to avoid shared database races; setup must select TEST_DATABASE_URL. Do not print environment values.
6. `pnpm lint`; changed-path formatting check for DTOs/tests/config. Review diff for accidental logic changes.

Completion: no source specs remain; all six DTO sources reside in common/dto; Vitest discovers 51 suites. `pnpm build` passed. `pnpm test` passed (50 files, 231 passed, 1 skipped); E2E passed (31 files, 112 tests); migrations passed (1 test); private-file boundary passed (1 test) after aligning its stale assertion to the existing `StreamableFile` contract. `pnpm lint` passed with 0 errors and heuristic warnings; scoped Prettier checks passed for `package.json`, `vitest.config.ts`, centralized DTOs, and the adjusted integration assertion. A repository-wide Prettier check reported style findings in 54 files, so unrelated files were left untouched. Reviewer completed with no findings. No commit or push is authorized by this request.

## Handoff

Apply through the controller's implementation workflow. If executed in a separate session: `/tkm:takumi /home/phamvanhung/projects/nestjs-tutorial/plans/reports/dto-and-test-layout-plan.md`.
