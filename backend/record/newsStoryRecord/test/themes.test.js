'use strict';
// Themes and the region summary (decision 0058 rule 4): themes.js, and where views.js puts themeId.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const {groupThemes, groupStories, evidenceOrder, themesIndex, regionsIndex, pairLinks, cleanReason} = require('../src/themes');
const {storyStamp} = require('../src/storyStamp');
const V = require('../src/views');
const X = require('./views-fixture');

const stamps = new Map();
const story = (id, o = {}) => stamps.set(id, {...storyStamp({threadId: id, title: `Title ${id}`, iso3: o.iso3 || [], born: o.born ?? '2026-10-10', lastFactAt: o.lastFactAt ?? '2026-10-20T00:00:00.000Z',
  entries: o.lastEntryAt === null ? [] : [{at: o.lastEntryAt ?? o.lastFactAt ?? '2026-10-20T00:00:00.000Z', category: o.category}], // lastEntryAt: null = no news entry
  analysis: o.score === undefined ? null : {riskScore: o.score, generatedAt: '2026-10-19T00:00:00.000Z'}})}).get(id);
const stampOf = (id) => stamps.get(id) || story(id);
const link = (from, to, confidence = 'medium', o = {}) => ({from, to, confidence, mechanism: 'm', cited: [], country: 'France', generatedAt: '2026-10-20T00:00:00.000Z', lagDays: 1, iso3: ['FRA'], ...o});
const themesOf = (links, aliases = new Map()) => groupThemes({links, stampOf, aliases});

test('evidence-code groups are removed from the published reason, with the space before them; nothing else changes', () => {
  assert.equal(cleanReason('Escalating strikes (E17, E20) preceded the truce (E4).'), 'Escalating strikes preceded the truce.');
  assert.equal(cleanReason('One (E1) two (E2 and E3) three (E4; E5).'), 'One two three.');
  assert.equal(cleanReason('A real aside (see Geneva) stays.'), 'A real aside (see Geneva) stays.');
  assert.equal(cleanReason(null), null);
  assert.equal(cleanReason('(E1)'), null);
});

test('one link per story pair: the strongest across webs and directions, ties by newest; the cited entries stay as data', () => {
  const cited = [{topicId: 't', date: '2026-10-20', title: 'T'}];
  const p = pairLinks([
    link('a', 'b', 'weak', {country: 'Iran', generatedAt: '2026-10-25T00:00:00.000Z'}),
    link('b', 'a', 'strong', {country: 'France', mechanism: 'Strong one (E3)', cited}),
    link('a', 'b', 'strong', {country: 'Israel', generatedAt: '2026-10-19T00:00:00.000Z', mechanism: 'older strong'}),
    link('a', 'c', 'medium', {generatedAt: '2026-10-18T00:00:00.000Z', mechanism: 'older'}),
    link('c', 'a', 'medium', {generatedAt: '2026-10-22T00:00:00.000Z', mechanism: 'newer'}),
  ], new Map());
  assert.deepEqual(p.map(({from, to, strength, reason, cited: c}) => [from, to, strength, reason, c.length]), [['b', 'a', 'strong', 'Strong one', 1], ['c', 'a', 'medium', 'newer', 0]]);
});

test('a merged id is resolved to its survivor before grouping; a link whose ends become one story is dropped', () => {
  const aliases = new Map([['b-old', 'b'], ['c-old', 'c']]);
  const t = themesOf([link('a', 'b-old'), link('b', 'c-old'), link('b-old', 'b'), link('c', 'b', 'weak')], aliases);
  assert.deepEqual(t.themes.map((x) => x.ids), [['a', 'b', 'c']]);
  assert.deepEqual(t.pairs.map((p) => [p.from, p.to]).sort(), [['a', 'b'], ['b', 'c']]);
  assert.equal(t.pairs.find((p) => p.to === 'c' || p.from === 'c').strength, 'medium'); // b-c judged twice: medium (via c-old) beats weak
  assert.deepEqual(themesOf([link('a', 'a-old')], new Map([['a-old', 'a']])).pairs, []);
});

test('only groups of 3 stories or more are themes: pairs and lone stories are not; a weak link can attach one story or a pair; no hub splitting', () => {
  const t = themesOf([link('p1', 'p2', 'strong'), link('a', 'b', 'weak'), link('b', 'c', 'weak'), link('c', 'd', 'strong'), link('c', 'e', 'medium'), link('c', 'f', 'medium'), link('f', 'g', 'weak')]);
  assert.deepEqual(t.themes.map((x) => x.ids), [['a', 'b', 'c', 'd', 'e', 'f', 'g']]); // pair a-b joins the group of c (the smaller side has 2); g joins as one story
  assert.equal(t.pairs.length, 7); // the pair p1-p2 is a judged link but in no theme
});

