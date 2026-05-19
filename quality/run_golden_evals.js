// Golden eval runner — exercises validateImpact + applyConsistencyChecks
// against frozen LLM outputs in quality/golden_evals.json.
//
// Run:
//   node quality/run_golden_evals.js
//
// What it tests: validator + downgrade pipeline regressions. Does NOT call
// the LLM (that's Layer 2 LLM-as-judge, separate). Catches schema breakage,
// downgrade-logic bugs, and consistency-check regressions.

const fs = require('fs');
const path = require('path');

const LAMBDA_SRC = path.join(__dirname, '..', 'amplify', 'backend', 'function', 'newsEconomicImpact', 'src');
const SRC = path.join(LAMBDA_SRC, 'index.js');
const FIXTURES = path.join(__dirname, 'golden_evals.json');

// Write a temp under-test module next to index.js so its require('./economic_analogs.json')
// and require('@aws-sdk/...') resolve from the Lambda's node_modules.
const src = fs.readFileSync(SRC, 'utf8');
const TEST_EXPORTS = `
module.exports = { validateImpact, applyConsistencyChecks };
`;
const tmpFile = path.join(LAMBDA_SRC, '_under_test.js');
fs.writeFileSync(tmpFile, src + '\n' + TEST_EXPORTS);
process.on('exit', () => { try { fs.unlinkSync(tmpFile); } catch {} });

const { validateImpact, applyConsistencyChecks } = require(tmpFile);
const data = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));

let passed = 0, failed = 0;
const failures = [];

function check(label, cond, detail = '') {
  if (cond) { passed++; }
  else { failed++; console.log(`    ✗ ${label}` + (detail ? `  (${detail})` : '')); }
  return cond;
}

function buildMarketContext(override) {
  if (!override) {
    return {
      BRENT: { value: 82.4, asOf: new Date().toISOString() },
      GOLD:  { value: 2032, asOf: new Date().toISOString() },
    };
  }
  // Convert _asOfMinusHours into actual ISO timestamps for stale-context tests
  const out = {};
  for (const [k, v] of Object.entries(override)) {
    const copy = { ...v };
    if (copy._asOfMinusHours != null) {
      copy.asOf = new Date(Date.now() - copy._asOfMinusHours * 3600 * 1000).toISOString();
      delete copy._asOfMinusHours;
    } else if (copy.asOf == null) {
      copy.asOf = new Date().toISOString();
    }
    out[k] = copy;
  }
  return out;
}

console.log('═══ Golden eval suite ═══');
console.log(`Fixtures: ${data.fixtures.length}\n`);

for (const f of data.fixtures) {
  console.log(`▸ ${f.id}`);
  console.log(`  ${f.purpose}`);

  const { thread, fxKeys, llmOutput, marketContextOverride } = f.input;
  const fxSet = new Set(fxKeys || []);
  const marketContext = buildMarketContext(marketContextOverride);

  // Run the pipeline
  const validated = validateImpact(llmOutput, thread, fxSet);
  const result = applyConsistencyChecks(validated, thread, marketContext);
  const expected = f.expected;

  // hasImpact must match
  check('hasImpact matches expected', result.hasImpact === expected.hasImpact,
    `got ${result.hasImpact}, expected ${expected.hasImpact}`);

  if (expected.hasImpact === false) {
    console.log(`  ${passed > 0 ? '✓' : '✗'} ${f.id}`);
    continue;
  }

  // For has-impact records, check the various fields
  if (expected.severity !== undefined) {
    check(`severity = ${expected.severity}`, result.severity === expected.severity,
      `got ${result.severity}`);
  }
  if (expected.severityScore !== undefined) {
    check(`severityScore = ${expected.severityScore}`, result.severityScore === expected.severityScore,
      `got ${result.severityScore}`);
  }
  if (expected.confidence !== undefined) {
    check(`confidence = ${expected.confidence}`, result.confidence === expected.confidence,
      `got ${result.confidence}`);
  }
  if (expected.instrumentCount !== undefined) {
    check(`instruments.length = ${expected.instrumentCount}`,
      (result.instruments || []).length === expected.instrumentCount,
      `got ${(result.instruments || []).length}`);
  }
  if (expected.survivingInstrument !== undefined) {
    const has = (result.instruments || []).some(i => i.instrumentId === expected.survivingInstrument);
    check(`${expected.survivingInstrument} survived`, has);
  }
  if (expected.droppedInstrument !== undefined) {
    const has = (result.instruments || []).some(i => i.instrumentId === expected.droppedInstrument);
    check(`${expected.droppedInstrument} was dropped`, !has);
  }
  if (expected.survivingInstruments !== undefined) {
    const ids = (result.instruments || []).map(i => i.instrumentId).sort();
    const want = expected.survivingInstruments.slice().sort();
    check(`exactly survived [${want.join(', ')}]`, JSON.stringify(ids) === JSON.stringify(want),
      `got [${ids.join(', ')}]`);
  }
  if (expected.hasAnalog !== undefined) {
    const has = result.historicalAnalog != null && result.historicalAnalog.event != null;
    check(`hasAnalog = ${expected.hasAnalog}`, has === expected.hasAnalog);
  }
  if (expected.brentMagnitude !== undefined) {
    const brent = (result.instruments || []).find(i => i.instrumentId === 'BRENT');
    check(`BRENT magnitude = ${expected.brentMagnitude}`, brent?.magnitude === expected.brentMagnitude,
      `got ${brent?.magnitude}`);
  }
  if (expected.goldMagnitude !== undefined) {
    const gold = (result.instruments || []).find(i => i.instrumentId === 'GOLD');
    check(`GOLD magnitude = ${expected.goldMagnitude}`, gold?.magnitude === expected.goldMagnitude,
      `got ${gold?.magnitude}`);
  }
  if (expected.flagIncludes !== undefined) {
    const flags = result.qualityFlags || [];
    check(`flags include "${expected.flagIncludes}"`,
      flags.some(f => f.includes(expected.flagIncludes)),
      `got flags: ${JSON.stringify(flags)}`);
  }
  if (expected.qualityFlags === null) {
    check(`no quality flags`, result.qualityFlags === undefined,
      `got flags: ${JSON.stringify(result.qualityFlags)}`);
  }
}

console.log(`\n═══ Result: ${passed} checks passed, ${failed} failed ═══`);
process.exit(failed === 0 ? 0 : 1);
