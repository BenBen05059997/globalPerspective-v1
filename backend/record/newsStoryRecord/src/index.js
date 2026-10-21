'use strict';

// newsStoryRecord: appends the day's facts to record/facts/YYYY-MM-DD.jsonl and writes the day's Run object
// (decision 0036). No model, no views. Every run writes a Run, including a failed or empty one, and a run that did
// not finish cleanly throws after writing it, so the schedule's Errors metric sees it.
const {entryFact, bornFact, forecastFact, verdictFact, runFact, KINDS} = require('./facts');
const {isDay, addDays, eachDay} = require('./_shared/world');

const producer = `newsStoryRecord@${require('./package.json').version}`;
const LOOKBACK_DAYS = 60; // fact days read back to skip known facts and to find forecast questions awaiting a verdict
const THIN_ENTRIES = 20; // fewer entries than this and the day is recorded as thin (normal days hold 35-50)

const zeroCounts = () => Object.fromEntries(KINDS.map((k) => [k, 0]));
const messageOf = (e) => (e && e.message) || String(e);

function makeHandler({store, s3json, manifest, now = () => new Date().toISOString()}) {
  async function knownFacts(prefix, date) {
    const days = await Promise.all(eachDay(addDays(date, -LOOKBACK_DAYS), addDays(date, 1)).map((d) => s3json.getLines(`${prefix}facts/${d}.jsonl`)));
    return days.flatMap((d) => d.lines);
  }

  // What the day's inputs were, for the Run (0036 section 4/5). A missing day is never recorded as ok.
  function inputsOf(input) {
    const row = input.dayRow;
    if (!row) return {archiveDay: 'missing', todayArchive: 'missing'};
    const fromToday = input.entries.filter((e) => e.sourceRow.key.id === 'today-archive').length;
    const archiveDay = row.source === 'today-archive' ? 'missing' : input.entries.length < THIN_ENTRIES ? {thin: input.entries.length} : 'present';
    return {archiveDay, todayArchive: fromToday ? 'present' : 'missing'};
  }

  function buildFacts(input, known, runId) {
    const facts = [];
    const threadOfTopic = new Map(input.entries.filter((e) => e.threadId).map((e) => [e.topicId, e.threadId]));
    const firstOf = new Map();
    for (const e of input.entries) {
      facts.push(entryFact(e, runId));
      if (e.threadId && !firstOf.has(e.threadId)) firstOf.set(e.threadId, e);
    }
    for (const [threadId, birth] of Object.entries(input.births)) {
      if (birth.born === input.date && firstOf.has(threadId)) facts.push(bornFact(threadId, birth, firstOf.get(threadId), runId));
    }
    for (const snap of input.snapshots) {
      const threadId = snap.threadId || threadOfTopic.get(snap.topicId);
      if (threadId) facts.push(forecastFact(snap, threadId, input.entries.filter((e) => e.topicId === snap.topicId), runId));
    }
    return facts;
  }

  // The stages of one day. Each failure is recorded on the Run; the run goes on where the next stage does not depend on it.
  async function stages(date, {prefix, run}) {
    const input = await store.load(date);
    Object.assign(run.inputs, inputsOf(input));
    if (!input.dayRow) {
      run.failures.push({stage: 'inputs', message: `no archive#${date} row and no today-archive entries for the day`});
      return;
    }
    const known = await knownFacts(prefix, date);
    const knownIds = new Set(known.map((f) => f.eventId));
    const facts = buildFacts(input, known, run.runId);

    // Forecast questions from the lookback window (facts already written plus this run's) wait here for a verdict.
    const questions = new Map();
    for (const f of [...known, ...facts].filter((x) => x.kind === 'forecast_drawn')) {
      for (const b of f.payload.branches) if (b.qid) questions.set(b.qid, {threadId: f.threadId, branchId: b.branchId});
    }
    try {
      const verdicts = await store.verdicts([...questions.keys()], date);
      for (const [qid, v] of Object.entries(verdicts)) {
        for (const row of v.all) {
          try { facts.push(verdictFact(row, questions.get(qid), run.runId)); } catch (e) { run.failures.push({stage: 'verdict', message: messageOf(e), ref: row.sk}); }
        }
      }
    } catch (e) { run.failures.push({stage: 'verdict', message: messageOf(e)}); }

    const seen = new Set(knownIds);
    const fresh = facts.filter((f) => !seen.has(f.eventId) && seen.add(f.eventId));
    const byDate = {};
    for (const f of fresh) (byDate[f.date] ||= []).push(f);
    const dates = Object.keys(byDate).sort();
    await register(prefix, dates, run);
    for (const d of dates) {
      try {
        await s3json.appendLines(`${prefix}facts/${d}.jsonl`, byDate[d]);
        run.daysWritten.push(d);
        for (const f of byDate[d]) run.counts[f.kind] += 1;
      } catch (e) { run.failures.push({stage: 'append', message: messageOf(e), ref: d}); }
    }
  }

  async function register(prefix, dates, run) {
    if (!dates.length) return;
    try { await manifest.addDays(`${prefix}facts/manifest.json`, dates); } catch (e) { run.failures.push({stage: 'manifest', message: messageOf(e)}); }
  }

  async function runDay(date, {prefix, backfill}) {
    const runKey = `${prefix}runs/${date}.json`;
    const previous = await s3json.getJson(runKey);
    const attempt = (previous ? Number(/-(\d+)$/.exec(String(previous.runId))?.[1]) || 0 : 0) + 1;
    const run = {
      schemaVersion: 1, runId: `${date}-${attempt}`, date, producer, startedAt: now(), finishedAt: null, status: 'started',
      inputs: {archiveDay: null, todayArchive: null}, counts: zeroCounts(), daysWritten: [], failures: [], notes: backfill ? 'backfill' : '',
    };
    await s3json.putLatest(runKey, run);
    let fatal = null;
    try { await stages(date, {prefix, run}); } catch (e) { fatal = e; run.failures.push({stage: 'fatal', message: messageOf(e)}); }

    run.finishedAt = now();
    const written = run.daysWritten.length > 0;
    run.status = !run.failures.length ? 'ok' : written ? 'partial' : 'failed';
    run.counts.run = 1;
    try {
      const fact = runFact(run);
      await register(prefix, [fact.date], run);
      await s3json.appendLines(`${prefix}facts/${fact.date}.jsonl`, [fact]);
      run.daysWritten = [...new Set([...run.daysWritten, fact.date])].sort();
    } catch (e) {
      run.failures.push({stage: 'run_fact', message: messageOf(e)});
      if (run.status === 'ok') run.status = 'partial';
    }
    await s3json.putLatest(runKey, run);
    return {run, fatal};
  }

  return async function handler(event = {}) {
    const shadow = event.shadow ?? true;
    const prefix = shadow ? 'record/shadow/' : 'record/';
    const bf = event.backfill;
    const dates = bf ? eachDay(bf.from, bf.to) : [event.date || now().slice(0, 10)];
    if (!dates.every(isDay)) throw new Error('date must be YYYY-MM-DD');
    const days = [];
    for (const date of dates) {
      const {run, fatal} = await runDay(date, {prefix, backfill: Boolean(bf)});
      days.push({date, runId: run.runId, status: run.status, inputs: run.inputs, counts: run.counts, failures: run.failures});
      // A missing day is expected history in a backfill; anywhere else a run that did not finish cleanly is an error.
      const expected = bf && run.failures.every((f) => f.stage === 'inputs');
      if (!bf && run.status !== 'ok') throw fatal || new Error(`newsStoryRecord ${run.runId} ${run.status}: ${run.failures.map((f) => `${f.stage}: ${f.message}`).join('; ')}`);
      if (bf && run.status !== 'ok' && !expected) days.at(-1).error = true;
    }
    if (days.some((d) => d.error)) throw Object.assign(new Error(`newsStoryRecord backfill: failed days ${days.filter((d) => d.error).map((d) => d.date).join(', ')}`), {days});
    return bf ? {backfill: bf, days} : days[0];
  };
}

module.exports = {makeHandler, LOOKBACK_DAYS, THIN_ENTRIES};
