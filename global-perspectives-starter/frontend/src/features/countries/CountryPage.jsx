import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router';
import { ROUTE, storyHref, countryHref, mapHref } from '@/shared/lib/links.js';
import { parentCountry } from '@/shared/lib/countries.js';
import AsOf from '@/shared/ui/AsOf.jsx';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import { useWeeklyArchive, useThreadAnalyses, useWebIndex } from '@/features/threads';
import { useCountryIntelligence } from '@/features/countries/hooks/useCountryIntelligence';
import { useMarketsCountry } from '@/features/countries/hooks/useMarketsCountry';
import { useDisruptionsList } from '@/shared/hooks/useDisruptionsList';
import { useCountryHistory } from '@/features/countries/hooks/useCountryHistory';
import { ECONOMY_PARKED } from '@/shared/lib/economyFlag';
import CountryWhatChanged from '@/features/countries/components/CountryWhatChanged';
import CountryCardV2 from '@/features/countries/components/CountryCardV2';
import PhoneTabs, { phonePanelProps } from '@/shared/ui/PhoneTabs.jsx';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';
import RiskScorecard from '@/shared/ui/risk/RiskScorecard';
import SeverityBadge from '@/shared/ui/SeverityBadge';
import DirectionArrow from '@/shared/ui/DirectionArrow';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { getBroadRegionsForCountry } from '@/shared/lib/countryMapping';
// Lazy — matches WeeklyPage.jsx's existing split. A static import here previously defeated
// that split: both files share the same module graph, so bundlers resolved WeeklyMap into the
// main chunk regardless of WeeklyPage's own lazy() wrapper (STAGE0_FIXES_PLAN.md item (g)).
const WeeklyMap = lazy(() => import('@/features/threads/components/WeeklyMap'));
import ShareButtons from '@/shared/ui/ShareButtons';
import CopyBriefing, { formatCountryBriefing } from '@/shared/ui/CopyBriefing';
import { crisisTypeForCategory } from '@/shared/lib/crisisHue';
import { tierFromScore, tierLabel } from '@/shared/lib/riskTiers';
import { countryTier } from '@/features/countries/lib/countryTier';
import { trajectoryOf } from '@/shared/lib/trajectory';
import BackgroundTimeline from '@/features/countries/components/BackgroundTimeline';
import { SaveButton } from '@/shared/ui/SaveButton';
import { FollowButton } from '@/shared/ui/FollowButton';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import Tabs, { tabPanelProps } from '@/shared/ui/Tabs.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import Button from '@/shared/ui/Button.jsx';
import StoryRow from '@/shared/ui/StoryRow.jsx';
import EditorialShell from '@/shared/ui/EditorialShell';
import StatusStrip from '@/shared/ui/StatusStrip';
import { usePeek } from '@/shared/hooks/usePeek.js';
import { peekData } from '@/shared/lib/peekData.js';
import '@/features/countries/CountryPage.css';
import '@/features/countries/CountryCoverage.css';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { useCountryStories } from '@/features/countries/hooks/useCountryStories.js';
import { useCountryFacts } from '@/features/countries/hooks/useCountryFacts.js';
import { factRows } from '@/features/countries/lib/countryFacts.js';
import { futureDatedTriggers } from '@/features/countries/lib/countryTriggers.js';
import { latestChange } from '@/features/countries/lib/countryChange.js';
import { connectionRows } from '@/features/countries/lib/countryConnections.js';
import { whatWeDontKnow } from '@/features/countries/lib/countryUnknowns.js';
import { formatCountrySheet } from '@/features/countries/lib/countryText.js';
import { HowItConnects, WhatWeDontKnow, YourView, CopyAsText, PrintButton, SheetFooter } from '@/features/countries/components/CountrySheet.jsx';

function formatAsOf(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch { return iso; }
}

// The three AI read-outs on a coverage item. The kind is the button label, never a colour.
const AI_VIEWS = [
  { key: 'summary', field: 'summary', label: 'Summarize' },
  { key: 'prediction', field: 'prediction', label: 'Predict' },
  { key: 'trace', field: 'trace_cause', label: 'Trace Cause' },
];

function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  )}</>;
}

