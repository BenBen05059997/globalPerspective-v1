'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../src/prices.json');
const { priceFor, isPeak, usageUsd } = require('../src/pricing');
const { buildOps, usageDays, awsDays, mergeDays, monthToDate, awsPullDue } = require('../src/ops');

const NOW = Date.parse('2026-11-04T12:00:00Z');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} vs ${b}`);
const row = (o) => ({ hourIso: '2026-11-03T12:00:00.000Z', fn: 'newsAgent', step: 'summary', model: 'deepseek-flash', calls: 1, promptTokens: 1000000, completionTokens: 1000000, cacheHitTokens: 0, ...o });

test('prices: aliases, validFrom and the unknown model', () => {
  assert.equal(priceFor(prices, 'deepseek-flash', '2026-11-04').model, 'deepseek-flash');
  assert.equal(priceFor(prices, 'deepseek-v4-flash', '2026-11-04').model, 'deepseek-flash');
  assert.equal(priceFor(prices, 'deepseek-flash', '2026-01-01').model, 'deepseek-flash'); // before every validFrom: the earliest entry
  assert.equal(priceFor(prices, 'jev-1.14.0', '2026-11-04'), null);
  const two = { prices: [{ model: 'm', validFrom: '2026-01-01', offPeak: { in: 1 } }, { model: 'm', validFrom: '2026-06-01', offPeak: { in: 2 } }] };
  assert.equal(priceFor(two, 'm', '2026-03-01').offPeak.in, 1);
  assert.equal(priceFor(two, 'm', '2026-06-01').offPeak.in, 2);
});

test('peak window: Monday to Friday, 01-04 and 06-10 UTC', () => {
  assert.equal(isPeak(prices, '2026-11-04T01:00:00.000Z'), true);   // Wednesday
  assert.equal(isPeak(prices, '2026-11-04T04:00:00.000Z'), false);
  assert.equal(isPeak(prices, '2026-11-04T09:00:00.000Z'), true);
  assert.equal(isPeak(prices, '2026-11-04T10:00:00.000Z'), false);
  assert.equal(isPeak(prices, '2026-11-01T07:00:00.000Z'), false);  // Sunday
});

test('usage cost: off-peak, peak, cache hits at the hit price, unknown model is null', () => {
  const m = { promptTokens: 1000000, completionTokens: 1000000, cacheHitTokens: 0 };
  assert.equal(usageUsd(prices, { model: 'deepseek-flash', hourIso: '2026-11-03T12:00:00.000Z', ...m }), 0.15 + 0.6);
  assert.equal(usageUsd(prices, { model: 'deepseek-flash', hourIso: '2026-11-03T07:00:00.000Z', ...m }), 0.3 + 1.2);
  const hit = usageUsd(prices, { model: 'deepseek-v4-pro', hourIso: '2026-11-03T12:00:00.000Z', promptTokens: 1000000, completionTokens: 0, cacheHitTokens: 750000 });
  assert.ok(Math.abs(hit - (0.75 * 0.022 + 0.25 * 0.66)) < 1e-9);
  assert.equal(usageUsd(prices, { model: 'jev-1.14.0', hourIso: '2026-11-03T12:00:00.000Z', ...m }), null);
});

test('usage days: lines per fn/step/model, days outside the window ignored, an unpriced line has usd null', () => {
  const days = usageDays([row({}), row({ calls: 2 }), row({ fn: 'x', model: 'jev-1.14.0' }), row({ hourIso: '2026-09-01T00:00:00.000Z' })], prices, ['2026-11-03', '2026-11-04']);
  assert.equal(days['2026-11-03'].length, 2);
  const a = days['2026-11-03'].find((l) => l.fn === 'newsAgent');
  assert.equal(a.calls, 3);
  assert.equal(a.usd, 1.5);
  assert.equal(days['2026-11-03'].find((l) => l.fn === 'x').usd, null);
  assert.deepEqual(days['2026-11-04'], []);
});

test('aws days: totals, services sorted, zero services dropped', () => {
  const d = awsDays([{ day: '2026-11-03', service: 'S3', usd: 0.31 }, { day: '2026-11-03', service: 'Lambda', usd: 0 }, { day: '2026-11-03', service: 'DynamoDB', usd: 0.06 }]);
  assert.deepEqual(d, [{ date: '2026-11-03', usd: 0.37, byService: [{ service: 'S3', usd: 0.31 }, { service: 'DynamoDB', usd: 0.06 }] }]);
});

test('merge keeps older days and caps the length; month to date says where it starts', () => {
  const prev = Array.from({ length: 5 }, (_, i) => ({ date: `2026-10-0${i + 1}`, usd: 1 }));
  const merged = mergeDays(prev, [{ date: '2026-10-05', usd: 9 }, { date: '2026-10-06', usd: 1 }], 4);
  assert.deepEqual(merged.map((d) => d.date), ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']);
  assert.equal(merged[2].usd, 9);
  assert.deepEqual(monthToDate([{ date: '2026-10-31', usd: 5 }, { date: '2026-11-02', usd: 1.5 }, { date: '2026-11-03', usd: null }, { date: '2026-11-04', usd: 0.5 }], '2026-11-04'), { month: '2026-11', from: '2026-11-02', days: 3, usd: 2 });
  assert.deepEqual(monthToDate([], '2026-11-04'), { month: '2026-11', from: null, days: 0, usd: null });
});

test('AWS pull is due once per UTC day', () => {
  assert.equal(awsPullDue(null, NOW), true);
  assert.equal(awsPullDue({ aws: { pulledAt: '2026-11-03T23:15:00Z' } }, NOW), true);
  assert.equal(awsPullDue({ aws: { pulledAt: '2026-11-04T00:15:00Z' } }, NOW), false);
  assert.equal(awsPullDue({ aws: {} }, NOW), true);
});

const raw = { '2026-11-03': { counts: { entry: 40, forecast_drawn: 20 }, countryNotes: 4, dailyBrief: 1 } };
const usage = { rows: [
  row({ promptTokens: 1000000, completionTokens: 0 }),                                          // entry: 0.15
  row({ step: 'trace_cause', promptTokens: 1000000, completionTokens: 0 }),                     // entry: 0.15
  row({ step: 'forecast', model: 'deepseek-v4-pro', promptTokens: 1000000, completionTokens: 0 }), // forecast: 0.66
  row({ fn: 'newsCountryIntelligence', step: 'country_intel', model: 'deepseek-v4-pro', promptTokens: 1000000, completionTokens: 0 }), // 0.66 / 4
  row({ fn: 'newsPostDevTo', step: 'daily_brief', model: 'deepseek-v4-pro', promptTokens: 1000000, completionTokens: 0 }),
  row({ fn: 'newsRecordReview', step: 'review', model: 'deepseek-v4-pro', hourIso: '2026-11-02T12:00:00.000Z', promptTokens: 1000000, completionTokens: 0 }),
], error: null };

test('ops.json: yesterday, month to date, unit costs and the weekly review', () => {
  const ops = buildOps({ usage, cost: { rows: [{ day: '2026-11-03', service: 'S3', usd: 0.4 }], error: null, pulledAt: '2026-11-04T00:10:00.000Z' }, raw, prices, prev: null, now: NOW });
  assert.equal(ops.deepseek.estimate, true);
  assert.equal(ops.deepseek.yesterday.date, '2026-11-03');
  near(ops.deepseek.yesterday.usd, 0.15 + 0.15 + 0.66 + 0.66 + 0.66);
  near(ops.deepseek.monthToDate.usd, 0.15 + 0.15 + 0.66 * 4);
  const day = ops.unitCosts.days.find((d) => d.date === '2026-11-03');
  assert.deepEqual(day.entry, { usd: 0.3, count: 40, per: 0.0075 });
  assert.deepEqual(day.forecast, { usd: 0.66, count: 20, per: 0.033 });
  assert.deepEqual(day.countryNote, { usd: 0.66, count: 4, per: 0.165 });
  assert.deepEqual(day.dailyBrief, { usd: 0.66, count: 1, per: 0.66 });
  assert.deepEqual(ops.unitCosts.weeklyReview, [{ week: '2026-W45', usd: 0.66 }]);
  assert.equal(ops.aws.yesterday.usd, 0.4);
  assert.deepEqual(ops.deepseek.unpriced, []);
  // a day with no usage line is no data, not a free day
  assert.equal(ops.deepseek.days.find((d) => d.date === '2026-10-30').usd, null);
});

test('a failed source keeps the earlier days and says why', () => {
  const first = buildOps({ usage, cost: { rows: [{ day: '2026-11-03', service: 'S3', usd: 0.4 }], pulledAt: '2026-11-04T00:10:00.000Z' }, raw, prices, prev: null, now: NOW });
  const later = buildOps({ usage: { rows: null, error: 'query timed out' }, cost: { rows: null, error: 'ce denied' }, raw, prices, prev: first, now: NOW + 3600000 });
  assert.equal(later.deepseek.error, 'query timed out');
  assert.equal(later.deepseek.yesterday.usd, first.deepseek.yesterday.usd);
  assert.equal(later.aws.error, 'ce denied');
  assert.equal(later.aws.yesterday.usd, 0.4);
  assert.equal(later.aws.pulledAt, '2026-11-04T00:10:00.000Z');
  assert.equal(later.unitCosts.days.length, first.unitCosts.days.length);
});

test('no cost pull this run: the earlier AWS days stay and the error clears nothing it should not', () => {
  const first = buildOps({ usage, cost: { rows: [{ day: '2026-11-03', service: 'S3', usd: 0.4 }], pulledAt: '2026-11-04T00:10:00.000Z' }, raw, prices, prev: null, now: NOW });
  const next = buildOps({ usage, cost: null, raw, prices, prev: first, now: NOW + 3600000 });
  assert.deepEqual(next.aws.days, first.aws.days);
  assert.equal(next.aws.error, null);
});

test('an unknown model is listed as unpriced and adds nothing to the total', () => {
  const ops = buildOps({ usage: { rows: [row({ model: 'jev-1.14.0' }), row({ promptTokens: 1000000, completionTokens: 0 })], error: null }, cost: null, raw, prices, prev: null, now: NOW });
  assert.deepEqual(ops.deepseek.unpriced, ['jev-1.14.0']);
  assert.equal(ops.deepseek.yesterday.usd, 0.15);
});
