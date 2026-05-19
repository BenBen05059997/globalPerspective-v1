// EconomyPage — flagship index of all active economic disruptions.
// 3-col EditorialShell: left=facet filters, center=severity-grouped list, right=Top Movers panel.

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
import DisruptionRow from './atoms/DisruptionRow';
import DirectionArrow from './atoms/DirectionArrow';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import { useTopMovers } from '../hooks/useTopMovers';
import './EconomyPage.css';

const SEVERITY_ORDER = ['severe', 'moderate', 'minor'];
const SEVERITY_LABEL = { severe: 'Severe', moderate: 'Moderate', minor: 'Minor' };

const HORIZONS = ['immediate', 'days', 'weeks', 'months'];

export default function EconomyPage() {
  const [filters, setFilters] = useState({
    severity: new Set(),     // empty = all
    horizon: new Set(),
    instrument: null,        // single value
    country: null,
  });

  const { data: disruptions = [], loading } = useDisruptionsList({ limit: 200 });
  const { data: topMovers = [] } = useTopMovers(10);

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
    for (const d of filtered) {
      if (g[d.severity]) g[d.severity].push(d);
    }
    return g;
  }, [filtered]);

  const severeCount = grouped.severe.length;
  const updatedAt = disruptions[0]?.generatedAt || null;

  const statusStats = [
    { label: 'active', value: filtered.length },
    { label: 'severe', value: severeCount },
    { label: 'horizons', value: HORIZONS.filter(h => filtered.some(d => d.horizon === h)).length },
  ];

  // Distinct countries (for country facet)
  const countryFacets = useMemo(() => {
    const set = new Set();
    for (const d of disruptions) {
      for (const w of (d.winners || [])) if (w.type === 'country') set.add(w.name);
      for (const l of (d.losers || [])) if (l.type === 'country') set.add(l.name);
    }
    return [...set].sort().slice(0, 15);
  }, [disruptions]);

  const instrumentFacets = useMemo(() => {
    const set = new Set();
    for (const d of disruptions) for (const i of (d.instruments || [])) set.add(i.instrumentId);
    return [...set].sort();
  }, [disruptions]);

  // ── LEFT RAIL: filter facets ───────────────────────────────
  const leftRail = (
    <div className="ep-rail">
      <div className="ep-breadcrumb">
        <Link to="/">Home</Link>
        <span> / </span>
        <span>Economy</span>
      </div>

      <div className="ep-facet">
        <div className="ep-facet-label">Severity</div>
        {SEVERITY_ORDER.map(s => (
          <label key={s} className="ep-check">
            <input
              type="checkbox"
              checked={filters.severity.has(s)}
              onChange={() => toggle('severity', s)}
            />
            <span>{SEVERITY_LABEL[s]}</span>
            <span className="ep-check-count">{grouped[s].length}</span>
          </label>
        ))}
      </div>

      <div className="ep-facet">
        <div className="ep-facet-label">Horizon</div>
        {HORIZONS.map(h => (
          <label key={h} className="ep-check">
            <input
              type="checkbox"
              checked={filters.horizon.has(h)}
              onChange={() => toggle('horizon', h)}
            />
            <span>{h}</span>
          </label>
        ))}
      </div>

      {instrumentFacets.length > 0 && (
        <div className="ep-facet">
          <div className="ep-facet-label">Instrument</div>
          <div className="ep-chips">
            {instrumentFacets.slice(0, 16).map(id => (
              <button
                key={id}
                className={`ep-chip${filters.instrument === id ? ' on' : ''}`}
                onClick={() => setSingle('instrument', id)}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}

      {countryFacets.length > 0 && (
        <div className="ep-facet">
          <div className="ep-facet-label">Country</div>
          <div className="ep-chips">
            {countryFacets.map(c => (
              <button
                key={c}
                className={`ep-chip${filters.country === c ? ' on' : ''}`}
                onClick={() => setSingle('country', c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── CENTER: severity-grouped list ───────────────────────────
  const center = (
    <div className="ep-center">
      <div className="ep-masthead">
        <div className="ep-kicker">/ ECONOMY</div>
        <h1 className="ep-title">Economic Disruption</h1>
        <p className="ep-sub">How current news threads are repricing the world</p>
      </div>

      {loading && disruptions.length === 0 && (
        <div className="ep-empty">Loading active disruptions…</div>
      )}

      {!loading && disruptions.length === 0 && (
        <div className="ep-empty">
          No active disruptions detected. This happens when no news threads have a measurable
          economic dimension or the analysis pipeline hasn't run yet.
        </div>
      )}

      {SEVERITY_ORDER.map(sev => grouped[sev].length > 0 && (
        <section key={sev} className={`ep-group ep-group-${sev}`}>
          <h2 className="ep-group-hd">
            {SEVERITY_LABEL[sev]}
            <span className="ep-group-count">{grouped[sev].length}</span>
          </h2>
          {grouped[sev].map(d => (
            <DisruptionRow key={d.scopeId} disruption={d} />
          ))}
        </section>
      ))}

      {filtered.length > 0 && filtered.length !== disruptions.length && (
        <div className="ep-filter-info">
          Showing {filtered.length} of {disruptions.length} active disruptions.
          <button onClick={() => setFilters({ severity: new Set(), horizon: new Set(), instrument: null, country: null })}>
            Clear filters
          </button>
        </div>
      )}

      <div className="ep-disclaimer">
        Not investment advice. Severity bands are qualitative analyst judgments — see <Link to="/disclosures">methodology</Link>.
      </div>
    </div>
  );

  // ── RIGHT RAIL: Today's Top Movers ──────────────────────────
  const rightRail = (
    <div className="ep-rail">
      <div className="ep-rail-section">
        <div className="ep-rail-hd">Today's Top Movers</div>
        {topMovers.length === 0 && <div className="ep-rail-empty">No active movers</div>}
        {topMovers.map((m) => (
          <button
            key={m.instrumentId}
            className={`ep-mover${filters.instrument === m.instrumentId ? ' on' : ''}`}
            onClick={() => setSingle('instrument', m.instrumentId)}
            title={`Cited in ${m.citations} disruption${m.citations !== 1 ? 's' : ''}`}
          >
            <span className="ep-mover-id">{m.instrumentId}</span>
            <DirectionArrow dir={m.consensus} />
            <span className="ep-mover-strength">{m.consensusStrength}%</span>
            <span className="ep-mover-cite">×{m.citations}</span>
          </button>
        ))}
      </div>

      <div className="ep-rail-section">
        <div className="ep-rail-hd">Horizon</div>
        {HORIZONS.map(h => {
          const count = filtered.filter(d => d.horizon === h).length;
          return (
            <div key={h} className="ep-horizon-row">
              <span>{h}</span>
              <b>{count}</b>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <EditorialShell
      strip={
        <StatusStrip
          label="LIVE"
          stats={statusStats}
          updatedAt={updatedAt}
        />
      }
      left={leftRail}
      center={center}
      right={rightRail}
    />
  );
}
