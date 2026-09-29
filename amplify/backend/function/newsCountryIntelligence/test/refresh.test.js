'use strict';
// Refresh-policy tests (Batch 1 / R1) — `cd src && npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/refreshPolicy');
const ISO3 = require('../src/iso3Names.json');

const NOW = new Date('2026-10-05T05:15:00Z');
const H = 3600000;
const ago = (hours) => new Date(NOW - hours * H).toISOString();
const country = (name, total, dates = []) => ({ countryName: name, totalArticles: total, entryDates: dates });
const rec = (hoursAgo, total) => ({ generatedAt: ago(hoursAgo), totalArticles: total });
const dec = (existing, c, alerts = []) => P.decideRefresh({ existing, country: c, now: NOW, alerts });

test('new country is briefed', () => assert.equal(dec(null, country('Peru', 5)).reason, 'new'));

test('never twice on the same UTC day, even with an alert', () => {
  const r = dec(rec(3, 10), country('Iran', 12), [{ id: 'x', kind: 'HIGH', since: ago(1) }]);
  assert.deepEqual([r.refresh, r.reason], [false, 'already-today']);
});

test('unchanged article count is skipped (today\'s rule kept), even when the baseline is due', () => {
  assert.equal(dec(rec(300, 12), country('Iran', 12)).reason, 'unchanged');
});

test('weekly baseline: just under 156 h no, at 156 h yes', () => {
  assert.equal(dec(rec(155, 10), country('Iran', 11)).refresh, false);
  const r = dec(rec(156, 10), country('Iran', 11));
  assert.deepEqual([r.refresh, r.reason], [true, 'weekly-baseline']);
});

test('alert: refreshes only for an alert that opened / changed after the last briefing', () => {
  const newer = dec(rec(30, 10), country('Mexico', 12), [{ id: 'g1', kind: 'GDACS', since: ago(5) }]);
  assert.deepEqual([newer.refresh, newer.reason], [true, 'alert']);
  const covered = dec(rec(30, 10), country('Mexico', 12), [{ id: 'g1', kind: 'GDACS', since: ago(48) }]);
  assert.deepEqual([covered.refresh, covered.reason], [false, 'not-due']);
});

test('coverage jump: >= 8 new stories AND >= 2x own pace', () => {
  // 62 articles / 30 d = ~2.07 a day; 3 days old => expected ~6.2, need >= 12.4 and >= 8
  const dates = (n) => Array.from({ length: n }, () => '2026-10-04');
  assert.equal(dec(rec(72, 62), country('Iran', 75, dates(13))).reason, 'coverage-jump');
  assert.equal(dec(rec(72, 62), country('Iran', 72, dates(10))).reason, 'not-due');   // 10 < 12.4
  assert.equal(dec(rec(72, 4), country('Peru', 12, dates(7))).reason, 'not-due');     // 7 < jumpMin 8
  assert.equal(dec(rec(72, 4), country('Peru', 12, dates(8))).reason, 'coverage-jump');
  // entries on or before the last briefing's day do not count
  assert.equal(dec(rec(72, 4), country('Peru', 12, Array(20).fill('2026-10-02'))).reason, 'not-due');
});

const world = (situations) => ({ situations });
test('hot set: GDACS Orange + Red and HIGH news via ISO3; cooling / closed / non-high news ignored', () => {
  const hot = P.hotCountriesFromWorld(world([
    { id: 'gdacs#TC#1', source: 'gdacs', tier: 'elevated', state: 'emerging', affected_names: ['Mexico'], opened_at: ago(10) },
    { id: 'gdacs#EQ#2', source: 'gdacs', tier: 'high', state: 'escalating', affected_names: ['Japan'], last_change_at: ago(2) },
    { id: 'news#3', source: 'news', tier: 'high', state: 'escalating', affected_names: [], iso3_affected: ['UKR', 'RUS'] },
    { id: 'news#4', source: 'news', tier: 'elevated', state: 'escalating', iso3_affected: ['FRA'] },   // not HIGH, not GDACS
    { id: 'gdacs#FL#5', source: 'gdacs', tier: 'elevated', state: 'cooling', affected_names: ['India'] },
    { id: 'gdacs#FL#6', source: 'gdacs', tier: 'elevated', state: 'closed', affected_names: ['Peru'] },
  ]), ISO3);
  assert.deepEqual([...hot.keys()].sort(), ['japan', 'mexico', 'russia', 'ukraine']);
  assert.equal(hot.get('japan')[0].since, ago(2));
  assert.equal(P.hotCountriesFromWorld(null, ISO3).size, 0);      // fetch failure => no alerts
  assert.equal(P.hotCountriesFromWorld({}, ISO3).size, 0);
});

