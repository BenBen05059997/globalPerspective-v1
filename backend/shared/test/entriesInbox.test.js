'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/entriesInbox');

// The agent's merge as it was written inline before decision 0051, verbatim: the reference the shared function must keep.
const MAX = 50;
function trimOld(entry) {
  if (!entry.ai) return entry;
  const trimmed = {};
  for (const [k, v] of Object.entries(entry.ai)) trimmed[k] = typeof v === 'string' && v.length > 1500 ? v.slice(0, 1500) + '...' : v;
  return { ...entry, ai: trimmed };
}
const oldDaily = (existing, fresh) => { const ids = new Set(fresh.map((e) => e.topicId)); return [...existing.filter((e) => !ids.has(e.topicId)), ...fresh].map(trimOld).slice(-MAX); };
const oldToday = (existing, fresh, cutoff) => { const ids = new Set(fresh.map((e) => e.topicId)); return [...existing.filter((e) => !ids.has(e.topicId) && new Date(e.archivedAt).getTime() > cutoff), ...fresh].map(trimOld).slice(-MAX); };

// a small seeded generator so the runs are random but the test is repeatable
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

function runs(seed, { day = '2026-10-10', nRuns = 6, pool = 14, maxPerRun = 9, from = `${day}T01:00:00.000Z` } = {}) {
  const r = rng(seed);
  const out = [];
  let t = Date.parse(from);
  for (let i = 0; i < nRuns; i++) {
    t += 3600000 * (1 + Math.floor(r() * 3));
    const batch = new Date(t).toISOString();
    const ids = [...Array(pool).keys()].sort(() => r() - 0.5).slice(0, 3 + Math.floor(r() * (maxPerRun - 2)));
    const entries = ids.map((id, n) => ({
      topicId: `Topic ${id}-${id}`, threadId: `thread-${Math.floor(r() * 5)}`, title: `T${id}`, category: 'society', regions: ['France'], iso3: ['FRA'], actors: [],
      sources: [{ source: 'bbc.com', url: `https://bbc.com/${id}/${i}` }], archivedAt: new Date(t + n * 3).toISOString(), generationId: `gen-${i}`,
      ai: { summary: r() < 0.3 ? 'x'.repeat(1700) : `s${i}${id}`, prediction: null },
    }));
    out.push({ batch, entries });
  }
  return out;
}

test('mergeArchiveDay is the agent\'s old inline merge, for the daily row and for the 24 h today row', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    let daily = [];
    let today = [];
    let dailyOld = [];
    let todayOld = [];
    for (const { batch, entries } of runs(seed, { nRuns: 12, pool: 30, maxPerRun: 12 })) {
      const cutoff = Date.parse(batch) - 86400000;
      dailyOld = oldDaily(dailyOld, entries);
      todayOld = oldToday(todayOld, entries, cutoff);
      daily = I.mergeArchiveDay(daily, entries);
      today = I.mergeArchiveDay(today, entries, { keep: (e) => new Date(e.archivedAt).getTime() > cutoff });
      assert.deepEqual(daily, dailyOld);
      assert.deepEqual(today, todayOld);
    }
    assert.ok(daily.length <= MAX);
  }
});

test('replaying the lines of a day gives exactly what archive#DATE ends the day as, order included (random days, and a day over the 50 cap)', () => {
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const rs = runs(seed, { nRuns: seed === 16 ? 15 : 6, pool: seed === 16 ? 60 : 14, maxPerRun: seed === 16 ? 12 : 9 });
    let row = [];
    const lines = [];
    for (const { batch, entries } of rs) {
      row = oldDaily(row, entries);
      lines.push(...I.inboxLines(entries, { batch }));
    }
    const replayed = I.replayDay(lines);
    assert.deepEqual(replayed.entries, row);
    assert.equal(replayed.updatedAt, rs.at(-1).batch);
    // through JSON, as the file stores it
    assert.deepEqual(I.replayDay(lines.map((l) => JSON.parse(JSON.stringify(l)))).entries, row);
  }
});

