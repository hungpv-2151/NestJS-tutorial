#!/usr/bin/env node
'use strict';

/**
 * team-context-inject — SubagentStart hook. Orients a freshly-spawned Agent Team member.
 *
 * Only activates when the agent_id carries the "name@team-name" pattern that
 * marks a team member. Non-team subagents pass through without output. Injects
 * peer roster, live task counts, and TKM stack paths so the teammate can claim
 * work and communicate without reading config files itself.
 *
 * Fail-open: a missing context block must never abort a teammate spawn.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (no stdin/stdout/exit); the `require.main === module` branch preserves
 * the legacy `node "<path>"` invocation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { isHookEnabled } = require('./lib/tkm-config-utils.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

const TEAMS_DIR = path.join(os.homedir(), '.claude', 'teams');
const TASKS_DIR = path.join(os.homedir(), '.claude', 'tasks');

/** Extract team name from agent_id ("name@team-name"); null for non-team agents. */
function extractTeamName(agentId) {
  if (!agentId || typeof agentId !== 'string') return null;
  const atIdx = agentId.indexOf('@');
  if (atIdx < 1) return null;
  const name = agentId.substring(atIdx + 1);
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return name;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function buildPeerList(config, currentAgentId) {
  if (!config?.members?.length) return '';
  const peers = config.members
    .filter((m) => m.agentId !== currentAgentId)
    .map((m) => `${m.name} (${m.agentType})`)
    .join(', ');
  return peers || 'none';
}

/** TKM stack paths from environment (the session-init hook sets these ambiently). */
function buildSkContext() {
  const ctx = [];
  const env = process.env;
  if (env.TKM_REPORTS_PATH) ctx.push(`Reports: ${env.TKM_REPORTS_PATH}`);
  if (env.TKM_PLANS_PATH) ctx.push(`Plans: ${env.TKM_PLANS_PATH}`);
  if (env.TKM_PROJECT_ROOT) ctx.push(`Project: ${env.TKM_PROJECT_ROOT}`);
  if (env.TKM_NAME_PATTERN) ctx.push(`Naming: ${env.TKM_NAME_PATTERN}`);
  if (env.TKM_GIT_BRANCH) ctx.push(`Branch: ${env.TKM_GIT_BRANCH}`);
  if (env.TKM_ACTIVE_PLAN) ctx.push(`Active plan: ${env.TKM_ACTIVE_PLAN}`);
  ctx.push('Commits: conventional (feat:, fix:, docs:, refactor:, test:, chore:)');
  return ctx;
}

function summarizeTasks(teamName) {
  const taskDir = path.join(TASKS_DIR, teamName);
  try {
    if (!fs.existsSync(taskDir)) return null;
    const files = fs.readdirSync(taskDir).filter((f) => f.endsWith('.json'));
    let pending = 0, inProgress = 0, completed = 0;
    for (const file of files) {
      const task = readJson(path.join(taskDir, file));
      if (!task?.status) continue;
      if (task.status === 'pending') pending++;
      else if (task.status === 'in_progress') inProgress++;
      else if (task.status === 'completed') completed++;
    }
    return { pending, inProgress, completed, total: files.length };
  } catch {
    return null;
  }
}

/**
 * Pure decision. Returns `{status:'context'}` with the team briefing for a team
 * subagent, else `{status:'ok'}` (non-team subagents / disabled / missing config).
 * Fail-open: any internal error → allow silently.
 */
function run(input, _ctx) {
  try {
    if (!isHookEnabled('team-context-inject')) return { status: 'ok' };

    const agentId = input.agent_id || '';
    const teamName = extractTeamName(agentId);
    if (!teamName) return { status: 'ok' };

    const config = readJson(path.join(TEAMS_DIR, teamName, 'config.json'));
    if (!config) return { status: 'ok' };

    const peerList = buildPeerList(config, agentId);
    const tasks = summarizeTasks(teamName);

    const lines = ['## Team Context', `Team: ${config.name || teamName}`, `Your peers: ${peerList}`];
    if (tasks) {
      lines.push(`Task summary: ${tasks.pending} pending, ${tasks.inProgress} in progress, ${tasks.completed} completed`);
    }
    const skCtx = buildSkContext();
    if (skCtx.length > 0) {
      lines.push('', '## TKM Context', ...skCtx);
    }
    lines.push('', 'Remember: Check TaskList, claim tasks, respect file ownership, use SendMessage to communicate.');

    return { status: 'context', output: lines.join('\n') };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['SubagentStart'],
  timeout: 10,
};

if (require.main === module) {
  runSelfExec(run);
}
