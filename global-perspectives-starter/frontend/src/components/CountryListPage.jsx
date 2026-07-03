import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import { getTopicRegion } from '../utils/countryMapping';
import { RISK_COLORS, CATEGORY_BADGE_COLORS } from '../tokens';
import { TIER_ORDER, tierFromLevel } from '../utils/riskTiers';
import CountryOverviewMap from './CountryOverviewMap';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
import RiskScoreBadge from './atoms/RiskScoreBadge';
import SeverityBadge from './atoms/SeverityBadge';
import './WeeklyPage.css';
import './CountryListPage.css';

// riskLevel string → sort rank (high first). Normalized via the shared tier util.
const riskRank = (level) => TIER_ORDER[tierFromLevel(level)] ?? 3;
const SEVERITY_RANK = { severe: 3, moderate: 2, minor: 1 };

function trajectoryArrow(text = '') {
  const t = text.toLowerCase();
  if (/escalat|intensif|worsen|heighten|spike|surge/.test(t)) return { arrow: '↗', cls: 'traj-up' };
  if (/de-escalat|improv|eas|calm|stabili|wind down/.test(t)) return { arrow: '↘', cls: 'traj-dn' };
  return { arrow: '→', cls: 'traj-flat' };
}

// ─── Country Card ─────────────────────────────────────────────────────────────

