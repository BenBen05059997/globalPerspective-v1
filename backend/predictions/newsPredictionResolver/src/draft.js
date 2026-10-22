'use strict';

const lib = require('./lib');

// The drafter (JUDGE). It sees ONLY: the question, its deadline, the issue day, the named source and the evidence
// bundle (the story's own entry facts dated after the draw, see gather.js). It never receives the question's
// probability or any scenario probability: buildPrompt picks its fields explicitly, so a stray `p` on the input
// object cannot leak.

function buildPrompt(q, entries, today) {
  const ctx = entries.length
    ? entries.map((e) => `[${e.eventId}] ${e.title} (${e.date})\n${e.summary}`).join('\n\n')
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
    '- "no": the event did not happen by the deadline and the entries would have reported it if it had.',
    '- "not_yet": the entries do not settle it either way.',
    `- "void": the question cannot be judged; give "void_reason" as one of ${lib.VOID_REASONS.join(', ')}.`,
    '- Never use memory; never guess. If unsure, answer "not_yet".',
    '',
    'JSON: {"verdict":"yes|no|not_yet|void","void_reason":"","quote":"","event_id":"","why":"one sentence"}',
  ].join('\n');
}

// q.bundle = { entries, complete } from gather.buildBundle (replay items may pass the entries array alone).
const bundleOf = (q) => (Array.isArray(q.bundle) ? { entries: q.bundle, complete: false } : q.bundle || { entries: [], complete: false });

/**
 * Draft one verdict. deps: { llm(prompt)->object, now()->ISO }. Never writes.
 * Returns the draft record fields (without keys).
 */
async function draftQuestion(q, deps) {
  const today = String(deps.now()).slice(0, 10);
  const { entries } = bundleOf(q);
  const base = { nEntries: entries.length, eventIds: entries.map((e) => e.eventId) };
  if (!entries.length) return { verdict: 'not_yet', why: 'no entry of the story after the draw', ...base };
  let raw1;
  try { raw1 = await deps.llm(buildPrompt(q, entries, today)); } catch (e) { return { verdict: 'needs_human', note: `llm error: ${String(e.message).slice(0, 120)}`, ...base }; }
  const d1 = lib.validateDraft(raw1, entries, today, q.deadline);
  let final = d1;
  if (d1.verdict === 'yes') {
    // second independent pass: the same bundle in the opposite order
    const rev = entries.slice().reverse();
    let d2 = null;
    try { d2 = lib.validateDraft(await deps.llm(buildPrompt(q, rev, today)), rev, today, q.deadline); } catch { d2 = null; }
    final = lib.combinePasses(d1, d2);
  }
  // the cited entry, kept as the verdict's evidence (looked up by eventId in what the judge was shown)
  const cited = final.verdict === 'yes' ? entries.find((e) => e.eventId === final.eventId) : null;
  const evidence = cited ? { eventId: cited.eventId, quote: final.quote, date: cited.date } : undefined;
  return { ...final, ...(evidence ? { evidence } : {}), ...base };
}

module.exports = { buildPrompt, draftQuestion };
