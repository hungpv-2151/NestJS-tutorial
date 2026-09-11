## Review Summary

### Scope

- Files reviewed: Phase 04 plan, final tester report, social/comments/article/profile implementation, controllers and live E2E coverage.
- Depth: final Phase 04 review.

### Assessment

The normal-path contracts are strong: feed reuses the bounded list serializer, relations are idempotent in the tested path, and comments use scoped deletion. However, two concurrent target-removal paths violate the plan's resource-specific 404 guarantee. **Not commit-ready.**

### Critical

None.

### High

1. **Unfollow can return success for a profile concurrently deleted after lookup** — `src/profiles/profiles.service.ts:21-43`. `changeFollow()` reads the target, then `deleteMany()` may quietly affect zero rows after a concurrent profile deletion/cascade. Unlike the upsert error path, no post-mutation existence check runs, so it returns cached profile data and 200 for a no-longer-existing resource. Perform the target lookup and conditional relation mutation in one transaction/conditional write, or re-check target existence when an unfollow affects zero rows; return `errors.profile: ["not found"]` on removal. Add a race-oriented service/integration test.

2. **Favorite can leak a generic 500 if article removal races the upsert** — `src/articles/articles.service.ts:49-62`. After `target` is read, a concurrent article deletion can make `tx.favorite.upsert()` raise Prisma `P2003`; it is uncaught, so the global filter emits a 500 instead of `errors.article: ["not found"]`. Catch the FK/conflict outcome around the transaction, re-check the slug, and map a vanished target to the article 404 envelope. Test a forced target-removal/FK-conflict path.

### Medium

None.

### Low

None.

### Edge Cases Turned Up

- Favorite count uses durable `_count`, viewer favorite uses a one-row relation filter, and article/profile/comment serializers avoid per-row database lookups.
- Feed is authenticated, follows-only, stable `createdAt DESC, id DESC`, paginated, and uses the same list serializer.
- Comment deletion scopes `id`, `articleId`, and `authorId`; a non-owner delete preserves the comment and returns 403 in the tested path.

### Done Well

- Follow/favorite POST and DELETE are idempotent in normal operation through composite-key upsert/delete-many.
- Comments correctly implement public list, protected create, owner-scoped delete, expected 201/204 statuses, and 422/404 envelopes for tested invalid paths.
- Fresh tester evidence: E2E 26/26, focused tests 10/10, build passes; lint exits 0 with 52 warnings.

### Actions In Order

1. Make follow/unfollow conditional on a still-existing target and map concurrent removal to profile 404.
2. Map favorite FK races to article 404 instead of generic 500.
3. Add deterministic race tests and re-run build, focused tests, E2E and lint.

### Numbers

- Build: pass.
- Focused tests: 10/10 pass.
- Live E2E: 26/26 pass.
- Lint: 0 errors, 52 warnings.

### Still Unresolved

- The two High concurrent-removal findings block commit readiness.
- Default Vitest Playwright discovery remains Phase 05 scope.

**Status:** DONE_WITH_CONCERNS
**Summary:** Phase 04 is functionally green, but concurrent profile/article deletion can produce an incorrect 200 or generic 500 instead of resource-specific 404.
**Concerns/Blockers:** Do not commit Phase 04 until both race mappings are fixed and retested.

---

## Final Remediation Addendum — 2026-09-11

### Assessment

Both prior High findings are resolved. **Phase 04 is commit-ready.**

### Verification

- Unfollow now rechecks the target after a conditional delete. If the profile vanished between initial lookup and mutation, it returns the profile-specific 404 envelope rather than cached data/200. Deterministic removal coverage passes.
- Favorite wraps the transaction and handles Prisma `P2003` only after checking whether the article still exists. A vanished article becomes its specific 404; a different foreign-key cause is deliberately rethrown instead of being mislabeled. This is the correct safe mapping boundary.
- The tester accurately records that a true HTTP mid-transaction `P2003` race was not reproducible safely. That is not a gap hidden by the implementation: the dedicated code path has been inspected, and the deterministic pre-removal case proves the same public contract.
- Final tester evidence: E2E 28/28, focused tests 10/10, build passes, lint exits 0 with 62 non-blocking warnings.

### Still Unresolved

None for Phase 04. Default Vitest Playwright discovery remains Phase 05 scope.

**Status:** DONE
**Summary:** Final Phase 04 review passes; concurrent target-removal paths now preserve resource-specific 404 contracts, and social/comment/feed behavior is commit-ready.
**Concerns/Blockers:** None. Phase 04 is ready to commit.
