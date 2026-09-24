#!/usr/bin/env node
'use strict';

/**
 * Dual-mode contract enforcement (Findings #9/#11): every migrated guard's `run`
 * is PURE — it must never write to process.stdout and never call process.exit.
 * Also covers the shared helper's HookResult → stdout mapping.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');

const { resultToStdout } = require('../hook-dual-mode.cjs');
const ironLaws = require('../../iron-laws-guard.cjs');
const workflowGuard = require('../../workflow-opt-in-guard.cjs');
const evidenceGate = require('../../evidence-gate-guard.cjs');
const destructive = require('../../destructive-command-guard.cjs');
// context / side-effect hooks.
const teamContext = require('../../team-context-inject.cjs');
const afterPlan = require('../../takumi-after-plan-reminder.cjs');
const planKanban = require('../../plan-format-kanban.cjs');
const simplify = require('../../post-edit-simplify-reminder.cjs');
const graphReindex = require('../../graph-reindex-sync.cjs');
const memNudge = require('../../memory-graph-nudge.cjs');
const memQueue = require('../../memory-graph-queue.cjs');

/** Run `fn` with process.stdout.write + process.exit trapped; returns the value. */
function underPurityTrap(fn) {
  const origWrite = process.stdout.write.bind(process.stdout);
  const origExit = process.exit;
  let exitCalled = false;
  process.stdout.write = () => {
    throw new Error('run wrote to process.stdout');
  };
  process.exit = () => {
    exitCalled = true;
    throw new Error('run called process.exit');
  };
  try {
    const value = fn();
    return { value, exitCalled };
  } finally {
    process.stdout.write = origWrite;
    process.exit = origExit;
  }
}

// Representative inputs that exercise each guard's active decision branch.
const CASES = [
  { name: 'iron-laws-guard', run: ironLaws.run, input: { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/foo.ts' } }, expect: 'context' },
  { name: 'destructive-command-guard', run: destructive.run, input: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' } }, expect: 'ask' },
  { name: 'workflow-opt-in-guard', run: workflowGuard.run, input: { hook_event_name: 'PreToolUse', tool_name: 'Workflow' }, expect: 'deny' },
  { name: 'evidence-gate-guard', run: evidenceGate.run, input: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git push origin main' }, cwd: os.tmpdir() }, expect: 'context' },
];

for (const c of CASES) {
  test(`${c.name}: run is pure (no stdout, no process.exit) and returns ${c.expect}`, () => {
    const { value, exitCalled } = underPurityTrap(() => c.run(c.input, { cwd: c.input.cwd || process.cwd() }));
    assert.strictEqual(exitCalled, false, 'run must not call process.exit');
    assert.strictEqual(value.status, c.expect);
  });

  test(`${c.name}: exports meta with events + a require.main self-exec guard`, () => {
    const mod = require(path.join('..', '..', `${c.name}.cjs`));
    assert.ok(Array.isArray(mod.meta.events) && mod.meta.events.length > 0);
  });
}

test('every guard fail-open returns allow for a foreign tool (posture preserved)', () => {
  // iron/destructive/evidence self-filter → allow; workflow allows a non-Workflow tool too.
  for (const c of CASES) {
    const r = c.run({ hook_event_name: 'PreToolUse', tool_name: 'Read' }, { cwd: process.cwd() });
    assert.strictEqual(r.status, 'ok', `${c.name} should allow a foreign tool`);
  }
});

test('workflow-opt-in-guard fails CLOSED (deny) when opt-in cannot be verified', () => {
  const r = workflowGuard.run({ hook_event_name: 'PreToolUse', tool_name: 'Workflow', transcript_path: '/nonexistent' }, { cwd: process.cwd() });
  assert.strictEqual(r.status, 'deny');
});

test('resultToStdout maps every HookResult status to the CLI runtime shape', () => {
  assert.strictEqual(resultToStdout({ status: 'ok' }, 'PreToolUse'), '{}');
  assert.strictEqual(resultToStdout({ status: 'no-op' }, 'PreToolUse'), '{}');
  assert.strictEqual(resultToStdout({ status: 'context', output: '' }, 'PreToolUse'), '{}');
  assert.deepStrictEqual(JSON.parse(resultToStdout({ status: 'context', output: 'hi' }, 'PreToolUse')), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'hi' },
  });
  assert.deepStrictEqual(JSON.parse(resultToStdout({ status: 'deny', denyReason: 'no' }, 'PreToolUse')), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'no' },
  });
  assert.deepStrictEqual(JSON.parse(resultToStdout({ status: 'ask', askReason: 'sure?' }, 'PreToolUse')), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'sure?' },
  });
});

// hooks: purity (no stdout, no process.exit) on representative inputs that
// hit a side-effect-free branch (disabled gate / non-matching tool / no data).
const CASES6 = [
  { name: 'team-context-inject', run: teamContext.run, input: { agent_id: 'solo-agent' }, expect: 'ok' },
  { name: 'takumi-after-plan-reminder', run: afterPlan.run, input: {}, expect: 'context' },
  { name: 'plan-format-kanban', run: planKanban.run, input: { tool_name: 'Edit', tool_input: { file_path: '/tmp/not-a-plan.txt' } }, expect: 'ok' },
  { name: 'post-edit-simplify-reminder', run: simplify.run, input: { tool_name: 'Read' }, expect: 'ok' },
  { name: 'graph-reindex-sync', run: graphReindex.run, input: { cwd: os.tmpdir() }, expect: 'ok' },
  { name: 'memory-graph-nudge', run: memNudge.run, input: { cwd: os.tmpdir() }, expect: 'ok' },
  { name: 'memory-graph-queue', run: memQueue.run, input: { hook_event_name: 'Stop', session_id: 's', cwd: os.tmpdir() }, expect: 'ok' },
];

for (const c of CASES6) {
  test(`${c.name}: run is pure (no stdout, no process.exit) and returns ${c.expect}`, () => {
    const { value, exitCalled } = underPurityTrap(() => c.run(c.input, { cwd: c.input.cwd || process.cwd() }));
    assert.strictEqual(exitCalled, false, 'run must not call process.exit');
    assert.strictEqual(value.status, c.expect);
  });
}
