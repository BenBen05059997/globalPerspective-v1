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
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import SeverityBadge from './atoms/SeverityBadge';
import DirectionArrow from './atoms/DirectionArrow';
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
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
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
            <div className="cpg-empty" style={{ padding: '1rem 0' }}>No articles match this filter.</div>
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
  const [arcTypeFilter, setArcTypeFilter] = useState('all');
  const [catFilter, setCatFilter] = useState(null);
  const [urgFilter, setUrgFilter] = useState(null);

  const decodedName = selectedCountry || paramName;

  useEffect(() => { setSelectedCountry(paramName); }, [paramName]);

  function selectCountry(name) {
    setSelectedCountry(name);
    setMainTab('situation');
    setArcTypeFilter('all');
    setCatFilter(null);
    setUrgFilter(null);
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
        if (!threadMap[e.threadId]) {
          threadMap[e.threadId] = {
            entries: [],
            category: (e.category || 'other').toLowerCase(),
          };
        }
        threadMap[e.threadId].entries.push(e);
      }
      const arcs = Object.entries(threadMap)
        .filter(([, t]) => t.entries.length >= 2)
        .map(([threadId, t]) => {
          const urgCounts = { high: 0, medium: 0, low: 0 };
          let anchorCount = 0;
          for (const e of t.entries) {
            const u = e.urgency || 'low';
            if (urgCounts[u] != null) urgCounts[u]++;
            if (e.primaryCountry === decodedName || (e.regions || [])[0] === decodedName) anchorCount++;
          }
          const urgency = urgCounts.high > 0 ? 'high' : urgCounts.medium > 0 ? 'medium' : 'low';
          const isAnchor = anchorCount > t.entries.length / 2;
          return {
            threadId,
            latestTitle: t.entries[0].title,
            articleCount: t.entries.length,
            category: t.category,
            dayCount: new Set(t.entries.map(e => e.date)).size,
            urgency,
            isAnchor,
          };
        })
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
  const { data: countryDisruptions } = useDisruptionsList(decodedName ? { country: decodedName, limit: 5 } : {});

  useEffect(() => {
    document.title = `${decodedName} Intelligence Briefing — Global Perspectives`;
  }, [decodedName]);

  if (authLoading) return null;
  if (loading) return <IntelligenceLoader type="typewriter" />;

  const risk = intel ? (RISK_COLORS[intel.riskLevel] || RISK_COLORS.moderate) : null;
  const trajectory = intel?.trajectory ? (TRAJECTORY_BADGES[intel.trajectory] || TRAJECTORY_BADGES.stable) : null;
  const riskIdx = intel ? RISK_DOTS.indexOf(intel.riskLevel) : -1;

  // Facet counts
  const allArcs = countryData?.arcs || [];
  const anchorCount = allArcs.filter(a => a.isAnchor).length;
  const linkedCount = allArcs.filter(a => !a.isAnchor).length;
  const catCounts = (() => {
    const m = {};
    for (const a of allArcs) m[a.category] = (m[a.category] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  })();
  const urgCounts = (() => {
    const m = {};
    for (const a of allArcs) m[a.urgency] = (m[a.urgency] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  })();

  // Filtered arcs for arcs tab
  const filteredArcs = allArcs.filter(a => {
    if (arcTypeFilter === 'anchor' && !a.isAnchor) return false;
    if (arcTypeFilter === 'linked' && a.isAnchor) return false;
    if (catFilter && a.category !== catFilter) return false;
    if (urgFilter && a.urgency !== urgFilter) return false;
    return true;
  });

  // Sibling countries (top 6 excluding current)
  const siblings = countries.filter(c => c.name !== decodedName).slice(0, 6);

  // Status strip
  const statusStats = [
    anchorCount > 0 && { value: anchorCount, unit: 'anchor' },
    linkedCount > 0 && { value: linkedCount, unit: 'linked' },
    countryData && { value: countryData.totalArticles, unit: 'articles' },
    intel?.riskScore != null && { value: intel.riskScore, unit: 'risk' },
  ].filter(Boolean);

  // Left rail
  const leftRail = (
    <div className="cpg-left">
      <div className="cpg-left-crumbs">
        <Link to="/weekly/countries">Countries</Link>
        <span className="cpg-crumb-sep">/</span>
        <span>{decodedName}</span>
      </div>

      {siblings.length > 0 && (
        <>
          <div className="cpg-left-hd">Most covered</div>
          {siblings.map(c => (
            <button key={c.name} className="cpg-country-nav" onClick={() => selectCountry(c.name)}>
              <span className="cpg-country-nav-iso">{c.name.slice(0, 2).toUpperCase()}</span>
              <div className="cpg-country-nav-body">
                <span className="cpg-country-nav-name">{c.name}</span>
                <span className="cpg-country-nav-sub">{c.articles} articles</span>
              </div>
            </button>
          ))}
        </>
      )}

      {countryData && allArcs.length > 0 && (
        <>
          <div className="cpg-left-hd" style={{ marginTop: 20 }}>Filter threads</div>
          {[
            ['all', 'All threads', allArcs.length],
            ['anchor', `Anchor (${decodedName.length > 10 ? decodedName.slice(0, 10) + '…' : decodedName} primary)`, anchorCount],
            ['linked', 'Linked (mentioned)', linkedCount],
          ].map(([type, label, count]) => (
            <button
              key={type}
              className={`cpg-facet${arcTypeFilter === type ? ' on' : ''}`}
              onClick={() => { setArcTypeFilter(type); setMainTab('arcs'); }}
            >
              <span>{label}</span>
              <span className="cpg-facet-c">{count}</span>
            </button>
          ))}

          {catCounts.length > 1 && (
            <>
              <div className="cpg-left-hd" style={{ marginTop: 16 }}>Category</div>
              <button
                className={`cpg-facet${!catFilter ? ' on' : ''}`}
                onClick={() => setCatFilter(null)}
              >
                <span>All</span>
                <span className="cpg-facet-c">{allArcs.length}</span>
              </button>
              {catCounts.map(([cat, count]) => {
                const c = CATEGORY_BADGE_COLORS[cat];
                return (
                  <button
                    key={cat}
                    className={`cpg-facet${catFilter === cat ? ' on' : ''}`}
                    style={catFilter === cat && c ? { color: c.color } : {}}
                    onClick={() => { setCatFilter(catFilter === cat ? null : cat); setMainTab('arcs'); }}
                  >
                    <span>{cat}</span>
                    <span className="cpg-facet-c">{count}</span>
                  </button>
                );
              })}
            </>
          )}

          {urgCounts.length > 1 && (
            <>
              <div className="cpg-left-hd" style={{ marginTop: 16 }}>Urgency</div>
              <button
                className={`cpg-facet${!urgFilter ? ' on' : ''}`}
                onClick={() => setUrgFilter(null)}
              >
                <span>All</span>
                <span className="cpg-facet-c">{allArcs.length}</span>
              </button>
              {urgCounts.map(([urg, count]) => (
                <button
                  key={urg}
                  className={`cpg-facet${urgFilter === urg ? ' on' : ''}`}
                  onClick={() => { setUrgFilter(urgFilter === urg ? null : urg); setMainTab('arcs'); }}
                >
                  <span>{urg}</span>
                  <span className="cpg-facet-c">{count}</span>
                </button>
              ))}
            </>
          )}
        </>
      )}

      {intel?.keyActors?.length > 0 && (
        <>
          <div className="cpg-left-hd" style={{ marginTop: 20 }}>Actors tracked</div>
          <div className="cpg-actor-chips">
            {intel.keyActors.map((a, i) => (
              <span key={i} className="cpg-actor-chip" title={a.role}>{a.name}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Right rail
  const rightRail = (
    <div className="cpg-right">
      {/* Key actors */}
      {intel?.keyActors?.length > 0 && (
        <div className="cpg-rail-section">
          <div className="cpg-rail-hd">Key Actors</div>
          {intel.keyActors.slice(0, 5).map((a, i) => (
            <div key={i} className="cpg-actor-row">
              <div className="cpg-actor-av">
                {(a.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="cpg-actor-body">
                <div className="cpg-actor-name">{a.name}</div>
                <div className="cpg-actor-role">{a.role}</div>
              </div>
              <div className="cpg-actor-n">{a.threadCount}</div>
            </div>
          ))}
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
          {riskHistory.length >= 2 && (
            <div style={{ marginTop: 8 }}>
              <RiskSparkline snapshots={riskHistory} color={risk.color} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginLeft: 4 }}>7-day trend</span>
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
            <div key={i} style={{ fontSize: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{s.title}</div>
              {s.snippet && <div style={{ color: 'var(--ink-dim)', marginTop: 2, lineHeight: 1.4 }}>{s.snippet.slice(0, 100)}{s.snippet.length > 100 ? '…' : ''}</div>}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', marginTop: 3 }}>{s.source}{s.age ? ` · ${s.age}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Causal graph */}
      {systemsData?.nodes?.length > 0 && (
        <div className="cpg-rail-section">
          <div className="cpg-rail-hd">
            Causal Graph
            <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9.5, color: 'var(--ink-faint)' }}>
              {systemsData.edges?.length || 0} links
            </span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            {(() => {
              const nodeMap = (systemsData.nodes || []).reduce((m, n) => { if (n?.threadId) m[n.threadId] = n; return m; }, {});
              const titleFor = id => nodeMap[id]?.summary || (id || '').replace(/^thread-/, '').replace(/-[a-f0-9]{6}$/, '').replace(/-/g, ' ');
              const confColor = c => c === 'strong' ? 'var(--risk-h, #c0392b)' : c === 'medium' ? 'var(--risk-e, #d97706)' : 'var(--ink-faint)';
              return (systemsData.edges || []).slice(0, 4).map((e, i) => (
                <div key={i} style={{ marginBottom: 8, padding: '7px 9px', background: 'var(--paper, #fbfbf9)', border: '1px solid var(--line)', borderRadius: 5 }}>
                  <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 11.5, lineHeight: 1.35 }}>{titleFor(e.from)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0 3px 4px', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-faint)' }}>
                    <span style={{ width: 1, height: 12, background: 'var(--line)', display: 'inline-block' }} />
                    {e.lagDays != null && <span>{e.lagDays}d lag</span>}
                    {e.confidence && <span style={{ color: confColor(e.confidence) }}>· {e.confidence}</span>}
                  </div>
                  <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 11.5, lineHeight: 1.35 }}>{titleFor(e.to)}</div>
                  {e.mechanism && (
                    <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px dashed var(--line)', fontSize: 10.5, color: 'var(--ink-dim)', fontStyle: 'italic', lineHeight: 1.4 }}>{e.mechanism}</div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Economic Disruption — event-driven, dated to the hour */}
      {countryDisruptions?.length > 0 && (
        <div className="cpg-rail-section">
          <div className="cpg-rail-hd">
            Economic Disruption
            <span className="cpg-rail-asof">{countryDisruptions.length} active</span>
          </div>
          {countryDisruptions.slice(0, 3).map((d, i) => (
            <Link
              key={d.scopeId || i}
              to={`/weekly/thread/${encodeURIComponent(d.scopeId)}?tab=economy`}
              className="cpg-disruption-row"
              style={{ display: 'block', padding: '8px 0', borderBottom: i < 2 && i < countryDisruptions.length - 1 ? '1px dotted var(--line)' : 'none', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <SeverityBadge level={d.severity} size="sm" />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)' }}>
                  {(d.instruments || []).slice(0, 3).map(inst => (
                    <span key={inst.instrumentId} style={{ marginRight: 6 }}>
                      <b style={{ color: 'var(--ink)' }}>{inst.instrumentId}</b>
                      <DirectionArrow dir={inst.direction} />
                    </span>
                  ))}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.35, color: 'var(--ink)' }}>
                {d.headline}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Markets snapshot — structural baseline (annual macros + FX) */}
      {markets?.macro && Object.keys(markets.macro).length > 0 && (
        <div className="cpg-rail-section">
          <div className="cpg-rail-hd">
            Macro Baseline
            {markets.asOf && <span className="cpg-rail-asof">{formatAsOf(markets.asOf)}</span>}
          </div>
          {(() => {
            const mv = f => (f != null && typeof f === 'object' ? f.value : f);
            const gdp = mv(markets.macro.gdp);
            const cpi = mv(markets.macro.cpi_yoy);
            const unemp = mv(markets.macro.unemployment);
            const debt = mv(markets.macro.debt_to_gdp);
            return <>
              {gdp != null && <div className="cpg-mkt-row"><span>GDP</span><b>${(gdp / 1e9).toFixed(0)}B</b></div>}
              {cpi != null && <div className="cpg-mkt-row"><span>CPI YoY</span><b>{(+cpi).toFixed(1)}%</b></div>}
              {unemp != null && <div className="cpg-mkt-row"><span>Unemployment</span><b>{(+unemp).toFixed(1)}%</b></div>}
              {debt != null && <div className="cpg-mkt-row"><span>Debt/GDP</span><b>{(+debt).toFixed(0)}%</b></div>}
            </>;
          })()}
        </div>
      )}

      {/* FX snapshot */}
      {markets?.fx?.rates && Object.keys(markets.fx.rates).length > 0 && (
        <div className="cpg-rail-section">
          <div className="cpg-rail-hd">
            FX Rates vs {markets.fx.base || 'USD'}
            {markets.fx.asOf && <span className="cpg-rail-asof">{formatAsOf(markets.fx.asOf)}</span>}
          </div>
          {Object.entries(markets.fx.rates)
            .slice(0, 5)
            .map(([pair, rate]) => (
              <div key={pair} className="cpg-mkt-row">
                <span>{pair}</span>
                <b>{typeof rate === 'number' ? rate.toFixed(4) : rate}</b>
              </div>
            ))}
        </div>
      )}

      {!intel && !markets && (
        <div className="cpg-rail-section">
          <div className="cpg-ai-pending" style={{ padding: '24px 0' }}>Analysis generates daily</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="cpg-page">

      {/* Full-width map hero */}
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

      {!countryData ? (
        <div className="cpg-empty" style={{ paddingTop: 80, textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, marginBottom: 12 }}>No coverage for {decodedName}</h3>
          <p style={{ color: 'var(--ink-mid)' }}>This country has no recent news in the archive.</p>
        </div>
      ) : (
        <EditorialShell
          strip={
            <StatusStrip
              label="LIVE"
              stats={statusStats}
              updatedAt={intel?.generatedAt}
            />
          }
          left={leftRail}
          right={rightRail}
          className="cpg-shell"
        >
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
              <div className="cpg-stat-d">{anchorCount} anchor · {linkedCount} linked</div>
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

          {/* Tabs */}
          <div className="cpg-tabs">
            <button className={`cpg-tab${mainTab === 'situation' ? ' on' : ''}`} onClick={() => setMainTab('situation')}>
              Situation
            </button>
            <button className={`cpg-tab${mainTab === 'arcs' ? ' on' : ''}`} onClick={() => setMainTab('arcs')}>
              Story Arcs <span className="c">{filteredArcs.length}</span>
            </button>
            <button className={`cpg-tab${mainTab === 'coverage' ? ' on' : ''}`} onClick={() => setMainTab('coverage')}>
              Coverage <span className="c">{countryData.totalArticles}</span>
            </button>
          </div>

          {/* Situation tab */}
          {mainTab === 'situation' && (
            <div className="cpg-tab-content">
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
            <div className="cpg-tab-content">
              <div className="cpg-section-lbl">
                Story Arcs
                <span style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 6 }}>{filteredArcs.length}</span>
                {(arcTypeFilter !== 'all' || catFilter || urgFilter) && (
                  <button
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}
                    onClick={() => { setArcTypeFilter('all'); setCatFilter(null); setUrgFilter(null); }}
                  >
                    Clear filters ×
                  </button>
                )}
              </div>
              {filteredArcs.length > 0 ? (
                filteredArcs.map(arc => {
                  const c = CATEGORY_BADGE_COLORS[arc.category];
                  const title = threadAnalyses?.[arc.threadId]?.threadTitle || arc.latestTitle;
                  const ta = threadAnalyses?.[arc.threadId];
                  return (
                    <Link
                      key={arc.threadId}
                      to={`/weekly/thread/${arc.threadId}?from=country&country=${encodeURIComponent(decodedName)}`}
                      className={`cpg-arc-card${arc.isAnchor ? ' anchor' : ' linked'}`}
                    >
                      <div className="cpg-arc-card-dot" style={{ background: c?.color || 'var(--ink-faint)' }} />
                      <div className="cpg-arc-card-body">
                        <div className="cpg-arc-card-kicker">
                          <span className={`cpg-arc-type${arc.isAnchor ? '' : ' linked'}`}>{arc.isAnchor ? 'ANCHOR' : 'LINKED'}</span>
                          <span className="cpg-arc-dot">·</span>
                          {arc.category}
                          {arc.urgency === 'high' && <span className="cpg-urg-badge">URGENT</span>}
                        </div>
                        <div className="cpg-arc-card-title">{title}</div>
                        {ta?.storyArc && (
                          <div className="cpg-arc-card-sum">{ta.storyArc.split(/[.!?]/)[0].trim()}.</div>
                        )}
                      </div>
                      <div className="cpg-arc-card-meta">
                        <div><b>{arc.articleCount}</b> articles</div>
                        <div><b>{arc.dayCount}</b> days</div>
                        {ta?.riskScore != null && (
                          <div style={{ color: ta.riskScore >= 50 ? 'var(--risk-h)' : ta.riskScore >= 25 ? 'var(--risk-e)' : 'var(--risk-l)' }}>
                            <b>{ta.riskScore}</b> risk
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="cpg-empty">No story arcs match this filter</div>
              )}
            </div>
          )}

          {/* Coverage tab */}
          {mainTab === 'coverage' && (
            <div className="cpg-tab-content">
              <CoverageList entries={countryData.entries} />
            </div>
          )}
        </EditorialShell>
      )}
    </div>
  );
}
