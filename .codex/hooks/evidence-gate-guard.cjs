#!/usr/bin/env node
'use strict';

/**
 * evidence-gate-guard.cjs — PreToolUse[Bash] guard: hard-blocks a ship action
 * (git push, gh pr create, wrangler deploy, npm publish) unless the located
 * plan's evidence/ directory carries a SEALED verdict.
 *
 * Stage detection (see lib/stage-detector.cjs): hard = the Bash command IS a
 * ship action -> verdict must be SEALED or deny. soft = no ship Bash command
 * yet, but the latest typed prompt names a ship verb -> advisory
 * `additionalContext` only. null = neither signal -> pass through silently.
 *
 * ALL verdict policy (SEALED, criticalCount, findings[]/location, etc.) lives
 * in hooks/lib/evidence-validator.cjs — this file is a thin caller.
 *
 * Fail behaviour: fail-OPEN on any internal error (bad input, locator/validator
 * throwing, no evidence dir located) — never wedge a session on the gate's own
 * bug. Fails CLOSED only when the validator reports a real hard-stage violation
 * against a FOUND evidence directory.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the `require.main === module` branch preserves
 * the legacy `node "<path>"` invocation.
 *
 * Bypass: `.tkm.json` -> hooks."evidence-gate-guard": false disables the hook
 * entirely. A typed prompt containing "--skip-tests" or "--skip-review"
 * downgrades a hard stage to advisory (artifacts intentionally absent).
 */

const fs = require('fs');
const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
const { detectStage } = require('./lib/stage-detector.cjs');
const { locateEvidenceDir } = require('./lib/evidence-dir-locator.cjs');
const { validateEvidence } = require('./lib/evidence-validator.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const SKIP_FLAG_RE = /--skip-(?:tests|review)\b/i;

/**
 * Most recent human-typed prompt from the transcript tail, or null. Mirrors
 * workflow-opt-in-guard.cjs's lastHumanPrompt: walks entries backward, skips
 * assistant turns and tool_result-only entries (which also carry role:user).
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
      if (text) return text;
      // otherwise a tool_result-only entry — keep walking back
    }
  }
  return null;
}

/** Build an actionable, path-only deny reason — never echoes artifact contents. */
function buildDenyReason(evidenceDir, result) {
  const top = result.blocking.slice(0, 3).map((b) => `  - ${b}`).join('\n');
  const more = result.blocking.length > 3 ? `\n  - …and ${result.blocking.length - 3} more` : '';
  return (
    `Ship blocked: evidence at "${evidenceDir}" is not SEALED (${result.blocking.length} issue(s)):\n` +
    `${top}${more}\n` +
    `Reproduce: node claude/skills/_shared/lib/evidence-gate.cjs --evidence-dir "${evidenceDir}" --stage hard\n` +
    `Bypass: disable via .tkm.json -> hooks."evidence-gate-guard": false, or include ` +
    `"--skip-tests"/"--skip-review" in your request to downgrade this check to advisory.`
  );
}

function context(note) {
  return { status: 'context', output: note };
}

/**
 * Pure decision. Returns `{status:'ok'}` (allow), `{status:'context'}` (advisory),
 * or `{status:'deny'}` (hard ship block). Fail-OPEN: any internal error → allow.
 */
function run(input, _ctx) {
  try {
    let enabled = true;
    try { enabled = isHookEnabled('evidence-gate-guard'); } catch (_) { /* config error -> treat as enabled */ }
    if (!enabled) return { status: 'ok' };

    if (input.tool_name && input.tool_name !== 'Bash') return { status: 'ok' };

    const bashCommand = input.tool_input && input.tool_input.command;
    const prompt = lastHumanPrompt(input.transcript_path);
    const { stage, signal } = detectStage({ bashCommand, prompt });
    if (!stage) return { status: 'ok' };

    // Intentional skip: user's request carries --skip-tests / --skip-review — the
    // artifacts are knowingly absent, so a hard stage downgrades to advisory.
    const skipRequested = SKIP_FLAG_RE.test(prompt || '');
    const effectiveStage = (stage === 'hard' && skipRequested) ? 'soft' : stage;

    if (effectiveStage === 'soft') {
      return context(
        `[evidence-gate] Ship intent detected (${signal}). When you actually push/PR/deploy, the ` +
        `evidence gate will check for a SEALED verdict in the plan's evidence/ directory.`
      );
    }

    // effectiveStage === 'hard' from here on.
    let evidenceDir;
    try {
      evidenceDir = locateEvidenceDir({ cwd: input.cwd, sessionId: input.session_id || process.env.TKM_SESSION_ID || null });
    } catch (_) {
      evidenceDir = null; // locator failure -> treat as "not found", fail open below
    }

    if (!evidenceDir) {
      // No evidence dir located at a hard stage fails OPEN (advisory), not closed:
      // an unlocatable dir is ambiguous, and hard-blocking every `git push` in repos
      // not using the plan-evidence flow would be a session-wedging false positive.
      return context(
        `[evidence-gate] Ship action detected (${signal}) but no evidence directory could be located ` +
        `(checked TKM_EVIDENCE_DIR, .codex/workflow-artifacts.json, and the active plan's evidence/ dir). ` +
        `Proceeding — set TKM_EVIDENCE_DIR or run through the plan-evidence workflow if this ship should have been gated.`
      );
    }

    const result = validateEvidence({ evidenceDir, stage: 'hard' });
    if (result.ok) return { status: 'ok' };

    return { status: 'deny', denyReason: buildDenyReason(evidenceDir, result) };
  } catch (_) {
    // Fail-open: an internal crash in the guard must never wedge a Bash call.
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['PreToolUse'],
  matchers: { PreToolUse: 'Bash' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
