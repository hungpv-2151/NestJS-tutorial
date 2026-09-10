#!/usr/bin/env node
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
 */

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const event = data.hook_event_name || '';
    const tool = data.tool_name || '';
    const toolInput = data.tool_input || {};

    // Only pre-write production-code events trigger the TDD reminder.
    if (event !== 'PreToolUse' || !['Edit', 'Write'].includes(tool)) {
      process.stdout.write('{}');
      return;
    }

    const filePath = toolInput.file_path || '';

    // Non-source files carry no TDD obligation
    const sourceExtensions = /\.(ts|tsx|js|jsx|py|go|rs|java)$/;
    if (!sourceExtensions.test(filePath)) {
      process.stdout.write('{}');
      return;
    }

    // Skip test files, config files, and .sun/ artifacts
    const isTestFile = /\.(test|spec|e2e)\.(ts|tsx|js|jsx|py)$/.test(filePath);
    const isConfig = /(config|setup|fixture|mock|stub|seed|migration)/.test(filePath);
    const isSunFile = /\.sun\//.test(filePath);
    const isSkillFile = /skills\//.test(filePath);

    if (isTestFile || isConfig || isSunFile || isSkillFile) {
      process.stdout.write('{}');
      return;
    }

    // Production code touched — remind without contradicting visual-contract.
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: "🔴 Iron Law #1 Reminder: Production code is about to change. Default policy is RED-first: prove the relevant test fails before editing. Exception: an explicitly declared MoMorph visual-contract may implement presentational UI first, but must record design evidence and complete compile/lint, coverage, and tester-owned visual validation afterward. Never use visual-contract for behavior or backend logic."
      }
    }));
  } catch (e) {
    // Fail open
    process.stdout.write('{}');
  }
});