function CoverageList({ entries, country }) {
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
        <span className={`cp-day-chevron ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && <>
        <div className="cp-coverage-header">
          <div className="cp-coverage-hint"><ClaimTag kind="fact" /> dated headlines with outlet links. Tap an article for sources and AI analysis (model judgment).</div>
          {categories.length > 1 && (
            <div className="cp-coverage-filters">
              <Chip selected={!activeCat} onClick={() => setActiveCat(null)}>All</Chip>
              {categories.map(([cat, count]) => (
                <Chip
                  key={cat}
                  className="cp-cap"
                  selected={activeCat === cat}
                  count={count}
                  onClick={() => setActiveCat(activeCat === cat ? null : cat)}
                >
                  {cat}
                </Chip>
              ))}
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
                  <span className={`cp-day-chevron ${isCollapsed ? '' : 'open'}`}>▾</span>
                </button>
                {!isCollapsed && dayEntries.map((entry, i) => {
                  const id = entry.topicId || `${date}-${i}`;
                  const isExpanded = expandedId === id;
                  const aiViews = AI_VIEWS.filter(v => entry.ai?.[v.field]);
                  const aiOpen = aiViews.find(v => v.key === activeAi);
                  const cat = (entry.category || 'other').toLowerCase();
                  return (
                    <div key={id} id={`coverage-${entry.topicId || id}`} className={`cp-coverage-item ${isExpanded ? 'expanded' : ''}`}>
                      <div className="cp-coverage-row" onClick={() => { setExpandedId(isExpanded ? null : id); setActiveAi(null); }}>
                        <CategoryTag category={cat} />
                        <span className="cp-coverage-title">{entry.title}</span>
                        {entry.threadId && <span className="cp-arc-hint">arc</span>}
                        <span className={`cp-coverage-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                      </div>
                      {isExpanded && (
                        <div className="cp-coverage-body">
                          {entry.sources?.length > 0 && (
                            <div className="cp-coverage-sources">
                              {entry.sources.slice(0, 5).map((s, j) => (
                                <span key={j} className="cp-source-tag">
                                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source || s.title || 'Source'}</a> : (s.source || s.title || 'Source')}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="cp-coverage-actions">
                            <Button
                              compact
                              href={`https://www.google.com/search?q=${encodeURIComponent(entry.title)}&tbm=nws&tbs=qdr:d`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Google News ↗
                            </Button>
                            {entry.threadId && (
                              <EntityLink
                                kind="story"
                                id={entry.threadId}
                                pathOpts={country ? { from: 'country', country } : {}}
                                topic={{ title: entry.title, category: entry.category, regions: entry.regions }}
                                asOf={entry.date}
                                className="gp-btn gp-btn--quiet gp-btn--compact"
                              >
                                View full story →
                              </EntityLink>
                            )}
                          </div>
                          {aiViews.length > 0 && (
                            <div className="cp-ai-actions">
                              {aiViews.map(v => (
                                <Button key={v.key} compact selected={activeAi === v.key} onClick={() => setActiveAi(activeAi === v.key ? null : v.key)}>
                                  {v.label}
                                </Button>
                              ))}
                            </div>
                          )}
                          {aiOpen && (
                            <div className="cp-ai-panel"><ClaimTag kind="judgment" />{entry.ai[aiOpen.field]}</div>
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
            <button className="cp-show-more" onClick={() => setShowAllDays(true)}>
              Show {dayGroups.length - 3} more day{dayGroups.length - 3 !== 1 ? 's' : ''}
            </button>
          )}
          {dayGroups.length === 0 && (
            <div className="cpg-empty cpg-empty--tight">No articles match this filter.</div>
          )}
        </div>
      </>}
    </div>
  );
}

// The line is neutral ink: the tier is the chip's word, never the line's colour.
function RiskSparkline({ snapshots }) {
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
    <svg width={w} height={h} className="cpg-spark" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const PHONE_TABS = [
  { key: 'read', label: 'Read' },
  { key: 'map', label: 'Map' },
];

export default function CountryPage() {
  const { countryName } = useParams();
  // Phone P1: READ (the card + everything below) / MAP (the country on the map). The map is only
  // mounted while MAP is open; desktop keeps the map band above the card.
  const isPhone = useIsPhone();
  const peek = usePeek();
  const [phoneTab, setPhoneTab] = useState('read');
  // React Router v6 useParams() already URL-decodes path params — decoding again
  // double-decodes and throws URIError on any name containing a literal '%'.
  // The URL may carry any name for the country (USA, United Arab Emirates, an ISO3 code, West Bank):
  // the page reads everything under the canonical display name and redirects there (countryHref).
  // A name that is not a country (an old Strait of Hormuz link) keeps its own coverage, without the
  // country-only controls (map, follow, save).
  const country = parentCountry(countryName);
  const decodedName = country?.name || countryName;
  const navigate = useNavigate();
  // The hero's header bar overlaps the top of the map strip; the map frames the country in what remains.
  const [overlayEl, setOverlayEl] = useState(null);
  const [overlayInset, setOverlayInset] = useState(null);
  useEffect(() => {
    if (!overlayEl) return undefined;
    const read = () => setOverlayInset((prev) => (prev && prev.top === overlayEl.offsetHeight ? prev : { top: overlayEl.offsetHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(overlayEl);
    return () => ro.disconnect();
  }, [overlayEl]);
  const { dayMap, sortedDates, loading } = useWeeklyArchive();
  const [mainTab, setMainTab] = useState('situation');
  const [activeDeepTab, setActiveDeepTab] = useState(null);
  const [arcTypeFilter, setArcTypeFilter] = useState('all');
  const [catFilter, setCatFilter] = useState(null);
  const [urgFilter, setUrgFilter] = useState(null);

  function selectCountry(name) {
    const to = countryHref(name);
    if (!to) return;
    setMainTab('situation');
    setArcTypeFilter('all');
    setCatFilter(null);
    setUrgFilter(null);
    navigate(to, { replace: true });
  }

  const { countries, countryData } = useMemo(() => {
    if (!dayMap || loading) return { countries: [], countryData: null };
    const map = {};
    for (const date of sortedDates) {
      for (const entry of (dayMap[date]?.entries || [])) {
        // Keyed by the canonical country name (USA / United States / US are one row; West Bank counts for
        // Palestine); a region that is not a country keeps its own text (the broad-region coverage below).
        const keys = new Set((entry.regions || []).map((r) => parentCountry(r)?.name || r));
        for (const region of keys) {
          if (!map[region]) map[region] = { name: region, articles: 0, entries: [] };
          map[region].articles++;
          map[region].entries.push({ ...entry, date });
        }
      }
    }

    const allCountries = Object.values(map)
      .filter(c => c.articles >= 2 || c.name === decodedName)
      // Batch 3 / F: the country picker lists real countries only (regions stay in `map` for the broad-region coverage below)
      .filter(c => parentCountry(c.name) || c.name === decodedName)
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
            if ([e.primaryCountry, (e.regions || [])[0]].some((n) => n && (parentCountry(n)?.name || n) === decodedName)) anchorCount++;
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
  const { analyses: threadAnalyses } = useThreadAnalyses(arcIds, { light: true });
  const { intelligence } = useCountryIntelligence(decodedName ? [decodedName] : []);
  const intel = intelligence?.[decodedName];
  const { data: markets } = useMarketsCountry(decodedName);
  const { index: webIndex } = useWebIndex();
  const { deadlines, topicIdToThreadId } = useCountryStories(decodedName);
  const { facts: storedFacts } = useCountryFacts(decodedName);
  const { snapshots: riskHistory, driftNotes, driftNotesTotal, driftNotesGated } = useCountryHistory(decodedName);
  const { data: countryDisruptions } = useDisruptionsList(
    decodedName ? { country: decodedName, limit: 5 } : {},
    { enabled: !ECONOMY_PARKED },
  );

  useEffect(() => {
    document.title = `${decodedName} Intelligence Briefing — Global Perspectives`;
  }, [decodedName]);

  if (country && country.name !== countryName) return <Navigate replace to={countryHref(country.iso3)} />;
  if (loading) return <BootLoader variant="inline" label="Loading country" text="Loading country" />;

  // Canonical tier for this country — score-first, level fallback — so the pill,
  // stat tile and sparkline all agree (and "moderate" no longer reads as elevated).
  const riskTier = countryTier(intel);
  const trajectory = trajectoryOf(intel?.trajectory);

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

  // The sheet: everything below is assembled from data this page already read (no model call, no new fetch).
  const now = Date.now();
  const builtOn = new Date(now).toISOString().slice(0, 10);
  const connections = connectionRows(webIndex, allArcs, { now });
  const unknowns = whatWeDontKnow({ archiveDates: sortedDates, entries: countryData?.entries, intel, webIndex, country: decodedName });
  const getSheetText = () => formatCountrySheet({
    country: decodedName,
    builtOn,
    intel,
    entries: countryData?.entries,
    totalArticles: countryData?.totalArticles,
    dayCount: countryData?.dayCount,
    change: latestChange(driftNotes, topicIdToThreadId),
    connections,
    triggers: futureDatedTriggers(deadlines, now, 3),
    facts: factRows(storedFacts, now),
    unknowns,
  });

  // Status strip
  const statusStats = [
    anchorCount > 0 && { value: anchorCount, unit: 'anchor' },
    linkedCount > 0 && { value: linkedCount, unit: 'linked' },
    countryData && { value: countryData.totalArticles, unit: 'articles' },
    intel?.riskScore != null && { value: tierLabel(riskTier), unit: 'risk' },
  ].filter(Boolean);

  // Left rail
  const leftRail = (
    <div className="cpg-left">
      <div className="cpg-left-crumbs">
        <Link to={ROUTE.countries}>Countries</Link>
        <span className="cpg-crumb-sep">/</span>
        <span>{decodedName}</span>
      </div>

      {siblings.length > 0 && (
        <>
          <SectionHeader label="Most covered" />
          <ul className="cpg-country-nav">
            {siblings.map(c => (
              <StoryRow
                key={c.name}
                onClick={() => selectCountry(c.name)}
                title={c.name}
                chip={<span className="cpg-country-nav-iso" aria-hidden="true">{parentCountry(c.name)?.iso3}</span>}
                place={`${c.articles} articles`}
              />
            ))}
          </ul>
        </>
      )}

      {/* Thread/Category/Urgency filters moved into the Story Arcs tab (contextual). — Phase 3 IA */}

      {/* "Actors tracked" removed — it duplicated the right-rail Key Actors. — Phase 3 IA */}
    </div>
  );

  // Right rail
  const rightRail = (
    <div className="cpg-right">
      {/* Key actors */}
      {intel?.keyActors?.length > 0 && (
        <div className="cpg-rail-section">
          <SectionHeader label="Key Actors" hint={<ClaimTag kind="judgment" />} />
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

      {/* Risk Assessment moved UP into the header pill + stats strip (was a redundant rail block).
          What to Watch moved into the Situation tab ("the read"). — Phase 1 IA cleanup */}

      {/* Live web evidence */}
      {intel?.groundingSources?.length > 0 && (
        <div className="cpg-rail-section">
          <SectionHeader label="Live Web Evidence" />
          {intel.groundingSources.slice(0, 4).map((s, i) => (
            <div key={i} className="cpg-evidence">
              <div className="cpg-evidence-title">{s.title}</div>
              {s.snippet && <div className="cpg-evidence-snippet">{s.snippet.slice(0, 100)}{s.snippet.length > 100 ? '…' : ''}</div>}
              <div className="cpg-evidence-src">{s.source}{s.age ? ` · ${s.age}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Economic Disruption — event-driven, dated to the hour. Soft-hidden while
          ECONOMY_PARKED: the underlying job is off, so countryDisruptions is always
          [] (fetch skipped above), but the flag also guards the render directly. */}
      {!ECONOMY_PARKED && countryDisruptions?.length > 0 && (
        <div className="cpg-rail-section">
          <SectionHeader label="Economic Disruption" hint={`${countryDisruptions.length} active`} />
          <div className="cpg-disruptions">
          {countryDisruptions.slice(0, 3).map((d, i) => (
            <Link
              key={d.scopeId || i}
              to={storyHref(d.scopeId, { tab: 'economy', from: 'country', country: decodedName })}
              className="cpg-disruption-row"
            >
              <div className="cpg-disruption-top">
                <SeverityBadge level={d.severity} size="sm" />
                <span className="cpg-disruption-insts">
                  {(d.instruments || []).slice(0, 3).map(inst => (
                    <span key={inst.instrumentId}>
                      <b>{inst.instrumentId}</b>
                      <DirectionArrow dir={inst.direction} />
                    </span>
                  ))}
                </span>
              </div>
              <div className="cpg-disruption-head">{d.headline}</div>
            </Link>
          ))}
          </div>
        </div>
      )}

      {/* Markets snapshot — structural baseline (annual macros + FX) */}
      {markets?.macro && Object.keys(markets.macro).length > 0 && (
        <div className="cpg-rail-section">
          <SectionHeader label="Macro Baseline" hint={markets.asOf ? formatAsOf(markets.asOf) : null} />
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

      {/* FX snapshot — raw quotes only, no story link (economy parked, decision 0031) */}
      {markets?.fx?.rates && Object.keys(markets.fx.rates).length > 0 && (
        <div className="cpg-rail-section">
          <SectionHeader
            label={`Market prices · raw quotes${markets.fx.asOf ? ` · as of ${formatAsOf(markets.fx.asOf)}` : ''}`}
            hint={`vs ${markets.fx.base || 'USD'}`}
          />
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
          <div className="cpg-ai-pending">Analysis generates daily</div>
        </div>
      )}
    </div>
  );

  // The hero's header bar (back link, country picker, risk + direction pills). Desktop: over the map
  // band. Phone READ: the same bar as a flat row (no map is loaded); phone MAP: over the map.
  const heroBar = (
        <div className={`cpg-map-overlay${isPhone && phoneTab === 'read' ? ' cpg-map-overlay--flat' : ''}`} ref={setOverlayEl}>
          <div className="cpg-map-overlay-left">
            <Link to={ROUTE.countries} className="cpg-map-back">← Countries</Link>
            <select
              className="cpg-country-select"
              aria-label="Select country"
              value={decodedName}
              onChange={e => selectCountry(e.target.value)}
            >
              {countries.map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.articles})</option>
              ))}
            </select>
            {country && <Link to={mapHref({ country: country.iso3 })} className="cpg-map-back">Show on map</Link>}
          </div>
          <div className="cpg-map-overlay-right">
            {riskTier && <TierChip className="cpg-overlay-chip" tier={riskTier} score={intel?.riskScore} />}
            {trajectory && (
              <span className="cpg-overlay-chip cpg-traj">
                <DirectionArrow dir={trajectory.dir} /> {trajectory.label}
              </span>
            )}
          </div>
        </div>
  );
  const mapHero = (
    <div className={`cpg-map-hero${isPhone ? ' cpg-map-hero--phone' : ''}`}>
      {heroBar}
        <Suspense fallback={<BootLoader variant="inline" className="gp-boot--tight" label="Loading map" text="Loading map" />}>
          <WeeklyMap embedded defaultCountry={decodedName} hidePanel onCountryClick={selectCountry} frameInsets={overlayInset} />
        </Suspense>
    </div>
  );
  const readBody = (
    <>
      {/* S4: the same one-screen card the /map console shows (no watch flag here — this page
          doesn't fetch the world's live situations, to avoid a second world.json load on a
          page that already loads the weekly archive + map). Everything below (coverage,
          background timeline, systems web, disruptions, share) stays reachable underneath —
          see TASK_2026-09-27_pages_local.md S4 for the old->new section mapping. */}
      <div className="cpg-card-v2-wrap">
        <CountryCardV2 name={decodedName} linkName={false} />
      </div>

      {!countryData ? (
        <div className="cpg-nocov">
          <h3>No coverage for {decodedName}</h3>
          <p>This country has no recent news in the archive.</p>
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
                {country && <span className="iso">{country.iso3}</span>}
                Country Intelligence
              </div>
              <h1 className="cpg-hd-h1">{decodedName}</h1>
              {intel?.headline && <p className="cpg-hd-dek">{intel.headline}</p>}
              <div className="cpg-hd-meta">
                {intel?.generatedAt && <span><AsOf generatedAt={intel.generatedAt} source="country analysis" /></span>}
                <span>Coverage <b>{countryData.dayCount} days</b></span>
                <span>Articles <b>{countryData.totalArticles}</b></span>
              </div>
            </div>
            <div className="cpg-hd-actions">
              {country && <ShareButtons path={countryHref(country.iso3)} title={`${decodedName} — Country Intelligence`} preview={{ h: intel?.headline, n: countryData?.totalArticles, d: countryData?.dayCount }} />}
              <CopyBriefing getText={() => formatCountryBriefing(decodedName, intel, countryData)} />
              <CopyAsText getText={getSheetText} />
              <PrintButton />
              {country && <SaveButton itemType="country" itemId={decodedName} metadata={{ name: decodedName }} />}
              {country && <FollowButton country={decodedName} />}
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
              <div className="cpg-stat-k">Risk level</div>
              <div className="cpg-stat-v cpg-stat-v--chip">
                {riskTier ? <TierChip tier={riskTier} /> : '—'}
              </div>
              <div className="cpg-stat-d">
                {intel?.riskScore != null && <span className="cpg-stat-num">{intel.riskScore} · </span>}
                {riskHistory.length >= 2 ? (
                  <RiskSparkline snapshots={riskHistory} />
                ) : (
                  trajectory ? <><DirectionArrow dir={trajectory.dir} /> {trajectory.label}</> : 'AI-assessed'
                )}
              </div>
            </div>
          </div>

          {/* Risk profile — scoring-model-v2 dimension breakdown (renders only when the
              record carries a dimensions vector; scalar-only records show nothing here) */}
          {intel?.riskScore != null && (
            <p className="cpg-mark-note"><ClaimTag kind="judgment" /> Risk score and the four dimensions: model score, not a measurement.</p>
          )}
          <RiskScorecard record={intel} />

          {/* What changed — living-analysis Phase 1a (deterministic, honest-empty if no material move) */}
          <CountryWhatChanged snapshots={riskHistory} driftNotes={driftNotes} driftNotesTotal={driftNotesTotal} driftNotesGated={driftNotesGated} />

          {/* Tabs */}
          <Tabs
            idBase="country"
            label="Country views"
            className="cpg-views"
            tabs={[
              { key: 'situation', label: 'Situation' },
              { key: 'arcs', label: 'Story Arcs', count: filteredArcs.length },
              { key: 'coverage', label: 'Coverage', count: countryData.totalArticles },
            ]}
            active={mainTab}
            onChange={setMainTab}
          />

          {/* Situation tab */}
          {mainTab === 'situation' && (
            <div className="cpg-view" {...tabPanelProps('country', 'situation')}>
              {intel?.bluf && (
                <>
                  <SectionHeader label="Bottom Line" hint={<ClaimTag kind="judgment" />} />
                  <div className="cpg-bluf-text">{intel.bluf}</div>
                </>
              )}

              {intel?.whyItMatters && (
                <>
                  <SectionHeader label="Why It Matters" hint={<ClaimTag kind="judgment" />} />
                  <div className="cpg-why-text"><BoldText text={intel.whyItMatters} /></div>
                </>
              )}

              {intel?.riskSignals?.length > 0 && (
                <>
                  <SectionHeader label="What to Watch" hint={<ClaimTag kind="judgment" />} />
                  <ul className="cpg-watch-list">
                    {intel.riskSignals.slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
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

              <HowItConnects rows={connections} country={decodedName} />

              {(intel?.trajectoryDetail || intel?.crossThreadInsight) && (
                <div className="cp-deep">
                  {[
                    { key: 'trajectoryDetail', label: "What's Next" },
                    { key: 'crossThreadInsight', label: 'Cross-Thread Connections' },
                  ].filter(t => intel[t.key]).map(tab => (
                    <div key={tab.key} className="cp-deep-section">
                      <button
                        className="cp-deep-toggle"
                        aria-expanded={activeDeepTab === tab.key}
                        onClick={() => setActiveDeepTab(activeDeepTab === tab.key ? null : tab.key)}
                      >
                        <span>{tab.label}</span>
                        <span className={`cp-deep-chevron ${activeDeepTab === tab.key ? 'open' : ''}`}>▾</span>
                      </button>
                      {activeDeepTab === tab.key && (
                        <div className="cp-ai-panel"><ClaimTag kind="judgment" /><BoldText text={intel[tab.key]} /></div>
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
            <div className="cpg-view" {...tabPanelProps('country', 'arcs')}>
              <SectionHeader label="Story Arcs" count={filteredArcs.length} hint={<><ClaimTag kind="fact" /> titles and counts <ClaimTag kind="judgment" /> one-line summaries</>}>
                {(arcTypeFilter !== 'all' || catFilter || urgFilter) && (
                  <Button compact onClick={() => { setArcTypeFilter('all'); setCatFilter(null); setUrgFilter(null); }}>
                    Clear filters ×
                  </Button>
                )}
              </SectionHeader>

              {/* Filters live HERE now (contextual to arcs), not floating in the left rail — Phase 3 IA */}
              {allArcs.length > 0 && (
                <div className="cpg-arc-filters" role="group" aria-label="Filter story arcs">
                  <div className="cpg-fgroup">
                    <span className="cpg-fgroup-lbl">Type</span>
                    {[
                      ['all', 'All', allArcs.length],
                      ['anchor', 'Anchor', anchorCount],
                      ['linked', 'Linked', linkedCount],
                    ].map(([type, label, count]) => (
                      <Chip key={type} selected={arcTypeFilter === type} count={count} onClick={() => setArcTypeFilter(type)}>{label}</Chip>
                    ))}
                  </div>
                  {catCounts.length > 1 && (
                    <div className="cpg-fgroup">
                      <span className="cpg-fgroup-lbl">Category</span>
                      <Chip selected={!catFilter} onClick={() => setCatFilter(null)}>All</Chip>
                      {catCounts.map(([cat, count]) => (
                        <Chip key={cat} className="cp-cap" selected={catFilter === cat} count={count} onClick={() => setCatFilter(catFilter === cat ? null : cat)}>{cat}</Chip>
                      ))}
                    </div>
                  )}
                  {urgCounts.length > 1 && (
                    <div className="cpg-fgroup">
                      <span className="cpg-fgroup-lbl">Urgency</span>
                      <Chip selected={!urgFilter} onClick={() => setUrgFilter(null)}>All</Chip>
                      {urgCounts.map(([urg, count]) => (
                        <Chip key={urg} className="cp-cap" selected={urgFilter === urg} count={count} onClick={() => setUrgFilter(urgFilter === urg ? null : urg)}>{urg}</Chip>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {filteredArcs.length > 0 ? (
                <ul className="cpg-arcs">
                  {filteredArcs.map(arc => {
                    const ta = threadAnalyses?.[arc.threadId];
                    const title = ta?.threadTitle || arc.latestTitle;
                    const crisis = crisisTypeForCategory(arc.category);
                    const pd = peekData({ title, category: arc.category });
                    if (pd) pd.hint = 'Open the full story';
                    return (
                      <StoryRow
                        key={arc.threadId}
                        id={arc.threadId}
                        to={storyHref(arc.threadId, { from: 'country', country: decodedName })}
                        title={title}
                        crisis={crisis === 'neutral' ? null : crisis}
                        tier={ta?.riskScore != null ? tierFromScore(ta.riskScore) : null}
                        score={ta?.riskScore}
                        place={`${arc.articleCount} articles · ${arc.dayCount} days`}
                        meta={<span className="cpg-arc-kicker">
                          <b>{arc.isAnchor ? 'Anchor' : 'Linked'}</b> · {arc.category}
                          {arc.urgency === 'high' && <span className="cpg-urg-badge">Urgent</span>}
                        </span>}
                        summary={ta?.storyArc ? `${ta.storyArc.split(/[.!?]/)[0].trim()}.` : null}
                        peek={peek}
                        peekData={pd}
                      />
                    );
                  })}
                </ul>
              ) : (
                <div className="cpg-empty">No story arcs match this filter</div>
              )}
            </div>
          )}

          {/* Coverage tab */}
          {mainTab === 'coverage' && (
            <div className="cpg-view" {...tabPanelProps('country', 'coverage')}>
              <CoverageList entries={countryData.entries} country={decodedName} />
            </div>
          )}
          <WhatWeDontKnow lines={unknowns} />
          <YourView country={decodedName} />
          <SheetFooter date={builtOn} />
        </EditorialShell>
      )}
    </>
  );

  return (
    <div className="cpg-page">
      {isPhone ? (
        <>
          <div className="cpg-phonehead">
            <PhoneTabs tabs={PHONE_TABS} active={phoneTab} onChange={setPhoneTab} label="Country view" idBase="cp" />
            {phoneTab === 'read' ? heroBar : null}
          </div>
          {phoneTab === 'map' ? <div {...phonePanelProps('cp', 'map')}>{mapHero}</div> : null}
          {phoneTab === 'read' ? <div {...phonePanelProps('cp', 'read')}>{readBody}</div> : null}
        </>
      ) : (
        <>
          {mapHero}
          {readBody}
        </>
      )}
    </div>
  );
}
