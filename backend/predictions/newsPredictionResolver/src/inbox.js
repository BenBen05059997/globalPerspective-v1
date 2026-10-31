'use strict';

// RECORD, second destination: every final verdict (and every operator correction) is also appended as one JSON
// line to S3 record/inbox/verdicts/YYYY-MM-DD.jsonl (day = decision day, UTC), where newsStoryRecord picks it up.
// The weekly seed commit and the weekly draw (decision 0043) go the same way to record/inbox/draws/YYYY-MM-DD.jsonl.
// A shadow run writes record/shadow/inbox/... instead. The resolver never writes record/facts/.
// One nightly writer, so read -> add the line -> put back (s3json.appendLines, which is conditional anyway).

const inboxKey = (day, shadow) => `record/${shadow ? 'shadow/' : ''}inbox/verdicts/${day}.jsonl`;
const drawsKey = (day, shadow) => `record/${shadow ? 'shadow/' : ''}inbox/draws/${day}.jsonl`;

// forkId / branchId follow derive.js: fork = '<PRED pk>/<issue day>', branch = '<fork>/<trigger id>'.
function ids(q) {
  const forkId = q && q.pk && q.sk ? `${q.pk}/${String(q.sk).slice(0, 10)}` : null;
  return { forkId, branchId: forkId && q.triggerId !== undefined && q.triggerId !== null ? `${forkId}/${q.triggerId}` : null };
}

/**
 * Append the verdict line. A failure is reported in out.errors (the Q# VERDICT row is already stored, so the
 * decision is not lost; the line can be re-sent by hand). Same qid + revision twice is a no-op.
 */
const chains = new WeakMap();
// Checks run three at a time; the appends go one after another so line numbers (the sourceKey) never collide.
function queued(deps, job) {
  if (!deps.inbox) return Promise.resolve();
  const next = (chains.get(deps.inbox) || Promise.resolve()).then(job);
  chains.set(deps.inbox, next);
  return next;
}
const appendVerdict = (deps, out, v) => queued(deps, () => write(deps, out, v));

async function write(deps, out, v) {
  const day = String(v.decidedAt).slice(0, 10);
  const key = inboxKey(day, deps.shadow);
  try {
    const { lines } = await deps.inbox.getLines(key);
    if (lines.some((l) => l.qid === v.qid && l.revision === v.revision)) return;
    const line = {
      schemaVersion: 1, qid: v.qid, threadId: (v.q && v.q.threadId) || null, ...ids(v.q),
      result: v.result, voidReason: v.voidReason || null, decidedAt: v.decidedAt, decidedBy: v.decidedBy,
      evidence: v.evidence || null, reason: v.reason || null, revision: v.revision,
      sourceKey: `inbox:verdicts/${day}#${lines.length + 1}`,
    };
    await deps.inbox.appendLines(key, [line], { idKey: 'sourceKey' });
    (out.inbox = out.inbox || []).push({ key, qid: v.qid, revision: v.revision });
  } catch (e) {
    out.errors.push(`${v.qid}: inbox line not written (${String(e.message).slice(0, 120)}); the Q# verdict row is stored`);
  }
}

// The inbox bodies of a SEED#<week>/COMMIT row and a SAMPLE#<week>/DRAW row (+ the revealed seed). The backfill CLI builds its lines
// with these too, so a live line and a backfilled one are the same shape.
const commitLine = (r) => ({ weekId: r.weekId, weekStart: r.weekStart, weekEnd: r.weekEnd, commitHash: r.commitHash, rule: r.rule, committedAt: r.committedAt });
const drawLine = (r, seedHex) => ({
  weekId: r.weekId, rule: r.rule, K: r.K, eligible: r.eligible, clusters: r.clusters, seedHex: seedHex || null,
  picked: (r.picked || []).map((p) => ({ qid: p.qid, hash: p.h, clusterKey: p.clusterKey })), drawnAt: r.drawnAt,
});

/**
 * Append the week's seed commit ({weekId, weekStart, weekEnd, commitHash, rule, committedAt}) or its draw ({weekId, rule, K, eligible,
 * clusters, seedHex, picked: [{qid, hash, clusterKey}], drawnAt}) as one line of the draws inbox. type is 'commit' | 'draw'; a repeated
 * type + weekId is a no-op. Failure handling as for verdicts: reported in out.errors, the DynamoDB rows are stored.
 */
function appendDraw(deps, out, type, v) {
  return queued(deps, async () => {
    const at = type === 'commit' ? v.committedAt : v.drawnAt;
    const day = String(at).slice(0, 10);
    const key = drawsKey(day, deps.shadow);
    try {
      const { lines } = await deps.inbox.getLines(key);
      if (lines.some((l) => l.type === type && l.weekId === v.weekId)) return;
      await deps.inbox.appendLines(key, [{ schemaVersion: 1, type, ...v, sourceKey: `inbox:draws/${day}#${lines.length + 1}` }], { idKey: 'sourceKey' });
      (out.inbox = out.inbox || []).push({ key, type, weekId: v.weekId });
    } catch (e) {
      out.errors.push(`${v.weekId}: ${type} inbox line not written (${String(e.message).slice(0, 120)}); the DynamoDB rows are stored`);
    }
  });
}

module.exports = { inboxKey, drawsKey, appendVerdict, appendDraw, commitLine, drawLine };
