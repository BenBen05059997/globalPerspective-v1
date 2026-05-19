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
  validateImpact, snapshotMarkets, INSTRUMENT_ALLOWLIST,
  VALID_DIRECTIONS, VALID_MAGNITUDES, VALID_SEVERITIES,
};
`;
const tmpFile = path.join(LAMBDA_SRC, '_under_test.js');
fs.writeFileSync(tmpFile, src + '\n' + TEST_EXPORTS);
process.on('exit', () => { try { fs.unlinkSync(tmpFile); } catch {} });

const mod = require(tmpFile);
const { validateImpact, INSTRUMENT_ALLOWLIST } = mod;

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

console.log('\n══════════════════════════════════');
console.log(`Result: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
