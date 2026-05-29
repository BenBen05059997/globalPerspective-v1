// composeEconomyBriefing — deterministic "Today in the economy" lead briefing.
//
// Pure function over the three data sources the /economy page already loads
// (topMovers, disruptions, markets). NO LLM, NO fabrication: every number it
// emits traces to a real input field. It is the Phase-1 briefing and the test
// oracle for any future Phase-2 LLM briefing.
//
// Honesty contract (enforced by quality/briefing/assertions.js):
//   - no number absent from the input
//   - every named story is a real headline
//   - severity counts match the tallies
//   - CONSENSUS DIRECTION (what stories expect) is kept separate from the
//     REALIZED MOVE (actual day-over-day %); divergence is flagged, not smoothed
//   - the markets series is sanitized (tracked instruments, |change| < 25) before
//     any "biggest move" pick, so junk like ETH_24H_CHANGE -311% can't surface
//
// NOTE: SHORT_NAME here is mirrored by NAME_TO_ID in assertions.js so the
// directional check can resolve the friendly names this briefing uses. Keep the
// two in sync when the instrument universe changes.

const SHORT_NAME = {
  BRENT: 'Brent', WTI: 'WTI', GOLD: 'Gold', COPPER: 'Copper', VIX: 'VIX',
  DXY: 'the Dollar', NATGAS: 'Nat gas', US10Y: 'US 10Y', US2Y: 'US 2Y',
  UK10Y: 'Gilt 10Y', DE10Y: 'Bund 10Y', JP10Y: 'JGB 10Y',
  SPX: 'S&P 500', NDX: 'Nasdaq 100', DJI: 'the Dow', FTM: 'FTSE 100', DAX: 'DAX',
  N225: 'Nikkei', HSI: 'Hang Seng', SSEC: 'Shanghai', KS11: 'KOSPI', TWII: 'Taiwan',
  INDA: 'India', BVSP: 'Bovespa', MERV: 'Merval', XU100: 'BIST 100', EIS: 'Israel',
  IWM: 'Russell 2000', XLE: 'Energy', XLF: 'Financials', XLK: 'Tech', XLV: 'Health Care',
  XLI: 'Industrials', XLY: 'Cons. Disc.', XLP: 'Cons. Staples', XLU: 'Utilities',
  XLB: 'Materials', XLRE: 'Real Estate', XLC: 'Comm. Svcs', ITA: 'Defense', SOXX: 'Semis',
  GDX: 'Gold miners', EEM: 'EM equities', EFA: 'Developed ex-US', SHY: 'Short Treasuries',
  EMB: 'EM bonds', HYG: 'High yield', DBA: 'Agriculture', REMX: 'Rare earths',
  BTC: 'Bitcoin', ETH: 'Ethereum',
};
const TRACKED = new Set(Object.keys(SHORT_NAME));

export function nameFor(id) { return SHORT_NAME[id] || id; }

// Whitelist series to tracked instruments and drop |change| >= 25 (junk keys
// like ETH_24H_CHANGE -311%). Returns { id: change } of clean day-over-day moves.
export function sanitizeSeries(series) {
  const out = {};
  if (!series) return out;
  for (const [id, v] of Object.entries(series)) {
    if (!TRACKED.has(id)) continue;
    const c = v && typeof v.change === 'number' ? v.change : null;
    if (c == null || Number.isNaN(c)) continue;
    if (Math.abs(c) >= 25) continue;
    out[id] = c;
  }
  return out;
}

const round1 = (n) => Math.round(n * 10) / 10;
const fmtPct = (n) => `${round1(Math.abs(n))}%`;
const dirWord = (consensus) => (consensus === 'up' ? 'higher' : consensus === 'down' ? 'lower' : 'mixed');

function joinList(arr) {
  if (arr.length <= 1) return arr.join('');
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
}

const SEV_RANK = { severe: 3, moderate: 2, minor: 1 };

