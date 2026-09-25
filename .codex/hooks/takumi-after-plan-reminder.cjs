#!/usr/bin/env node
'use strict';

/**
 * takumi-after-plan-reminder — SubagentStop hook (Plan agent). Bridges Blueprint to Forge.
 *
 * Fires when the Plan subagent finishes. Reminds the session to invoke
 * /tkm:takumi --auto before touching any code, and emits the absolute plan path
 * (from session state) so sessions after /clear (or in a worktree) can locate it.
 *
 * Fail-open: the reminder must never halt the session.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the `require.main === module` branch preserves
 * the legacy `node "<path>"` invocation.
 */

const path = require('path');
const { isHookEnabled, readSessionState } = require('./lib/tkm-config-utils.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

/**
 * Pure decision. Always returns the post-plan reminder as `context` (with the
 * absolute plan path when session state carries it), or `{status:'ok'}` when
 * disabled. Fail-open on any internal error.
 */
function run(_input, _ctx) {
  try {
    if (!isHookEnabled('takumi-after-plan-reminder')) return { status: 'ok' };

    // Resolve the active plan path from session state; ensure it's absolute.
    const sessionId = process.env.TKM_SESSION_ID;
    let planPath = null;
    if (sessionId) {
      const state = readSessionState(sessionId);
      if (state?.activePlan) {
        planPath = state.activePlan;
        if (!path.isAbsolute(planPath) && state.sessionOrigin) {
          planPath = path.resolve(state.sessionOrigin, planPath);
        }
      }
    }

    const lines = ['MUST invoke /tkm:takumi --auto skill before implementing the plan'];
    if (planPath) {
      lines.push(`Best Practice: Run /clear then /tkm:takumi ${path.join(planPath, 'plan.md')}`);
    } else {
      lines.push('Best Practice: Run /clear then /tkm:takumi {full-absolute-path-to-plan.md}');
    }
    return { status: 'context', output: lines.join('\n') };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['SubagentStop'],
  matchers: { SubagentStop: 'Plan' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
