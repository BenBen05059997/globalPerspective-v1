import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { RISK_COLORS, CATEGORY_BADGE_COLORS } from './WeeklyPage';
import './WeeklyPage.css';

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
  const { dayMap, sortedDates, loading, error } = useWeeklyArchive();

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
      .map(c => ({
        name: c.name,
        articles: c.articles,
        arcCount: c.threads.size,
        topCategory: Object.entries(c.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other',
      }))
      .sort((a, b) => b.articles - a.articles);
  }, [dayMap, sortedDates, loading]);

  const countryNames = useMemo(() => countries.slice(0, 10).map(c => c.name), [countries]);
  const { intelligence } = useCountryIntelligence(countryNames);

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  if (!user || (error && error.includes('401'))) {
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

  return (
    <div className="thread-page">
      <div className="thread-page-topbar">
        <Link to="/weekly" className="thread-page-back">← Weekly Analysis</Link>
      </div>
      <div className="thread-page-body">
        <h1 className="thread-page-title">Country Intelligence</h1>
        <p className="country-list-subtitle">
          AI-powered briefings for the {countries.length} most-covered countries. Select a country for its full situation assessment, trajectory, and risk signals.
        </p>

        <div className="country-list-grid">
          {countries.map(c => {
            const intel = intelligence?.[c.name];
            const risk = intel ? (RISK_COLORS[intel.riskLevel] || RISK_COLORS.moderate) : null;
            return (
              <Link key={c.name} to={`/weekly/country/${encodeURIComponent(c.name)}`} className="country-list-card">
                <div className="country-list-card-top">
                  <span className="country-list-card-name">{c.name}</span>
                  {risk && (
                    <span className="country-risk-badge" style={{ background: risk.bg, color: risk.color }}>
                      {intel.riskLevel}
                    </span>
                  )}
                </div>
                {intel?.headline && (
                  <div className="country-list-card-headline">{intel.headline}</div>
                )}
                <div className="country-list-card-meta">
                  {c.articles} articles · {c.arcCount} arc{c.arcCount !== 1 ? 's' : ''}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
