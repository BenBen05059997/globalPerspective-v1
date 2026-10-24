'use strict';

const lib = require('./lib');

// The drafter (JUDGE). It sees ONLY: the question, its deadline, the issue day, the named source and the evidence
// bundle (the story's own entry facts dated after the draw, see gather.js). It never receives the question's
// probability or any scenario probability: buildPrompt picks its fields explicitly, so a stray `p` on the input
// object cannot leak.

function buildPrompt(q, entries, today) {
  const ctx = entries.length
    ? entries.map((e) => `[${e.eventId}] ${e.title} (${e.date})${e.recovered ? ' [recovered headline, no text]' : ''}\n${e.summary}`.trimEnd()).join('\n\n')
    : '(no entries)';
  return [
    'You verify whether a specific forecast question came true, using ONLY the entries below: the story\'s own news entries dated after the forecast was issued. Respond with ONLY valid JSON, no markdown.',
    '',
    `Today: ${today}`,
    `Question: "${q.question}"`,
    `It concerned the story: ${q.storyTitle || '(unknown)'}`,
    `Issued on: ${String(q.issuedAt).slice(0, 10)}. Deadline: ${q.deadline}.`,
    `Named resolution source: ${q.resolutionSource || '(none named)'}`,
    '',
    'ENTRIES (each starts with its id in brackets):',
    ctx,
    '',
    'Rules:',
    '- "yes": the event happened on or before the deadline. You MUST give "quote" (an exact, verbatim passage copied from the title or summary of ONE entry above, at least 12 characters) and "event_id" (that entry\'s id).',
    '- "no": none of the entries reports that the event happened by the deadline (these are all entries of the story since the forecast was issued).',
    '- "not_yet": the entries do not settle it either way.',
    `- "void": the question cannot be judged; give "void_reason" as one of ${lib.VOID_REASONS.join(', ')}.`,
    '- An entry marked "recovered headline, no text" is a headline only; it may support a "yes" by its title, but silence in such entries never supports a "no".',
    '- Never use memory; never guess. If unsure, answer "not_yet".',
    '',
    'JSON: {"verdict":"yes|no|not_yet|void","void_reason":"","quote":"","event_id":"","why":"one sentence"}',
  ].join('\n');
}

const NO_ENTRIES_MODEL = 'rule:no_entries_after_draw'; // decidedBy of a `no` that needed no model

// q.bundle = { entries, complete } from gather.buildBundle (replay items may pass the entries array alone).
const bundleOf = (q) => (Array.isArray(q.bundle) ? { entries: q.bundle, complete: false } : q.bundle || { entries: [], complete: false });

/**
 * Draft one verdict. deps: { llm(prompt)->object, now()->ISO }. Never writes.
 * Returns the draft record fields (without keys).
 */
async function draftQuestion(q, deps) {
  const today = String(deps.now()).slice(0, 10);
  const { entries, complete, coverageGaps = [] } = bundleOf(q);
  const base = { nEntries: entries.length, eventIds: entries.map((e) => e.eventId) };
  if (!entries.length) {
    // nothing to judge: after due + GRACE_DAYS on a complete bundle that is a `no` decided by rule (no model call)
    const d = lib.validateDraft({ verdict: 'no', why: 'no entry of the story after the draw' }, entries, today, q.deadline, { complete, coverageGaps });
    if (d.reason === lib.COVERAGE_GAP) return { ...d, ...base };
    return d.verdict === 'no' ? { ...d, model: NO_ENTRIES_MODEL, ...base } : { verdict: 'not_yet', why: 'no entry of the story after the draw', ...base };
  }
  let raw1;
  try { raw1 = await deps.llm(buildPrompt(q, entries, today)); } catch (e) { return { verdict: 'needs_human', note: `llm error: ${String(e.message).slice(0, 120)}`, ...base }; }
  const d1 = lib.validateDraft(raw1, entries, today, q.deadline, { complete, coverageGaps });
  let final = d1;
  if (d1.verdict === 'yes') {
    // second independent pass: the same bundle in the opposite order
    const rev = entries.slice().reverse();
    let d2 = null;
    try { d2 = lib.validateDraft(await deps.llm(buildPrompt(q, rev, today)), rev, today, q.deadline, { complete, coverageGaps }); } catch { d2 = null; }
    final = lib.combinePasses(d1, d2);
  }
  // the cited entry, kept as the verdict's evidence (looked up by eventId in what the judge was shown)
  const cited = final.verdict === 'yes' ? entries.find((e) => e.eventId === final.eventId) : null;
  const evidence = cited ? { eventId: cited.eventId, quote: final.quote, date: cited.date } : undefined;
  return { ...final, ...(evidence ? { evidence } : {}), ...base };
}

module.exports = { buildPrompt, draftQuestion };
