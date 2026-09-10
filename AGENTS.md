## Rule: development-rules

# Development Rules

**IMPORTANT:** Read the skills catalog and turn on whatever skills the work in front of you calls for.
**IMPORTANT:** Three principles ride along on every change: **YAGNI (You Aren't Gonna Need It) — KISS (Keep It Simple, Stupid) — DRY (Don't Repeat Yourself)**.
**IMPORTANT:** The craftsman disposition behind these rules — voice, the Study→Deliver flow, Iron Laws, confidence taxonomy — lives in `.claude/ethos/ETHOS.md`. Read it when an artifact's voice or judgment is in question.

## General
- **File Naming**: Name files in kebab-case, and let the name say plainly what the file is for. Length is fine — a long, self-describing name pays off the moment an LLM scans the tree with Grep or similar and grasps the purpose without opening the file.
- **File Size Management**: Hold each code file under 200 lines so context stays manageable.
  - Break oversized files into smaller, single-purpose modules or components.
  - Reach for composition over inheritance when a widget grows complicated.
  - Pull utility functions out into their own modules.
  - Give business logic its own dedicated service classes.
- Need current library docs? Turn on the `tkm:search-docs` skill (it sits on top of `context7`) to pull the latest.
- Reach for the `gh` bash command when you need to drive GitHub.
- Reach for the `psql` bash command when debugging means querying a Postgres database.
- Use the built-in file reading to open and describe images, screenshots, and documents directly when that helps.
- Lean on the `tkm:think-sequential` and `tkm:debug-code` skills for step-by-step reasoning, code analysis, and debugging when the task warrants it.
- **[IMPORTANT]** Honor the codebase structure and code standards documented in `.` as you build.
- **[IMPORTANT]** Write the real implementation — never fake it or stub it out as a stand-in.

## Code Quality Guidelines
- Read `.` for codebase structure and code standards, and follow them.
- Don't be a zealot about lint, but **leave no syntax errors — the code must compile**.
- Favor working, readable code over rigid style policing and formatting fussiness.
- Apply sensible quality bars — the kind that keep developers productive, not bogged down.
- Wrap risky paths in try/catch and keep security standards in view.
- Hand finished work to the `reviewer` agent after every implementation.

## Pre-commit/Push Rules
- Lint before you commit.
- Run the tests before you push — and DO NOT wave through failing tests just to make the build or GitHub Actions green.
- Keep each commit scoped to the actual code change.
- **DO NOT** commit or push secrets of any kind (dotenv files, API keys, database credentials, and the like) to the repository.
- Write clean, professional commit messages in conventional-commit form, with no AI references.

## Code Implementation
- Write code that is clean, readable, and easy to maintain.
- Stay within the architectural patterns already in place.
- Build features to spec.
- Account for edge cases and error paths.
- **DO NOT** spin up new "enhanced" copies of files — edit the existing files in place.

## Visual Aids
- Reach for ` --explain` when walking through an unfamiliar pattern or tangled logic.
- Reach for ` --diagram` for architecture diagrams and data-flow pictures.
- Reach for ` --slides` for step-by-step walkthroughs and presentations.
- Reach for ` --ascii` for terminal-friendly diagrams (no browser needed to follow them).
- Append `--html` to any generation flag for a self-contained HTML file that opens in the browser with no server.
- **Plan context:** the active plan comes from the `## Plan Context` block injected by the hook; visuals land in `{plan_dir}`.
- With no active plan, fall back to the `plans/visuals/` directory.
- For Mermaid diagrams, the `` skill carries the v11 syntax rules.
- For how this folds into the larger flow, see `primary-workflow.md` → Step 6.
---

## Rule: documentation-management

# Project Documentation Management

### Roadmap & Changelog Maintenance
- **Project Roadmap** (`./docs/development-roadmap.md`): a living document that tracks the project's phases, milestones, and progress.
- **Project Changelog** (`./docs/project-changelog.md`): the running record of every significant change, feature, and fix.
- **System Architecture** (`./docs/system-architecture.md`): the running record of every significant change, feature, and fix.
- **Code Standards** (`./docs/code-standards.md`): the running record of every significant change, feature, and fix.

