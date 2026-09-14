---
title: "Medium clone backend implementation"
description: "Implement the NestJS RealWorld API contract with PostgreSQL persistence and JWT authentication."
status: completed
priority: P1
effort: 52h
branch: master
tags: [feature, backend, database, api, auth]
blockedBy: []
blocks: []
work_type: feature
spec_waived: "SDD mode disabled (takumi.sddMode: off)"
created: 2026-09-10
---

# Medium Clone Backend Implementation Plan

## Overview

Implement only the NestJS API required by `spec/api`: users/JWT, profiles/follows, articles/tags, comments, favorites, global/feed listing and pagination. PostgreSQL + Prisma is the persistence baseline; Hurl is the HTTP acceptance source. Figma and client pages are outside this backend plan; logout means client-side token removal because the contract has no logout route.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Foundation and data model](./phase-01-foundation-data.md) | Complete |
| 2 | [Authentication, users and profiles](./phase-02-auth-users-profiles.md) | Complete |
| 3 | [Articles, tags and listing](./phase-03-articles-tags-listing.md) | Complete |
| 4 | [Social actions, comments and feed](./phase-04-social-comments-feed.md) | Complete |
| 5 | [Contract tests and readiness](./phase-05-contract-testing-readiness.md) | Complete |

## Dependencies

- 1 unblocks every feature phase; its schema/migrations are the single data contract.
- 2 provides identity and serializers used by 3–4.
- 3 provides article lookup/serialization used by 4.
- 5 validates the final integrated application; no phase is complete until its relevant Hurl group passes.

## Execution Rules

- Keep controllers thin, DTOs/request wrappers explicit, service authorization server-side, and serializing centralized.
- `Authorization` accepts exactly `Token <jwt>`; public reads use optional authentication and protected actions require it.
- Use database uniqueness and transactions as the concurrency authority. Never log passwords, hashes, JWTs, or secrets.
- Supplied malformed, expired, forged, wrong-issuer/audience, or wrong-algorithm tokens return 401. An absent token on a public read stays anonymous.
- Future implementation updates `docs/development-roadmap.md`, `docs/project-changelog.md`, `docs/system-architecture.md`, and `docs/code-standards.md` after verified delivery.

## Delivery Status

- Phase 01 complete on 2026-09-10. Evidence: [tester final retest](../reports/tester-260910-1629-phase01-final.md) and [reviewer final review](../reports/reviewer-260910-1629-phase01-final.md).
- Phase 02 complete on 2026-09-11. Evidence: [tester report](../reports/tester-260910-1629-phase02.md) and [final remediation review](../reports/reviewer-260910-1629-phase02.md).
- Phase 03 complete on 2026-09-11. Evidence: [tester report](../reports/tester-260911-0658-phase03.md) and [final remediation review](../reports/reviewer-260911-0658-phase03.md).
- Phase 04 complete on 2026-09-11. Evidence: [tester report](../reports/tester-260911-0935-phase04.md) and [final remediation review](../reports/reviewer-260911-0957-phase04.md).
- Phase 05 complete on 2026-09-11. Evidence: [tester report](../reports/tester-260911-1136-phase05.md) and [final lifecycle review](../reports/reviewer-260911-1136-phase05.md). Build, lint, unit, live API E2E, and the full sequential Hurl contract suite passed; the reviewer addendum closed the runner lifecycle blocker.
- Overall plan complete on 2026-09-11. All five phases are complete and the final contract gates are recorded in Phase 05. Browser Playwright execution remains intentionally outside this API plan.

### Final contract decisions

- Hurl acceptance passed 13/13 files and 154/154 requests after a visible transient Prisma P1002 advisory-lock timeout on the first attempt; the retry passed against the dedicated migrated test database.
- Token invalidation after password update remains a live E2E regression in `test/auth.e2e-spec.ts`; no duplicate Hurl fixture was added because Hurl remains the published contract suite while stateful token-version behavior is covered by the API E2E suite.
- The contract runner now handles early child exit/error, readiness failure, normal completion, and SIGINT/SIGTERM cleanup idempotently. No unresolved Phase 05 blocker remains.

## Red Team Review

### Session — 2026-09-10
**Findings:** 12 (12 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 9 High, 2 Medium
- Auth/resource/JWT controls → Phases 01, 02, 05; pagination/slug → 03, 04, 05; social race → 04; Hurl/docs/E2E bootstrap/paths → 01, 05.
- Reconciliation: plan.md + phases 01–05 reread; 12 deltas, 9 stale references reconciled, 0 contradictions.

## Validation Log

### Session 1 — 2026-09-10
**Trigger:** User approved all red-team recommendations. **Questions asked:** 0
**Verification:** 12/14 grounded; Prisma schema and HTTP bootstrap are planned Phase 01 paths, not starter-code claims.
**Decisions:** PostgreSQL/Prisma; malformed supplied JWT → 401, absent public token → anonymous; HS256/15-min/token-version/256-bit secret; resource/throttle bounds; stable offset order; origin-only readiness-gated Hurl.
**Action:** Implement Phases 01–05; validate future paths with code evidence. No new dependency or contradiction.
