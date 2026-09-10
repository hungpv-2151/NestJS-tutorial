#!/usr/bin/env node
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { detectDestructive, splitSegments, tokenizeSegment } = require('../destructive-command-detector.cjs');

// ── rm -rf: positive matches ────────────────────────────────────────────────

test('rm -rf / is destructive and not allowlisted', () => {
  const r = detectDestructive('rm -rf /');
  assert.strictEqual(r.pattern, 'rm -rf');
  assert.strictEqual(r.allowlisted, false);
});

test('rm -rf . / .. / ~ / $HOME are all not allowlisted', () => {
  for (const target of ['.', '..', '~', '$HOME']) {
    const r = detectDestructive(`rm -rf ${target}`);
    assert.strictEqual(r.pattern, 'rm -rf', `target ${target}`);
    assert.strictEqual(r.allowlisted, false, `target ${target}`);
  }
});

test('rm -rf node_modules is allowlisted', () => {
  const r = detectDestructive('rm -rf node_modules');
  assert.strictEqual(r.pattern, 'rm -rf');
  assert.strictEqual(r.allowlisted, true);
});

test('rm -rf with multiple allowlisted targets is allowlisted', () => {
  const r = detectDestructive('rm -rf ./node_modules dist');
  assert.strictEqual(r.allowlisted, true);
});

test('rm -rf allowlist only applies to relative one-level cwd targets', () => {
  assert.strictEqual(detectDestructive('rm -rf build').allowlisted, true);
  assert.strictEqual(detectDestructive('rm -rf ./dist').allowlisted, true);
  assert.strictEqual(detectDestructive('rm -rf apps/web/dist').allowlisted, false);
  assert.strictEqual(detectDestructive('rm -rf /home/me/backups/build').allowlisted, false);
  assert.strictEqual(detectDestructive('rm -rf /srv/app/vendor').allowlisted, false);
  assert.strictEqual(detectDestructive('rm -rf ~/projects/target').allowlisted, false);
  assert.strictEqual(detectDestructive('rm -rf ../build').allowlisted, false);
});

test('rm -rf mixing an allowlisted and a non-allowlisted target is NOT allowlisted', () => {
  const r = detectDestructive('rm -rf node_modules src');
  assert.strictEqual(r.pattern, 'rm -rf');
  assert.strictEqual(r.allowlisted, false);
});

test('rm -rf node_modules/* and node_modules/ are allowlisted (trailing glob/slash stripped)', () => {
  assert.strictEqual(detectDestructive('rm -rf node_modules/*').allowlisted, true);
  assert.strictEqual(detectDestructive('rm -rf node_modules/').allowlisted, true);
});

test('rm -fr / rm -r -f / rm --recursive --force all detect regardless of flag form', () => {
  assert.strictEqual(detectDestructive('rm -fr node_modules').pattern, 'rm -rf');
  assert.strictEqual(detectDestructive('rm -r -f node_modules').pattern, 'rm -rf');
  assert.strictEqual(detectDestructive('rm --recursive --force node_modules').pattern, 'rm -rf');
});

test('rm -r alone (no force) does not match rm -rf', () => {
  assert.strictEqual(detectDestructive('rm -r node_modules'), null);
});

test('rm -rf with no positional args is not allowlisted', () => {
  const r = detectDestructive('rm -rf');
  assert.strictEqual(r.pattern, 'rm -rf');
  assert.strictEqual(r.allowlisted, false);
});

// ── DROP TABLE ───────────────────────────────────────────────────────────────

test('bare DROP TABLE statement matches', () => {
  const r = detectDestructive('DROP TABLE users;');
  assert.strictEqual(r.pattern, 'DROP TABLE');
  assert.strictEqual(r.allowlisted, false);
});

test('DROP TABLE inside a quoted -c argument to a DB client matches', () => {
  const r = detectDestructive('psql -c "DROP TABLE users;"');
  assert.strictEqual(r.pattern, 'DROP TABLE');
});

test('DROP TABLE is case-insensitive', () => {
  const r = detectDestructive('drop table users');
  assert.strictEqual(r.pattern, 'DROP TABLE');
});

test('DROP TABLE text anywhere in the raw command matches, even outside a real SQL client call', () => {
  // Known, accepted tradeoff: DROP TABLE is checked over the raw, unstripped command
  // (see file header) so it still catches SQL inside a quoted client arg. The cost is
  // it also fires on the phrase appearing incidentally, e.g. in a shell comment -- an
  // extra `ask` in that rare case, never a missed real one.
  const r = detectDestructive('rm -rf node_modules # note: never DROP TABLE users manually');
  assert.strictEqual(r.pattern, 'DROP TABLE');
});

// ── git push --force ─────────────────────────────────────────────────────────

test('git push -f / --force / with a remote arg all match', () => {
  assert.strictEqual(detectDestructive('git push -f').pattern, 'git push --force');
  assert.strictEqual(detectDestructive('git push --force').pattern, 'git push --force');
  assert.strictEqual(detectDestructive('git push -f origin main').pattern, 'git push --force');
});

test('git push origin main (no force) does not match', () => {
  assert.strictEqual(detectDestructive('git push origin main'), null);
  assert.strictEqual(detectDestructive('git push'), null);
});

