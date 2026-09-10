# Security Adversary Review

## Finding 1: Public credential endpoints have no abuse control
- **Severity:** High
- **Location:** Phase 02, section "Security Considerations"
- **Flaw:** The plan explicitly leaves rate limiting out of scope, although it adds public registration and password-verification endpoints. No compensating account/IP throttling, response-delay, or operational control is specified or tested.
- **Failure scenario:** An attacker parallelizes requests to `/api/users/login`; each wrong password causes an Argon2 verification, enabling credential stuffing and CPU exhaustion. The same actor can create unbounded accounts through `/api/users`.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-02-auth-users-profiles.md:60` excludes rate limiting; `spec/api/openapi.yml:22-37` and `39-54` expose login and registration without security; `spec/api/hurl/errors_auth.hurl:103-113` tests only one failed login.
- **Suggested fix:** Define a deployable throttle policy for login and registration (keying, window, limit, 429 envelope, proxy trust), make it environment-configurable, and add deterministic integration tests.

## Finding 2: Unbounded attacker-controlled payloads and collections are accepted into expensive paths
- **Severity:** High
- **Location:** Phase 01, section "Implementation Steps"; Phase 03, section "Implementation Steps"
- **Flaw:** The plan says to validate wrappers and numeric query bounds but sets no maximum request-body size, field lengths, tag count, tag length, or pagination ceiling. The contract itself supplies only minimum values for pagination and unbounded strings/arrays.
- **Failure scenario:** A client submits a huge password to the public login/register endpoint, or an article with thousands of long tags. The service allocates/parses the body, runs costly Argon2 work or performs a large transactional tag replacement, consuming CPU, memory, DB connections, and index space.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-01-foundation-data.md:42` specifies only generic pipe options; `plans/260910-0930-medium-clone-backend/phase-03-articles-tags-listing.md:35-39` has no maxima; `spec/api/openapi.yml:579-605` defines article strings and `tagList` with no `maxLength`/`maxItems`; `spec/api/openapi.yml:895-911` gives offset/limit only `minimum` bounds.
- **Suggested fix:** Set body-parser limit; add documented DTO/database maxima for every persisted string and collection; cap `limit` and offset/work budget; add 422 tests at each boundary.

## Finding 3: Password hashing strength and resource cost are left to library defaults
- **Severity:** High
- **Location:** Phase 02, sections "Requirements" and "Implementation Steps"
- **Flaw:** “Argon2id” is named but no memory, time, parallelism, version, or maximum-password-length policy is locked into configuration or acceptance tests. This allows an implementation to inherit weak defaults or to be tuned independently across environments.
- **Failure scenario:** A production deployment uses a low-cost default, so a leaked hash database is materially cheaper to crack; raising cost ad hoc later can instead turn public login into a denial-of-service vector. The test contract only proves that 8- and 64-character values work.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-02-auth-users-profiles.md:20,38-40` requires only Argon2id/hash-once; `spec/api/hurl/errors_auth.hurl:172-224` defines password length behavior but never hash parameters; `spec/api/openapi.yml:462-480` gives password only `type`/`format`, with no bounds or cost policy.
- **Suggested fix:** Version and configure Argon2id parameters centrally, benchmark the production target, enforce an upper input limit before hashing, and assert the stored encoded hash parameters in an integration test.

## Finding 4: JWT validation semantics are acknowledged but never resolved into a required security contract
- **Severity:** High
- **Location:** Phase 02, section "Risk Assessment"; Phase 05, section "Implementation Steps"
- **Flaw:** The plan admits that a malformed optional token may be treated as anonymous, then says to “decide/document” it. It does not choose the outcome, add it to success criteria, or specify tests for forged, expired, wrong issuer/audience, or wrong-algorithm tokens on protected routes.
- **Failure scenario:** A permissive optional guard silently drops invalid credentials. The same shared parser can later be reused incorrectly by a protected route, converting a token-validation defect into an authorization bypass; no acceptance test catches it because Hurl only checks missing credentials.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-02-auth-users-profiles.md:54-60` leaves the behavior undecided; `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:14-16,35-38` has no token-forgery/expiry test case; `spec/api/hurl/errors_auth.hurl:115-130` tests missing Authorization only; `spec/api/openapi.yml:912-921` requires a valid JWT in the `Authorization` header.
- **Suggested fix:** Require invalid or malformed credentials to produce the exact 401 envelope on every route where supplied, define optional-auth behavior explicitly, and add fixtures for malformed, expired, bad-signature, wrong issuer/audience, and `alg` mismatch tokens.

## Finding 5: JWT secret policy and rotation/revocation are absent, making token theft durable
- **Severity:** Medium
- **Location:** Phase 01, section "Implementation Steps"; Phase 02, sections "Requirements" and "Security Considerations"
- **Flaw:** The plan checks only that a production secret exists, signs stateless tokens with `sub` and an unspecified expiry, and declares logout client-side. It specifies neither minimum secret entropy nor token TTL, key rotation, nor a server-side invalidation point after a password change/compromise.
- **Failure scenario:** A weak but nonempty secret is deployed or a token is stolen. The attacker retains access until an unspecified expiry, including after the user changes password; client-side logout has no effect on the stolen bearer token.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-01-foundation-data.md:39-43` requires presence but no quality/rotation policy; `plans/260910-0930-medium-clone-backend/phase-02-auth-users-profiles.md:20,40,60` names `sub`/expiry and intentionally omits refresh handling; `plans/260910-0930-medium-clone-backend/plan.md:20` defines logout as client-side removal; `spec/api/hurl/auth.hurl:216-245` reissues a token after identity changes but never proves the old token is rejected.
- **Suggested fix:** Define a short access-token TTL, minimum random-secret entropy and rotation procedure; introduce a user token-version/session-invalid-after check and invalidate existing tokens on password/security changes, with regression tests for old-token rejection.

**Status:** DONE_WITH_CONCERNS
**Summary:** Five material security gaps were found in the implementation plan, centered on public-endpoint abuse, unbounded resource use, and incomplete JWT controls.
**Concerns/Blockers:** Address Findings 1–4 before calling the backend security-ready; Finding 5 needs an explicit product/security decision.
