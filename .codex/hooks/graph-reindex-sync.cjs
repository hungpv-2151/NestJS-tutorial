#!/usr/bin/env node
'use strict';

/**
 * graph-reindex-sync — SessionStart hook. Keeps the knowledge graph's CODE layer fresh.
 *
 * When graphify is enabled AND available, spawns `graphify update .` — a code-only,
 * AST, NO-LLM re-extraction — DETACHED (never blocks) and THROTTLED via a lock
 * marker. Also nudges (advisory) when docs changed since the graph was built.
 *
 * Zero-impact when disabled (config graphify.enabled=false, env GRAPHIFY_DISABLE=1 /
 * REBUILD_NO_GRAPH=1, or hook toggled off). Fail-open.
 *
 * Security: never resolves the graphify binary from a repo-tracked file — only
 * GRAPHIFY_BIN (test seam) or `graphify` on PATH. Never writes to .git/hooks.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (its detached spawn + lock/marker writes are the hook's intended side
 * effects; no stdout/exit). The `require.main === module` branch preserves the
 * legacy `node "<path>"` invocation.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { isHookEnabled, isGraphifyEnabled } = require('./lib/tkm-config-utils.cjs');
const { locateGraphify, tmpMarker, recentlyTouched } = require('./lib/graphify-cli.cjs');
const docs = require('./lib/graph-docs-staleness.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const REINDEX_THROTTLE_MS = 10 * 60 * 1000; // don't re-spawn within 10 min / while one is in flight

function isGitRepo(dir) {
  try { return fs.existsSync(path.join(dir, '.git')); } catch { return false; }
}

function ensureGitignore(projectDir) {
  try {
    const gi = path.join(projectDir, '.gitignore');
    const existing = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!existing.includes('graphify-out')) {
      const sep = (existing === '' || existing.endsWith('\n')) ? '' : '\n';
      fs.appendFileSync(gi, sep + 'graphify-out/\n');
    }
  } catch { /* best-effort */ }
}

/** Spawn `graphify update .` detached (code-only, no-LLM). Returns true if launched. */
function spawnCodeReindex(argv, projectDir) {
  try {
    const child = spawn(argv[0], [...argv.slice(1), 'update', '.'], {
      cwd: projectDir, detached: true, stdio: 'ignore', windowsHide: true,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure decision (with the hook's own graph side effects). Returns `context` with
 * any docs/build nudges (else `{status:'ok'}`), after spawning the detached
 * code-reindex when due. Fail-open: any error → allow silently.
 */
function run(input, _ctx) {
  try {
    if (!isHookEnabled('graph-reindex-sync')) return { status: 'ok' };

    const projectDir = input.cwd || process.cwd();
    if (!isGraphifyEnabled()) return { status: 'ok' };

    const graphDir = path.join(projectDir, 'graphify-out');
    const graphPath = path.join(graphDir, 'graph.json');
    const graphExists = fs.existsSync(graphPath);

    const parts = [];
    const argv = locateGraphify();

    // Docs freshness (advisory, throttled). Read built_at_commit BEFORE spawning
    // the code re-index so a concurrent `graphify update` can't change it mid-read.
    if (graphExists) {
      const { paths, uncommittedCount, head } = docs.detectStaleDocs(projectDir, graphPath);
      if (paths.length > 0 && !docs.alreadyNudged(graphDir, head, uncommittedCount)) {
        docs.recordNudge(graphDir, head, uncommittedCount);
        parts.push(docs.buildNudge(paths));
      }
    }

    // Code freshness: refresh/create the CODE graph (no-LLM), detached + throttled.
    if (argv && (graphExists || isGitRepo(projectDir))) {
      const lock = path.join(graphDir, '.reindex.lock');
      if (!recentlyTouched(lock, REINDEX_THROTTLE_MS)) {
        try { fs.mkdirSync(graphDir, { recursive: true }); } catch { /* ignore */ }
        try { fs.writeFileSync(lock, String(Date.now())); } catch { /* ignore */ }
        ensureGitignore(projectDir);
        spawnCodeReindex(argv, projectDir);
      }
    } else if (!argv && !graphExists && isGitRepo(projectDir)) {
      // graphify not installed and no graph yet → nudge once/day to build it.
      const marker = tmpMarker('graphify-build-nudge', projectDir);
      if (!recentlyTouched(marker, 24 * 60 * 60 * 1000)) {
        try { fs.writeFileSync(marker, String(Date.now())); } catch { /* ignore */ }
        parts.push('Knowledge graph: run `/tkm:rebuild-spec` once to build the code knowledge graph (installs graphify, indexes the repo). After that it refreshes automatically each session. For a docs-first project (specs/RFPs, little or no code yet), run `/tkm:index-docs` instead — it indexes the documents, which the code-only refresh never touches.');
      }
    }

    return parts.length ? { status: 'context', output: parts.join('\n\n') } : { status: 'ok' };
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
