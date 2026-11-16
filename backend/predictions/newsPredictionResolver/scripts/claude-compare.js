'use strict';
// Claude comparison of the settle-draft step (2026-11-16). Real questions from the public track-record view, evidence bundles rebuilt from the
// public story views with the Lambda's own gather.buildBundle, the Lambda's own draftQuestion/buildPrompt/validateDraft, and the model call made
// as index.js defaultDeps does it (chat, maxTokens 500, json). Reads public GET data only; writes nothing to AWS.
//   node claude-compare.js
const fs = require('node:fs');
const path = require('node:path');
const L = require('../../../shared/scripts/claude-compare-lib');
const {draftQuestion, buildPrompt} = require('../src/draft');
const gather = require('../src/gather');
const {parseJsonContent} = require('../src/_shared/llm');

const dir = path.join(L.OUT, 'resolver');
fs.mkdirSync(path.join(dir, 'inputs'), {recursive: true});
const V = 'https://globalperspective.net/data/record/views';
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };
// The first three have a stored DeepSeek verdict (baseline); the others were never judged (outage) .
const PICK = ['7c52a5756f037e427c72', 'd23074bd955423b2f574', '55f45f755677c439d3df', 'b63117ee3b808651d7e1', '38c97529fb4e58636267'];

(async () => {
  fs.writeFileSync(path.join(dir, 'calls.jsonl'), '');
  const tr = (await get(`${V}/${'track-record'}.json`)).questions; // data file, not a page address (quality/check_links)
  const out = [];
  for (const qid of PICK) {
    const q = tr.sampled.find((x) => x.qid === qid);
    let story = await get(`${V}/stories/${q.clusterKey}.json`);
    // a merged story's entries live on its survivor (the Lambda resolves the same alias map); the survivor's view holds them all
    if (story.aliasOf) story = await get(`${V}/stories/${story.aliasOf}.json`);
    const today = q.verdict && q.verdict.decidedAt ? q.verdict.decidedAt.slice(0, 10) : '2026-11-14';
    const loaded = {
      byThread: new Map([[story.threadId, story.entries.map((e) => ({fact: {kind: 'entry', eventId: e.eventId, date: e.date, at: e.at, payload: {title: e.title, summary: e.summary}, sources: e.sources}, day: e.date}))]]),
      aliases: new Map([[q.clusterKey, story.threadId]]), failed: new Map(), gaps: new Map(), available: true,
    };
    const item = {question: q.question, storyTitle: q.storyTitle, issuedAt: q.issuedAt, deadline: q.deadline, resolutionSource: q.resolutionSource, threadId: q.clusterKey};
    item.bundle = gather.buildBundle(item, loaded, today);
    const nowIso = `${today}T10:30:00.000Z`;
    const rec = {qid, state: q.state, storedDeepSeek: q.verdict ? {state: q.state, ...q.verdict} : null, today, nEntries: item.bundle.entries.length, coverageGaps: item.bundle.coverageGaps.length, results: {}};
    rec.storedQuoteInRebuiltBundle = q.verdict && q.verdict.quote ? item.bundle.entries.some((e) => (e.title + ' ' + e.summary).includes(q.verdict.quote)) : null;
    fs.writeFileSync(path.join(dir, 'inputs', `${qid}.prompt.txt`), buildPrompt(item, item.bundle.entries, today));
    for (const which of ['haiku', 'sonnet']) {
      const raws = [];
      const deps = {
        now: () => nowIso,
        async llm(prompt) {
          const r = await L.call(which, {step: 'settle_draft', user: prompt, temperature: 0.1, maxTokens: 500, json: true}, dir, `${qid}:${which}`);
          raws.push({finishReason: r.finishReason, content: r.content});
          return parseJsonContent(r.content);
        },
      };
      let d;
      try { d = await draftQuestion(item, deps); } catch (e) { d = {error: e.message}; }
      rec.results[which] = {draft: d, raws};
    }
    out.push(rec);
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(out, null, 1));
  }
  // blind judge, both orders: Haiku vs Sonnet on every case, and the stored DeepSeek answer vs Haiku where it exists
  const view = (r) => JSON.stringify({verdict: r.draft.verdict, quote: r.draft.quote, event_id: r.draft.eventId, why: r.draft.why, note: r.draft.note});
  for (const rec of out) {
    const input = fs.readFileSync(path.join(dir, 'inputs', `${rec.qid}.prompt.txt`), 'utf8');
    rec.judge = {haikuVsSonnet: await L.judgePair(input, view(rec.results.haiku), view(rec.results.sonnet), dir, `${rec.qid}:hs`)};
    if (rec.storedDeepSeek) rec.judge.deepseekVsHaiku = await L.judgePair(input, JSON.stringify({verdict: rec.state, quote: rec.storedDeepSeek.quote}), view(rec.results.haiku), dir, `${rec.qid}:dh`);
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(out, null, 1));
  }
  console.log(JSON.stringify(L.summarize(dir)));
})().catch((e) => { console.error(e.message); process.exit(1); });
