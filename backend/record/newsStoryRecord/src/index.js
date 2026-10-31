'use strict';

// newsStoryRecord: appends the day's facts to record/facts/YYYY-MM-DD.jsonl and writes the day's Run object
// (decision 0036), then rebuilds the views from all facts (decision 0037, publish.js). No model. Every run writes a Run, including a failed or empty one, and a run that did
// not finish cleanly throws after writing it, so the schedule's Errors metric sees it.
const {entryFact, bornFact, forecastFact, inboxVerdictFact, inboxDrawFact, inboxMergeFact, inboxSplitFact, inboxArticleFact, inboxAssignmentFact, ingestAssignmentFor, provisionalEntryFact, legacyVoidFact, isResolvable, runFact, KINDS} = require('./facts');
const {isDay, addDays, eachDay} = require('./_shared/world');
const {makePublisher} = require('./publish');

const producer = `newsStoryRecord@${require('./package.json').version}`;
const LOOKBACK_DAYS = 100; // fact days read back to skip known facts and to find forecast questions awaiting a verdict: due (7-90 days out) + grace (0038)
const INBOX_DAYS = 7; // verdict inbox days read each night: the run day and the 6 before
const THIN_ENTRIES = 20; // fewer entries than this and the day is recorded as thin (normal days hold 35-50)
const THIN_ARTICLES = 50; // fewer raw articles than this in the run day's article inbox and rawDay is {thin: n}

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
    const entered = new Set(known.filter((f) => f.kind === 'entry').map((f) => f.eventId));
    for (const e of input.entries) {
      const fact = entryFact(e, runId);
      facts.push(fact);
      // The ingest claim (0040 rule 3): a fresh entry also writes its assignment to the archive thread. A known entry already has it (or the backfill writes it).
      const claim = !entered.has(fact.eventId) && ingestAssignmentFor(fact, runId);
      if (claim) facts.push(claim);
      entered.add(fact.eventId);
      if (e.threadId && !firstOf.has(e.threadId)) firstOf.set(e.threadId, e);
    }
    for (const [threadId, birth] of Object.entries(input.births)) {
      if (birth.born === input.date && firstOf.has(threadId)) facts.push(bornFact(threadId, birth, firstOf.get(threadId), runId));
    }
    for (const snap of input.snapshots) {
      const threadId = snap.threadId || threadOfTopic.get(snap.topicId) || (input.threadOfTopic && input.threadOfTopic.get(snap.topicId));
      if (threadId) facts.push(forecastFact(snap, threadId, input.entries.filter((e) => e.topicId === snap.topicId), runId));
    }
    return facts;
  }

  // The article inbox (record/inbox/articles/DAY.jsonl): the run day and the 6 days before (or from `inboxFrom`). One unreadable day or
  // line is an `article` failure on the Run and the rest is kept. Sets inputs.rawDay from the run day's file (null when it cannot be read).
  async function articleFacts(date, {prefix, run, inboxFrom}) {
    const out = [];
    const days = eachDay(inboxFrom || addDays(date, -(INBOX_DAYS - 1)), date);
    const parts = await Promise.all(days.map(async (d) => {
      try { return await s3json.getLines(`${prefix}inbox/articles/${d}.jsonl`); } catch (e) { run.failures.push({stage: 'article', message: messageOf(e), ref: d}); return null; }
    }));
    for (const [i, part] of parts.entries()) {
      if (days[i] === date) run.inputs.rawDay = !part ? null : part.lines.length === 0 ? 'missing' : part.lines.length < THIN_ARTICLES ? {thin: part.lines.length} : 'present';
      for (const [n, line] of (part ? part.lines : []).entries()) {
        try { out.push(inboxArticleFact(line, run.runId)); } catch (e) { run.failures.push({stage: 'article', message: messageOf(e), ref: `${days[i]}#${n}`}); }
      }
    }
    return out;
  }

  // The stages of one day. Each failure is recorded on the Run; the run goes on where the next stage does not depend on it.
  async function stages(date, {prefix, run, inboxFrom, recovery}) {
    const input = await store.load(date, {prefix});
    Object.assign(run.inputs, inputsOf(input));
    const articles = await articleFacts(date, {prefix, run, inboxFrom});
    // A missing archive fails the Run for inputs but only the archive-derived kinds (entry, story_born, forecast_drawn) depend on it:
    // articles, verdicts, merges and splits come from their own inboxes and are appended regardless (0040 rule 1, a model outage cannot lose the news).
    // A recovered day has no archive by definition (0040 rule 2): that is the expected case, recorded as inputs.recovered, not a failure.
    if (!input.dayRow) {
      if (recovery) run.inputs.recovered = true;
      else run.failures.push({stage: 'inputs', message: `no archive#${date} row and no today-archive entries for the day`});
    }
    const known = await knownFacts(prefix, date);
    const knownIds = new Set(known.map((f) => f.eventId));
    let facts = input.dayRow ? buildFacts(input, known, run.runId) : [];
    // A day rebuilt by recovery may not draw forecasts: its snapshots would be dated after the fact (0036 recovery rule).
    if (recovery) {
      const refused = facts.filter((f) => f.kind === 'forecast_drawn').length;
      facts = facts.filter((f) => f.kind !== 'forecast_drawn');
      if (refused) run.notes = `${run.notes} refused forecast_drawn: ${refused}`;
    }
    facts.push(...articles);

    // Forecast questions from the lookback window (facts already written plus this run's): the fallback for an inbox line that lacks its thread or branch.
    const questions = new Map();
    for (const f of [...known, ...facts].filter((x) => x.kind === 'forecast_drawn')) {
      for (const b of f.payload.branches) if (b.qid) questions.set(b.qid, {threadId: f.threadId, branchId: b.branchId});
    }
    // Verdicts come from the resolver's inbox (record/inbox/verdicts/DAY.jsonl), the run day and the 6 days before (or from `inboxFrom`). No table is read.
    try {
      const days = eachDay(inboxFrom || addDays(date, -(INBOX_DAYS - 1)), date);
      const parts = await Promise.all(days.map((d) => s3json.getLines(`${prefix}inbox/verdicts/${d}.jsonl`)));
      for (const [i, part] of parts.entries()) {
        for (const [n, line] of part.lines.entries()) {
          try { facts.push(inboxVerdictFact(line, questions.get(line && line.qid), run.runId)); } catch (e) { run.failures.push({stage: 'verdict', message: messageOf(e), ref: `${days[i]}#${n}`}); }
        }
      }
    } catch (e) { run.failures.push({stage: 'verdict', message: messageOf(e)}); }
    // Draws (the resolver's weekly seed commits and draws, 0043), merges (the weekly review's auto-merges), splits (operator only) and assignments (operator, or the review's applied proposals) come the same way: inbox/draws/, inbox/merges/, inbox/splits/, inbox/assignments/, same days.
    for (const [dir, stage, build] of [['draws', 'draw', inboxDrawFact], ['merges', 'merge', inboxMergeFact], ['splits', 'split', inboxSplitFact], ['assignments', 'assignment', inboxAssignmentFact]]) {
      try {
        const days = eachDay(inboxFrom || addDays(date, -(INBOX_DAYS - 1)), date);
        const parts = await Promise.all(days.map((d) => s3json.getLines(`${prefix}inbox/${dir}/${d}.jsonl`)));
        for (const [i, part] of parts.entries()) {
          for (const [n, line] of part.lines.entries()) {
            try { facts.push(build(line, run.runId)); } catch (e) { run.failures.push({stage, message: messageOf(e), ref: `${days[i]}#${n}`}); }
          }
        }
      } catch (e) { run.failures.push({stage, message: messageOf(e)}); }
    }

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

  async function runDay(date, {prefix, backfill, views, inboxFrom, recovery}) {
    const runKey = `${prefix}runs/${date}.json`;
    const previous = await s3json.getJson(runKey);
    const attempt = (previous ? Number(/-(\d+)$/.exec(String(previous.runId))?.[1]) || 0 : 0) + 1;
    const run = {
      schemaVersion: 1, runId: `${date}-${attempt}`, date, producer, startedAt: now(), finishedAt: null, status: 'started',
      inputs: {archiveDay: null, todayArchive: null, rawDay: null}, counts: zeroCounts(), daysWritten: [], failures: [], notes: [backfill && 'backfill', recovery && 'recovery'].filter(Boolean).join(' '),
    };
    await s3json.putLatest(runKey, run);
    let fatal = null;
    try { await stages(date, {prefix, run, inboxFrom, recovery}); } catch (e) { fatal = e; run.failures.push({stage: 'fatal', message: messageOf(e)}); }
    // Views are rebuilt in full from every facts day, once per invocation (a backfill: after its last day). A view failure
    // leaves the facts as written and marks the Run partial.
    if (views) {
      try { await publisher.publish({prefix, today: now().slice(0, 10), builtAt: now(), runId: run.runId, changedDays: views.changedDays.concat(run.daysWritten)}); } catch (e) { run.failures.push({stage: 'views', message: messageOf(e)}); }
    }

    run.finishedAt = now();
    const written = run.daysWritten.length > 0;
    const viewsOnly = run.failures.every((f) => f.stage === 'views');
    const noInputs = run.failures.some((f) => f.stage === 'inputs');
    run.status = !run.failures.length ? 'ok' : !noInputs && (written || viewsOnly) ? 'partial' : 'failed';
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

  // The one-time job of 0040 rule 3: every entry fact already written gets its ingest assignment (its archive thread, at the entry's time), once.
  // Run only by an explicit event {assignmentsBackfill:true, shadow}. A re-run finds the facts already written and appends nothing.
  async function assignmentsBackfill({prefix}) {
    const at = now();
    const runId = `assignments-backfill-${at.slice(0, 10)}`;
    const {facts} = await publisher.readFacts(prefix, []);
    const have = new Set(facts.map((f) => f.eventId));
    const fresh = [];
    let entries = 0;
    for (const f of facts.filter((x) => x.kind === 'entry')) {
      const fact = ingestAssignmentFor(f, runId);
      if (!fact) continue;
      entries += 1;
      if (!have.has(fact.eventId) && !fresh.some((x) => x.eventId === fact.eventId)) fresh.push(fact);
    }
    const byDate = {};
    for (const f of fresh) (byDate[f.date] ||= []).push(f);
    const dates = Object.keys(byDate).sort();
    const result = {assignmentsBackfill: true, prefix, entries, written: fresh.length, alreadyAssigned: entries - fresh.length, days: dates};
    if (!fresh.length) return result;
    await manifest.addDays(`${prefix}facts/manifest.json`, dates);
    for (const d of dates) await s3json.appendLines(`${prefix}facts/${d}.jsonl`, byDate[d]);
    await publisher.publish({prefix, today: at.slice(0, 10), builtAt: at, runId, changedDays: dates});
    return result;
  }

  // The refresh of 0050, run after each ingest (and each brief) by {refresh:true, shadow}: today's archive entries join the views as
  // PROVISIONAL entries and the views are rebuilt. Nothing else is written: no fact, no Run, no run fact, no manifest day. The agent rewrites
  // today's archive during the day (an entry of a topic seen again is replaced, maybe with a new thread and no assignment line), so only the
  // nightly run, which appends facts, may freeze them; its facts then replace the provisional entries (same eventId, or the entry is gone).
  async function refresh({prefix}) {
    const at = now();
    const today = at.slice(0, 10);
    const runId = `refresh-${at}`;
    const provisional = [];
    const skipped = [];
    const rows = await store.loadDay(today, {prefix});
    for (const [n, e] of rows.entries()) {
      try { provisional.push(provisionalEntryFact(e, runId)); } catch (err) { skipped.push({n, topicId: e && e.topicId, message: messageOf(err)}); }
    }
    const published = await publisher.publish({prefix, today, builtAt: at, runId, changedDays: [], provisional});
    return {refresh: true, prefix, runId, today, entries: rows.length, skipped, ...published}; // published.provisional = those not already facts
  }

  return async function handler(event = {}) {
    const shadow = event.shadow ?? true;
    const prefix = shadow ? 'record/shadow/' : 'record/';
    if (event.refresh === true) return refresh({prefix});
    if (event.legacyVoid === true) return legacyVoid({prefix});
    if (event.assignmentsBackfill === true) return assignmentsBackfill({prefix});
    const bf = event.backfill;
    const strict = event.strict ?? true;
    const today = now().slice(0, 10);
    const dates = bf ? eachDay(bf.from, bf.to) : [event.date || now().slice(0, 10)];
    if (!dates.every(isDay)) throw new Error('date must be YYYY-MM-DD');
    if (event.inboxFrom !== undefined && !isDay(event.inboxFrom)) throw new Error('inboxFrom must be YYYY-MM-DD');
    const days = [];
    const changedDays = [];
    for (const [i, date] of dates.entries()) {
      const {run, fatal} = await runDay(date, {prefix, backfill: Boolean(bf), inboxFrom: event.inboxFrom, recovery: event.recovery === true, views: i === dates.length - 1 ? {changedDays} : null});
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
