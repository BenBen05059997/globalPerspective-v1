'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { READERS } = require('../src/config');
const { lastDays } = require('../src/days');
const { parseGraphql, findSiteTag, pullCloudflare } = require('../src/cloudflare');
const { familyOf, normalizePath, summarize, ownCounts, attention, buildReaders, readersPullDue, pullReaders } = require('../src/readers');
const { buildOps } = require('../src/ops');
const prices = require('../src/prices.json');
const functions = require('../../../../scripts/functions.json').functions;

const NOW = Date.parse('2026-11-04T12:00:00Z');
const DAYS = lastDays(NOW, 14);

test('path -> family: one table, segment boundaries, ops separate, unknown is other', () => {
  const cases = {
    '/': 'map', '/map': 'map', '/breaking': 'map', '/breaking/abc': 'map',
    '/weekly': 'stories', '/today': 'stories', '/weekly/thread/thread-x-123': 'stories',
    '/weekly/countries': 'countries', '/weekly/country/Japan': 'countries',
    '/briefings': 'briefings', '/daily': 'briefings', '/daily/2026-11-03': 'briefings', '/weekly-brief': 'briefings',
    '/track-record': 'trackRecord', '/track-record/text': 'trackRecord',
    '/board': 'board', '/board/b1': 'board', '/ops': 'ops',
    '/about': 'other', '/dailyx': 'other', '/mapping': 'other', '/weekly/other': 'other',
  };
  for (const [path, fam] of Object.entries(cases)) assert.equal(familyOf(path), fam, path);
  assert.equal(normalizePath('/weekly/thread/abc/?utm=1'), '/weekly/thread/abc');
  assert.equal(familyOf('/track-record/?x=1'), 'trackRecord');
});

// Shaped like the Cloudflare GraphQL answer: data.viewer.accounts[0].<alias>[] with count, sum.visits and dimensions.
const answer = () => ({
  data: { viewer: { accounts: [{
    pages: [
      { count: 40, sum: { visits: 30 }, dimensions: { date: '2026-11-03', requestPath: '/' } },
      { count: 10, sum: { visits: 8 }, dimensions: { date: '2026-11-04', requestPath: '/' } },
      { count: 7, sum: { visits: 5 }, dimensions: { date: '2026-11-03', requestPath: '/weekly/thread/thread-a' } },
      { count: 3, sum: { visits: 3 }, dimensions: { date: '2026-11-04', requestPath: '/weekly/thread/thread-a' } },
      { count: 4, sum: { visits: 4 }, dimensions: { date: '2026-11-04', requestPath: '/weekly/thread/thread-b' } },
      { count: 5, sum: { visits: 4 }, dimensions: { date: '2026-11-03', requestPath: '/weekly/country/Japan' } },
      { count: 2, sum: { visits: 2 }, dimensions: { date: '2026-11-03', requestPath: '/weekly/country/South%20Korea' } },
      { count: 6, sum: { visits: 1 }, dimensions: { date: '2026-11-03', requestPath: '/ops' } },
      { count: 2, sum: { visits: 2 }, dimensions: { date: '2026-11-03', requestPath: '/privacy' } },
      { count: 9, sum: { visits: 9 }, dimensions: { date: '2026-09-01', requestPath: '/' } },   // outside the 14 days
    ],
    referrers: [
      { count: 30, sum: { visits: 20 }, dimensions: { refererHost: '' } },
      { count: 12, sum: { visits: 10 }, dimensions: { refererHost: 'news.ycombinator.com' } },
    ],
    countries: [
      { count: 50, sum: { visits: 40 }, dimensions: { countryName: 'United States' } },
      { count: 20, sum: { visits: 15 }, dimensions: { countryName: 'Japan' } },
    ],
  }] } },
});

