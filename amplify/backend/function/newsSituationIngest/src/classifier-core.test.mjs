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

console.log(`\n${pass} tests passed`);
