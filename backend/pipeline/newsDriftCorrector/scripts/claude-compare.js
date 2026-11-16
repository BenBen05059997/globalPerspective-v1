'use strict';
// Claude comparison of the drift-note step (2026-11-16). Real drift notes (2026-11-08..13) from the public country views give the prior/current
// snapshots and the stored DeepSeek note (baseline); the event list is rebuilt from the public story views (entries of stories on the country, in
// the window). The prompt, parse and direction check are the Lambda's own (lib.js, directionCheck.js); the model call is made as index.js callLLM
// does it (chat, maxTokens 500, plain text). Same one retry on a direction mismatch as explainMove. Public GET data only; writes nothing to AWS.
const fs = require('node:fs');
const path = require('node:path');
const L = require('../../../shared/scripts/claude-compare-lib');
const lib = require('../src/lib');
const dirCheck = require('../src/directionCheck');

const dir = path.join(L.OUT, 'drift');
fs.mkdirSync(path.join(dir, 'inputs'), {recursive: true});
const V = 'https://globalperspective.net/data/record/views';
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };
const COUNTRIES = ['UKR', 'USA', 'COD', 'DEU', 'CHN'];
const MAX_EVENTS = 25; // the Lambda's DRIFT_MAX_EVENTS default

async function explain(which, subject, drift, events, tag) {
  const ctx = {axisMovesArr: lib.axisMoves(drift.prior, drift.current), changeDimensions: lib.changeDimensionsFrom(drift.moved)};
  const ask = (prompt, n) => L.call(which, {step: 'drift_note', user: prompt, temperature: 0.2, maxTokens: 500}, dir, `${tag}:${which}:${n}`);
  const trace = {};
  const r1 = await ask(lib.buildDriftPrompt(subject, drift.prior, drift.current, events), 1);
  trace.attempt1 = {finishReason: r1.finishReason, raw: r1.content};
  const note = lib.parseDriftResponse(r1.content, events);
  trace.parsed1 = Boolean(note);
  if (!note) return {note: null, trace};
  const verdict = dirCheck.checkDrift(note, ctx);
  trace.directionOk1 = verdict.ok;
  if (verdict.ok) return {note, trace};
  trace.problems1 = dirCheck.describeProblems(verdict.problems);
  const r2 = await ask(lib.buildDriftPrompt(subject, drift.prior, drift.current, events, trace.problems1), 2);
  trace.attempt2 = {finishReason: r2.finishReason, raw: r2.content};
  const retry = lib.parseDriftResponse(r2.content, events);
  if (retry) { const v2 = dirCheck.checkDrift(retry, ctx); trace.directionOk2 = v2.ok; if (v2.ok) return {note: retry, trace}; }
  return {note: {noSingleDriver: true, whyChanged: dirCheck.numbersOnlyText(drift), directionFlag: true}, trace};
}

(async () => {
  fs.writeFileSync(path.join(dir, 'calls.jsonl'), '');
  const active = (await get(`${V}/index/active.json`)).stories;
  const out = [];
  for (const iso of COUNTRIES) {
    const cv = await get(`${V}/countries/${iso}.json`);
    const n = cv.drift[0];
    const cur = {dateKey: n.asOf, riskLevel: n.currentRiskLevel, riskScore: n.changeScore.to, headline: n.currentHeadline, dimensions: n.currentDimensions, lead: n.currentLead};
    const priorDims = {};
    for (const [axis, m] of Object.entries(n.changeDimensions || {})) priorDims[axis] = m.from; // only moved axes are stored; the prompt uses only those
    const prior = {dateKey: n.since, riskLevel: n.changeLevel ? n.changeLevel.from : n.currentRiskLevel, riskScore: n.changeScore.from, headline: n.priorHeadline, dimensions: priorDims};
    const drift = {prior, current: cur, moved: lib.conclusionMoved(prior, cur)};
    // events: entries of stories on this country dated since..asOf, one per title, oldest first, last 25
    const stories = active.filter((s) => (s.iso3 || []).includes(iso) && String(s.lastEntryAt || '').slice(0, 10) >= n.since);
    const events = [];
    const seen = new Set();
    for (const s of stories) {
      let sv;
      try { sv = await get(`${V}/stories/${s.threadId}.json`); } catch { continue; }
      for (const e of sv.entries) if (e.date >= n.since && e.date <= n.asOf && !seen.has(e.title)) { seen.add(e.title); events.push({topicId: e.eventId, threadId: s.threadId, title: e.title, date: e.date}); }
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
    const ev = events.slice(-MAX_EVENTS);
    const stored = {whyChanged: n.whyChanged, noSingleDriver: n.noSingleDriver, triggerEvent: n.triggerEvent, model: n.model};
    const rec = {iso, country: n.countryName, asOf: n.asOf, since: n.since, nEventsBeforeCap: events.length, nEvents: ev.length, storedTriggerInRebuiltEvents: n.triggerEvent ? ev.some((e) => e.title === n.triggerEvent.title) : null, stored, results: {}};
    fs.writeFileSync(path.join(dir, 'inputs', `${iso}.json`), JSON.stringify({drift, events: ev}, null, 1));
    fs.writeFileSync(path.join(dir, 'inputs', `${iso}.prompt.txt`), lib.buildDriftPrompt(n.countryName, prior, cur, ev));
    for (const which of ['haiku', 'sonnet']) rec.results[which] = await explain(which, n.countryName, drift, ev, iso);
    out.push(rec);
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(out, null, 1));
  }
  const view = (note) => JSON.stringify(note ? {whyChanged: note.whyChanged, noSingleDriver: note.noSingleDriver, triggerEvent: note.triggerEvent && note.triggerEvent.title} : null);
  for (const rec of out) {
    const input = fs.readFileSync(path.join(dir, 'inputs', `${rec.iso}.prompt.txt`), 'utf8');
    const h = view(rec.results.haiku.note);
    rec.judge = {
      haikuVsSonnet: await L.judgePair(input, h, view(rec.results.sonnet.note), dir, `${rec.iso}:hs`),
      deepseekVsHaiku: await L.judgePair(input, view(rec.stored), h, dir, `${rec.iso}:dh`),
    };
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(out, null, 1));
  }
  console.log(JSON.stringify(L.summarize(dir)));
})().catch((e) => { console.error(e.message); process.exit(1); });
