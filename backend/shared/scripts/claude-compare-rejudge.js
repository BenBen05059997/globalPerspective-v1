'use strict';
// Re-runs the blind A/B judge (both orders) for the resolver, drift and audit comparisons with the final judge settings
// (the first pass cut its answers at 400 tokens: parse failures). Reads each job's results.json, writes judge-final.json next to it.
// The inputs, the answers and the contest pairs are the same as in the first pass.
const fs = require('node:fs');
const path = require('node:path');
const L = require('./claude-compare-lib');

const read = (...p) => JSON.parse(fs.readFileSync(path.join(L.OUT, ...p), 'utf8'));
const text = (...p) => fs.readFileSync(path.join(L.OUT, ...p), 'utf8');

(async () => {
  {
    const dir = path.join(L.OUT, 'resolver');
    const view = (r) => JSON.stringify({verdict: r.draft.verdict, quote: r.draft.quote, event_id: r.draft.eventId, why: r.draft.why, note: r.draft.note});
    const out = [];
    for (const rec of read('resolver', 'results.json')) {
      const input = text('resolver', 'inputs', `${rec.qid}.prompt.txt`);
      const j = {qid: rec.qid, haikuVsSonnet: await L.judgePair(input, view(rec.results.haiku), view(rec.results.sonnet), dir, `${rec.qid}:hs-final`)};
      if (rec.storedDeepSeek) j.deepseekVsHaiku = await L.judgePair(input, JSON.stringify({verdict: rec.state, quote: rec.storedDeepSeek.quote}), view(rec.results.haiku), dir, `${rec.qid}:dh-final`);
      out.push(j);
      fs.writeFileSync(path.join(dir, 'judge-final.json'), JSON.stringify(out, null, 1));
    }
  }
  {
    const dir = path.join(L.OUT, 'drift');
    const view = (note) => JSON.stringify(note ? {whyChanged: note.whyChanged, noSingleDriver: note.noSingleDriver, triggerEvent: note.triggerEvent && note.triggerEvent.title} : null);
    const out = [];
    for (const rec of read('drift', 'results.json')) {
      const input = text('drift', 'inputs', `${rec.iso}.prompt.txt`);
      const h = rec.results.haiku.note;
      out.push({iso: rec.iso,
        haikuVsSonnet: await L.judgePair(input, view(h), view(rec.results.sonnet.note), dir, `${rec.iso}:hs-final`),
        deepseekVsHaiku: await L.judgePair(input, view(rec.stored), view(h), dir, `${rec.iso}:dh-final`)});
      fs.writeFileSync(path.join(dir, 'judge-final.json'), JSON.stringify(out, null, 1));
    }
  }
  {
    const dir = path.join(L.OUT, 'audit');
    const r = read('audit', 'results.json');
    const out = [];
    for (let i = 0; i < r.haiku.calls.length; i++) {
      const h = r.haiku.calls[i]; const s = r.sonnet.calls[i];
      out.push({i, ...(await L.judgePair(`${h.system}\n\n${h.user}`, h.content.trim(), s.content.trim(), dir, `audit:${i}:hs-final`))});
      fs.writeFileSync(path.join(dir, 'judge-final.json'), JSON.stringify(out, null, 1));
    }
  }
  for (const d of ['resolver', 'drift', 'audit']) console.log(d, JSON.stringify(L.summarize(path.join(L.OUT, d))));
})().catch((e) => { console.error(e.message); process.exit(1); });
