'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/links');

test('story, country, map, briefing, forecast, studio, today and breaking addresses (same rules as the frontend)', () => {
  assert.strictEqual(L.storyHref('thread-a-1'), '/weekly/thread/thread-a-1');
  assert.strictEqual(L.storyHref('t-1', { tab: 'timeline' }), '/weekly/thread/t-1?tab=timeline');
  assert.strictEqual(L.storyHref(null), '/weekly');
  assert.strictEqual(L.countryHref('United Arab Emirates'), '/weekly/country/UAE');
  assert.strictEqual(L.countryHref('Democratic Republic of the Congo'), '/weekly/country/DR%20Congo');
  assert.strictEqual(L.countryHref('Gaza'), '/weekly/country/Palestine');
  assert.strictEqual(L.countryHref('Strait of Hormuz'), null);
  assert.strictEqual(L.mapHref({ country: 'USA' }), '/?country=USA');
  assert.strictEqual(L.mapHref({ story: 'thread-a-1' }), '/?story=thread-a-1');
  assert.strictEqual(L.mapHref({ situation: 's1', layer: 'risk' }), '/?focus=s1&layer=risk');
  assert.strictEqual(L.briefingHref({ mode: 'weekly', week: '2026-10-13' }), '/briefings?mode=weekly&week=2026-10-13');
  assert.strictEqual(L.briefingHref({ date: '2026-10-18' }), '/briefings?date=2026-10-18');
  assert.strictEqual(L.briefingHref({ mode: 'present', deck: 'weekly' }), '/briefings?mode=present&deck=weekly');
  assert.strictEqual(L.briefingHref({ mode: 'x', date: 'bad' }), '/briefings');
  assert.strictEqual(L.forecastHref('q1'), '/track-record?q=q1');
  assert.strictEqual(L.forecastAnchorId('q1'), 'q-q1');
  assert.strictEqual(L.studioHref(['a', 'b']), '/analyze?stories=a%2Cb');
  assert.strictEqual(L.todayHref(), '/today');
  assert.strictEqual(L.breakingHref('alert 1/x'), '/breaking/alert%201%2Fx');
  assert.strictEqual(L.breakingHref(null), '/');
  assert.strictEqual(L.entityHref('country', 'Europe'), null);
  assert.strictEqual(L.entityHref('forecast', 'q2'), '/track-record?q=q2');
});

test('absoluteUrl adds the site origin for emails; a missing page stays null', () => {
  assert.strictEqual(L.absoluteUrl(L.countryHref('UAE')), 'https://globalperspective.net/weekly/country/UAE');
  assert.strictEqual(L.absoluteUrl('/today', 'https://example.test/'), 'https://example.test/today');
  assert.strictEqual(L.absoluteUrl(L.countryHref('NATO')), null);
});