test('a weak link never joins two groups of 3 or more; the refused link is in no theme but stays a pair', () => {
  const links = [link('a1', 'a2'), link('a2', 'a3'), link('b1', 'b2'), link('b2', 'b3'), link('a3', 'b1', 'weak')];
  const t = themesOf(links);
  assert.deepEqual(t.themes.map((x) => x.ids).sort(), [['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']]);
  assert.deepEqual(t.themes.map((x) => x.pairs.length), [2, 2]);
  assert.equal(t.pairs.length, 5); // still counts for the regions index
  assert.equal(themesOf([...links, link('a3', 'b1', 'strong')]).themes.length, 1); // the same pair, strong, joins
  // a weak link between two stories already in one theme stays a link of it
  const inside = themesOf([link('a1', 'a2'), link('a2', 'a3'), link('a1', 'a3', 'weak')]).themes[0];
  assert.deepEqual(inside.linkCounts, {strong: 0, medium: 2, weak: 1});
});

test('weak pairs go in evidenceOrder: most cited entries, newest cited date, from, to', () => {
  const c = (date) => ({topicId: 't', date, title: 'T'});
  const pair = (from, to, cited) => ({from, to, cited});
  const sorted = [pair('z', 'z', [c('2026-10-01')]), pair('b', 'b', []), pair('a', 'b', [c('2026-10-01'), c('2026-10-02')]), pair('a', 'a', [c('2026-10-05')]), pair('a', 'c', [c('2026-10-05')])].sort(evidenceOrder);
  assert.deepEqual(sorted.map((p) => p.from + p.to), ['ab', 'aa', 'ac', 'zz', 'bb']);
  // the order decides: lone s is weakly linked to two groups of 3; the first weak pair in the order takes it, the second is then refused
  const firm = [['a1', 'a2'], ['a2', 'a3'], ['b1', 'b2'], ['b2', 'b3']].map(([from, to]) => ({from, to, strength: 'strong', cited: []}));
  const groupOfS = (citedOnB) => groupStories([...firm, {from: 'a1', to: 's', strength: 'weak', cited: []}, {from: 's', to: 'b1', strength: 'weak', cited: citedOnB}]).find((x) => x.includes('s'));
  assert.deepEqual(groupOfS([]), ['a1', 'a2', 'a3', 's']); // equal evidence: from a1 < s
  assert.deepEqual(groupOfS([c('2026-10-01')]), ['b1', 'b2', 'b3', 's']); // s-b1 is cited, so it goes first
});

test('stamps: new facts in the last 7 days, link counts by strength, the strongest link; themes ordered by them', () => {
  const c = (date) => ({topicId: 't', date, title: 'T'});
  const now = '2026-10-30T00:00:00.000Z';
  for (const id of ['n1', 'n2', 'n3', 'o1', 'o2', 'o3', 'q1', 'q2', 'q3']) story(id, {lastFactAt: '2026-10-01T00:00:00.000Z'});
  story('n1', {lastEntryAt: '2026-10-23T00:00:00.000Z'}); story('n2', {lastEntryAt: '2026-10-29T00:00:00.000Z'}); // the first is exactly 7 days before now: counts
  story('o1', {lastEntryAt: '2026-10-22T23:59:59.000Z'}); // one second too old
  story('o2', {lastFactAt: '2026-10-29T00:00:00.000Z', lastEntryAt: '2026-10-01T00:00:00.000Z'}); // a new forecast or verdict (lastFactAt) is not a new fact
  story('o3', {lastFactAt: '2026-10-29T00:00:00.000Z', lastEntryAt: null}); // no news entry at all
  story('q1', {lastEntryAt: '2026-10-29T00:00:00.000Z'});
  const g = groupThemes({links: [
    link('n1', 'n2', 'medium'), link('n2', 'n3', 'weak', {cited: [c('2026-10-01')]}),
    link('o1', 'o2', 'strong'), link('o2', 'o3', 'strong'),
    link('q1', 'q2', 'strong', {cited: [c('2026-10-02')]}), link('q2', 'q3', 'strong', {cited: [c('2026-10-09'), c('2026-10-03')]}),
  ], stampOf, aliases: new Map(), now});
  assert.deepEqual(g.themes.map((t) => [t.themeId, t.newFacts]), [['theme-n1', 2], ['theme-q1', 1], ['theme-o1', 0]]); // by new facts; no theme moves with no `now`
  assert.deepEqual(g.themes[0].linkCounts, {strong: 0, medium: 1, weak: 1});
  assert.deepEqual(g.themes[0].strongest, {from: 'n1', to: 'n2', strength: 'medium'});
  assert.deepEqual(g.themes[1].strongest, {from: 'q2', to: 'q3', strength: 'strong'}); // more cited entries
  assert.deepEqual(g.themes[2].strongest, {from: 'o1', to: 'o2', strength: 'strong'}); // all equal: from, then to
  assert.deepEqual(groupThemes({links: [link('o1', 'o2'), link('o2', 'o3')], stampOf}).themes.map((t) => t.newFacts), [0]);
  // equal new facts: more strong links, then more stories, then themeId
  const tie = groupThemes({links: [link('s1', 's2', 'strong'), link('s2', 's3', 'medium'), link('t1', 't2', 'strong'), link('t2', 't3', 'strong'), link('u1', 'u2', 'medium'), link('u2', 'u3', 'medium'), link('u3', 'u4', 'medium'), link('v1', 'v2', 'medium'), link('v2', 'v3', 'medium')], stampOf, now});
  assert.deepEqual(tie.themes.map((t) => t.themeId), ['theme-t1', 'theme-s1', 'theme-u1', 'theme-v1']);
});

