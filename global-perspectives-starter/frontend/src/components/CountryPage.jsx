import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link, useHref } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { formatDateLabel } from '../utils/dateUtils';
import { getBroadRegionsForCountry } from '../utils/countryMapping';
import WeeklyMap from './WeeklyMap';
import ShareButtons from './ShareButtons';
import { CATEGORY_BADGE_COLORS, RISK_COLORS } from './WeeklyPage';
import SectionNav from './SectionNav';
import SideNav from './SideNav';
import TrialBanner from './TrialBanner';
import { useUserProfile } from '../hooks/useUserProfile';
import BackgroundTimeline from './BackgroundTimeline';
import './WeeklyPage.css';

function formatTimeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TRAJECTORY_BADGES = {
  escalating: { arrow: '↗', label: 'Escalating', color: '#ef4444' },
  stable: { arrow: '→', label: 'Stable', color: '#6b7280' },
  'de-escalating': { arrow: '↘', label: 'De-escalating', color: '#10b981' },
};

const RISK_DOTS = ['low', 'moderate', 'elevated', 'high'];

function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )}</>;
}

function CopyLinkBtn({ countryName }) {
  const [copied, setCopied] = useState(false);
  const href = useHref(`/weekly/country/${encodeURIComponent(countryName)}`);
  const url = `${window.location.origin}${href}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className={`cp-share-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy link">
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      )}
    </button>
  );
}

