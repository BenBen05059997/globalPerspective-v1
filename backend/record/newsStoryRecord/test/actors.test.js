'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/views');
const Rd = require('../src/readings');
const X = require('./views-fixture');

const opts = {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: '2026-10-22-1', factsManifestDays: 7};
const build = (facts, o = {}) => V.buildViews(facts, {...opts, ...o});
const opFile = (...aliases) => ({schemaVersion: 1, aliases});
const AT = '2026-10-20T04:00:00.000Z';
const pad = (n = 100) => Array.from({length: n}, (_, i) => X.entry(`pad${String(i).padStart(3, '0')}`, AT, 'x', {sources: [`p${i}`]}));

test('AA1: an entry with a wikidataId canonicalises its name and variants to wd:Q...; without one, to its canonical name', () => {
  const {canon, map} = Rd.actorAliases(opFile(
    {canonical: 'name:donald trump', variants: ['name:trump'], wikidataId: 'Q22686'},
    {canonical: 'name:houthis', variants: ['name:houthi movement'], wikidataId: null},
    {canonical: 'name:putin', wikidataId: 'Q7747'},
  ), []);
  assert.deepEqual(['name:donald trump', 'name:trump', 'name:houthi movement', 'name:houthis', 'name:putin', 'name:other'].map(canon),
    ['wd:Q22686', 'wd:Q22686', 'name:houthis', 'name:houthis', 'wd:Q7747', 'name:other']);
  assert.equal(map.has('wd:Q22686'), false);
});

test('AA1: two operator entries with one Q-number pool into one wd: id; an invalid Q-number leaves the name form', () => {
  const {canon} = Rd.actorAliases(opFile(
    {canonical: 'name:zelensky', variants: [], wikidataId: 'Q3874799'},
    {canonical: 'name:zelenskyy', variants: ['name:volodymyr zelenskyy'], wikidataId: 'Q3874799'},
    {canonical: 'name:bad', variants: ['name:worse'], wikidataId: 'nonsense'},
  ), []);
  assert.deepEqual(['name:zelensky', 'name:zelenskyy', 'name:volodymyr zelenskyy'].map(canon), ['wd:Q3874799', 'wd:Q3874799', 'wd:Q3874799']);
  assert.equal(canon('name:worse'), 'name:bad');
});

test('AA1: an empty or missing alias file leaves every view as it was (golden unchanged)', () => {
  const base = JSON.stringify([...build(X.golden()).stories]);
  for (const operatorAliases of [null, opFile()]) assert.equal(JSON.stringify([...build(X.golden(), {operatorAliases}).stories]), base);
  assert.equal(JSON.stringify(build(X.golden()).links), JSON.stringify(build(X.golden(), {operatorAliases: opFile()}).links));
});

test('AA1: generic entries keep their id, are never given a wd: id, and map their variants', () => {
  const g = Rd.actorAliases(opFile({canonical: 'name:protesters', variants: ['name:demonstrators'], generic: true, wikidataId: 'Q1'}), []);
  assert.equal(g.canon('name:demonstrators'), 'name:protesters');
  assert.equal(g.isGeneric('name:protesters'), true);
  assert.equal(g.isGeneric('name:demonstrators'), false); // asked by canonical id, as the views do
  assert.equal(g.isGeneric('name:putin'), false);
});

test('AA1: a generic actor is still shown on entries and stories but is never a link ground', () => {
  const f = [X.entry('me', AT, 'x', {actorIds: ['name:protesters', 'name:demonstrators']}), X.entry('you', AT, 'x', {actorIds: ['name:protesters']}), ...pad()];
  assert.deepEqual(build(f).links.get('me').links.map((l) => l.otherThreadId), ['you']); // specific when not marked
  const v = build(f, {operatorAliases: opFile({canonical: 'name:protesters', variants: ['name:demonstrators'], generic: true})});
  assert.deepEqual(v.links.get('me').links, []);
  assert.deepEqual(v.stories.get('me').actorIds, ['name:protesters']);
  assert.deepEqual(v.all.stories.find((r) => r.threadId === 'me').actorIds, ['name:protesters']);
  // a named actor shared alongside it still links, and only the named one is listed
  const g = [X.entry('me', AT, 'x', {actorIds: ['name:protesters', 'name:putin']}), X.entry('you', AT, 'x', {actorIds: ['name:protesters', 'name:putin']}), ...pad()];
  assert.deepEqual(build(g, {operatorAliases: opFile({canonical: 'name:protesters', generic: true})}).links.get('me').links.map((l) => l.sharedActorIds), [['name:putin']]);
});

test('AA1: story merges come from merge facts only, so a generic actor (or any actor) never merges stories', () => {
  const f = [X.entry('me', AT, 'x', {actorIds: ['name:protesters']}), X.entry('you', AT, 'x', {actorIds: ['name:protesters']})];
  const v = build(f, {operatorAliases: opFile({canonical: 'name:protesters', generic: true})});
  assert.deepEqual([v.stories.get('me').aliasOf, v.stories.get('you').aliasOf], [null, null]);
});
