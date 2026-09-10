'use strict';

/**
 * destructive-command-detector.cjs — pure classifier for destructive-command-guard.cjs.
 *
 * Detects five destructive shell patterns: `rm -rf`, `DROP TABLE`, `git push --force`,
 * `git reset --hard`, `kubectl delete`. Pure function, no I/O — mirrors stage-detector.cjs's
 * shape so the hook stays a thin caller.
 *
 * Verb/flag matching is TOKEN-based, never raw-substring — `git reset HEAD <file>` must
 * never match `git reset --hard`, and `git push origin main` must never match
 * `git push -f`. This repo already learned that lesson the hard way: safety-guard.cjs
 * (removed 2026-07-19) did whole-string substring matching, blocked safe git index ops,
 * and pushed the agent toward MORE destructive workarounds. Only `rm -rf` carries an
 * allowlist (dependency directories) — the other four always ask when matched, since
 * the issue this hook implements only asked for an exemption path on `rm -rf`.
 *
 * `DROP TABLE` is the one pattern NOT segment/token based — SQL normally arrives inside
 * a quoted `-c "..."` argument to a DB client, so quote-stripping (which every other
 * pattern relies on to avoid matching text inside strings) would blank it out. It's a
 * single case-insensitive regex over the raw, unstripped command instead.
 */

// Shell command separators — same separators stage-detector.cjs uses. Duplicated (not
// imported) so this guard has zero blast radius on the already-shipped
// evidence-gate-guard dependency chain.
const COMMAND_SEPARATOR_RE = /&&|\|\||;|\n|\|/;

