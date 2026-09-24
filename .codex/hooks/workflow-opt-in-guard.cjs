#!/usr/bin/env node
'use strict';

/**
 * workflow-opt-in-guard.cjs — PreToolUse guard: blocks the Workflow tool unless
 * the user's latest prompt explicitly opts in with the word "workflow".
 *
 * Deterministic floor under the (soft) markdown rule in
 * .codex/rules/orchestration-protocol.md → "Workflow Tool (Opt-In Only)".
 * The Workflow tool fans out many subagents and is expensive, so a stray call
 * is costly — worth a hard stop, not just an instruction.
 *
 * PreToolUse payloads carry no prompt, so the most recent human-typed message is
 * read from the transcript tail (transcript_path). Tool-result entries (also
 * recorded under role:user) are skipped — only genuine typed prompts count.
 *
 * Fail-CLOSED: when opt-in can't be verified the call is denied — the safe
 * default for an opt-in tool (deliberately against the house fail-open style).
 * The fail-closed posture lives INSIDE `run` (it returns a deny on any internal
 * error), and the self-exec `onError` denies too, so both entry paths agree.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the `require.main === module` branch preserves
 * the legacy `node "<path>"` invocation.
 *
 * Disable via .tkm.json → hooks."workflow-opt-in-guard": false.
 */

const fs = require('fs');
const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const REASON = 'The Workflow tool is opt-in and stays blocked until the user\'s most recent chat message literally contains the word "workflow". A confirmation prompt or menu choice (e.g. AskUserQuestion) does NOT count and will not unblock it — only a new typed user message that includes the word "workflow" will. So either continue with an alternative such as the Task tool, or ask the user to resend their request with the word "workflow" in it (e.g. "run this as a workflow"), then call Workflow again.';

const COULD_NOT_VERIFY = 'The Workflow tool is opt-in and the guard could not verify opt-in. Use an alternative approach such as the Task tool, or ask the user to re-request explicitly with the word "workflow".';

/** Deny result used whenever the guard cannot confirm an explicit opt-in. */
function deny(reason) {
  return { status: 'deny', denyReason: reason };
}

/**
 * Most recent human-typed prompt from the transcript tail, or null.
 * Walks entries backward; skips assistant turns and tool_result entries
 * (which also carry role:user) so only real typed prompts are considered.
 */
function lastHumanPrompt(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').slice(-150);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch (_) { continue; }
    if (entry.type !== 'user' || !entry.message || entry.message.role !== 'user') continue;

    const content = entry.message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const text = content.filter((b) => b && b.type === 'text').map((b) => b.text).join(' ').trim();
      if (text) return text; // genuine typed prompt
      // otherwise a tool_result-only entry — keep walking back
    }
  }
  return null;
}

/**
 * Pure decision. Allow (`{status:'ok'}`) when disabled, when the tool is not
 * Workflow, or when the latest typed prompt contains "workflow". Otherwise deny
 * (fail-closed). Any internal error also denies — an opt-in tool defaults blocked.
 */
function run(input, _ctx) {
  try {
    let enabled = true;
    try { enabled = isHookEnabled('workflow-opt-in-guard'); } catch (_) { /* config error → treat as enabled */ }
    if (!enabled) return { status: 'ok' };

    if (input.tool_name && input.tool_name !== 'Workflow') return { status: 'ok' };

    const prompt = lastHumanPrompt(input.transcript_path);
    const optedIn = prompt !== null && prompt.toLowerCase().includes('workflow');
    return optedIn ? { status: 'ok' } : deny(REASON);
  } catch (_) {
    return deny(COULD_NOT_VERIFY);
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['PreToolUse'],
  matchers: { PreToolUse: 'Workflow' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run, { onError: () => deny(COULD_NOT_VERIFY) });
}
