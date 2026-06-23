'use strict';

// signalAdapter — pure, deterministic mapping from our internal DDB records into the
// public v1 "signal" envelope. NO AWS, NO I/O, NO clock (timestamps are passed in), so
// it unit-tests in isolation (see test-adapter.mjs). Mirrors the style of
// newsBreakingAlert/significance.js and newsRecommend/scoring.js.
//
// The envelope is the STABLE CONTRACT a paying consumer integrates against (see
// SIGNAL_API_PLAN.md §4). Internal records map IN; raw records are never exposed. Within
// v1 the envelope only changes additively.
//
// Honesty contract (mirrors the rest of the platform): we never fabricate. Unknown
// country → iso:null (not a guess); absent confidence → null (not 0.5); missing field →
// omitted, never a placeholder.

// ── Normalization: one severity scale (0-100) + one confidence scale (0-1) ──────────
// Internally severity/confidence are expressed five different ways (probability,
// severityScore, riskScore, confidence enum, sentiment). The envelope collapses them to
// two conventions so a machine never special-cases.

const CONFIDENCE_ENUM = Object.freeze({
  low: 0.3, medium: 0.6, high: 0.9, // economic_impact / signalVsNoise
  weak: 0.3, strong: 0.9,           // systems edges
});

// confidence → number in [0,1] or null. Passes a real number through (clamped).
function normConfidence(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return clamp(v, 0, 1);
  if (typeof v === 'string') {
    const k = v.trim().toLowerCase();
    if (k in CONFIDENCE_ENUM) return CONFIDENCE_ENUM[k];
  }
  return null;
}

// 0-100 → band, using the SAME calibration as COUNTRY_INTELLIGENCE.riskScore so one
// vocabulary covers every signal type.
function severityBand(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 75) return 'high';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'moderate';
  return 'low';
}

