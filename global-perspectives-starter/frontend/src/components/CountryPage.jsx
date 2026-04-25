import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import IntelligenceLoader from './IntelligenceLoader';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { useMarketsCountry } from '../hooks/useMarketsCountry';
import { useCountryHistory } from '../hooks/useCountryHistory';
import { useSystemsAnalysis } from '../hooks/useSystemsAnalysis';
import { formatDateLabel } from '../utils/dateUtils';
import { getBroadRegionsForCountry } from '../utils/countryMapping';
import WeeklyMap from './WeeklyMap';
import ShareButtons from './ShareButtons';
import CopyBriefing, { formatCountryBriefing } from './CopyBriefing';
import { CATEGORY_BADGE_COLORS, RISK_COLORS } from './WeeklyPage';
import TrialBanner from './TrialBanner';
import { useUserProfile } from '../hooks/useUserProfile';
import BackgroundTimeline from './BackgroundTimeline';
import { SaveButton } from './SaveButton';
import './WeeklyPage.css';
import './CountryPage.css';

function formatTimeAgo(isoString) {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatAsOf(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch { return iso; }
}

const TRAJECTORY_BADGES = {
  escalating:      { arrow: '↗', label: 'Escalating',    color: 'var(--risk-h)' },
  stable:          { arrow: '→', label: 'Stable',         color: 'var(--ink-dim)' },
  'de-escalating': { arrow: '↘', label: 'De-escalating', color: 'var(--risk-l)' },
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
                          {entry.sources?.length > 0 && (
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
            <button className="weekly-category-show-more" onClick={() => setShowAllDays(true)} style={{ marginTop: 8 }}>
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

function RiskSparkline({ snapshots, color = '#a2442e' }) {
  if (!snapshots || snapshots.length < 2) return null;
  const scores = snapshots.map(s => s.riskScore ?? null).filter(v => v != null);
  if (scores.length < 2) return null;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 60, h = 20;
  const pts = scores.map((v, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function CountryPage() {
  const { countryName } = useParams();
  const paramName = decodeURIComponent(countryName);
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [searchParams] = useSearchParams(); // eslint-disable-line no-unused-vars
  const { loading: authLoading } = useAuth();
  const { dayMap, sortedDates, loading } = useWeeklyArchive();
  const [mainTab, setMainTab] = useState('situation');
  const [activeDeepTab, setActiveDeepTab] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(paramName);

  const decodedName = selectedCountry || paramName;

  useEffect(() => { setSelectedCountry(paramName); }, [paramName]);

  function selectCountry(name) {
    setSelectedCountry(name);
    setMainTab('situation');
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
  const { data: markets } = useMarketsCountry(decodedName);
  const { snapshots: riskHistory } = useCountryHistory(decodedName);
  const { data: systemsData } = useSystemsAnalysis(decodedName);

  useEffect(() => {
    document.title = `${decodedName} Intelligence Briefing — Global Perspectives`;
  }, [decodedName]);

  if (authLoading) return null;
  if (loading) return <IntelligenceLoader type="typewriter" />;

  const risk = intel ? (RISK_COLORS[intel.riskLevel] || RISK_COLORS.moderate) : null;
  const trajectory = intel?.trajectory ? (TRAJECTORY_BADGES[intel.trajectory] || TRAJECTORY_BADGES.stable) : null;
  const riskIdx = intel ? RISK_DOTS.indexOf(intel.riskLevel) : -1;

  return (
    <div className="cpg-page">

      {/* Map hero */}
      <div className="cpg-map-hero">
        <div className="cpg-map-overlay">
          <div className="cpg-map-overlay-left">
            <Link to="/weekly/countries" className="cpg-map-back">← Countries</Link>
            <select
              className="cpg-country-select"
              value={decodedName}
              onChange={e => selectCountry(e.target.value)}
            >
              {countries.map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.articles})</option>
              ))}
            </select>
          </div>
          <div className="cpg-map-overlay-right">
            {risk && (
              <span className="cpg-risk-pill" style={{ color: risk.color, borderColor: risk.color + '44' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: risk.color, display: 'inline-block' }} />
                {(intel.riskLevel || 'moderate').toUpperCase()}
              </span>
            )}
            {trajectory && (
              <span className="cpg-traj-pill" style={{ color: trajectory.color }}>
                {trajectory.arrow} {trajectory.label}
              </span>
            )}
          </div>
        </div>
        <WeeklyMap embedded defaultCountry={decodedName} hidePanel onCountryClick={selectCountry} />
      </div>

      {profile?.isTrial && <TrialBanner daysLeft={profile.trialDaysLeft} />}

      <div className="cpg-body">
        {!countryData ? (
          <div className="cpg-empty" style={{ paddingTop: 60 }}>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, marginBottom: 12 }}>No coverage for {decodedName}</h3>
            <p style={{ color: 'var(--ink-mid)' }}>This country has no recent news in the archive.</p>
          </div>
        ) : (
          <>
            {/* Country header */}
            <div className="cpg-hd">
              <div>
                <div className="cpg-hd-kicker">
                  <span className="iso">{decodedName.slice(0, 3).toUpperCase()}</span>
                  Country Intelligence
                </div>
                <h1 className="cpg-hd-h1">{decodedName}</h1>
                {intel?.headline && <p className="cpg-hd-dek">{intel.headline}</p>}
                <div className="cpg-hd-meta">
                  {intel?.generatedAt && <span>Updated <b>{formatTimeAgo(intel.generatedAt)}</b></span>}
                  <span>Coverage <b>{countryData.dayCount} days</b></span>
                  <span>Articles <b>{countryData.totalArticles}</b></span>
                </div>
              </div>
              <div className="cpg-hd-actions">
                <ShareButtons path={`/weekly/country/${encodeURIComponent(decodedName)}`} title={`${decodedName} — Country Intelligence`} preview={{ h: intel?.headline, n: countryData?.totalArticles, d: countryData?.dayCount }} />
                <CopyBriefing getText={() => formatCountryBriefing(decodedName, intel, countryData)} />
                <SaveButton itemType="country" itemId={decodedName} metadata={{ name: decodedName }} />
              </div>
            </div>

            {/* Stats strip */}
            <div className="cpg-stats">
              <div className="cpg-stat">
                <div className="cpg-stat-k">Articles</div>
                <div className="cpg-stat-v">{countryData.totalArticles}</div>
                <div className="cpg-stat-d">past 30 days</div>
              </div>
              <div className="cpg-stat">
                <div className="cpg-stat-k">Story arcs</div>
                <div className="cpg-stat-v accent">{countryData.arcs?.length || 0}</div>
                <div className="cpg-stat-d">active threads</div>
              </div>
              <div className="cpg-stat">
                <div className="cpg-stat-k">Days tracked</div>
                <div className="cpg-stat-v">{countryData.dayCount}</div>
                <div className="cpg-stat-d">{formatDateLabel(countryData.dateRange.from)} – {formatDateLabel(countryData.dateRange.to)}</div>
              </div>
              <div className="cpg-stat">
                <div className="cpg-stat-k">Risk score</div>
                <div className="cpg-stat-v" style={risk ? { color: risk.color } : {}}>
                  {intel?.riskScore != null ? intel.riskScore : (intel?.riskLevel || '—')}
                </div>
                <div className="cpg-stat-d">
                  {riskHistory.length >= 2 ? (
                    <RiskSparkline snapshots={riskHistory} color={risk?.color} />
                  ) : (
                    trajectory ? `${trajectory.arrow} ${trajectory.label}` : 'AI-assessed'
                  )}
                </div>
              </div>
            </div>

            {/* 2-col content */}
            <div className="cpg-content">

              {/* Main column */}
              <div className="cpg-main">
                <div className="cpg-tabs">
                  <button className={`cpg-tab${mainTab === 'situation' ? ' on' : ''}`} onClick={() => setMainTab('situation')}>
                    Situation
                  </button>
                  <button className={`cpg-tab${mainTab === 'arcs' ? ' on' : ''}`} onClick={() => setMainTab('arcs')}>
                    Story Arcs <span className="c">{countryData.arcs?.length || 0}</span>
                  </button>
                  <button className={`cpg-tab${mainTab === 'coverage' ? ' on' : ''}`} onClick={() => setMainTab('coverage')}>
                    Coverage <span className="c">{countryData.totalArticles}</span>
                  </button>
                </div>

                {/* Situation tab */}
                {mainTab === 'situation' && (
                  <div>
                    {intel?.bluf && (
                      <>
                        <div className="cpg-section-lbl">Bottom Line</div>
                        <div className="cpg-bluf-text">{intel.bluf}</div>
                      </>
                    )}

                    {intel?.whyItMatters && (
                      <>
                        <div className="cpg-section-lbl">Why It Matters</div>
                        <div className="cpg-why-text"><BoldText text={intel.whyItMatters} /></div>
                      </>
                    )}

                    {intel?.backgroundTimeline?.length > 0 && (
                      <BackgroundTimeline
                        events={intel.backgroundTimeline}
                        entries={countryData.entries}
                        onEventClick={(topicId) => {
                          const el = document.getElementById(`coverage-${topicId}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('highlight-flash');
                            setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                          }
                        }}
                      />
                    )}

                    {(intel?.trajectoryDetail || intel?.crossThreadInsight) && (
                      <div className="cp-deep" style={{ marginTop: 16 }}>
                        {[
                          { key: 'trajectoryDetail', label: "What's Next", cssClass: 'prediction' },
                          { key: 'crossThreadInsight', label: 'Cross-Thread Connections', cssClass: 'trace' },
                        ].filter(t => intel[t.key]).map(tab => (
                          <div key={tab.key} className="cp-deep-section">
                            <button
                              className={`cp-deep-toggle ${activeDeepTab === tab.key ? 'active' : ''}`}
                              onClick={() => setActiveDeepTab(activeDeepTab === tab.key ? null : tab.key)}
                            >
                              <span>{tab.label}</span>
                              <span className={`cp-deep-chevron ${activeDeepTab === tab.key ? 'open' : ''}`}>&#9662;</span>
                            </button>
                            {activeDeepTab === tab.key && (
                              <div className={`story-entry-ai-content ${tab.cssClass}`}>
                                <div className="story-entry-section-text"><BoldText text={intel[tab.key]} /></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!intel && (
                      <div className="cpg-ai-pending">Country analysis generates daily — check back soon</div>
                    )}
                  </div>
                )}

                {/* Story arcs tab */}
                {mainTab === 'arcs' && (
                  <div>
                    <div className="cpg-section-lbl">Active Story Arcs <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>{countryData.arcs.length}</span></div>
                    {countryData.arcs.length > 0 ? (
                      countryData.arcs.map(arc => {
                        const c = CATEGORY_BADGE_COLORS[arc.category];
                        const title = threadAnalyses?.[arc.threadId]?.threadTitle || arc.latestTitle;
                        return (
                          <Link
                            key={arc.threadId}
                            to={`/weekly/thread/${arc.threadId}?from=country&country=${encodeURIComponent(decodedName)}`}
                            className="cpg-arc-card"
                          >
                            <div className="cpg-arc-card-dot" style={{ background: c?.color || 'var(--ink-faint)' }} />
                            <div className="cpg-arc-card-body">
                              <div className="cpg-arc-card-kicker">{arc.category} · story arc</div>
                              <div className="cpg-arc-card-title">{title}</div>
                            </div>
                            <div className="cpg-arc-card-meta">
                              <div><b>{arc.articleCount}</b> articles</div>
                              <div><b>{arc.dayCount}</b> days</div>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="cpg-empty">No multi-day story arcs found</div>
                    )}
                  </div>
                )}

                {/* Coverage tab */}
                {mainTab === 'coverage' && (
                  <CoverageList entries={countryData.entries} />
                )}
              </div>

              {/* Right AI rail */}
              <aside className="cpg-rail">

                {/* Causal graph */}
                {systemsData?.nodes?.length > 0 && (
                  <div className="cpg-rail-section">
                    <div className="cpg-rail-hd">
                      Causal Graph
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#999', marginLeft: 6 }}>{systemsData.nodes.length} threads · {systemsData.edges?.length || 0} links</span>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      {(systemsData.edges || []).slice(0, 5).map((e, i) => {
                        const fromNode = systemsData.nodes.find(n => n.threadId === e.from);
                        const toNode = systemsData.nodes.find(n => n.threadId === e.to);
                        if (!fromNode || !toNode) return null;
                        return (
                          <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                            <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{fromNode.title?.slice(0, 40) || fromNode.threadId}</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', margin: '2px 0' }}>
                              → {e.mechanism || 'influences'}
                              {e.lagDays ? ` (${e.lagDays}d lag)` : ''}
                              {e.confidence ? ` · ${Math.round(e.confidence * 100)}%` : ''}
                            </div>
                            <div style={{ color: 'var(--ink-dim)' }}>{toNode.title?.slice(0, 40) || toNode.threadId}</div>
                          </div>
                        );
                      })}
                    </div>
                    {systemsData.generatedAt && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#bbb', marginTop: 4 }}>
                        as of {new Date(systemsData.generatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Risk assessment */}
                {risk && (
                  <div className="cpg-rail-section">
                    <div className="cpg-rail-hd">Risk Assessment</div>
                    <div className="cpg-risk-row">
                      {RISK_DOTS.map((level, i) => (
                        <span
                          key={level}
                          className="cpg-risk-dot"
                          style={i <= riskIdx ? { background: risk.color } : {}}
                        />
                      ))}
                      <span className="cpg-risk-label" style={{ color: risk.color }}>
                        {intel.riskLevel?.toUpperCase()}
                      </span>
                    </div>
                    {trajectory && (
                      <div className="cpg-traj-row" style={{ color: trajectory.color }}>
                        {trajectory.arrow} {trajectory.label}
                      </div>
                    )}
                  </div>
                )}

                {/* Watch signals */}
                {intel?.riskSignals?.length > 0 && (
                  <div className="cpg-rail-section">
                    <div className="cpg-rail-hd">What to Watch</div>
                    {intel.riskSignals.slice(0, 5).map((s, i) => (
                      <div key={i} className="cpg-rail-watch">
                        <span className="cpg-rail-watch-icon">⚡</span>
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                {/* Live web evidence */}
                {intel?.groundingSources?.length > 0 && (
                  <div className="cpg-rail-section">
                    <div className="cpg-rail-hd">Live Web Evidence</div>
                    {intel.groundingSources.slice(0, 4).map((s, i) => (
                      <div key={i} style={{ fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{s.title}</div>
                        {s.snippet && <div style={{ color: 'var(--ink-dim)', marginTop: 2, lineHeight: 1.4 }}>{s.snippet.slice(0, 100)}{s.snippet.length > 100 ? '…' : ''}</div>}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#999', marginTop: 3 }}>{s.source}{s.age ? ` · ${s.age}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Markets snapshot */}
                {markets?.macro && Object.keys(markets.macro).length > 0 && (
                  <div className="cpg-rail-section">
                    <div className="cpg-rail-hd">
                      Macro Snapshot
                      {markets.asOf && <span className="cpg-rail-asof">{formatAsOf(markets.asOf)}</span>}
                    </div>
                    {markets.macro.gdp != null && (
                      <div className="cpg-mkt-row"><span>GDP</span><b>{typeof markets.macro.gdp === 'number' ? `$${(markets.macro.gdp / 1e9).toFixed(0)}B` : markets.macro.gdp}</b></div>
                    )}
                    {markets.macro.cpi_yoy != null && (
                      <div className="cpg-mkt-row"><span>CPI YoY</span><b>{markets.macro.cpi_yoy}%</b></div>
                    )}
                    {markets.macro.unemployment != null && (
                      <div className="cpg-mkt-row"><span>Unemployment</span><b>{markets.macro.unemployment}%</b></div>
                    )}
                    {markets.macro.debt_to_gdp != null && (
                      <div className="cpg-mkt-row"><span>Debt/GDP</span><b>{markets.macro.debt_to_gdp}%</b></div>
                    )}
                  </div>
                )}

                {/* FX snapshot */}
                {markets?.fx && Object.keys(markets.fx).filter(k => k !== 'asOf').length > 0 && (
                  <div className="cpg-rail-section">
                    <div className="cpg-rail-hd">
                      FX Rates
                      {markets.fx.asOf && <span className="cpg-rail-asof">{formatAsOf(markets.fx.asOf)}</span>}
                    </div>
                    {Object.entries(markets.fx)
                      .filter(([k]) => k !== 'asOf')
                      .slice(0, 5)
                      .map(([pair, rate]) => (
                        <div key={pair} className="cpg-mkt-row">
                          <span>{pair}</span>
                          <b>{typeof rate === 'number' ? rate.toFixed(4) : rate}</b>
                        </div>
                      ))}
                  </div>
                )}

                {/* If no intel at all */}
                {!intel && !markets && (
                  <div className="cpg-rail-section">
                    <div className="cpg-ai-pending" style={{ padding: '24px 0' }}>
                      Analysis generates daily
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