function ArcSection({ arcs, threadAnalyses, countryName }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cp-arcs">
      <button className="cp-arcs-header" onClick={() => setOpen(!open)}>
        <span className="cp-arcs-label">Active story arcs</span>
        <span className="cp-arcs-count">{arcs.length}</span>
        <span className={`cp-day-chevron ${open ? 'open' : ''}`}>&#9662;</span>
      </button>
      {open && (
        <div className="cp-arcs-list">
          {arcs.map(arc => {
            const c = CATEGORY_BADGE_COLORS[arc.category];
            const title = threadAnalyses?.[arc.threadId]?.threadTitle || arc.latestTitle;
            return (
              <Link key={arc.threadId} to={`/weekly/thread/${arc.threadId}?from=country&country=${encodeURIComponent(countryName)}`} className="cp-arc-row">
                {c && <span className="cp-arc-dot" style={{ background: c.color }} />}
                <span className="cp-arc-cat">{arc.category}</span>
                <span className="cp-arc-title">{title}</span>
                <span className="cp-arc-meta">{arc.articleCount} articles · {arc.dayCount}d</span>
                <span className="cp-arc-arrow">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CoverageList({ entries }) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [activeAi, setActiveAi] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [collapsedDates, setCollapsedDates] = useState(new Set());
  const [showAllDays, setShowAllDays] = useState(false);

  const categories = useMemo(() => {
    const counts = {};
    for (const e of entries) {
      const cat = (e.category || 'other').toLowerCase();
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filtered = activeCat
    ? entries.filter(e => (e.category || 'other').toLowerCase() === activeCat)
    : entries;

  const dayGroups = useMemo(() => {
    const groups = {};
    for (const entry of filtered) {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const toggleDate = (date) => {
    setCollapsedDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="cp-coverage">
      <button className="cp-coverage-toggle" onClick={() => setOpen(!open)}>
        <span className="cp-coverage-label">Related coverage ({entries.length})</span>
        <span className={`cp-day-chevron ${open ? 'open' : ''}`}>&#9662;</span>
      </button>
      {open && <>
      <div className="cp-coverage-header">
        <div className="cp-coverage-hint">Tap an article for sources and AI analysis</div>
        {categories.length > 1 && (
          <div className="cp-coverage-filters">
            <button className={`cp-cov-filter ${!activeCat ? 'active' : ''}`} onClick={() => setActiveCat(null)}>All</button>
            {categories.map(([cat, count]) => {
              const c = CATEGORY_BADGE_COLORS[cat];
              const isActive = activeCat === cat;
              return (
                <button
                  key={cat}
                  className={`cp-cov-filter ${isActive ? 'active' : ''}`}
                  style={isActive && c ? { background: c.bg, color: c.color, borderColor: c.bg } : {}}
                  onClick={() => setActiveCat(isActive ? null : cat)}
                >
                  {cat} {count}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="cp-coverage-list">
        {(showAllDays ? dayGroups : dayGroups.slice(0, 3)).map(([date, dayEntries]) => {
          const isCollapsed = collapsedDates.has(date);
          return (
            <div key={date} className="cp-day-group">
              <button className="cp-day-header" onClick={() => toggleDate(date)}>
                <span className="cp-day-date">{formatDateLabel(date)}</span>
                <span className="cp-day-count">{dayEntries.length} article{dayEntries.length !== 1 ? 's' : ''}</span>
                <span className={`cp-day-chevron ${isCollapsed ? '' : 'open'}`}>&#9662;</span>
              </button>
              {!isCollapsed && dayEntries.map((entry, i) => {
                const id = entry.topicId || `${date}-${i}`;
                const isExpanded = expandedId === id;
                const hasAi = entry.ai?.summary || entry.ai?.prediction || entry.ai?.trace_cause;
                const aiKey = activeAi === 'trace' ? 'trace_cause' : activeAi;
                const cat = (entry.category || 'other').toLowerCase();
                const catColor = CATEGORY_BADGE_COLORS[cat];
                return (
                  <div key={id} id={`coverage-${entry.topicId || id}`} className={`cp-coverage-item ${isExpanded ? 'expanded' : ''}`}>
                    <div className="cp-coverage-row" onClick={() => { setExpandedId(isExpanded ? null : id); setActiveAi(null); }}>
                      {catColor && <span className="story-category-badge" style={{ background: catColor.bg, color: catColor.color, fontSize: 9, padding: '1px 6px' }}>{cat}</span>}
                      <span className="cp-coverage-title">{entry.title}</span>
                      {entry.threadId && <span className="cp-arc-hint">arc</span>}
                      <span className={`cp-coverage-chevron ${isExpanded ? 'open' : ''}`}>&#9662;</span>
                    </div>
                    {isExpanded && (
                      <div className="cp-coverage-body">
                        {entry.sources && entry.sources.length > 0 && (
                          <div className="cp-coverage-sources">
                            {entry.sources.slice(0, 5).map((s, j) => (
                              <span key={j} className="story-entry-source-tag">
                                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source || s.title || 'Source'}</a> : (s.source || s.title || 'Source')}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="cp-coverage-actions">
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(entry.title)}&tbm=nws&tbs=qdr:d`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cp-google-news-btn"
                          >
                            View Google News ↗
                          </a>
                          {entry.threadId && (
                            <Link to={`/weekly/thread/${entry.threadId}`} className="cp-view-arc-btn">
                              View full story →
                            </Link>
                          )}
                        </div>
                        {hasAi && (
                          <div className="ai-toolbar" style={{ marginTop: 8 }}>
                            {entry.ai?.summary && (
                              <button className={`ai-btn ai-btn-summary ${activeAi === 'summary' ? 'active' : ''}`} onClick={() => setActiveAi(activeAi === 'summary' ? null : 'summary')}>Summarize</button>
                            )}
                            {entry.ai?.prediction && (
                              <button className={`ai-btn ai-btn-predict ${activeAi === 'prediction' ? 'active' : ''}`} onClick={() => setActiveAi(activeAi === 'prediction' ? null : 'prediction')}>Predict</button>
                            )}
                            {entry.ai?.trace_cause && (
                              <button className={`ai-btn ai-btn-trace ${activeAi === 'trace' ? 'active' : ''}`} onClick={() => setActiveAi(activeAi === 'trace' ? null : 'trace')}>Trace Cause</button>
                            )}
                          </div>
                        )}
                        {activeAi && entry.ai?.[aiKey] && (
                          <div className={`story-entry-ai-content ${activeAi}`}>
                            <div className="story-entry-section-text">{entry.ai[aiKey]}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {!showAllDays && dayGroups.length > 3 && (
          <button
            className="weekly-category-show-more"
            onClick={() => setShowAllDays(true)}
            style={{ marginTop: 8 }}
          >
            Show {dayGroups.length - 3} more day{dayGroups.length - 3 !== 1 ? 's' : ''}
          </button>
        )}
        {dayGroups.length === 0 && (
          <div className="cp-empty" style={{ padding: '1rem 0' }}>No articles match this filter.</div>
        )}
      </div>
      </>}
    </div>
  );
}

const COUNTRY_PREVIEW_FEATURES = [
  { icon: '🌍', label: 'Country Briefing', desc: 'AI situation summary with risk assessment' },
  { icon: '🔔', label: 'Risk Signals', desc: 'Watch triggers and trajectory predictions' },
  { icon: '🧵', label: 'Cross-Thread Analysis', desc: 'How stories in this country connect' },
];

const MOCK_COVERAGE = [
  'Diplomatic developments draw international response…',
  'Economic policy shift signals change in direction…',
  'Regional security concerns prompt multilateral talks…',
];

function CountryPreviewGate({ countryName, searchParams, ctaTitle, ctaPrimary, ctaSecondary }) {
  const headline = searchParams.get('h');
  const articles = parseInt(searchParams.get('n')) || null;
  const days = parseInt(searchParams.get('d')) || null;

  return (
    <div className="country-preview-gate">
      <div className="thread-preview-header">
        <div className="thread-preview-title">{countryName}</div>
        {headline && <div className="cp-headline">{headline}</div>}
        {(articles || days) && (
          <div className="thread-preview-stats">
            {articles && <>{articles} article{articles !== 1 ? 's' : ''}</>}
            {articles && days && ' across '}
            {days && <>{days} day{days !== 1 ? 's' : ''}</>}
          </div>
        )}
      </div>

      <div className="wlp-preview-wrap">
        <div className="wlp-preview-blur">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span className="country-risk-badge" style={{ background: RISK_COLORS.moderate.bg, color: RISK_COLORS.moderate.color }}>moderate</span>
          </div>
          <div className="ai-toolbar" style={{ marginBottom: 12 }}>
            <button className="ai-btn ai-btn-summary" disabled>Summarize</button>
            <button className="ai-btn ai-btn-predict" disabled>What's Next</button>
            <button className="ai-btn ai-btn-trace" disabled>How It Happened</button>
          </div>
          {MOCK_COVERAGE.map((text, i) => (
            <div key={i} className="cp-coverage-item" style={{ padding: '10px 0', borderBottom: '1px solid #e5e7eb' }}>
              <span className="cp-coverage-title">{text}</span>
            </div>
          ))}
        </div>
        <div className="wlp-overlay">
          <div className="wlp-cta">
            <div className="wlp-cta-title">{ctaTitle}</div>
            <div className="wlp-cta-desc">AI-powered country briefing with risk signals, trajectory predictions, and cross-thread analysis</div>
            <div className="wlp-features" style={{ marginBottom: 16 }}>
              {COUNTRY_PREVIEW_FEATURES.map(f => (
                <div key={f.label} className="wlp-feature-card">
                  <span className="wlp-feature-icon">{f.icon}</span>
                  <span className="wlp-feature-label">{f.label}</span>
                  <span className="wlp-feature-desc">{f.desc}</span>
                </div>
              ))}
            </div>
            <div className="wlp-cta-btns">
              {ctaPrimary}
              {ctaSecondary}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CountryPage() {
  const { countryName } = useParams();
  const paramName = decodeURIComponent(countryName);
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { dayMap, sortedDates, loading, error } = useWeeklyArchive();
  const [activeTab, setActiveTab] = useState('situationSummary');
  const [showExplainer, setShowExplainer] = useState(
    () => !localStorage.getItem('gp_country_explainer_dismissed')
  );
  const [selectedCountry, setSelectedCountry] = useState(paramName);

  const decodedName = selectedCountry || paramName;

  useEffect(() => { setSelectedCountry(paramName); }, [paramName]);

  function selectCountry(name) {
    setSelectedCountry(name);
    setActiveTab(null);
    navigate(`/weekly/country/${encodeURIComponent(name)}`, { replace: true });
  }

  const { countries, countryData } = useMemo(() => {
    if (!dayMap || loading) return { countries: [], countryData: null };
    const map = {};
    for (const date of sortedDates) {
      for (const entry of (dayMap[date]?.entries || [])) {
        for (const region of (entry.regions || [])) {
          if (!map[region]) map[region] = { name: region, articles: 0, entries: [] };
          map[region].articles++;
          map[region].entries.push({ ...entry, date });
        }
      }
    }

    const allCountries = Object.values(map)
      .filter(c => c.articles >= 2 || c.name === decodedName)
      .sort((a, b) => b.articles - a.articles);

    const broadRegions = getBroadRegionsForCountry(decodedName);
    const directEntries = map[decodedName]?.entries || [];
    const seen = new Set(directEntries.map(e => e.topicId));
    const broadEntries = [];
    for (const region of broadRegions) {
      for (const entry of (map[region]?.entries || [])) {
        if (!seen.has(entry.topicId)) {
          seen.add(entry.topicId);
          broadEntries.push(entry);
        }
      }
    }
    const allEntries = [...directEntries, ...broadEntries];

    let data = null;
    if (allEntries.length > 0) {
      const dates = [...new Set(allEntries.map(e => e.date))].sort();
      const threadMap = {};
      for (const e of allEntries) {
        if (!e.threadId) continue;
        if (!threadMap[e.threadId]) threadMap[e.threadId] = { entries: [], category: (e.category || 'other').toLowerCase() };
        threadMap[e.threadId].entries.push(e);
      }
      const arcs = Object.entries(threadMap)
        .filter(([, t]) => t.entries.length >= 2)
        .map(([threadId, t]) => ({
          threadId,
          latestTitle: t.entries[0].title,
          articleCount: t.entries.length,
          category: t.category,
          dayCount: new Set(t.entries.map(e => e.date)).size,
        }))
        .sort((a, b) => b.articleCount - a.articleCount);

      data = {
        countryName: decodedName,
        totalArticles: allEntries.length,
        entries: allEntries.sort((a, b) => b.date.localeCompare(a.date)),
        arcs,
        dateRange: { from: dates[0], to: dates[dates.length - 1] },
        dayCount: dates.length,
      };
    }

    return { countries: allCountries, countryData: data };
  }, [dayMap, sortedDates, decodedName, loading]);

  const arcIds = useMemo(() => (countryData?.arcs || []).map(a => a.threadId), [countryData]);
  const { analyses: threadAnalyses } = useThreadAnalyses(arcIds);
  const { intelligence } = useCountryIntelligence(decodedName ? [decodedName] : []);
  const intel = intelligence?.[decodedName];

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  if (!user && !import.meta.env.DEV) {
    return (
      <CountryPreviewGate
        countryName={paramName}
        searchParams={searchParams}
        ctaTitle={`Sign in for ${paramName} intelligence`}
        ctaPrimary={<Link to="/signin" className="wlp-btn-primary">Sign in free →</Link>}
        ctaSecondary={<Link to="/pricing" className="wlp-btn-secondary">See Member plans</Link>}
      />
    );
  }

  if (error && error.includes('401')) {
    return (
      <CountryPreviewGate
        countryName={paramName}
        searchParams={searchParams}
        ctaTitle={`Upgrade for ${paramName} intelligence`}
        ctaPrimary={<Link to="/pricing" className="wlp-btn-primary">Get Member access →</Link>}
        ctaSecondary={<Link to="/" className="wlp-btn-secondary">Back to free content</Link>}
      />
    );
  }

  if (loading) return <div className="weekly-loading">Loading…</div>;

  const risk = intel ? (RISK_COLORS[intel.riskLevel] || RISK_COLORS.moderate) : null;
  const trajectory = intel?.trajectory ? (TRAJECTORY_BADGES[intel.trajectory] || TRAJECTORY_BADGES.stable) : null;

  function dismissExplainer() {
    localStorage.setItem('gp_country_explainer_dismissed', '1');
    setShowExplainer(false);
  }

  return (
    <div className="cp-page">
      {/* ── Map hero ── */}
      <div className="cp-map-hero">
        <div className="cp-map-overlay">
          <Link to="/weekly/countries" className="cp-back">← Countries</Link>
          <select
            className="cp-country-select"
            value={decodedName}
            onChange={e => selectCountry(e.target.value)}
          >
            {countries.map(c => (
              <option key={c.name} value={c.name}>{c.name} ({c.articles})</option>
            ))}
          </select>
          <CopyLinkBtn countryName={decodedName} />
        </div>
        {loading ? (
          <div className="cp-map-loading">Loading map…</div>
        ) : (
          <WeeklyMap embedded defaultCountry={decodedName} hidePanel onCountryClick={selectCountry} />
        )}
      </div>

      {profile?.isTrial && <TrialBanner daysLeft={profile.trialDaysLeft} />}

      {/* ── Info panel ── */}
      <div className="cp-panel">
        {!countryData ? (
          <div className="cp-empty">
            <h3>No coverage for {decodedName}</h3>
            <p>This country has no recent news in the archive.</p>
          </div>
        ) : (
          <div className="page-with-sidenav">
            <div className="page-main-content">
          <>
            {/* ── Header + Risk ── */}
            <div id="cp-section-overview" className="cp-header">
              <div>
                <h1 className="cp-title">{decodedName}</h1>
                <div className="cp-subtitle">
                  AI-powered situation briefing
                  {intel?.generatedAt && <> · Updated {formatTimeAgo(intel.generatedAt)}</>}
                </div>
              </div>
              {risk && (
                <div className="cp-risk-indicator">
                  <div className="cp-risk-dots">
                    {RISK_DOTS.map(level => (
                      <span
                        key={level}
                        className={`cp-risk-dot-item ${RISK_DOTS.indexOf(level) <= RISK_DOTS.indexOf(intel.riskLevel) ? 'filled' : ''}`}
                        style={RISK_DOTS.indexOf(level) <= RISK_DOTS.indexOf(intel.riskLevel) ? { background: risk.color } : {}}
                      />
                    ))}
                  </div>
                  <span className="cp-risk-text" style={{ color: risk.color }}>{(intel.riskLevel || 'moderate').toUpperCase()}</span>
                  {trajectory && (
                    <span className="cp-trajectory" style={{ color: trajectory.color }}>{trajectory.arrow} {trajectory.label}</span>
                  )}
                </div>
              )}
            </div>

            {/* ── Headline ── */}
            {intel?.headline && (
              <div className="cp-headline">{intel.headline}</div>
            )}

            {/* ── Key Metrics Strip (near header) ── */}
            <div className="cp-metrics">
              <div className="cp-metric">
                <span className="cp-metric-value">{countryData.totalArticles}</span>
                <span className="cp-metric-label">articles</span>
              </div>
              <div className="cp-metric">
                <span className="cp-metric-value">{countryData.arcs?.length || 0}</span>
                <span className="cp-metric-label">stories</span>
              </div>
              <div className="cp-metric">
                <span className="cp-metric-value">{countryData.dayCount}</span>
                <span className="cp-metric-label">days</span>
              </div>
            </div>

            <SectionNav sections={[
              { id: 'cp-section-overview', label: 'Overview' },
              ...(intel?.bluf ? [{ id: 'cp-section-bluf', label: 'Bottom Line' }] : []),
              ...(intel?.keyDevelopments?.length ? [{ id: 'cp-section-developments', label: 'Developments' }] : []),
              ...(intel?.whyItMatters ? [{ id: 'cp-section-why', label: 'Why It Matters' }] : []),
              ...(intel?.situationSummary || intel?.trajectoryDetail || intel?.crossThreadInsight ? [{ id: 'cp-section-analysis', label: 'Analysis' }] : []),
              ...(intel?.riskSignals?.length ? [{ id: 'cp-section-watch', label: 'Watch' }] : []),
              ...(countryData.arcs?.length ? [{ id: 'cp-section-arcs', label: 'Story Arcs' }] : []),
              { id: 'cp-section-coverage', label: 'Coverage' },
            ]} />

            {/* ── BLUF (Bottom Line Up Front) ── */}
            {intel?.bluf && (
              <div id="cp-section-bluf" className="cp-bluf">
                <div className="cp-section-label">BOTTOM LINE</div>
                <div className="cp-bluf-text">{intel.bluf}</div>
              </div>
            )}

            {/* ── Key Developments Timeline ── */}
            {intel?.keyDevelopments?.length > 0 && (
              <div id="cp-section-developments" className="cp-developments">
                <div className="cp-section-label">KEY DEVELOPMENTS</div>
                <div className="cp-dev-timeline">
                  {intel.keyDevelopments.map((d, i) => (
                    <div key={i} className="cp-dev-item">
                      <span className="cp-dev-date">{formatDateLabel(d.date)}</span>
                      <span className="cp-dev-dot" />
                      <span className="cp-dev-text">{d.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Why It Matters ── */}
            {intel?.whyItMatters && (
              <div id="cp-section-why" className="cp-why">
                <div className="cp-section-label">WHY IT MATTERS</div>
                <div className="cp-why-text"><BoldText text={intel.whyItMatters} /></div>
              </div>
            )}

            {/* ── Explainer (dismissible) ── */}
            {showExplainer && (
              <div className="cp-explainer">
                <span>This briefing is generated daily by AI, synthesizing {countryData.totalArticles} articles from {formatDateLabel(countryData.dateRange.from)} — {formatDateLabel(countryData.dateRange.to)}</span>
                <button className="cp-explainer-dismiss" onClick={dismissExplainer}>Got it</button>
              </div>
            )}

            <ShareButtons path={`/weekly/country/${encodeURIComponent(decodedName)}`} title={`${decodedName} — Country Intelligence`} preview={{ h: intel?.headline, n: countryData?.totalArticles, d: countryData?.dayCount }} />

            {/* ── Background Timeline ── */}
            {intel?.backgroundTimeline?.length > 0 && (
              <div id="cp-section-timeline">
                <BackgroundTimeline
                  events={intel.backgroundTimeline}
                  entries={countryData.entries}
                  onEventClick={(topicId, date) => {
                    const el = document.getElementById(`coverage-${topicId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('highlight-flash');
                      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                    } else {
                      const section = document.getElementById('cp-section-coverage');
                      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                />
              </div>
            )}

            {/* ── Deep Analysis (expandable sections) ── */}
            {(intel?.trajectoryDetail || intel?.crossThreadInsight) && (
              <div id="cp-section-analysis" className="cp-deep">
                {[
                  { key: 'trajectoryDetail', label: "What's Next", cssClass: 'prediction' },
                  { key: 'crossThreadInsight', label: 'Cross-Thread Connections', cssClass: 'trace' },
                ].filter(t => intel[t.key]).map(tab => (
                  <div key={tab.key} className="cp-deep-section">
                    <button
                      className={`cp-deep-toggle ${activeTab === tab.key ? 'active' : ''}`}
                      onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
                    >
                      <span>{tab.label}</span>
                      <span className={`cp-deep-chevron ${activeTab === tab.key ? 'open' : ''}`}>&#9662;</span>
                    </button>
                    {activeTab === tab.key && (
                      <div className={`story-entry-ai-content ${tab.cssClass}`}>
                        <div className="story-entry-section-text"><BoldText text={intel[tab.key]} /></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!intel && (
              <div className="cp-ai-pending">Country analysis generates daily — check back soon</div>
            )}

            {/* ── Watch Triggers (chips) ── */}
            {intel?.riskSignals?.length > 0 && (
              <div id="cp-section-watch" className="cp-watch">
                <div className="cp-section-label">WHAT TO WATCH</div>
                <div className="cp-watch-chips">
                  {intel.riskSignals.map((s, i) => (
                    <div key={i} className="cp-watch-chip">⚡ {s}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Active arcs ── */}
            {countryData.arcs.length > 0 && (
              <div id="cp-section-arcs" />
            )}
            {countryData.arcs.length > 0 && (
              <ArcSection arcs={countryData.arcs} threadAnalyses={threadAnalyses} countryName={decodedName} />
            )}

            {/* ── Related coverage ── */}
            <div id="cp-section-coverage" />
            <CoverageList entries={countryData.entries} />
          </>
            </div>
            <SideNav sections={[
              { id: 'cp-section-overview', label: 'Overview' },
              ...(intel?.bluf ? [{ id: 'cp-section-bluf', label: 'Bottom Line' }] : []),
              ...(intel?.keyDevelopments?.length ? [{ id: 'cp-section-developments', label: 'Developments', count: intel.keyDevelopments.length }] : []),
              ...(intel?.whyItMatters ? [{ id: 'cp-section-why', label: 'Why It Matters' }] : []),
              ...(intel?.backgroundTimeline?.length ? [{ id: 'cp-section-timeline', label: 'Timeline', count: intel.backgroundTimeline.length }] : []),
              ...(intel?.crossThreadInsight || intel?.trajectoryDetail ? [{ id: 'cp-section-analysis', label: 'Analysis' }] : []),
              ...(intel?.riskSignals?.length ? [{ id: 'cp-section-watch', label: 'Watch', count: intel.riskSignals.length }] : []),
              ...(countryData.arcs?.length ? [{ id: 'cp-section-arcs', label: 'Story Arcs', count: countryData.arcs.length }] : []),
              { id: 'cp-section-coverage', label: 'Coverage', count: countryData.totalArticles },
            ]} />
          </div>
        )}
      </div>
    </div>
  );
}
