#!/usr/bin/env node
'use strict';

/**
 * memory-graph-queue — Stop hook. Queues conversation deltas as .md fact-capture
 * files for later, LLM-driven extraction — tier-auto self-hosted KG memory.
 *
 * Deterministic file I/O only — NEVER calls the Agent tool (a hook can't; this
 * only queues). Secret redaction is applied by the queue lib before writing.
 *
 * Opt-in: OFF by default (config memoryGraph.enabled=false). Env
 * MEMORY_GRAPH_DISABLE=1 is a hard kill switch. Fail-open — never blocks Stop.
 *
 * DUAL-MODE KIT HOOK — see docs/hook-authoring.md. `run(input, ctx)` is the pure
 * decision (its queue-file write is the hook's intended side effect; it emits no
 * context, so it always returns `ok`; no stdout/exit). The `require.main === module`
 * branch preserves the legacy `node "<path>"` invocation.
 */

const { isHookEnabled, isMemoryGraphEnabled } = require('./lib/tkm-config-utils.cjs');
const {
  resolveQueueDir,
  filterTranscript,
  passesHeuristic,
  capTurns,
  renderMarkdown,
  writeQueueFile,
} = require('./lib/memory-graph-queue-lib.cjs');
const { runSelfExec } = require('./lib/hook-dual-mode.cjs');

/**
 * Side-effect-only decision: queues the session's redacted conversation deltas
 * when the memory graph is enabled and the turn passes the triviality heuristic.
 * Always returns `{status:'ok'}` (this hook emits no context). Fail-open.
 */
function run(input, _ctx) {
  try {
    if (!isHookEnabled('memory-graph-queue') || !isMemoryGraphEnabled()) return { status: 'ok' };
    if (input.hook_event_name !== 'Stop') return { status: 'ok' };

    const sessionId = input.session_id;
    const cwd = input.cwd || process.cwd();
    if (!sessionId || !input.transcript_path) return { status: 'ok' };

    const turns = filterTranscript(input.transcript_path);
    if (!passesHeuristic(turns)) return { status: 'ok' };

    const capped = capTurns(turns);
    const markdown = renderMarkdown(capped, sessionId); // redaction applied in the lib
    const queueDir = resolveQueueDir(cwd);
    writeQueueFile(queueDir, sessionId, markdown);

    return { status: 'ok' };
  } catch (_) {
    return { status: 'ok' };
  }
}

module.exports.run = run;
module.exports.meta = {
  events: ['Stop'],
  timeout: 15,
};

if (require.main === module) {
  runSelfExec(run);
}