### Automatic Updates Required
- **After Feature Implementation**: move the roadmap progress forward and add changelog entries.
- **After Major Milestones**: revisit the roadmap phases and refresh the success metrics.
- **After Bug Fixes**: log the fix in the changelog with its severity and impact.
- **After Security Updates**: note the security improvements and version bumps.
- **Weekly Reviews**: refresh progress percentages and milestone statuses.

### Documentation Triggers
The `delivery-tracker` agent MUST refresh these documents when:
- A development phase changes status (e.g. "In Progress" → "Complete").
- Major features ship or get released.
- Significant bugs get resolved or security patches go out.
- The project timeline or scope shifts.
- An external dependency or a breaking change lands.

### Update Protocol
1. **Before Updates**: read the current roadmap and changelog status first.
2. **During Updates**: hold version consistency and proper formatting.
3. **After Updates**: confirm links, dates, and cross-references are right.
4. **Quality Check**: make sure the updates match the real implementation progress.

### Plans

### Plan Location
Keep plans under `.`, each in a folder named with a timestamp and a descriptive label.

**Format:** follow the naming pattern from the `## Naming` section the hooks inject.

**Example:** `plans/251101-1505-authentication-and-profile-implementation/`

#### File Organization

```
plans/
├── 20251101-1505-authentication-and-profile-implementation/
    ├── research/
    │   ├── researcher-XX-report.md
    │   └── ...
│   ├── reports/
│   │   ├── scout-report.md
│   │   ├── researcher-report.md
│   │   └── ...
│   ├── plan.md                                # Overview access point
│   ├── phase-01-setup-environment.md          # Setup environment
│   ├── phase-02-implement-database.md         # Database models
│   ├── phase-03-implement-api-endpoints.md    # API endpoints
│   ├── phase-04-implement-ui-components.md    # UI components
│   ├── phase-05-implement-authentication.md   # Auth & authorization
│   ├── phase-06-implement-profile.md          # Profile page
│   └── phase-07-write-tests.md                # Tests
└── ...
```

#### File Structure

##### Overview Plan (plan.md)
- Keep it generic and under 80 lines.
- List every phase with its status/progress.
- Link out to the detailed phase files.
- Note the key dependencies.

##### Phase Files (phase-XX-name.md)
Stay fully within the `development-rules.md` file.
Each phase file should carry:

**Context Links**
- Links to related reports, files, documentation

**Overview**
- Priority
- Current status
- Brief description

**Key Insights**
- Important findings from research
- Critical considerations

**Requirements**
- Functional requirements
- Non-functional requirements

**Architecture**
- System design
- Component interactions
- Data flow

**Related Code Files**
- List of files to modify
- List of files to create
- List of files to delete

**Implementation Steps**
- Detailed, numbered steps
- Specific instructions

**Todo List**
- Checkbox list for tracking

**Success Criteria**
- Definition of done
- Validation methods

**Risk Assessment**
- Potential issues
- Mitigation strategies

**Security Considerations**
- Auth/authorization
- Data protection

**Next Steps**
- Dependencies
- Follow-up tasks
---

## Rule: grill-loop-protocol

# Grill Loop Protocol

The relentless interview. When a skill runs with `--grill`, it does not gather requirements
in one batched pass — it walks the decision tree one question at a time, each question shaped
by the last answer, until the design is genuinely understood or the user calls it.

This file is the **single source of truth** for that loop. Skills load it; they never restate
the algorithm. A skill supplies only two things: the **topic/commission** and the **sink**
(where crystallized decisions get recorded — a report section, a `## Validation Log`, etc.).

## When this applies

