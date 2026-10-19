import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('./classifier-core.js');
const { buildMessages, parseClassification, normalizeClassified, clusterStories, domainOf } = core;

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok ${name}`); };

t('buildMessages numbers the headlines', () => {
  const m = buildMessages([{ title: 'A war begins' }, { title: 'Market falls' }]);
  assert.match(m[1].content, /1\. A war begins/);
  assert.match(m[1].content, /2\. Market falls/);
});

t('parseClassification strips fences + extracts object', () => {
  const r = parseClassification('```json\n{"articles":[{"n":1,"axis":"conflict"}]}\n```');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].axis, 'conflict');
  assert.deepStrictEqual(parseClassification('garbage'), []);
});

t('normalizeClassified validates axis/latlon/iso3/severity', () => {
  const art = { title: 'Strikes in region', url: 'https://reuters.com/x/y', source: 'reuters.com' };
  const c = normalizeClassified({ iso3: ['irn', 'XX', 'ISR'], latlon: [32, 53], axis: 'conflict', severity: 9, kind: 'event', entities: ['IRGC'] }, art);
  assert.deepStrictEqual(c.iso3, ['IRN', 'ISR']); // XX dropped
  assert.deepStrictEqual(c.latlon, { lat: 32, lon: 53 });
  assert.strictEqual(c.severity, 5); // clamped
  assert.strictEqual(c.domain, 'reuters.com');
  assert.strictEqual(c.axis, 'conflict');
});

t('normalizeClassified rejects bad axis + out-of-range latlon', () => {
  const art = { title: 'x', url: 'https://x.com' };
  const c = normalizeClassified({ axis: 'sports', latlon: [200, 0], severity: 2 }, art);
  assert.strictEqual(c.axis, null);
  assert.strictEqual(c.latlon, null);
});

t('domainOf strips protocol + www', () => {
  assert.strictEqual(domainOf('https://www.bbc.com/news/x'), 'bbc.com');
});

t('clusterStories groups by axis+iso3+entity, computes outlets/velocity/spread', () => {
  const mk = (title, domain, iso3, ent, sev = 3) => ({
    title, url: `https://${domain}/x`, domain, iso3, latlon: { lat: 32, lon: 53 }, axis: 'conflict', category: 'war', severity: sev, kind: 'event', entities: [ent],
  });
  const classified = [
    mk('Iran strike A', 'reuters.com', ['IRN'], 'IRGC', 4),
    mk('Iran strike B', 'bbc.com', ['IRN', 'ISR'], 'IRGC', 3),
    mk('Iran strike C', 'apnews.com', ['IRN'], 'IRGC', 2),
    mk('Unrelated market', 'ft.com', ['USA'], 'Fed'),
  ];
  classified[3].axis = 'economic';
  const prev = { 'conflict#IRN#irgc': { outlets: 1, iso3: ['IRN'], first_seen: '2026-09-07T00:00:00Z' } };
  const stories = clusterStories(classified, '2026-09-08T00:00:00Z', prev);
  const s = stories.find((x) => x.storyId === 'conflict#IRN#irgc');
  assert.ok(s, 'iran story exists');
  assert.strictEqual(s.outlets, 3);
  assert.strictEqual(s.max_severity, 4);
  assert.deepStrictEqual(s.spread_new_iso3, ['ISR']); // ISR new vs prev [IRN]
  assert.strictEqual(s.velocity, 3); // 3 outlets / prev 1
  assert.strictEqual(s.first_seen, '2026-09-07T00:00:00Z'); // preserved
  assert.strictEqual(stories.some((x) => x.axis === 'economic'), true);
});

t('clusterStories drops severity<2 and no-location events', () => {
  const stories = clusterStories([
    { title: 'minor', url: 'https://x.com', domain: 'x.com', iso3: ['USA'], latlon: { lat: 1, lon: 1 }, axis: 'political', category: 'policy', severity: 1, kind: 'event', entities: ['a'] },
    { title: 'noloc', url: 'https://y.com', domain: 'y.com', iso3: ['USA'], latlon: null, axis: 'political', category: 'policy', severity: 4, kind: 'event', entities: ['b'] },
  ], '2026-09-08T00:00:00Z');
  assert.strictEqual(stories.length, 0);
});

t('splitByCache: cached url+title reused, new or re-headlined article goes to the model', () => {
  const { splitByCache, nextCache } = core;
  const a = { title: 'War begins', url: 'https://a.com/1' };
  const b = { title: 'Market falls', url: 'https://b.com/2' };
  const ca = normalizeClassified({ iso3: ['UKR'], axis: 'conflict', severity: 4 }, a);
  const cache = nextCache(null, [ca], '2026-10-05T00:00:00Z', 48);
  const r = splitByCache([a, b], cache);
  assert.deepStrictEqual(r.hits, [ca]);
  assert.deepStrictEqual(r.misses, [b]);
  const r2 = splitByCache([{ ...a, title: 'War begins: 3 killed' }], cache);
  assert.strictEqual(r2.misses.length, 1);
  assert.strictEqual(splitByCache([a, b], null).misses.length, 2);
});

t('nextCache keeps first-classified time and prunes entries older than keepHours', () => {
  const { nextCache, cacheKey } = core;
  const a = { title: 'A', url: 'https://a.com/1' }; const b = { title: 'B', url: 'https://b.com/2' };
  const ca = normalizeClassified({ axis: 'conflict' }, a); const cb = normalizeClassified({ axis: 'political' }, b);
  const c1 = nextCache(null, [ca], '2026-10-05T00:00:00Z', 48);
  const c2 = nextCache(c1, [cb], '2026-10-06T00:00:00Z', 48);
  assert.strictEqual(c2.count, 2);
  assert.strictEqual(c2.entries[cacheKey(a)].at, '2026-10-05T00:00:00Z');
  const c3 = nextCache(c2, [], '2026-10-07T01:00:00Z', 48);
  assert.deepStrictEqual(Object.keys(c3.entries), [cacheKey(b)]);
});

t('B1 snippet: kept, truncated to 200, omitted when empty; headlines carry it', () => {
  const long = 'x'.repeat(300);
  const a = normalizeClassified({ axis: 'conflict', iso3: ['UKR'], severity: 4 }, { title: 'T', url: 'https://a.com/1', description: `  ${long}  ` });
  assert.strictEqual(a.snippet.length, 200);
  const b = normalizeClassified({ axis: 'conflict' }, { title: 'T', url: 'https://a.com/2', description: '' });
  assert.strictEqual('snippet' in b, false);
  const c = normalizeClassified({ axis: 'conflict' }, { title: 'T', url: 'https://a.com/3' });
  assert.strictEqual('snippet' in c, false);
  const mk = (u, d) => normalizeClassified({ axis: 'conflict', iso3: ['UKR'], latlon: [50, 30], severity: 4, entities: ['Zelensky'] }, { title: 'T' + u, url: `https://${u}.com/x`, description: d });
  const [s] = clusterStories([mk('a', 'snip a'), mk('b', '')], '2026-10-18T00:00:00Z');
  assert.strictEqual(s.headlines[0].snippet, 'snip a');
  assert.strictEqual('snippet' in s.headlines[1], false);
});

console.log(`\n${pass} tests passed`);
