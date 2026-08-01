// Standalone unit tests for the pure signal adapter + apiKeys helpers.
// No AWS, no network — run with: node test-adapter.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const adapter = require('./signalAdapter.js');
const { hashKey, mintKey, extractKey, verifyKey } = require('./apiKeys.js');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}
const { normConfidence, severityBand, toEntityCountry, scoreToSeverity, instrumentKind } = adapter._internals;

console.log('normalization');
ok('confidence enum high → 0.9', normConfidence('high') === 0.9);
ok('confidence enum low → 0.3', normConfidence('low') === 0.3);
ok('confidence number passthrough+clamp', normConfidence(0.42) === 0.42 && normConfidence(5) === 1);
ok('confidence unknown → null', normConfidence('banana') === null && normConfidence(undefined) === null);
ok('severity band calibration', severityBand(10) === 'low' && severityBand(30) === 'moderate' && severityBand(60) === 'elevated' && severityBand(90) === 'high');
ok('severity band null on NaN', severityBand(NaN) === null);

console.log('entity normalization');
ok('known country → iso', toEntityCountry('Iran').iso === 'IRN');
ok('alias country → iso', toEntityCountry('UK').iso === 'GBR');
ok('unknown country → iso null (honest)', toEntityCountry('Wakanda').iso === null);
ok('null name → null', toEntityCountry(null) === null);

console.log('scoreToSeverity (breaking)');
ok('score 5 → ~100', scoreToSeverity(5) === 100);
ok('score 0/negative → null', scoreToSeverity(0) === null && scoreToSeverity(-1) === null);
ok('instrumentKind', instrumentKind('BTC') === 'crypto' && instrumentKind('BRENT') === 'commodity');

console.log('fromEconomicImpact');
const econ = adapter.fromEconomicImpact({
  scopeId: 'thread-oil-a1', hasImpact: true, headline: 'Oil spikes on strait threat',
  severity: 'severe', severityScore: 82, confidence: 'high', horizon: 'days',
  mechanism: 'Closure risk to the Strait of Hormuz lifts crude [topic-x].',
  instruments: [{ instrumentId: 'BRENT', direction: 'up', magnitude: 'large', rationale: 'supply risk [topic-x]', citedTopicIds: ['topic-x'] }],
  winners: [{ name: 'Saudi Arabia', type: 'country', why: 'higher export revenue' }],
  losers: [{ name: 'India', type: 'country', why: 'import bill' }],
  marketContext: { BRENT: { value: 82.4, asOf: '2026-06-23T00:00:00Z' } },
  citedTopicIds: ['topic-x'], generatedAt: '2026-06-23T08:00:00Z',
}, { emittedAt: '2026-06-23T09:00:00Z' });
ok('econ type', econ.type === 'economic_impact');
ok('econ severity passthrough + band', econ.severity === 82 && econ.severity_band === 'high');
ok('econ confidence normalized', econ.confidence === 0.9);
ok('econ instruments entity has kind', econ.entities.instruments[0].id === 'BRENT' && econ.entities.instruments[0].kind === 'commodity');
ok('econ winners/losers → country entities', econ.entities.countries.some(c => c.iso === 'SAU') && econ.entities.countries.some(c => c.iso === 'IND'));
ok('econ signal_id deterministic + dated', econ.signal_id === 'sig_2026-06-23_economic_impact_thread-oil-a1');
ok('econ market snapshot carried', econ.analysis.market_snapshot.BRENT.value === 82.4);
ok('econ tombstone → null', adapter.fromEconomicImpact({ hasImpact: false }) === null);

