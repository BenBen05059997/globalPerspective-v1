// node selection-core.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const core = createRequire(import.meta.url)('./selection-core.js');
const { mkCand, frequent, mergeCands, select, attachAlerts, keyOf, fromKey, same } = core;

let n = 0;
const test = (name, fn) => { fn(); n++; };
const art = (t, iso, ent, dom, extra = {}) => ({ en_title: t, title: t, domain: dom, iso3: [iso], severity: 3, entities: ent ? [ent] : [], url: `https://${dom}/${t}`, axis: 'conflict', category: 'war', ...extra });
const cand = (id, t, iso, extra = {}, outlets = 2) => mkCand(Array.from({ length: outlets }, (_, i) => art(t, iso, '', `${id}-${i}.com`, extra)), [id]);
const sc = (c, impact, done = 0.9, nw = 0.9) => ({ c, impact, done, nw });
const none = () => false;

test('merge: same country + shared entity or similar title; frequent entity is not a key', () => {
  const filler = Array.from({ length: 60 }, (_, i) => mkCand([art(`Filler${'x'.repeat(i)}${i} report`, 'BRA', '', `f${i}.com`)], [`f${i}`]));
  const cs = [
    mkCand([art('Floods hit northern province hard', 'IND', '', 'a.com')], ['1']), mkCand([art('Floods hit northern province again', 'IND', '', 'b.com')], ['2']),
    mkCand([art('Parliament passes budget', 'IND', 'Narendra Modi', 'c.com')], ['3']), mkCand([art('Modi visits plant', 'IND', 'Narendra Modi', 'd.com')], ['4']),
    mkCand([art('Floods hit northern province hard', 'FRA', '', 'e.com')], ['5']), mkCand([art('Central bank cuts rates', 'IND', 'RBI', 'f.com')], ['6']),
    ...[['7', 'Tariffs announced'], ['8', 'Senate vote'], ['9', 'Shutdown looms'], ['10', 'Pipeline sanctions']].map(([id, t]) => mkCand([art(t, 'USA', 'Donald Trump', `t${id}.com`)], [id])),
  ];
  const all = [...cs, ...filler], m = mergeCands(all, frequent(all.flatMap((c) => c.items)));
  assert.deepEqual(m.filter((c) => !c.ids[0].startsWith('f')).map((c) => c.ids.slice().sort().join('+')).sort(), ['1+2', '10', '3+4', '5', '6', '7', '8', '9']);
  assert.equal(m.find((c) => c.ids.includes('1')).outlets, 2);
});

test('gates: said, low impact, not new and 1-outlet stories are out', () => {
  const picks = select([sc(cand('a', 'Strikes hit city', 'UKR'), 3), sc(cand('b', 'Leader blasts ally', 'FRA'), 3, 0.3), sc(cand('c', 'Local fire', 'GBR'), 1), sc(cand('d', 'Repeat story', 'DEU'), 3, 0.9, 0.1), sc(cand('e', 'Lone report', 'BRA', {}, 1), 3)], 10, none);
  assert.deepEqual(picks.map((s) => s.c.ids[0]), ['a']);
});

test('one story per war: conflict stories sharing a country take one slot', () => {
  const ru = (id, t, imp) => sc(mkCand([art(t, 'UKR', '', `${id}1.com`, { iso3: ['UKR', 'RUS'] }), art(t, 'UKR', '', `${id}2.com`, { iso3: ['UKR', 'RUS'] })], [id]), imp);
  const picks = select([ru('k1', 'Russia strikes Kyiv overnight', 3), ru('k2', 'Drones hit Kharkiv power grid', 2.9), sc(cand('nk', 'North Korea tests torpedo', 'PRK'), 2.5)], 10, none);
  assert.deepEqual(picks.map((s) => s.c.ids[0]), ['k1', 'nk']);
});

test('decision lift: a domestic policy decision below the bar alone passes it and outranks a slightly higher story', () => {
  const policy = cand('iq', 'Iraq devalues its currency', 'IRQ', { category: 'policy', axis: 'economic' });
  const picks = select([sc(cand('x', 'Bridge collapses', 'PER', { category: 'disaster', axis: 'humanitarian' }), 1.6), sc(policy, 1.4)], 10, none);
  assert.deepEqual(picks.map((s) => s.c.ids[0]), ['iq', 'x']);
});

test('GDACS: only a reported disaster story is tagged; Red takes the reserved slot even when said/low impact', () => {
  const quake = cand('q', 'Earthquake kills dozens', 'TUR', { category: 'disaster', axis: 'humanitarian' });
  const other = cand('o', 'Election held', 'TUR', { category: 'election', axis: 'political' });
  const sit = { iso3_origin: ['TUR'], iso3_affected: ['TUR'], history: [{ at: '2026-10-18T00:00:00Z', level: 'Red' }], evidence: { gdacs_description: 'Red earthquake in Turkey' } };
  attachAlerts([quake, other], [sit], Date.parse('2026-10-18T06:00:00Z'));
  assert.equal(quake.alert, 'Red'); assert.equal(other.alert, undefined);
  const picks = select([sc(cand('big', 'Big story', 'USA'), 4), sc(quake, 0.5, 0.2)], 1, none);
  assert.deepEqual(picks.map((s) => s.c.ids[0]), ['q']);
});

test('seen: a stored pick key matches the same story in a later run', () => {
  const a = mkCand([art('Floods hit northern province hard', 'IND', 'Flood agency', 'a.com')], ['1']);
  const later = mkCand([art('Flood agency raises toll', 'IND', 'Flood agency', 'b.com')], ['2']);
  const k = JSON.parse(JSON.stringify(keyOf(a)));
  assert.ok(same(later, fromKey(k), new Set()));
  assert.deepEqual(select([sc(later, 3), sc(cand('z', 'Other news', 'CHN'), 2)], 10, (c) => same(c, fromKey(k), new Set())).map((s) => s.c.ids[0]), ['z']);
});

console.log(`${n} tests passed`);