/** Strip single- and double-quoted substrings so quoted text never trips a match. */
function stripQuotedSegments(cmd) {
  return String(cmd || '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ' ');
}

/** Split a raw command into quote-stripped, separator-delimited segments. */
function splitSegments(cmd) {
  return stripQuotedSegments(cmd)
    .split(COMMAND_SEPARATOR_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Whitespace-split an already quote-stripped segment into tokens. */
function tokenizeSegment(segment) {
  return String(segment || '').trim().split(/\s+/).filter(Boolean);
}

const isFlag = (token) => token.startsWith('-');

// `rm -rf` allowlist: scout-block/pattern-matcher.cjs DEFAULT_PATTERNS, minus '.git' —
// deleting .git is never safe to auto-exempt, even though scout-block excludes it from
// *reads* for a different reason (performance, not delete safety).
const RM_RF_ALLOWLIST = new Set([
  'node_modules', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'vendor', 'target', 'coverage',
]);

// Targets that can never be exempted regardless of the allowlist, however they
// normalize — root/parent/home/empty. Env-var expansions ($HOME, ...) can't be
// verified statically, so they're rejected outright rather than guessed at.
const NEVER_ALLOWLISTED = new Set(['', '.', '..', '/', '~']);

const DROP_TABLE_RE = /\bDROP\s+TABLE\b/i;

const SHORT_RECURSIVE_RE = /^-[a-zA-Z]*[rR][a-zA-Z]*$/;
const SHORT_FORCE_RE = /^-[a-zA-Z]*f[a-zA-Z]*$/;

/** True when the flag tokens collectively include both recursive and force, in any form. */
function hasRecursiveAndForce(flagTokens) {
  const hasRecursive = flagTokens.some((t) => t === '--recursive' || SHORT_RECURSIVE_RE.test(t));
  const hasForce = flagTokens.some((t) => t === '--force' || SHORT_FORCE_RE.test(t));
  return hasRecursive && hasForce;
}

/** Strip a trailing slash and/or glob suffix (`/`, `/*`, `/**`) before basename check. */
function stripTrailingGlob(target) {
  return target.replace(/\/+(\*\*?)?$/, '');
}

/** True when a token is a shell/env assignment prefix, e.g. `FOO=bar`. */
function isAssignmentPrefix(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function optionConsumesNext(token, optionNames) {
  if (!token || token === '--') return false;
  if (optionNames.has(token)) return true;
  if (token.startsWith('--') && token.includes('=')) return false;
  return false;
}

function stripSudoWrapper(tokens) {
  let index = 1;
  const optionsWithArgs = new Set([
    '-u', '--user',
    '-g', '--group',
    '-h', '--host',
    '-p', '--prompt',
    '-C', '--close-from',
    '-T', '--command-timeout',
  ]);
  while (tokens[index] && tokens[index].startsWith('-')) {
    const option = tokens[index];
    index += 1;
    if (optionConsumesNext(option, optionsWithArgs) && tokens[index]) index += 1;
  }
  return tokens.slice(index);
}

function stripEnvWrapper(tokens) {
  let index = 1;
  const optionsWithArgs = new Set([
    '-u', '--unset',
    '-C', '--chdir',
    '-S', '--split-string',
  ]);
  while (tokens[index]) {
    const token = tokens[index];
    if (isAssignmentPrefix(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) {
      index += 1;
      if (optionConsumesNext(token, optionsWithArgs) && tokens[index]) index += 1;
      continue;
    }
    break;
  }
  return tokens.slice(index);
}

function stripTimeoutWrapper(tokens) {
  let index = 1;
  const optionsWithArgs = new Set([
    '-s', '--signal',
    '-k', '--kill-after',
  ]);
  while (tokens[index] && tokens[index].startsWith('-')) {
    const option = tokens[index];
    index += 1;
    if (optionConsumesNext(option, optionsWithArgs) && tokens[index]) index += 1;
  }
  if (tokens[index]) index += 1; // duration
  return tokens.slice(index);
}

function stripNiceWrapper(tokens) {
  let index = 1;
  const optionsWithArgs = new Set(['-n', '--adjustment']);
  while (tokens[index] && tokens[index].startsWith('-')) {
    const option = tokens[index];
    index += 1;
    if (optionConsumesNext(option, optionsWithArgs) && tokens[index]) index += 1;
  }
  return tokens.slice(index);
}

function stripCommandWrapper(tokens) {
  let index = 1;
  while (tokens[index] && ['-p', '-v', '-V'].includes(tokens[index])) index += 1;
  return tokens.slice(index);
}

function stripXargsWrapper(tokens) {
  let index = 1;
  const optionsWithArgs = new Set([
    '-a', '--arg-file',
    '-d', '--delimiter',
    '-E', '--eof',
    '-I', '--replace',
    '-n', '--max-args',
    '-P', '--max-procs',
    '-s', '--max-chars',
  ]);
  while (tokens[index] && tokens[index].startsWith('-')) {
    const option = tokens[index];
    index += 1;
    if (optionConsumesNext(option, optionsWithArgs) && tokens[index]) index += 1;
  }
  return tokens.slice(index);
}

/** Strip harmless command-launch wrappers so all matchers see the real verb. */
function stripLeadingCommandWrappers(tokens) {
  let stripped = tokens.slice();
  let changed = true;
  while (changed && stripped.length > 0) {
    changed = false;
    while (stripped[0] && isAssignmentPrefix(stripped[0])) {
      stripped = stripped.slice(1);
      changed = true;
    }
    if (stripped[0] === 'sudo') {
      stripped = stripSudoWrapper(stripped);
      changed = true;
    } else if (stripped[0] === 'env') {
      stripped = stripEnvWrapper(stripped);
      changed = true;
    } else if (stripped[0] === 'timeout') {
      stripped = stripTimeoutWrapper(stripped);
      changed = true;
    } else if (stripped[0] === 'nice') {
      stripped = stripNiceWrapper(stripped);
      changed = true;
    } else if (stripped[0] === 'command') {
      stripped = stripCommandWrapper(stripped);
      changed = true;
    } else if (stripped[0] === 'xargs') {
      stripped = stripXargsWrapper(stripped);
      changed = true;
    }
  }
  return stripped;
}

/** True only if EVERY positional arg is a relative, one-level allowlisted dep dir. */
function isRmTargetAllowlisted(args) {
  if (args.length === 0) return false;
  return args.every((arg) => {
    const normalized = stripTrailingGlob(arg).replace(/^\.\//, '');
    if (NEVER_ALLOWLISTED.has(normalized) || normalized.startsWith('$')) return false;
    if (normalized.startsWith('~') || normalized.includes('/')) return false;
    return RM_RF_ALLOWLIST.has(normalized);
  });
}

function matchRmRf(segment) {
  const tokens = stripLeadingCommandWrappers(tokenizeSegment(segment));
  if (tokens[0] !== 'rm') return null;

  const args = tokens.slice(1);
  const flagTokens = args.filter(isFlag);
  if (!hasRecursiveAndForce(flagTokens)) return null;

  const positionalArgs = args.filter((t) => !isFlag(t));
  return { pattern: 'rm -rf', allowlisted: isRmTargetAllowlisted(positionalArgs) };
}

function matchGitPushForce(segment) {
  const tokens = stripLeadingCommandWrappers(tokenizeSegment(segment));
  if (tokens[0] !== 'git' || !tokens.includes('push')) return null;
  // Exact-token check only — `--force-with-lease` must never match `--force`. Conflating
  // git's own safe-force with a bare force is the same alert-fatigue mistake that got
  // safety-guard.cjs removed.
  const forced = tokens.some((t) => t === '-f' || t === '--force');
  if (!forced) return null;
  return { pattern: 'git push --force', allowlisted: false };
}

function matchGitResetHard(segment) {
  const tokens = stripLeadingCommandWrappers(tokenizeSegment(segment));
  if (tokens[0] !== 'git' || !tokens.includes('reset')) return null;
  if (!tokens.includes('--hard')) return null;
  return { pattern: 'git reset --hard', allowlisted: false };
}

function matchKubectlDelete(segment) {
  const tokens = stripLeadingCommandWrappers(tokenizeSegment(segment));
  if (tokens[0] !== 'kubectl' || !tokens.includes('delete')) return null;
  const dryRun = tokens.some((t) => t === '--dry-run' || t.startsWith('--dry-run='));
  if (dryRun) return null;
  return { pattern: 'kubectl delete', allowlisted: false };
}

/**
 * @param {string} bashCommand - the Bash tool_input.command about to run
 * @returns {{ pattern: string, allowlisted: boolean } | null}
 */
function detectDestructive(bashCommand) {
  if (!bashCommand) return null;

  // Checked first, over the RAW command — see file header for why this one pattern
  // skips quote-stripping and segment splitting entirely.
  if (DROP_TABLE_RE.test(bashCommand)) {
    return { pattern: 'DROP TABLE', allowlisted: false };
  }

  // Scan every segment, not just the first hit: an allowlisted `rm -rf` earlier in a
  // chain must never mask a genuinely destructive command later in the same chain
  // (e.g. `rm -rf node_modules && git push -f`). A non-allowlisted match anywhere wins
  // immediately; an allowlisted match is remembered but scanning continues.
  let allowlistedHit = null;
  for (const segment of splitSegments(bashCommand)) {
    const hit = matchRmRf(segment)
      || matchGitPushForce(segment)
      || matchGitResetHard(segment)
      || matchKubectlDelete(segment);
    if (!hit) continue;
    if (!hit.allowlisted) return hit;
    allowlistedHit = hit;
  }
  return allowlistedHit;
}

module.exports = {
  detectDestructive,
  splitSegments,
  stripQuotedSegments,
  tokenizeSegment,
  stripLeadingCommandWrappers,
  RM_RF_ALLOWLIST,
  DROP_TABLE_RE,
};
