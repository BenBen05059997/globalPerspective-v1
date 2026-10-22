import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accept, classOf, isGenericName, countActors, settledIds, reconcile, makeSearch} from '../reconcile-actors.mjs';

const hit = (id, label, description, match = {type: 'label', text: label}) => ({id, label, description, match});

test('accept: an exact label with an allowed class is a proposal', () => {
  const r = accept('name:donald trump', [hit('Q22686', 'Donald Trump', '47th president of the United States')]);
  assert.deepEqual(r.proposal, {canonical: 'name:donald trump', wikidataId: 'Q22686', label: 'Donald Trump', description: '47th president of the United States', confidence: 'exact'});
});

test('accept: an alias match equal to the name is confidence alias; an accent difference still counts as exact', () => {
  assert.equal(accept('name:houthi movement', [hit('Q3042087', 'Houthis', 'Zaydi Shia armed group in Yemen', {type: 'alias', text: 'Houthi movement'})]).proposal.confidence, 'alias');
  assert.equal(accept('name:flavio bolsonaro', [hit('Q10283057', 'Flávio Bolsonaro', 'Brazilian politician')]).proposal.confidence, 'exact');
});

test('accept: only the top hit counts; a label miss, a wrong class or no hit is unresolved', () => {
  assert.ok(accept('name:ice', [hit('Q1', 'Intercity Express', 'high-speed train', {type: 'alias', text: 'ICE'})]).unresolved);
  assert.match(accept('name:ice', [hit('Q1', 'ICE', 'high-speed train of Deutsche Bahn')]).unresolved, /not an allowed class/);
  assert.match(accept('name:protesters', [hit('Q2', 'protesters', 'Wikinews article')]).unresolved, /allowed class/);
  assert.ok(accept('name:x', [hit('Q3', 'Y', 'politician'), hit('Q4', 'x', 'politician')]).unresolved, 'a good second hit does not rescue a bad first');
  assert.equal(accept('name:nobody', []).unresolved, 'no hit');
  assert.ok(accept('name:x', [{id: 'not-a-q', label: 'x', description: 'politician', match: {type: 'label'}}]).unresolved);
});

test('classOf: the allowed classes, with a reject list that wins', () => {
  assert.equal(classOf('American politician'), 'human');
  assert.equal(classOf('Zaydi Shia armed group'), 'organization');
  assert.equal(classOf('sovereign state in Western Asia'), 'country/region');
  assert.equal(classOf('Wikimedia disambiguation page about a political party'), null);
  assert.equal(classOf(''), null);
  assert.equal(classOf('inner city of Brussels within the inner ring road, Belgium'), null);
});

test('isGenericName: crowds and "the government" are generic, named parties are not', () => {
  for (const n of ['protesters', 'student protesters', 'french students', 'the government', 'somali pirates', 'Civilians']) assert.equal(isGenericName(n), true, n);
  for (const n of ['donald trump', 'houthis', 'israeli government', 'hamas']) assert.equal(isGenericName(n), false, n);
});

test('countActors / settledIds', () => {
  const ranked = countActors({stories: [{actorIds: ['name:a', 'name:b', 'name:a']}, {actorIds: ['name:a']}, {actorIds: ['name:b']}, {actorIds: ['name:c']}]});
  assert.deepEqual(ranked, [['name:a', 2], ['name:b', 2], ['name:c', 1]]);
  assert.deepEqual([...settledIds({aliases: [{canonical: 'name:a', variants: ['name:b']}]})].sort(), ['name:a', 'name:b']);
});

test('reconcile: generic and settled ids make no search; a failing search is unresolved; nothing touches the network', async () => {
  const calls = [];
  const search = async (name) => { calls.push(name); if (name === 'boom') throw new Error('HTTP 429'); return name === 'vladimir putin' ? [hit('Q7747', 'Vladimir Putin', 'President of Russia')] : []; };
  const out = await reconcile([['name:vladimir putin', 9], ['name:protesters', 8], ['name:settled', 7], ['name:boom', 6], ['name:unknown', 5], ['wd:Q1', 4]], {search, settled: new Set(['name:settled'])});
  assert.deepEqual(calls, ['vladimir putin', 'boom', 'unknown']);
  assert.deepEqual([out.proposals.length, out.unresolved.length, out.generic.length, out.skipped.length], [1, 2, 1, 2]);
  assert.match(out.unresolved[0].reason, /HTTP 429/);
});

test('makeSearch: rate-limited, polite User-Agent, injected fetch', async () => {
  const slept = [], seen = [];
  const search = makeSearch({fetchImpl: async (url, o) => { seen.push([url, o.headers['User-Agent']]); return {ok: true, json: async () => ({search: [{id: 'Q1', label: 'A', description: 'd', match: {type: 'label', text: 'A'}}]})}; }, sleep: async (ms) => { slept.push(ms); }});
  await search('a b'); await search('c');
  assert.equal(seen.length, 2);
  assert.match(seen[0][0], /wbsearchentities.*search=a%20b/);
  assert.match(seen[0][1], /GlobalPerspectives/);
  assert.equal(slept.length, 1);
  assert.ok(slept[0] > 0 && slept[0] <= 1100);
});