- ONLY when the consuming skill was invoked with the `--grill` flag.
- `AskUserQuestion` runs in the **main thread only** → grill is inherently single-thread and
  interactive. Never run the grill loop inside a parallel/background sub-agent (e.g. board
  members, fan-out researchers). If the skill also fans out work, grill the commission first
  in the main thread, then hand the resolved decisions to the parallel stage.

## The loop

```
1. SCOUT-FIRST GATE
   If a question is answerable by reading the codebase/docs, READ it — do NOT ask the user.
   (Reuse the skill's existing scout step, e.g. tkm:scan-codebase. Ask only what code can't answer.)

2. BUILD the decision tree
   Seed root nodes from the topic/commission + scout findings. Each node = one open decision.

3. LOOP:
   a. SELECT the next OPEN node whose dependencies (parent answers) are all resolved.
      Walk the tree depth-first along the highest-leverage branch — the decision that most
      constrains everything downstream goes first.
   b. ASK exactly ONE question via AskUserQuestion:
        - 2–4 concrete options
        - mark one "(Recommended)" with a one-line reason
        - the "Other" free-text path is always available
      Asking multiple questions at once is bewildering — never batch under grill.
   c. RECORD the answer immediately to the sink (incremental — see below).
   d. EXPAND: derive the child nodes this answer newly unlocks; prune nodes it made moot.
   e. RE-EVALUATE the stop conditions.
```

## Stop conditions

Stop when **any** of these holds:

| # | Condition | Action on stop |
|---|-----------|----------------|
| a | User signals proceed ("đủ rồi", "build", "proceed", "go", "that's enough") | Stop immediately, honor the user |
| b | No OPEN dependency-ready nodes remain (tree exhausted) | Summarize, confirm proceed |
| c | `grill.diminishingStreak` consecutive answers all took "(Recommended)" | Offer to wrap: "Looks settled — keep grilling or proceed?" |
| d | Questions asked `>= grill.questionCap` | Summarize what's resolved + what's still open, ask to proceed or raise the cap |

On stop via (b), (c), or (d): present the crystallized decisions and explicitly ask the user
to confirm before moving on. Never silently transition from interview to output.

## `--grill` overrides the injected question bound

The `## Plan Context` section injects `questions={min}-{max}` (e.g. `3-8`). That range governs
**batched** validation only. **When `--grill` is active, IGNORE that range and ignore any
"N per tool call" batching.** Grill is one-question-at-a-time and unbounded up to
`grill.questionCap`.

## Incremental recording contract (the "with docs" behaviour)

Record each decision **the moment it crystallizes**, not at the end of the session. The consuming
skill names the sink:

- it appends ONE entry per resolved decision, immediately after the user answers;
- entry carries: the question, the options shown, the chosen answer (verbatim if "Other"),
  and a one-line rationale (why it matters / what it constrains downstream);
- reuse the skill's existing record format — do not invent a parallel one. For create-plan's
  validate flow, that is the `## Validation Log` format in
  `../skills/create-plan/references/validate-question-framework.md`.

This keeps the agreed design written down as it forms, so review at the end is confirmation,
not reconstruction.

## Config

Prose defaults (no runtime parser reads these — they guide the agent; a user may override any
of them inline, e.g. "grill cap 40", and the agent honors it):

| Field | Default | Meaning |
|-------|---------|---------|
| `grill.questionCap` | `25` | Hard safety cap on total questions (stop condition d) |
| `grill.diminishingStreak` | `4` | Consecutive "(Recommended)" answers that trigger the wrap offer (stop condition c) |

## Question format (parity)

One question per `AskUserQuestion` call · 2–4 options · one option tagged "(Recommended)" with a
one-line why · "Other" free-text always available. This mirrors the option format used across
the kit's interviews — keep it consistent with
`../skills/create-plan/references/validate-question-framework.md`.
---

## Rule: momorph/momorph-awareness

# MoMorph Awareness Rules

## Detecting MoMorph

Recognize MoMorph from **any** of these sources:

