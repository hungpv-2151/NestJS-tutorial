'use strict';

/**
 * hook-dual-mode.cjs — shared self-exec runner for dual-mode kit hooks.
 *
 * A dual-mode hook exports a PURE `run(input, ctx)` (returns a HookResult; no
 * stdin/stdout/exit) plus a `require.main === module` branch that, for the legacy
 * `node "<path>"` invocation, does the I/O. This helper IS that branch's body:
 * read the event payload from fd 0, call `run`, map the returned HookResult to the
 * exact stdout shape the takumi CLI's `--eval` runtime emits, and exit 0. Both
 * entry paths therefore produce byte-identical output.
 *
 * The CLI runtime owns observability under `--eval`; this helper does not log.
 *
 * Fail posture lives in each hook's `run` (it catches internally and returns its
 * allow/deny result). This helper adds only a last-resort net: if `run` throws, it
 * emits `onError(err)`'s result — a fail-CLOSED hook passes an `onError` returning
 * its deny; the default is fail-OPEN (`{}`).
 */

const fs = require('fs');

/** Parse the fd-0 JSON payload; returns null when stdin is empty/unreadable. */
function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch (_) {
    return null;
  }
}

/**
 * Map a HookResult to the CLI runtime's stdout JSON (see hook-exec-dispatch.ts:
 * emitDeny / emitAsk / emitContext). `ok` / `record` / `no-op` and an empty
 * `context` output all serialize to `{}` (silent allow).
 */
function resultToStdout(result, event) {
  const e = event || 'PreToolUse';
  if (result && result.status === 'deny') {
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: e, permissionDecision: 'deny', permissionDecisionReason: result.denyReason || '' },
    });
  }
  if (result && result.status === 'ask') {
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: e, permissionDecision: 'ask', permissionDecisionReason: result.askReason || '' },
    });
  }
  if (result && result.status === 'context' && result.output) {
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: e, additionalContext: result.output },
    });
  }
  return '{}';
}

/**
 * Body of a hook's `require.main === module` branch.
 * @param {(input: object, ctx: object) => (object|Promise<object>)} run pure core
 * @param {{ onError?: (err: unknown) => object }} [opts] onError returns the
 *   HookResult to emit if `run` throws (fail-closed hooks return a deny; default
 *   fail-open `{}`).
 */
async function runSelfExec(run, opts = {}) {
  const input = readStdinJson() || {};
  const event = input.hook_event_name || 'PreToolUse';
  let result;
  try {
    const ctx = { cwd: input.cwd || process.cwd(), sessionId: input.session_id || '', event };
    result = await run(input, ctx);
  } catch (err) {
    result = opts.onError ? opts.onError(err) : { status: 'ok' };
  }
  process.stdout.write(resultToStdout(result, event));
  process.exit(0);
}

module.exports = { runSelfExec, resultToStdout, readStdinJson };
