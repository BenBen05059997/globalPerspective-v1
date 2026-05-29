#!/usr/bin/env node
// Programmatic honesty-contract checks for the "Today in the economy" briefing.
//
// Objective only — no LLM, no judgment. Exports checkBriefing(text, fixture).
// Run `node quality/briefing/assertions.js` to self-test against the fixtures
// with intentionally-good and intentionally-bad sample briefings.
//
// No npm deps.

const fs = require('fs');
const path = require('path');

// Tracked instrument tickers — mirror EconomyPage.jsx TRACKED_UNIVERSE.
const TRACKED = [
  'BRENT', 'WTI', 'GOLD', 'COPPER', 'VIX', 'DXY', 'NATGAS',
  'US10Y', 'US2Y', 'UK10Y', 'DE10Y', 'JP10Y',
  'SPX', 'NDX', 'DJI', 'FTM', 'DAX', 'N225', 'HSI', 'SSEC',
  'KS11', 'TWII', 'INDA', 'BVSP', 'MERV', 'XU100', 'EIS', 'IWM',
  'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU',
  'XLB', 'XLRE', 'XLC', 'ITA', 'SOXX', 'GDX', 'EEM', 'EFA',
  'SHY', 'EMB', 'HYG', 'DBA', 'REMX', 'BTC', 'ETH',
];
const TRACKED_SET = new Set(TRACKED);

// Friendly names the briefing may use for an instrument — MIRRORS SHORT_NAME in
// src/utils/composeEconomyBriefing.js. Lets check (d) locate an instrument in the
// prose whether it's referred to by ticker ("KS11") or name ("KOSPI"). Keep in
// sync with compose when the instrument universe changes.
const NAME_OF = {
  BRENT: 'brent', WTI: 'wti', GOLD: 'gold', COPPER: 'copper', VIX: 'vix',
  DXY: 'dollar', NATGAS: 'nat gas', US10Y: 'us 10y', US2Y: 'us 2y',
  UK10Y: 'gilt 10y', DE10Y: 'bund 10y', JP10Y: 'jgb 10y',
  SPX: 's&p 500', NDX: 'nasdaq 100', DJI: 'dow', FTM: 'ftse 100', DAX: 'dax',
  N225: 'nikkei', HSI: 'hang seng', SSEC: 'shanghai', KS11: 'kospi', TWII: 'taiwan',
  INDA: 'india', BVSP: 'bovespa', MERV: 'merval', XU100: 'bist 100', EIS: 'israel',
  IWM: 'russell 2000', BTC: 'bitcoin', ETH: 'ethereum',
};

// (e) Whitelist series to tracked instruments and drop |change| >= 25 (junk
// keys like ETH_24H_CHANGE -311). Returns { id: change } of clean moves.
function sanitizeSeries(series) {
  const out = {};
  if (!series) return out;
  for (const [id, v] of Object.entries(series)) {
    if (!TRACKED_SET.has(id)) continue;
    const change = v && typeof v.change === 'number' ? v.change : null;
    if (change == null) continue;
    if (Math.abs(change) >= 25) continue;
    out[id] = change;
  }
  return out;
}

// ─── numeric helpers ───────────────────────────────────────────────────────
// Pull numeric tokens from prose. Captures things like "1.6", "1.6%", "85%",
// "-1.6", "+3.3%". Returns absolute numeric magnitudes as strings + numbers.
function extractNumbers(text) {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map(Number);
}

