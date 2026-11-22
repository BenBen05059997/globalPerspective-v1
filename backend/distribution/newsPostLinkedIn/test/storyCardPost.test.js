'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { storyCardFor, siteDataReader } = require('../src/storyCardPost');

const step = (iso3) => ({ iso3, date: '2026-11-20' });
const story = (id, iso3, extra = {}) => ({ threadId: id, title: `Story ${id}`, category: 'conflict', entries: [step(iso3)], newestStep: { role: 'move', date: '2026-11-20', sourceCount: 2 }, stepCount: 2, stepDays: 1, ...extra });
const fork = { drawnAt: '2026-11-20', branches: [{ branchId: 'PRED#a/2026-11-20/1-x', qid: 'q1', question: true, p: 0.22, due: '2026-12-20', trigger: 'Poland invokes Article 4' }] };
const links = (otherIsos) => ({ judgedLinks: [{ from: 'a', to: 'b', confidence: 'medium', otherTitle: 'Story b', generatedAt: '2026-11-20' }], web: { places: [{ iso3: 'SAU' }], otherPlaces: { b: otherIsos.map((iso3) => ({ iso3 })) } } });
const reader = (files) => async (path) => (path in files ? files[path] : null);

test('a link to a story in new places leads the card', async () => {
  const get = reader({ 'record/views/stories/a.json': story('a', ['SAU']), 'record/views/stories/b.json': story('b', ['EGY']), 'record/views/links/a.json': links(['EGY']), 'record/views/forecasts/a.json': { forks: [fork] } });
  const d = await storyCardFor('a', { get, today: '2026-11-22' });
  assert.equal(d.link.direction, 'feeds');
  assert.equal(d.forecast.chance, 0.22);
});

test('a link to a story in the same places does not lead: the forecast does', async () => {
  const get = reader({ 'record/views/stories/a.json': story('a', ['SAU', 'YEM']), 'record/views/stories/b.json': story('b', ['SAU']), 'record/views/links/a.json': links(['SAU']), 'record/views/forecasts/a.json': { forks: [fork] } });
  const d = await storyCardFor('a', { get, today: '2026-11-22' });
  assert.equal(d.link, null);
  assert.equal('linkPlaces' in d, false);
  assert.equal(d.forecast.chance, 0.22);
});

test('no story view, or an id that is not a story id: no card', async () => {
  assert.equal(await storyCardFor('a', { get: reader({}), today: '2026-11-22' }), null);
  assert.equal(await storyCardFor('../x', { get: () => { throw new Error('must not read'); }, today: '2026-11-22' }), null);
});

test('an alias story view is followed to the story it was merged into', async () => {
  const get = reader({ 'record/views/stories/old.json': { aliasOf: 'a' }, 'record/views/stories/a.json': story('a', ['POL']) });
  assert.equal((await storyCardFor('old', { get, today: '2026-11-22' })).headline, 'Story a');
});

test('the reader GETs under <site>/data/; 404 is null, other failures throw', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push([url, opts.method]); return url.endsWith('missing.json') ? { status: 404, ok: false } : url.endsWith('bad.json') ? { status: 500, ok: false } : { status: 200, ok: true, json: async () => ({ ok: 1 }) }; };
  const get = siteDataReader('https://site.example/', { fetchFn });
  assert.deepEqual(await get('record/views/x.json'), { ok: 1 });
  assert.equal(await get('missing.json'), null);
  await assert.rejects(get('bad.json'), /500/);
  assert.deepEqual(calls[0], ['https://site.example/data/record/views/x.json', 'GET']);
});
