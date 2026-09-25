#!/usr/bin/env node
'use strict';

/**
 * session-state — persists Forge progress so the next Study finds solid ground.
 *
 * Genuinely kit-owned residual (no full CLI replacement): the CLI intentionally
 * leaves persist/restore kit-side (see the CLI's install-statusline.ts, which
 * supersedes session-state on PostToolUse ONLY and keeps the SessionStart/Stop/
 * SubagentStop load+persist roles here).
 *
 * Slim dual-mode form:
 *   - SessionStart (startup|compact) → RESTORE: emit the previous / post-compaction
 *     state as context.
 *   - Stop / SubagentStop → PERSIST: write the markdown snapshot (+ archive/prune).
 *   - The old PostToolUse activity-refresh role is DROPPED — the CLI's
 *     `session-activity` built-in owns the statusline activity cache now.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (persist/restore side effects, but no stdin/stdout/exit); the
 * `require.main === module` branch preserves the legacy `node "<path>"` invocation.
 */

const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
const { loadState, persistState } = require('./lib/session-state-manager.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

/** Build the restore-context text for a startup vs post-compaction resume. */
function renderRestore(state, isCompact) {
  if (isCompact) {
    return [
      '',
      '--- Session State (Post-Compaction Recovery) ---',
      state,
      '--- End Session State ---',
      '',
      'Context was compacted. Above is your last saved progress. Resume from where you left off.',
      'IMPORTANT: Re-read active plan files and todo list. Do NOT re-do completed work.',
    ].join('\n');
  }
  return [
    '',
    '--- Previous Session State ---',
    state,
    '--- End Session State ---',
    '',
    'Review above state from your last session. Continue where you left off or start fresh.',
  ].join('\n');
}

/**
 * Pure decision. Persists on Stop/SubagentStop; restores on SessionStart. Reads
 * no stdin, writes no stdout, never exits — the caller owns process I/O.
 * Fail-open: any error → allow silently (`{status:'ok'}`).
 */
function run(input, _ctx) {
  try {
    if (!isHookEnabled('session-state')) return { status: 'ok' };
    const eventType = input.hook_event_name || null;

    if (eventType === 'Stop' || eventType === 'SubagentStop') {
      persistState(input, { eventType });
      return { status: 'ok' };
    }

    // SessionStart restore — also covers the legacy no-event-name wiring.
    if (eventType === 'SessionStart' || !eventType) {
      const isCompact = input.source === 'compact';
      // Only startup / compact resume restores; resume/clear do not.
      if (input.source && input.source !== 'startup' && !isCompact) return { status: 'ok' };
      const state = loadState(input.cwd || process.cwd());
      if (!state) return { status: 'ok' };
      return { status: 'context', output: renderRestore(state, isCompact) };
    }

    return { status: 'ok' };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['SessionStart', 'Stop', 'SubagentStop'],
  matchers: { SessionStart: 'startup|resume|clear|compact' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
