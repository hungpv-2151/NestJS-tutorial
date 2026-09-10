#!/usr/bin/env node
'use strict';

/**
 * layout-signals.cjs — repository-shape detection for iac-routing-guard.
 *
 * Split out to keep the guard itself under the kit's 200-line file rule. These
 * helpers answer one question — does this repository use the AIDD multi-layer
 * layout — plus the `.tkm.json` opt-out lookup.
 *
 * Every function here fails SILENT: an unreadable directory or a malformed
 * config must never decide anything, because the caller is a routing nudge that
 * has to fail open.
 */

const fs = require('fs');
const path = require('path');

/**
 * Honour the kit's `.tkm.json` opt-out — `hooks."iac-routing-guard": false`.
 *
 * Read directly rather than through the base kit's config helper: extras must be
 * self-contained and cannot import another kit's lib. The tradeoff is a few
 * reimplemented lines; the alternative is a guard with no off switch, which is
 * how an occasionally-wrong nudge gets deleted along with the routing fix it
 * carries.
 *
 * Project config wins over global. Anything unreadable leaves it enabled.
 */
function isDisabled(cwd) {
  const candidates = [
    path.join(cwd, '.claude', '.tkm.json'),
    path.join(require('node:os').homedir(), '.claude', '.tkm.json'),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const v = cfg && cfg.hooks && cfg.hooks['iac-routing-guard'];
      if (v === false) return true;
      if (v !== undefined) return false; // explicitly set to something truthy
    } catch (_) {
      // unreadable config must not decide anything
    }
  }
  return false;
}

/** Max directories to walk looking for an `envs/` tree. Bounds the scan on a big repo. */
const WALK_LIMIT = 400;

/**
 * Find `<something>/envs/<env>/<layer>` anywhere under `cwd`, where `<layer>` is
 * one of the contract's `LAYERS`.
 *
 * Deliberately NOT rooted at `IAC_ROOT`: a project that renames its Terraform
 * root still has the layer layout, and that is the thing the base skill cannot
 * model. Rooting the scan at `IAC_ROOT` made this branch unreachable — the
 * IAC_ROOT existence check above it already returned true in every case the
 * scan could have matched — which left the guard silently gated on the source
 * repository's own literal path.
 */
function hasLayeredEnvTree(cwd, layers) {
  if (layers.length === 0) return false;
  const queue = [cwd];
  let seen = 0;

  while (queue.length > 0 && seen < WALK_LIMIT) {
    const dir = queue.shift();
    seen++;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue; // unreadable directory must not decide anything
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.name === 'envs') {
        for (const env of fs.readdirSync(full, { withFileTypes: true })) {
          if (!env.isDirectory()) continue;
          try {
            if (fs.readdirSync(path.join(full, env.name)).some((n) => layers.includes(n))) {
              return true;
            }
          } catch (_) {
            /* keep looking */
          }
        }
      }
      queue.push(full);
    }
  }
  return false;
}

/**
 * Layer names a project declared in its own CLAUDE.md `## IaC Layout` block.
 *
 * Without this the hook only knows the seven DEFAULT layer names, so in any
 * repository that renames them — the exact repositories the layout contract
 * invites — the tree scan can never match and the guard silently degrades to
 * the WORK_DIR check alone. Skills read the override; the hook must too, or the
 * two disagree about what an AIDD repository looks like.
 *
 * Deliberately forgiving: one line, `LAYERS = a, b, c`. Anything unparseable
 * yields [] and the caller falls back to the defaults.
 */
function readOverriddenLayers(cwd) {
  try {
    const md = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf-8');
    const m = md.match(/^\s*LAYERS\s*=\s*(.+)$/m);
    if (!m) return [];
    return m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (_) {
    return []; // no CLAUDE.md, unreadable, or no LAYERS line
  }
}

/** Signals that a repository uses the AIDD multi-layer layout. */
function looksLikeAiddLayout(cwd, defaults) {
  const workDir = defaults.WORK_DIR;
  const declared = Array.isArray(defaults.LAYERS) ? defaults.LAYERS : [];
  const overridden = readOverriddenLayers(cwd);
  // Both sets: an override renames layers, and a repo mid-migration may hold some of each.
  const layers = overridden.length > 0 ? [...new Set([...overridden, ...declared])] : declared;

  if (workDir && fs.existsSync(path.join(cwd, workDir))) return true;
  return hasLayeredEnvTree(cwd, layers);
}

/**
 * The layout contract the skills themselves read, so the hook and the skills
 * cannot disagree about what an AIDD repository looks like. Absent → treat the
 * layout as non-AIDD and stay silent.
 */
function readLayoutDefaults(cwd) {
  const p = path.join(
    cwd,
    '.claude',
    'skills',
    '_shared',
    'extras',
    'iac',
    'layout-defaults.json',
  );
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

module.exports = {
  isDisabled,
  looksLikeAiddLayout,
  readLayoutDefaults,
  readOverriddenLayers,
};