test('themes are listed by the stamps; a tie goes to the bigger theme, then themeId', () => {
  const t = themesOf([link('m1', 'm2'), link('m2', 'm3'), link('k1', 'k2'), link('k2', 'k3'), link('x1', 'x2'), link('x2', 'x3'), link('x3', 'x4')]);
  assert.deepEqual(t.themes.map((x) => x.ids.length), [4, 3, 3]);
  assert.deepEqual(t.themes.map((x) => x.themeId), ['theme-x1', 'theme-k1', 'theme-m1']);
});

test('anchor and id: the earliest born, ties by the smaller threadId, a story with no born last', () => {
  story('z-old', {born: '2026-10-01'}); story('m-mid', {born: '2026-10-05'}); story('a-late', {born: '2026-10-09'});
  assert.equal(themesOf([link('a-late', 'm-mid'), link('m-mid', 'z-old')]).themes[0].themeId, 'theme-z-old');
  story('t-b', {born: '2026-10-02'}); story('t-a', {born: '2026-10-02'}); story('t-n', {born: null});
  const t = themesOf([link('t-n', 't-b'), link('t-b', 't-a')]).themes[0];
  assert.deepEqual([t.anchor, t.themeId], ['t-a', 'theme-t-a']);
});

test('lead: most judged links inside the theme; ties by highest tier, then newest lastFactAt, then smaller threadId', () => {
  // hub h has 3 links, the others fewer: the hub leads whatever the tiers
  story('h', {score: 10}); story('l1', {score: 90}); story('l2', {score: 90}); story('l3', {score: 90});
  assert.equal(themesOf([link('h', 'l1'), link('h', 'l2'), link('h', 'l3')]).themes[0].lead, 'h');
  // a chain u1-u2-u3-u4: u2 and u3 have two links each; tier decides
  story('u1', {score: 95}); story('u2', {score: 40}); story('u3', {score: 80}); story('u4', {score: 95});
  assert.equal(themesOf([link('u1', 'u2'), link('u2', 'u3'), link('u3', 'u4')]).themes[0].lead, 'u3');
  // a story with no score ranks below low
  story('v1'); story('v2', {score: 5}); story('v3');
  assert.equal(themesOf([link('v1', 'v2'), link('v2', 'v3'), link('v1', 'v3')]).themes[0].lead, 'v2');
  // same degree and tier: the newest lastFactAt
  story('w1', {score: 40, lastFactAt: '2026-10-21T00:00:00.000Z'}); story('w2', {score: 40, lastFactAt: '2026-10-22T00:00:00.000Z'}); story('w3', {score: 40, lastFactAt: '2026-10-20T00:00:00.000Z'});
  assert.equal(themesOf([link('w1', 'w2'), link('w2', 'w3'), link('w3', 'w1')]).themes[0].lead, 'w2');
  // all equal: the smaller threadId
  story('y2', {score: 40}); story('y1', {score: 40}); story('y3', {score: 40});
  assert.equal(themesOf([link('y2', 'y1'), link('y1', 'y3'), link('y3', 'y2')]).themes[0].lead, 'y1');
});