function CountryCard({ country, intel, disruptionSeverity }) {
  const traj = trajectoryArrow(intel?.trajectory);
  const catColors = CATEGORY_BADGE_COLORS[country.topCategories?.[0]];

  return (
    <Link to={`/weekly/country/${encodeURIComponent(country.name)}`} className="clp-card">
      <div className="clp-card-head">
        <span className="clp-card-name">{country.name}</span>
        <RiskScoreBadge level={intel?.riskLevel} size="sm" />
        {disruptionSeverity && <SeverityBadge level={disruptionSeverity} size="sm" />}
        <span className={`clp-card-traj ${traj.cls}`}>{traj.arrow}</span>
      </div>

      {intel?.headline && (
        <div className="clp-card-headline">{intel.headline}</div>
      )}

      <div className="clp-card-foot">
        {catColors && (
          <span className="clp-cat-badge" style={{ background: catColors.bg, color: catColors.color }}>
            {country.topCategories[0]}
          </span>
        )}
        <span className="clp-card-meta">
          {country.articles} art · {country.arcCount} {country.arcCount !== 1 ? 'arcs' : 'arc'}
        </span>
        {intel?.riskSignals?.[0] && (
          <span className="clp-card-signal" title={intel.riskSignals[0]}>
            ⚑ {intel.riskSignals[0].length > 60 ? intel.riskSignals[0].slice(0, 57) + '…' : intel.riskSignals[0]}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Left Rail ────────────────────────────────────────────────────────────────

function LeftRail({ sortBy, onSort, searchQuery, onSearch, activeRegion, onRegion, regionCounts }) {
  return (
    <div className="clp-rail-left">
      <div className="clp-rail-section">
        <div className="clp-rail-label">Search</div>
        <input
          className="clp-search"
          type="text"
          placeholder="Filter countries…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <div className="clp-rail-section">
        <div className="clp-rail-label">Sort</div>
        <div className="clp-sort-group">
          {[['risk', 'Risk level'], ['articles', 'Coverage'], ['economy', 'Disruption'], ['alpha', 'A → Z']].map(([v, label]) => (
            <button
              key={v}
              className={`clp-sort-btn ${sortBy === v ? 'active' : ''}`}
              onClick={() => onSort(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {regionCounts.length > 1 && (
        <div className="clp-rail-section">
          <div className="clp-rail-label">Region</div>
          <div className="clp-region-group">
            <button
              className={`clp-region-btn ${!activeRegion ? 'active' : ''}`}
              onClick={() => onRegion(null)}
            >
              All
            </button>
            {regionCounts.map(([r, n]) => (
              <button
                key={r}
                className={`clp-region-btn ${activeRegion === r ? 'active' : ''}`}
                onClick={() => onRegion(activeRegion === r ? null : r)}
              >
                {r} <span className="clp-region-count">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Rail: Top-risk leaderboard ─────────────────────────────────────────

function RightRail({ featured, intelligence }) {
  const topRisk = useMemo(() =>
    [...featured]
      .sort((a, b) => {
        const ra = riskRank(intelligence?.[a.name]?.riskLevel);
        const rb = riskRank(intelligence?.[b.name]?.riskLevel);
        return ra !== rb ? ra - rb : b.articles - a.articles;
      })
      .slice(0, 5),
  [featured, intelligence]);

  return (
    <div className="clp-rail-right">
      <div className="clp-rail-label clp-rail-label--top">Highest Risk</div>
      <div className="clp-leaderboard">
        {topRisk.map((c, i) => {
          const intel = intelligence?.[c.name];
          const traj = trajectoryArrow(intel?.trajectory);
          return (
            <Link key={c.name} to={`/weekly/country/${encodeURIComponent(c.name)}`} className="clp-lb-row">
              <span className="clp-lb-rank">{i + 1}</span>
              <span className="clp-lb-name">{c.name}</span>
              <span className={`clp-lb-traj ${traj.cls}`}>{traj.arrow}</span>
              <RiskScoreBadge level={intel?.riskLevel} size="sm" />
            </Link>
          );
        })}
      </div>

      <div className="clp-rail-divider" />

      <div className="clp-rail-label">Most Covered</div>
      <div className="clp-leaderboard">
        {featured.slice(0, 5).map((c, i) => (
          <Link key={c.name} to={`/weekly/country/${encodeURIComponent(c.name)}`} className="clp-lb-row">
            <span className="clp-lb-rank">{i + 1}</span>
            <span className="clp-lb-name">{c.name}</span>
            <span className="clp-lb-count">{c.articles}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CountryListPage() {
  const navigate = useNavigate();
  const { dayMap, sortedDates, loading } = useWeeklyArchive();

  const handleCountryClick = useCallback((name) => {
    navigate(`/weekly/country/${encodeURIComponent(name)}`);
  }, [navigate]);

  const countries = useMemo(() => {
    if (!dayMap || loading) return [];
    const map = {};
    for (const date of sortedDates) {
      for (const entry of (dayMap[date]?.entries || [])) {
        for (const region of (entry.regions || [])) {
          if (!map[region]) map[region] = { name: region, articles: 0, threads: new Set(), categories: {} };
          map[region].articles++;
          if (entry.threadId) map[region].threads.add(entry.threadId);
          const cat = (entry.category || 'other').toLowerCase();
          map[region].categories[cat] = (map[region].categories[cat] || 0) + 1;
        }
      }
    }
    return Object.values(map)
      .filter(c => c.articles >= 2)
      .map(c => {
        const sortedCats = Object.entries(c.categories).sort((a, b) => b[1] - a[1]);
        return {
          name: c.name,
          articles: c.articles,
          arcCount: c.threads.size,
          topCategories: sortedCats.slice(0, 2).map(([cat]) => cat),
          region: getTopicRegion({ regions: [c.name] }),
        };
      })
      .sort((a, b) => b.articles - a.articles);
  }, [dayMap, sortedDates, loading]);

  const countryNames = useMemo(() => countries.slice(0, 10).map(c => c.name), [countries]);
  const { intelligence } = useCountryIntelligence(countryNames);
  const { data: allDisruptions = [] } = useDisruptionsList({ limit: 200 });

  // Map: countryName → max severity from any thread disruption involving that country
  const maxSeverityByCountry = useMemo(() => {
    const map = {};
    for (const d of allDisruptions) {
      const rank = SEVERITY_RANK[d.severity] || 0;
      for (const w of (d.winners || [])) {
        if (w.type !== 'country') continue;
        if (!map[w.name] || rank > SEVERITY_RANK[map[w.name]]) map[w.name] = d.severity;
      }
      for (const l of (d.losers || [])) {
        if (l.type !== 'country') continue;
        if (!map[l.name] || rank > SEVERITY_RANK[map[l.name]]) map[l.name] = d.severity;
      }
    }
    return map;
  }, [allDisruptions]);

  const [activeRegion, setActiveRegion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('risk');

  const featured = useMemo(() => countries
    .filter(c => intelligence?.[c.name])
    .sort((a, b) => {
      const ra = riskRank(intelligence[a.name]?.riskLevel);
      const rb = riskRank(intelligence[b.name]?.riskLevel);
      return ra !== rb ? ra - rb : b.articles - a.articles;
    }),
  [countries, intelligence]);

  const others = useMemo(() => countries.filter(c => !intelligence?.[c.name]), [countries, intelligence]);

  const regionCounts = useMemo(() => {
    const counts = {};
    for (const c of featured) {
      const r = c.region || 'World';
      counts[r] = (counts[r] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [featured]);

  const latestGeneratedAt = useMemo(() => {
    let latest = null;
    for (const name of Object.keys(intelligence || {})) {
      const gen = intelligence[name]?.generatedAt;
      if (gen && (!latest || gen > latest)) latest = gen;
    }
    return latest;
  }, [intelligence]);

  useEffect(() => { document.title = 'Country Intelligence — Global Perspectives'; }, []);

  if (loading) return <div className="weekly-loading">Loading country data…</div>;

  const q = searchQuery.trim().toLowerCase();

  let filteredFeatured = activeRegion
    ? featured.filter(c => (c.region || 'World') === activeRegion)
    : featured;
  if (q) {
    filteredFeatured = filteredFeatured.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (intelligence?.[c.name]?.headline || '').toLowerCase().includes(q)
    );
  }
  if (sortBy === 'alpha') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'articles') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => b.articles - a.articles);
  } else if (sortBy === 'economy') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => {
      const sa = SEVERITY_RANK[maxSeverityByCountry[a.name]] || 0;
      const sb = SEVERITY_RANK[maxSeverityByCountry[b.name]] || 0;
      return sb !== sa ? sb - sa : b.articles - a.articles;
    });
  }

  let filteredOthers = others;
  if (q) filteredOthers = filteredOthers.filter(c => c.name.toLowerCase().includes(q));

  const strip = (
    <StatusStrip
      label="LIVE"
      stats={[
        { value: featured.length, unit: 'briefings' },
        { value: countries.length, unit: 'countries' },
      ]}
      updatedAt={latestGeneratedAt}
    />
  );

  const left = (
    <LeftRail
      sortBy={sortBy}
      onSort={setSortBy}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      activeRegion={activeRegion}
      onRegion={setActiveRegion}
      regionCounts={regionCounts}
    />
  );

  const right = (
    <RightRail featured={featured} intelligence={intelligence} />
  );

  return (
    <EditorialShell strip={strip} left={left} right={right} className="clp-shell">
      {/* Map */}
      <div className="clp-map-wrap">
        <CountryOverviewMap
          countries={countries.map(c => ({
            name: c.name,
            articles: c.articles,
            riskLevel: intelligence?.[c.name]?.riskLevel || null,
            headline: intelligence?.[c.name]?.headline || null,
          }))}
          onCountryClick={handleCountryClick}
        />
        <div className="clp-map-legend">
          <span className="clp-leg"><span className="clp-leg-dot" style={{ background: 'var(--risk-h)' }} /> High</span>
          <span className="clp-leg"><span className="clp-leg-dot" style={{ background: 'var(--risk-e)' }} /> Elevated</span>
          <span className="clp-leg"><span className="clp-leg-dot" style={{ background: 'var(--risk-l)' }} /> Low</span>
        </div>
      </div>

      {/* AI Briefings grid */}
      {filteredFeatured.length > 0 && (
        <>
          <div className="clp-section-header">
            <span className="clp-section-title">AI Briefings</span>
            <span className="clp-section-hint">{filteredFeatured.length} countries</span>
          </div>
          <div className="clp-cards">
            {filteredFeatured.map(c => (
              <CountryCard
                key={c.name}
                country={c}
                intel={intelligence?.[c.name]}
                disruptionSeverity={maxSeverityByCountry[c.name]}
              />
            ))}
          </div>
        </>
      )}

      {/* Others */}
      {filteredOthers.length > 0 && (
        <div className="clp-others">
          <div className="clp-others-label">
            Other countries in the news ({filteredOthers.length}) — not enough coverage for AI briefing
          </div>
          <div className="clp-others-grid">
            {filteredOthers.map(c => (
              <Link key={c.name} to={`/weekly/country/${encodeURIComponent(c.name)}`} className="clp-others-item">
                <span className="clp-others-name">{c.name}</span>
                <span className="clp-others-count">{c.articles}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </EditorialShell>
  );
}
