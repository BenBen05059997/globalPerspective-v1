'use strict';
// The brief views (briefViews.js, decision 0048): briefs/daily/DATE.json, briefs/weekly/WEEKOF.json and index/briefs.json, built
// from daily_brief / weekly_brief notes made (by the shared builders) from live-shaped rows (cli/fixtures/brief-rows.json:
// DAILY_BRIEF# and WEEKLY_BRIEF# rows read 2026-10-31). The view's `brief` must equal what the read API's actions answer for the row.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const V = require('../src/views');
const N = require('../src/_shared/notes');
const {briefWithIso3, weeklyWithIso3} = require('../src/_shared/briefs');
const X = require('./views-fixture');

const rows = JSON.parse(readFileSync(resolve(__dirname, '../../cli/fixtures/brief-rows.json'), 'utf8'));
const opts = {today: '2026-10-31', builtAt: '2026-10-31T23:45:00.000Z', runId: 'r', factsManifestDays: 1};
const producer = {lambda: 'test', runId: 'r'};
const JSONIFY = (x) => JSON.parse(JSON.stringify(x));
const dailyNotes = () => rows.daily.map((item) => N.dailyBriefNote({item, producer}));
const weeklyNotes = () => rows.weekly.map((item) => N.weeklyBriefNote({item, producer}));
const build = (notes = [...dailyNotes(), ...weeklyNotes()]) => V.buildViews(X.golden(), {...opts, notes});
// what the actions answer for a stored row: the row without keys and ttl, countries filled in
const asAction = (row, fill) => { const {PK, SK, ttl, ...rest} = row; return fill(rest); };

test('a daily view carries the brief exactly as the daily_brief action answers it, old rows (no iso3 stored) and new', () => {
  const v = build();
  assert.deepEqual([...v.briefs.daily.keys()].sort(), rows.daily.map((r) => r.dateKey).sort());
  for (const row of rows.daily) {
    const view = v.briefs.daily.get(row.dateKey);
    assert.deepEqual(JSONIFY(view.brief), JSONIFY(asAction(row, briefWithIso3)), row.dateKey);
    assert.deepEqual([view.schemaVersion, view.dateKey], [1, row.dateKey]);
  }
});

test('a weekly view carries the published brief as weekly_brief answers it; a draft has no view and is not in the index', () => {
  const v = build();
  const published = rows.weekly.filter((r) => r.status === 'published');
  assert.deepEqual([...v.briefs.weekly.keys()].sort(), published.map((r) => r.weekOf).sort());
  assert.equal(v.briefs.weekly.has('2026-06-21'), false);
  for (const row of published) assert.deepEqual(JSONIFY(v.briefs.weekly.get(row.weekOf).brief), JSONIFY(asAction(row, weeklyWithIso3)), row.weekOf);
  assert.equal(v.indexes['briefs.json'].weekly.some((w) => w.weekOf === '2026-06-21'), false);
});

test('the latest note of a day wins (a regenerated brief replaces the first), whatever the file order', () => {
  const first = dailyNotes()[0];
  const later = N.dailyBriefNote({item: {...rows.daily[0], headline: 'Regenerated', generatedAt: '2026-10-30T15:30:00.000Z'}, producer});
  for (const order of [[first, later], [later, first]]) {
    const v = build(order);
    assert.equal(v.briefs.daily.get('2026-10-30').brief.headline, 'Regenerated');
    assert.equal(v.briefs.daily.get('2026-10-30').brief.generatedAt, '2026-10-30T15:30:00.000Z');
  }
  // a published brief the operator later held back (the row is overwritten with a draft) is gone
  const held = N.weeklyBriefNote({item: {...rows.weekly[0], status: 'draft', generatedAt: '2026-10-25T07:00:00.000Z'}, producer});
  assert.equal(build([...weeklyNotes(), held]).briefs.weekly.has('2026-10-25'), false);
});

test('the index lists every brief newest first with its headline or lede, and is identical for any note order', () => {
  const idx = build().indexes['briefs.json'];
  assert.deepEqual(idx.daily.map((d) => d.dateKey), ['2026-10-30', '2026-10-25', '2026-06-10', '2026-04-09']);
  assert.deepEqual(idx.daily[0], {dateKey: '2026-10-30', headline: rows.daily[0].headline, generatedAt: rows.daily[0].generatedAt});
  assert.deepEqual(idx.weekly.map((w) => w.weekOf), ['2026-10-25', '2026-10-18', '2026-06-10']);
  assert.deepEqual(idx.weekly[0], {weekOf: '2026-10-25', asOf: rows.weekly[0].asOf, lede: rows.weekly[0].signals[0].lede, signals: 2, generatedAt: rows.weekly[0].generatedAt});
  assert.deepEqual(JSONIFY(build([...dailyNotes(), ...weeklyNotes()].reverse()).indexes['briefs.json']), JSONIFY(idx));
});

test('no brief notes: no brief views and an empty index (the build does not need them)', () => {
  const v = build([]);
  assert.deepEqual([v.briefs.daily.size, v.briefs.weekly.size], [0, 0]);
  assert.deepEqual([v.indexes['briefs.json'].daily, v.indexes['briefs.json'].weekly], [[], []]);
});

test('writeGroups writes the brief views with the story views and the index with the other indexes, before the manifest', () => {
  const groups = V.writeGroups(build());
  const keys = groups.map((g) => g.map(([k]) => k));
  assert.ok(keys[0].includes('briefs/daily/2026-10-30.json') && keys[0].includes('briefs/weekly/2026-10-25.json'));
  assert.equal(keys[0].includes('briefs/weekly/2026-06-21.json'), false);
  assert.ok(keys[1].includes('index/briefs.json'));
  assert.equal(keys.at(-1)[0], 'manifest.json');
});

test('the views satisfy their schemas, and the examples are the built views of the fixture rows', () => {
  const v = build();
  const dir = resolve(__dirname, '../schema/views');
  const ajv = new Ajv({allErrors: true, strict: false});
  const load = (n) => JSON.parse(readFileSync(resolve(dir, n), 'utf8'));
  const cases = [['brief-daily', v.briefs.daily.get('2026-10-30')], ['brief-weekly', v.briefs.weekly.get('2026-10-25')], ['briefs-index', v.indexes['briefs.json']]];
  for (const [name, view] of cases) {
    const validate = ajv.compile(load(`${name}.schema.json`));
    for (const x of name === 'brief-daily' ? v.briefs.daily.values() : name === 'brief-weekly' ? v.briefs.weekly.values() : [view]) assert.equal(validate(JSONIFY(x)), true, `${name}: ${JSON.stringify(validate.errors)}`);
    const file = resolve(dir, 'examples', `${name}.json`);
    if (process.env.UPDATE_GOLDEN) writeFileSync(file, `${JSON.stringify(JSONIFY(view), null, 2)}\n`);
    assert.deepEqual(load(`examples/${name}.json`), JSONIFY(view));
  }
});