test('themesIndex: countries by story count, highest tier (null when none scored), live forecast count, cleaned links, no line style', () => {
  story('c1', {iso3: ['USA', 'IRN'], score: 40, born: '2026-10-03'}); story('c2', {iso3: ['IRN'], score: 80, born: '2026-10-01'}); story('c3', {iso3: ['ISR', 'IRN'], born: '2026-10-02'});
  const g = themesOf([link('c1', 'c2', 'strong', {mechanism: 'Why (E1, E2).', cited: [{topicId: 't', date: '2026-10-01', title: 'T'}]}), link('c2', 'c3', 'weak')]);
  const idx = themesIndex(g, stampOf, (id) => (id === 'c2' ? 2 : null), {factsThrough: '2026-10-22'});
  assert.equal(idx.schemaVersion, 1);
  const t = idx.themes[0];
  assert.deepEqual([t.themeId, t.lead, t.tier], ['theme-c2', 'c2', 'high']);
  assert.deepEqual([t.newFacts, t.linkCounts, t.strongestLink], [0, {strong: 1, medium: 0, weak: 1}, {from: 'c1', to: 'c2', strength: 'strong'}]);
  assert.deepEqual(t.countries, [{iso3: 'IRN', stories: 3}, {iso3: 'ISR', stories: 1}, {iso3: 'USA', stories: 1}]);
  assert.deepEqual(t.regions, ['Middle East', 'North America']);
  assert.deepEqual(t.stories.map((s) => [s.threadId, s.liveBranchCount, s.themeId]), [['c2', 2, null], ['c3', null, null], ['c1', null, null]]); // stamps are as given; the builder sets themeId
  assert.deepEqual(t.links.map((l) => [l.strength, l.reason]), [['strong', 'Why.'], ['weak', 'm']]);
  assert.equal(JSON.stringify(idx).includes('dash'), false);
  story('n1'); story('n2'); story('n3');
  assert.equal(themesIndex(themesOf([link('n1', 'n2'), link('n2', 'n3')]), stampOf, () => null, {}).themes[0].tier, null);
});

test('themesIndex title countries: those of two or more stories in `countries` order, at most four; the rest are counted in moreCountries; no shared country falls back to the first four', () => {
  const titleOf = (iso3s) => {
    iso3s.forEach((c, i) => story(`k${i + 1}`, {iso3: c}));
    const ids = iso3s.map((_, i) => `k${i + 1}`);
    const t = themesIndex(themesOf(ids.slice(1).map((id, i) => link(ids[i], id))), stampOf, () => null, {}).themes[0];
    return [t.titleCountries, t.moreCountries, t.countries.length];
  };
  // IRN in 3 stories, USA in 2, FRA/DEU/ISR in one: the title keeps the two shared ones, the other three are "more"
  assert.deepEqual(titleOf([['IRN', 'USA'], ['IRN', 'USA', 'FRA'], ['IRN', 'DEU', 'ISR']]), [['IRN', 'USA'], 3, 5]);
  // more than four shared countries: the first four of the countries order (stories desc, then code)
  assert.deepEqual(titleOf([['FRA', 'DEU', 'ITA', 'ESP', 'POL'], ['FRA', 'DEU', 'ITA', 'ESP', 'POL'], ['POL', 'FRA']]).slice(0, 2), [['FRA', 'POL', 'DEU', 'ESP'], 1]);
  // no country in two stories: today's first four of `countries`
  assert.deepEqual(titleOf([['FRA'], ['DEU'], ['ITA', 'ESP', 'POL']]), [['DEU', 'ESP', 'FRA', 'ITA'], 1, 5]);
  // no countries at all
  assert.deepEqual(titleOf([[], [], []]), [[], 0, 0]);
});

