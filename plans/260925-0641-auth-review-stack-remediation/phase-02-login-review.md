# Phase 2 — PR #35 login feedback

## Context and ownership

Priority P2, pending, 2.5h; depends on Phase 1 baseline. Own `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/auth.module.ts`, `src/auth/auth-login-rate-limiter.ts`, focused auth constants/interfaces files, and their directly affected tests on `phase-02-login`. No concurrent Phase 3 edits to shared auth files.

## Requirements and design

- Move login orchestration (rate limit, credential validation, token issuance) into AuthService behind a request-independent API; controller retains DTO/HTTP handling, redacted failure logging, status mapping, and response serialization. Preserve registration behavior and the existing login response/errors.
- The string at `auth.service.ts` around line 70 is the fixed Argon2 dummy hash for missing accounts, not a JWT. Extract it to a module-specific password-verifier constant/helper while keeping the unknown-user verification work. Extract narrow interfaces used by login/rate limiting where they improve readability; avoid a general abstraction layer.
- Move rate-limit parameters and Lua script from `auth-login-rate-limiter.ts` to module-specific constants. Replace the line-44 literal key count with a named constant or the actual key-array length. Preserve email and IP keys, window, threshold, Redis connection failure behavior, and PEXPIRE atomicity.
- Wire new service collaborators explicitly in `auth.module.ts`. Never pass the raw HTTP Request, password, or token into logs.

## Verification and risk

Unit: valid/invalid credentials, unknown-account dummy verification, first five allowed/sixth blocked by either key, Redis failure, token-sign failure. Integration/e2e: unchanged login 200, 401, 429, 500 shape and Cache-Control; registration still works. High risk: rate limiting or token failure could change HTTP mapping; retain typed errors and run focused tests plus build. Done when four #35 threads each map to a small diff and targeted tests pass. Roll back the fix commit, then repropagate descendants, if the contract changes.
