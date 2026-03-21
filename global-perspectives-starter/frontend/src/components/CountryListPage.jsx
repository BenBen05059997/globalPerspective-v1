import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { getTopicRegion } from '../utils/countryMapping';
import { RISK_COLORS, CATEGORY_BADGE_COLORS } from './WeeklyPage';
import CountryOverviewMap from './CountryOverviewMap';
import SideNav from './SideNav';
import './WeeklyPage.css';

const RISK_ORDER = { high: 0, elevated: 1, moderate: 2, low: 3 };

function formatTimeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TREND_ICONS = {
  escalating: { arrow: '↗', label: 'Escalating', color: '#ef4444' },
  stable: { arrow: '→', label: 'Stable', color: '#6b7280' },
  'de-escalating': { arrow: '↘', label: 'De-escalating', color: '#10b981' },
};

const MOCK_COUNTRIES = [
  { name: 'United States', risk: 'moderate' },
  { name: 'China', risk: 'elevated' },
  { name: 'Ukraine', risk: 'high' },
  { name: 'India', risk: 'low' },
  { name: 'Israel', risk: 'high' },
  { name: 'Germany', risk: 'low' },
];

const LIST_FEATURES = [
  { icon: '🌍', label: 'Country Briefings', desc: 'AI situation summary for every major country' },
  { icon: '🔔', label: 'Risk Signals', desc: 'Watch triggers and trajectory predictions' },
  { icon: '🧵', label: 'Story Connections', desc: 'See how countries are linked through threads' },
];