console.log('fromPredictionLog (calibration stamp = the differentiator)');
const fc = adapter.fromPredictionLog({
  topicId: 'topic-vote-1', title: 'Referendum nears', category: 'politics', generatedAt: '2026-06-22T12:00:00Z',
  scenarios: [{ label: 'Most Likely', probability: 0.6, horizon: '2-4 weeks', rationale: 'Polls tighten.',
    triggers: [{ id: '0-0', text: 'Vote held by July 15', deadline: '2026-07-15', status: 'pending', proposal: { confidence: 0.7, citation: 'reuters.com' } }] }],
  winners: ['incumbent'], losers: ['opposition'],
}, { emittedAt: '2026-06-23T09:00:00Z', calibration: { model_brier_score: 0.18, sample_size: 142 }, trackRecordUrl: 'https://globalperspective.net/track-record' });
ok('forecast type', fc.type === 'forecast');
ok('forecast confidence = likely probability', fc.confidence === 0.6);
ok('forecast carries calibration in provenance', fc.provenance.calibration.model_brier_score === 0.18 && fc.provenance.calibration.track_record_url.includes('/track-record'));
ok('forecast trigger normalized (status/confidence/citation)', fc.analysis.scenarios[0].triggers[0].status === 'pending' && fc.analysis.scenarios[0].triggers[0].verdict_confidence === 0.7);
ok('forecast severity null (not a magnitude)', fc.severity === null);

console.log('fromCountryIntelligence');
const ci = adapter.fromCountryIntelligence({
  countryName: 'Ukraine', headline: 'Front lines hold under pressure', bluf: 'Stalemate persists.',
  riskLevel: 'high', riskScore: 78, trajectory: 'escalating', dominantCategory: 'conflict',
  keyActors: [{ name: 'General Staff', role: 'military', threadCount: 4 }],
  groundingSources: [{ title: 'AP report', url: 'https://apnews.com/x' }],
  generatedAt: '2026-06-23T07:00:00Z',
}, { emittedAt: '2026-06-23T09:00:00Z' });
ok('country type + iso', ci.type === 'geopolitical_risk' && ci.entities.countries[0].iso === 'UKR');
ok('country severity from riskScore', ci.severity === 78 && ci.severity_band === 'high');
ok('country direction = trajectory', ci.direction === 'escalating');
ok('country single source → unverified robustness', ci.provenance.source_robustness === 'single_source_unverified');

console.log('fromBreakingAlert');
ok('proposed alert is not a signal', adapter.fromBreakingAlert({ alertKey: 't1', status: 'proposed' }) === null);
const ba = adapter.fromBreakingAlert({ alertKey: 'thread-quake', status: 'confirmed', title: 'Major quake', score: 3.5, reasons: ['country risk 70/100'], confirmedAt: '2026-06-23T06:00:00Z', alertedAt: '2026-06-23T05:30:00Z' }, { emittedAt: '2026-06-23T09:00:00Z' });
ok('breaking type + severity from score', ba.type === 'breaking' && ba.severity === 70);
ok('breaking carries reasons', ba.analysis.reasons[0].includes('country risk'));

console.log('envelope invariants');
ok('version is 1', econ.version === '1' && fc.version === '1');
ok('confidence always present (number|null)', [econ, fc, ci, ba].every(s => s.confidence === null || typeof s.confidence === 'number'));
ok('entities always shaped', [econ, fc, ci, ba].every(s => Array.isArray(s.entities.countries) && Array.isArray(s.entities.categories)));

console.log('apiKeys');
ok('hashKey deterministic', hashKey('gpsk_abc') === hashKey('gpsk_abc') && hashKey('a') !== hashKey('b'));
const minted = mintKey();
ok('mintKey shape + hash matches', minted.raw.startsWith('gpsk_') && hashKey(minted.raw) === minted.keyHash);
ok('extractKey from bearer', extractKey({ Authorization: 'Bearer gpsk_xyz' }) === 'gpsk_xyz');
ok('extractKey from x-api-key', extractKey({ 'x-api-key': 'gpsk_q' }) === 'gpsk_q');
ok('extractKey none → null', extractKey({}) === null);
const fakeGet = async (h) => (h === hashKey('gpsk_live') ? { keyHash: h, tier: 'paid', active: true, rateLimitPerMin: 120 } : null);
ok('verifyKey rejects non-prefixed', await verifyKey('nope', fakeGet) === null);
ok('verifyKey rejects unknown', await verifyKey('gpsk_unknown', fakeGet) === null);
const vk = await verifyKey('gpsk_live', fakeGet);
ok('verifyKey accepts active paid key', vk && vk.tier === 'paid' && vk.rateLimitPerMin === 120);
ok('verifyKey rejects inactive', await verifyKey('gpsk_off', async () => ({ active: false })) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
