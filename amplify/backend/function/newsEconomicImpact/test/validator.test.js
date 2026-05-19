// Validator unit tests for newsEconomicImpact.
//
// Run from anywhere:
//   node amplify/backend/function/newsEconomicImpact/test/validator.test.js
//
// Tests the closed instrument allowlist, citation requirement, and enum
// normalization without hitting AWS or calling DeepSeek. Loads the real
// Lambda source via a temp _under_test.js stub so node_modules resolve.

const fs = require('fs');
const path = require('path');

const LAMBDA_SRC = path.join(__dirname, '..', 'src');
const SRC = path.join(LAMBDA_SRC, 'index.js');

// Write a temp under-test module next to index.js so its require('./economic_analogs.json')
// and require('@aws-sdk/...') resolve from the Lambda's node_modules.
const src = fs.readFileSync(SRC, 'utf8');
const TEST_EXPORTS = `
module.exports = {
  validateImpact, applyConsistencyChecks, snapshotMarkets, INSTRUMENT_ALLOWLIST,
  VALID_DIRECTIONS, VALID_MAGNITUDES, VALID_SEVERITIES, SEVERITY_BAND,
};
`;
const tmpFile = path.join(LAMBDA_SRC, '_under_test.js');
fs.writeFileSync(tmpFile, src + '\n' + TEST_EXPORTS);
process.on('exit', () => { try { fs.unlinkSync(tmpFile); } catch {} });

const mod = require(tmpFile);
const { validateImpact, applyConsistencyChecks, INSTRUMENT_ALLOWLIST } = mod;

// Helper — build a baseline-valid record for consistency-check tests.
function makeRecord(overrides = {}) {
  return {
    hasImpact: true,
    headline: 'Test headline',
    severity: 'moderate',
    severityScore: 50,
    confidence: 'medium',
    horizon: 'days',
    instruments: [
      { instrumentId: 'BRENT', direction: 'up', magnitude: 'moderate', rationale: 'r', citedTopicIds: ['topic-abc'] },
      { instrumentId: 'GOLD',  direction: 'up', magnitude: 'moderate', rationale: 'r', citedTopicIds: ['topic-def'] },
    ],
    winners: [{ name: 'A', type: 'country', why: 'x' }, { name: 'B', type: 'sector', why: 'y' }],
    losers:  [{ name: 'C', type: 'country', why: 'x' }, { name: 'D', type: 'sector', why: 'y' }],
    mechanism: 'mechanism with [topic-abc] inline citation',
    historicalAnalog: { event: '2019 Abqaiq attack', year: '2019', outcome: 'oil +15%', caveat: 'different' },
    watchSignals: ['s1'],
    citedTopicIds: ['topic-abc', 'topic-def'],
    ...overrides,
  };
}

const FRESH_MARKETS = {
  BRENT: { value: 82.4, asOf: new Date().toISOString() },
  GOLD:  { value: 2032, asOf: new Date().toISOString() },
};

const thread = {
  threadId: 'thread-iran-israel-x1',
  entries: [
    { topicId: 'topic-abc', title: 'Iran threatens Hormuz closure', date: '2026-05-18', category: 'conflict' },
    { topicId: 'topic-def', title: 'Israel strikes Damascus IRGC depot', date: '2026-05-18', category: 'conflict' },
    { topicId: 'topic-ghi', title: 'OPEC+ schedules emergency call', date: '2026-05-19', category: 'energy' },
  ],
  category: 'conflict',
};
const fxKeys = new Set(['USD/EUR', 'USD/JPY', 'USD/CNY', 'USD/SAR', 'USD/ILS', 'USD/IRR']);