test('git push --force-with-lease does NOT match git push --force (exact-token check)', () => {
  assert.strictEqual(detectDestructive('git push --force-with-lease'), null);
  assert.strictEqual(detectDestructive('git push --force-with-lease=refs/heads/main:abc123'), null);
});

test('git push --force matches behind command wrappers', () => {
  assert.strictEqual(detectDestructive('command git push -f').pattern, 'git push --force');
  assert.strictEqual(detectDestructive('sudo git push --force').pattern, 'git push --force');
});

// ── git reset --hard ─────────────────────────────────────────────────────────

test('git reset --hard and git reset --hard HEAD~1 both match', () => {
  assert.strictEqual(detectDestructive('git reset --hard').pattern, 'git reset --hard');
  assert.strictEqual(detectDestructive('git reset --hard HEAD~1').pattern, 'git reset --hard');
});

test('git reset HEAD <file> does NOT match -- the exact safety-guard.cjs regression case', () => {
  assert.strictEqual(detectDestructive('git reset HEAD file.txt'), null);
});

test('git reset --soft and bare git reset do NOT match', () => {
  assert.strictEqual(detectDestructive('git reset --soft HEAD~1'), null);
  assert.strictEqual(detectDestructive('git reset'), null);
});

test('git reset --hard matches behind command wrappers', () => {
  assert.strictEqual(detectDestructive('sudo git reset --hard').pattern, 'git reset --hard');
  assert.strictEqual(detectDestructive('sudo -u root git reset --hard').pattern, 'git reset --hard');
});

// ── kubectl delete ───────────────────────────────────────────────────────────

test('kubectl delete variants all match', () => {
  assert.strictEqual(detectDestructive('kubectl delete pod foo').pattern, 'kubectl delete');
  assert.strictEqual(detectDestructive('kubectl delete -f manifest.yaml').pattern, 'kubectl delete');
  assert.strictEqual(detectDestructive('kubectl -n prod delete deploy web').pattern, 'kubectl delete');
});

test('kubectl delete --dry-run (client/server/bare) is exempted', () => {
  assert.strictEqual(detectDestructive('kubectl delete pod foo --dry-run=client'), null);
  assert.strictEqual(detectDestructive('kubectl delete pod foo --dry-run=server'), null);
  assert.strictEqual(detectDestructive('kubectl delete pod foo --dry-run'), null);
});

test('kubectl delete matches behind command wrappers', () => {
  assert.strictEqual(detectDestructive('sudo kubectl delete ns prod').pattern, 'kubectl delete');
});

// ── command wrappers ────────────────────────────────────────────────────────

test('rm -rf matches behind common command wrappers', () => {
  assert.strictEqual(detectDestructive('env FOO=bar rm -rf /').pattern, 'rm -rf');
  assert.strictEqual(detectDestructive('FOO=bar rm -rf /').pattern, 'rm -rf');
  assert.strictEqual(detectDestructive('timeout 5 rm -rf /data').pattern, 'rm -rf');
  assert.strictEqual(detectDestructive('nice -n 10 rm -rf /data').pattern, 'rm -rf');
  assert.strictEqual(detectDestructive('xargs rm -rf /data').pattern, 'rm -rf');
});

// ── chained commands ─────────────────────────────────────────────────────────

test('a safe rm -rf earlier in a chain does not mask nothing bad after it', () => {
  const r = detectDestructive('npm ci && rm -rf node_modules && npm install');
  assert.strictEqual(r.pattern, 'rm -rf');
  assert.strictEqual(r.allowlisted, true);
});

test('an allowlisted rm -rf followed by a real destructive command still flags the latter', () => {
  const r = detectDestructive('rm -rf node_modules && git push -f');
  assert.strictEqual(r.pattern, 'git push --force');
  assert.strictEqual(r.allowlisted, false);
});

// ── quoting: destructive text inside a string must not fire (except DROP TABLE) ─

test('rm -rf mentioned inside a quoted commit message does not fire', () => {
  assert.strictEqual(detectDestructive('git commit -m "rm -rf everything, just kidding"'), null);
});

test('git reset --hard mentioned inside a quoted string does not fire', () => {
  assert.strictEqual(detectDestructive('echo "never run git reset --hard"'), null);
});

// ── no signal ────────────────────────────────────────────────────────────────

test('an unrelated command returns null', () => {
  assert.strictEqual(detectDestructive('ls -la'), null);
});

test('empty/undefined bashCommand returns null, no throw', () => {
  assert.strictEqual(detectDestructive(''), null);
  assert.strictEqual(detectDestructive(undefined), null);
  assert.strictEqual(detectDestructive(null), null);
});

// ── splitSegments / tokenizeSegment ──────────────────────────────────────────

test('splitSegments splits on all five shell separators', () => {
  const segments = splitSegments('a && b || c ; d\ne | f');
  assert.deepStrictEqual(segments, ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('tokenizeSegment collapses repeated/leading/trailing whitespace', () => {
  assert.deepStrictEqual(tokenizeSegment('  rm   -rf   node_modules  '), ['rm', '-rf', 'node_modules']);
});
