import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accept, classOf, isGenericName, countActors, settledIds, reconcile, makeSearch, makeClient, matchTier, canonKey, rewrites, holdersInWindow, resolveActor, actorWindows, groupOf, buildAliasFile, reviewMarkdown, parseOffice, officeQuery} from '../reconcile-actors.mjs';

const hit = (id, label, description, match = {type: 'label', text: label}) => ({id, label, description, match});

test('accept: an exact label with an allowed class is a proposal', () => {
  const r = accept('name:donald trump', [hit('Q22686', 'Donald Trump', '47th president of the United States')]);
  assert.deepEqual(r.proposal, {canonical: 'name:donald trump', wikidataId: 'Q22686', label: 'Donald Trump', description: '47th president of the United States', confidence: 'exact', via: 'exact'});
});

test('accept: an alias match equal to the name is confidence alias; an accent difference still counts as exact', () => {
  assert.equal(accept('name:houthi movement', [hit('Q3042087', 'Houthis', 'Zaydi Shia armed group in Yemen', {type: 'alias', text: 'Houthi movement'})]).proposal.confidence, 'alias');
  assert.equal(accept('name:flavio bolsonaro', [hit('Q10283057', 'Flávio Bolsonaro', 'Brazilian politician')]).proposal.confidence, 'exact');
});

