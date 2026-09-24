#!/usr/bin/env node
'use strict';

/**
 * post-edit-simplify-reminder — PostToolUse / Edit+Write+MultiEdit hook. Forge → Inspect gate.
 *
 * Counts file edits across the session and injects a code-simplifier reminder
 * after the threshold is reached, nudging toward the Inspect stage before the
 * review window closes. Counter resets when the simplifier runs.
 *
 * Threshold: 5+ distinct file edits → reminder (no more than once per 10 min).
 * Session state persisted to OS temp dir; auto-expires after 2 hours. Fail-open.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (its file writes — git-cache invalidation + the session tracker — are
 * the hook's intended side effects, not I/O to the agent; no stdout/exit). The
 * `require.main === module` branch preserves the legacy `node "<path>"` invocation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
const { invalidateCache } = require('./lib/git-info-cache.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const SESSION_TRACK_FILE = path.join(os.tmpdir(), 'tkm-simplify-session.json');
const EDIT_THRESHOLD = 5;
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit'];

function initSessionData() {
  return { startTime: Date.now(), editCount: 0, modifiedFiles: [], lastReminder: 0, simplifierRun: false };
}

/** Load session tracking data, or initialize fresh if missing or stale (>2 h). */
function loadSessionData() {
  try {
    if (fs.existsSync(SESSION_TRACK_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_TRACK_FILE, 'utf8'));
      if (Date.now() - data.startTime > 2 * 60 * 60 * 1000) return initSessionData();
      return data;
    }
  } catch (_) {
    // Ignore errors, reinitialize.
  }
  return initSessionData();
}

function saveSessionData(data) {
  try {
    fs.writeFileSync(SESSION_TRACK_FILE, JSON.stringify(data, null, 2));
  } catch (_) {
    // Ignore write errors — best-effort.
  }
}

/**
 * Pure decision (with the hook's own tracking side effects). Counts the edit and
 * returns a `context` reminder once the threshold is crossed, else `{status:'ok'}`.
 * Fail-open: any error → allow silently.
 */
function run(input, _ctx) {
  try {
    if (!isHookEnabled('post-edit-simplify-reminder')) return { status: 'ok' };

    const toolName = input.tool_name || '';
    if (!EDIT_TOOLS.includes(toolName)) return { status: 'ok' };

    // Invalidate git cache so the statusline reflects the working tree. Use the
    // payload cwd (not process.cwd()) to handle subagent CWD mismatch.
    invalidateCache(input.cwd || process.cwd());

    const session = loadSessionData();
    session.editCount++;
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    if (filePath && !session.modifiedFiles.includes(filePath)) session.modifiedFiles.push(filePath);

    const shouldRemind =
      session.editCount >= EDIT_THRESHOLD &&
      !session.simplifierRun &&
      Date.now() - session.lastReminder > 10 * 60 * 1000;

    let output = '';
    if (shouldRemind) {
      session.lastReminder = Date.now();
      output = `\n\n[Code Simplification Reminder] You have modified ${session.modifiedFiles.length} files in this session. Consider using the \`code-simplifier\` agent to refine recent changes before proceeding to code review. This is a MANDATORY step in the workflow.`;
    }
    saveSessionData(session);

    return output ? { status: 'context', output } : { status: 'ok' };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['PostToolUse'],
  matchers: { PostToolUse: 'Edit|Write|MultiEdit' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
