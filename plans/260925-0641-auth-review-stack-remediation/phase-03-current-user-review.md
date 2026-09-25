# Phase 3 — PR #36 current-user feedback

## Context and ownership

Priority P2, verified complete, 1.5h; starts after Phase 2 in `phase-02-current-user`. Existing implementation commit `b71cab5` owns `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/auth.module.ts`, `src/users/user.service.ts`, and directly affected specs/E2E tests. Do not duplicate this change.

## Requirements and design

Move current-user lookup and missing-user decision from the controller into AuthService, using the existing UserService collaborator. Keep guard token validation and HTTP serialization in the controller. Return a typed invalid-token error for a deleted/missing user and map it to the existing 401 body. Keep the supplied bearer token in the response; do not mint another. No change for #37's future logging comment.

## Verification and risk

Unit and E2E coverage maps the resolved #36 thread to `b71cab5`: `AuthService.currentUser()` owns lookup and missing-user errors; controller retains the presented token and existing 401 body. On stack snapshot `a6a17f2`, focused auth tests passed 29/29, current-user/register E2E passed 10/10, full unit passed 110 with 1 skipped, full E2E passed 30/30, build passed, and lint reported 0 errors/119 warnings. Existing #36 thread is resolved; commit-linked reply awaits inspection and final stack validation.
