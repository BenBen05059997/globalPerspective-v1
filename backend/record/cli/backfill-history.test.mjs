import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { replay, localS3, rewritePrefix, memoryClient } from './backfill-history.mjs';
import { openRecord, report } from './check-history.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');

const NOW = () => '2026-03-11T05:00:00.000Z';
const at = (d) => `${d}T08:00:00.000Z`;
const entry = (n, threadId, d, extra = {}) => ({ topicId: `Topic ${n}-${n}`, threadId, title: `Title ${n}`, regions: ['Iran'], sources: [{ source: 'bbc.com', url: `https://bbc.com/${extra.url || n}`, title: `Title ${n}` }], archivedAt: at(d), generationId: `g-${d}`, ai: { summary: `s${n}` }, ...extra });
const archive = [
  { id: 'archive#2026-03-07', entries: [entry(1, 'thread-a', '2026-03-07'), entry(2, 'thread-b', '2026-03-07')] },
  // 03-08: the first article again (an earlier listing), the second article under another thread (same day it is new, but its url is known), and a new one
  { id: 'archive#2026-03-08', entries: [entry(1, 'thread-a', '2026-03-08', { topicId: 'Topic 1-9' }), entry(3, 'thread-c', '2026-03-08', { url: 2 }), entry(4, 'thread-c', '2026-03-08')] },
  // 03-09 has no row (a missing day); 03-10 has a threadless entry and a same-day duplicate
  { id: 'archive#2026-03-10', entries: [entry(5, null, '2026-03-10'), entry(6, 'thread-d', '2026-03-10'), entry(7, 'thread-d', '2026-03-10', { url: 6 })] },
];
const pred = (topicId, day, extra = {}) => ({ PK: `PRED#${topicId}`, SK: day, topicId, title: extra.title, generatedAt: at(day), model: 'm', scenarios: [{ label: 'L', probability: 0.5, triggers: [{ id: '0-0', text: 'X happens', deadline: '2026-08-01' }] }], ...extra });
const rows = {
  archive,
  pred: [
    pred('Topic 1-1', '2026-03-07'), // the topic of an entry of the day: the replay's own rule places it
    pred('Title 4-0', '2026-03-09', { title: 'Title 4' }), // a topic id the archive never kept; its title equals an entry two days away
    pred('Nothing like it-3', '2026-03-10', { title: 'Nothing like it' }), // no story: copied whole, no fact
  ],
};

function target() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-'));
  const l = localS3({ dir });
  return { dir, s3json: makeS3Json({ client: l.client, GetObjectCommand: l.GetObjectCommand, PutObjectCommand: l.PutObjectCommand, bucket: 'b' }) };
}
const lines = (dir, rel) => fs.readFileSync(path.join(dir, 'record/shadow', rel), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('replay: archive days before the record become facts, runs and views through the nightly code; a missing day is a failed Run, not an error', async () => {
  const { dir, s3json } = target();
  const r = await replay({ from: '2026-03-07', to: '2026-03-10', rows, s3json, now: NOW });
  assert.equal(r.error, null);
  assert.deepEqual([r.days, r.ok, r.missingDays], [4, 3, ['2026-03-09']]);
  const facts = ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'].flatMap((d) => lines(dir, `facts/${d}.jsonl`));
  const entries = facts.filter((f) => f.kind === 'entry');
  assert.equal(entries.length, 5, 'eight archive entries: two articles listed again on a later day and one twice on one day are not second facts');
  assert.deepEqual(entries.find((f) => f.payload.title === 'Title 1').payload.regions, ['Iran']);
  assert.equal(entries.find((f) => f.payload.title === 'Title 5').threadId, null, 'a threadless entry is a fact with no story');
  assert.deepEqual(facts.filter((f) => f.kind === 'story_born').map((f) => [f.threadId, f.payload.born]).sort(), [['thread-a', '2026-03-07'], ['thread-b', '2026-03-07'], ['thread-c', '2026-03-08'], ['thread-d', '2026-03-10']]);
  const missing = JSON.parse(fs.readFileSync(path.join(dir, 'record/shadow/runs/2026-03-09.json'), 'utf8'));
  assert.deepEqual([missing.status, missing.inputs.archiveDay], ['failed', 'missing']);
});

test('replay: forecasts the replay\'s rule did not place are placed by title or copied whole; views carry the old stories; a second replay writes nothing new', async () => {
  const { dir, s3json } = target();
  const first = await replay({ from: '2026-03-07', to: '2026-03-10', rows, s3json, now: NOW });
  assert.deepEqual([first.gaps.facts, first.gaps.byRule.title, first.gaps.unresolved, first.gaps.legacyAppended], [1, 1, 1, 1]);
  const drawn = ['2026-03-07', '2026-03-09', '2026-03-10'].flatMap((d) => lines(dir, `facts/${d}.jsonl`)).filter((f) => f.kind === 'forecast_drawn');
  assert.deepEqual(drawn.map((f) => [f.payload.topicId, f.threadId, f.payload.threadFrom]).sort(), [['Title 4-0', 'thread-c', 'title'], ['Topic 1-1', 'thread-a', undefined]]);
  const legacy = lines(dir, 'legacy/predictions/2026-03-10.jsonl');
  assert.deepEqual([legacy[0].reason, legacy[0].pk, legacy[0].row.title], ['no_story', 'PRED#Nothing like it-3', 'Nothing like it']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'record/shadow/legacy/predictions/manifest.json'), 'utf8')).days, ['2026-03-10']);
  const all = JSON.parse(fs.readFileSync(path.join(dir, 'record/shadow/views/index/all.json'), 'utf8'));
  assert.deepEqual(all.stories.map((s) => s.threadId).sort(), ['thread-a', 'thread-b', 'thread-c', 'thread-d']);
  assert.equal(all.stories.find((s) => s.threadId === 'thread-c').born, '2026-03-08');

  const sizes = () => fs.readdirSync(path.join(dir, 'record/shadow/facts')).map((f) => fs.statSync(path.join(dir, 'record/shadow/facts', f)).size).join(',');
  const before = sizes();
  const second = await replay({ from: '2026-03-07', to: '2026-03-10', rows, s3json, now: NOW });
  assert.deepEqual([second.gaps.facts, second.gaps.legacyAppended], [0, 0]);
  const added = ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'].flatMap((d) => lines(dir, `facts/${d}.jsonl`)).filter((f) => f.kind !== 'run');
  assert.equal(new Set(added.map((f) => f.eventId)).size, added.length, 'no fact twice');
  assert.equal(before.split(',').length, sizes().split(',').length);
});

