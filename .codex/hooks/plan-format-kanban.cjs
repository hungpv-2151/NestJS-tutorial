#!/usr/bin/env node
'use strict';

/**
 * plan-format-kanban — PostToolUse hook. Blueprint stage.
 *
 * Fires after Edit/Write on any plan.md and enforces two Blueprint invariants:
 *   1. Phase link text must be human-readable, not raw filenames.
 *   2. Status column in the phases table must be updated via `ck plan check`
 *      rather than hand-edited — direct edits break canonical format.
 *
 * Reads the written file from disk; issues warnings as additionalContext but
 * always allows — never blocks the Blueprint commit. Fail-open.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the `require.main === module` branch preserves
 * the legacy `node "<path>"` invocation.
 */

const fs = require('fs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

// Matches: | 1 | [phase-01a-some-name.md](./...) — filename used as link text.
const BAD_LINK_PATTERN = /\|\s*\d+[a-z]?\s*\|\s*\[phase-\d+[a-z]?-[^\]]*\.md\]\(/gi;
const TABLE_ROW = /^\|\s*\d+[a-z]?\s*\|/i;
const STATUS_CELL = /\|\s*(Pending|In Progress|In-Progress|Completed|Complete|Done|Active|WIP)\s*\|/i;

/**
 * Pure decision. Returns `{status:'context'}` with formatting warnings for a
 * plan.md edit, else `{status:'ok'}`. Fail-open: any error → allow silently.
 */
function run(input, _ctx) {
  try {
    const toolName = input.tool_name || '';
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    if (!filePath.endsWith('/plan.md')) return { status: 'ok' };
    if (!fs.existsSync(filePath)) return { status: 'ok' };

    // Read the committed file — tool_input content may be a patch, not the full file.
    const content = fs.readFileSync(filePath, 'utf8');
    const warnings = [];

    const matches = content.match(BAD_LINK_PATTERN);
    if (matches && matches.length > 0) {
      warnings.push(
        '[!] plan.md: Link text should be human-readable, not filenames.',
        `    Found ${matches.length} instance(s) using filename as link text.`,
        '    Bad:  [phase-01-setup.md](./phase-01-setup.md)',
        '    Good: [Setup Environment](./phase-01-setup.md)',
        '    Update link text to descriptive phase names for better readability.'
      );
    }

    if (toolName === 'Edit' || toolName === 'Write') {
      const toolOutput = input.tool_input?.new_string || input.tool_input?.content || '';
      const editingTableStatus = (toolOutput || '')
        .split('\n')
        .some((line) => TABLE_ROW.test(line) && STATUS_CELL.test(line));
      if (editingTableStatus) {
        warnings.push(
          '\n[Plan Status Warning] Direct status edit detected in phases table.',
          'Canonical format: | Phase | Name | Status | (3-column table)',
          'Use CLI for deterministic status updates:',
          '  ck plan check <id>          # Mark completed',
          '  ck plan check <id> --start  # Mark in-progress',
          '  ck plan uncheck <id>        # Revert to pending',
          'Direct edits may break canonical format.'
        );
      }
    }

    return warnings.length > 0 ? { status: 'context', output: warnings.join('\n') } : { status: 'ok' };
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