test('names: USA / United States / America join; DR Congo, UAE, Palestine variants', () => {
  for (const n of ['USA', 'United States', 'United States of America', 'US', ' usa ']) assert.equal(P.canonicalName(n), 'united states');
  assert.equal(P.canonicalName('Democratic Republic of the Congo'), P.canonicalName(ISO3.COD));
  assert.equal(P.canonicalName('United Arab Emirates'), P.canonicalName(ISO3.ARE));
  assert.equal(P.canonicalName('Gaza'), P.canonicalName(ISO3.PSE));
  assert.equal(P.canonicalName('Iran, Islamic Republic of'), 'iran');
});

test('an alert on the US refreshes BOTH the USA and the United States records', () => {
  const hot = P.hotCountriesFromWorld(world([{ id: 'n1', source: 'news', tier: 'high', state: 'escalating', iso3_affected: ['USA'], opened_at: ago(1) }]), ISO3);
  const countries = [country('United States', 30), country('USA', 12)];
  const existing = { 'United States': rec(30, 20), USA: rec(30, 10) };
  const plan = P.planRun({ countries, existingByName: existing, hot, now: NOW });
  assert.deepEqual(plan.map((p) => [p.country, p.refresh, p.reason]), [['United States', true, 'alert'], ['USA', true, 'alert']]);
});

test('planRun: top 20 kept, at most 5 alert extras, extras only for an alert, others outside', () => {
  const countries = Array.from({ length: 34 }, (_, i) => country(`C${i}`, 100 - i));
  const hotNames = ['C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C30'];
  const hot = new Map(hotNames.map((n) => [P.canonicalName(n), [{ id: `s-${n}`, kind: 'HIGH', since: ago(1) }]]));
  const existing = {};
  countries.forEach((c) => { existing[c.countryName] = rec(200, c.totalArticles - 3); });
  const plan = P.planRun({ countries, existingByName: existing, hot, now: NOW });
  const by = Object.fromEntries(plan.map((p) => [p.country, p]));
  assert.equal(plan.filter((p) => p.tier === 'top20').length, 20);
  assert.ok(plan.filter((p) => p.tier === 'top20').every((p) => p.refresh && p.reason === 'weekly-baseline'));
  const extras = plan.filter((p) => p.tier === 'alert-extra');
  assert.equal(extras.filter((p) => p.refresh).length, 5);
  assert.deepEqual(extras.filter((p) => !p.refresh).map((p) => [p.country, p.reason]), [['C25', 'extras-cap'], ['C30', 'extras-cap']]);
  assert.equal(by.C26.tier, 'outside');                 // no alert, outside the top 20: not briefed
  assert.equal(by.C26.refresh, false);
});

test('an alert extra whose alert is already covered is not refreshed, and never by baseline / jump', () => {
  const countries = Array.from({ length: 21 }, (_, i) => country(`C${i}`, 100 - i));
  const hot = new Map([[P.canonicalName('C20'), [{ id: 's', kind: 'GDACS', since: ago(500) }]]]);
  const plan = P.planRun({ countries, existingByName: { C20: rec(400, 70), ...Object.fromEntries(countries.slice(0, 20).map((c) => [c.countryName, rec(1, c.totalArticles)])) }, hot, now: NOW });
  const c20 = plan.find((p) => p.country === 'C20');
  assert.deepEqual([c20.tier, c20.refresh], ['alert-extra', false]);
});

test('unmatchedAlerts lists alert countries with no record', () => {
  const hot = new Map([['japan', []], ['fiji', []]]);
  assert.deepEqual(P.unmatchedAlerts(hot, [country('Japan', 5)]), ['fiji']);
});