test('regionsIndex: always the 10 regions; no stories / no links judged / links; a multi-region story counts in each', () => {
  story('r1', {iso3: ['IRN', 'USA'], score: 80}); story('r2', {iso3: ['IRN'], score: 20}); story('r3', {iso3: ['ISR']}); story('r4', {iso3: ['FRA'], score: 55}); story('r5', {iso3: []});
  const g = themesOf([link('r1', 'r2'), link('r2', 'r3'), link('r4', 'zz')]); // r4 is in a pair only
  const idx = regionsIndex(g, ['r1', 'r2', 'r3', 'r4', 'r5'], stampOf, {});
  assert.equal(idx.regions.length, 10);
  const by = Object.fromEntries(idx.regions.map((r) => [r.region, r]));
  assert.deepEqual(by['Middle East'], {region: 'Middle East', state: 'links', stories: 3, scored: 2, highTier: 1, linked: 3, themeIds: ['theme-r1']});
  assert.deepEqual(by['North America'], {region: 'North America', state: 'links', stories: 1, scored: 1, highTier: 1, linked: 1, themeIds: ['theme-r1']}); // r1 counts here and in the Middle East
  assert.deepEqual(by.Europe, {region: 'Europe', state: 'links', stories: 1, scored: 1, highTier: 0, linked: 1, themeIds: []}); // a pair is a link but no theme
  assert.deepEqual(by.Africa, {region: 'Africa', state: 'no stories', stories: 0, scored: 0, highTier: 0, linked: 0, themeIds: []});
  const none = regionsIndex({themes: [], pairs: []}, ['r4'], stampOf, {});
  assert.equal(none.regions.find((r) => r.region === 'Europe').state, 'no links judged');
  assert.deepEqual(regionsIndex({themes: [], pairs: []}, [], stampOf, {}).regions.map((r) => r.state), Array(10).fill('no stories'));
});

// ---- the builder: judged links in notes -> themes.json, regions.json and themeId on every carrier of a stamp
const note = (subtype, kind, id, part, at, payload) => ({subtype, subject: {kind, id}, part, at, model: 'deepseek-v4-pro', noteId: `${subtype}${id}${part}${at}`, iso3: [], payload});
const T1 = '2026-10-21T05:00:00.000Z';
const notes = [
  note('web', 'country', 'FRA', '', T1, {country: 'France', nodes: [{threadId: 'thread-a', summary: 'A'}, {threadId: 'thread-b'}, {threadId: 'thread-old'}], backbone: []}),
  note('link', 'pair', 'thread-a__thread-b', 'FRA', T1, {from: 'thread-a', to: 'thread-b', country: 'France', confidence: 'strong', lagDays: 2, mechanism: 'A fed B (E1, E2).', cited: [{topicId: 't', date: '2026-10-20', title: 'T'}]}),
  note('link', 'pair', 'thread-b__thread-old', 'FRA', T1, {from: 'thread-b', to: 'thread-old', country: 'France', confidence: 'weak', lagDays: 1, mechanism: 'B and old', cited: []}),
  note('link', 'pair', 'thread-b__thread-c', 'FRA', T1, {from: 'thread-b', to: 'thread-c', country: 'France', confidence: 'medium', lagDays: 1, mechanism: 'c is merged into b', cited: []}), // dropped: both ends are one story
];
const built = V.buildViews(X.golden(), {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1, notes});
const parse = (x) => JSON.parse(JSON.stringify(x));

test('the builder: one theme of a, b and old; themeId on the stamp of every carrier, null elsewhere', () => {
  const t = built.indexes['themes.json'].themes;
  assert.equal(t.length, 1);
  assert.deepEqual([t[0].themeId, t[0].lead, t[0].stories.map((s) => s.threadId)], ['theme-thread-old', 'thread-b', ['thread-old', 'thread-b', 'thread-a']]); // by born: thread-b holds the merged thread-c, born 10-17
  assert.deepEqual(t[0].links.map((l) => [l.from, l.to, l.strength, l.reason]), [['thread-a', 'thread-b', 'strong', 'A fed B.'], ['thread-b', 'thread-old', 'weak', 'B and old']]);
  assert.deepEqual(t[0].stories.map((s) => s.themeId), Array(3).fill('theme-thread-old'));
  for (const id of ['thread-a', 'thread-b', 'thread-old']) {
    assert.equal(built.stories.get(id).themeId, 'theme-thread-old', id);
    assert.equal(built.all.stories.find((r) => r.threadId === id).themeId, 'theme-thread-old', id);
    assert.equal(built.indexes['web.json'].threads[id].themeId, 'theme-thread-old', id);
  }
  assert.equal(built.all.stories.find((r) => r.threadId === 'thread-c').themeId, null); // the alias row
  assert.equal(built.all.stories.find((r) => r.aliasOf === null && !['thread-a', 'thread-b', 'thread-old'].includes(r.threadId)), undefined);
  const plain = V.buildViews(X.golden(), {today: '2026-10-22', builtAt: '2026-10-22T05:45:00.000Z', runId: 'r', factsManifestDays: 1, notes: []});
  assert.deepEqual(plain.indexes['themes.json'].themes, []);
  assert.ok(plain.all.stories.every((r) => r.themeId === null) && [...plain.stories.values()].filter((s) => !s.aliasOf).every((s) => s.themeId === null));
});