- **User message**: URL `https://momorph.ai/files/{fileKey}{screenId}`, explicit `screenId`/`fileKey` values, or keyword "momorph" / "figma"
- **Active plan**: `plan.md` or any phase file references MoMorph URL, fileKey, or screenId
- **Task prompt**: the spawned task description contains MoMorph references

## Delegation Protocol

**When spawning ANY sub-agent for a MoMorph task, task description, phase plan, MUST append this block to the prompt:**

```
## MoMorph refs:
- {screen name}: https://momorph.ai/files/{fileKey}/screens/{screenId}
- Clarifications: {path to clarifications.md}
- testPolicy: {visual-contract|e2e-red-first}
```

Never infer a different policy inside a sub-agent. A missing or invalid policy is
`NEEDS_CONTEXT`; the orchestrator resolves it before delegation.
---

## Rule: momorph/momorph-development

# MoMorph Development Rules

> **Requires extras kit.** Both `momorph-implement-design` and
> `momorph-ui-implementer` ship in `extras`, not base. If either is unavailable,
> stop before the clarification/implementation workflow and instruct the user to
> run `tkm init --kit extras`; never fall back to generic `implementer`.

## Critical Rules

1. **NEVER guess visual values** — MCP design data is authoritative.
2. **Clarification is a hard gate** — finish the protocol below before starting either Track A or Track B.
3. **Select one test policy** — exactly `visual-contract` or `e2e-red-first`; never blend them or silently downgrade.
4. **`clarifications.md` is authoritative** — do not re-ask resolved decisions.
5. **Separate ownership** — `momorph-ui-implementer` owns presentational UI; `tester` owns executable E2E tests and browser/visual evidence; generic `implementer` keeps RED-first ownership of behavior and backend code.
6. **Extras is a hard dependency** — missing MoMorph skill or agent is blocking; never emulate it with a base agent.

## Test-policy Resolution

Resolve one value before creating a plan or spawning an agent:

1. Explicit `--e2e-test-first` selects `e2e-red-first` for this run.
2. Otherwise, a valid `test_policy` in the active MoMorph phase selects that value.
3. Otherwise, if the resolved specs, test cases, or clarifications contain behavioral interaction — form validation, navigation, modal open/close behavior, or another state transition — select `e2e-red-first`.
4. Otherwise default to `visual-contract`. Hover, focus, pressed, and responsive-only requirements remain visual-contract concerns.

An invalid plan value is blocking. Any `e2e-red-first` selection and `--no-test` are mutually exclusive, including policy auto-selected from behavioral test cases.

### `visual-contract` (default)

- Applies only to static/presentational Figma mapping. It is not TDD and MUST NOT claim RED/GREEN evidence.
- `momorph-ui-implementer` may code after clarification, then runs compile/typecheck, lint, and asset coverage.
- `tester` owns post-code visual validation: Playwright MCP capture for web; the existing simulator/screenshot path for mobile.
- Business logic, validation, state transitions, APIs, and persistence remain RED-first work for generic `implementer`.

### `e2e-red-first`

- Before Track A or Track B starts, `tester` creates or updates one durable screen-level E2E test from downloaded test cases plus resolved clarifications and runs the exact project command.
- A valid RED is a real non-zero exit caused by the requested screen assertion. Dependency/config/browser-install/dev-server failures do not count.
- Record `redTestFiles`, `redCommand`, `redExitCode`, and `redFailure`; pass them read-only to the UI agent. After implementation, `tester` reruns the same command GREEN and performs visual validation.
- Web requires an existing executable project E2E runner; Playwright MCP alone is not `@playwright/test`. Do not install or scaffold a runner and do not downgrade when it is absent — stop before implementation.
- Strict E2E is web-only in this version. A mobile `e2e-red-first` selection is BLOCKED as unsupported even when a mobile runner exists; ask the user to use `visual-contract` or defer until a mobile contract is defined.

## Clarification Gate

Complete every step before releasing either implementation track:

1. Resolve every `fileKey` and `screenId` from the request or active plan.
2. Fetch in parallel per screen: `get_frame(screenId)`, `download_specs(screen_id, "csv")`, and `download_test_cases(screen_id, "csv")`.
3. Deep-read every spec and test-case row; summarize components and user flows.
4. Cross-reference gaps in error states, navigation, persistence, loading/empty states, validation, integrations, responsive behavior, accessibility, localization, and security.
5. Present unresolved gaps as prioritized questions. Wait for all answers, including follow-ups.
6. Write decisions to `clarifications.md` using `.claude/templates/plans/clarifications.md`: one `- Q: ... → A: ...` line per decision under `## Session [date]`.
7. Resolve and preflight `test_policy`. For `e2e-red-first`, obtain valid tester RED evidence now.

## Parallel Execution Strategy

**OVERRIDE:** this section modifies `tkm:takumi` and `tkm:create-plan` only when MoMorph context is detected.

- **`tkm:takumi`:** after the Clarification Gate (and strict RED when selected), run Track A and Track B concurrently.
- **`tkm:create-plan`:** do not spawn implementation or tester agents. Represent one independent Track A phase per screen, chained Track B phases, and a late integration phase. Every Track A phase MUST include `test_policy: visual-contract|e2e-red-first`; keep it at most 30 lines with screen refs, one-line goal, out-of-scope list, optional integration contract, and the test policy.

### Track A — Presentational UI

Spawn one background `momorph-ui-implementer` per screen by default. When the extras skill identifies independent sections, the orchestrator may instead fan out a bounded set of `momorph-ui-implementer` jobs in explicit `section` mode with disjoint ownership. Section workers never spawn agents recursively. Never use generic `implementer` anywhere in Track A.

Each prompt MUST provide: `mode`, `testPolicy`, `fileKey`, `screenId`, `ownedFiles` or `outputPath`, `projectRoot`, `stack`, `testRunner`, `redTestFiles`, `redCommand`, `redExitCode`, `redFailure`, `redEvidence`, and `plannedChecks`. For `visual-contract`, use `testRunner: none` when no project runner exists, `redTestFiles: []`, `redCommand: not-applicable`, `redExitCode: not-applicable`, `redFailure: not-applicable`, and `redEvidence: not-applicable (visual-contract)`. Also include the specs/test-case paths, `clarifications.md`, project conventions, and: "Use Figma design content as mock data source. Do NOT invent data."

The UI agent activates `momorph-implement-design`, codes static components, and reports a GREEN/visual handoff. It does not own browser evidence or executable tests.

### Track B — Behavior and Backend

After the same gate, blueprint and implement API contracts, data models, state, validation, navigation, integrations, and real data sources without waiting for Track A. Use generic `implementer`; its normal RED-first contract remains unchanged.

### Tester Hand-off and Integration

As each screen agent completes:

1. `tester` reruns the strict command GREEN when applicable, then owns visual validation for every policy.
2. Treat any failed GREEN or material visual mismatch as incomplete; return the bounded UI fix to `momorph-ui-implementer` without weakening tests.
3. Integrate verified UI interfaces with Track B incrementally. There is no Track A/Track B merge barrier after the shared clarification/test gate.
---

## Rule: orchestration-protocol

# Orchestration Protocol

## Workflow Tool (Opt-In Only)

**Never use the `Workflow` tool unless the user explicitly requests it with the word "workflow".** Orchestrate with the `Task` tool instead.

## Delegation Context (MANDATORY)

Every time you spawn a subagent through subtask delegation, the prompt **ALWAYS** carries three things:

1. **Work Context Path**: the git root of the PRIMARY files being touched
2. **Reports Path**: `{work_context}/plans/reports/` for that project
3. **Plans Path**: `{work_context}` for that project

**Example:**
```
Task prompt: "Fix parser bug.
Work context: /path/to/project-b
Reports: /path/to/project-b/plans/reports/
Plans: /path/to/project-b/plans/"
```

**Rule:** When your CWD and the work context differ (you are editing files in another project), point at the **work context paths**, not the CWD paths.
---

