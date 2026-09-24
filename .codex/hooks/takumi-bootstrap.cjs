#!/usr/bin/env node
/**
 * SessionStart bootstrap — injects skill-routing discipline at the start of every session.
 *
 * Fires after session-init in the SessionStart chain.
 * Reminds the agent to reach for a Takumi skill before improvising.
 * Does NOT duplicate the catalog — points to `help` skill and
 * skills/help/references/skill-catalog.md for the Use-for + Key-triggers lookup.
 *
 * Output is intentionally terse (injected every session).
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. Two entry points, one core:
 *   - `run(input, ctx)` is the PURE core: it RETURNS a HookResult and does NO I/O
 *     (no stdin read, no stdout write, no process.exit). The takumi CLI imports this
 *     module and calls `run` in-process via `tkm hook-exec --eval`.
 *   - `module.exports.meta` is install metadata, read ONCE at install time (never at
 *     runtime). Importing this file to read it is safe because the self-exec branch
 *     below runs only under `require.main === module`.
 *   - The `require.main === module` branch preserves the legacy `node "<path>"`
 *     invocation (an older CLI, or a settings.json entry not yet cut over), mapping
 *     the SAME `run` result to stdout that the CLI runtime emits — so both paths are
 *     byte-identical. Wrapped so a failure here can never block session start.
 */

const CONTEXT = [
  '## Takumi — skill routing discipline',
  'Before doing substantive work, check whether a Takumi skill already covers it.',
  '- **1% rule:** if a task overlaps a skill’s purpose even slightly (implement, plan, debug, review, test, research, deploy, docs, estimate…), activate that skill instead of improvising.',
  '- **Lookup:** consult `.codex/skills/help/references/skill-catalog.md` (Use-for + Key-triggers per skill), or run `/tkm:help` when unsure which skill fits.',
  '- **Process skills win:** prefer `/tkm:takumi`, `/tkm:create-plan`, `/tkm:fix-bug`, `/tkm:review-code`, `/tkm:ship` over ad-hoc multi-step work.',
  '- **Red flags you skipped a skill:** writing code with no plan, debugging by guessing, shipping without review/tests, answering an architecture question from memory.',
].join('\n');

/**
 * Pure core: bootstrap ignores its input and always contributes the same context.
 * Returns a HookResult; performs no I/O and never exits.
 */
function run(_input, _ctx) {
  return { status: 'context', output: CONTEXT };
}

module.exports.run = run;
module.exports.meta = {
  events: ['SessionStart'],
  matchers: { SessionStart: 'startup|resume|clear|compact' },
  timeout: 10,
};

// Legacy self-exec: only when invoked directly as `node takumi-bootstrap.cjs`.
if (require.main === module) {
  try {
    const result = run({}, {});
    // Mirror the CLI runtime's context→stdout mapping so the two paths match.
    if (result && result.status === 'context' && result.output) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: result.output },
        }),
      );
    } else {
      process.stdout.write('{}');
    }
  } catch (_err) {
    // Swallow silently — session start must not be blocked by a dispatcher failure.
    process.stdout.write('{}');
  }
  process.exit(0);
}
