'use strict';
// Note readers (decision 0053): the rows SummarizeAndPredict held are rebuilt from the notes that the shared builders make from
// those rows, so a round trip (row -> note -> row) is the proof that a caller can switch source and keep its shape.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/notes');
const NR = require('../src/noteReads');

const producer = { lambda: 't', runId: 'r' };
const strip = ({ PK, SK, ttl, ...rest }) => rest;

const briefing = (over = {}) => ({ PK: 'COUNTRY#Japan', SK: 'COUNTRY_INTELLIGENCE', ttl: 1, countryName: 'Japan', headline: 'H', bluf: 'B', riskLevel: 'elevated', riskScore: 60, dimensions: { political: 60 }, lead: 'political',
  trajectory: 'stable', keyDevelopments: ['k'], generatedAt: '2026-10-26T05:15:44.865Z', model: 'deepseek-flash', latencyMs: 5, ...over });
const historyRow = (date, over = {}) => ({ PK: 'COUNTRY#Japan', SK: `HISTORY#${date}`, countryName: 'Japan', dateKey: date, riskLevel: 'high', riskScore: 70, dimensions: { political: 70 }, lead: 'political',
  trajectory: 'escalating', headline: `h${date}`, generatedAt: `${date}T05:15:00.000Z`, ttl: 1, ...over });
const driftItem = (asOf, over = {}) => ({ countryName: 'Japan', asOf, since: '2026-10-01', changeScore: { from: 40, to: 50, delta: 10 }, whyChanged: `w${asOf}`, noSingleDriver: false, generatedAt: `${asOf}T05:30:00.000Z`, ...over });

test('country briefing: the newest full briefing comes back as stored; a history copy is never the briefing', () => {
  const item = briefing();
  const notes = [N.countryNote({ item, iso3: 'JPN', producer }), N.countryHistoryNote({ item: historyRow('2026-10-27'), iso3: 'JPN', producer })];
  assert.deepEqual(NR.countryIntelligence(notes, 'JPN'), strip(item));
  assert.equal(NR.countryIntelligence(notes, 'UKR'), null);
  assert.equal(NR.countryIntelligence([notes[1]], 'JPN'), null);
});

test('country history: one row per day (the last run), newest first, rebuilt from briefing notes and history copies; capped at 90', () => {
  const run1 = N.countryNote({ item: briefing({ generatedAt: '2026-10-26T05:15:00.000Z', riskScore: 55 }), iso3: 'JPN', producer });
  const run2 = N.countryNote({ item: briefing({ generatedAt: '2026-10-26T17:15:00.000Z', riskScore: 61 }), iso3: 'JPN', producer });
  const copy = N.countryHistoryNote({ item: historyRow('2026-10-25'), iso3: 'JPN', producer });
  const rows = NR.countryHistory([run1, run2, copy], 'JPN');
  assert.deepEqual(rows.map((r) => [r.dateKey, r.riskScore]), [['2026-10-26', 61], ['2026-10-25', 70]]);
  assert.deepEqual(Object.keys(rows[1]).sort(), ['countryName', 'dateKey', 'dimensions', 'generatedAt', 'headline', 'lead', 'riskLevel', 'riskScore', 'trajectory']);
  assert.equal(rows[1].generatedAt, '2026-10-25T05:15:00.000Z');
  const many = Array.from({ length: 100 }, (_, i) => N.countryHistoryNote({ item: historyRow(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)), iso3: 'JPN', producer }));
  assert.equal(NR.countryHistory(many, 'JPN').length, 90);
  assert.deepEqual(NR.countryHistory(many, 'UKR'), []);
});