test('accept: only the top hit counts; a label miss, a wrong class or no hit is unresolved', () => {
  assert.ok(accept('name:ice', [hit('Q1', 'Intercity Express', 'high-speed train', {type: 'alias', text: 'ICE'})]).unresolved);
  assert.match(accept('name:ice', [hit('Q1', 'ICE', 'high-speed train of Deutsche Bahn')]).unresolved, /not an allowed class/);
  assert.match(accept('name:protesters', [hit('Q2', 'protesters', 'Wikinews article')]).unresolved, /allowed class/);
  assert.equal(accept('name:x', [hit('Q3', 'Y', 'politician'), hit('Q4', 'x', 'politician')]).proposal.confidence, 'near', 'a second hit can only ever be near, never exact');
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

test('matchTier / accept: spelling variants and word-order variants are near; unrelated names are not', () => {
  assert.equal(accept('name:volodymyr zelensky', [hit('Q3', 'Volodymyr Zelenskyy', 'President of Ukraine')]).proposal.confidence, 'near');
  assert.equal(accept('name:v. zelenskyy', [hit('Q3', 'Volodymyr Zelenskyy', 'president of Ukraine')]).proposal.confidence, 'near', 'shared surname, first name an initial');
  assert.equal(accept('name:benjamin netanyahu', [hit('Q4', 'Benjamin Netanyahu', 'Israeli politician')]).proposal.confidence, 'exact');
  assert.equal(accept('name:south korean government', [hit('Q5', 'Government of South Korea', 'executive branch of South Korea')]).proposal.confidence, 'near');
  assert.equal(accept('name:ukrainian military', [hit('Q6', 'Armed Forces of Ukraine', 'military of Ukraine')]).proposal.via, 'near');
  assert.equal(matchTier('ice', hit('Q1', 'ICE', 'x')), 'exact');
  assert.equal(matchTier('abc', hit('Q1', 'abd', 'x'), {top: false}), null, 'too short for edit distance');
  assert.ok(accept('name:john smith', [hit('Q7', 'Peter Jones', 'politician')]).unresolved);
  assert.equal(canonKey('president of pakistan'), canonKey('Pakistan president'));
});

test('rewrites: demonym + org or role becomes the entity title', () => {
  assert.deepEqual(rewrites('south korean government'), ['Government of south korea']);
  assert.deepEqual(rewrites('ukrainian military'), ['Armed Forces of ukraine']);
  assert.deepEqual(rewrites('russian foreign ministry'), ['Ministry of Foreign Affairs of russia']);
  assert.deepEqual(rewrites('donald trump'), []);
});

test('classOf: the organisation classes', () => {
  for (const d of ['executive branch of South Korea', 'central bank of Japan', 'supreme court of India', 'unicameral legislature of Fiji', 'national police force', 'political party in Spain', 'American multinational company', 'international non-governmental organization', 'intergovernmental organization']) assert.ok(classOf(d), d);
  assert.equal(classOf('elected office in New York'), 'office');
});

const holders = [
  {id: 'Q10', label: 'A', start: '2008-01-01T00:00:00Z', end: '2013-06-01T00:00:00Z'},
  {id: 'Q11', label: 'B', start: '2013-06-01T00:00:00Z', end: '2018-08-18T00:00:00Z'},
  {id: 'Q12', label: 'C', start: '2018-08-18T00:00:00Z', end: null},
  {id: 'Q13', label: 'U', start: null, end: null},
];
test('holdersInWindow: overlap with the window, open end, undated only as a fallback', () => {
  assert.deepEqual(holdersInWindow(holders, '2019-01-01', '2019-02-01').map((h) => h.id), ['Q12']);
  assert.deepEqual(holdersInWindow(holders, '2018-07-01', '2018-09-01').map((h) => h.id), ['Q11', 'Q12']);
  assert.deepEqual(holdersInWindow([holders[3]], '2019-01-01', '2019-02-01').map((h) => h.id), ['Q13']);
  assert.deepEqual(holdersInWindow(holders, '1990-01-01', '1990-02-01').map((h) => h.id), ['Q13']);
});

const officeHit = hit('Q99', 'President of Pakistan', 'head of state of Pakistan');
test('resolveActor: an office resolves to its holder with the title; one holder is a plain proposal', async () => {
  const search = async () => [officeHit];
  const probe = async () => ({isHuman: false, isPosition: true, holders});
  const out = await resolveActor('name:president of pakistan', {search, probe, window: {from: '2019-01-01', to: '2019-03-01'}});
  assert.equal(out.proposals.length, 1);
  assert.deepEqual([out.proposals[0].wikidataId, out.proposals[0].via, out.proposals[0].title, out.proposals[0].office, out.proposals[0].ambiguous_period], ['Q12', 'office→holder', 'President of Pakistan', 'Q99', undefined]);
});

test('resolveActor: a holder change inside the window gives one entry per holder, flagged ambiguous_period', async () => {
  const out = await resolveActor('name:president of pakistan', {search: async () => [officeHit], probe: async () => ({isHuman: false, isPosition: true, holders}), window: {from: '2018-07-01', to: '2018-09-01'}});
  assert.deepEqual(out.proposals.map((p) => [p.wikidataId, p.ambiguous_period, p.period.from, p.period.to]), [['Q11', true, '2013-06-01', '2018-08-18'], ['Q12', true, '2018-08-18', null]]);
});

test('resolveActor: a person with an office-like description stays the person; an office with no holder is a position item; spelling rewrite searches again', async () => {
  const person = await resolveActor('name:vladimir putin', {search: async () => [hit('Q7747', 'Vladimir Putin', 'President of Russia')], probe: async () => ({isHuman: true, isPosition: false, holders: []})});
  assert.deepEqual([person.proposals[0].wikidataId, person.proposals[0].via], ['Q7747', 'exact']);
  const pos = await resolveActor('name:president of pakistan', {search: async () => [officeHit], probe: async () => ({isHuman: false, isPosition: true, holders: []}), window: {from: '2030-01-01', to: '2030-01-02'}});
  assert.equal(pos.proposals[0].position_item, true);
  assert.equal(groupOf(pos.proposals[0]), 'check');
  const qs = [];
  const rw = await resolveActor('name:south korean government', {search: async (q) => { qs.push(q); return q.startsWith('Government of') ? [hit('Q8', 'Government of South Korea', 'executive branch of South Korea')] : []; }, probe: null});
  assert.equal(qs.length, 2);
  assert.equal(rw.proposals[0].wikidataId, 'Q8');
});

test('actorWindows / buildAliasFile / reviewMarkdown: variants pool under one id; groups and ambiguous are kept apart', async () => {
  const w = actorWindows({stories: [{born: '2026-10-01', lastFactAt: '2026-10-03T10:00:00Z', actorIds: ['name:a']}, {born: '2026-10-05', lastFactAt: '2026-10-09T00:00:00Z', actorIds: ['name:a', 'name:b']}]});
  assert.deepEqual(w.get('name:a'), {from: '2026-10-01', to: '2026-10-09'});
  const mk = (canonical, qid, count, extra = {}) => ({canonical, wikidataId: qid, label: 'L', description: 'd', confidence: 'exact', via: 'exact', count, ...extra});
  const result = {proposals: [mk('name:zelenskyy', 'Q1', 9), mk('name:zelensky', 'Q1', 3, {confidence: 'near', via: 'near'}), mk('name:president of x', 'Q2', 2, {via: 'office→holder', title: 'President of X'}), mk('name:amb', 'Q3', 1, {ambiguous_period: true, period: {from: '2018-01-01', to: null}})],
    unresolved: [{canonical: 'name:zzz', count: 1, reason: 'no hit'}], generic: [{canonical: 'name:protesters', count: 4}]};
  const f = buildAliasFile(result);
  assert.deepEqual(f.aliases.slice(0, 2), [{canonical: 'name:zelenskyy', variants: ['name:zelensky'], wikidataId: 'Q1'}, {canonical: 'name:president of x', variants: [], wikidataId: 'Q2', title: 'President of X'}]);
  assert.deepEqual(f.aliases.slice(2), [{canonical: 'name:protesters', variants: [], wikidataId: null, generic: true}, {canonical: 'name:zzz', variants: [], wikidataId: null}]);
  assert.equal(f.ambiguous.length, 1);
  const md = reviewMarkdown(result);
  assert.match(md, /## ready \(1\)[\s\S]*## check \(2\)[\s\S]*## unresolved \(1\)[\s\S]*## generic \(1\)/);
  assert.match(md, /name:president of x ← - \| Q2 L \(d\) \[title: President of X\] \| via: office→holder \| exact/);
});

test('makeClient.probe: one SPARQL request sharing the rate gap; parseOffice reads holders; qid is validated', async () => {
  const slept = [], urls = [];
  const body = {results: {bindings: [{kind: {value: 'position'}}, {kind: {value: 'holder'}, h: {value: 'http://www.wikidata.org/entity/Q5'}, hLabel: {value: 'P'}, s: {value: '2020-01-01T00:00:00Z'}}]}};
  const c = makeClient({fetchImpl: async (u) => { urls.push(u); return {ok: true, json: async () => (u.includes('sparql') ? body : {search: []})}; }, sleep: async (ms) => { slept.push(ms); }});
  await c.search('x');
  const info = await c.probe('Q99');
  assert.equal(slept.length, 1);
  assert.match(urls[1], /query\.wikidata\.org\/sparql/);
  assert.deepEqual(info, {isHuman: false, isPosition: true, holders: [{id: 'Q5', label: 'P', description: '', start: '2020-01-01T00:00:00Z', end: null}]});
  assert.deepEqual(parseOffice({}), {isHuman: false, isPosition: false, holders: []});
  assert.throws(() => officeQuery('Q1; DROP'));
});
