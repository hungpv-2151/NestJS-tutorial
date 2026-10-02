# Auth review remediation baseline

Captured 2026-09-25 before changing the rules branch. Worktree was clean on
`phase-03-private-file-read-pr46`; `origin` uses
`git@github.com:hungpv-2151/NestJS-tutorial.git`. Local backup refs were created
for `phase-03-user-avatar-pr45` and `phase-03-private-file-read-pr46` before
stack propagation.

## Live PR topology

GitHub reported every listed PR open and mergeable. All review threads on #31,
#35, #36, and #37 were resolved. PR #34 returned 404; #35 directly targets #31.

| PR | Branch | Base branch (base SHA) | Head SHA |
| --- | --- | --- | --- |
| #31 | `phase-02-register-complete` | `phase-02f-auth-contract-primitives` (`c76885a`) | `e000e45` |
| #35 | `phase-02-login` | `phase-02-register-complete` (`e000e45`) | `336c78c` |
| #36 | `phase-02-current-user` | `phase-02-login` (`336c78c`) | `92eb505` |
| #37 | `phase-02-logout` | `phase-02-current-user` (`92eb505`) | `07de80d` |
| #39 | `phase-03-update-user` | `phase-02-logout` (`07de80d`) | `460d7c7` |
| #40 | `phase-03-get-profile` | `phase-03-update-user` (`460d7c7`) | `0fda0cd` |
| #41 | `phase-03-follow-profile` | `phase-03-get-profile` (`0fda0cd`) | `491aae8` |
| #42 | `phase-03-unfollow-profile` | `phase-03-follow-profile` (`491aae8`) | `1ead588` |
| #43 | `phase-03-private-attachments-foundation` | `phase-03-unfollow-profile` (`1ead588`) | `eb877d5` |
| #44 | `chore-agent-rule-refresh` | `phase-03-private-attachments-foundation` (`eb877d5`) | `a6a17f2` |
| #45 | `phase-03-user-avatar-pr45` | `chore-agent-rule-refresh` (`a6a17f2`) | `a2cc371` |
| #46 | `phase-03-private-file-read-pr46` | `phase-03-user-avatar-pr45` (`a2cc371`) | `1494cad` |

Merge bases for each adjacent pair from #35 through #46 equal the preceding PR
head shown above. The #44 rules branch therefore only has two downstream PR
branches to replay: #45 and #46. PRs #35–#43 have no dependency on #44.

## Repeated feedback and reusable rule coverage

Resolved #31 review feedback establishes these reusable patterns:

- Put registration/login orchestration in `AuthService`; controllers retain
  HTTP transport, validation, status mapping, and response serialization.
- Put reused auth constants and narrow interfaces in focused module files when
  they make behavior clearer; preserve compatibility exports where needed.
- Batch collection writes inside the existing transaction rather than awaiting
  one `save` query per item.
- Log important failures only where operationally useful, with fixed categories
  and request context redacted of credentials, tokens, and personal identifiers.
- Keep related auth routes together in `AuthController` instead of creating a
  one-route auth controller.

The first, second, and fourth patterns were already present in tracked
`AGENTS.md`; the batch-persistence pattern was missing and is added by this
plan. The fifth is already reflected in the current auth module structure.

## Existing #35 and #36 fixes verified

- #35's four resolved comments map to commit `336c78c`:
  `AuthController.login()` delegates login decisions to `AuthService`; the
  missing-user Argon2 verification hash and verifier live in
  `auth-password-verifier.ts`; limiter parameters and Lua script live in
  `auth-login-rate-limiter.constants.ts`; Redis uses `keys.length`.
- #36's resolved comment maps to commit `b71cab5`: the controller calls
  `AuthService.currentUser()`, a missing/deleted user maps to the existing 401
  token error, and the response retains the presented token.
- #37's resolved comment explicitly says logging is not needed at that point.
  No logout code change is planned; the tracked rule keeps future auth logging
  tied to current operational need.

No implementation code changes are needed on #35 or #36 based on their current
review threads and branch contents. #35 and #36 evidence still needs focused
test verification has since run on stack snapshot `a6a17f2`: focused auth unit
tests passed 29/29; relevant registration/current-user E2E passed 10/10; full
unit passed 110 with 1 skipped; full E2E passed 30/30; build passed; lint had
0 errors and 119 warnings. Raw exit-code evidence is in
`../evidence/raw-temper-runs-tester.json`, with normalized results in
`../evidence/temper-results.json`. Final inspection and descendant stack
validation remain before closure.
