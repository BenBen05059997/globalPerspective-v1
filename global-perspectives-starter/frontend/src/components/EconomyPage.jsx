// EconomyPage — the markets-meets-news command center.
// The aggregate, instrument-first view of what global news is repricing right now.
// Per-story detail lives on the thread Economy tab (/weekly/thread/:id?tab=economy);
// this page owns the cross-story picture the thread tab structurally can't show.
//
// Layout mirrors the editorial mockup: a masthead band, then a 3-col shell —
// left rail (filters) / center (instrument leaderboard + dormant drawer + by-story bridge)
// / right rail (live Market Context). EditorialShell intentionally NOT used so the
// masthead-band + sticky rails match the mockup exactly.

import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import { useTopMovers } from '../hooks/useTopMovers';
import { useMarketsGlobal } from '../hooks/useMarketsGlobal';
import { useMarketsHistory } from '../hooks/useMarketsHistory';
import Sparkline from './atoms/Sparkline';
import { realizedMoveFor } from '../data/economicAnalogs';
import { composeBriefing, composeInstrumentWhy } from '../utils/composeEconomyBriefing';
import QualityFlag from './atoms/QualityFlag';
import './EconomyPage.css';

const SEVERITY_ORDER = ['severe', 'moderate', 'minor'];
const SEVERITY_LABEL = { severe: 'Severe', moderate: 'Moderate', minor: 'Minor' };
const HORIZONS = ['immediate', 'days', 'weeks', 'months'];
const MAG_RANK = { large: 3, moderate: 2, small: 1 };

// markets_global exposes commodities + yields + equities + crypto.
// Map a disruption instrumentId → its live level so the qualitative call sits next to the real number.
const COMMODITY_KEY = { BRENT: 'brent', WTI: 'wti', GOLD: 'gold', COPPER: 'copper', DXY: 'dxy', VIX: 'vix', NATGAS: 'natgas' };

// The priced tracked universe — used to compute the "not cited today" dormant drawer.
// [ticker, displayName]
const TRACKED_UNIVERSE = [
  ['BRENT', 'Brent crude'], ['WTI', 'WTI crude'], ['GOLD', 'Gold spot'], ['COPPER', 'Copper'],
  ['VIX', 'Volatility (VIX)'], ['DXY', 'Dollar index'], ['NATGAS', 'Natural gas'],
  ['US10Y', 'US 10yr yield'], ['US2Y', 'US 2yr yield'], ['UK10Y', 'Gilt 10yr yield'],
  ['DE10Y', 'Bund 10yr yield'], ['JP10Y', 'JGB 10yr yield'],
  ['SPX', 'S&P 500'], ['NDX', 'Nasdaq 100'], ['DJI', 'Dow Jones'], ['FTM', 'FTSE 100'],
  ['DAX', 'DAX 40'], ['N225', 'Nikkei 225'], ['HSI', 'Hang Seng'], ['SSEC', 'Shanghai Comp'],
  ['KS11', 'KOSPI'], ['TWII', 'Taiwan Weighted'], ['INDA', 'India (INDA)'], ['BVSP', 'Bovespa'],
  ['MERV', 'Merval'], ['XU100', 'BIST 100'], ['EIS', 'Israel (EIS)'], ['IWM', 'Russell 2000'],
  ['XLE', 'Energy sector'], ['XLF', 'Financials'], ['XLK', 'Technology'], ['XLV', 'Health Care'],
  ['XLI', 'Industrials'], ['XLY', 'Cons. Disc.'], ['XLP', 'Cons. Staples'], ['XLU', 'Utilities'],
  ['XLB', 'Materials'], ['XLRE', 'Real Estate'], ['XLC', 'Comm. Svcs'], ['ITA', 'Defense'],
  ['SOXX', 'Semiconductors'], ['GDX', 'Gold miners'], ['EEM', 'Emerging mkts'], ['EFA', 'Developed ex-US'],
  ['SHY', 'Short Treasuries'], ['EMB', 'EM bonds'], ['HYG', 'High yield'], ['DBA', 'Agriculture'],
  ['REMX', 'Rare earths'], ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'],
];
const TRACKED_TOTAL = TRACKED_UNIVERSE.length;

