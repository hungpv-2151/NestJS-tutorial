# Backend planning hardened against contract, security, and readiness failures

**Date**: 2026-09-10 10:03
**Severity**: high
**Component**: RealWorld backend implementation plan
**Status**: resolved

## What Happened

The backend planning session was completed for the RealWorld API only. The chosen baseline is PostgreSQL with Prisma persistence and JWT authentication, split across the five phases in `plans/260910-0930-medium-clone-backend/plan.md`. The red-team pass found 12 findings; all 12 were accepted and applied. Reconciliation reread `plan.md` and phases 01–05, resolving 9 stale references with 0 contradictions left.

## The Brutal Truth

The first draft was too trusting. It named JWT, pagination, social mutations, and Hurl without pinning down the failure behavior that makes those pieces safe to ship. The galling part was that the warning was already visible: the README’s `HOST=http://localhost:3000/api` combined with Hurl paths that append `/api` would produce `/api/api/...`. Catching that before implementation is a relief, but it also means the plan would have sent someone into a predictable 404 chase while tired and under release pressure.

## Technical Details

The plan now requires strict supplied-token validation: malformed, expired, forged, wrong issuer/audience, and wrong algorithm return 401; an absent token on a public read remains anonymous. JWT policy is HS256, 15-minute access tokens, a 256-bit secret, and token-version invalidation. Public credential routes and request DTOs get configurable throttles and resource maxima. Global/feed pagination uses `createdAt DESC, id DESC`; social target checks and writes are race-safe. Hurl readiness is origin-only, migration-gated, bounded, and cleaned up with a PID trap. The validation log records `12/14 grounded`, with planned Prisma schema and HTTP bootstrap explicitly treated as future Phase 01 work rather than starter-code claims.

## What We Tried

We first relied on the contract and phase prose, then ran separate security, failure-path, and assumption reviews. That exposed unbounded payloads, weakly specified Argon2 cost, JWT ambiguity, unstable offset ordering, target-deletion races, E2E bootstrap drift, and the Hurl path contradiction. We kept the RealWorld scope and PostgreSQL/Prisma/JWT choices; we set aside broadening into Figma/client work, refresh-token flows, or a new API contract. The reviews held because each finding was tied back to a file and acceptance behavior.

## Root Cause Analysis

The root cause was planning from happy-path feature names instead of executable boundaries. “JWT,” “newest-first,” and “start the app, then run Hurl” sounded complete but left security semantics, total ordering, concurrency outcomes, and readiness mechanics unspecified. Those omissions would have become implementation folklore.

## Lessons Learned

For every backend plan, turn nouns into tested invariants: exact token rejection, bounded inputs, deterministic sort keys, transaction outcomes, and one canonical acceptance command. Treat a review artifact as unfinished until each recommendation is either applied or explicitly rejected with a reason.

## Next Steps

The implementation owner should execute Phases 01–05 from `plans/260910-0930-medium-clone-backend/plan.md`, preserving the recorded controls and running the relevant Hurl group after each phase. Delivery documentation updates remain part of the future implementation handoff; this journal records planning only.