#### Sequential Chaining
Chain subagents when one step depends on another or needs an earlier step's output:
- **Planning → Implementation → Simplification → Testing → Review**: the shape for feature development (tests run against the simplified code).
- **Research → Design → Code → Documentation**: the shape for a brand-new system component.
- Each agent finishes fully before the next one starts.
- Carry the context and outputs forward through the chain.

#### Parallel Execution
Fire off several subagents at once when the tasks don't touch each other:
- **Code + Tests + Docs**: separate, non-conflicting pieces.
- **Multiple Feature Branches**: different agents on isolated features.
- **Cross-platform Development**: iOS and Android handled separately.
- **Careful Coordination**: keep them off the same files and shared resources.
- **Merge Strategy**: settle the integration points before the parallel work begins.
---

## Subagent Status Protocol

When a subagent wraps up, it MUST report exactly one of these statuses:

| Status | Meaning | Controller Action |
|--------|---------|-------------------|
| **DONE** | Task completed successfully | Proceed to next step (review, next task) |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts | Read concerns → address if correctness/scope issue → proceed if observational |
| **BLOCKED** | Cannot complete task | Assess blocker → provide context / break task / escalate to user |
| **NEEDS_CONTEXT** | Missing information to proceed | Provide missing context → re-dispatch |

### Handling Rules

- **Never** let BLOCKED or NEEDS_CONTEXT slide — something has to change before you retry.
- **Never** re-run the same approach after BLOCKED — escalate the response: more context → simpler task → more capable model → escalate to user.
- **DONE_WITH_CONCERNS** about file growth or tech debt → log it for later, keep moving now.
- **DONE_WITH_CONCERNS** about correctness → settle it before review.
- A subagent that fails the same task 3+ times → escalate to the user; don't keep retrying blind.

### Reporting Format

Subagents should close their response with:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary]
**Concerns/Blockers:** [if applicable]
```
---

## Context Isolation Principle

**A subagent gets only the context it needs — never the whole session history.**

### Rules

1. **Craft prompts explicitly** — spell out the task, the file paths that matter, and the acceptance criteria. Not "here's what we discussed."
2. **No session history** — the subagent starts fresh. Summarize the decisions that matter; don't replay the conversation.
3. **Scope file references** — name the specific files to read or change. Not "look at the codebase."
4. **Include plan context** — working from a plan, pass the one relevant phase, not the whole plan.
5. **Preserve controller context** — coordination stays in the main agent; keep that detail out of subagent prompts.

### Prompt Template

```
Task: [specific task description]
Files to modify: [list]
Files to read for context: [list]
Acceptance criteria: [list]
Constraints: [any relevant constraints]
Plan reference: [phase file path if applicable]