test('country drift: one row per asOf, newest first, as stored; an archive copy loses its provenance marker; story drift is another subject', () => {
  const live = N.driftNote({ item: driftItem('2026-10-20'), iso3: 'JPN', model: 'deepseek-flash', producer });
  const archive = N.driftNote({ item: { ...driftItem('2026-10-19'), from: 'archive' }, iso3: 'JPN', model: null, producer });
  const rerun = N.driftNote({ item: driftItem('2026-10-20', { whyChanged: 'second', generatedAt: '2026-10-20T09:00:00.000Z' }), iso3: 'JPN', model: 'deepseek-flash', producer });
  const story = N.storyDriftNote({ item: driftItem('2026-10-21', { countryName: undefined, threadId: 't1' }), threadId: 't1', model: 'm', producer });
  const rows = NR.countryDrift([live, archive, rerun, story], 'JPN');
  assert.deepEqual(rows.map((r) => [r.asOf, r.whyChanged]), [['2026-10-20', 'second'], ['2026-10-19', 'w2026-10-19']]);
  assert.equal('from' in rows[1], false);
  assert.deepEqual(rows[1], driftItem('2026-10-19'));
  assert.equal(NR.storyDrift([live, archive, story], 't1').asOf, '2026-10-21');
  assert.equal(NR.storyDrift([live], 't1'), null);
});

test('corrections feed: every drift note once per subject and day, country by name, story by threadId', () => {
  const a = N.driftNote({ item: driftItem('2026-10-20'), iso3: 'JPN', model: 'm', producer });
  const b = N.storyDriftNote({ item: driftItem('2026-10-21', { countryName: undefined, threadId: 't1' }), threadId: 't1', model: 'm', producer });
  const feed = NR.driftFeed([a, b, a]);
  assert.deepEqual(feed.map((f) => [f.scope, f.name, f.asOf]).sort(), [['country', 'Japan', '2026-10-20'], ['thread', 't1', '2026-10-21']]);
});

test('story analysis: the newest analysis as stored (iso3 only when it has countries); history merges analysis notes and history copies', () => {
  const item = { PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', ttl: 1, threadId: 't1', threadTitle: 'T', entryShortTitles: [], storyArc: 'a', trajectory: 'stable', rootCauseChain: null, watchQuestions: [], inflectionTopicId: null,
    riskScore: 50, dimensions: { conflict: { score: 50, why: 'w' } }, lead: 'conflict', sentiment: 0, keyActors: [], entryCount: 2, entryTopicIds: [], iso3: [], generatedAt: '2026-10-12T04:40:00.000Z', model: 'm', latencyMs: 3 };
  const old = N.storyAnalysisNote({ item: { ...item, generatedAt: '2026-10-11T04:40:00.000Z', riskScore: 45 }, producer });
  const now = N.storyAnalysisNote({ item, producer });
  const out = NR.storyAnalysis([old, now], 't1');
  const { iso3, ...asStored } = strip(item); // iso3 is [] on this item: the note says no countries, so the field stays absent
  assert.deepEqual(out, asStored);
  assert.equal(NR.storyAnalysis([now], 'other'), null);
  const copy = N.storyHistoryNote({ item: { threadId: 't1', dateKey: '2026-10-10', threadTitle: 'T', trajectory: 'stable', riskScore: 40, dimensions: null, lead: null, entryCount: 1, generatedAt: '2026-10-10T04:41:00.000Z' }, producer });
  const hist = NR.threadHistory([old, now], [copy], 't1');
  assert.deepEqual(hist.map((r) => [r.dateKey, r.riskScore]), [['2026-10-10', 40], ['2026-10-11', 45], ['2026-10-12', 50]]);
  assert.deepEqual(Object.keys(hist[2]).sort(), ['dateKey', 'dimensions', 'entryCount', 'generatedAt', 'lead', 'riskScore', 'threadId', 'threadTitle', 'trajectory']);
});

test('country facts: the newest run as stored, lastUpdatedAt from the note', () => {
  const row = (at, pop) => ({ PK: 'FACTS#Japan', SK: 'COUNTRY_FACTS', ttl: 1, countryName: 'Japan', population: { value: pop, year: 2024, source: 'wikidata', checkedAt: at }, lastUpdatedAt: at });
  const notes = [N.countryFactsNote({ item: row('2026-10-19T20:00:00.000Z', 1), iso3: 'JPN', producer }), N.countryFactsNote({ item: row('2026-10-26T20:00:00.000Z', 2), iso3: 'JPN', producer })];
  assert.deepEqual(NR.countryFacts(notes, 'JPN'), strip(row('2026-10-26T20:00:00.000Z', 2)));
  assert.equal(NR.countryFacts(notes, 'USA'), null);
});

test('readMode: ddb by default, notes and compare only when named', () => {
  assert.deepEqual([{}, { NOTES_READS: 'notes' }, { NOTES_READS: 'COMPARE' }, { NOTES_READS: 'x' }].map(NR.readMode), ['ddb', 'notes', 'compare', 'ddb']);
});

