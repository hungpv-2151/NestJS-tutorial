## Finding 1: Global rejection of undeclared fields silently narrows the OpenAPI contract
- **Severity:** High
- **Location:** Phase 01, section "Implementation Steps", step 4
- **Flaw:** The plan mandates `ValidationPipe` with `forbid extras`, but no request schema declares `additionalProperties: false`. Under OpenAPI, those wrapper/object schemas allow additional properties by default; the only explicit `additionalProperties` declaration is on the error map.
- **Failure scenario:** A compatible client sends an additive field in `user`, `article`, or `comment`. The API returns 422 solely because this plan imposed a stricter contract, even though the OpenAPI definition permits it. This is an unrecorded breaking change.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-01-foundation-data.md:42`; `spec/api/openapi.yml:456-636`; `spec/api/openapi.yml:822-893`; `spec/api/openapi.yml:642-647`.
- **Suggested fix:** Either remove `forbidNonWhitelisted` for contract DTOs or explicitly amend/version the API contract and add assertions for the intended unknown-field behavior.

## Finding 2: Offset pagination has no stable total ordering
- **Severity:** High
- **Location:** Phase 03, sections "Key Insights" and "Implementation Steps", step 5; Phase 04, step 4
- **Flaw:** The plan specifies only “newest-first.” It never establishes a unique secondary sort key for global and feed pagination, despite using offset pagination.
- **Failure scenario:** Articles created in the same timestamp bucket can move between two `limit=1` requests. The second page can duplicate the first item or omit another; the supplied pagination contract expects the newer created article on page one and the older one on page two.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-03-articles-tags-listing.md:14,39`; `plans/260910-0930-medium-clone-backend/phase-04-social-comments-feed.md:15,38`; `spec/api/hurl/pagination.hurl:45-59`; `spec/api/hurl/feed.hurl:90-115`.
- **Suggested fix:** Specify and test one shared order, e.g. `createdAt DESC, id DESC`, for global and feed queries, with a matching composite index.

## Finding 3: Slug collision handling can violate the required duplicate-title behavior
- **Severity:** High
- **Location:** Phase 03, section "Implementation Steps", step 2
- **Flaw:** “Retry on unique conflict inside bounded attempts” leaves both the slug suffix algorithm and the exhaustion outcome unspecified. A bound is not a guarantee that repeated titles succeed.
- **Failure scenario:** Concurrent requests create the same normalized title until the retry bound is exhausted. One request returns an arbitrary error/409 even though the acceptance suite explicitly requires duplicate titles to create distinct slugs successfully.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-03-articles-tags-listing.md:15,36`; `spec/api/hurl/errors_articles.hurl:110-137`; `spec/api/openapi.yml:214-230`.
- **Suggested fix:** Define a collision-safe strategy (database-generated unique suffix or a sufficiently random unique suffix) and the exact conflict mapping; add a concurrent duplicate-title integration test.

## Finding 4: Invalid optional-token behavior is deferred instead of made contractual
- **Severity:** High
- **Location:** Phase 02, section "Risk Assessment"; Phase 05, section "Key Insights"
- **Flaw:** The plan says to “decide/document” whether an invalid optional token is anonymous, but it never makes that decision, names affected endpoints, or sets the expected response. Phase 05 acknowledges the gap but only says to add a regression test.
- **Failure scenario:** Profile/article/comment public-read routes independently treat malformed or expired `Authorization: Token ...` headers as anonymous or 401. The same caller then receives inconsistent identity-sensitive `following`/`favorited` fields and unpredictable error handling.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-02-auth-users-profiles.md:21,56`; `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:14-16,36`; `spec/api/openapi.yml:89-111`; `spec/api/openapi.yml:181-213`; `spec/api/openapi.yml:310-332`.
- **Suggested fix:** Decide strict semantics before implementation (recommended: malformed/present token is 401; absent token is anonymous), apply it in one optional-auth guard, and test every public route family.

## Finding 5: The plan leaves a known acceptance command/documentation contradiction in place
- **Severity:** Medium
- **Location:** Phase 05, sections "Implementation Steps" and "Related Code Files"
- **Flaw:** Phase 05 runs Hurl with a bare origin, which is correct for Hurl files that append `/api`, but it neither corrects nor explicitly supersedes the checked-in README command that supplies `/api` in `HOST`. The resulting documented command requests `/api/api/...`.
- **Failure scenario:** A developer follows the repository’s documented acceptance command after delivery. The Hurl runner substitutes that host and every Hurl request appends another `/api`, producing false failures against a working server.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:28-39`; `spec/api/README.md:7-13`; `spec/api/run-api-tests-hurl.sh:5,15-19`; `spec/api/hurl/auth.hurl:2`.
- **Suggested fix:** Add `spec/api/README.md` to Phase 05’s explicit documentation updates and standardize the command on `HOST=http://localhost:<port>`.

## Finding 6: A path typo makes required source/doc updates target a nonexistent project root
- **Severity:** Medium
- **Location:** Phase 01, section "Related Code Files"; Phase 05, section "Related Code Files"
- **Flaw:** Several required paths omit `.com` from the username segment (`pham.van.hung-asterisk.com` instead of `pham.van.hung@sun-asterisk.com`). These are not paths in the declared work context.
- **Failure scenario:** An implementer follows the plan literally and creates files outside the repository or fails to update the required exception filter and delivery documentation. The plan’s ownership and completion checks then no longer describe the actual changes.
- **Evidence:** `plans/260910-0930-medium-clone-backend/phase-01-foundation-data.md:34`; `plans/260910-0930-medium-clone-backend/phase-05-contract-testing-readiness.md:31`; `package.json:1-2`.
- **Suggested fix:** Correct every absolute path to the project root, or use repository-relative paths throughout the plan.

**Status:** DONE_WITH_CONCERNS
**Summary:** Six material assumptions/contradictions can break contract compatibility, pagination correctness, or reproducible acceptance.
**Concerns/Blockers:** Resolve Findings 1–4 before implementation; Findings 5–6 before readiness handoff.
