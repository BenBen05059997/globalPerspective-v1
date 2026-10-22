'use strict';

// newsStoryRecord: appends the day's facts to record/facts/YYYY-MM-DD.jsonl and writes the day's Run object
// (decision 0036), then rebuilds the views from all facts (decision 0037, publish.js). No model. Every run writes a Run, including a failed or empty one, and a run that did
// not finish cleanly throws after writing it, so the schedule's Errors metric sees it.
const {entryFact, bornFact, forecastFact, verdictFact, legacyVoidFact, isResolvable, runFact, KINDS} = require('./facts');
const {isDay, addDays, eachDay} = require('./_shared/world');
const {makePublisher} = require('./publish');

const producer = `newsStoryRecord@${require('./package.json').version}`;
const LOOKBACK_DAYS = 100; // fact days read back to skip known facts and to find forecast questions awaiting a verdict: due (7-90 days out) + grace (0038)
const THIN_ENTRIES = 20; // fewer entries than this and the day is recorded as thin (normal days hold 35-50)

const zeroCounts = () => Object.fromEntries(KINDS.map((k) => [k, 0]));
const messageOf = (e) => (e && e.message) || String(e);

function makeHandler({store, s3json, manifest, now = () => new Date().toISOString()}) {
  const publisher = makePublisher({s3json});
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
    // Only questions without a final verdict fact are asked; on a Monday all are asked again, which picks up a VERDICT#n revision.
    const final = new Set([...known, ...facts].filter((x) => x.kind === 'verdict' && x.payload.qid).map((x) => x.payload.qid));
    const monday = new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
    const ask = [...questions.keys()].filter((q) => monday || !final.has(q));
    try {
      const verdicts = await store.verdicts(ask, date);
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

  async function runDay(date, {prefix, backfill, views}) {
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
    // Views are rebuilt in full from every facts day, once per invocation (a backfill: after its last day). A view failure
    // leaves the facts as written and marks the Run partial.
    if (views) {
      try { await publisher.publish({prefix, today: now().slice(0, 10), builtAt: now(), runId: run.runId, changedDays: views.changedDays.concat(run.daysWritten)}); } catch (e) { run.failures.push({stage: 'views', message: messageOf(e)}); }
    }

    run.finishedAt = now();
    const written = run.daysWritten.length > 0;
    const viewsOnly = run.failures.every((f) => f.stage === 'views');
    run.status = !run.failures.length ? 'ok' : written || viewsOnly ? 'partial' : 'failed';
    run.counts.run = 1;
    try {
      const fact = runFact(run, backfill ? `${date}T23:59:59.999Z` : undefined);
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

  // The one-time job of 0038 (Legacy): every branch without a question id gets a void verdict, once. Built here, run only by an
  // explicit event {legacyVoid:true, shadow}. A re-run finds the facts already written and appends nothing.
  async function legacyVoid({prefix}) {
    const at = now();
    const runId = `legacy-void-${at.slice(0, 10)}`;
    const {facts} = await publisher.readFacts(prefix, []);
    const have = new Set(facts.map((f) => f.eventId));
    const voided = new Set(facts.filter((f) => f.kind === 'verdict').map((f) => f.payload.branchId));
    const fresh = [];
    let legacy = 0;
    for (const f of facts.filter((x) => x.kind === 'forecast_drawn')) {
      for (const b of f.payload.branches) {
        if (isResolvable(b)) continue;
        legacy += 1;
        if (voided.has(b.branchId)) continue;
        voided.add(b.branchId);
        const fact = legacyVoidFact({threadId: f.threadId, branchId: b.branchId, at, runId});
        if (!have.has(fact.eventId)) fresh.push(fact);
      }
    }
    const result = {legacyVoid: true, prefix, legacyBranches: legacy, written: fresh.length, alreadyVoid: legacy - fresh.length, days: []};
    if (!fresh.length) return result;
    const date = at.slice(0, 10);
    await manifest.addDays(`${prefix}facts/manifest.json`, [date]);
    await s3json.appendLines(`${prefix}facts/${date}.jsonl`, fresh);
    result.days.push(date);
    await publisher.publish({prefix, today: date, builtAt: at, runId, changedDays: [date]});
    return result;
  }

  return async function handler(event = {}) {
    const shadow = event.shadow ?? true;
    const prefix = shadow ? 'record/shadow/' : 'record/';
    if (event.legacyVoid === true) return legacyVoid({prefix});
    const bf = event.backfill;
    const strict = event.strict ?? true;
    const today = now().slice(0, 10);
    const dates = bf ? eachDay(bf.from, bf.to) : [event.date || now().slice(0, 10)];
    if (!dates.every(isDay)) throw new Error('date must be YYYY-MM-DD');
    const days = [];
    const changedDays = [];
    for (const [i, date] of dates.entries()) {
      const {run, fatal} = await runDay(date, {prefix, backfill: Boolean(bf), views: i === dates.length - 1 ? {changedDays} : null});
      changedDays.push(...run.daysWritten);
      days.push({date, runId: run.runId, status: run.status, inputs: run.inputs, counts: run.counts, failures: run.failures});
      // A missing day is an error unless the run says it is expected history (strict:false) or it is today, whose row may not exist yet.
      const missingOnly = run.failures.length > 0 && run.failures.every((f) => f.stage === 'inputs');
      const tolerated = missingOnly && (!strict || date === today);
      if (run.status !== 'ok' && !tolerated) {
        if (!bf) throw fatal || new Error(`newsStoryRecord ${run.runId} ${run.status}: ${run.failures.map((f) => `${f.stage}: ${f.message}`).join('; ')}`);
        days.at(-1).error = true;
      }
    }
    if (days.some((d) => d.error)) throw Object.assign(new Error(`newsStoryRecord range: failed or missing days ${days.filter((d) => d.error).map((d) => d.date).join(', ')}`), {days});
    return bf ? {backfill: bf, days} : days[0];
  };
}

module.exports = {makeHandler, LOOKBACK_DAYS, THIN_ENTRIES};