Work context: [project path]
Reports: [reports path]
```

### Anti-Patterns

| Bad | Good |
|-----|------|
| "Continue from where we left off" | "Implement X feature per spec in phase-02.md" |
| "Fix the issues we discussed" | "Fix null check in auth.ts:45, root cause: missing validation" |
| "Look at the codebase and figure out" | "Read src/api/routes.ts and add POST  endpoint" |
| Passing 50+ lines of conversation | 5-line task summary with file paths |
---

## Agent Teams (Optional)

For multi-session parallel collaboration inside a Claude Code agent team, follow `team-coordination-rules.md` (file ownership, communication, task claiming). It sits outside the default orchestration flow.
---

## Rule: primary-workflow

# Primary Workflow

**IMPORTANT:** Read the skills catalog and turn on whatever skills the work in front of you calls for.
**IMPORTANT**: Spend tokens like they cost something — stay efficient without dropping quality.

#### 1. Code Implementation
- Open with the `planner` agent: have it lay out an implementation plan with TODO tasks under `.`.
- During planning, run several `researcher` agents in parallel — each digs into a different technical topic, then reports back to `planner` to feed the plan.
- Write code that is clean, readable, and easy to maintain.
- Stay within the architectural patterns already in place.
- Build features to spec.
- Account for edge cases and error paths.
- **DO NOT** spin up new "enhanced" copies of files — edit the existing files in place.
- **[IMPORTANT]** After you create or change a code file, run the compile command/script to catch compile errors early.

#### 2. Testing
- Hand the **simplified code** to the `tester` agent to exercise.
  - Write thorough unit tests.
  - Push coverage high.
  - Exercise the error paths.
  - Check that performance requirements hold.
- Tests run against the FINAL code — the same code that gets reviewed and merged.
- **DO NOT** look past failing tests just to make the build pass.
- **IMPORTANT:** no fake data, mocks, cheats, tricks, or stopgaps slipped in to fake a green build or pass GitHub Actions.
- **IMPORTANT:** When tests fail, fix them by the recommendations and send them back to the `tester` agent for another run. Only close out the session once everything passes.

#### 3. Code Quality
- Once tests pass, hand the clean, tested code to the `reviewer` agent.
- Hold to the coding standards and conventions.
- Write code that documents itself.
- Comment the parts where the logic is genuinely intricate.
- Tune for performance and maintainability.

#### 4. Integration
- Follow the plan the `planner` agent produced.
- Make the new code sit cleanly inside what is already there.
- Honor the API contracts exactly.
- Keep backward compatibility intact.
- Document any breaking changes.
- When docs need it, hand off to the `doc-writer` agent to update `.`.

#### 5. Debugging
- When a user reports a bug or a server/CI-CD failure, hand it to the `debugger` agent to run tests and produce a summary report.
- Read that summary from the `debugger` agent and implement the fix.
- Send the result to the `tester` agent to run tests and report back.
- If the `tester` agent flags failing tests, fix them by the recommendations and loop back to **Step 3**.

#### 6. Visual Explanations
When you need to make complex code, a protocol, or an architecture click:
- **When to use:** the user says "explain", "how does X work", or "visualize", or the topic has 3+ pieces interacting.
- ` --explain <topic>` for a visual explanation built from ASCII + Mermaid.
- ` --diagram <topic>` for architecture and data-flow diagrams.
- ` --slides <topic>` for step-by-step walkthroughs.
- ` --ascii <topic>` for terminal-only output.
- **HTML mode** (add `--html` for self-contained HTML pages that open straight in the browser):
  - ` --html --explain <topic>` — publication-quality HTML explanation
  - ` --html --diagram <topic>` — interactive HTML diagram with zoom controls
  - ` --html --slides <topic>` — magazine-quality slide deck
  - ` --html --diff [ref]` — visual diff review
  - ` --html --plan-review` — plan vs codebase comparison
  - ` --html --recap [timeframe]` — project context snapshot
- **Plan context:** visuals land in the plan folder named by the `## Plan Context` hook injection; with none, they go to `plans/visuals/`.
- **Markdown mode:** opens automatically in the browser via markdown-novel-viewer, Mermaid rendered.
- **HTML mode:** opens straight in the browser — self-contained, no server.
- For more on this, see `development-rules.md` → "Visual Aids".
---

## Rule: response-style-vi

# Văn phong mẫu khi trả lời bằng tiếng Việt cho người dùng

Mục đích là để khi trả lời bằng tiếng Việt sẽ dễ hiểu, tự nhiên và không bị máy móc.

Viết theo mục "Nên", không viết theo mục "Không nên".

Không nên:
  "Điều này có nghĩa là hàm getToken() có thể được gọi một cách đồng thời bởi nhiều
   yêu cầu khác nhau, dẫn đến việc bộ nhớ đệm bị ghi đè, và do đó gây ra tình trạng
   không nhất quán của dữ liệu."
Nên:
  "Nhiều request gọi `getToken()` cùng lúc thì cache bị ghi đè, dữ liệu lệch nhau."

Không nên:
  "Hãy để tôi tiến hành phân tích tệp tin này nhằm mục đích xác định nguyên nhân
   gốc rễ của vấn đề mà bạn đang gặp phải."
Nên:
  "Tôi đọc file này xem lỗi từ đâu."

