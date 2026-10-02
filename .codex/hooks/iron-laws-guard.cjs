#!/usr/bin/env node
'use strict';

/**
 * iron-laws-guard — PreToolUse / Edit+Write hook. Forge → Temper gate.
 *
 * Fires before every Edit or Write on a production source file and injects
 * the policy-aware Iron Law #1 reminder. RED-first remains the default;
 * explicitly declared MoMorph visual-contract work uses design evidence and
 * post-code visual validation instead. Skips test files,
 * config/fixture/migration files, .sun/ artifacts, and skills/.
 *
 * Always fail-open: a parse error must not block the Forge stage.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the CLI calls it in-process under `--eval`. The
 * `require.main === module` branch preserves the legacy `node "<path>"` invocation
 * (which streams stdin), delegating to the shared self-exec helper.
 */

const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const IRON_LAW_REMINDER =
  "🔴 Iron Law #1 Reminder: Production code is about to change. Default policy is RED-first: prove the relevant test fails before editing. Exception: an explicitly declared MoMorph visual-contract may implement presentational UI first, but must record design evidence and complete compile/lint, coverage, and tester-owned visual validation afterward. Never use visual-contract for behavior or backend logic.";

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rs|java)$/;
const IS_TEST_FILE = /\.(test|spec|e2e)\.(ts|tsx|js|jsx|py)$/;
const IS_CONFIG = /(config|setup|fixture|mock|stub|seed|migration)/;
const IS_SUN_FILE = /\.sun\//;
const IS_SKILL_FILE = /skills\//;

/**
 * Pure decision. Returns `{status:'context'}` with the Iron Law reminder when a
 * production source file is about to be edited/written, else `{status:'ok'}`.
 * Fail-open: any internal error → allow silently.
 */
function run(input, _ctx) {
  try {
    const event = input.hook_event_name || '';
    const tool = input.tool_name || '';
    if (event !== 'PreToolUse' || !['Edit', 'Write'].includes(tool)) return { status: 'ok' };

    const filePath = (input.tool_input && input.tool_input.file_path) || '';
    if (!SOURCE_EXTENSIONS.test(filePath)) return { status: 'ok' };

    if (IS_TEST_FILE.test(filePath) || IS_CONFIG.test(filePath) || IS_SUN_FILE.test(filePath) || IS_SKILL_FILE.test(filePath)) {
      return { status: 'ok' };
    }

    return { status: 'context', output: IRON_LAW_REMINDER };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['PreToolUse'],
  matchers: { PreToolUse: 'Edit|Write' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
