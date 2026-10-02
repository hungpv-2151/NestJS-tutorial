# Phase 2 — PR #35 login feedback

## Context and ownership

Priority P2, verified complete, 2.5h; depends on Phase 1 baseline. The review fixes already exist on `phase-02-login` in commit `336c78c`; do not duplicate them. Verify the contract and focused tests. The commit owns `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/auth.module.ts`, `src/auth/auth-login-rate-limiter.ts`, focused auth constants/interfaces files, and their directly affected tests. No concurrent Phase 3 edits to shared auth files.

## Requirements and design

- Move login orchestration (rate limit, credential validation, token issuance) into AuthService behind a request-independent API; controller retains DTO/HTTP handling, redacted failure logging, status mapping, and response serialization. Preserve registration behavior and the existing login response/errors.
- The string at `auth.service.ts` around line 70 is the fixed Argon2 dummy hash for missing accounts, not a JWT. Extract it to a module-specific password-verifier constant/helper while keeping the unknown-user verification work. Extract narrow interfaces used by login/rate limiting where they improve readability; avoid a general abstraction layer.
- Move rate-limit parameters and Lua script from `auth-login-rate-limiter.ts` to module-specific constants. Replace the line-44 literal key count with a named constant or the actual key-array length. Preserve email and IP keys, window, threshold, Redis connection failure behavior, and PEXPIRE atomicity.
- Wire new service collaborators explicitly in `auth.module.ts`. Never pass the raw HTTP Request, password, or token into logs.

## Verification and risk

Unit and E2E coverage maps all four #35 threads to `336c78c`: login orchestration delegates to `AuthService`; unknown-account Argon2 verification uses the password-verifier helper and fixed hash; limiter parameters/script use a focused constants module; Redis key count comes from `keys.length`. On stack snapshot `a6a17f2`, focused auth tests passed 29/29, relevant E2E 10/10, full unit 110 passed/1 skipped, full E2E 30/30, build passed, and lint reported 0 errors/119 warnings. Existing #35 threads are resolved. Commit-linked replies await inspection and final stack validation.