export default function CountryListPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { dayMap, sortedDates, loading, error } = useWeeklyArchive();
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
  const [activeRegion, setActiveRegion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('risk');

  const featured = useMemo(() => countries
    .filter(c => intelligence?.[c.name])
    .sort((a, b) => {
      const ra = RISK_ORDER[intelligence[a.name]?.riskLevel] ?? 3;
      const rb = RISK_ORDER[intelligence[b.name]?.riskLevel] ?? 3;
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

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  if ((!user || (error && error.includes('401'))) && !import.meta.env.DEV) {
    const isUpgrade = !!user;
    return (
      <div className="country-preview-gate">
        <div className="thread-preview-header">
          <div className="thread-preview-title">Country Intelligence</div>
          <div className="thread-preview-stats">AI-powered briefings for every major country in the news</div>
        </div>
        <div className="wlp-preview-wrap">
          <div className="wlp-preview-blur">
            <div className="country-list-grid">
              {MOCK_COUNTRIES.map(c => {
                const risk = RISK_COLORS[c.risk];
                return (
                  <div key={c.name} className="country-list-card">
                    <div className="country-list-card-top">
                      <span className="country-list-card-name">{c.name}</span>
                      <span className="country-risk-badge" style={{ background: risk.bg, color: risk.color }}>{c.risk}</span>
                    </div>
                    <div className="country-list-card-meta">12 articles · 3 arcs</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="wlp-overlay">
            <div className="wlp-cta">
              <div className="wlp-cta-title">{isUpgrade ? 'Upgrade for country intelligence' : 'Sign in for country intelligence'}</div>
              <div className="wlp-cta-desc">Risk signals, trajectory predictions, and cross-thread analysis for every major country</div>
              <div className="wlp-features" style={{ marginBottom: 16 }}>
                {LIST_FEATURES.map(f => (
                  <div key={f.label} className="wlp-feature-card">
                    <span className="wlp-feature-icon">{f.icon}</span>
                    <span className="wlp-feature-label">{f.label}</span>
                    <span className="wlp-feature-desc">{f.desc}</span>
                  </div>
                ))}
              </div>
              <div className="wlp-cta-btns">
                {isUpgrade
                  ? <Link to="/pricing" className="wlp-btn-primary">Get Member access →</Link>
                  : <Link to="/signin" className="wlp-btn-primary">Sign in free →</Link>
                }
                <Link to={isUpgrade ? '/' : '/pricing'} className="wlp-btn-secondary">
                  {isUpgrade ? 'Back to free content' : 'See Member plans'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="weekly-loading">Loading country data…</div>;

  const q = searchQuery.trim().toLowerCase();
  let filteredFeatured = activeRegion
    ? featured.filter(c => (c.region || 'World') === activeRegion)
    : featured;
  if (q) filteredFeatured = filteredFeatured.filter(c => c.name.toLowerCase().includes(q) || (intelligence?.[c.name]?.headline || '').toLowerCase().includes(q));

  // Sort
  if (sortBy === 'alpha') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'articles') {
    filteredFeatured = [...filteredFeatured].sort((a, b) => b.articles - a.articles);
  }

  let filteredOthers = others;
  if (q) filteredOthers = filteredOthers.filter(c => c.name.toLowerCase().includes(q));

  // Derive trend from trajectory text
  function getTrend(intel) {
    const text = (intel?.trajectory || '').toLowerCase();
    if (/escalat|intensif|worsen|heighten|spike|surge/.test(text)) return TREND_ICONS.escalating;
    if (/de-escalat|improv|eas|calm|stabili|wind down/.test(text)) return TREND_ICONS['de-escalating'];
    return TREND_ICONS.stable;
  }

  return (
    <div className="thread-page">
      <div className="thread-page-body">
        <div className="page-with-sidenav">
        <div className="page-main-content">
        <h1 id="cl-section-overview" className="thread-page-title">Country Intelligence</h1>
        <p className="country-list-subtitle">
          AI situation briefings for the most-covered countries. Tap a country on the map or below for its full assessment.
          {latestGeneratedAt && (
            <span className="cl-updated"> · Updated {formatTimeAgo(latestGeneratedAt)}</span>
          )}
        </p>

        <div className="cl-controls">
          <input
            type="text"
            className="cl-search"
            placeholder="Search countries…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select className="cl-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="risk">Sort: Risk level</option>
            <option value="articles">Sort: Most covered</option>
            <option value="alpha">Sort: A → Z</option>
          </select>
        </div>

        <div id="cl-section-map" className="cl-map-hint">Dot size = coverage volume · Color = risk level · Click any country for its full briefing</div>
        <div className="cl-map-hero">
          <CountryOverviewMap
            countries={countries.map(c => ({
              name: c.name,
              articles: c.articles,
              riskLevel: intelligence?.[c.name]?.riskLevel || null,
              headline: intelligence?.[c.name]?.headline || null,
            }))}
            onCountryClick={handleCountryClick}
          />
        </div>

        {/* Legend */}
        <div className="cl-legend">
          <span className="cl-legend-item"><span className="cl-legend-dot" style={{ background: '#ef4444' }} /> High</span>
          <span className="cl-legend-item"><span className="cl-legend-dot" style={{ background: '#f97316' }} /> Elevated</span>
          <span className="cl-legend-item"><span className="cl-legend-dot" style={{ background: '#eab308' }} /> Moderate</span>
          <span className="cl-legend-item"><span className="cl-legend-dot" style={{ background: '#22c55e' }} /> Low</span>
          <span className="cl-legend-sep" />
          <span className="cl-legend-item">↗ Escalating</span>
          <span className="cl-legend-item">→ Stable</span>
          <span className="cl-legend-item">↘ De-escalating</span>
        </div>

        {/* Region filter pills */}
        {regionCounts.length > 1 && (
          <div className="cl-filters">
            <button className={`cl-filter-pill ${!activeRegion ? 'active' : ''}`} onClick={() => setActiveRegion(null)}>
              All ({featured.length})
            </button>
            {regionCounts.map(([region, count]) => (
              <button
                key={region}
                className={`cl-filter-pill ${activeRegion === region ? 'active' : ''}`}
                onClick={() => setActiveRegion(activeRegion === region ? null : region)}
              >
                {region} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Featured cards — countries with AI intelligence */}
        {filteredFeatured.length > 0 && (
          <div id="cl-section-briefings" className="cl-section-header">
            <span className="cl-section-title">AI Briefings</span>
            <span className="cl-section-hint">Countries with enough coverage for full AI analysis — click for details</span>
          </div>
        )}
        {filteredFeatured.length > 0 && (
          <div className="cl-featured">
            {filteredFeatured.map(c => {
              const intel = intelligence[c.name];
              const risk = RISK_COLORS[intel.riskLevel] || RISK_COLORS.moderate;
              const trend = getTrend(intel);
              return (
                <Link key={c.name} to={`/weekly/country/${encodeURIComponent(c.name)}`} className="cl-featured-card" style={{ borderLeftColor: risk.color }}>
                  <div className="cl-featured-top">
                    <span className="cl-featured-name">{c.name}</span>
                    <span className="cl-risk-dot" style={{ color: risk.color }}>● {intel.riskLevel || 'moderate'}</span>
                    <span className="cl-trend" style={{ color: trend.color }}>{trend.arrow} {trend.label}</span>
                  </div>
                  {intel.headline && (
                    <div className="cl-featured-headline">{intel.headline}</div>
                  )}
                  <div className="cl-featured-bottom">
                    <div className="cl-featured-tags">
                      {c.topCategories.map(cat => {
                        const cc = CATEGORY_BADGE_COLORS[cat];
                        return (
                          <span key={cat} className="story-category-badge" style={cc ? { background: cc.bg, color: cc.color, fontSize: 10, padding: '1px 7px' } : {}}>
                            {cat}
                          </span>
                        );
                      })}
                    </div>
                    <span className="cl-featured-meta">
                      {c.articles} articles · {c.arcCount} {c.arcCount !== 1 ? 'stories' : 'story'}
                    </span>
                    <span className="cl-featured-cta">View briefing →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Other countries — compact pills */}
        {filteredOthers.length > 0 && (
          <div id="cl-section-others" className="cl-others">
            <div className="cl-others-label">Other countries in the news ({filteredOthers.length}) — not enough coverage yet for AI briefing</div>
            <div className="cl-others-grid">
              {filteredOthers.map(c => (
                <Link key={c.name} to={`/weekly/country/${encodeURIComponent(c.name)}`} className="cl-others-item">
                  <span className="cl-others-name">{c.name}</span>
                  <span className="cl-others-count">{c.articles}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>
        <SideNav sections={[
          { id: 'cl-section-overview', label: 'Overview' },
          { id: 'cl-section-map', label: 'Map' },
          ...(filteredFeatured.length > 0 ? [{ id: 'cl-section-briefings', label: 'AI Briefings', count: filteredFeatured.length }] : []),
          ...(filteredOthers.length > 0 ? [{ id: 'cl-section-others', label: 'Others', count: filteredOthers.length }] : []),
        ]} />
        </div>
      </div>
    </div>
  );
}
