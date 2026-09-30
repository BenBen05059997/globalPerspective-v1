'use strict';

const lib = require('./lib');

// The drafter. It sees ONLY: the question, its deadline, the issue day, the named source and the
// search results. It never receives the question's probability or any scenario probability:
// buildPrompt picks its fields explicitly, so a stray `p` on the input object cannot leak.

function buildPrompt(q, results, today) {
  const ctx = results.length
    ? results.map((r, i) => `[${i + 1}] ${r.title} (${r.source}${r.age ? ', ' + r.age : ''})\nURL: ${r.url}\n${r.snippet}`).join('\n\n')
    : '(no search results)';
  return [
    'You verify whether a specific forecast question came true, using ONLY the search results below. Respond with ONLY valid JSON, no markdown.',
    '',
    `Today: ${today}`,
    `Question: "${q.question}"`,
    `It concerned the story: ${q.storyTitle || '(unknown)'}`,
    `Issued on: ${String(q.issuedAt).slice(0, 10)}. Deadline: ${q.deadline}.`,
    `Named resolution source: ${q.resolutionSource || '(none named)'}`,
    '',
    'SEARCH RESULTS:',
    ctx,
    '',
    'Rules:',
    '- "yes": the event happened on or before the deadline. You MUST give "quote" (an exact, verbatim passage copied from the title or text of ONE result above, at least 12 characters) and "url" (that result\'s URL).',
    '- "no": the event did not happen by the deadline and the results would have reported it if it had.',
    '- "not_yet": the results do not settle it either way.',
    `- "void": the question cannot be judged; give "void_reason" as one of ${lib.VOID_REASONS.join(', ')}.`,
    '- Never use memory; never guess. If unsure, answer "not_yet".',
    '',
    'JSON: {"verdict":"yes|no|not_yet|void","void_reason":"","quote":"","url":"","why":"one sentence"}',
  ].join('\n');
}

const queriesFor = (q) => {
  const text = String(q.question || '').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').slice(0, 14).join(' ');
  return {
    pass1: [text.slice(0, 200), `${q.resolutionSource || ''} ${words}`.trim()],
    pass2: [`${words} announced`, `${q.storyTitle || ''} ${words.split(' ').slice(0, 6).join(' ')}`.trim()],
  };
}

async function gather(queries, search) {
  const seen = new Set();
  const out = [];
  for (const query of queries) {
    for (const r of await search(query)) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
  }
  return out.slice(0, 10);
}

/**
 * Draft one verdict. deps: { search(query)->results, llm(prompt)->object, now()->ISO }.
 * Never writes. Returns the draft record fields (without keys).
 */
async function draftQuestion(q, deps) {
  const today = String(deps.now()).slice(0, 10);
  const qs = queriesFor(q);
  const results1 = await gather(qs.pass1, deps.search);
  let raw1;
  try { raw1 = await deps.llm(buildPrompt(q, results1, today)); } catch (e) { return { verdict: 'needs_human', note: `llm error: ${String(e.message).slice(0, 120)}`, queries: qs.pass1, nResults: results1.length }; }
  const d1 = lib.validateDraft(raw1, results1, today, q.deadline);
  let final = d1;
  let queries = qs.pass1;
  if (d1.verdict === 'yes') {
    const results2 = await gather(qs.pass2, deps.search);
    let d2 = null;
    try { d2 = lib.validateDraft(await deps.llm(buildPrompt(q, results2, today)), results2, today, q.deadline); } catch { d2 = null; }
    final = lib.combinePasses(d1, d2);
    queries = [...qs.pass1, ...qs.pass2];
  }
  return { ...final, queries, nResults: results1.length };
}

module.exports = { buildPrompt, queriesFor, gather, draftQuestion };
