// Unit tests for newsEconomicQuality — Layer 2 (LLM-as-judge).
//
// Run from anywhere:
//   node amplify/backend/function/newsEconomicQuality/test/judge.test.js
//
// Tests validateJudgment + stripCodeFence + buildJudgePrompt without hitting
// the network or AWS. Loads the real Lambda source via a temp _under_test.js
// stub so node_modules resolve correctly.

const fs = require('fs');
const path = require('path');

const LAMBDA_SRC = path.join(__dirname, '..', 'src');
const SRC = path.join(LAMBDA_SRC, 'index.js');

const src = fs.readFileSync(SRC, 'utf8');
const TEST_EXPORTS = `
module.exports = {
  validateJudgment, stripCodeFence, buildJudgePrompt, QUALITY_AXES, LOW_QUALITY_THRESHOLD,
};
`;
const tmpFile = path.join(LAMBDA_SRC, '_under_test.js');
fs.writeFileSync(tmpFile, src + '\n' + TEST_EXPORTS);
process.on('exit', () => { try { fs.unlinkSync(tmpFile); } catch {} });

const { validateJudgment, stripCodeFence, buildJudgePrompt, QUALITY_AXES, LOW_QUALITY_THRESHOLD } = require(tmpFile);

let passed = 0, failed = 0;
function ok(label, cond, detail = '') {
  if (cond) { passed++; }
  else { failed++; console.log(`  ✗ ${label}` + (detail ? ` — ${detail}` : '')); }
}

// ─── stripCodeFence ───
console.log('▸ stripCodeFence');
ok('strips ```json fence', stripCodeFence('```json\n{"a":1}\n```') === '{"a":1}');
ok('strips ``` fence (no lang)', stripCodeFence('```\n{"a":1}\n```') === '{"a":1}');
ok('passes through plain JSON', stripCodeFence('{"a":1}') === '{"a":1}');
ok('non-string passes through', stripCodeFence(null) === null);

// ─── validateJudgment: happy path ───
console.log('▸ validateJudgment — happy path');
const good = validateJudgment({
  scores: { coherence: 4, citation_fidelity: 5, analog_match: 3, severity_calibration: 4, no_bs: 4 },
  reasons: { analog_match: 'Closer analog exists.' },
});
ok('returns object', good !== null);
ok('all 5 axes present', good && QUALITY_AXES.every(a => typeof good.scores[a] === 'number'));
ok('reason preserved for analog_match', good?.reasons?.analog_match === 'Closer analog exists.');
ok('coherence = 4', good?.scores.coherence === 4);

// ─── validateJudgment: rejects missing axis ───
console.log('▸ validateJudgment — rejects malformed');
ok('null input → null', validateJudgment(null) === null);
ok('missing axis → null', validateJudgment({
  scores: { coherence: 4, citation_fidelity: 5, analog_match: 3, severity_calibration: 4 },
}) === null);
ok('out-of-range high → null', validateJudgment({
  scores: { coherence: 4, citation_fidelity: 5, analog_match: 3, severity_calibration: 4, no_bs: 6 },
}) === null);
ok('out-of-range low → null', validateJudgment({
  scores: { coherence: 0, citation_fidelity: 5, analog_match: 3, severity_calibration: 4, no_bs: 4 },
}) === null);
ok('non-numeric → null', validateJudgment({
  scores: { coherence: 'good', citation_fidelity: 5, analog_match: 3, severity_calibration: 4, no_bs: 4 },
}) === null);

// ─── validateJudgment: coerces string ints, drops unknown reasons ───
console.log('▸ validateJudgment — coercion + reason filtering');
const coerced = validateJudgment({
  scores: { coherence: '4', citation_fidelity: '5', analog_match: '3', severity_calibration: '4', no_bs: '2' },
  reasons: { no_bs: 'Mechanism is hand-wavy.', unknown_axis: 'should be dropped', coherence: 42 },
});
ok('string "4" → 4', coerced?.scores.coherence === 4);
ok('no_bs reason kept', coerced?.reasons?.no_bs === 'Mechanism is hand-wavy.');
ok('unknown axis reason dropped', coerced && !('unknown_axis' in coerced.reasons));
ok('non-string reason dropped', coerced && !('coherence' in coerced.reasons));

// ─── validateJudgment: clips reasons to 300 chars ───
console.log('▸ validateJudgment — reason clipping');
const longReason = 'x'.repeat(500);
const clipped = validateJudgment({
  scores: { coherence: 3, citation_fidelity: 3, analog_match: 3, severity_calibration: 3, no_bs: 3 },
  reasons: { coherence: longReason },
});
ok('reason clipped to 300', clipped?.reasons?.coherence?.length === 300);

// ─── LOW_QUALITY_THRESHOLD wiring ───
console.log('▸ LOW_QUALITY_THRESHOLD');
ok('threshold = 2', LOW_QUALITY_THRESHOLD === 2);
ok('QUALITY_AXES has 5 entries', QUALITY_AXES.length === 5);

// ─── buildJudgePrompt: structural sanity ───
console.log('▸ buildJudgePrompt — structural sanity');
const fakeRecord = {
  headline: 'Test disruption',
  severity: 'moderate',
  severityScore: 50,
  confidence: 'medium',
  horizon: 'days',
  instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'moderate', rationale: 'Supply risk' }],
  winners: [{ name: 'Saudi Arabia', type: 'country', why: 'Higher oil revenue' }],
  losers: [{ name: 'India', type: 'country', why: 'Import bill' }],
  mechanism: 'Strait of Hormuz risk lifts oil [topic-abc].',
  historicalAnalog: { event: 'Abqaiq attack', year: 2019 },
  citedTopicIds: ['topic-abc', 'topic-def'],
};
const fakeThread = { threadTitle: 'Iran tensions', storyArc: 'Escalating.', trajectory: 'Rising.' };
const fakeSummaries = { 'topic-abc': 'Iran threatens strait closure.' };
const prompt = buildJudgePrompt(fakeRecord, fakeThread, fakeSummaries);
ok('prompt includes thread title', prompt.includes('Iran tensions'));
ok('prompt includes record headline', prompt.includes('Test disruption'));
ok('prompt embeds cited topic id', prompt.includes('topic-abc'));
ok('prompt embeds topic summary', prompt.includes('Iran threatens strait closure'));
ok('prompt asks for JSON only', prompt.includes('Return ONLY this JSON'));
ok('prompt mentions all 5 axes', QUALITY_AXES.every(a => prompt.includes(a)));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
