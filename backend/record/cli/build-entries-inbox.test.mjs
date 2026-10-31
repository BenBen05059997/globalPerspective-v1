import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inboxFromRows, writeInbox, localLines, prove } from './build-entries-inbox.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const { fakeClient } = require('../../shared/test/world.fake.js');
const { readInboxDays, rangeOfDays } = require('../newsStoryRecord/src/inboxEntries.js');

const src = (n) => ({ source: 'bbc.com', title: `h${n}`, url: `https://www.bbc.com/news/a${n}`, tier: 'primary', outletCountry: 'GB', outletType: 'national', snippet: 's', age: '1 hour ago' });
const entry = (n, day, hour, gen) => ({ topicId: `Topic ${n}-${n}`, threadId: `thread-${n % 2}`, title: `Title ${n}`, category: 'conflict', regions: ['France'], search_keywords: ['k'], iso3: ['FRA'], actors: ['Macron'], event_type: 'unrest', sources: [src(n)], archivedAt: `${day}T${hour}:00:00.${String(n).padStart(3, '0')}Z`, generationId: gen, ai: { summary: 'x'.repeat(n === 1 ? 1700 : 5) } });
const rows = [
  { date: '2026-10-09', entries: [entry(1, '2026-10-09', '04', 'g1'), entry(2, '2026-10-09', '04', 'g1')] },
  // a day of three runs as the agent's merge leaves it: run 2 replaced topic 2, so the row is run 1's topic 1, then run 2's, then run 3's
  { date: '2026-10-10', entries: [entry(1, '2026-10-10', '04', 'g1'), entry(3, '2026-10-10', '04', 'g1'), entry(2, '2026-10-10', '12', 'g2'), entry(4, '2026-10-10', '12', 'g2'), entry(5, '2026-10-10', '20', 'g3')] },
];

function archiveOf() {
  const c = fakeClient();
  for (const r of rows) c.put('NewsCache', { id: `archive#${r.date}`, entries: r.entries });
  return { c, range: () => world.archiveRange(c, '2026-10-08', '2026-10-10', { env: {}, nowMs: Date.parse('2026-10-10T12:00:00Z') }) };
}

test('inboxFromRows: one batch per run, in the row\'s order, and the replay is the row', () => {
  const days = inboxFromRows(rows);
  const lines = days.get('2026-10-10');
  assert.deepEqual([...new Set(lines.map((l) => l.batch))].length, 3);
  assert.deepEqual(lines.map((l) => l.topicId), rows[1].entries.map((e) => e.topicId));
  const I = require('../../shared/src/entriesInbox.js');
  assert.deepEqual(I.replayDay(lines).entries, rows[1].entries.map(I.trimAi));
});

test('prove: the facts built from the inbox files are byte-identical to the facts built from the archive rows', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbox-'));
  try {
    const { range } = archiveOf();
    const archive = await range();
    writeInbox(dir, inboxFromRows(rows));
    const files = readFileSync(path.join(dir, 'record/inbox/entries/2026-10-10.jsonl'), 'utf8').trim().split('\n');
    assert.equal(files.length, 5);
    const fromInbox = rangeOfDays(await readInboxDays(localLines(dir), 'record/', '2026-10-08', '2026-10-10'), '2026-10-08', '2026-10-10');
    const proof = prove({ archive, fromInbox, lastDay: '2026-10-10' });
    assert.deepEqual([proof.identical, proof.days, proof.inboxDays, proof.entries, proof.factsCompared, proof.mismatched, proof.unexplained, proof.births, proof.threadOfTopic], [true, 2, 2, 7, 7, [], [], true, true]);
    assert.ok(proof.factBytesCompared > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prove: a changed thread, a missing entry and today-archive extras are told apart', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inbox-'));
  try {
    const { c, range } = archiveOf();
    // today-archive holds an entry archived today that the day row lacks (the day-zero rule): expected on the archive side only
    c.put('NewsCache', { id: 'today-archive', entries: [entry(9, '2026-10-10', '13', 'g2')] });
    const archive = await range();
    const days = inboxFromRows(rows);
    const lines = days.get('2026-10-10');
    days.set('2026-10-10', lines.filter((l) => l.topicId !== 'Topic 4-4').map((l) => (l.topicId === 'Topic 3-3' ? { ...l, threadId: 'thread-x' } : l)));
    writeInbox(dir, days);
    const fromInbox = rangeOfDays(await readInboxDays(localLines(dir), 'record/', '2026-10-08', '2026-10-10'), '2026-10-08', '2026-10-10');
    const proof = prove({ archive, fromInbox, lastDay: '2026-10-10' });
    assert.equal(proof.identical, false);
    assert.equal(proof.todayArchiveExtras, 1);
    assert.deepEqual(proof.mismatched.map((m) => [m.topicId, m.why]).sort(), [['Topic 3-3', 'fact differs'], ['Topic 4-4', 'missing in inbox'], ['Topic 5-5', 'fact differs']]); // 5-5 moved up one place: the position is in the provenance
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
