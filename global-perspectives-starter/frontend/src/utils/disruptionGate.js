// Deterministic display gate for economic-disruption instruments.
//
// WHY this exists: the LLM-produced `instruments[]` carry two kinds of unreliable
// signal that would otherwise render as analyst-grade fact:
//   1. FX rows are labelled `USD/XXX` but the stored `direction` follows NO consistent
//      quoting convention across rows — some rows mean "the pair moved", others mean
//      "the quote currency moved". Under any single sign rule the arrow is wrong ~half
//      the time. (Verified against the live ECONOMIC_IMPACT table, 2026-06-02.)
//   2. `historicalAnalog` is rendered with a realized-move "outcome" even when the named
//      event is NOT in our curated catalog (~26% of rows), i.e. an unbacked number.
//
// This module is a PURE, deterministic gate (no LLM, no network). It either produces a
// trustworthy relabelled signal or SUPPRESSES the signal. It never invents a value.

import { findAnalogEvent } from '../data/economicAnalogs.js';

// ----------------------------------------------------------------------------- FX gate

// Common spoken names → ISO code, so we can find the "subject" currency in free text.
const NAME_TO_CODE = {
  dollar: 'USD', greenback: 'USD', usd: 'USD',
  euro: 'EUR', eur: 'EUR',
  sterling: 'GBP', pound: 'GBP', gbp: 'GBP',
  yen: 'JPY', jpy: 'JPY',
  yuan: 'CNY', renminbi: 'CNY', rmb: 'CNY', cny: 'CNY',
  loonie: 'CAD', 'canadian dollar': 'CAD', cad: 'CAD',
  franc: 'CHF', 'swiss franc': 'CHF', chf: 'CHF',
  rupiah: 'IDR', idr: 'IDR',
  rupee: 'INR', inr: 'INR',
  real: 'BRL', brl: 'BRL',
  peso: 'MXN', mxn: 'MXN',
  shekel: 'ILS', ils: 'ILS',
  ringgit: 'MYR', myr: 'MYR',
  won: 'KRW', krw: 'KRW',
  rand: 'ZAR', zar: 'ZAR',
  lira: 'TRY', try: 'TRY',
  ruble: 'RUB', rouble: 'RUB', rub: 'RUB',
  'australian dollar': 'AUD', aussie: 'AUD', aud: 'AUD',
};

// Polarity verbs. Distance to the subject-currency mention decides which one wins.
const DOWN_RX = /\b(weaken\w*|weak\b|pressur\w*|weigh\w*\s+on|weigh\w*|depreciat\w*|slump\w*|slid\w*|declin\w*|fall\w*|drop\w*|sell-?off|soften\w*|dampen\w*|undermin\w*|erod\w*|tumbl\w*|plung\w*|sink\w*|lower\b)\b/gi;
const UP_RX = /\b(strengthen\w*|support\w*|rall\w*|gain\w*|firm\w*|appreciat\w*|boost\w*|ris\w*|inflow\w*|flows?\s+into|climb\w*|surg\w*|bolster\w*|advanc\w*|soar\w*)\b/gi;

export function isFxPair(instrumentId) {
  return /^[A-Z]{3}\/[A-Z]{3}$/.test(String(instrumentId || '').trim());
}

// Find the character index where `code` (or one of its spoken names) is mentioned.
// Returns the smallest index found, or -1.
function mentionIndex(text, code) {
  const lower = text.toLowerCase();
  let best = -1;
  // ISO code as a whole word
  const codeRx = new RegExp(`\\b${code.toLowerCase()}\\b`, 'g');
  let m;
  while ((m = codeRx.exec(lower))) { best = best === -1 ? m.index : Math.min(best, m.index); }
  // spoken names mapping to this code
  for (const [name, c] of Object.entries(NAME_TO_CODE)) {
    if (c !== code) continue;
    let idx = lower.indexOf(name);
    while (idx !== -1) { best = best === -1 ? idx : Math.min(best, idx); idx = lower.indexOf(name, idx + 1); }
  }
  return best;
}