test('GraphQL answer parsing and summary: families, per-day bars, ops excluded from totals, titles, top lists', () => {
  const rows = { siteTag: 'tag1', ...parseGraphql(answer()) };
  assert.equal(rows.pages.length, 10);
  assert.deepEqual(rows.pages[0], { date: '2026-11-03', path: '/', views: 40, visits: 30 });
  const s = summarize(rows, DAYS, { 'thread-a': 'Story A' }, '2026-11-04T12:00:00.000Z');
  const fam = Object.fromEntries(s.families.map((f) => [f.id, f]));
  assert.equal(fam.map.views, 50);
  assert.equal(fam.map.days[12], 40);           // 2026-11-03
  assert.equal(fam.map.days[13], 10);           // 2026-11-04
  assert.equal(fam.stories.views, 14);
  assert.equal(fam.countries.views, 7);
  assert.equal(fam.ops.views, 6);
  assert.equal(fam.other.views, 2);
  assert.equal(s.totals.views, 50 + 14 + 7 + 2);  // ops not counted, the September row is outside the window
  assert.equal(s.totals.opsViews, 6);
  assert.deepEqual(s.topStories, [{ threadId: 'thread-a', views: 10, title: 'Story A' }, { threadId: 'thread-b', views: 4, title: null }]);
  assert.deepEqual(s.topCountryPages, [{ country: 'Japan', views: 5 }, { country: 'South Korea', views: 2 }]);
  assert.deepEqual(s.visitorCountries[0], { country: 'United States', views: 50 });
  assert.deepEqual(s.referrers, [{ host: 'news.ycombinator.com', views: 12 }]);
  assert.equal(s.directViews, 30);
  assert.equal(s.status, 'ok');
});

test('GraphQL errors and a missing account are errors, an empty list is a real zero', () => {
  assert.throws(() => parseGraphql({ errors: [{ message: 'unknown field' }] }), /unknown field/);
  assert.throws(() => parseGraphql({ data: { viewer: { accounts: [] } } }), /no account/);
  assert.throws(() => parseGraphql(null), /no account/);
  const z = parseGraphql({ data: { viewer: { accounts: [{ pages: [], referrers: [], countries: [] }] } } });
  assert.deepEqual(z, { pages: [], referrers: [], countries: [] });
  assert.equal(summarize({ ...z, siteTag: 't' }, DAYS, {}, 'x').totals.views, 0);
});

const jsonRes = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

test('site tag: env wins; otherwise found by host in the account site list; not found says so', async () => {
  assert.equal(await findSiteTag({ token: 't', accountId: 'a', fetchFn: async () => { throw new Error('no call'); }, env: { CF_SITE_TAG: 'envtag' } }), 'envtag');
  const calls = [];
  const fetchFn = async (url, init) => { calls.push([url, init.headers.Authorization]); return jsonRes({ success: true, result: [{ site_tag: 'x', host: 'other.example' }, { site_tag: 'gp', ruleset: { zone_name: 'globalperspective.net' } }] }); };
  assert.equal(await findSiteTag({ token: 'secret', accountId: 'acc', fetchFn, env: {} }), 'gp');
  assert.match(calls[0][0], /\/accounts\/acc\/rum\/site_info\/list/);
  await assert.rejects(findSiteTag({ token: 't', accountId: 'a', fetchFn: async () => jsonRes({ success: true, result: [{ site_tag: 'x', host: 'other.example' }] }), env: {} }), /no Web Analytics site for globalperspective\.net/);
  await assert.rejects(findSiteTag({ token: 't', accountId: 'a', fetchFn: async () => jsonRes({}, false, 403), env: {} }), /HTTP 403/);
});

test('pullCloudflare sends the account, site tag and 14-day window; the token only in the header', async () => {
  const sent = [];
  const fetchFn = async (url, init) => { sent.push({ url, init }); return jsonRes(answer()); };
  const r = await pullCloudflare({ token: 'tok', days: DAYS, now: NOW, fetchFn, env: { CF_SITE_TAG: 'tag1' } });
  assert.equal(r.siteTag, 'tag1');
  const body = JSON.parse(sent[0].init.body);
  assert.equal(sent[0].url, READERS.graphqlUrl);
  assert.equal(body.variables.accountTag, READERS.accountId);
  assert.equal(body.variables.siteTag, 'tag1');
  assert.equal(body.variables.from, '2026-10-22T00:00:00Z');
  assert.match(body.query, /rumPageloadEventsAdaptiveGroups/);
  assert.ok(!sent[0].init.body.includes('tok'));
  await assert.rejects(pullCloudflare({ token: 't', days: DAYS, now: NOW, fetchFn: async () => jsonRes({}, false, 500), env: { CF_SITE_TAG: 'x' } }), /GraphQL HTTP 500/);
});

