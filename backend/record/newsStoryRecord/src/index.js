'use strict';

// newsStoryRecord: appends the day's facts to record/facts/YYYY-MM-DD.jsonl (decision 0036). No model, no views.
const {entryFact, bornFact, forecastFact, verdictFact, runFact} = require('./facts');
const {isDay, addDays, eachDay} = require('./_shared/world');

const LOOKBACK_DAYS = 60; // fact days read back to skip known facts and to find forecast questions awaiting a verdict

function makeHandler({store, s3json, now = () => new Date().toISOString()}) {
  async function knownFacts(prefix, date) {
    const days = await Promise.all(eachDay(addDays(date, -LOOKBACK_DAYS), addDays(date, 1)).map((d) => s3json.getLines(`${prefix}facts/${d}.jsonl`)));
    return days.flatMap((d) => d.lines);
  }

  async function processDay(date, {prefix}) {
    const runId = `${date}-1`;
    const input = await store.load(date);
    const known = await knownFacts(prefix, date);
    const knownIds = new Set(known.map((f) => f.eventId));
    const facts = [];
    const threadOfTopic = new Map(input.entries.filter((e) => e.threadId).map((e) => [e.topicId, e.threadId]));
    for (const e of input.entries) facts.push(entryFact(e, runId));
    const firstOf = new Map();
    for (const e of input.entries) if (e.threadId && !firstOf.has(e.threadId)) firstOf.set(e.threadId, e);
    for (const [threadId, birth] of Object.entries(input.births)) {
      if (birth.born === date && firstOf.has(threadId)) facts.push(bornFact(threadId, birth, firstOf.get(threadId), runId));
    }
    for (const snap of input.snapshots) {
      const threadId = snap.threadId || threadOfTopic.get(snap.topicId);
      if (!threadId) continue;
      const fact = forecastFact(snap, threadId, input.entries.filter((e) => e.topicId === snap.topicId), runId);
      facts.push(fact);
    }
    // Forecast questions from the lookback window (facts already written plus this run's) wait here for a verdict.
    const questions = new Map();
    for (const f of [...known, ...facts].filter((x) => x.kind === 'forecast_drawn')) {
      for (const b of f.payload.branches) if (b.qid) questions.set(b.qid, {threadId: f.threadId, branchId: b.branchId});
    }
    const verdicts = await store.verdicts([...questions.keys()], date);
    for (const [qid, v] of Object.entries(verdicts)) for (const row of v.all) facts.push(verdictFact(row, questions.get(qid), runId));
    const fresh = facts.filter((f) => !knownIds.has(f.eventId));
    const byDate = {};
    for (const f of fresh) (byDate[f.date] ||= []).push(f);
    for (const d of Object.keys(byDate).sort()) await s3json.appendLines(`${prefix}facts/${d}.jsonl`, byDate[d]);
    return {date, runId, offered: facts.length, appended: fresh.length};
  }

  return async function handler(event = {}) {
    const date = event.date || now().slice(0, 10);
    if (!isDay(date)) throw new Error('date must be YYYY-MM-DD');
    const shadow = event.shadow ?? true;
    return processDay(date, {prefix: shadow ? 'record/shadow/' : 'record/'});
  };
}

module.exports = {makeHandler, LOOKBACK_DAYS};