function levelFor(instrumentId, markets) {
  if (!markets || !instrumentId) return null;
  const id = String(instrumentId).toUpperCase();
  const c = markets.commodities || {};
  const y = markets.yields || {};
  const eq = markets.equities || {};
  const cr = markets.crypto || {};
  if (COMMODITY_KEY[id] && c[COMMODITY_KEY[id]] != null) return { value: c[COMMODITY_KEY[id]], kind: 'commodity' };
  if (y[id] != null) return { value: y[id], kind: 'yield' };
  if (eq[id] != null) return { value: eq[id], kind: 'equity' };
  if (cr[id] != null) return { value: cr[id], kind: 'crypto' };
  return null;
}

function fmtLevel(level) {
  if (!level) return null;
  if (level.kind === 'yield') return `${Number(level.value).toFixed(2)}%`;
  return Number(level.value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// 30d high/low/delta from a [{date,value}] series, formatted to the instrument's kind.
function keyLevels(series, level) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const vals = series.map(p => (typeof p === 'number' ? p : p?.value)).filter(v => v != null && !Number.isNaN(v));
  if (vals.length < 2) return null;
  const high = Math.max(...vals);
  const low = Math.min(...vals);
  const first = vals[0];
  const last = vals[vals.length - 1];
  const kind = level?.kind;
  const fmt = (v) => fmtLevel({ value: v, kind });
  let delta;
  if (kind === 'yield') {
    delta = `${last - first >= 0 ? '+' : ''}${(last - first).toFixed(2)}pp`;
  } else {
    const pct = first ? ((last - first) / first) * 100 : 0;
    delta = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }
  return { high: fmt(high), low: fmt(low), delta, deltaDir: last >= first ? 'up' : 'dn' };
}

const DIR_GLYPH = { up: '↑', down: '↓', mixed: '↔' };
const DIR_CLASS = { up: 'up', down: 'dn', mixed: 'mx' };

// Day-over-day change pill — real % from history closes. Renders nothing if null/absent.
// >0 green ▲ · <0 red ▼ · ~0 muted →. Never fabricates a value.
function ChangePill({ change }) {
  if (change == null || Number.isNaN(change)) return null;
  const abs = Math.abs(change).toFixed(1);
  if (change > 0) return <span className="ep-chg ep-chg-up">▲ +{abs}%</span>;
  if (change < 0) return <span className="ep-chg ep-chg-dn">▼ −{abs}%</span>;
  return <span className="ep-chg ep-chg-flat">→ 0.0%</span>;
}

// Right-rail market-context groups (label → [instrumentId, displayName])
const MARKET_GROUPS = [
  { hd: 'Equities', rows: [['SPX', 'S&P 500'], ['NDX', 'Nasdaq 100'], ['N225', 'Nikkei'], ['HSI', 'Hang Seng'], ['DAX', 'DAX'], ['IWM', 'Russell 2000']] },
  { hd: 'Sectors', rows: [['XLK', 'Technology'], ['XLF', 'Financials'], ['XLE', 'Energy'], ['XLV', 'Health Care'], ['XLI', 'Industrials'], ['XLY', 'Cons. Disc.'], ['XLP', 'Cons. Staples'], ['XLU', 'Utilities'], ['XLB', 'Materials'], ['XLRE', 'Real Estate'], ['XLC', 'Comm. Svcs'], ['ITA', 'Defense'], ['SOXX', 'Semiconductors']] },
  { hd: 'Commodities', rows: [['BRENT', 'Brent'], ['WTI', 'WTI'], ['GOLD', 'Gold'], ['COPPER', 'Copper'], ['NATGAS', 'Nat Gas']] },
  { hd: 'Ags & Materials', rows: [['DBA', 'Agriculture'], ['REMX', 'Rare Earths']] },
  { hd: 'Risk', rows: [['VIX', 'VIX'], ['DXY', 'Dollar (DXY)']] },
  { hd: 'Rates', rows: [['US10Y', 'US 10Y'], ['US2Y', 'US 2Y'], ['DE10Y', 'Bund 10Y'], ['JP10Y', 'JGB 10Y'], ['UK10Y', 'Gilt 10Y']] },
  { hd: 'Crypto', rows: [['BTC', 'Bitcoin'], ['ETH', 'Ethereum']] },
];

// Renders the briefing text, turning the **bolded** sharpest headline into a
// link to its thread Economy tab. The text comes verbatim from composeBriefing
// (the honesty-checked source) — we only swap the bold token for a link.
function BriefingText({ briefing }) {
  if (!briefing || briefing.empty) {
    return <p className="ep-brief-text ep-brief-empty">{briefing ? briefing.text : ''}</p>;
  }
  const segs = briefing.text.split(/\*\*(.+?)\*\*/);
  const sid = briefing.sharpest?.scopeId;
  return (
    <p className="ep-brief-text">
      {segs.map((s, i) => {
        if (i % 2 === 0) return <span key={i}>{s}</span>;
        return sid
          ? <Link key={i} className="ep-brief-story" to={`/weekly/thread/${encodeURIComponent(sid)}?tab=economy`}>{s}</Link>
          : <strong key={i}>{s}</strong>;
      })}
    </p>
  );
}

function timeAgo(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// One expanded instrument's price panel — lives in its own component so the
// useMarketsHistory hook fires only for the open row.
function ExpandedPanel({ instrumentId, level, marketsAsOf, stories, mover, magnitude }) {
  const { data: history } = useMarketsHistory(instrumentId);
  const kl = keyLevels(history, level);
  const today = fmtLevel(level);
  const asOfLabel = marketsAsOf ? new Date(marketsAsOf).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;
  // Cross-story "What's priced in" synthesis — instrument-level, deterministic, no forecast.
  const why = composeInstrumentWhy({ mover, magnitude, stories });
  // Sort driving stories by severity (severe first); cap the list so a heavily-cited
  // instrument (e.g. BRENT=27) doesn't dump every row at once.
  const STORY_CAP = 6;
  const [showAllStories, setShowAllStories] = useState(false);
  const sortedStories = useMemo(
    () => [...stories].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)),
    [stories]
  );
  const visibleStories = showAllStories ? sortedStories : sortedStories.slice(0, STORY_CAP);

  return (
    <div className="ep-expand">
      {why && (
        <div className="ep-why">
          <span className="ep-why-kicker">Why it&apos;s moving</span>
          <p className="ep-why-text">{why.text}</p>
        </div>
      )}
      <div className="ep-spark-block">
        <div className="ep-spark-area">
          <div className="ep-slabel">
            <span>Price · last {history.length || 0} days</span>
            {asOfLabel && <span className="ep-sts">as of {asOfLabel}</span>}
          </div>
          {history.length >= 2 ? (
            <Sparkline data={history} width={400} height={56} color="var(--ink)" />
          ) : (
            <div className="ep-spark-empty">Price history accruing — not enough points yet</div>
          )}
        </div>
        <div className="ep-key-levels">
          <div className="ep-klabel">Key levels</div>
          <div className="ep-kv"><span className="kk">Today</span><span className="vv">{today || '—'}</span></div>
          <div className="ep-kv"><span className="kk">30d high</span><span className="vv">{kl?.high || '—'}</span></div>
          <div className="ep-kv"><span className="kk">30d low</span><span className="vv">{kl?.low || '—'}</span></div>
          <div className="ep-kv"><span className="kk">30d Δ</span><span className={`vv ${kl ? kl.deltaDir : ''}`}>{kl?.delta || '—'}</span></div>
        </div>
      </div>

      {/* Driving-stories sub-table: Severity · Story · Direction · Mechanism · Closest analog */}
      <div className="ep-driving-hd">
        <div>Severity</div><div>Story</div><div>Direction</div><div>Mechanism</div>
        <div
          className="ep-analog-hd"
          title="closest past event + what this instrument actually did then — history, not a forecast"
        >
          Closest analog
          <span className="ep-analog-cap">past event + what it did then — not a forecast</span>
        </div>
      </div>
      {visibleStories.map(s => (
        <div className="ep-driving-row" key={s.scopeId}>
          <div className="ep-dr-sev">
            <span className={`ep-sev-bar ${s.severity}`} />
            <span className={`ep-sev-word ${s.severity}`}>{SEVERITY_LABEL[s.severity] || s.severity}</span>
          </div>
          <div className="ep-dr-headline">
            <Link to={`/weekly/thread/${encodeURIComponent(s.scopeId)}?tab=economy`}>{s.headline}</Link>
            <QualityFlag impact={s} size="sm" />
          </div>
          <div className="ep-dr-dir">
            <span className={`ep-arr ${DIR_CLASS[s.dir] || 'mx'}`}>{DIR_GLYPH[s.dir] || '↔'}</span>
            {s.magnitude && <span className="ep-dm">{s.magnitude}</span>}
          </div>
          <div className="ep-dr-mech">{s.rationale || <span className="ep-faint">no mechanism recorded</span>}</div>
          <div className="ep-dr-analog">
            {s.analog ? (
              <>
                <span className="ep-aname">{s.analog.event}{s.analog.year ? ` (${s.analog.year})` : ''}</span>
                {s.analogMove ? (
                  // Real historical realized move for this instrument — verbatim from the
                  // catalog. The page's differentiator: what actually happened, not a forecast.
                  <span className="ep-amove">
                    <span className="ep-amove-tk">{s.instrumentId}</span> {s.analogMove}
                  </span>
                ) : s.analog.outcome ? (
                  <span className="ep-aout">{s.analog.outcome}</span>
                ) : null}
              </>
            ) : (
              <span className="ep-faint">no close analog</span>
            )}
          </div>
        </div>
      ))}
      {sortedStories.length > STORY_CAP && (
        <button className="ep-stories-more" onClick={() => setShowAllStories(v => !v)}>
          {showAllStories ? 'Show fewer' : `Show ${sortedStories.length - STORY_CAP} more ${sortedStories.length - STORY_CAP === 1 ? 'story' : 'stories'}`}
        </button>
      )}
      {stories.length === 0 && <div className="ep-rail-empty ep-driving-empty">No linked stories in the loaded window</div>}

      {/* Affected-country chips */}
      {(() => {
        const countries = stories.flatMap(s => s.countries);
        const uniq = [...new Set(countries)];
        if (uniq.length === 0) return null;
        return (
          <div className="ep-affected">
            <b>Affected countries</b>
            {uniq.map(name => (
              <Link key={name} className="ep-country-chip" to={`/weekly/country/${encodeURIComponent(name)}`}>{name}</Link>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export default function EconomyPage() {
  const [filters, setFilters] = useState({
    severity: new Set(),     // empty = all
    horizon: new Set(),
    instrument: null,        // single value
    country: null,
  });
  const [openMover, setOpenMover] = useState(null);
  const [dormantOpen, setDormantOpen] = useState(false);

  // Right-rail (Market Context) is drag-resizable so truncated instrument names
  // ("Techno…", "Semico…") can be revealed. Width persists per-browser. The
  // .nm column is 1fr, so widening the rail reveals the full labels for free.
  const RAIL_MIN = 220, RAIL_MAX = 560, RAIL_DEFAULT = 260;
  const [railWidth, setRailWidth] = useState(() => {
    const saved = Number(localStorage.getItem('ep-rail-w'));
    return saved >= RAIL_MIN && saved <= RAIL_MAX ? saved : RAIL_DEFAULT;
  });
  const dragStart = useRef(null);
  const startRailDrag = (e) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, w: railWidth };
    const onMove = (ev) => {
      const { x, w } = dragStart.current;
      // Rail sits on the right edge → dragging the handle left widens it.
      setRailWidth(Math.min(RAIL_MAX, Math.max(RAIL_MIN, w + (x - ev.clientX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setRailWidth(curr => { localStorage.setItem('ep-rail-w', String(curr)); return curr; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const resetRailWidth = () => {
    setRailWidth(RAIL_DEFAULT);
    localStorage.setItem('ep-rail-w', String(RAIL_DEFAULT));
  };

  const { data: disruptions = [], loading, error } = useDisruptionsList({ limit: 200 });
  const { data: topMovers = [], loading: moversLoading } = useTopMovers(20);
  const { data: markets, loading: marketsLoading, asOf: marketsAsOf } = useMarketsGlobal();

  const toggle = (key, value) => {
    setFilters(prev => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [key]: next };
    });
  };

  const setSingle = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));
  };

  const clearFilters = () => setFilters({ severity: new Set(), horizon: new Set(), instrument: null, country: null });

  const filtered = useMemo(() => {
    return disruptions.filter(d => {
      if (filters.severity.size > 0 && !filters.severity.has(d.severity)) return false;
      if (filters.horizon.size > 0 && !filters.horizon.has(d.horizon)) return false;
      if (filters.instrument) {
        const has = (d.instruments || []).some(i => i.instrumentId === filters.instrument);
        if (!has) return false;
      }
      if (filters.country) {
        const inW = (d.winners || []).some(w => w.name === filters.country);
        const inL = (d.losers || []).some(l => l.name === filters.country);
        if (!inW && !inL) return false;
      }
      return true;
    });
  }, [disruptions, filters]);

  const grouped = useMemo(() => {
    const g = { severe: [], moderate: [], minor: [] };
    for (const d of filtered) if (g[d.severity]) g[d.severity].push(d);
    return g;
  }, [filtered]);

  // severity counts across the *full* set (for the left-rail facet counts)
  const severityCounts = useMemo(() => {
    const m = { severe: 0, moderate: 0, minor: 0 };
    for (const d of disruptions) if (m[d.severity] != null) m[d.severity]++;
    return m;
  }, [disruptions]);

  const horizonCounts = useMemo(() => {
    const m = {};
    for (const h of HORIZONS) m[h] = disruptions.filter(d => d.horizon === h).length;
    return m;
  }, [disruptions]);

  const countryFacets = useMemo(() => {
    const set = new Set();
    for (const d of disruptions) {
      for (const w of (d.winners || [])) if (w.type === 'country') set.add(w.name);
      for (const l of (d.losers || [])) if (l.type === 'country') set.add(l.name);
    }
    return [...set].sort();
  }, [disruptions]);

  // Modal (most-common) magnitude among disruptions citing this instrument.
  const magnitudeFor = (instrumentId) => {
    const counts = {};
    for (const d of disruptions) {
      const inst = (d.instruments || []).find(i => i.instrumentId === instrumentId);
      if (inst?.magnitude) counts[inst.magnitude] = (counts[inst.magnitude] || 0) + 1;
    }
    let best = null, bestN = 0;
    for (const [mag, n] of Object.entries(counts)) {
      if (n > bestN || (n === bestN && MAG_RANK[mag] > MAG_RANK[best])) { best = mag; bestN = n; }
    }
    return best;
  };

  // Stories driving a given instrument, with that instrument's per-story rationale + analog + countries.
  const storiesForInstrument = (instrumentId) =>
    disruptions
      .filter(d => (d.instruments || []).some(i => i.instrumentId === instrumentId))
      .map(d => {
        const inst = (d.instruments || []).find(i => i.instrumentId === instrumentId) || {};
        const countries = [
          ...(d.winners || []).filter(w => w.type === 'country').map(w => w.name),
          ...(d.losers || []).filter(l => l.type === 'country').map(l => l.name),
        ];
        const analog = d.historicalAnalog || null;
        // Join the LLM-named analog against the bundled catalog to surface its REAL
        // realized move for THIS instrument (verbatim from realizedMoves[instrumentId]).
        // null when the event/instrument isn't catalogued — never fabricated.
        const analogMove = analog
          ? realizedMoveFor(analog.event, analog.year, instrumentId)
          : null;
        return {
          scopeId: d.scopeId, headline: d.headline, severity: d.severity,
          dir: inst.direction, magnitude: inst.magnitude, rationale: inst.rationale,
          analog, analogMove, instrumentId, countries,
          // quality-judge verdict (so the sub-table can badge + the analog pick can skip flagged)
          is_low_quality: d.is_low_quality, qualityScores: d.qualityScores, qualityReasons: d.qualityReasons,
        };
      });

  // Dormant = tracked universe minus the cited (top-movers) instruments.
  const citedIds = useMemo(() => new Set(topMovers.map(m => String(m.instrumentId).toUpperCase())), [topMovers]);
  const dormant = useMemo(
    () => TRACKED_UNIVERSE.filter(([tk]) => !citedIds.has(tk)),
    [citedIds]
  );

  const marketsTime = marketsAsOf ? new Date(marketsAsOf).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;
  const filtersActive = filters.severity.size || filters.horizon.size || filters.instrument || filters.country;

  // Deterministic "Today in the economy" lead briefing — composed from the same
  // data already loaded; honesty-checked by quality/briefing/assertions.js.
  const briefing = useMemo(
    () => composeBriefing({ topMovers, disruptions, markets }),
    [topMovers, disruptions, markets]
  );
  // Show the band once data has settled; while still loading with nothing yet, stay quiet.
  const briefingReady = !loading && !moversLoading;
  const showBriefing = disruptions.length > 0 || topMovers.length > 0 || briefingReady;

  return (
    <div className="ep-page">
      {/* ===== MASTHEAD BAND ===== */}
      <div className="ep-masthead-band">
        <div>
          <h1>Economy</h1>
          <p className="ep-deck">What today&apos;s news is repricing — instrument-first.</p>
        </div>
        <div className="ep-timestamp">
          {marketsTime ? <>as of <b>{marketsTime}</b><br /></> : null}
          5-min snapshot · refreshes hourly<br />
          prices: Frankfurter / Stooq / CoinGecko
        </div>
      </div>

      {/* ===== TODAY-IN-THE-ECONOMY BRIEFING (lead synthesis) ===== */}
      {showBriefing && (
        <div className="ep-briefing-band">
          <span className="ep-brief-kicker">Today in the economy</span>
          <BriefingText briefing={briefing} />
        </div>
      )}

      {/* ===== THREE-COLUMN SHELL ===== */}
      <div className="ep-shell" style={{ '--ep-rail-w': `${railWidth}px` }}>

        {/* ===== LEFT RAIL — FILTERS ===== */}
        <aside className="ep-rail-left">
          <div className="ep-filter-block">
            <h5>Severity</h5>
            {SEVERITY_ORDER.map(s => (
              <label key={s} className={`ep-fcheck${filters.severity.has(s) ? ' on' : ''}`}>
                <input type="checkbox" checked={filters.severity.has(s)} onChange={() => toggle('severity', s)} />
                {SEVERITY_LABEL[s]}
                <span className="ep-fc">{severityCounts[s]}</span>
              </label>
            ))}
          </div>

          <div className="ep-filter-block">
            <h5>Horizon</h5>
            <label className={`ep-fradio${filters.horizon.size === 0 ? ' on' : ''}`}>
              <input type="radio" name="ep-hor" checked={filters.horizon.size === 0}
                onChange={() => setFilters(p => ({ ...p, horizon: new Set() }))} />
              All
            </label>
            {HORIZONS.map(h => (
              <label key={h} className={`ep-fradio${filters.horizon.has(h) ? ' on' : ''}`}>
                <input type="radio" name="ep-hor" checked={filters.horizon.has(h)}
                  onChange={() => setFilters(p => ({ ...p, horizon: new Set([h]) }))} />
                <span className="ep-cap">{h}</span>
                <span className="ep-fc">{horizonCounts[h]}</span>
              </label>
            ))}
          </div>

          {countryFacets.length > 0 && (
            <div className="ep-filter-block">
              <h5>Country</h5>
              {countryFacets.slice(0, 9).map(c => (
                <label key={c} className={`ep-fcountry${filters.country === c ? ' on' : ''}`} onClick={() => setSingle('country', c)}>
                  <input type="checkbox" readOnly checked={filters.country === c} />
                  {c}
                </label>
              ))}
            </div>
          )}

          {filtersActive ? (
            <div className="ep-filter-block">
              <button className="ep-clear" onClick={clearFilters}>Clear filters</button>
            </div>
          ) : null}
        </aside>

        {/* ===== MAIN COLUMN ===== */}
        <main className="ep-main">

          {error && (
            <div className="ep-error">Couldn&apos;t load economic disruptions. {String(error)}</div>
          )}

          {/* LEADERBOARD HEADER */}
          <div className="ep-lhd">
            <h2>Repricing today</h2>
            <div className="ep-lhd-meta"><b>{topMovers.length}</b> of {TRACKED_TOTAL} tracked instruments cited</div>
          </div>

          {moversLoading && topMovers.length === 0 && (
            <div className="ep-empty">Loading repriced instruments…</div>
          )}

          {!moversLoading && topMovers.length === 0 && !loading && (
            <div className="ep-empty">
              No instruments cited today. This happens when no news threads have a measurable
              economic dimension or the analysis pipeline hasn&apos;t run yet.
            </div>
          )}

          {/* Column labels — finance watchlists always name their fields */}
          {topMovers.length > 0 && (
            <div className="ep-lb-head" aria-hidden="true">
              <div>Instrument</div>
              <div>Signal</div>
              <div>Last</div>
              <div>Chg</div>
              <div>Stories</div>
              <div />
            </div>
          )}

          {/* ===== INSTRUMENT ROWS ===== */}
          {topMovers.map(m => {
            const open = openMover === m.instrumentId;
            const level = levelFor(m.instrumentId, markets);
            const active = filters.instrument === m.instrumentId;
            const dirs = m.directions || {};
            const total = (dirs.up || 0) + (dirs.down || 0) + (dirs.mixed || 0);
            const topDir = m.consensus;
            const topDirCount = dirs[topDir] != null ? dirs[topDir] : Math.max(dirs.up || 0, dirs.down || 0, dirs.mixed || 0);
            const mag = magnitudeFor(m.instrumentId);
            const priceLevel = fmtLevel(level);
            // real direction split — replaces the mockup's (unsourceable) severity bar + category tag
            const splitParts = [];
            if (dirs.up) splitParts.push(`${dirs.up} ↑`);
            if (dirs.down) splitParts.push(`${dirs.down} ↓`);
            if (dirs.mixed) splitParts.push(`${dirs.mixed} ↔`);

            return (
              <div key={m.instrumentId} className={`ep-instr-row${open ? ' open' : ''}${active ? ' filtering' : ''}`}>
                <div className="ep-row-l1" onClick={() => setOpenMover(open ? null : m.instrumentId)}>
                  <button
                    className="ep-name"
                    onClick={(e) => { e.stopPropagation(); setSingle('instrument', m.instrumentId); }}
                    title="Filter the story list by this instrument"
                  >
                    {m.instrumentId}
                  </button>
                  <div className="ep-dirprice">
                    <span className={`ep-arrow ${DIR_CLASS[topDir] || 'mx'}`}>{DIR_GLYPH[topDir] || '↔'}</span>
                    {mag && <span className="ep-mag">{mag}</span>}
                  </div>
                  <span className="ep-price">
                    {priceLevel || ''}
                  </span>
                  <span className="ep-chg-cell">
                    <ChangePill change={markets?.series?.[m.instrumentId]?.change} />
                  </span>
                  <div className="ep-cites">
                    <b>{m.citations}</b> stor{m.citations === 1 ? 'y' : 'ies'}
                    {total > 0 && <> · {topDirCount} of {total} agree</>}
                  </div>
                  <span className="ep-chev">›</span>
                </div>
                <div className="ep-row-l2">
                  <div className="ep-spacer" />
                  <span className="ep-dirsplit" title={`${m.consensusStrength}% of ${m.citations} cited stories agree on the ${topDir} direction`}>
                    <span className="ep-dirsplit-label">Stories:</span> {splitParts.join(' · ') || '—'}
                  </span>
                </div>
                {open && (
                  <ExpandedPanel
                    instrumentId={m.instrumentId}
                    level={level}
                    marketsAsOf={marketsAsOf}
                    stories={storiesForInstrument(m.instrumentId)}
                    mover={m}
                    magnitude={mag}
                  />
                )}
              </div>
            );
          })}

          {/* ===== DORMANT DRAWER ===== */}
          {dormant.length > 0 && (
            <div className="ep-dormant-row">
              <span className="ep-dormant-trigger" onClick={() => setDormantOpen(o => !o)}>
                {dormant.length} tracked instruments not cited today — {dormantOpen ? 'hide ←' : 'show all →'}
              </span>
              {dormantOpen && (
                <div className="ep-dormant-table">
                  <div className="ep-dormant-hd"><div>Ticker</div><div>Name</div></div>
                  {dormant.map(([tk, name]) => (
                    <div className="ep-dormant-item" key={tk}>
                      <div className="dn">{tk}</div>
                      <div className="dd">{name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== BY-STORY BRIDGE ===== */}
          <div className="ep-bridge">
            <div className="ep-bridge-hd">
              <h2>Active disruptions</h2>
              <span className="ep-bmeta">{filtered.length} stories citing markets · grouped by severity</span>
            </div>

            {loading && disruptions.length === 0 && (
              <div className="ep-empty">Loading active disruptions…</div>
            )}

            {!loading && !error && disruptions.length === 0 && (
              <div className="ep-empty">
                No active disruptions detected. This happens when no news threads have a measurable
                economic dimension or the analysis pipeline hasn&apos;t run yet.
              </div>
            )}

            {SEVERITY_ORDER.map(sev => grouped[sev].length > 0 && (
              <div key={sev} className={`ep-sev-section ep-sev-${sev}`}>
                <div className={`ep-sev-label ${sev}`}>
                  {SEVERITY_LABEL[sev]} <span className="ct">{grouped[sev].length} stor{grouped[sev].length === 1 ? 'y' : 'ies'}</span>
                </div>
                {grouped[sev].map(d => {
                  const insts = (d.instruments || []).slice(0, 6);
                  return (
                    <div className="ep-sev-story" key={d.scopeId}>
                      <h4>
                        <Link to={`/weekly/thread/${encodeURIComponent(d.scopeId)}?tab=economy`}>
                          {d.headline || 'Disruption detected'}
                        </Link>
                        <QualityFlag impact={d} size="sm" />
                      </h4>
                      {insts.length > 0 && (
                        <div className="ep-chips">
                          {insts.map(i => (
                            <span className="ep-inst-chip" key={i.instrumentId} title={i.rationale || ''}>
                              {i.instrumentId} <span className={`ca ${DIR_CLASS[i.direction] || 'mx'}`}>{DIR_GLYPH[i.direction] || '↔'}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="ep-smeta">
                        {d.generatedAt && <span>updated {timeAgo(d.generatedAt)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {filtered.length > 0 && filtered.length !== disruptions.length && (
            <div className="ep-filter-info">
              Showing {filtered.length} of {disruptions.length} active disruptions.
              <button onClick={clearFilters}>Clear filters</button>
            </div>
          )}

          <div className="ep-disclaimer">
            Not investment advice. Severity bands and direction calls are qualitative analyst judgments, not price targets —
            see <Link to="/disclosures">methodology</Link>.
          </div>
        </main>

        {/* ===== RIGHT RAIL — MARKET CONTEXT ===== */}
        <aside className="ep-rail-right">
          <div
            className="ep-rail-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize Market Context panel"
            title="Drag to resize · double-click to reset"
            onMouseDown={startRailDrag}
            onDoubleClick={resetRailWidth}
          />
          <div className="ep-mkt-head">
            <span className="ep-rail-hd">Market Context</span>
            {marketsTime && <span className="ep-hts">{marketsTime}</span>}
          </div>
          {marketsLoading && !markets && <div className="ep-rail-empty ep-mkt-empty">Loading markets…</div>}
          {!marketsLoading && !markets && <div className="ep-rail-empty ep-mkt-empty">Market data unavailable</div>}
          {markets && MARKET_GROUPS.map(g => {
            const rows = g.rows
              .map(([id, name]) => [id, name, fmtLevel(levelFor(id, markets))])
              .filter(([, , v]) => v != null);
            if (rows.length === 0) return null;
            return (
              <div key={g.hd} className="ep-mkt-group">
                <div className="ep-glabel">{g.hd}</div>
                {rows.map(([id, name, val]) => {
                  const s = markets.series?.[id];
                  return (
                    <div key={id} className="ep-mkt-row">
                      <span className="nm" title={id}>{name}</span>
                      <span className="spk">
                        {Array.isArray(s?.spark) && s.spark.length >= 2
                          ? <Sparkline data={s.spark} width={56} height={18} />
                          : null}
                      </span>
                      <span className="vl">{val}</span>
                      <span className="chg"><ChangePill change={s?.change} /></span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="ep-mkt-foot">
            Snapshot refreshes hourly.<br />
            {marketsTime && <>Last refresh {marketsTime}.<br /></>}
            Source: Frankfurter · Stooq · CoinGecko.
          </div>
        </aside>

      </div>
    </div>
  );
}
