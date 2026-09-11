# Phase 02 — Authentication, users and profiles

## Context Links

- [OpenAPI auth/profile routes](../../spec/api/openapi.yml) · [auth Hurl](../../spec/api/hurl/auth.hurl) · [auth failures](../../spec/api/hurl/errors_auth.hurl) · [profile failures](../../spec/api/hurl/errors_profiles.hurl)

## Overview

- Priority: P1 · Status: Complete (2026-09-11)
- Implement registration/login/current-user/settings APIs, JWT guards and read-only profiles. Follow mutation ships in Phase 04.

## Key Insights

- Password has NIST-oriented acceptance: at least eight characters, supports 64+, no composition rules.
- Empty `bio`/`image` normalize to null; absent fields differ from null. Changing username/email returns a fresh JWT.

## Requirements

- Cover `POST /users`, `POST /users/login`, `GET|PUT /user`, `GET /profiles/:username`.
- Hash using centrally configured/versioned Argon2id parameters benchmarked for deployment; sign fixed-algorithm HS256 JWT with `sub`, 15-minute expiry, issuer/audience and token-version claim.
- Implement optional principal resolution for public serializers and protected guard for account routes; supplied invalid credentials are 401 everywhere.

## Architecture

`users controller → users service → Prisma`; `auth service` owns verify/sign; guard adds `currentUserId`; profile serializer computes `following` from viewer relation. Controller never returns password hash or raw entity.

## Related Code Files

- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/auth/*` — token service, guards and principal decorator.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/users/*` — DTOs, controller, service, serializer and tests.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/profiles/*` — profile read controller/service/serializer.
- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts` — module registration only.
- Create/modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/auth.e2e-spec.ts`, `/test/profiles.e2e-spec.ts` — Nest/Supertest integration.

## Implementation Steps

1. Create wrapper DTOs preserving absent/null semantics and exact blank/invalid credential errors.
2. Register atomically; map unique email/username conflicts to 409. Hash once, never return/store plaintext.
3. Login verifies Argon2id within an upper password-input bound; parser accepts exact `Token ` format and rejects malformed/expired/bad-signature/wrong-claim tokens with 401.
4. Add configurable login/register throttling keyed by account and client address (default 5 login attempts/minute and 3 registrations/hour), trusted-proxy policy, bounded 429 response, and deterministic tests.
5. Implement current user/settings update, normalize nullable profile fields, reissue token after username/email change, and increment token version after password change to invalidate old access tokens. Document secret rotation and key overlap procedure.
6. Serialize profiles with optional viewer `following`; reject self-follow with 422; unknown profile is 404, not a blank profile.

## Todo List

- [x] Auth/profile service unit tests cover hash, token parser and normalization.
- [x] Auth/profile contract coverage passes in live E2E for `auth`, `errors_auth`, `profiles`, and `errors_profiles` scenarios.
- [x] Tokens/passwords/hashes are absent from logs and errors.

## Success Criteria

- Responses match `User`/`Profile` envelopes; public profile works anonymous and authenticated.
- `pnpm run build`, lint and targeted Vitest pass.

## Risk Assessment

- Resolved: supplied malformed tokens return 401 while absent tokens remain anonymous; regression coverage passes.

## Security Considerations

- Pin HS256 verification, expiry, secret and issuer/audience config; rate limiting/refresh token are intentionally out of scope.

## Next Steps

- Phase 03 is unblocked and consumes the principal decorator and profile serializer; no duplicate auth logic.