const fakeAws = (over = {}) => ({
  readText: async () => ({ text: JSON.stringify({ stories: [{ threadId: 'thread-a', title: 'Story A' }] }), at: null }),
  ownRows: async () => ({ userCreated: ['2026-03-24T14:57:39.653Z', '2026-11-03T01:00:00Z', null], savedKeys: ['thread#a', 'thread#b', 'country#JPN', 'board#b1'], shareCreated: ['2026-11-04T01:00:00Z'] }),
  ...over,
});

test('pull: no token is not_connected with no network call, own data still counted; an API error is error, never numbers', async () => {
  let called = 0;
  const fetchFn = async () => { called += 1; return jsonRes(answer()); };
  const nc = await pullReaders({ aws: fakeAws(), now: NOW, days: DAYS, env: {}, fetchFn });
  assert.deepEqual(nc.cloudflare, { status: 'not_connected' });
  assert.equal(called, 0);
  assert.equal(nc.own.status, 'ok');
  assert.equal(nc.own.users.total, 3);
  assert.equal(nc.own.users.undated, 1);
  assert.equal(nc.own.users.days.find((d) => d.date === '2026-11-03').count, 1);
  assert.deepEqual(nc.own.saved, { total: 3, byType: { thread: 2, country: 1 } });
  assert.deepEqual(nc.own.boards, { total: 1 });
  assert.equal(nc.own.shares.days[13].count, 1);

  const err = await pullReaders({ aws: fakeAws(), now: NOW, days: DAYS, env: { CF_ANALYTICS_TOKEN: 't', CF_SITE_TAG: 's' }, fetchFn: async () => jsonRes({}, false, 403) });
  assert.deepEqual(err.cloudflare, { status: 'error', error: 'Cloudflare GraphQL HTTP 403' });

  const ok = await pullReaders({ aws: fakeAws(), now: NOW, days: DAYS, env: { CF_ANALYTICS_TOKEN: 't', CF_SITE_TAG: 's' }, fetchFn });
  assert.equal(ok.cloudflare.status, 'ok');
  assert.equal(ok.cloudflare.topStories[0].title, 'Story A');

  const ownErr = await pullReaders({ aws: fakeAws({ ownRows: async () => { throw new Error('AccessDenied'); } }), now: NOW, days: DAYS, env: {} });
  assert.deepEqual(ownErr.own, { status: 'error', error: 'AccessDenied' });
});

test('pull: an unreadable story index leaves titles empty, it does not fail the pull', async () => {
  const ok = await pullReaders({ aws: fakeAws({ readText: async () => { throw new Error('boom'); } }), now: NOW, days: DAYS, env: { CF_ANALYTICS_TOKEN: 't', CF_SITE_TAG: 's' }, fetchFn: async () => jsonRes(answer()) });
  assert.equal(ok.cloudflare.status, 'ok');
  assert.equal(ok.cloudflare.topStories[0].title, null);
});

test('own counts: users by createdAt day only, saved split by key prefix, no ids anywhere in the output', () => {
  const o = ownCounts({ userCreated: ['2026-11-04T00:00:00Z'], savedKeys: ['thread#secret-id', 'board#secret-board'], shareCreated: [] }, DAYS);
  assert.ok(!JSON.stringify(o).includes('secret'));
});

test('lambdaFeatures in config.js equals scripts/functions.json (features other than ops)', () => {
  const expected = {};
  for (const [name, f] of Object.entries(functions)) { const feats = f.features.filter((x) => x !== 'ops'); if (feats.length) expected[name] = feats; }
  assert.deepEqual(READERS.lambdaFeatures, expected);
});

