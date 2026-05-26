// EconomyPage — the markets-meets-news command center.
// The aggregate, instrument-first view of what global news is repricing right now.
// Per-story detail lives on the thread Economy tab (/weekly/thread/:id?tab=economy);
// this page owns the cross-story picture the thread tab structurally can't show.
// 3-col EditorialShell: left=facets, center=instrument pivot + by-story list, right=live market context.

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
import DisruptionRow from './atoms/DisruptionRow';
import DirectionArrow from './atoms/DirectionArrow';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import { useTopMovers } from '../hooks/useTopMovers';
import { useMarketsGlobal } from '../hooks/useMarketsGlobal';
import './EconomyPage.css';

const SEVERITY_ORDER = ['severe', 'moderate', 'minor'];
const SEVERITY_LABEL = { severe: 'Severe', moderate: 'Moderate', minor: 'Minor' };
const HORIZONS = ['immediate', 'days', 'weeks', 'months'];

// markets_global exposes commodities + yields (not equities/FX pairs).
// Map a disruption instrumentId → its live level so the qualitative call sits next to the real number.
const COMMODITY_KEY = { BRENT: 'brent', WTI: 'wti', GOLD: 'gold', COPPER: 'copper', DXY: 'dxy', VIX: 'vix' };

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

// Right-rail market-context groups (label → [instrumentId, displayName])
const MARKET_GROUPS = [
  { hd: 'Equities', rows: [['SPX', 'S&P 500'], ['NDX', 'Nasdaq 100'], ['N225', 'Nikkei'], ['HSI', 'Hang Seng'], ['DAX', 'DAX']] },
  { hd: 'Commodities', rows: [['BRENT', 'Brent'], ['WTI', 'WTI'], ['GOLD', 'Gold'], ['COPPER', 'Copper']] },
  { hd: 'Risk', rows: [['VIX', 'VIX'], ['DXY', 'Dollar (DXY)']] },
  { hd: 'Rates', rows: [['US10Y', 'US 10Y'], ['US2Y', 'US 2Y'], ['DE10Y', 'Bund 10Y'], ['JP10Y', 'JGB 10Y'], ['UK10Y', 'Gilt 10Y']] },
  { hd: 'Crypto', rows: [['BTC', 'Bitcoin'], ['ETH', 'Ethereum']] },
];

