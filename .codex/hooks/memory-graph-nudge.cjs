#!/usr/bin/env node
'use strict';

/**
 * memory-graph-nudge — SessionStart hook. Detects queued conversation deltas
 * (written by memory-graph-queue.cjs, the Stop hook) and nudges Claude to fold
 * them into the tier-auto knowledge graph live, this session.
 *
 * The hook itself never calls the LLM — it only emits `additionalContext`. The
 * nudge routes through the `/graphify` skill (which dispatches in-session
 * subagents), never a bare CLI call that would fail on prose (.md) deltas.
 *
 * Opt-in: OFF by default (config memoryGraph.enabled=false), same gate as
 * memory-graph-queue.cjs. Fail-open.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (its throttle-marker write is the hook's intended side effect; no
 * stdout/exit). The `require.main === module` branch preserves the legacy
 * `node "<path>"` invocation.
 */

const fs = require('fs');
const path = require('path');
const { isHookEnabled, isMemoryGraphEnabled } = require('./lib/tkm-config-utils.cjs');
const { locateGraphify, tmpMarker, recentlyTouched } = require('./lib/graphify-cli.cjs');
const { resolveQueueDir } = require('./lib/memory-graph-queue-lib.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const NUDGE_THROTTLE_MS = 10 * 60 * 1000; // don't re-nudge within 10 min of the last nudge

/** Count raw .md files with no graph yet, or newer than the tier-auto graph.json. */
function countPending(queueDir, graphPath) {
  let files;
  try {
    files = fs.readdirSync(queueDir).filter((f) => f.endsWith('.md'));
  } catch {
    return 0;
  }
  if (!files.length) return 0;

  let graphMtime = 0;
  try { graphMtime = fs.statSync(graphPath).mtimeMs; } catch { /* no graph yet → every file counts */ }

  return files.filter((f) => {
    try { return fs.statSync(path.join(queueDir, f)).mtimeMs > graphMtime; }
    catch { return false; }
  }).length;
}

/** Nudge text branches on graphify availability. */
function buildNudge(count, queueDirRel, argv) {
  if (argv) {
    return (
      `Memory-graph: ${count} conversation delta(s) pending. Fold them into your personal ` +
      `knowledge graph now: run the \`/graphify\` skill with \`--update\` on \`${queueDirRel}\` ` +
      `— NOT a bare \`graphify ${queueDirRel} --update\` CLI call. Only the skill dispatches the ` +
      `in-session \`general-purpose\` subagents (the host session is the LLM, so no external API ` +
      `key is needed); the bare CLI would fail on these prose deltas with "no LLM API key found".`
    );
  }
  return (
    `Memory-graph: ${count} conversation delta(s) pending, but \`graphify\` isn't installed ` +
    `yet. Run the \`/graphify\` skill on \`${queueDirRel}\` (not a bare CLI call) — its own ` +
    `Step 1 self-installs the package (\`uv tool install graphifyy\` / \`pip install\`), then ` +
    `continue straight into \`--update\` on the same path. One-time cost; every session after ` +
    `this one just needs the shorter \`/graphify --update\` skill nudge above.`
  );
}

/**
 * Pure decision (with the hook's own throttle-marker side effect). Returns a
 * `context` nudge when deltas are pending and not throttled, else `{status:'ok'}`.
 * Fail-open: any error → allow silently.
 */
function run(input, _ctx) {
  try {
    if (!isHookEnabled('memory-graph-nudge') || !isMemoryGraphEnabled()) return { status: 'ok' };

    const cwd = input.cwd || process.cwd();
    const queueDir = resolveQueueDir(cwd); // <cwd>/memory-graph-out/raw (gitignored)
    const graphPath = path.join(queueDir, 'graphify-out', 'graph.json');
    const pending = countPending(queueDir, graphPath);
    if (pending === 0) return { status: 'ok' };

    const marker = tmpMarker('memory-graph-nudge', cwd);
    if (recentlyTouched(marker, NUDGE_THROTTLE_MS)) return { status: 'ok' };
    try { fs.writeFileSync(marker, String(Date.now())); } catch { /* best-effort */ }

    const argv = locateGraphify();
    const queueDirRel = path.relative(cwd, queueDir) || queueDir;
    return { status: 'context', output: buildNudge(pending, queueDirRel, argv) };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['SessionStart'],
  matchers: { SessionStart: 'startup|resume|clear|compact' },
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
