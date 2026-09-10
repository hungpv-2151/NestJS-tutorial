#!/usr/bin/env node
'use strict';

/**
 * destructive-command-guard.cjs — PreToolUse[Bash] guard: flags destructive shell
 * commands (rm -rf, DROP TABLE, git push --force, git reset --hard, kubectl delete)
 * and asks the user to confirm before they run, instead of letting them execute
 * silently.
 *
 * All verb/flag/allowlist policy lives in lib/destructive-command-detector.cjs — this
 * file is a thin caller, never a second implementation of that policy (same split as
 * evidence-gate-guard.cjs / lib/stage-detector.cjs).
 *
 * Only two outcomes: `ask` (destructive, not allowlisted) or allow (`{}`) — this guard
 * never `deny`s. Fail-open on any internal error (bad input, detector throwing): a bug
 * here must never wedge a Bash call, and since the hook never denies, fail-open just
 * means "don't nag," never "silently allow something risky" that wasn't already going
 * to be allowed.
 *
 * Bypass: `.tkm.json` -> hooks."destructive-command-guard": false disables the hook
 * entirely.
 *
 * Logging: the hook-log `note` field carries the matched pattern NAME only (e.g.
 * "git reset --hard") — never the raw command string. The permissionDecisionReason
 * shown to the user in the live prompt may still name the pattern for legibility;
 * that's ephemeral UI, not a persisted log write.
 *
 * Registered for matcher "Bash"; emits permissionDecision/allow, exit 0 always — same
 * convention as evidence-gate-guard.cjs.
 */

const fs = require('fs');

function emitAsk(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
}

function emitAllow() {
  process.stdout.write(JSON.stringify({}));
}

try {
  const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
  const { createHookTimer, logHookCrash } = require('./lib/hook-logger.cjs');
  const timer = createHookTimer('destructive-command-guard', { event: 'PreToolUse', tool: 'Bash' });

  let enabled = true;
  try { enabled = isHookEnabled('destructive-command-guard'); } catch (_) { /* config error -> treat as enabled */ }
  if (!enabled) { timer.end({ status: 'ok', note: 'disabled' }); emitAllow(); process.exit(0); }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch (_) {
    // Unparseable payload — fail OPEN, same posture as every other guard in this kit.
    timer.end({ status: 'ok', exit: 0, note: 'bad-input-fail-open' });
    emitAllow();
    process.exit(0);
  }

  if (data.tool_name && data.tool_name !== 'Bash') {
    timer.end({ status: 'ok', note: 'not-bash' });
    emitAllow();
    process.exit(0);
  }

  const { detectDestructive } = require('./lib/destructive-command-detector.cjs');
  const bashCommand = data.tool_input && data.tool_input.command;
  const hit = detectDestructive(bashCommand);

  if (!hit) {
    timer.end({ status: 'ok', note: 'no-match' });
    emitAllow();
    process.exit(0);
  }

  if (hit.allowlisted) {
    timer.end({ status: 'ok', note: `${hit.pattern} (allowlisted)` });
    emitAllow();
    process.exit(0);
  }

  timer.end({ status: 'ask', note: hit.pattern });
  emitAsk(
    `Destructive command guard: this looks like "${hit.pattern}". ` +
    `Confirm this is intentional before it runs. Disable via .tkm.json -> ` +
    `hooks."destructive-command-guard": false if this is a false positive you hit often.`
  );
  process.exit(0);

} catch (e) {
  try {
    require('./lib/hook-logger.cjs').logHookCrash('destructive-command-guard', e, { event: 'PreToolUse', tool: 'Bash', exit: 0 });
  } catch (_) { /* logger must never crash the hook */ }
  emitAllow();
  process.exit(0);
}