// Returns { empty, text, sharpest, divergence, tally, cluster } — `text` is the
// plain-text briefing (used for the honesty assertions + aria-label); the page
// renders the structured fields with the sharpest headline as a link.
export function composeBriefing({ topMovers = [], disruptions = [], markets = null } = {}) {
  const N = Array.isArray(disruptions) ? disruptions.length : 0;
  const movers = Array.isArray(topMovers) ? topMovers : [];
  const clean = sanitizeSeries(markets && markets.series);

  if (N === 0 && movers.length === 0) {
    return {
      empty: true,
      text: 'No economic-impact stories are repricing markets right now, and no instrument shows a tracked move. Nothing to brief today.',
      sharpest: null, divergence: null, tally: { severe: 0, moderate: 0, minor: 0 }, cluster: [],
    };
  }

  const tally = { severe: 0, moderate: 0, minor: 0 };
  for (const d of disruptions) if (tally[d.severity] != null) tally[d.severity]++;

  // S1 — shape
  const sevParts = [];
  if (tally.severe) sevParts.push(`${tally.severe} severe`);
  if (tally.moderate) sevParts.push(`${tally.moderate} moderate`);
  if (tally.minor) sevParts.push(`${tally.minor} minor`);
  let s1 = `${N} ${N === 1 ? 'story' : 'stories'} ${N === 1 ? 'is' : 'are'} repricing markets today`;
  if (sevParts.length) s1 += ` — ${joinList(sevParts)}`;
  s1 += '.';

  // S1b — most-cited cluster
  let clusterText = '';
  const cluster = movers.slice(0, 3);
  if (cluster.length) {
    const parts = cluster.map((m, i) => {
      const name = nameFor(m.instrumentId);
      const dw = dirWord(m.consensus);
      if (i === 0) return `${name} (${m.citations} ${m.citations === 1 ? 'story' : 'stories'}, ${m.consensusStrength}% ${dw})`;
      return `${name} (${m.consensusStrength}% ${dw})`;
    });
    clusterText = ` The most-cited: ${joinList(parts)}.`;
  }

  // S2 — sharpest story (highest severity, first in feed order). Never headline a
  // record the quality judge flagged (is_low_quality) unless nothing else exists.
  const pickSharpest = (pool) => {
    let best = null;
    for (const d of pool) {
      if (!d.headline) continue;
      if (!best || (SEV_RANK[d.severity] || 0) > (SEV_RANK[best.severity] || 0)) best = d;
    }
    return best;
  };
  const sharpest = pickSharpest(disruptions.filter((d) => !d.is_low_quality)) || pickSharpest(disruptions);
  const s2 = sharpest ? ` The sharpest is **${sharpest.headline.replace(/\.+$/, '')}.**` : '';

  // S3 — divergence (a top mover whose consensus opposes its realized move) or biggest real move
  let divergence = null;
  for (const m of movers) {
    const c = clean[m.instrumentId];
    if (c == null) continue;
    if (m.consensus === 'up' && c < 0) { divergence = { id: m.instrumentId, consensus: 'up', change: c }; break; }
    if (m.consensus === 'down' && c > 0) { divergence = { id: m.instrumentId, consensus: 'down', change: c }; break; }
  }
  let gainer = null, biggest = null;
  for (const [id, c] of Object.entries(clean)) {
    if (c > 0 && (!gainer || c > gainer.change)) gainer = { id, change: c };
    if (!biggest || Math.abs(c) > Math.abs(biggest.change)) biggest = { id, change: c };
  }

  let s3;
  if (divergence) {
    const fell = divergence.change < 0;
    s3 = ` But note the divergence — news consensus sees ${nameFor(divergence.id)} ${divergence.consensus === 'up' ? 'higher' : 'lower'}, yet it actually ${fell ? 'fell' : 'rose'} ${fmtPct(divergence.change)} on the day`;
    if (gainer && gainer.id !== divergence.id) s3 += `, while ${nameFor(gainer.id)} led real gains, up ${fmtPct(gainer.change)}`;
    s3 += '.';
  } else if (biggest) {
    s3 = ` The biggest real move is ${nameFor(biggest.id)}, ${biggest.change > 0 ? 'up' : 'down'} ${fmtPct(biggest.change)} on the day.`;
  } else {
    s3 = ' No tracked instrument shows a clean day-over-day move.';
  }

  return { empty: false, text: (s1 + clusterText + s2 + s3).trim(), sharpest, divergence, tally, cluster };
}

// Per-instrument "What's priced in" synthesis — the cross-story line for the
// expanded leaderboard drawer (decided by the 2026-05-29 SPT debate: instrument-
// level synthesis, NOT story-level SPT, NOT a forecast). Pure + deterministic:
// every number traces to the mover's own counts; the analog clause is a verbatim
// realized past move from the catalog (never a forecast). Returns { text } or null.
//   mover    — a useTopMovers row: { instrumentId, citations, directions:{up,down,mixed}, consensus, consensusStrength }
//   magnitude — the modal magnitude string (small|moderate|large) or null
//   stories  — storiesForInstrument(id) rows; used only to surface one real analog realized-move
export function composeInstrumentWhy({ mover, magnitude = null, stories = [] } = {}) {
  if (!mover || !mover.instrumentId) return null;
  const name = nameFor(mover.instrumentId);
  const d = mover.directions || {};
  const up = d.up || 0, down = d.down || 0, mixed = d.mixed || 0;
  const cites = typeof mover.citations === 'number' ? mover.citations : (up + down + mixed);
  if (cites <= 0) return null;

  const splits = [];
  if (up) splits.push(`${up} see it higher`);
  if (down) splits.push(`${down} lower`);
  if (mixed) splits.push(`${mixed} mixed`);

  let text = `What's priced in: ${cites} ${cites === 1 ? 'story cites' : 'stories cite'} ${name}`;
  if (splits.length) text += ` — ${joinList(splits)}`;
  if (typeof mover.consensusStrength === 'number' && mover.consensus) {
    text += ` (${mover.consensusStrength}% lean ${dirWord(mover.consensus)})`;
  }
  text += '.';
  if (magnitude) text += ` Typical magnitude: ${magnitude}.`;

  // One real analog: first NON-flagged driving story with a catalog realized-move for this instrument.
  const withAnalog = (stories || []).find((s) => s.analogMove && s.analog && s.analog.event && !s.is_low_quality);
  if (withAnalog) {
    const yr = withAnalog.analog.year ? ` (${withAnalog.analog.year})` : '';
    text += ` Closest analog: ${withAnalog.analog.event}${yr} moved ${name} ${withAnalog.analogMove} then — history, not a forecast.`;
  }
  return { text };
}