// Build the whitelist of numbers that may legitimately appear in a briefing,
// derived purely from the fixture.
function buildNumberWhitelist(fixture) {
  const allowed = new Set();
  const add = (n) => {
    if (n == null || Number.isNaN(n)) return;
    allowed.add(round1(Math.abs(n)));
  };

  const disruptions = fixture.disruptions || [];
  // severity counts
  const sev = severityTally(disruptions);
  add(sev.severe); add(sev.moderate); add(sev.minor);
  add(disruptions.length);

  // topMovers: citations + consensusStrength + directions
  for (const m of (fixture.topMovers || [])) {
    add(m.citations);
    add(m.consensusStrength);
    if (m.directions) { add(m.directions.up); add(m.directions.down); add(m.directions.mixed); }
  }

  // sanitized realized series changes
  const clean = sanitizeSeries(fixture.markets && fixture.markets.series);
  for (const c of Object.values(clean)) add(c);

  // instrument levels from marketContext + markets sections
  for (const d of disruptions) {
    if (d.marketContext) {
      for (const v of Object.values(d.marketContext)) {
        if (v && typeof v.value === 'number') add(v.value);
      }
    }
  }
  // markets levels (commodities/yields/equities/crypto) if present as {value}
  const m = fixture.markets || {};
  for (const sectionKey of ['commodities', 'yields', 'equities', 'crypto']) {
    const section = m[sectionKey];
    if (section && typeof section === 'object') {
      for (const v of Object.values(section)) {
        if (v && typeof v === 'object' && typeof v.value === 'number') add(v.value);
        else if (typeof v === 'number') add(v);
      }
    }
  }
  return allowed;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function severityTally(disruptions) {
  const t = { severe: 0, moderate: 0, minor: 0 };
  for (const d of (disruptions || [])) {
    if (t[d.severity] != null) t[d.severity] += 1;
  }
  return t;
}

// A numeric token in the briefing is OK if its rounded |value| is within the
// whitelist (allowing a 1-decimal rounding tolerance, e.g. 1.61 → "1.6%").
function numberAllowed(n, whitelist) {
  const r = round1(Math.abs(n));
  if (whitelist.has(r)) return true;
  // tolerance: accept if any whitelist value rounds to the same 1-dp figure
  for (const w of whitelist) {
    if (Math.abs(w - r) < 0.06) return true;
  }
  return false;
}

// ─── checks ──────────────────────────────────────────────────────────────────
function checkBriefing(briefingText, fixture) {
  const failures = [];
  const text = briefingText || '';
  const lower = text.toLowerCase();

  // (a) No fabricated numbers. First scrub instrument tickers + friendly names —
  // several contain digits ("S&P 500", "Russell 2000", "US 10Y") that must not be
  // mistaken for data claims. split() on a string literal needs no regex escaping.
  const whitelist = buildNumberWhitelist(fixture);
  let scrubbed = text.toLowerCase();
  for (const nm of Object.values(NAME_OF)) scrubbed = scrubbed.split(nm).join(' ');
  for (const id of TRACKED) scrubbed = scrubbed.split(id.toLowerCase()).join(' ');
  for (const n of extractNumbers(scrubbed)) {
    // years (4-digit, e.g. 2026) and standalone small integers used as story
    // counts are covered by the whitelist; anything else must trace.
    if (!numberAllowed(n, whitelist)) {
      failures.push(`(a) numeric token "${n}" not derivable from fixture`);
    }
  }

  // (b) Every named story headline resolves to a real scopeId/headline.
  const disruptions = fixture.disruptions || [];
  const headlines = disruptions.map(d => (d.headline || '').toLowerCase()).filter(Boolean);
  // Find quoted/bolded story phrases: **...** or "..." segments.
  const namedStories = [];
  const boldRx = /\*\*(.+?)\*\*/g;
  let bm;
  while ((bm = boldRx.exec(text))) namedStories.push(bm[1]);
  const quoteRx = /[“"](.+?)[”"]/g;
  let qm;
  while ((qm = quoteRx.exec(text))) namedStories.push(qm[1]);
  for (const phrase of namedStories) {
    const p = phrase.toLowerCase().trim();
    // ignore short phrases (instrument names / generic emphasis), only treat
    // phrases of 4+ words as story-headline claims.
    if (p.split(/\s+/).length < 4) continue;
    const resolves = headlines.some(h => h.includes(p) || p.includes(h));
    if (!resolves) {
      failures.push(`(b) named story "${phrase}" does not resolve to a fixture headline`);
    }
  }

  // (c) Stated severity counts equal the fixture tallies.
  const tally = severityTally(disruptions);
  // patterns like "2 severe", "31 moderate", "3 minor"
  for (const sev of ['severe', 'moderate', 'minor']) {
    const rx = new RegExp(`(\\d+)\\s+${sev}`, 'gi');
    let mm;
    while ((mm = rx.exec(text))) {
      const stated = Number(mm[1]);
      if (stated !== tally[sev]) {
        failures.push(`(c) stated "${stated} ${sev}" != fixture tally ${tally[sev]}`);
      }
    }
  }
  // total story count, e.g. "36 stories". Note "N stories" is ambiguous: it can
  // mean the total disruption count OR a per-instrument citation count
  // ("Brent, 27 stories"). Only flag when the number matches neither.
  const citationCounts = new Set((fixture.topMovers || []).map(m => m.citations));
  const storyRx = /(\d+)\s+stories/gi;
  let sm;
  while ((sm = storyRx.exec(text))) {
    const stated = Number(sm[1]);
    if (stated !== disruptions.length && !citationCounts.has(stated)) {
      failures.push(`(c) stated "${stated} stories" != fixture count ${disruptions.length} (and not a citation count)`);
    }
  }

  // (d) No directional claim contradicting realized series sign, unless framed
  //     as a divergence (consensus vs realized).
  const clean = sanitizeSeries(fixture.markets && fixture.markets.series);
  const divergenceFramed = /(diverg|consensus|actual|realized|but note|on the day|while|despite|even though)/i.test(text);
  const UP = /(surg|spik|jump|ris|rall|climb|gain|high|up\b)/;
  const DOWN = /(fell|fall|drop|slump|slid|decline|sank|down\b|lower|sell-?off)/;
  for (const [id, change] of Object.entries(clean)) {
    // crude clause window: find the instrument by ticker OR friendly name, look at +/- 60 chars around it
    let idx = lower.indexOf(id.toLowerCase());
    if (idx < 0 && NAME_OF[id]) idx = lower.indexOf(NAME_OF[id]);
    if (idx < 0) continue;
    const window = lower.slice(Math.max(0, idx - 60), idx + 60);
    const claimsUp = UP.test(window);
    const claimsDown = DOWN.test(window);
    if (change < 0 && claimsUp && !claimsDown && !divergenceFramed) {
      failures.push(`(d) "${id}" claimed UP but realized change ${change} is negative (no divergence framing)`);
    }
    if (change > 0 && claimsDown && !claimsUp && !divergenceFramed) {
      failures.push(`(d) "${id}" claimed DOWN but realized change ${change} is positive (no divergence framing)`);
    }
  }

  // (e) No forecast / prediction language. The briefing reports what HAS moved,
  // never what will. Scan only the prose OUTSIDE bolded/quoted story headlines
  // (a real headline may legitimately contain "could"/"will"). Core contract —
  // survives the 2026-05-29 story-led re-anchor regardless of narrative style.
  let proseOnly = text.replace(/\*\*(.+?)\*\*/g, ' ').replace(/[“"](.+?)[”"]/g, ' ');
  const FORECAST = /\b(will|won't|could|would|should|may|might|expect(?:ed|s)?|forecast(?:ed|s)?|project(?:ed|s)?|outlook|price target|set to|poised to|likely to|going to|reverse|rebound|next week|next month|coming (?:days|weeks|months)|by year[- ]end)\b/i;
  const fc = proseOnly.match(FORECAST);
  if (fc) failures.push(`(e) forecast/prediction language "${fc[0]}" — briefing must report realized moves, not predictions`);

  return { passed: failures.length === 0, failures };
}

module.exports = { checkBriefing, sanitizeSeries, severityTally, buildNumberWhitelist };

// ─── self-test runner ──────────────────────────────────────────────────────
function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

function findRealFixture() {
  const dir = path.join(__dirname, 'fixtures');
  const f = fs.readdirSync(dir).find(n => /^real-\d{4}-\d{2}-\d{2}\.json$/.test(n));
  return f || null;
}

function runCase(label, expectPass, text, fixture) {
  const { passed, failures } = checkBriefing(text, fixture);
  const ok = passed === expectPass;
  const verdict = ok ? 'OK  ' : 'FAIL';
  console.log(`[${verdict}] ${label} — expected ${expectPass ? 'PASS' : 'fail'}, got ${passed ? 'PASS' : 'fail'}`);
  if (!passed) for (const f of failures) console.log(`         ↳ ${f}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

function main() {
  const realName = findRealFixture();
  if (!realName) {
    console.error('No real-*.json fixture found. Run capture.js first.');
    process.exit(1);
  }
  const real = loadFixture(realName);
  console.log(`Self-testing assertions against ${realName} + edge fixtures…\n`);

  // GOOD: matches the grounded target, flags divergence.
  const goodReal =
    '36 stories are repricing markets today — 2 severe, 31 moderate — dominated by an ' +
    'oil-and-safe-haven cluster: Brent (27 stories, 85% higher), Gold (91%) and VIX (88%). ' +
    'The sharpest is **Strait of Hormuz escalation threatens global oil supply chokepoint.** ' +
    'But note the divergence — while news consensus is firmly oil-higher, Brent actually fell ' +
    '1.6% on the day, and KOSPI led real gains, up 3.3%.';
  runCase('real / good grounded briefing', true, goodReal, real);

  // BAD: fabricated number (Brent $92), invented story, wrong severity, smoothed divergence.
  const badReal =
    '40 stories today — 5 severe. Brent surged to $92 on **War breaks out in fictional land.** ' +
    'Oil is clearly surging across the board.';
  runCase('real / bad fabricated briefing', false, badReal, real);

  // edge-empty: honest empty state passes; inventing content fails.
  const empty = loadFixture('edge-empty.json');
  runCase('edge-empty / honest empty state', true,
    'No economic-impact stories are repricing markets right now, and no instrument shows a tracked move. Nothing to brief today.',
    empty);
  runCase('edge-empty / invents content', false,
    '7 stories are moving markets — 2 severe. **A made-up crisis unfolds.**',
    empty);

  // edge-garbage-series: must not headline the junk ETH/BTC move.
  const garbage = loadFixture('edge-garbage-series.json');
  runCase('edge-garbage / picks legit move', true,
    'One story is in play. The biggest real move is Gold, up 0.8% on the day.',
    garbage);
  runCase('edge-garbage / headlines junk move', false,
    'The biggest real move today is Ethereum, down 311% on the day.',
    garbage);

  // edge-divergence: consensus up vs realized down must be flagged.
  const diverg = loadFixture('edge-divergence.json');
  runCase('edge-divergence / flags divergence', true,
    'News consensus sees Brent higher (88%), but note the divergence — Brent actually fell 2.4% on the day.',
    diverg);
  runCase('edge-divergence / smooths it over', false,
    'Brent is surging today as stories pile in.',
    diverg);

  // (e) forecast ban: a realized-move claim passes; a prediction fails — even
  // when every number is grounded. Story-led re-anchor (2026-05-29) guardrail.
  runCase('real / forecast language rejected', false,
    'Today’s driver: **Strait of Hormuz escalation threatens global oil supply chokepoint.** Brent could rebound next week as tensions persist.',
    real);

  // edge-missing-fields: must omit absent fields, not guess.
  const missing = loadFixture('edge-missing-fields.json');
  runCase('edge-missing / omits absent fields', true,
    'One story is repricing markets today. The sharpest is **Quiet supply note with no analog.** No tracked instrument shows a clean day-over-day move.',
    missing);
  runCase('edge-missing / invents a move', false,
    'One story today, and Brent fell 4.2% on the day.',
    missing);

  console.log('\nDone.');
}

if (require.main === module) main();
