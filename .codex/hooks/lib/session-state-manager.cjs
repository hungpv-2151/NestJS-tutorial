/**
 * Session-state manager — preserves Forge progress between sessions.
 *
 * State lands in ~/.codex/session-states/{hash}/ (global, never pollutes project dirs).
 * Guarantees: zero external deps, fail-open on every I/O error, atomic writes, 7-day expiry.
 *
 * @module session-state-manager
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const MAX_ARCHIVES = 5;
const EXPIRY_DAYS = 7;
const EXEC_TIMEOUT_MS = 3000;
const STATE_FILENAME = 'latest.md';
const ARCHIVE_DIR = 'archive';

function execGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      timeout: EXEC_TIMEOUT_MS,
      cwd: cwd || undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    }).trim();
  } catch {
    return '';
  }
}

/** Resolve the global state directory for a given CWD; creates it on first use. */
function getStateDir(cwd) {
  try {
    const hash = crypto.createHash('md5').update(cwd).digest('hex').slice(0, 12);
    const globalDir = path.join(os.homedir(), '.claude', 'session-states', hash);
    if (!fs.existsSync(globalDir)) fs.mkdirSync(globalDir, { recursive: true });
    return globalDir;
  } catch { return null; }
}

/** Load last session state. Returns null when file is absent or older than 7 days. */
function loadState(cwd) {
  try {
    const stateDir = getStateDir(cwd);
    if (!stateDir) return null;
    const statePath = path.join(stateDir, STATE_FILENAME);
    if (!fs.existsSync(statePath)) return null;
    const content = fs.readFileSync(statePath, 'utf8');
    const tsMatch = content.match(/<!-- Generated: (.+?) -->/);
    if (tsMatch) {
      const parsed = new Date(tsMatch[1]).getTime();
      if (isNaN(parsed)) return null;
      if (Date.now() - parsed > EXPIRY_DAYS * 24 * 60 * 60 * 1000) return null;
    }
    return content;
  } catch { return null; }
}

/** Persist session state. SubagentStop appends an agent section; Stop finalizes and archives. */
function persistState(stdinData, options) {
  try {
    const cwd = stdinData.cwd || process.cwd();
    const stateDir = getStateDir(cwd);
    if (!stateDir) return { success: false, path: null };
    const statePath = path.join(stateDir, STATE_FILENAME);

    if (options.eventType === 'SubagentStop') {
      const agentSection = buildAgentSection(stdinData);
      const existing = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '';
      let updated;
      if (existing) {
        updated = existing.replace(/(\n## Key Files Modified)/, `\n${agentSection}$1`);
        // Heading absent in old state format — append at end
        if (updated === existing) updated = existing.trimEnd() + '\n' + agentSection;
      } else {
        updated = buildStateContent(extractSessionData(stdinData)) + '\n' + agentSection;
      }
      writeAtomic(statePath, updated);
      return { success: true, path: statePath };
    }

    if (options.eventType === 'Stop') {
      const data = extractSessionData(stdinData);
      let content = buildStateContent(data);
      if (fs.existsSync(statePath)) {
        const existing = fs.readFileSync(statePath, 'utf8');
        const agentSections = extractAgentSections(existing);
        if (agentSections) {
          content = content.replace(/(\n## Key Files Modified)/, `\n${agentSections}$1`);
        }
      }
      writeAtomic(statePath, content);
      archiveState(stateDir);
      return { success: true, path: statePath };
    }
    return { success: false, path: null };
  } catch { return { success: false, path: null }; }
}

/** Copy current state to archive/ with a timestamp name; prune to MAX_ARCHIVES entries. */
function archiveState(stateDir) {
  try {
    const statePath = path.join(stateDir, STATE_FILENAME);
    if (!fs.existsSync(statePath)) return;
    const archiveDir = path.join(stateDir, ARCHIVE_DIR);
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const now = new Date();
    const ts = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`;
    fs.copyFileSync(statePath, path.join(archiveDir, `${ts}.md`));
    const entries = fs.readdirSync(archiveDir).filter(f => f.endsWith('.md')).sort();
    while (entries.length > MAX_ARCHIVES) {
      try { fs.unlinkSync(path.join(archiveDir, entries.shift())); } catch { /* ignore */ }
    }
  } catch { /* fail-open */ }
}

/** Extract session data (todos, modified files, plan, branch) from transcript and env. */
function extractSessionData(stdinData) {
  const data = {
    timestamp: new Date().toISOString(),
    branch: process.env.TKM_GIT_BRANCH || '',
    plan: process.env.TKM_ACTIVE_PLAN || '',
    todos: [], modifiedFiles: []
  };
  // Walk transcript JSONL for the last TodoWrite block
  if (stdinData.transcript_path) {
    try {
      const lines = fs.readFileSync(stdinData.transcript_path, 'utf8').split('\n').filter(Boolean);
      const latest = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const blocks = entry.message?.content;
          if (!Array.isArray(blocks)) continue;
          for (const block of blocks) {
            if (block.type === 'tool_use' && block.name === 'TodoWrite' && Array.isArray(block.input?.todos)) {
              latest.length = 0;
              latest.push(...block.input.todos);
            }
          }
        } catch { /* skip */ }
      }
      data.todos = latest;
    } catch { /* transcript unavailable */ }
  }
  // Collect modified files from git diff (best-effort)
  try {
    const diff = execGit(['diff', '--name-only', 'HEAD'], stdinData.cwd || process.cwd());
    if (diff) data.modifiedFiles = diff.split('\n').slice(0, 20);
  } catch { /* no git */ }
  return data;
}

/** Render the session-state markdown from extracted session data. */
function buildStateContent(data) {
  const completed = data.todos.filter(t => t.status === 'completed');
  const pending = data.todos.filter(t => t.status !== 'completed');
  const lines = [
    '# Session State',
    `<!-- Generated: ${data.timestamp} -->`,
    `<!-- Branch: ${data.branch || 'unknown'} -->`,
    `<!-- Plan: ${data.plan || 'none'} -->`,
    '',
    '## What Worked (Verified)',
    ...(completed.length ? completed.map(t => `- ${t.content}`) : ['- (No completed tasks recorded)']),
    '',
    "## What's Left",
    ...(pending.length ? pending.map(t => `- [ ] ${t.content}`) : ['- (All tasks completed)']),
    ''
  ];
  if (data.plan) lines.push('## Active Plan', data.plan, '');
  lines.push('## Key Files Modified',
    ...(data.modifiedFiles.length ? data.modifiedFiles.map(f => `- ${f}`) : ['- (No file changes detected)']),
    '');
  return lines.join('\n');
}

/** Render a brief markdown section recording a completed subagent. */
function buildAgentSection(stdinData) {
  const type = stdinData.agent_type || 'unknown';
  const ts = new Date().toISOString().slice(11, 19);
  return `\n## Agent Result: ${type} (${ts})\n- Completed at ${ts}\n`;
}

/** Pull all `## Agent Result:` sections from existing state content. */
function extractAgentSections(content) {
  const matches = content.match(/## Agent Result:.+?(?=\n## |$)/gs);
  return matches ? matches.join('\n') : null;
}

/** Write atomically: write to a temp file then rename into place. */
function writeAtomic(filePath, content) {
  const tmp = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

function p2(n) { return String(n).padStart(2, '0'); }

module.exports = {
  getStateDir,
  loadState,
  persistState,
  archiveState,
  extractSessionData,
  buildStateContent,
  buildAgentSection,
  writeAtomic
};
