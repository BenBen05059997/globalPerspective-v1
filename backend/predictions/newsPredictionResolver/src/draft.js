'use strict';

const lib = require('./lib');

// The drafter. It sees ONLY: the question, its deadline, the issue day, the named source and the
// search results. It never receives the question's probability or any scenario probability:
// buildPrompt picks its fields explicitly, so a stray `p` on the input object cannot leak.

function buildPrompt(q, results, today) {
  const ctx = results.length
    ? results.map((r, i) => `[${i + 1}] ${r.title} (${r.source}${r.date ? ', ' + r.date : r.age ? ', ' + r.age : ''})\nURL: ${r.url}\n${r.snippet}`).join('\n\n')
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

// The new entry facts of the story (title + summary, with the first cited url) read like search results, so a
// quote can be verified in them by the same code rule.
function entryResults(entries) {
  return (entries || []).slice(0, 3).map((f) => {
    const src = (f.sources || []).find((x) => x && x.url) || {};
    return { title: f.payload?.title || src.title || '', snippet: f.payload?.summary || '', source: src.outlet || 'record', url: src.url || '', age: '', date: f.date || '' };
  }).filter((r) => r.url && (r.title || r.snippet));
}

// GATHER: entry facts first, then searched results. A result dated after the due day is dropped (decision 0038:
// results dated before due); an undated result is kept.
async function gather(queries, search, { due, entries } = {}) {
  const seen = new Set();
  const out = [];
  const take = (r) => {
    if (!r.url || seen.has(r.url) || (due && r.date && r.date > due)) return;
    seen.add(r.url);
    out.push(r);
  };
  entryResults(entries).forEach(take);
  for (const query of queries) (await search(query)).forEach(take);
  return out.slice(0, 10);
}

/**
 * Draft one verdict. deps: { search(query)->results, llm(prompt)->object, now()->ISO }.
 * Never writes. Returns the draft record fields (without keys).
 */
async function draftQuestion(q, deps) {
  const today = String(deps.now()).slice(0, 10);
  const qs = queriesFor(q);
  const ctx = { due: q.deadline, entries: q.entries };
  const results1 = await gather(qs.pass1, deps.search, ctx);
  let raw1;
  try { raw1 = await deps.llm(buildPrompt(q, results1, today)); } catch (e) { return { verdict: 'needs_human', note: `llm error: ${String(e.message).slice(0, 120)}`, queries: qs.pass1, nResults: results1.length }; }
  const d1 = lib.validateDraft(raw1, results1, today, q.deadline);
  let final = d1;
  let queries = qs.pass1;
  if (d1.verdict === 'yes') {
    const results2 = await gather(qs.pass2, deps.search, ctx);
    let d2 = null;
    try { d2 = lib.validateDraft(await deps.llm(buildPrompt(q, results2, today)), results2, today, q.deadline); } catch { d2 = null; }
    final = lib.combinePasses(d1, d2);
    queries = [...qs.pass1, ...qs.pass2];
  }
  // the cited result, kept as the verdict's evidence (looked up by url in what the judge was shown)
  const cited = final.verdict === 'yes' ? results1.find((r) => r.url === final.url) : null;
  const evidence = cited ? { quote: final.quote, url: cited.url, title: cited.title || null, date: cited.date || null } : undefined;
  return { ...final, ...(evidence ? { evidence } : {}), queries, nResults: results1.length };
}

module.exports = { buildPrompt, queriesFor, gather, entryResults, draftQuestion };
