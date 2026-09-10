#!/usr/bin/env node
'use strict';

/**
 * iac-routing-guard.cjs — PreToolUse guard on matcher "Skill".
 *
 * WHY THIS EXISTS
 *
 * The `tkm:iac-*` family and the base `tkm:infra` skill overlap on triggers
 * (Terraform, AWS, IaC, cost estimate) and neither knows the other exists.
 * `SKIP:` clauses in a description are prose: no schema, no validator and no
 * catalog generator reads them, so they cannot route anything. A PreToolUse
 * hook returning permissionDecision is the only mechanism in this kit that
 * actually decides.
 *
 * WHAT IT DOES
 *
 * When a base IaC skill is selected in a repository that has an AIDD-style
 * layer layout, it asks whether the `tkm:iac-*` equivalent was meant instead.
 * That is the whole scope: correcting a wrong selection.
 *
 * It CANNOT create awareness. If the model never considers `tkm:iac-review`
 * for a phrase base's triggers match, this hook never fires — it sees only the
 * skill that was chosen. Discovery is a separate, unsolved problem.
 *
 * DECISION IS `ask`, NEVER `deny`
 *
 * Base `tkm:infra` is a legitimate choice: it reviews a single directory, and
 * its heuristic cost path is the only one in either kit that works offline.
 * Denying it would break users who want exactly that. A guard that blocks
 * correct work gets switched off, taking the routing fix with it.
 *
 * FAIL-OPEN, ALWAYS
 *
 * Every error path allows. This is a routing nudge, not a safety control —
 * there is nothing here worth blocking work over. Deliberately the opposite of
 * the base kit's opt-in guard, which fails closed because it protects an
 * expensive tool.
 *
 * Emits on stdout, exit 0. No dependencies beyond Node's stdlib.
 */

const fs = require('fs');

// Repository-shape detection and the `.tkm.json` opt-out live next door, so this
// file stays under the kit's 200-line rule. Every helper there fails silent.
const {
  isDisabled,
  looksLikeAiddLayout,
  readLayoutDefaults,
} = require('./lib/layout-signals.cjs');

/** Base skill → the tkm:iac-* equivalent, and what the base one cannot do here. */
const REPLACEMENTS = {
  'tkm:infra': {
    review: 'tkm:iac-review',
    cost: 'tkm:iac-cost',
    create: 'tkm:iac-generate-module',
  },
};

function buildReason(skill) {
  const map = REPLACEMENTS[skill];
  const pairs = Object.entries(map)
    .map(([sub, replacement]) => `\`${skill} ${sub}\` → \`${replacement}\``)
    .join(', ');

  return (
    `This repository has an AIDD multi-layer Terraform layout (numbered layer folders under an ` +
    `envs/ tree), which \`${skill}\` does not model — it works on a single directory at a time, so ` +
    `on a layer built from module calls its review misses cross-layer issues and its cost estimate ` +
    `can return $0.00. The tkm:iac-* equivalents: ${pairs}. ` +
    `Continue with \`${skill}\` if you specifically want single-directory behaviour or an offline ` +
    `cost estimate — it remains the right tool for both.`
  );
}

function emitAsk(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
}

try {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch (_) {
    process.exit(0); // unreadable payload → allow
  }

  if (data.tool_name && data.tool_name !== 'Skill') process.exit(0);

  const raw = (data.tool_input && data.tool_input.skill) || '';
  // Strip any plugin namespace the payload may carry, matching how the base
  // kit's Skill hook resolves a skill name. Comparing the raw string means a
  // plugin-qualified payload silently never matches — a failure with no signal.
  const skill = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;

  // hasOwnProperty, not `REPLACEMENTS[skill]`: the skill name is model-supplied,
  // and a bare lookup matches inherited keys — `constructor`, `toString`,
  // `__proto__` — firing a spurious prompt with an empty replacement list.
  if (!Object.prototype.hasOwnProperty.call(REPLACEMENTS, skill)) process.exit(0);

  const cwd = data.cwd || process.cwd();

  if (isDisabled(cwd)) process.exit(0);

  let defaults;
  try {
    defaults = readLayoutDefaults(cwd);
  } catch (_) {
    process.exit(0); // unreadable contract → allow
  }
  if (!defaults) process.exit(0); // family not installed → nothing to route to

  if (!looksLikeAiddLayout(cwd, defaults)) process.exit(0); // ordinary repo → allow, silently

  emitAsk(buildReason(skill));
  process.exit(0);
} catch (_) {
  // Fail-open. A routing nudge must never be the reason work stops.
  process.exit(0);
}