test('replay: a story_born the live record already holds for a thread the history also has is a second line with the same eventId; the views keep the earlier birth', async () => {
  const { facts: F } = { facts: require('../newsStoryRecord/src/facts.js') };
  const { dir, s3json } = target();
  const live = F.bornFact('thread-a', { born: '2026-09-06', bornAt: '2026-09-06T08:00:00.000Z', bornAtApprox: false, windowLimited: true, missingBefore: [] }, { title: 'Title 1', iso3: [], actors: [], sources: [], sourceRow: { store: 'NewsCache', key: { id: 'x' } } }, '2026-09-06-1');
  await require('../../shared/src/manifest.js').makeManifest(s3json).addDays('record/shadow/facts/manifest.json', ['2026-09-06']);
  await s3json.appendLines('record/shadow/facts/2026-09-06.jsonl', [live]);
  await replay({ from: '2026-03-07', to: '2026-03-10', rows, s3json, now: NOW });
  const births = ['2026-03-07', '2026-09-06'].flatMap((d) => lines(dir, `facts/${d}.jsonl`)).filter((f) => f.kind === 'story_born' && f.threadId === 'thread-a');
  assert.deepEqual([births.length, new Set(births.map((f) => f.eventId)).size], [2, 1]);
  const view = JSON.parse(fs.readFileSync(path.join(dir, 'record/shadow/views/stories/thread-a.json'), 'utf8'));
  assert.equal(view.born, '2026-03-07');
});

test('check-history: every archive entry is a fact or says which fact holds the same article; every PRED row is a fact or a legacy copy', async () => {
  const { dir, s3json } = target();
  await replay({ from: '2026-03-07', to: '2026-03-10', rows, s3json, now: NOW });
  const out = await report({ rec: openRecord({ record: path.join(dir, 'record/shadow') }), ddb: { archive, pred: rows.pred, analysis: null } });
  assert.deepEqual(out.entries.totals, { archiveEntries: 8, facts: 5, listedAgainSameDay: 1, listedAgainEarlier: 2, listedAgainLater: 0, noFact: 0, noThread: 1 });
  assert.deepEqual([out.forecasts.forecastFacts, out.forecasts.legacyCopies, out.forecasts.byMonth['2026-03'].neither], [2, 1, 0]);
  assert.equal(out.stories.archiveThreadsWithoutStory, 0);
});

test('rewritePrefix maps the nightly code\'s shadow prefix onto another prefix and leaves other keys; memoryClient refuses what the facts run never reads', async () => {
  const seen = [];
  const c = rewritePrefix({ send: async (cmd) => { seen.push(cmd.input.Key); return {}; } }, 'record/shadow-history/');
  await c.send({ input: { Key: 'record/shadow/facts/x.jsonl' } });
  await c.send({ input: { Key: 'record/facts/y.jsonl' } });
  assert.deepEqual(seen, ['record/shadow-history/facts/x.jsonl', 'record/facts/y.jsonl']);
  const m = memoryClient({ archive: [], pred: [] });
  assert.equal(await m.getItem('NewsCache', { id: 'today-archive' }), null);
  await assert.rejects(() => m.getItem('SummarizeAndPredict', { PK: 'x' }), /no reader/);
  await assert.rejects(() => m.query(), /not used/);
});
