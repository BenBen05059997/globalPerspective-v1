'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildWebIndex } = require('../src/webRecords');
const { isCountryName } = require('../src/placeFilter');

const NOW = '2026-10-01T05:00:00Z';
const isCountry = (n) => isCountryName(n);
const ent = (topicId, threadId, date, regions, title) => ({ topicId, threadId, date, regions, title: title || `Title ${topicId}` });
const node = (id, summary) => ({ threadId: id, summary: summary || `sum ${id}` });
const edge = (from, to, conf, extra = {}) => ({ from, to, confidence: conf, lagDays: 5, mechanism: `mech ${from}>${to}`, citedEntries: ['x1'], cited: [{ topicId: 'x1', date: '2026-09-20', title: 'Cited headline' }], ...extra });

// 6 threads in scope: A,B linked (Iran web), C in a web but no link, D,E have 2+ entries and are not in any web, F single update
const entries = [
  ent('a1', 'A', '2026-09-28', ['Iran']), ent('a2', 'A', '2026-09-30', ['Iran', 'Israel']),
  ent('b1', 'B', '2026-09-27', ['Iran']), ent('b2', 'B', '2026-09-29', ['Iran']),
  ent('c1', 'C', '2026-09-26', ['Iran']), ent('c2', 'C', '2026-09-30', ['Iran']),
  ent('d1', 'D', '2026-09-25', ['France']), ent('d2', 'D', '2026-09-30', ['France']),
  ent('e1', 'E', '2026-09-24', ['Peru']), ent('e2', 'E', '2026-09-29', ['Peru']),
  ent('f1', 'F', '2026-09-30', ['Chile']),
  ent('old1', 'OLD', '2026-08-01', ['Iran']), ent('old2', 'OLD', '2026-08-02', ['Iran']), // outside the 14-day scope
];
const rows = [
  { countryName: 'Iran', generatedAt: '2026-09-30T05:00:00Z', nodes: [node('A'), node('B'), node('C')], edges: [edge('A', 'B', 'strong')], backbone: [{ from: 'A', to: 'C', sharedActors: ['Hormuz'], weight: 1 }] },
  { countryName: 'Europe', generatedAt: '2026-09-30T05:00:00Z', nodes: [node('D')], edges: [], backbone: [] },     // a region: ignored
  { countryName: 'Japan', generatedAt: '2026-08-01T05:00:00Z', nodes: [node('E')], edges: [], backbone: [] },       // 61 days old: ignored
];
const { index, records } = buildWebIndex({ rows, entries, now: NOW, targets: ['Iran'], runId: 'r1', isCountry });

test('coverage: scope, eligible, in any web, linked (real countries only, fresh webs only)', () => {
  const c = index.coverage;
  assert.strictEqual(c.threadsInScope, 6);
  assert.strictEqual(c.eligible, 5);
  assert.strictEqual(c.inAnyWeb, 3);
  assert.strictEqual(c.withLink, 2);
  assert.strictEqual(c.pctOfAll, 50);
  assert.strictEqual(c.pctOfEligible, 60);
  assert.deepStrictEqual(c.byState, { linked: 2, analysed_no_links: 1, country_not_analysed: 2, single_update: 1 });
});

test('every story gets the state the page will explain', () => {
  const s = index.threads;
  assert.strictEqual(s.A.state, 'linked'); assert.strictEqual(s.B.state, 'linked');
  assert.strictEqual(s.C.state, 'analysed_no_links');
  assert.strictEqual(s.D.state, 'country_not_analysed'); // its only web is a region row
  assert.strictEqual(s.E.state, 'country_not_analysed'); // its web is 61 days old
  assert.strictEqual(s.F.state, 'single_update');
  assert.strictEqual(s.OLD, undefined);
});

test('records: both directions, own confidence, cited headlines, shared actors, places', () => {
  const a = records.find((r) => r.threadId === 'A');
  const b = records.find((r) => r.threadId === 'B');
  assert.strictEqual(a.into[0].other, 'B');
  assert.strictEqual(a.into[0].confidence, 'strong');
  assert.strictEqual(a.into[0].cited[0].title, 'Cited headline');
  assert.strictEqual(a.into[0].title, 'Title b2'); // the other story's newest headline
  assert.strictEqual(b.from[0].other, 'A');
  assert.strictEqual(a.shared[0].actors[0], 'Hormuz');
  assert.deepStrictEqual(a.places.map((p) => p.name), ['Iran', 'Israel']);
  assert.ok(records.every((r) => r.runId === 'r1'));
  assert.strictEqual(records.find((r) => r.threadId === 'F'), undefined); // not in any web: index only
});

test('two webs disagree: both links are kept with their own confidence (never the max)', () => {
  const two = [...rows, { countryName: 'Israel', generatedAt: '2026-09-29T05:00:00Z', nodes: [node('A'), node('B')], edges: [edge('A', 'B', 'weak')], backbone: [] }];
  const r = buildWebIndex({ rows: two, entries, now: NOW, targets: [], runId: 'r2', isCountry }).records.find((x) => x.threadId === 'A');
  assert.deepStrictEqual(r.into.map((l) => l.confidence), ['strong', 'weak']);
  assert.deepStrictEqual(r.into.map((l) => l.country), ['Iran', 'Israel']);
});

test('index: targets, webs used, flat links; empty inputs are safe', () => {
  assert.deepStrictEqual(index.targets, { count: 1, countries: ['Iran'] });
  assert.deepStrictEqual(index.websUsed.map((w) => w.country), ['Iran']);
  assert.strictEqual(index.links.length, 1);
  const e = buildWebIndex({ rows: [], entries: [], now: NOW, isCountry });
  assert.strictEqual(e.index.coverage.threadsInScope, 0);
  assert.strictEqual(e.index.coverage.pctOfAll, null);
  assert.deepStrictEqual(e.records, []);
});
