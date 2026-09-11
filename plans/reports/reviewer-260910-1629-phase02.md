## Review Summary

### Scope

- Files reviewed: Phase 02 plan, final tester report, DTO/DI debugger reports, auth/users/profiles implementation, module graph, live E2E tests and OpenAPI/Hurl error contracts.
- Depth: final implementation review.

### Assessment

JWT verification, password hashing, token-version invalidation, serializer boundaries, test-DB isolation and Prisma module ownership are materially correct. Build and targeted/live E2E checks pass. Two reachable boundary failures remain, so **Phase 03 should not start** until they are fixed and retested.

### Critical

None.

### High

1. **Missing or empty request wrappers bypass validation and return the wrong outcome** — `src/users/user.dto.ts:8,10,18`, `src/users/users.controller.ts:13-16`. `@ValidateNested()` does not require `user`; `{}` passes the pipe and `body.user.email` throws, which the global filter emits as a 500. `PUT /user` with `{ "user": {} }` reaches `UsersService.update()` and returns an unchanged user rather than the OpenAPI-required 422 for an update with no fields. Require the wrapper (`@IsDefined()` plus nested validation) and require a non-empty update object; add HTTP tests for missing `user`, `null` `user`, and empty update fields.

2. **Authentication throttle is bypassable and its in-memory state is unbounded** — `src/auth/auth-throttle.service.ts:6-16`, `src/users/users.controller.ts:13-14`. Keys combine IP and account/email, so an attacker can submit a new email on every registration/login attempt and never reach the per-key limit. Expired entries are also retained unless the exact key is reused, so the same traffic grows `attempts` indefinitely. There is no explicit trusted-proxy policy although the route trusts `request.ip`. Enforce independently bounded client and account limits, evict expired entries/cap cardinality (or use a shared rate-limit store), and configure/document the proxy trust boundary. Add adversarial tests with many distinct accounts from one client.

### Medium

1. **Argon2 parameters are not centrally configured/versioned as planned** — `src/users/users.service.ts:18`. The selected Argon2id parameters are reasonable, but they are embedded in the service and carry no policy/version identifier or benchmark documentation. Move the policy to a single configuration/constants module and document its benchmark/upgrade path before the parameters spread to future services.

### Low

None.

### Edge Cases Turned Up

- Required and optional guards correctly distinguish an absent optional token from a supplied malformed token; malformed `Bearer` input gets 401 rather than anonymous access.
- Verification pins HS256, issuer, audience and expiry, then checks database token version; password change invalidates the old token.
- Nullable profile fields preserve absent versus null/empty normalization for the tested settings paths.

### Done Well

- `DatabaseModule` correctly exports Prisma to each consumer module, resolving the prior Nest DI fault without making persistence global.
- User/profile serializers do not expose password hashes; profile lookup returns the specified 404 envelope.
- Auth E2E uses the dedicated test database, generates scoped data and cleans up by its own username prefix.

### Actions In Order

1. Make request wrappers and the update object mandatory/non-empty; add the missing HTTP boundary tests.
2. Replace the throttle's combined, unbounded in-memory key strategy with bounded independent account/client enforcement and an explicit proxy policy.
3. Extract/document the Argon2id policy, then re-run targeted tests, live E2E, build and lint.

### Numbers

- Build: pass.
- Focused tests: 8/8 pass.
- Live Phase 02 E2E: 9/9 pass.
- Lint: 0 errors, 23 warnings.

### Still Unresolved

- The two High findings above are untested reachable inputs and block Phase 03.
- The default Vitest Playwright discovery issue remains Phase 05 scope.

**Status:** DONE_WITH_CONCERNS
**Summary:** Auth contracts are largely sound, but malformed/empty DTO wrappers and bypassable, unbounded throttling must be fixed before Phase 03.
**Concerns/Blockers:** Phase 03 is blocked on the two High findings.

---

## Final Remediation Addendum — 2026-09-11

### Scope

- Read final tester evidence and inspected the remediated wrapper DTOs, throttler/proxy boundary, Argon2id policy, JWT service, users controller/service, and live E2E tests.

### Assessment

The prior blockers are resolved. **Phase 03 can begin.**

### Current Findings

None actionable for Phase 02.

### Verification

- Wrapper DTOs require `user`; update also rejects a null or empty wrapper. The controller has a defensive empty-fields check. Live E2E covers missing/null wrappers and `{ user: {} }` with 422 responses.
- Throttling independently records client and account scopes, evicts expired entries, caps in-memory state, and derives the client key from the direct TCP peer rather than forwarded headers. This is an explicit no-proxy-trust boundary that avoids spoofed forwarding headers.
- Argon2id options and policy version are centralized in `src/auth/password-policy.ts`; user hashing consumes that one policy.
- Token parsing remains exact `Token <JWT>` syntax; verification pins HS256, issuer and audience, honours expiry, and rejects stale token versions. Password-change E2E confirms old-token invalidation.
- Tester evidence: Prisma validation, build, focused tests (10/10), live E2E (13/13), and lint (0 errors; 22 non-blocking warnings) pass against the isolated test database.

### Still Unresolved

None that blocks Phase 03. The separate default Vitest Playwright discovery issue remains Phase 05 scope.

**Status:** DONE
**Summary:** Final Phase 02 remediation passes review; DTO boundaries, bounded independent throttling, Argon2 policy, strict JWT checks, and live E2E evidence are sufficient for Phase 03.
**Concerns/Blockers:** None. Phase 03 can start.