Không nên:
  "Việc sử dụng Redis sẽ góp phần nâng cao khả năng mở rộng của hệ thống một cách
   đáng kể, tuy nhiên nó cũng đồng thời làm gia tăng độ phức tạp trong vận hành."
Nên:
  "Redis scale tốt hơn nhiều, đổi lại bạn phải nuôi thêm một service nữa."

Không nên:
  "Cần lưu ý rằng việc lưu trữ refresh token trong localStorage được xem là một
   phương pháp không an toàn."
Nên:
  "Đừng để refresh token trong localStorage — dính XSS là mất sạch."
---

## Rule: team-coordination-rules

# Team Coordination Rules

> These rules apply only when you are operating as a teammate inside an Agent Team.
> Standard sessions and subagent workflows are untouched by them.

Rules for agents working as teammates within an Agent Team.

## File Ownership (CRITICAL)

- Every teammate MUST hold distinct files — no two editing the same one.
- Spell out ownership with glob patterns in the task description: `File ownership: src/api/*, src/models/*`.
- The lead untangles ownership clashes by reshaping tasks or taking the shared files itself.
- The tester owns test files only — it may read implementation files but never edit them.
- Catch an ownership violation → STOP and tell the lead at once.

## Git Safety

- Favor git worktrees for implementation teams — one dev per worktree, and the conflicts disappear.
- Never force-push from a teammate session.
- Commit often, with messages that say what changed.
- Pull before you push so merge conflicts surface early.
- Inside a worktree, commit and push to the worktree branch — not main, not dev.

## Communication Protocol

- Put the actionable finding in the message — not just "I'm done".
- Never send structured JSON status messages — plain text only.

## TKM Stack Conventions

### Report Output
- Drop reports into `{TKM_REPORTS_PATH}` (injected by the hook; falls back to `plans/reports/`).
- Name them `{type}-{date}-{slug}.md`, where type is your role (researcher, reviewer, debugger).
- Trade grammar for concision. Put any unresolved questions at the end.

### Commit Messages
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- No AI references in commit messages.
- Keep each commit on the actual code change.

### Docs Sync (Implementation Teams Only)
- Once implementation tasks land, the lead MUST weigh the docs impact.
- Say it outright: `Docs impact: [none|minor|major]`.
- If there is impact: update the `docs/` directory or flag it in the completion message.

## Task Claiming

- Take the lowest-ID unblocked task first — the earlier tasks set up the context for the later ones.
- Re-check `TaskList` after each task you finish, in case work has just unblocked.
- Flip the task to `in_progress` before you start.
- If everything is blocked, tell the lead and offer to help clear the way.

## Plan Approval Flow

When `plan_mode_required` is set:
1. Research and plan your approach (read-only — no file edits).
2. Send the plan via `ExitPlanMode` — this fires an approval request to the lead.
3. Wait for the lead's `plan_approval_response`.
4. Rejected → revise on the feedback and resubmit.
5. Approved → start implementing.

## Conflict Resolution

- Two teammates need the same file → escalate to the lead at once.
- A teammate's plan rejected twice → the lead takes the task over.
- Reviewers' findings conflict → the lead synthesizes and records the disagreement.
- Blocked by another teammate's unfinished work → message them directly first; escalate to the lead if they go quiet.

## Shutdown Protocol

- Approve shutdown requests unless you are mid-critical-operation.
- Always mark the current task completed before you approve a shutdown.
- Rejecting a shutdown → say why, briefly.
- Pull `requestId` from the shutdown request JSON and pass it to `shutdown_response`.

## Idle State (Normal Behavior)

- Going idle after sending a message is NORMAL — not a failure.
- Idle means waiting for input, not disconnected.
- Sending a message to an idle teammate wakes them.
- Don't read an idle notification as "done" — check the task status instead.

## Discovery

- Read the team config at `~/.claude/teams/{team-name}/config.json` to find your teammates.
- Always call teammates by NAME, never by agent ID.