let passed = 0, failed = 0;
function assertEq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? '✓' : '✗'} ${name}` + (ok ? '' : `\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`));
  ok ? passed++ : failed++;
}
function assertTrue(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (cond ? '' : `  ${detail}`));
  cond ? passed++ : failed++;
}

console.log('\n── TEST 1: valid input passes through cleanly ──');
{
  const input = {
    hasImpact: true,
    headline: 'Iran-Israel tensions push Brent +4%',
    severity: 'severe', severityScore: 72, confidence: 'high', horizon: 'days',
    instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'moderate', rationale: 'Supply risk premium [topic-abc]', citedTopicIds: ['topic-abc', 'topic-ghi'] }],
    winners: [{ name: 'Saudi Arabia', type: 'country', why: 'Spare capacity bid' }],
    losers: [{ name: 'Japan', type: 'country', why: '95% oil import-dependent' }],
    mechanism: 'Hormuz transits ~21% of seaborne crude [topic-abc].',
    historicalAnalog: { event: '2019 Abqaiq attack', year: '2019', outcome: 'Brent +15%', caveat: 'Different scope' },
    watchSignals: ['Tanker AIS data', 'OPEC+ statement'],
    citedTopicIds: ['topic-abc', 'topic-def', 'topic-ghi'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('hasImpact:true preserved', r.hasImpact, true);
  assertEq('severity preserved', r.severity, 'severe');
  assertEq('1 instrument retained', r.instruments.length, 1);
  assertEq('instrument BRENT kept', r.instruments[0].instrumentId, 'BRENT');
  assertEq('citedTopicIds populated', r.citedTopicIds.length > 0, true);
  assertEq('winners preserved', r.winners.length, 1);
  assertTrue('headline trimmed to 160 max', r.headline.length <= 160);
}

console.log('\n── TEST 2: unknown ticker dropped ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'moderate', severityScore: 40, confidence: 'medium', horizon: 'days',
    instruments: [
      { instrumentId: 'AAPL', direction: 'down', magnitude: 'small', rationale: 'bad', citedTopicIds: ['topic-abc'] },
      { instrumentId: 'RTX', direction: 'up', magnitude: 'small', rationale: 'bad', citedTopicIds: ['topic-abc'] },
      { instrumentId: 'BRENT', direction: 'up', magnitude: 'small', rationale: 'good', citedTopicIds: ['topic-abc'] },
    ],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('only BRENT kept (AAPL+RTX dropped)', r.instruments.length, 1);
  assertEq('survivor is BRENT', r.instruments[0].instrumentId, 'BRENT');
}

console.log('\n── TEST 3: uncited claim dropped ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'moderate', severityScore: 40, confidence: 'medium', horizon: 'days',
    instruments: [
      { instrumentId: 'BRENT', direction: 'up', magnitude: 'small', rationale: 'no cite', citedTopicIds: [] },
      { instrumentId: 'GOLD', direction: 'up', magnitude: 'small', rationale: 'cite', citedTopicIds: ['topic-abc'] },
    ],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('only GOLD kept (BRENT dropped for no citation)', r.instruments.length, 1);
  assertEq('survivor is GOLD', r.instruments[0].instrumentId, 'GOLD');
}

console.log('\n── TEST 4: citation to non-thread topicId dropped ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'moderate', severityScore: 40, confidence: 'medium', horizon: 'days',
    instruments: [
      { instrumentId: 'BRENT', direction: 'up', magnitude: 'small', rationale: 'fake', citedTopicIds: ['topic-FAKE'] },
      { instrumentId: 'GOLD', direction: 'up', magnitude: 'small', rationale: 'real', citedTopicIds: ['topic-def'] },
    ],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('BRENT dropped (fake citation), GOLD kept', r.instruments.length, 1);
  assertEq('survivor is GOLD', r.instruments[0].instrumentId, 'GOLD');
}

console.log('\n── TEST 5: all instruments invalid → tombstone ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'severe', severityScore: 80, confidence: 'high', horizon: 'days',
    instruments: [{ instrumentId: 'BANANA', direction: 'up', magnitude: 'small', rationale: 'x', citedTopicIds: ['topic-abc'] }],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('returns tombstone hasImpact:false', r.hasImpact, false);
}

console.log('\n── TEST 6: FX pair from allowlist accepted ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'moderate', severityScore: 50, confidence: 'medium', horizon: 'weeks',
    instruments: [{ instrumentId: 'USD/EUR', direction: 'up', magnitude: 'moderate', rationale: 'cite', citedTopicIds: ['topic-abc'] }],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('FX pair USD/EUR accepted', r.instruments.length, 1);
  assertEq('survivor is USD/EUR', r.instruments[0].instrumentId, 'USD/EUR');
}

console.log('\n── TEST 7: zero valid citations → tombstone ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'severe', severityScore: 80, confidence: 'high', horizon: 'days',
    instruments: [],
    winners: [], losers: [], mechanism: 'x [topic-FAKE]', citedTopicIds: ['topic-FAKE'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('empty instruments → tombstone', r.hasImpact, false);
}

console.log('\n── TEST 8: invalid direction enum dropped ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'moderate', severityScore: 50, confidence: 'medium', horizon: 'days',
    instruments: [
      { instrumentId: 'BRENT', direction: 'higher', magnitude: 'small', rationale: 'bad enum', citedTopicIds: ['topic-abc'] },
      { instrumentId: 'GOLD', direction: 'up', magnitude: 'small', rationale: 'good', citedTopicIds: ['topic-abc'] },
    ],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('BRENT dropped (bad direction enum), GOLD kept', r.instruments.length, 1);
  assertEq('survivor is GOLD', r.instruments[0].instrumentId, 'GOLD');
}

console.log('\n── TEST 9: invalid magnitude normalized ──');
{
  const input = {
    hasImpact: true, headline: 'X', severity: 'moderate', severityScore: 50, confidence: 'medium', horizon: 'days',
    instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'mega-large', rationale: 'x', citedTopicIds: ['topic-abc'] }],
    winners: [], losers: [], mechanism: 'x [topic-abc]', citedTopicIds: ['topic-abc'],
  };
  const r = validateImpact(input, thread, fxKeys);
  assertEq('BRENT kept, magnitude defaulted', r.instruments.length, 1);
  assertEq('magnitude normalized to "moderate"', r.instruments[0].magnitude, 'moderate');
}

console.log('\n── TEST 10: allowlist sanity ──');
{
  assertTrue('BRENT in allowlist', INSTRUMENT_ALLOWLIST.has('BRENT'));
  assertTrue('INDA in allowlist (India proxy)', INSTRUMENT_ALLOWLIST.has('INDA'));
  assertTrue('EIS in allowlist (Israel proxy)', INSTRUMENT_ALLOWLIST.has('EIS'));
  assertTrue('NSEI NOT in allowlist (replaced)', !INSTRUMENT_ALLOWLIST.has('NSEI'));
  assertTrue('TA125 NOT in allowlist (replaced)', !INSTRUMENT_ALLOWLIST.has('TA125'));
  assertTrue('BTC in allowlist', INSTRUMENT_ALLOWLIST.has('BTC'));
  assertTrue('ETH in allowlist', INSTRUMENT_ALLOWLIST.has('ETH'));
  assertTrue('AAPL NOT in allowlist (individual stock)', !INSTRUMENT_ALLOWLIST.has('AAPL'));
  assertTrue('RTX NOT in allowlist', !INSTRUMENT_ALLOWLIST.has('RTX'));
  assertTrue('TSM NOT in allowlist', !INSTRUMENT_ALLOWLIST.has('TSM'));
}

// ─── Phase A consistency-check tests ──────────────────────────────────────────

console.log('\n── TEST 11: severity score clamped to band (severe < 70 raised to 70) ──');
{
  const r = applyConsistencyChecks(makeRecord({ severity: 'severe', severityScore: 55 }), thread, FRESH_MARKETS);
  assertEq('severityScore clamped to 70 (band min)', r.severityScore, 70);
  assertTrue('flag set', (r.qualityFlags || []).some(f => f.startsWith('severity_score_clamped')));
}

console.log('\n── TEST 12: severity score clamped (minor > 39 lowered to 39) ──');
{
  const r = applyConsistencyChecks(makeRecord({ severity: 'minor', severityScore: 70 }), thread, FRESH_MARKETS);
  assertEq('severityScore clamped to 39', r.severityScore, 39);
}

console.log('\n── TEST 13: high confidence + 1 instrument + 1 citation → downgrade to medium ──');
{
  const r = applyConsistencyChecks(makeRecord({
    confidence: 'high',
    instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'moderate', rationale: 'r', citedTopicIds: ['topic-abc'] }],
    citedTopicIds: ['topic-abc'],
  }), thread, FRESH_MARKETS);
  assertEq('confidence downgraded to medium', r.confidence, 'medium');
  assertTrue('flag set', (r.qualityFlags || []).includes('high_confidence_thin_evidence'));
}

console.log('\n── TEST 14: low confidence + large magnitude → magnitude downgraded ──');
{
  const r = applyConsistencyChecks(makeRecord({
    confidence: 'low',
    instruments: [
      { instrumentId: 'BRENT', direction: 'up', magnitude: 'large', rationale: 'r', citedTopicIds: ['topic-abc'] },
      { instrumentId: 'GOLD',  direction: 'up', magnitude: 'small', rationale: 'r', citedTopicIds: ['topic-def'] },
    ],
  }), thread, FRESH_MARKETS);
  assertEq('BRENT magnitude downgraded to moderate', r.instruments[0].magnitude, 'moderate');
  assertEq('GOLD magnitude untouched (already small)', r.instruments[1].magnitude, 'small');
  assertTrue('flag set', (r.qualityFlags || []).some(f => f.startsWith('large_magnitude_low_confidence')));
}

console.log('\n── TEST 15: mechanism without inline citation → flagged (not auto-fixed) ──');
{
  const r = applyConsistencyChecks(makeRecord({
    mechanism: 'A bare mechanism with no citation markers anywhere',
  }), thread, FRESH_MARKETS);
  assertTrue('flag set', (r.qualityFlags || []).includes('mechanism_missing_inline_citation'));
  assertEq('mechanism text unchanged', r.mechanism, 'A bare mechanism with no citation markers anywhere');
}

console.log('\n── TEST 16: implausible analog year → analog dropped ──');
{
  const r1 = applyConsistencyChecks(makeRecord({
    historicalAnalog: { event: 'Ancient Egypt event', year: '1850', outcome: 'x', caveat: 'y' },
  }), thread, FRESH_MARKETS);
  assertEq('analog dropped (year=1850)', r1.historicalAnalog, null);
  assertTrue('flag set', (r1.qualityFlags || []).some(f => f.startsWith('analog_year_implausible')));

  const r2 = applyConsistencyChecks(makeRecord({
    historicalAnalog: { event: 'Future event', year: '2199', outcome: 'x', caveat: 'y' },
  }), thread, FRESH_MARKETS);
  assertEq('analog dropped (year=2199)', r2.historicalAnalog, null);
}

console.log('\n── TEST 17: severe with thin winners → downgrade to moderate ──');
{
  const r = applyConsistencyChecks(makeRecord({
    severity: 'severe',
    severityScore: 85,
    winners: [{ name: 'A', type: 'country', why: 'x' }],  // only 1
    losers:  [{ name: 'C', type: 'country', why: 'x' }, { name: 'D', type: 'sector', why: 'y' }],
  }), thread, FRESH_MARKETS);
  assertEq('severity downgraded to moderate', r.severity, 'moderate');
  assertTrue('score reclamped to moderate band', r.severityScore <= 69);
  assertTrue('flag set', (r.qualityFlags || []).some(f => f.startsWith('thin_winners_losers')));
}

console.log('\n── TEST 18: stale market context → flagged ──');
{
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const staleMarkets = {
    BRENT: { value: 82.4, asOf: sixHoursAgo },
    GOLD:  { value: 2032, asOf: new Date().toISOString() },
  };
  const r = applyConsistencyChecks(makeRecord(), thread, staleMarkets);
  assertTrue('flag includes BRENT', (r.qualityFlags || []).some(f => f.startsWith('market_context_stale') && f.includes('BRENT')));
  assertTrue('flag excludes GOLD', !(r.qualityFlags || []).some(f => f.startsWith('market_context_stale') && f.includes('GOLD')));
}

console.log('\n── TEST 19: clean record passes through with no flags ──');
{
  const r = applyConsistencyChecks(makeRecord(), thread, FRESH_MARKETS);
  assertEq('no quality flags', r.qualityFlags, undefined);
  assertEq('severity preserved', r.severity, 'moderate');
  assertEq('confidence preserved', r.confidence, 'medium');
}

console.log('\n── TEST 20: tombstone passes through unchanged ──');
{
  const r = applyConsistencyChecks({ hasImpact: false }, thread, FRESH_MARKETS);
  assertEq('hasImpact:false preserved', r.hasImpact, false);
  assertEq('no other fields added', Object.keys(r).length, 1);
}

console.log('\n══════════════════════════════════');
console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
