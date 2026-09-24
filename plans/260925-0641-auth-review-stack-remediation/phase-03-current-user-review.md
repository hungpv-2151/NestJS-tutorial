# Phase 3 — PR #36 current-user feedback

## Context and ownership

Priority P2, pending, 1.5h; starts after Phase 2 is rebased into `phase-02-current-user`. Own `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/auth.module.ts`, `src/users/user.service.ts` only if its contract must change, and directly affected specs/e2e tests on the #36 branch. These shared auth files are sequentially owned after Phase 2.

## Requirements and design

Move current-user lookup and missing-user decision from the controller into AuthService, using the existing UserService collaborator. Keep guard token validation and HTTP serialization in the controller. Return a typed invalid-token error for a deleted/missing user and map it to the existing 401 body. Keep the supplied bearer token in the response; do not mint another. No change for #37's future logging comment.

## Verification and risk

Unit: user found, user missing, lookup failure. E2E: valid token returns identical user body, missing/invalid token and deleted user return existing 401 contract. High risk: service injection changes can break the guard/test module; update providers and run build, focused unit, and current-user e2e tests. Done when #36 review request is satisfied without changing `GET /api/user` externally. Revert only the #36 fix commit and replay later branches if needed.
