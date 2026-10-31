'use strict';

// Where the resolver finds its questions (decision 0052). Two jobs read PRED# rows today: the weekly draw (the questions issued in the week that pass the lead
// rule) and the nightly WATCH (every question branch). QUESTIONS_SOURCE says where they come from:
//   log      the PredictionLog `PRED#` rows with questionSchema (default; a Scan each, store.predRows / store.allQuestionPreds)
//   record   the `forecast_drawn` facts of record/facts/DAY.jsonl, turned back into row-shaped objects and run through the SAME lib.eligibleQuestions /
//            watch.questionsFromPreds, so the rules are not written twice. No table is read.
//   compare  both are read, the LOG is used, and the difference is logged as [questions-compare].
// The facts hold a forecast under the day of its `at`; a forecast drawn at 23:59:59 carries the next day's date, so the week's reads go one day past its end.
// The fact-to-row conversion is _shared/questionPool.js (rowOfFact), the same one the track-record view uses.

const lib = require('./lib');
const { rowsOfFacts } = require('./_shared/questionPool');
const watch = require('./watch');

const MODES = ['log', 'record', 'compare'];
const FACT_DAYS = 120; // WATCH reads this many days of facts: a question lives at most LEAD_MAX (90) days to its deadline plus its grace and re-draft days
const factsKey = (day) => `record/facts/${day}.jsonl`;
const runKey = (day) => `record/runs/${day}.json`;
const day = (s) => String(s).slice(0, 10);

const addDays = (d, n) => lib.addDays(d, n);
const eachDay = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

async function readFacts(facts, days) {
  const parts = await Promise.all(days.map((d) => facts.getLines(factsKey(d))));
  return parts.flatMap((p) => p.lines);
}

/** The log source: what the resolver did before. */
function logSource(store) {
  return {
    mode: 'log',
    async eligible(commit) { return lib.eligibleQuestions(await store.predRows(commit.weekStart, commit.weekEnd), commit.weekId); },
    async all() { return watch.questionsFromPreds(await store.allQuestionPreds()); },
  };
}

/**
 * The record source. `facts` = s3json-like ({getLines, getJson}). A week is drawn only when each of its days has a facts Run that is ok or partial with an archive
 * day (the nightly run really covered it), so a missed night postpones the draw (the tick tries again) instead of drawing from fewer forecasts than the log holds.
 */
function recordSource(facts, {today} = {}) {
  return {
    mode: 'record',
    async eligible(commit) {
      const days = eachDay(commit.weekStart, commit.weekEnd);
      for (const d of days) {
        const run = await facts.getJson(runKey(d));
        if (!run || !['ok', 'partial'].includes(run.status)) throw new Error(`record facts for ${d} are not complete (run ${run ? run.status : 'missing'}); the ${commit.weekId} draw waits`);
      }
      const rows = rowsOfFacts(await readFacts(facts, [...days, addDays(commit.weekEnd, 1)]));
      return lib.eligibleQuestions(rows.filter((r) => r.SK >= commit.weekStart && r.SK <= commit.weekEnd), commit.weekId);
    },
    async all() {
      const to = today || new Date().toISOString().slice(0, 10);
      return watch.questionsFromPreds(rowsOfFacts(await readFacts(facts, eachDay(addDays(to, 1 - FACT_DAYS), to))));
    },
  };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Two question lists (log and record), per qid: on one side only, or on both with the fields that differ. Order does not matter. */
function compareQuestions(log, record) {
  const a = new Map(log.map((q) => [q.qid, q]));
  const b = new Map(record.map((q) => [q.qid, q]));
  const differences = [];
  for (const [qid, q] of a) {
    const o = b.get(qid);
    if (!o) differences.push({ qid, only: 'log' });
    else if (!sameJson(q, o)) differences.push({ qid, fields: [...new Set([...Object.keys(q), ...Object.keys(o)])].filter((k) => !sameJson(q[k], o[k])) });
  }
  for (const qid of b.keys()) if (!a.has(qid)) differences.push({ qid, only: 'record' });
  return { log: a.size, record: b.size, differing: differences.length, differences };
}

/** Both sources read, the log used; the difference is logged. A record read that throws is logged and does not stop the log's answer. */
function compareSource(store, facts, {today, log = console} = {}) {
  const l = logSource(store);
  const r = recordSource(facts, {today});
  const check = async (what, fromLog, fromRecord) => {
    let diff;
    try { diff = compareQuestions(fromLog, await fromRecord()); } catch (e) { log.warn(`[questions-compare] ${JSON.stringify({ what, error: String(e.message).slice(0, 200) })}`); return; }
    const line = `[questions-compare] ${JSON.stringify({ what, log: diff.log, record: diff.record, differing: diff.differing, differences: diff.differences.slice(0, 20) })}`;
    if (diff.differing) log.warn(line); else log.log(line);
  };
  return {
    mode: 'compare',
    async eligible(commit) { const out = await l.eligible(commit); await check(`eligible ${commit.weekId}`, out, () => r.eligible(commit)); return out; },
    async all() { const out = await l.all(); await check('all', out, () => r.all()); return out; },
  };
}

function makeQuestions(mode, {store, facts, today, log = console} = {}) {
  const m = mode || 'log';
  if (!MODES.includes(m)) throw new Error(`newsPredictionResolver: QUESTIONS_SOURCE must be one of ${MODES.join(', ')}, got ${m}`);
  if (m !== 'log' && !facts) throw new Error(`newsPredictionResolver: QUESTIONS_SOURCE=${m} needs the record bucket`);
  return m === 'record' ? recordSource(facts, {today}) : m === 'compare' ? compareSource(store, facts, {today, log}) : logSource(store);
}

module.exports = {MODES, FACT_DAYS, logSource, recordSource, compareSource, compareQuestions, makeQuestions};
