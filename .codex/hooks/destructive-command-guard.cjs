#!/usr/bin/env node
'use strict';

/**
 * destructive-command-guard.cjs — PreToolUse[Bash] guard: flags destructive shell
 * commands (rm -rf, DROP TABLE, git push --force, git reset --hard, kubectl delete)
 * and asks the user to confirm before they run, instead of letting them execute
 * silently.
 *
 * All verb/flag/allowlist policy lives in lib/destructive-command-detector.cjs — this
 * file is a thin caller, never a second implementation of that policy.
 *
 * Only two outcomes: `ask` (destructive, not allowlisted) or allow (`{}`) — this guard
 * never `deny`s. Fail-OPEN on any internal error (bad input, detector throwing): a bug
 * here must never wedge a Bash call, and since the hook never denies, fail-open just
 * means "don't nag," never "silently allow something risky" that wasn't already going
 * to be allowed.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the CLI calls it in-process under `--eval`. The
 * `require.main === module` branch preserves the legacy `node "<path>"` invocation.
 *
 * Bypass: `.tkm.json` -> hooks."destructive-command-guard": false disables the hook.
 */

const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
const { detectDestructive } = require('./lib/destructive-command-detector.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

/**
 * Pure decision. Returns `{status:'ask'}` for a non-allowlisted destructive
 * command, else `{status:'ok'}` (allow). Fail-open: any internal error → allow.
 */
function run(input, _ctx) {
  try {
    let enabled = true;
    try { enabled = isHookEnabled('destructive-command-guard'); } catch (_) { /* config error -> treat as enabled */ }
    if (!enabled) return { status: 'ok' };

    if (input.tool_name && input.tool_name !== 'Bash') return { status: 'ok' };

    const bashCommand = input.tool_input && input.tool_input.command;
    const hit = detectDestructive(bashCommand);
    if (!hit || hit.allowlisted) return { status: 'ok' };

    return {
      status: 'ask',
      askReason:
        `Destructive command guard: this looks like "${hit.pattern}". ` +
        `Confirm this is intentional before it runs. Disable via .tkm.json -> ` +
        `hooks."destructive-command-guard": false if this is a false positive you hit often.`,
    };
  } catch (_) {
    // Fail-open — a guard bug must never wedge a Bash call.
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['PreToolUse'],
  matchers: { PreToolUse: 'Bash' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