function clamp(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

// ── Entity normalization (Gap #2) ───────────────────────────────────────────────────
// Country name → ISO-3166 alpha-3. Deliberately a curated map of the countries we
// actually cover; an unknown name yields iso:null (honest) rather than a wrong guess.
// Extend as coverage grows — see SIGNAL_API_PLAN.md §9 (entity-normalization depth).
const COUNTRY_ISO = Object.freeze({
  'United States': 'USA', 'United States of America': 'USA', USA: 'USA', US: 'USA',
  China: 'CHN', Russia: 'RUS', Ukraine: 'UKR', Iran: 'IRN', Israel: 'ISR',
  'United Kingdom': 'GBR', UK: 'GBR', Germany: 'DEU', France: 'FRA', Italy: 'ITA',
  Spain: 'ESP', Japan: 'JPN', 'South Korea': 'KOR', 'North Korea': 'PRK',
  India: 'IND', Pakistan: 'PAK', Afghanistan: 'AFG', 'Saudi Arabia': 'SAU',
  'United Arab Emirates': 'ARE', UAE: 'ARE', Qatar: 'QAT', Turkey: 'TUR', Türkiye: 'TUR',
  Egypt: 'EGY', Syria: 'SYR', Iraq: 'IRQ', Lebanon: 'LBN', Yemen: 'YEM', Jordan: 'JOR',
  Palestine: 'PSE', 'Gaza': 'PSE',
  Taiwan: 'TWN', 'Hong Kong': 'HKG', Vietnam: 'VNM', Thailand: 'THA', Indonesia: 'IDN',
  Philippines: 'PHL', Malaysia: 'MYS', Singapore: 'SGP', Myanmar: 'MMR', Bangladesh: 'BGD',
  Australia: 'AUS', 'New Zealand': 'NZL',
  Canada: 'CAN', Mexico: 'MEX', Brazil: 'BRA', Argentina: 'ARG', Chile: 'CHL',
  Colombia: 'COL', Venezuela: 'VEN', Peru: 'PER', Cuba: 'CUB',
  Poland: 'POL', Netherlands: 'NLD', Belgium: 'BEL', Sweden: 'SWE', Norway: 'NOR',
  Finland: 'FIN', Denmark: 'DNK', Ireland: 'IRL', Switzerland: 'CHE', Austria: 'AUT',
  Greece: 'GRC', Portugal: 'PRT', Hungary: 'HUN', Romania: 'ROU', 'Czech Republic': 'CZE',
  Belarus: 'BLR', Georgia: 'GEO', Armenia: 'ARM', Azerbaijan: 'AZE', Kazakhstan: 'KAZ',
  'South Africa': 'ZAF', Nigeria: 'NGA', Kenya: 'KEN', Ethiopia: 'ETH', Sudan: 'SDN',
  Somalia: 'SOM', Libya: 'LBY', Algeria: 'DZA', Morocco: 'MAR', Tunisia: 'TUN',
  'Democratic Republic of the Congo': 'COD', Ghana: 'GHA', Tanzania: 'TZA', Uganda: 'UGA',
});

function toEntityCountry(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  return { name: trimmed, iso: COUNTRY_ISO[trimmed] || null };
}

// dedupe a list of {name,iso} (or instruments) by a key
function dedupeBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!x) continue;
    const k = keyFn(x);
    if (k == null || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

// ── signal_id ───────────────────────────────────────────────────────────────────────
// Deterministic + stable: same source record on the same day → same id (idempotent
// upsert, natural dedupe key). `datePart` is YYYY-MM-DD derived by the caller from the
// record's own timestamp (never the wall clock, so re-builds are stable).
function makeSignalId(type, scopeId, datePart) {
  const slug = String(scopeId || 'unknown')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `sig_${datePart}_${type}_${slug}`;
}

function isoDate(ts) {
  if (!ts) return null;
  const s = String(ts);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

// ── Envelope builder ──────────────────────────────────────────────────────────────
// Every adapter funnels through here so the contract is defined in exactly one place.
function makeEnvelope({
  type, scopeId, emittedAt, eventTime, threadId,
  headline, summary, entities, severity, confidence, direction, analysis, provenance,
}) {
  const datePart = isoDate(eventTime) || isoDate(emittedAt) || 'undated';
  const sevNum = Number.isFinite(severity) ? Math.round(clamp(severity, 0, 100)) : null;
  const env = {
    signal_id: makeSignalId(type, scopeId, datePart),
    version: '1',
    type,
    emitted_at: emittedAt || null,
    event_time: eventTime || null,
    thread_id: threadId || null,
    headline: headline || '',
    summary: summary || '',
    entities: {
      countries: dedupeBy(entities?.countries || [], (c) => c.name),
      regions: Array.from(new Set((entities?.regions || []).filter(Boolean))),
      actors: dedupeBy(entities?.actors || [], (a) => a.name),
      instruments: dedupeBy(entities?.instruments || [], (i) => i.id),
      categories: Array.from(new Set((entities?.categories || []).filter(Boolean))),
    },
    severity: sevNum,
    severity_band: severityBand(sevNum),
    confidence: confidence == null ? null : clamp(confidence, 0, 1),
    direction: direction || null,
    analysis: analysis || {},
    provenance: provenance || { sources: [], source_robustness: null, cited_topic_ids: [] },
  };
  return env;
}

function provenanceFrom(sources, citedTopicIds, calibration) {
  const list = (Array.isArray(sources) ? sources : []).map((s) => ({
    title: s.title || s.source || '',
    url: s.url || '',
    outlet: s.outlet || s.source || hostFromUrl(s.url),
  })).filter((s) => s.url || s.title);
  const robustness = list.length === 0 ? null
    : list.length === 1 ? 'single_source_unverified' : 'verified';
  const p = {
    sources: list,
    source_robustness: robustness,
    cited_topic_ids: Array.from(new Set((citedTopicIds || []).filter(Boolean))),
  };
  if (calibration) p.calibration = calibration;
  return p;
}

function hostFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// ── Per-record adapters ─────────────────────────────────────────────────────────────

// ECONOMIC_IMPACT record (ECON#THREAD#{id}/ECONOMIC_IMPACT) → economic_impact signal.
function fromEconomicImpact(rec, { emittedAt } = {}) {
  if (!rec || rec.hasImpact === false) return null; // tombstones are not signals
  const threadId = rec.scopeId || rec.threadId || rec.scope || null;
  const instruments = (rec.instruments || []).map((i) => ({
    id: i.instrumentId, direction: i.direction || null, magnitude: i.magnitude || null,
    rationale: i.rationale || '', cited_topic_ids: i.citedTopicIds || [],
  })).filter((i) => i.id);
  const winners = rec.winners || [];
  const losers = rec.losers || [];
  const countries = dedupeBy(
    [...winners, ...losers].filter((w) => w?.type === 'country').map((w) => toEntityCountry(w.name)),
    (c) => c.name,
  );
  return makeEnvelope({
    type: 'economic_impact',
    scopeId: threadId,
    emittedAt: emittedAt || rec.generatedAt || null,
    eventTime: rec.generatedAt || null,
    threadId,
    headline: rec.headline || '',
    summary: rec.mechanism ? truncate(rec.mechanism, 280) : (rec.headline || ''),
    entities: {
      countries,
      instruments: instruments.map((i) => ({ id: i.id, kind: instrumentKind(i.id) })),
      categories: ['economy'],
    },
    severity: Number.isFinite(rec.severityScore) ? rec.severityScore : null,
    confidence: normConfidence(rec.confidence),
    direction: null, // instrument-level; top-level intentionally null
    analysis: {
      instruments, winners, losers,
      mechanism: rec.mechanism || '',
      horizon: rec.horizon || null,
      historical_analog: rec.historicalAnalog || null,
      market_snapshot: rec.marketContext || {},
      watch_signals: rec.watchSignals || [],
      quality_flags: rec.qualityFlags || [],
    },
    provenance: provenanceFrom([], rec.citedTopicIds, null),
  });
}

// PredictionLog item (PRED#{id}/{date}) → forecast signal. `calibration` is the global
// track-record summary, injected by the caller (the differentiator, machine-readable).
function fromPredictionLog(item, { emittedAt, calibration, trackRecordUrl } = {}) {
  if (!item || !Array.isArray(item.scenarios)) return null;
  const scenarios = item.scenarios.map((s) => ({
    label: s.label,
    probability: typeof s.probability === 'number' ? s.probability : null,
    horizon: s.horizon || null,
    rationale: s.rationale || '',
    triggers: (s.triggers || []).map((t) => ({
      id: t.id, text: t.text, deadline: t.deadline || null,
      status: t.finalVerdict || t.status || 'pending',
      verdict_confidence: t.proposal?.confidence ?? null,
      citation: t.proposal?.citation || null,
    })),
  }));
  // top-level confidence = the "Most Likely" scenario's probability, if present
  const likely = scenarios.find((s) => /most likely/i.test(s.label || '')) || scenarios[0];
  const cal = calibration
    ? { ...calibration, ...(trackRecordUrl ? { track_record_url: trackRecordUrl } : {}) }
    : null;
  return makeEnvelope({
    type: 'forecast',
    scopeId: item.topicId,
    emittedAt: emittedAt || item.generatedAt || null,
    eventTime: item.generatedAt || null,
    threadId: item.threadId || null,
    headline: item.title || '',
    summary: likely?.rationale ? truncate(likely.rationale, 280) : (item.title || ''),
    entities: { categories: item.category ? [item.category] : [] },
    severity: null, // a forecast isn't a severity; confidence carries the weight
    confidence: likely?.probability ?? null,
    analysis: { scenarios, winners: item.winners || [], losers: item.losers || [] },
    provenance: provenanceFrom([], [], cal),
  });
}

// COUNTRY_INTELLIGENCE record (COUNTRY#{name}/COUNTRY_INTELLIGENCE) → geopolitical_risk.
function fromCountryIntelligence(rec, { emittedAt } = {}) {
  if (!rec || !rec.countryName) return null;
  const country = toEntityCountry(rec.countryName);
  return makeEnvelope({
    type: 'geopolitical_risk',
    scopeId: rec.countryName,
    emittedAt: emittedAt || rec.generatedAt || null,
    eventTime: rec.generatedAt || null,
    headline: rec.headline || '',
    summary: rec.bluf || rec.headline || '',
    entities: {
      countries: country ? [country] : [],
      actors: (rec.keyActors || []).map((a) => ({ name: a.name, role: a.role || null })),
      categories: rec.dominantCategory ? [rec.dominantCategory] : [],
    },
    severity: Number.isFinite(rec.riskScore) ? rec.riskScore : null,
    confidence: null, // riskScore is a magnitude, not a confidence
    direction: rec.trajectory || null,
    analysis: {
      bluf: rec.bluf || '',
      risk_level: rec.riskLevel || null,
      risk_score: rec.riskScore ?? null,
      trajectory: rec.trajectory || null,
      trajectory_detail: rec.trajectoryDetail || '',
      key_developments: rec.keyDevelopments || [],
      risk_signals: rec.riskSignals || [],
      key_actors: rec.keyActors || [],
      cross_thread_insight: rec.crossThreadInsight || '',
    },
    provenance: provenanceFrom(rec.groundingSources, [], null),
  });
}

// Breaking-alert proposal (GlobalPerspectiveBreakingAlerts) → breaking signal. Only
// confirmed/sent alerts are exposed (proposed/rejected stay internal).
function fromBreakingAlert(rec, { emittedAt } = {}) {
  if (!rec || (rec.status !== 'confirmed' && rec.status !== 'sent')) return null;
  return makeEnvelope({
    type: 'breaking',
    scopeId: rec.alertKey,
    emittedAt: emittedAt || rec.confirmedAt || rec.alertedAt || null,
    eventTime: rec.alertedAt || rec.cycle || null,
    threadId: rec.alertKey,
    headline: rec.title || 'Breaking story',
    summary: rec.draft?.subject || rec.title || '',
    entities: { categories: ['breaking'] },
    severity: scoreToSeverity(rec.score),
    confidence: null,
    analysis: {
      significance_score: rec.score ?? null,
      signal_breakdown: rec.signals || null,
      reasons: rec.reasons || [],
      status: rec.status,
      editor_note: rec.editorNote || null,
    },
    provenance: provenanceFrom([], [], null),
  });
}

// breaking significance score (~0-5) → 0-100 severity band, squashed at 5≈100.
function scoreToSeverity(score) {
  const s = Number(score);
  if (!Number.isFinite(s) || s <= 0) return null;
  return Math.round(clamp((s / 5) * 100, 0, 100));
}

function instrumentKind(id) {
  const s = String(id || '').toUpperCase();
  if (['BTC', 'ETH'].includes(s)) return 'crypto';
  if (['BRENT', 'WTI', 'GOLD', 'COPPER', 'NATGAS', 'SILVER'].includes(s)) return 'commodity';
  if (['DXY', 'VIX'].includes(s)) return 'index';
  if (s.startsWith('US') && s.endsWith('Y')) return 'rate';
  return 'instrument';
}

function truncate(str, n) {
  const s = String(str || '');
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

module.exports = {
  fromEconomicImpact,
  fromPredictionLog,
  fromCountryIntelligence,
  fromBreakingAlert,
  makeEnvelope,
  makeSignalId,
  // exported for tests + reuse
  _internals: {
    normConfidence, severityBand, toEntityCountry, provenanceFrom,
    scoreToSeverity, instrumentKind, COUNTRY_ISO, clamp,
  },
};
