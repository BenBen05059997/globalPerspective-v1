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
import './WeeklyPage.css';

const TABS = [
  { key: 'situationSummary', label: 'Summarize', cssClass: 'summary' },
  { key: 'trajectory', label: "What's Next", cssClass: 'prediction' },
  { key: 'crossThreadInsight', label: 'How It Happened', cssClass: 'trace' },
];

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
  const [expandedId, setExpandedId] = useState(null);
  const [activeAi, setActiveAi] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [collapsedDates, setCollapsedDates] = useState(new Set());

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
      <div className="cp-coverage-header">
        <div className="cp-coverage-label">Related coverage <span className="cp-coverage-hint">— tap an article for sources and AI analysis</span></div>
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
        {dayGroups.map(([date, dayEntries]) => {
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
                  <div key={id} className={`cp-coverage-item ${isExpanded ? 'expanded' : ''}`}>
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
        {dayGroups.length === 0 && (
          <div className="cp-empty" style={{ padding: '1rem 0' }}>No articles match this filter.</div>
        )}
      </div>
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
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { dayMap, sortedDates, loading, error } = useWeeklyArchive();
  const [activeTab, setActiveTab] = useState(null);
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

  if (!user) {
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
  const availableTabs = intel ? TABS.filter(t => intel[t.key]) : [];
  const activeCss = TABS.find(t => t.key === activeTab)?.cssClass || '';

  return (
    <div className="cp-page">
      {/* ── Page hint ── */}
      <div className="cp-page-hint">
        Select a country to see which nations it interacts with, play its news evolution day by day, and read AI-powered analysis below
      </div>

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

      {/* ── Info panel ── */}
      <div className="cp-panel">
        {!countryData ? (
          <div className="cp-empty">
            <h3>No coverage for {decodedName}</h3>
            <p>This country has no recent news in the archive.</p>
          </div>
        ) : (
          <>
            <div className="cp-header">
              <h1 className="cp-title">{decodedName}</h1>
              {risk && (
                <span className="country-risk-badge" style={{ background: risk.bg, color: risk.color }} title="Based on intensity and interaction of active story arcs">
                  {intel.riskLevel}
                </span>
              )}
            </div>

            {intel?.headline && (
              <div className="cp-headline">{intel.headline}</div>
            )}

            <div className="cp-stats">
              AI intelligence synthesized from {countryData.totalArticles} articles across {countryData.dayCount} day{countryData.dayCount !== 1 ? 's' : ''} · {formatDateLabel(countryData.dateRange.from)} — {formatDateLabel(countryData.dateRange.to)}
            </div>

            <ShareButtons path={`/weekly/country/${encodeURIComponent(decodedName)}`} title={`${decodedName} — Country Intelligence`} preview={{ h: intel?.headline, n: countryData?.totalArticles, d: countryData?.dayCount }} />

            {/* ── AI tabs ── */}
            {availableTabs.length > 0 ? (
              <div className="cp-ai">
                <div className="ai-toolbar">
                  {availableTabs.map(tab => (
                    <button
                      key={tab.key}
                      className={`ai-btn ai-btn-${tab.cssClass} ${activeTab === tab.key ? 'active' : ''}`}
                      onClick={() => setActiveTab(activeTab === tab.key ? null : tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {activeTab && intel[activeTab] && (
                  <div className={`story-entry-ai-content ${activeCss}`}>
                    <div className="story-entry-section-text">{intel[activeTab]}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="cp-ai-pending">Country analysis generates daily — check back soon</div>
            )}

            {/* ── Watch triggers ── */}
            {intel?.riskSignals && intel.riskSignals.length > 0 && (
              <div className="country-signals">
                <div className="country-signals-label">Watch triggers</div>
                <ul className="country-signals-list">
                  {intel.riskSignals.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {/* ── Active arcs ── */}
            {countryData.arcs.length > 0 && (
              <ArcSection arcs={countryData.arcs} threadAnalyses={threadAnalyses} countryName={decodedName} />
            )}

            {/* ── Related coverage ── */}
            <CoverageList entries={countryData.entries} />
          </>
        )}
      </div>
    </div>
  );
}