test('a topic seen again replaces its entry, moves to the end, and keeps the thread of the run that wrote it', () => {
  const e = (topicId, threadId, at, gen) => ({ topicId, threadId, title: topicId, sources: [], archivedAt: at, generationId: gen });
  const l1 = I.inboxLines([e('A', 'thread-1', '2026-10-10T04:00:01.000Z', 'g1'), e('B', 'thread-2', '2026-10-10T04:00:02.000Z', 'g1')], { batch: '2026-10-10T04:00:00.000Z' });
  const l2 = I.inboxLines([e('A', 'thread-9', '2026-10-10T12:00:01.000Z', 'g2'), e('C', 'thread-3', '2026-10-10T12:00:02.000Z', 'g2')], { batch: '2026-10-10T12:00:00.000Z' });
  const { entries } = I.replayDay([...l1, ...l2]);
  assert.deepEqual(entries.map((x) => [x.topicId, x.threadId, x.generationId]), [['B', 'thread-2', 'g1'], ['A', 'thread-9', 'g2'], ['C', 'thread-3', 'g2']]);
  // a retried write has the same inboxIds, so the append key dedupes it (s3json.appendLines idKey)
  assert.deepEqual(I.inboxLines([e('A', 'thread-1', 'x', 'g1')], { batch: '2026-10-10T04:00:00.000Z' }).map((l) => l.inboxId), ['2026-10-10T04:00:00.000Z|0']);
});

test('the today row replay crosses midnight: yesterday\'s entry is replaced by today\'s, and an entry over 24 h old is dropped', () => {
  const e = (topicId, at, gen) => ({ topicId, threadId: 't', title: topicId, sources: [], archivedAt: at, generationId: gen });
  const lines = [
    ...I.inboxLines([e('A', '2026-10-09T20:00:01.000Z', 'g1'), e('B', '2026-10-09T20:00:02.000Z', 'g1')], { batch: '2026-10-09T20:00:00.000Z' }),
    ...I.inboxLines([e('A', '2026-10-10T04:00:01.000Z', 'g2'), e('C', '2026-10-10T04:00:02.000Z', 'g2')], { batch: '2026-10-10T04:00:00.000Z' }),
    ...I.inboxLines([e('D', '2026-10-10T21:00:01.000Z', 'g3')], { batch: '2026-10-10T21:00:00.000Z' }),
  ];
  assert.deepEqual(I.replayToday(lines).entries.map((x) => x.topicId), ['A', 'C', 'D']); // B (25 h old at the last write) is gone; A is today's, not yesterday's
  assert.deepEqual(I.replayToday(lines.slice(0, 4)).entries.map((x) => x.topicId), ['B', 'A', 'C']);
});

test('latestSelection is the newest batch only when it carries the whole selection', () => {
  const e = (topicId, at) => ({ topicId, threadId: 't', title: topicId, sources: [], archivedAt: at, generationId: 'g' });
  const sel = { topics: { A: { urgency: 'high', x_trending: true, primaryCountry: 'France', extra: 1 }, B: { urgency: 'low' } }, run: { of: 2, model: 'm', updatedAt: 'u' } };
  const whole = I.inboxLines([e('A', '2026-10-10T04:00:01.000Z'), e('B', '2026-10-10T04:00:02.000Z')], { batch: '2026-10-10T04:00:00.000Z', selection: sel });
  const s = I.latestSelection(whole);
  assert.deepEqual([s.batch, s.topicIds, s.run.of], ['2026-10-10T04:00:00.000Z', ['A', 'B'], 2]);
  assert.deepEqual(whole[0].latest, { urgency: 'high', x_trending: true, primaryCountry: 'France' }); // only the latest-only fields
  const single = I.inboxLines([e('A', '2026-10-10T12:00:01.000Z')], { batch: '2026-10-10T12:00:00.000Z', selection: sel }); // a manual run of one topic: 1 line of 2
  assert.equal(I.latestSelection([...whole, ...single]), null, 'an older whole run is not presented as the latest');
  const legacy = I.inboxLines([e('A', '2026-10-10T12:00:01.000Z')], { batch: '2026-10-10T12:00:00.000Z' });
  assert.equal(I.latestSelection([...whole, ...legacy]), null);
  assert.equal(I.latestSelection([]), null);
});

test('inboxLines needs a batch time and keeps the entry whole', () => {
  assert.throws(() => I.inboxLines([], {}), /batch/);
  const entry = { topicId: 'A', threadId: 't', title: 'x', sources: [{ url: 'u' }], archivedAt: '2026-10-10T04:00:01.000Z', generationId: 'g', ai: { summary: 'y'.repeat(2000) } };
  const [l] = I.inboxLines([entry], { batch: '2026-10-10T04:00:00.000Z' });
  assert.equal(l.ai.summary.length, 1503);
  assert.deepEqual(I.entryOfLine(l), I.trimAi(entry));
});
