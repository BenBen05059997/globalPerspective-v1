'use strict';

// RECORD, second destination: every final verdict (and every operator correction) is also appended as one JSON
// line to S3 record/inbox/verdicts/YYYY-MM-DD.jsonl (day = decision day, UTC), where newsStoryRecord picks it up.
// A shadow run writes record/shadow/inbox/verdicts/ instead. The resolver never writes record/facts/.
// One nightly writer, so read -> add the line -> put back (s3json.appendLines, which is conditional anyway).

const inboxKey = (day, shadow) => `record/${shadow ? 'shadow/' : ''}inbox/verdicts/${day}.jsonl`;

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
function appendVerdict(deps, out, v) {
  if (!deps.inbox) return Promise.resolve();
  const next = (chains.get(deps.inbox) || Promise.resolve()).then(() => write(deps, out, v));
  chains.set(deps.inbox, next);
  return next;
}

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

module.exports = { inboxKey, appendVerdict };