test('every feature of a deployed Lambda belongs to at most one family', () => {
  const seen = new Map();
  for (const f of READERS.families) for (const x of f.features) { assert.ok(!seen.has(x), `${x} in two families`); seen.set(x, f.id); }
});

test('spend split: a Lambda\'s spend is divided evenly over its features, families sum to the Lambda\'s mapped share', () => {
  // newsCountryIntelligence serves countries + map: half each. newsThreadAnalysis: threads, map, analysis-studio: a third to stories, a third to map.
  const dsDays = [
    { date: '2026-11-03', usd: 9, lines: [{ fn: 'newsCountryIntelligence', usd: 4 }, { fn: 'newsThreadAnalysis', usd: 3 }, { fn: 'newsPostLinkedin', usd: 2 }, { fn: 'newsAgent', usd: null }] },
    { date: '2026-11-04', usd: 1, lines: [{ fn: 'newsCountryIntelligence', usd: 2 }] },
    { date: '2026-09-01', usd: 100, lines: [{ fn: 'newsCountryIntelligence', usd: 100 }] },   // outside the window
  ];
  const rows = attention([{ id: 'map', views: 50 }, { id: 'countries', views: 7 }], dsDays, DAYS);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by.countries.usd, 3);                     // (4 + 2) / 2
  assert.equal(by.countries.views, 7);
  assert.deepEqual(by.countries.lambdas, [{ fn: 'newsCountryIntelligence', usd: 3 }]);
  assert.equal(by.map.usd, 4);                           // 3 from newsCountryIntelligence + 1 from newsThreadAnalysis
  assert.equal(by.stories.usd, 1);
  assert.equal(by.stories.views, null);                  // not in the Cloudflare families given
  assert.ok(!rows.some((r) => r.id === 'ops' || r.id === 'other'));
  assert.equal(attention(null, [], DAYS)[0].usd, null);  // no spend data at all: unknown, not zero
});

test('buildReaders: not connected keeps the section honest; a run that pulls nothing keeps the earlier pull but refreshes attention', () => {
  const dsDays = [{ date: '2026-11-03', usd: 1, lines: [{ fn: 'newsBoard', usd: 1 }] }];
  const first = buildReaders({ pull: { cloudflare: { status: 'not_connected' }, own: { status: 'ok' }, pulledAt: '2026-11-04T01:00:00.000Z' }, prev: null, dsDays, now: NOW });
  assert.deepEqual(first.cloudflare, { status: 'not_connected' });
  assert.equal(first.attention.find((r) => r.id === 'board').views, null);
  assert.match(first.note, /no way to exclude it/);
  const again = buildReaders({ pull: null, prev: { readers: first }, dsDays: [], now: NOW + 3600000 });
  assert.equal(again.pulledAt, '2026-11-04T01:00:00.000Z');
  assert.deepEqual(again.own, { status: 'ok' });
  const fresh = buildReaders({ pull: null, prev: null, dsDays: [], now: NOW });
  assert.deepEqual(fresh.cloudflare, { status: 'not_connected' });
});

test('pull is due once a UTC day, and again while Cloudflare is not ok', () => {
  const prev = (status, at) => ({ readers: { pulledAt: at, cloudflare: { status } } });
  assert.equal(readersPullDue(null, NOW), true);
  assert.equal(readersPullDue(prev('ok', '2026-11-04T01:00:00.000Z'), NOW), false);
  assert.equal(readersPullDue(prev('ok', '2026-11-03T23:00:00.000Z'), NOW), true);
  assert.equal(readersPullDue(prev('error', '2026-11-04T01:00:00.000Z'), NOW), true);
  assert.equal(readersPullDue(prev('not_connected', '2026-11-04T01:00:00.000Z'), NOW), true);
});

test('buildOps carries the readers section', () => {
  const ops = buildOps({ usage: { rows: [], error: null }, cost: null, readers: { cloudflare: { status: 'not_connected' }, own: { status: 'ok' }, pulledAt: 'x' }, raw: {}, prices, prev: null, now: NOW });
  assert.equal(ops.readers.cloudflare.status, 'not_connected');
  assert.ok(Array.isArray(ops.readers.attention));
});
