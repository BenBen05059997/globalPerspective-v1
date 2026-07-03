import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { threadPath } from '../utils/threadPath';
import IntelligenceLoader from './IntelligenceLoader';
import { useAuth } from '../contexts/AuthContext';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useThreadAnalyses } from '../hooks/useThreadAnalyses';
import { getTopicRegion } from '../utils/countryMapping';
import { formatDateLabel } from '../utils/dateUtils';
import TrendBadge, { getTrend } from './TrendBadge';
import EditorialShell from './atoms/EditorialShell';
import StatusStrip from './atoms/StatusStrip';
import { CATEGORY_BADGE_COLORS, riskScoreToVar } from '../tokens';
import { tierFromScore, tierLabel } from '../utils/riskTiers';
import './WeeklyPage.css';
import './AIComponents.css';

const WeeklyMap = lazy(() => import('./WeeklyMap'));

const REGION_COLORS = {
  Asia:          { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  Europe:        { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  'Middle East': { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  Africa:        { bg: '#d1fae5', border: '#34d399', text: '#065f46' },
  Americas:      { bg: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
  Oceania:       { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
  World:         { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
};

export const CATEGORY_ORDER = ['politics', 'economy', 'conflict', 'military', 'disaster', 'climate', 'energy', 'technology', 'science', 'business', 'health', 'society', 'other'];

function getActivityStatus(lastDateStr) {
  const diffDays = Math.floor(
    (Date.now() - new Date(lastDateStr + 'T00:00:00').getTime()) / 86400000
  );
  if (diffDays <= 2) return { label: 'Active', color: '#10b981' };
  if (diffDays <= 7) return { label: 'Ongoing', color: '#f59e0b' };
  return { label: 'Quieting', color: '#9ca3af' };
}

function regionTagStyle(region) {
  const c = REGION_COLORS[region] || REGION_COLORS.World;
  return { background: c.bg, borderColor: c.border, color: c.text };
}

// Whole days since a YYYY-MM-DD archive date (archive is day-granular).
function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
}
function updatedLabel(dateStr) {
  const d = daysSince(dateStr);
  if (d <= 0) return 'updated today';
  if (d === 1) return 'updated yesterday';
  return `updated ${d}d ago`;
}
// Abbreviations that end in a period but do NOT end a sentence (so "deep inside
// Russian territory, targeting a St. Petersburg refinery" isn't cut at "St.").
const SENTENCE_ABBREV = new Set([
  'st', 'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'inc', 'ltd',
  'co', 'corp', 'gen', 'sen', 'rep', 'gov', 'sgt', 'lt', 'col', 'capt', 'maj',
  'rev', 'hon', 'no', 'vol', 'u.s', 'u.k', 'u.n', 'a.m', 'p.m',
]);
function firstSentence(text, max = 150) {
  if (!text) return null;
  const re = /[.!?]+\s+(?=[A-Z0-9"'“])/g;
  let m, end = text.length;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    const lastWord = (before.match(/(\S+)$/)?.[1] || '').replace(/[.]+$/, '').toLowerCase();
    // Skip abbreviations and single-letter initials ("J. Smith").
    if (SENTENCE_ABBREV.has(lastWord) || /^[a-z]$/.test(lastWord)) continue;
    end = m.index + m[0].trimEnd().length; // include the punctuation, drop trailing space
    break;
  }
  const s = text.slice(0, end).trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

// Rough title similarity so we don't surface the same story twice in the
// hierarchy (e.g. two near-identical US-Iran clusters). Jaccard over content
// words; ≥0.5 overlap ⇒ treat as the same story.
const TITLE_STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'as',
  'at', 'by', 'into', 'amid', 'over', 'face', 'faces', 'navigates',
]);
function titleKey(s) {
  return new Set(
    String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 1 && !TITLE_STOP.has(w))
  );
}
function tooSimilar(aKey, bKey) {
  if (!aKey.size || !bKey.size) return false;
  let inter = 0;
  for (const w of aKey) if (bKey.has(w)) inter++;
  return inter / (aKey.size + bKey.size - inter) >= 0.5;
}

function filterDatesByRange(sortedDates, range) {
  if (range === 'all') return sortedDates;
  const days = range === '3d' ? 3 : range === '7d' ? 7 : 30;
  return sortedDates.slice(0, days);
}

// Time bands for the river — recency buys density. Bucketed by a thread's LAST
// activity (dateRange.to), the same "is this still moving" signal the LEAD /
// DEVELOPING hierarchy uses. This week = full cards; older = condensed rows.
const TIME_BANDS = [
  { key: 'week', label: 'This week', max: 7 },
  { key: 'month', label: 'Earlier this month', max: 30 },
  { key: 'older', label: 'Older', max: Infinity },
];
function bandOf(dateStr) {
  const d = daysSince(dateStr);
  if (d <= 7) return 'week';
  if (d <= 30) return 'month';
  return 'older';
}

function groupByThread(dayMap, sortedDates) {
  const threadMap = {};
  const standalone = [];

  for (const date of sortedDates) {
    const entries = dayMap[date]?.entries || [];
    for (const entry of entries) {
      const enriched = { ...entry, date };
      if (entry.threadId) {
        if (!threadMap[entry.threadId]) {
          threadMap[entry.threadId] = { entries: [], allSources: new Set(), allRegions: new Set() };
        }
        threadMap[entry.threadId].entries.push(enriched);
        for (const s of (entry.sources || [])) {
          threadMap[entry.threadId].allSources.add(s.source || s.title || 'Unknown');
        }
        for (const r of (entry.regions || [])) {
          threadMap[entry.threadId].allRegions.add(r);
        }
      } else {
        standalone.push(enriched);
      }
    }
  }

  const threads = Object.entries(threadMap).map(([threadId, data]) => {
    data.entries.sort((a, b) => b.date.localeCompare(a.date));
    const regions = [...data.allRegions];
    const primaryRegion = getTopicRegion({ regions });
    const trend = getTrend(data.entries);
    return {
      threadId,
      latestTitle: data.entries[0].title,
      entries: data.entries,
      articleCount: data.entries.length,
      dayCount: new Set(data.entries.map(e => e.date)).size,
      sources: [...data.allSources].slice(0, 8),
      regions,
      primaryRegion,
      trend,
      dateRange: {
        from: data.entries[data.entries.length - 1].date,
        to: data.entries[0].date,
      },
    };
  });

  threads.sort((a, b) => b.articleCount - a.articleCount);

  for (const entry of standalone) {
    entry.primaryRegion = getTopicRegion(entry);
  }

  return { threads, standalone };
}

// ─── Arc Dots ─────────────────────────────────────────────────────────────────

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ArcDots({ entries }) {
  const uniqueDates = [...new Set(entries.map(e => e.date))].sort();
  if (uniqueDates.length < 2) return null;
  const startMs = new Date(uniqueDates[0]).getTime();
  const endMs = new Date(uniqueDates[uniqueDates.length - 1]).getTime();
  const totalDays = Math.round((endMs - startMs) / 86400000) + 1;
  const dateSet = new Set(uniqueDates);
  const showGaps = totalDays <= 14;
  const dots = showGaps
    ? Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
        return { date: d, active: dateSet.has(d) };
      })
    : uniqueDates.map(d => ({ date: d, active: true }));
  return (
    <div className="arc-dots">
      <span className="arc-dot-date-label">{fmtShort(uniqueDates[0])}</span>
      {dots.map((dot, i) => (
        <div key={dot.date} className="arc-dot-item">
          <div className={`arc-dot ${dot.active ? 'active' : 'gap'}`} title={dot.active ? dot.date : ''} />
          {i < dots.length - 1 && <div className="arc-dot-connector" />}
        </div>
      ))}
      <span className="arc-dot-date-label">{fmtShort(uniqueDates[uniqueDates.length - 1])}</span>
    </div>
  );
}

// ─── Arc Intro ────────────────────────────────────────────────────────────────

function ArcIntro({ onDismiss }) {
  return (
    <div className="arc-intro">
      <div className="arc-intro-content">
        <span className="arc-intro-icon">◎</span>
        <span>
          <strong>What are Story Arcs?</strong> Each entry below groups related articles from multiple days, showing how a global topic is evolving. The dot trail shows which days coverage appeared.
        </span>
      </div>
      <button className="arc-intro-dismiss" onClick={onDismiss}>Got it</button>
    </div>
  );
}

// ─── Featured Section (Rising arcs) ──────────────────────────────────────────

function FeaturedSection({ threads, threadAnalyses, compact = false, excludeIds }) {
  const featured = useMemo(() => threads
    .filter(t => (t.trend === 'rising' || t.trend === 'new') && t.articleCount >= 2 && !excludeIds?.has(t.threadId))
    .sort((a, b) => {
      if (a.trend === 'rising' && b.trend !== 'rising') return -1;
      if (b.trend === 'rising' && a.trend !== 'rising') return 1;
      return b.articleCount - a.articleCount;
    })
    .slice(0, compact ? 5 : 3),
  [threads, compact, excludeIds]);

  if (featured.length === 0) return null;

  if (compact) {
    return (
      <div className="fs-compact">
        <div className="wp-rail-label wp-rail-label--top">Rising This Week</div>
        {featured.map(thread => {
          const fCategory = thread.entries[0]?.category?.toLowerCase();
          const fCatColors = CATEGORY_BADGE_COLORS[fCategory];
          return (
            <Link key={thread.threadId} to={threadPath(thread.threadId)} className="fs-compact-row">
              {fCatColors && (
                <span className="fs-compact-cat" style={{ background: fCatColors.bg, color: fCatColors.color }}>
                  {fCategory}
                </span>
              )}
              <span className="fs-compact-title">{threadAnalyses?.[thread.threadId]?.threadTitle || thread.latestTitle}</span>
              <span className="fs-compact-meta">{thread.articleCount}a · {thread.dayCount}d</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="featured-section">
      <div className="featured-section-header">
        <span className="featured-section-label">Rising This Week</span>
        <span className="featured-section-hint">Story arcs gaining momentum — click to read</span>
      </div>
      <div className="featured-cards">
        {featured.map(thread => {
          const fCategory = thread.entries[0]?.category?.toLowerCase();
          const fCatColors = CATEGORY_BADGE_COLORS[fCategory];
          const fActivity = getActivityStatus(thread.dateRange.to);
          const hook = (() => {
            const s = thread.entries[0]?.ai?.summary;
            if (!s) return null;
            const sentence = s.split(/(?<=[.!?])\s/)[0] || s;
            return sentence.length > 110 ? sentence.slice(0, 107) + '…' : sentence;
          })();
          return (
            <Link key={thread.threadId} to={threadPath(thread.threadId)} className="featured-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="featured-card-top">
                <span className="story-arc-label">Story Arc</span>
                {fCatColors && (
                  <span className="story-category-badge" style={{ background: fCatColors.bg, color: fCatColors.color }}>
                    {fCategory}
                  </span>
                )}
                <TrendBadge entries={thread.entries} />
                <span className="story-activity-dot" style={{ color: fActivity.color }}>● {fActivity.label}</span>
                <span className="featured-card-stats">
                  {thread.articleCount} articles · {thread.dayCount} day{thread.dayCount !== 1 ? 's' : ''}
                </span>
              </div>
              <ArcDots entries={thread.entries} />
              <div className="featured-card-title">{thread.latestTitle}</div>
              {thread.regions.length > 0 && (
                <div className="featured-card-regions">
                  {thread.regions.slice(0, 3).map((r, i) => (
                    <span key={i} className="story-card-region-tag" style={regionTagStyle(r)}>{r}</span>
                  ))}
                </div>
              )}
              {hook && <div className="featured-card-hook">{hook}</div>}
              <div className="featured-card-cta">Read full arc →</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Front-page hierarchy: LEAD + DEVELOPING ──────────────────────────────────
// Above the category river, promote the dominant story of the day (1 LEAD) and a
// few secondary ones (DEVELOPING). Qualification is tier-based, not a blended
// score — see RISK_TIERS_PLAN.md P3. Only shown on the default (unfiltered) view.

function DriftLine({ analysis }) {
  const t = analysis?.driftNote?.triggerEvent?.title;
  if (!t) return null;
  return <div className="wp-lead-drift">↳ What changed: <b>{t}</b></div>;
}

function LeadStory({ item }) {
  const { t, a, tier, hasDrift } = item;
  const title = a?.threadTitle || t.latestTitle;
  const category = t.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];
  const why = firstSentence(a?.storyArc || t.entries[0]?.ai?.summary, 180);
  const color = riskScoreToVar(a?.riskScore);
  const ruleBits = [`Top story · ${tierLabel(tier)} risk`];
  if (daysSince(t.dateRange.to) <= 1) ruleBits.push('new events today');
  return (
    <Link to={threadPath(t.threadId)} className="wp-lead" style={{ borderTopColor: color }}>
      <div className="wp-lead-rule" style={{ color }}>{ruleBits.join(' · ')}</div>
      <div className="wp-lead-head">
        {catColors && (
          <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color }}>{category}</span>
        )}
        <TrendBadge entries={t.entries} />
      </div>
      <h2 className="wp-lead-title">{title}</h2>
      {why && <p className="wp-lead-why">{why}</p>}
      <div className="wp-lead-evidence">
        <span className="wp-lead-tier" style={{ color }}>{tierLabel(tier)}</span>
        <span>{t.articleCount} event{t.articleCount !== 1 ? 's' : ''}</span>
        <span>{t.dayCount} day{t.dayCount !== 1 ? 's' : ''}</span>
        <span>{updatedLabel(t.dateRange.to)}</span>
      </div>
      <ArcDots entries={t.entries} />
      {hasDrift && <DriftLine analysis={a} />}
    </Link>
  );
}

function DevelopingRow({ item }) {
  const { t, a, tier, hasDrift } = item;
  const title = a?.threadTitle || t.latestTitle;
  const category = t.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];
  const color = tier ? riskScoreToVar(a?.riskScore) : null;
  return (
    <Link to={threadPath(t.threadId)} className="wp-dev-row">
      <div className="wp-dev-top">
        {catColors && (
          <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color }}>{category}</span>
        )}
        {tier && <span className="wp-dev-tier" style={{ color }}>{tierLabel(tier)}</span>}
        <TrendBadge entries={t.entries} />
      </div>
      <div className="wp-dev-title">{title}</div>
      {hasDrift
        ? <div className="wp-dev-drift">↳ {t.entries.length && a?.driftNote?.triggerEvent?.title ? a.driftNote.triggerEvent.title : 'conclusion updated'}</div>
        : <div className="wp-dev-meta">{t.articleCount} events · {updatedLabel(t.dateRange.to)}</div>}
    </Link>
  );
}

function LeadHierarchy({ lead, developing }) {
  if (!lead && (!developing || developing.length === 0)) return null;
  return (
    <div className="wp-hierarchy">
      {lead && <LeadStory item={lead} />}
      {developing.length > 0 && (
        <div className="wp-dev">
          <div className="wp-dev-label">Developing</div>
          <div className="wp-dev-grid">
            {developing.map(item => <DevelopingRow key={item.t.threadId} item={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Condensed row (older bands) ──────────────────────────────────────────────

function BandRow({ thread, analysis }) {
  const t = thread, a = analysis;
  const title = a?.threadTitle || t.latestTitle;
  const tier = tierFromScore(a?.riskScore);
  const category = t.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];
  return (
    <Link to={threadPath(t.threadId)} className="wp-band-row">
      <span className="wp-band-tier" style={tier ? { color: riskScoreToVar(a?.riskScore) } : {}}>
        {tier ? tierLabel(tier) : '—'}
      </span>
      <span className="wp-band-title">{title}</span>
      {catColors && <span className="wp-band-cat" style={{ color: catColors.color }}>{category}</span>}
      <span className="wp-band-meta">{t.articleCount} ev · {updatedLabel(t.dateRange.to)}</span>
    </Link>
  );
}

// A single time band. "This week" renders full cards; older bands render
// condensed rows. The "Older" band starts collapsed (a count you expand), so a
// long tail of stale stories never walls the page.
function TimeBand({ band, items, threadAnalyses, defaultCollapsed }) {
  const isWeek = band.key === 'week';
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const initial = isWeek ? 8 : 12;
  const visible = showAll ? items : items.slice(0, initial);
  const hidden = items.length - visible.length;
  return (
    <section className="wp-band">
      <button
        className="wp-band-header"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span className="wp-band-label">{band.label}</span>
        <span className="wp-band-count">{items.length}</span>
        <span className={`wp-band-chevron ${collapsed ? 'collapsed' : ''}`}>›</span>
      </button>
      {!collapsed && (
        <div className={`wp-band-body ${isWeek ? 'is-cards' : 'is-rows'}`}>
          {visible.map(t => isWeek
            ? <StoryCard key={t.threadId} thread={t} analysis={threadAnalyses?.[t.threadId]} />
            : <BandRow key={t.threadId} thread={t} analysis={threadAnalyses?.[t.threadId]} />
          )}
          {hidden > 0 && (
            <button className="wp-band-more" onClick={() => setShowAll(true)}>Show {hidden} more</button>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({ thread, analysis }) {
  const isMulti = thread.articleCount > 1;
  const displayTitle = analysis?.threadTitle || thread.latestTitle;
  const category = thread.entries[0]?.category?.toLowerCase();
  const catColors = CATEGORY_BADGE_COLORS[category];
  const activity = getActivityStatus(thread.dateRange.to);
  const watchCount = analysis?.watchQuestions?.length || 0;

  // Prefer storyArc first sentence, fall back to summary first sentence
  const hook = (() => {
    const arc = analysis?.storyArc;
    const src = arc || thread.entries[0]?.ai?.summary;
    if (!src) return null;
    const sentence = src.split(/(?<=[.!?])\s/)[0] || src;
    return sentence.length > 160 ? sentence.slice(0, 157) + '…' : sentence;
  })();

  // entryShortTitles: [{topicId, shortTitle}] — pick newest 3 by matching thread entry order
  const microHeadlines = (() => {
    if (!Array.isArray(analysis?.entryShortTitles)) return [];
    const seen = new Set();
    const out = [];
    for (const item of analysis.entryShortTitles) {
      if (item.shortTitle && !seen.has(item.shortTitle)) {
        seen.add(item.shortTitle);
        out.push(item.shortTitle);
        if (out.length === 3) break;
      }
    }
    return out;
  })();

  return (
    <Link to={threadPath(thread.threadId)} className="story-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div className="story-card-main">
        <div className="story-card-content">
          <div className="story-card-title">{displayTitle}</div>
          <div className="story-card-meta-row">
            {analysis && <span className="story-ai-badge">AI</span>}
            {isMulti && <span className="story-arc-label">Story Arc</span>}
            {catColors && (
              <span className="story-category-badge" style={{ background: catColors.bg, color: catColors.color }}>
                {category}
              </span>
            )}
            <span className="story-arc-stats">
              {thread.articleCount} article{thread.articleCount !== 1 ? 's' : ''}
              {isMulti ? ` · ${thread.dayCount} day${thread.dayCount !== 1 ? 's' : ''}` : ''}
            </span>
            <TrendBadge entries={thread.entries} />
            <span className="story-activity-dot" style={{ color: activity.color }}>
              ● {activity.label}
            </span>
            {thread.regions.slice(0, 3).map((r, i) => (
              <span key={i} className="story-card-region-tag" style={regionTagStyle(r)}>{r}</span>
            ))}
            {thread.regions.length > 3 && (
              <span className="story-card-region-tag more">+{thread.regions.length - 3}</span>
            )}
          </div>
          {isMulti && <ArcDots entries={thread.entries} />}
          {microHeadlines.length > 0 && (
            <ul className="story-card-micro">
              {microHeadlines.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
          {hook && !microHeadlines.length && <div className="story-card-hook">{hook}</div>}
          {watchCount > 0 && (
            <div className="story-card-watch-hint">
              {watchCount} question{watchCount !== 1 ? 's' : ''} to watch
            </div>
          )}
        </div>
        <span className="story-expand-btn">Read arc →</span>
      </div>
    </Link>
  );
}

// ─── Standalone Section ───────────────────────────────────────────────────────

function StandaloneSection({ entries }) {
  const [expanded, setExpanded] = useState(false);
  if (!entries.length) return null;

  const byDate = {};
  for (const entry of entries) {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="standalone-section">
      <div className="standalone-header" onClick={() => setExpanded(!expanded)}>
        <div className="standalone-header-left">
          <span className="standalone-label">Single Mentions</span>
          <span className="standalone-count">{entries.length}</span>
          <span className="standalone-hint">Appeared once — not yet part of a multi-day arc</span>
        </div>
        <div className={`story-card-chevron ${expanded ? 'open' : ''}`}>&#9662;</div>
      </div>
      {expanded && (
        <div className="standalone-body">
          {dates.map(date => (
            <div key={date} className="standalone-day">
              <div className="standalone-day-label">{formatDateLabel(date)}</div>
              {byDate[date].map((entry, i) => (
                <div key={entry.topicId || i} className="standalone-entry">
                  <span className="standalone-entry-title">{entry.title}</span>
                  {entry.regions && entry.regions.length > 0 && (
                    <span className="standalone-entry-regions">
                      {entry.regions.slice(0, 2).map((r, j) => (
                        <span key={j} className="story-card-region-tag" style={regionTagStyle(r)}>{r}</span>
                      ))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Country Chips ────────────────────────────────────────────────────────────

function CountryChips({ countryOptions, activeCountry, onChange, max = 8 }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? countryOptions : countryOptions.slice(0, max);
  const overflow = countryOptions.length - max;
  return (
    <div className="filter-country-chips">
      {visible.map(({ country }) => (
        <button
          key={country}
          className={`filter-country-chip ${activeCountry === country ? 'active' : ''}`}
          onClick={() => onChange(activeCountry === country ? null : country)}
        >
          {country}
        </button>
      ))}
      {!showAll && overflow > 0 && (
        <button className="filter-country-chip overflow" onClick={() => setShowAll(true)}>
          +{overflow} more
        </button>
      )}
      {showAll && overflow > 0 && (
        <button className="filter-country-chip overflow" onClick={() => setShowAll(false)}>
          Show less
        </button>
      )}
    </div>
  );
}

// ─── Filter Controls ──────────────────────────────────────────────────────────

function FilterControls({ regionGroups, activeRegion, setActiveRegion, timeRange, setTimeRange, sortBy, setSortBy, availableDays, searchQuery, setSearchQuery, countryOptions, activeCountry, setActiveCountry }) {
  return (
    <div className="filter-controls">
      <div className="filter-top-row">
        <input
          type="text"
          className="filter-search"
          placeholder="Search arcs…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="filter-period-wrapper">
          <span className="filter-period-label">Show</span>
          <div className="filter-period-group">
            {[
              { value: '3d', label: '3 days' },
              { value: '7d', label: '7 days' },
              ...(availableDays > 7 ? [{ value: 'all', label: `All ${availableDays} days` }] : []),
            ].map(opt => (
              <button
                key={opt.value}
                className={`filter-period-btn ${timeRange === opt.value ? 'active' : ''}`}
                onClick={() => setTimeRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <select className="filter-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="articles">Most covered</option>
          <option value="recent">Most recent</option>
          <option value="rising">Rising first</option>
        </select>
        {countryOptions.length > 0 && (
          <CountryChips
            countryOptions={countryOptions}
            activeCountry={activeCountry}
            onChange={setActiveCountry}
            max={8}
          />
        )}
      </div>
      {regionGroups.length > 1 && (
        <div className="filter-region-row">
          <button
            className={`filter-region-chip ${!activeRegion ? 'active' : ''}`}
            onClick={() => setActiveRegion(null)}
          >
            All
          </button>
          {regionGroups.map(g => (
            <button
              key={g.region}
              className={`filter-region-chip ${activeRegion === g.region ? 'active' : ''}`}
              onClick={() => setActiveRegion(activeRegion === g.region ? null : g.region)}
            >
              {g.region}
              <span className="filter-region-count">{g.threads.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly Page ──────────────────────────────────────────────────────────────

export default function WeeklyPage() {
  const { loading: authLoading } = useAuth();
  const [welcome, setWelcome] = useState(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gp_just_signed_in')) {
      sessionStorage.removeItem('gp_just_signed_in');
      return true;
    }
    return false;
  });
  const [viewMode, setViewMode] = useState('list');
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeCountry, setActiveCountry] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [sortBy, setSortBy] = useState('articles');
  const [searchQuery, setSearchQuery] = useState('');
  // Seed the category filter from ?category= (ThreadPage's breadcrumb links here,
  // e.g. /weekly?category=politics). Only accept a known category.
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const [activeCategory, setActiveCategory] = useState(() =>
    categoryParam && CATEGORY_ORDER.includes(categoryParam) ? categoryParam : null);
  // Re-sync when the URL param itself changes (back/forward, or a fresh
  // ?category link while already on /weekly). Chip clicks don't touch the URL,
  // so this only fires on real navigation — it won't fight manual selection.
  useEffect(() => {
    setActiveCategory(categoryParam && CATEGORY_ORDER.includes(categoryParam) ? categoryParam : null);
  }, [categoryParam]);
  const [showIntro, setShowIntro] = useState(
    () => !localStorage.getItem('gp_arc_intro_dismissed')
  );
  function dismissIntro() {
    localStorage.setItem('gp_arc_intro_dismissed', '1');
    setShowIntro(false);
  }

  useEffect(() => setActiveCountry(null), [activeRegion]);

  const { dayMap, sortedDates: allDates, loading, error } = useWeeklyArchive();

  const sortedDates = useMemo(
    () => filterDatesByRange(allDates, timeRange),
    [allDates, timeRange],
  );

  const { threads, standalone } = useMemo(
    () => groupByThread(dayMap, sortedDates),
    [dayMap, sortedDates],
  );

  const qualifyingThreadIds = useMemo(
    () => threads.filter(t => t.articleCount >= 2).map(t => t.threadId),
    [threads],
  );
  const { analyses: threadAnalyses } = useThreadAnalyses(qualifyingThreadIds);

  const sortedThreads = useMemo(() => {
    const copy = [...threads];
    if (sortBy === 'recent') {
      copy.sort((a, b) => b.dateRange.to.localeCompare(a.dateRange.to));
    } else if (sortBy === 'rising') {
      const order = { rising: 0, new: 1, stable: 2, fading: 3 };
      copy.sort((a, b) => (order[a.trend] ?? 4) - (order[b.trend] ?? 4) || b.articleCount - a.articleCount);
    }
    return copy;
  }, [threads, sortBy]);

  // Region groups for filter chips
  const regionGroups = useMemo(() => {
    const groups = {};
    for (const t of sortedThreads) {
      const r = t.primaryRegion || 'World';
      if (!groups[r]) groups[r] = { threads: [], standaloneEntries: [] };
      groups[r].threads.push(t);
    }
    for (const e of standalone) {
      const r = e.primaryRegion || 'World';
      if (!groups[r]) groups[r] = { threads: [], standaloneEntries: [] };
      groups[r].standaloneEntries.push(e);
    }
    return Object.entries(groups)
      .map(([region, data]) => ({
        region,
        threads: data.threads,
        standaloneEntries: data.standaloneEntries,
        totalCount: data.threads.reduce((s, t) => s + t.articleCount, 0) + data.standaloneEntries.length,
      }))
      .sort((a, b) => {
        if (a.region === 'World') return 1;
        if (b.region === 'World') return -1;
        return b.totalCount - a.totalCount;
      });
  }, [sortedThreads, standalone]);

  // Flat filtered feed
  const { flatThreads, flatStandalone } = useMemo(() => {
    let filteredThreads = activeRegion
      ? sortedThreads.filter(t => (t.primaryRegion || 'World') === activeRegion)
      : sortedThreads;
    let filteredStandalone = activeRegion
      ? standalone.filter(e => (e.primaryRegion || 'World') === activeRegion)
      : standalone;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filteredThreads = filteredThreads.filter(t =>
        t.latestTitle.toLowerCase().includes(q) ||
        t.entries.some(e => e.title.toLowerCase().includes(q)) ||
        t.regions.some(r => r.toLowerCase().includes(q)) ||
        t.sources.some(s => s.toLowerCase().includes(q))
      );
      filteredStandalone = filteredStandalone.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.regions || []).some(r => r.toLowerCase().includes(q))
      );
    }
    if (activeCountry) {
      filteredThreads = filteredThreads.filter(t => (t.regions || []).includes(activeCountry));
      filteredStandalone = filteredStandalone.filter(e => (e.regions || []).includes(activeCountry));
    }
    return { flatThreads: filteredThreads, flatStandalone: filteredStandalone };
  }, [sortedThreads, standalone, activeRegion, searchQuery, activeCountry]);

  // Front-page hierarchy (LEAD + DEVELOPING) — only on the default, unfiltered
  // view; filtering/searching is "work mode" and shows the flat river as before.
  const { lead, developing, promotedIds } = useMemo(() => {
    const empty = { lead: null, developing: [], promotedIds: new Set() };
    if (activeRegion || activeCountry || searchQuery.trim() || activeCategory) return empty;

    const tierRank = { high: 0, elevated: 1, moderate: 2, low: 3 };
    const items = threads
      .filter(t => t.articleCount >= 2)
      .map(t => {
        const a = threadAnalyses?.[t.threadId];
        const tier = tierFromScore(a?.riskScore);
        const fresh = daysSince(t.dateRange.to);
        return {
          t, a, tier,
          hasDrift: !!a?.driftNote?.whyChanged,
          fresh,
        };
      });

    // LEAD: high tier AND new events within ~24h. Freshest, then most-covered.
    const leadCands = items
      .filter(x => x.tier === 'high' && x.fresh <= 1)
      .sort((x, y) => y.t.dateRange.to.localeCompare(x.t.dateRange.to) || y.t.articleCount - x.t.articleCount);
    const chosenLead = leadCands[0] || null;

    // DEVELOPING (≤3): fresh drift note OR (≥elevated & ≤48h). Not the lead.
    // (Volume-"rising" threads are already surfaced in the right-rail "Rising This
    // Week" — DEVELOPING is the risk/living-analysis signal, so no duplication.)
    const devSorted = items
      .filter(x => x !== chosenLead && (
        x.hasDrift ||
        ((x.tier === 'high' || x.tier === 'elevated') && x.fresh <= 2)
      ))
      .sort((x, y) => {
        if (x.hasDrift !== y.hasDrift) return x.hasDrift ? -1 : 1;
        const tx = tierRank[x.tier] ?? 4, ty = tierRank[y.tier] ?? 4;
        if (tx !== ty) return tx - ty;
        if (x.t.dateRange.to !== y.t.dateRange.to) return y.t.dateRange.to.localeCompare(x.t.dateRange.to);
        return y.t.articleCount - x.t.articleCount;
      });

    // Greedily take up to 3, skipping any near-duplicate of the lead or an
    // already-chosen row (same story clustered twice shouldn't fill two slots).
    const displayTitle = x => x.a?.threadTitle || x.t.latestTitle;
    const seenKeys = chosenLead ? [titleKey(displayTitle(chosenLead))] : [];
    const devCands = [];
    for (const x of devSorted) {
      const k = titleKey(displayTitle(x));
      if (seenKeys.some(prev => tooSimilar(k, prev))) continue;
      seenKeys.push(k);
      devCands.push(x);
      if (devCands.length === 3) break;
    }

    const ids = new Set([chosenLead, ...devCands].filter(Boolean).map(x => x.t.threadId));
    return { lead: chosenLead, developing: devCands, promotedIds: ids };
  }, [threads, threadAnalyses, activeRegion, activeCountry, searchQuery, activeCategory]);

  // River excludes promoted threads (no double-show) and applies the category
  // filter chip. promotedIds is empty in work mode, so that clause is a no-op there.
  const riverThreads = useMemo(
    () => flatThreads.filter(t =>
      !promotedIds.has(t.threadId) &&
      (!activeCategory || (t.entries[0]?.category?.toLowerCase() || 'other') === activeCategory)
    ),
    [flatThreads, promotedIds, activeCategory],
  );

  // Category filter chips — computed from the browsable set (pre-category-filter)
  // so chips don't vanish when you pick one. Ordered, with counts.
  const categoryChips = useMemo(() => {
    const counts = {};
    for (const t of flatThreads) {
      if (promotedIds.has(t.threadId)) continue;
      const cat = t.entries[0]?.category?.toLowerCase() || 'other';
      const key = CATEGORY_ORDER.includes(cat) ? cat : 'other';
      counts[key] = (counts[key] || 0) + 1;
    }
    return CATEGORY_ORDER.filter(k => counts[k]).map(k => ({ cat: k, count: counts[k] }));
  }, [flatThreads, promotedIds]);

  useEffect(() => { document.title = 'Story Intelligence — Global Perspectives'; }, []);

  if (authLoading) return <div className="weekly-loading">Loading…</div>;

  const totalArticles = threads.reduce((sum, t) => sum + t.articleCount, 0) + standalone.length;

  const latestDate = allDates[0];

  if (viewMode === 'map') {
    return (
      <Suspense fallback={<div className="weekly-loading">Loading map…</div>}>
        <WeeklyMap embedded />
      </Suspense>
    );
  }

  if (loading) return <IntelligenceLoader type="typewriter" />;

  if (threads.length === 0 && standalone.length === 0) {
    return (
      <div className="weekly-empty-state">
        <h3>No archive data yet</h3>
        <p>Data is accumulating. Check back in a few hours as the pipeline runs.</p>
      </div>
    );
  }

  const strip = (
    <StatusStrip
      label="LIVE"
      stats={[
        { value: threads.length, unit: 'arcs' },
        { value: totalArticles, unit: 'articles' },
        { value: sortedDates.length, unit: 'days' },
      ]}
      updatedAt={latestDate ? `${latestDate}T12:00:00` : null}
    />
  );

  const leftRail = (
    <div className="wp-rail-left">
      <div className="wp-rail-section">
        <div className="wp-rail-label">Search</div>
        <input
          type="text"
          className="wp-search"
          placeholder="Search arcs…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="wp-rail-section">
        <div className="wp-rail-label">Period</div>
        <div className="wp-sort-group">
          {[
            { value: '3d', label: '3 days' },
            { value: '7d', label: '7 days' },
            ...(allDates.length > 7 ? [{ value: 'all', label: `All ${allDates.length}d` }] : []),
          ].map(opt => (
            <button
              key={opt.value}
              className={`wp-sort-btn ${timeRange === opt.value ? 'active' : ''}`}
              onClick={() => setTimeRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wp-rail-section">
        <div className="wp-rail-label">Sort</div>
        <div className="wp-sort-group">
          {[['articles', 'Most covered'], ['recent', 'Most recent'], ['rising', 'Rising first']].map(([v, label]) => (
            <button
              key={v}
              className={`wp-sort-btn ${sortBy === v ? 'active' : ''}`}
              onClick={() => setSortBy(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {regionGroups.length > 1 && (
        <div className="wp-rail-section">
          <div className="wp-rail-label">Region</div>
          <div className="wp-sort-group">
            <button
              className={`wp-sort-btn ${!activeRegion ? 'active' : ''}`}
              onClick={() => { setActiveRegion(null); setActiveCountry(null); }}
            >
              All
            </button>
            {regionGroups.map(g => (
              <button
                key={g.region}
                className={`wp-sort-btn ${activeRegion === g.region ? 'active' : ''}`}
                onClick={() => { setActiveRegion(activeRegion === g.region ? null : g.region); setActiveCountry(null); }}
              >
                {g.region} <span className="wp-region-count">{g.threads.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wp-rail-section">
        <div className="wp-rail-label">View</div>
        <div className="wp-sort-group">
          <button className={`wp-sort-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>List</button>
          <button className={`wp-sort-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>Map</button>
        </div>
      </div>
    </div>
  );

  const rightRail = (
    <div className="wp-rail-right">
      <FeaturedSection threads={threads} threadAnalyses={threadAnalyses} compact excludeIds={promotedIds} />
    </div>
  );

  return (
    <EditorialShell strip={strip} left={leftRail} right={rightRail} className="wp-shell">

      {welcome && (
        <div className="welcome-banner">
          <span>Welcome to Story Intelligence! You have full access. Explore story arcs, country briefings, and AI analysis below.</span>
          <button className="welcome-dismiss" onClick={() => setWelcome(false)}>✕</button>
        </div>
      )}

      {error && <div className="weekly-error">{error}</div>}
      {showIntro && <ArcIntro onDismiss={dismissIntro} />}

      <div className="weekly-feed">
        {flatThreads.length === 0 && flatStandalone.length === 0 && (
          <div className="weekly-empty-state">
            <p>No stories match your current filters.</p>
          </div>
        )}
        <LeadHierarchy lead={lead} developing={developing} />

        {categoryChips.length > 1 && (
          <div className="wp-cat-filter" role="group" aria-label="Filter by category">
            <button
              className={`wp-cat-chip ${!activeCategory ? 'active' : ''}`}
              aria-pressed={!activeCategory}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {categoryChips.map(({ cat, count }) => (
              <button
                key={cat}
                className={`wp-cat-chip ${activeCategory === cat ? 'active' : ''}`}
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {cat} <span className="wp-cat-chip-n">{count}</span>
              </button>
            ))}
          </div>
        )}

        {(() => {
          const buckets = { week: [], month: [], older: [] };
          for (const t of riverThreads) buckets[bandOf(t.dateRange.to)].push(t);
          // "Older" collapses only when a fresher band has content — so a quiet
          // period (everything old) still shows an open band, never a wall of
          // collapsed headers.
          const hasFresher = buckets.week.length > 0 || buckets.month.length > 0;
          return TIME_BANDS.map(band => {
            const items = buckets[band.key];
            if (!items.length) return null;
            return (
              <TimeBand
                key={band.key}
                band={band}
                items={items}
                threadAnalyses={threadAnalyses}
                defaultCollapsed={band.key === 'older' && hasFresher}
              />
            );
          });
        })()}

        {(() => {
          const s = activeCategory
            ? flatStandalone.filter(e => (e.category?.toLowerCase() || 'other') === activeCategory)
            : flatStandalone;
          return s.length > 0 ? <StandaloneSection entries={s} /> : null;
        })()}
      </div>
    </EditorialShell>
  );
}