export default function EconomyPage() {
  const [filters, setFilters] = useState({
    severity: new Set(),     // empty = all
    horizon: new Set(),
    instrument: null,        // single value
    country: null,
  });
  const [openMover, setOpenMover] = useState(null);

  const { data: disruptions = [], loading, error } = useDisruptionsList({ limit: 200 });
  const { data: topMovers = [], loading: moversLoading } = useTopMovers(12);
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

  const updatedAt = disruptions[0]?.generatedAt || null;

  const statusStats = [
    { label: 'active', value: filtered.length },
    { label: 'severe', value: grouped.severe.length },
    { label: 'instruments', value: topMovers.length },
  ];

  const countryFacets = useMemo(() => {
    const set = new Set();
    for (const d of disruptions) {
      for (const w of (d.winners || [])) if (w.type === 'country') set.add(w.name);
      for (const l of (d.losers || [])) if (l.type === 'country') set.add(l.name);
    }
    return [...set].sort().slice(0, 15);
  }, [disruptions]);

  const horizonCounts = useMemo(() => {
    const m = {};
    for (const h of HORIZONS) m[h] = filtered.filter(d => d.horizon === h).length;
    return m;
  }, [filtered]);

  // ── LEFT RAIL: facet filters ─────────────────────────────────
  const leftRail = (
    <div className="ep-rail">
      <div className="ep-breadcrumb">
        <Link to="/">Home</Link><span> / </span><span>Economy</span>
      </div>

      <div className="ep-facet">
        <div className="ep-facet-label">Severity</div>
        {SEVERITY_ORDER.map(s => (
          <label key={s} className="ep-check">
            <input type="checkbox" checked={filters.severity.has(s)} onChange={() => toggle('severity', s)} />
            <span>{SEVERITY_LABEL[s]}</span>
            <span className="ep-check-count">{grouped[s].length}</span>
          </label>
        ))}
      </div>

      <div className="ep-facet">
        <div className="ep-facet-label">Horizon</div>
        {HORIZONS.map(h => (
          <label key={h} className="ep-check">
            <input type="checkbox" checked={filters.horizon.has(h)} onChange={() => toggle('horizon', h)} />
            <span>{h}</span>
            <span className="ep-check-count">{horizonCounts[h]}</span>
          </label>
        ))}
      </div>

      {countryFacets.length > 0 && (
        <div className="ep-facet">
          <div className="ep-facet-label">Country</div>
          <div className="ep-chips">
            {countryFacets.map(c => (
              <button key={c} className={`ep-chip${filters.country === c ? ' on' : ''}`} onClick={() => setSingle('country', c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {(filters.severity.size || filters.horizon.size || filters.instrument || filters.country) ? (
        <button className="ep-clear" onClick={clearFilters}>Clear filters</button>
      ) : null}
    </div>
  );

  // Stories driving a given instrument, with that instrument's per-story rationale
  // (source + reference + the "why"). Pulled from the already-loaded disruptions list.
  const storiesForInstrument = (instrumentId) =>
    disruptions
      .filter(d => (d.instruments || []).some(i => i.instrumentId === instrumentId))
      .map(d => {
        const inst = (d.instruments || []).find(i => i.instrumentId === instrumentId) || {};
        return { scopeId: d.scopeId, headline: d.headline, severity: d.severity, dir: inst.direction, magnitude: inst.magnitude, rationale: inst.rationale };
      });

  // ── CENTER: instrument pivot (hero) + by-story list ──────────
  const center = (
    <div className="ep-center">
      <div className="ep-masthead">
        <div className="ep-kicker">/ ECONOMY</div>
        <h1 className="ep-title">Economic Disruption</h1>
        <p className="ep-sub">What global news is repricing right now — across every active story.</p>
      </div>

      {error && (
        <div className="ep-error">Couldn't load economic disruptions. {error}</div>
      )}

      {loading && disruptions.length === 0 && (
        <div className="ep-empty">Loading active disruptions…</div>
      )}

      {!loading && !error && disruptions.length === 0 && (
        <div className="ep-empty">
          No active disruptions detected. This happens when no news threads have a measurable
          economic dimension or the analysis pipeline hasn't run yet.
        </div>
      )}

      {/* Instrument pivot — the cross-story aggregate the thread tab can't show */}
      {(topMovers.length > 0 || moversLoading) && (
        <section className="ep-pivot">
          <h2 className="ep-section-hd">
            Most-repriced instruments
            <span className="ep-section-sub">net direction across all active stories</span>
          </h2>
          {moversLoading && topMovers.length === 0 && <div className="ep-rail-empty">Loading movers…</div>}
          {topMovers.map(m => {
            const open = openMover === m.instrumentId;
            const level = levelFor(m.instrumentId, markets);
            const active = filters.instrument === m.instrumentId;
            const stories = open ? storiesForInstrument(m.instrumentId) : [];
            return (
              <div key={m.instrumentId} className={`ep-pivot-item${active ? ' on' : ''}`}>
                <div className="ep-pivot-head">
                  <button
                    className="ep-pivot-id"
                    onClick={() => setSingle('instrument', m.instrumentId)}
                    title="Filter the story list by this instrument"
                  >
                    {m.instrumentId}
                  </button>
                  <DirectionArrow dir={m.consensus} />
                  <span className="ep-pivot-strength" title={`${m.consensusStrength}% of ${m.citations} cited stories agree on the ${m.consensus} direction`}>{m.consensusStrength}% consensus</span>
                  {level && <span className="ep-pivot-level">{fmtLevel(level)}</span>}
                  <span className="ep-pivot-cite">{m.citations} stor{m.citations === 1 ? 'y' : 'ies'}</span>
                  <button
                    className="ep-pivot-toggle"
                    onClick={() => setOpenMover(open ? null : m.instrumentId)}
                    aria-expanded={open}
                  >
                    {open ? '−' : '+'}
                  </button>
                </div>
                {open && (
                  <ul className="ep-pivot-examples">
                    {stories.map(s => (
                      <li key={s.scopeId}>
                        <Link to={`/weekly/thread/${s.scopeId}?tab=economy`} className="ep-ex-link">
                          <span className={`ep-ex-sev ep-ex-${s.severity}`} />
                          <span className="ep-ex-head">{s.headline}</span>
                        </Link>
                        {s.rationale && (
                          <div className="ep-ex-why">
                            <DirectionArrow dir={s.dir} /> <span className="ep-ex-mag">{s.magnitude}</span> · {s.rationale}
                          </div>
                        )}
                      </li>
                    ))}
                    {stories.length === 0 && <li className="ep-rail-empty">No linked stories in the loaded window</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* By-story view — severity-grouped index */}
      {SEVERITY_ORDER.map(sev => grouped[sev].length > 0 && (
        <section key={sev} className={`ep-group ep-group-${sev}`}>
          <h2 className="ep-group-hd">{SEVERITY_LABEL[sev]}<span className="ep-group-count">{grouped[sev].length}</span></h2>
          {grouped[sev].map(d => <DisruptionRow key={d.scopeId} disruption={d} />)}
        </section>
      ))}

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
    </div>
  );

  // ── RIGHT RAIL: live market context ──────────────────────────
  const rightRail = (
    <div className="ep-rail">
      <div className="ep-rail-section">
        <div className="ep-rail-hd">
          Market Context
          {marketsAsOf && <span className="ep-asof">as of {new Date(marketsAsOf).toLocaleDateString()}</span>}
        </div>
        {marketsLoading && !markets && <div className="ep-rail-empty">Loading markets…</div>}
        {!marketsLoading && !markets && <div className="ep-rail-empty">Market data unavailable</div>}
        {markets && MARKET_GROUPS.map(g => {
          const rows = g.rows.map(([id, name]) => [name, fmtLevel(levelFor(id, markets))]).filter(([, v]) => v != null);
          if (rows.length === 0) return null;
          return (
            <div key={g.hd} className="ep-mkt-group">
              <div className="ep-mkt-hd">{g.hd}</div>
              {rows.map(([name, val]) => (
                <div key={name} className="ep-mkt-row"><span>{name}</span><b>{val}</b></div>
              ))}
            </div>
          );
        })}
        <div className="ep-rail-note">Live levels for the instruments stories are repricing. Equities &amp; FX pairs not shown.</div>
      </div>

      <div className="ep-rail-section">
        <div className="ep-rail-hd">Horizon</div>
        {HORIZONS.map(h => (
          <div key={h} className="ep-horizon-row"><span>{h}</span><b>{horizonCounts[h]}</b></div>
        ))}
      </div>
    </div>
  );

  return (
    <EditorialShell
      strip={<StatusStrip label="LIVE" stats={statusStats} updatedAt={updatedAt} />}
      left={leftRail}
      right={rightRail}
    >
      {center}
    </EditorialShell>
  );
}