test('makeNoteReader: reads the days of the manifest once per window; a subtype with no manifest is empty; a failed read is not cached', async () => {
  const calls = [];
  let fail = true;
  const s3json = {
    getJson: async (key) => (key.endsWith('drift/manifest.json') ? { days: ['2026-10-02', '2026-10-01'] } : null),
    getLines: async (key) => { calls.push(key); if (fail) throw new Error('boom'); return { lines: [{ noteId: key }] }; },
  };
  let t = 0;
  const reader = NR.makeNoteReader({ s3json, ttlMs: 1000, now: () => t });
  await assert.rejects(reader.all('drift'), /boom/);
  fail = false;
  assert.deepEqual((await reader.all('drift')).map((n) => n.noteId), ['record/notes/drift/2026-10-01.jsonl', 'record/notes/drift/2026-10-02.jsonl']);
  const n = calls.length;
  await reader.all('drift');
  assert.equal(calls.length, n); // cached
  t = 2000;
  await reader.all('drift');
  assert.equal(calls.length, n + 2); // expired: read again
  assert.deepEqual(await reader.all('country_facts'), []);
  assert.deepEqual((await reader.all('drift', 1)).map((x) => x.noteId), ['record/notes/drift/2026-10-02.jsonl']);
});

test('rowReaders: the country briefing is matched by the exact name its record was keyed by; the story analysis by threadId; compare logs a difference', async () => {
  const item = briefing();
  const analysis = { PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', ttl: 1, threadId: 't1', threadTitle: 'T', entryShortTitles: [], storyArc: 'a', trajectory: 'stable', rootCauseChain: null, watchQuestions: [], inflectionTopicId: null,
    riskScore: 50, dimensions: { conflict: { score: 50, why: 'w' } }, lead: 'conflict', sentiment: 0, keyActors: [], entryCount: 2, entryTopicIds: [], iso3: ['JPN'], generatedAt: '2026-10-12T04:40:00.000Z', model: 'm', latencyMs: 3 };
  const noteSet = { country: [N.countryNote({ item, iso3: 'JPN', producer })], story_analysis: [N.storyAnalysisNote({ item: analysis, producer })] };
  const reader = { all: async (s) => noteSet[s] || [] };
  const store = { 'COUNTRY#Japan|COUNTRY_INTELLIGENCE': item, 'THREAD#t1|THREAD_ANALYSIS': analysis };
  const ddbGet = async (pk, sk) => store[`${pk}|${sk}`] || null;
  const logs = { info: [], warn: [] };
  const log = { info: (m) => logs.info.push(m), warn: (m) => logs.warn.push(m) };
  const make = (mode, g = ddbGet) => NR.rowReaders(NR.lambdaSource({ env: { NOTES_READS: mode }, reader, log }), g);
  const strip = ({ ttl, ...r }) => r;
  assert.deepEqual(strip(await make('notes').country('Japan')), strip(item));
  assert.equal(await make('notes').country('USA'), null); // an alias has no record, as in DynamoDB
  assert.equal(await make('ddb').country('USA'), null);
  assert.deepEqual(strip(await make('notes').thread('t1')), strip(analysis));
  assert.equal(await make('notes').thread('gone'), null);
  await make('compare').country('Japan');
  assert.ok(logs.info.some((l) => l.includes('[notes-compare] COUNTRY_INTELLIGENCE Japan: same')), logs.info.join('\n'));
  const skewed = await make('compare', async (pk, sk) => ({ ...(await ddbGet(pk, sk)), headline: 'other' })).country('Japan');
  assert.equal(skewed.headline, 'other'); // DynamoDB answers
  assert.ok(logs.warn.some((l) => l.includes('headline')), logs.warn.join('\n'));
  // a failing notes read in compare mode never breaks the answer
  const broken = NR.rowReaders(NR.lambdaSource({ env: { NOTES_READS: 'compare' }, reader: { all: async () => { throw new Error('s3 down'); } }, log }), ddbGet);
  assert.equal((await broken.country('Japan')).headline, 'H');
  assert.ok(logs.warn.some((l) => l.includes('notes read failed: s3 down')));
});
