## Review Summary

### Scope

- Files reviewed: Phase 03 plan, tester report, article/tag modules, DTOs, live E2E tests, schema assumptions and Hurl contracts.
- Depth: final Phase 03 implementation review.

### Assessment

The null `tagList` remediation is correct and fresh E2E is green (18/18), but the service still misses the plan's database-scoped ownership mutation and slug-exhaustion contract. It is **not ready to commit** yet.

### Critical

None.

### High

1. **Ownership check and write are a TOCTOU sequence, not one database-authorized operation** — `src/articles/articles.service.ts:16-17`. The service reads the article and checks `authorId`, then calls `update`/`delete` using only `slug`. A concurrent deletion/replacement or future author-changing write can invalidate the decision after the check; a zero-row outcome also bypasses the intended article-specific 403/404 mapping. Use `updateMany`/`deleteMany` constrained by both `slug` and `authorId` in the transaction, inspect the affected count, then look up the resource only to distinguish 403 from 404. This is an explicit Phase 03 acceptance requirement.

2. **Slug retry handles every database failure and never returns the defined exhaustion response** — `src/articles/articles.service.ts:13`. Creation always adds only an eight-hex-character suffix, catches all errors (including database outages and invalid FK/constraint failures), retries without context, then rethrows the final raw error. It neither retries only a slug unique conflict nor returns the planned defined 409 after collision exhaustion. Generate the base slug first, append a cryptographically strong suffix only after a verified slug unique violation, preserve non-collision errors, and map exhausted verified collisions to the article conflict envelope. Add a deterministic collision/retry test.

### Medium

1. **Article list loads every favorite row for every returned article** — `src/articles/articles.service.ts:7,15,20`. `include.favorites` selects all `userId` values solely to derive `favoritesCount` and a viewer flag. Once Phase 04 enables favorite writes, a public list can load an unbounded number of relation rows into memory despite the page limit. Use `_count.favorites` and, when a viewer exists, a relation filter/select limited to that viewer. This keeps the serializer seam without an N+1 or fan-out query.

### Low

None.

### Edge Cases Turned Up

- `tagList: null` now reaches `IsArray` validation and returns 422; omission preserves tags and `[]` clears them in the fresh live suite.
- Ordered join positions, tag/author filters, count-before-page response shape, and deterministic `createdAt DESC, id DESC` order are present.
- Detail includes `body`; list serialization omits it. Optional authentication rejects supplied malformed tokens rather than silently treating them as anonymous.

### Done Well

- Create/update tag writes use Prisma nested writes, so relation replacement is atomic.
- Unknown resources and non-owner attempts have article-specific 404/403 envelopes in the normal tested path.
- Fresh verification: build passes, focused tests 10/10 pass, E2E 18/18 pass, and lint exits 0 (35 warnings).

### Actions In Order

1. Replace read-then-write ownership with an author-scoped mutation/count flow and cover the zero-row race path.
2. Narrow slug retry to verified unique conflicts and define the exhausted-collision 409 result.
3. Bound favorite relation loading before Phase 04 adds write volume; rerun build, focused tests, E2E and lint.

### Numbers

- Build: pass.
- Focused tests: 10/10 pass.
- Live E2E: 18/18 pass.
- Lint: 0 errors, 35 warnings.

### Still Unresolved

- The two High findings block commit readiness.
- Default Vitest Playwright discovery remains Phase 05 scope.

**Status:** DONE_WITH_CONCERNS
**Summary:** Null tag validation is fixed and E2E is green, but TOCTOU ownership writes and slug collision exhaustion must be corrected before commit.
**Concerns/Blockers:** Do not commit Phase 03 until the two High findings are fixed and retested.

---

## Final Remediation Addendum — 2026-09-11

### Assessment

All prior High and Medium findings are resolved. **Phase 03 is commit-ready.**

### Verification

- `update()` scopes its first write by both `slug` and `authorId` inside a transaction, and `remove()` uses the same scoped database predicate. A zero affected count resolves through an article-specific 403/404 path; live E2E covers the removed-row path.
- Slug creation uses the normalized base first, retries only a verified `P2002` slug conflict with a cryptographic UUID suffix, and returns a defined 409 envelope after retry exhaustion. The concurrent repeated-title test passes.
- The serializer uses `_count.favorites` and a viewer-filtered, one-row favorite relation instead of loading every favorite. This preserves the Phase 04 seam without relation fan-out.
- Tag-only updates now complete successfully, preserve ordered tag semantics, reject `null`, and clear with `[]`; final live E2E passes this path.
- Final tester evidence: E2E 20/20, focused tests 10/10, build and Prisma validation pass; lint exits 0 with 37 non-blocking warnings.

### Still Unresolved

None for Phase 03. Default Vitest Playwright discovery remains Phase 05 scope.

**Status:** DONE
**Summary:** Final Phase 03 review passes; ownership, slug concurrency, favorite-query bounds, and tag-only updates are contract-ready.
**Concerns/Blockers:** None. Phase 03 is ready to commit.