// Nearest polarity verb to a given anchor index. Returns 'up' | 'down' | null.
function nearestPolarity(text, anchor) {
  if (anchor < 0) return null;
  let bestDir = null, bestDist = Infinity;
  const consider = (rx, dir) => {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const d = Math.abs(m.index - anchor);
      if (d < bestDist) { bestDist = d; bestDir = dir; }
    }
  };
  consider(DOWN_RX, 'down');
  consider(UP_RX, 'up');
  return bestDir;
}

// Gate a single FX instrument. Returns:
//   { fx:true, label, direction:'up'|'down'|null, suppressed:bool, reason }
// `label` is relabelled to the FOREIGN currency code (e.g. 'CAD') because the raw
// `USD/XXX` pair label + stored direction are not trustworthy. `direction` is that
// foreign currency's move derived from the rationale; null/suppressed when undetectable.
export function gateFxInstrument(instrument) {
  const id = String(instrument?.instrumentId || '').trim();
  const foreign = id.split('/')[1];
  const text = String(instrument?.rationale || '');
  const label = foreign || id;

  if (!text.trim()) {
    return { fx: true, label, direction: null, suppressed: true, reason: 'no rationale text' };
  }

  // Subject = the foreign currency if it (or its name) is named in the rationale,
  // else the dollar if named, else undetectable.
  const fIdx = mentionIndex(text, foreign);
  const uIdx = mentionIndex(text, 'USD');

  let subject, anchor;
  if (fIdx >= 0) { subject = foreign; anchor = fIdx; }
  else if (uIdx >= 0) { subject = 'USD'; anchor = uIdx; }
  else {
    return { fx: true, label, direction: null, suppressed: true, reason: 'no currency named in rationale' };
  }

  let dir = nearestPolarity(text, anchor);
  if (!dir) {
    return { fx: true, label, direction: null, suppressed: true, reason: 'no directional verb near subject' };
  }
  // If the verb described the dollar, invert to express the foreign currency's move.
  if (subject === 'USD') dir = dir === 'up' ? 'down' : 'up';

  return { fx: true, label, direction: dir, suppressed: false, reason: `derived from rationale (subject ${subject})` };
}

// ------------------------------------------------------------------------- analog gate

// Gate a historicalAnalog block. The realized-move "outcome" must only render when the
// named event resolves against the curated catalog. Returns:
//   { backed:bool, event:catalogEvent|null }
export function gateAnalog(historicalAnalog) {
  const name = historicalAnalog?.event;
  const year = historicalAnalog?.year;
  if (!name) return { backed: false, event: null };
  const event = findAnalogEvent(name, year);
  return { backed: !!event, event: event || null };
}

// --------------------------------------------------------------------- magnitude label

// `magnitude` is a qualitative bucket, never a quantified number. Expose a boolean so
// the UI can label it as a qualitative estimate rather than implying a measured size.
const MAG_BUCKETS = new Set(['small', 'moderate', 'large']);
export function isQualitativeMagnitude(magnitude) {
  return MAG_BUCKETS.has(String(magnitude || '').toLowerCase());
}

// ----------------------------------------------------------------- convenience wrapper

// Gate any instrument: FX rows go through the FX gate; non-FX rows pass their stored
// direction through unchanged (those instrument ids are unambiguous tickers, e.g. BRENT,
// US10Y, GOLD). Always returns a normalized { label, direction, suppressed, fx }.
export function gateInstrument(instrument) {
  const id = String(instrument?.instrumentId || '').trim();
  if (isFxPair(id)) return gateFxInstrument(instrument);
  const dir = instrument?.direction;
  const norm = dir === 'up' || dir === 'down' ? dir : null;
  return {
    fx: false,
    label: id,
    direction: norm,
    suppressed: norm === null,
    reason: norm ? 'ticker direction' : 'no/!mixed direction',
  };
}