test('the builder: regions.json holds the 10 regions over the web threads, surviving stories only', () => {
  const r = built.indexes['regions.json'].regions;
  assert.equal(r.length, 10);
  assert.equal(r.reduce((n, x) => n + x.stories, 0) >= 3, true);
  const eu = r.find((x) => x.region === 'Europe');
  assert.deepEqual([eu.state, eu.themeIds], ['links', ['theme-thread-old']]);
  assert.equal(r.find((x) => x.region === 'Oceania').state, 'no stories');
});

const load = (...p) => JSON.parse(readFileSync(resolve(__dirname, '../schema/views', ...p), 'utf8'));
test('themes.json and regions.json satisfy their schemas, and the examples are the built files', () => {
  const ajv = new Ajv({allErrors: true, strict: false});
  ajv.addSchema(load('story-stamp.schema.json'));
  for (const [name, schema] of [['themes.json', 'themes'], ['regions.json', 'regions']]) {
    const validate = ajv.compile(load(`${schema}.schema.json`));
    const actual = parse(built.indexes[name]);
    assert.equal(validate(actual), true, `${name}: ${JSON.stringify(validate.errors)}`);
    const file = resolve(__dirname, '../schema/views/examples', `${schema}.json`);
    if (process.env.UPDATE_GOLDEN) writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    assert.deepEqual(load('examples', `${schema}.json`), actual);
  }
  const validate = ajv.compile(load('themes.schema.json'));
  const t = parse(built.indexes['themes.json']);
  t.themes[0].links[0].dashed = true;
  assert.equal(validate(t), false); // no line style in the data
});

test('themes.json (board look 2026-11-20): each story carries its view\'s step stamps; each link the time its web note judged it', () => {
  const t = parse(built.indexes['themes.json']);
  for (const theme of t.themes) {
    for (const s of theme.stories) {
      const v = built.stories.get(s.threadId);
      const want = v && !v.aliasOf ? [v.stepCount, v.stepDays, v.firstStep, v.newestStep] : [null, null, null, null];
      assert.deepEqual([s.stepCount, s.stepDays, s.firstStep, s.newestStep], parse(want), s.threadId);
    }
    for (const l of theme.links) assert.ok(l.judgedAt === null || !Number.isNaN(Date.parse(l.judgedAt)), `${l.from}->${l.to}`);
  }
  assert.ok(t.themes.some((x) => x.stories.some((s) => s.stepCount !== null)), 'the fixture has a story with a view');
  assert.ok(t.themes.some((x) => x.links.some((l) => l.judgedAt)), 'the fixture has a judged time');
});

test('themesIndex: a theme lists its shared-name pairs (both ends inside, no judged link between them), one row per pair with every web\'s names', () => {
  const {themesIndex: TI} = require('../src/themes');
  const stamp = (id) => ({threadId: id, iso3: [], regions: [], tier: null, born: null});
  const theme = {themeId: 'theme-a', lead: 'a', newFacts: 0, linkCounts: {strong: 0, medium: 0, weak: 2}, strongest: {from: 'a', to: 'b', strength: 'weak'}, ids: ['a', 'b', 'c'],
    pairs: [{from: 'a', to: 'b', strength: 'weak', reason: null, cited: [], generatedAt: T1}, {from: 'c', to: 'b', strength: 'weak', reason: null, cited: [], generatedAt: null}]};
  const shared = [
    {a: 'a', b: 'c', actors: ['Putin']}, {a: 'c', b: 'a', actors: ['Trump', 'Putin']}, // the same pair from two webs
    {a: 'a', b: 'b', actors: ['X']}, // a judged pair: not a note
    {a: 'a', b: 'z', actors: ['Y']}, // one end outside the theme
  ];
  const t = TI({themes: [theme]}, stamp, () => null, {}, () => null, shared).themes[0];
  assert.deepEqual(t.shared, [{a: 'a', b: 'c', actors: ['Putin', 'Trump']}]);
  assert.deepEqual(t.links.map((l) => l.judgedAt), [T1, null]);
  assert.deepEqual(Object.values(t.stories[0]).slice(-4), [null, null, null, null]); // no story view: no step stamps
});
