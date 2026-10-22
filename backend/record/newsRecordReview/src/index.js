'use strict';

// newsRecordReview: the weekly review (decision 0039, spec step3-spec.md). For the ISO week that ended, every active story gets one
// boxed model call; the answer is checked in code; accepted items become readings. Writes record/readings/YYYY-Www.jsonl,
// record/runs/review-YYYY-Www.json and record/inbox/merges/YYYY-MM-DD.jsonl; it is the only writer of those keys. A run that does
// not finish cleanly throws after writing its Run, so the schedule's Errors metric sees it.
const {isWeek, lastEndedWeek} = require('./week');
const {loadWorld, selectStories, assemble, latestEarlier} = require('./select');
const {PROMPT_VERSION, MAX_TOKENS, buildMessages, parseAnswer} = require('./prompt');
const {checkAnswer} = require('./check');
const {readingLines, mergeWeekFile, inboxLines, SUBTYPES} = require('./readings');

const producer = `newsRecordReview@${require('./package.json').version}`;
const CONCURRENCY = 6;
const SPARE_MS = 60000; // stop starting stories when less than this is left
const REJECTIONS_CAP = 500;
const messageOf = (e) => (e && e.message) || String(e);

function makeHandler({store, chat, model, now = () => new Date().toISOString(), timeLeft = () => Infinity}) {
  async function nextRunId(runKey, week) {
    const prev = await store.getJson(runKey);
    const n = prev && /-(\d+)$/.test(prev.runId || '') ? Number(prev.runId.match(/-(\d+)$/)[1]) + 1 : 1;
    return `review-${week}-${n}`;
  }

  async function pool(items, fn) {
    let i = 0;
    await Promise.all(Array.from({length: Math.min(CONCURRENCY, items.length)}, async () => {
      while (i < items.length) { const item = items[i]; i += 1; await fn(item); }
    }));
  }

  return async function handler(event = {}) {
    const week = event.week ?? lastEndedWeek(now());
    if (!isWeek(week)) throw new Error('week must be YYYY-Www');
    if (event.threadIds !== undefined && !(Array.isArray(event.threadIds) && event.threadIds.every((t) => typeof t === 'string'))) throw new Error('threadIds must be a list of strings');
    const shadow = event.shadow ?? true;
    const prefix = shadow ? 'record/shadow/' : 'record/';
    const dryRun = event.dryRun === true;
    const startedAt = now();
    const runKey = `${prefix}runs/review-${week}.json`;
    const run = {
      schemaVersion: 1, runId: dryRun ? `review-${week}-dry` : await nextRunId(runKey, week), week, producer, model: model || null, promptVersion: PROMPT_VERSION, shadow, startedAt, finishedAt: null,
      status: 'started', inputs: {factsThrough: null, activeStories: 0, threadIds: event.threadIds || null},
      counts: {selected: 0, skipped: 0, read: 0, failed: 0, notReached: 0, readings: Object.fromEntries(SUBTYPES.map((s) => [s, 0])), rejected: 0, autoMerges: 0},
      skipped: [], rejections: [], rejectionsOmitted: 0, failures: [], notes: dryRun ? 'dryRun: select and assemble only, nothing written' : '',
    };
    if (!dryRun) await store.putJson(runKey, run);
    let fatal = null;
    let summary = null;
    try {
      summary = await review({event, week, prefix, dryRun, run});
    } catch (e) {
      fatal = e;
      run.failures.push({stage: 'fatal', message: messageOf(e)});
    }
    run.finishedAt = now();
    run.status = fatal ? 'failed' : !run.failures.length ? 'ok' : run.counts.read > 0 ? 'partial' : 'failed';
    if (!dryRun) await store.putJson(runKey, run);
    if (fatal) throw fatal;
    if (run.status !== 'ok') throw new Error(`newsRecordReview ${run.runId} ${run.status}: ${run.failures.slice(0, 5).map((f) => `${f.stage}${f.threadId ? ` ${f.threadId}` : ''}: ${f.message}`).join('; ')}`);
    return dryRun ? {...summary, run} : {week, runId: run.runId, status: run.status, counts: run.counts};
  };

  async function review({event, week, prefix, dryRun, run}) {
    if (!dryRun && !model) throw new Error('REVIEW_MODEL is not set');
    const world = await loadWorld({store, prefix, week});
    run.inputs.factsThrough = world.manifest.factsThrough;
    run.inputs.activeStories = world.rows.length;
    const {selected, skipped} = selectStories(world, {threadIds: event.threadIds});
    run.counts.selected = selected.length;
    run.counts.skipped = skipped.length;
    run.skipped = skipped;
    const built = new Map();
    const assembled = (row) => { if (!built.has(row.threadId)) built.set(row.threadId, assemble(world, row)); return built.get(row.threadId); };
    const rowById = new Map(world.rows.map((r) => [r.threadId, r]));
    const assembleOther = (id) => (rowById.has(id) ? assemble(world, rowById.get(id), {withNeighbours: false}) : null);
    if (dryRun) {
      return {week, prefix, selected: selected.map((r) => ({threadId: r.threadId, bundleChars: JSON.stringify(assembled(r).bundle).length})), skipped};
    }

    const supersedable = latestEarlier(world.earlierReadings);
    const processed = new Set();
    const fresh = [];
    const merges = [];
    await pool(selected, async (row) => {
      if (timeLeft() < SPARE_MS) { run.counts.notReached += 1; run.failures.push({stage: 'timeout', threadId: row.threadId, message: 'not reached: Lambda time almost out'}); return; }
      try {
        const mine = assembled(row);
        const {system, user} = buildMessages(mine.bundle);
        const res = await chat({step: 'review', provider: 'deepseek', model, system, user, maxTokens: MAX_TOKENS, temperature: 0, json: true});
        const answer = parseAnswer(res.content);
        const {accepted, rejected} = checkAnswer(answer, {row, mine, world, assembleOther});
        const lines = readingLines({week, threadId: row.threadId, accepted, covers: mine.covers, runId: run.runId, model: res.model || model, promptVersion: PROMPT_VERSION, supersedable});
        processed.add(row.threadId);
        run.counts.read += 1;
        fresh.push(...lines);
        for (const l of lines) run.counts.readings[l.subtype] += 1;
        accepted.forEach((a, i) => { if (a.autoMerge) merges.push({autoMerge: a.autoMerge, reading: lines[i], why: a.payload.why}); });
        run.counts.rejected += rejected.length;
        for (const r of rejected) {
          if (run.rejections.length < REJECTIONS_CAP) run.rejections.push({threadId: row.threadId, ...r}); else run.rejectionsOmitted += 1;
        }
      } catch (e) {
        run.counts.failed += 1;
        run.failures.push({stage: 'read', threadId: row.threadId, message: messageOf(e)});
      }
    });

    if (processed.size) {
      const lines = mergeWeekFile(world.thisWeekReadings, fresh, processed);
      await store.putLines(`${prefix}readings/${week}.jsonl`, lines);
      const at = now();
      const inbox = inboxLines(merges.sort((a, b) => (a.reading.readingId < b.reading.readingId ? -1 : 1)), at);
      run.counts.autoMerges = inbox.length;
      if (inbox.length) {
        const key = `${prefix}inbox/merges/${at.slice(0, 10)}.jsonl`;
        const stored = await store.getLines(key);
        const have = new Set(stored.map((l) => l.readingId));
        await store.putLines(key, [...stored, ...inbox.filter((l) => !have.has(l.readingId))]);
      }
    }
    return null;
  }
}

module.exports = {makeHandler, CONCURRENCY};
