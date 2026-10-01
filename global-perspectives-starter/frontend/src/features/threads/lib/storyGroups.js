// storyGroups — the pure logic behind the Stories page (/weekly): building story threads from the
// archive, grouping by age (Moving now / This week / Older / Archive), the crisis-type / tier /
// window / region / search filters, the three sorts, the header tier counts and the timeline dot
// layout. No React, no fetching, no clock reads (callers pass `now`) so every rule is unit-tested.
//
// Honesty rules (CLAUDE.md "never invent facts"): every date comes from the archive's own day keys
// (YYYY-MM-DD) or a day's real `updatedAt`; nothing here synthesises a date, a status or a score.
import { getTopicRegion } from '@/shared/lib/countryMapping';
import { getTrend } from '@/features/threads/components/TrendBadge';
import { crisisTypeForCategory } from '@/shared/lib/crisisHue';
import { deriveHeadline } from '@/shared/lib/riskTiers';

export const MS_DAY = 86400000;

// Topic categories that /weekly?category= accepts (ThreadPage's breadcrumb links here).
export const CATEGORY_ORDER = ['politics', 'economy', 'conflict', 'military', 'disaster', 'climate', 'energy', 'technology', 'science', 'business', 'health', 'society', 'other'];

export const CRISIS_TYPES = ['conflict', 'political', 'economic', 'humanitarian'];

// Window control: last-change recency. Infinity = everything the archive returned (<= 30 days).
export const WINDOWS = [
  { value: '1d', label: '24 h', days: 1, span: 3 },
  { value: '3d', label: '3 d', days: 3, span: 3 },
  { value: '7d', label: '7 d', days: 7, span: 7 },
  { value: '30d', label: '30 d', days: Infinity, span: 30 },
];
export const DEFAULT_WINDOW = '30d';
export const SORTS = [
  { value: 'articles', label: 'Most covered' },
  { value: 'recent', label: 'Most recent' },
  { value: 'rising', label: 'Rising first' },
];
export const TIER_FILTERS = ['high', 'elevated', 'moderate', 'low', 'none'];

const windowOf = (value) => WINDOWS.find((w) => w.value === value) || WINDOWS[WINDOWS.length - 1];

// Whole days since a YYYY-MM-DD archive date (the archive is day-granular), local calendar.
export function daysSince(dateStr, now = Date.now()) {
  return Math.floor((now - new Date(dateStr + 'T00:00:00').getTime()) / MS_DAY);
}

// ─── Threads from the archive ───────────────────────────────────────────────────────────────────

function validIso(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * buildThreads(dayMap, sortedDates, now) -> { threads, standalone }
 * Groups archive entries by `threadId`. Each thread carries `dates` (unique day keys, ascending),
 * `dateRange`, `changedAt` (a REAL timestamp: the `updatedAt` of the thread's newest day; with none,
 * the newest day's local midnight only when that day is before today, else null — never a guess)
 * and the same fields the old page used (entries, articleCount, dayCount, regions, trend ...).
 */
export function buildThreads(dayMap, sortedDates, now = Date.now()) {
  const threadMap = {};
  const standalone = [];
  for (const date of sortedDates) {
    const entries = dayMap[date]?.entries || [];
    for (const entry of entries) {
      const enriched = { ...entry, date };
      if (entry.threadId) {
        const t = threadMap[entry.threadId] || (threadMap[entry.threadId] = { entries: [], allSources: new Set(), allRegions: new Set() });
        t.entries.push(enriched);
        for (const s of (entry.sources || [])) t.allSources.add(s.source || s.title || 'Unknown');
        for (const r of (entry.regions || [])) t.allRegions.add(r);
      } else {
        standalone.push(enriched);
      }
    }
  }

  const threads = Object.entries(threadMap).map(([threadId, data]) => {
    data.entries.sort((a, b) => b.date.localeCompare(a.date));
    const regions = [...data.allRegions];
    const to = data.entries[0].date;
    const from = data.entries[data.entries.length - 1].date;
    const dates = [...new Set(data.entries.map((e) => e.date))].sort();
    const stamped = validIso(dayMap[to]?.updatedAt);
    const changedAt = stamped || (daysSince(to, now) >= 1 ? `${to}T00:00:00` : null);
    return {
      threadId,
      latestTitle: data.entries[0].title,
      entries: data.entries,
      articleCount: data.entries.length,
      dayCount: dates.length,
      dates,
      sources: [...data.allSources].slice(0, 8),
      sourceCount: data.allSources.size,
      regions,
      primaryRegion: getTopicRegion({ regions }),
      trend: getTrend(data.entries),
      category: data.entries[0].category ? String(data.entries[0].category).toLowerCase() : null,
      dateRange: { from, to },
      changedAt,
    };
  });
  for (const entry of standalone) entry.primaryRegion = getTopicRegion(entry);
  return { threads, standalone };
}

// ─── Age ────────────────────────────────────────────────────────────────────────────────────────

/** Days since the story's last change: real timestamp when there is one, else the day key. */
export function ageDaysOf(thread, now = Date.now()) {
  if (thread.changedAt) {
    const t = Date.parse(thread.changedAt);
    if (Number.isFinite(t)) return Math.max(0, now - t) / MS_DAY;
  }
  return Math.max(0, daysSince(thread.dateRange.to, now));
}

export const GROUPS = [
  { key: 'moving', label: 'Moving now', hint: 'changed in the last 24 h', initial: 8 },
  { key: 'week', label: 'This week', hint: '1 to 7 days ago', initial: 8 },
  { key: 'older', label: 'Older', hint: '7 to 30 days ago', initial: 12 },
  { key: 'archive', label: 'Archive', hint: 'more than 30 days ago', initial: 12 },
];

export function groupKeyOf(thread, now = Date.now()) {
  const d = ageDaysOf(thread, now);
  if (d < 1) return 'moving';
  if (d <= 7) return 'week';
  if (d <= 30) return 'older';
  return 'archive';
}

/** groupByAge(threads, now) -> { moving, week, older, archive } (input order preserved). */
export function groupByAge(threads, now = Date.now()) {
  const out = { moving: [], week: [], older: [], archive: [] };
  for (const t of threads) out[groupKeyOf(t, now)].push(t);
  return out;
}

// ─── Crisis / tier ──────────────────────────────────────────────────────────────────────────────

/** crisis type of a thread: the 4 crisis types, or 'neutral' (no claim) for other topics. */
export function crisisOf(thread) {
  return crisisTypeForCategory(thread.category);
}

// ─── Row text (summary line, "Watching" line) ───────────────────────────────────────────────────

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}…` : text;
}

/**
 * storySummary(thread, analysis) -> the one-line summary under a story's title, or null.
 * Same source the old list drew as its "hook": the first sentence of the analysis `storyArc`, else of
 * the newest entry's `ai.summary`. Nothing is written here: no source text, no line.
 */
export function storySummary(thread, analysis = null, max = 160) {
  const raw = analysis?.storyArc || thread?.entries?.[0]?.ai?.summary;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = raw.trim();
  return clip(text.split(/(?<=[.!?])\s/)[0] || text, max);
}

/**
 * watchingOf(analysis) -> the first forecast / watch question the analysis carries, or null.
 * Same source as the old "N questions to watch" hint (`analysis.watchQuestions`, strings).
 */
export function watchingOf(analysis = null, max = 140) {
  const q = Array.isArray(analysis?.watchQuestions) ? analysis.watchQuestions.find((x) => typeof x === 'string' && x.trim()) : null;
  return q ? clip(q.trim(), max) : null;
}

/** { tier, score } from the thread's analysis (v2 vector or legacy score); nulls when unscored. */
export function tierOf(analysis) {
  const h = deriveHeadline(analysis);
  return { tier: h.tier || null, score: h.score ?? null };
}

// ─── Filters ────────────────────────────────────────────────────────────────────────────────────

export function inWindow(thread, windowValue, now = Date.now()) {
  const { days } = windowOf(windowValue);
  return days === Infinity || ageDaysOf(thread, now) < days;
}

export function matchesSearch(thread, q, analysis = null) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return (
    thread.latestTitle.toLowerCase().includes(s) ||
    String(analysis?.threadTitle || '').toLowerCase().includes(s) ||
    thread.entries.some((e) => String(e.title || '').toLowerCase().includes(s)) ||
    thread.regions.some((r) => r.toLowerCase().includes(s)) ||
    thread.sources.some((x) => x.toLowerCase().includes(s))
  );
}

/**
 * filterThreads(threads, filters, analyses, now) — filters:
 *   { q, crisis: [..4 types], tiers: ['high'|...|'none'], region, category, window }
 * An empty list / null means "no restriction". Tier 'none' = not scored.
 */
export function filterThreads(threads, filters = {}, analyses = {}, now = Date.now()) {
  const { q = '', crisis = [], tiers = [], region = null, category = null, window = DEFAULT_WINDOW } = filters;
  return threads.filter((t) => {
    if (!inWindow(t, window, now)) return false;
    if (region && (t.primaryRegion || 'World') !== region) return false;
    if (category && (t.category || 'other') !== category) return false;
    if (crisis.length && !crisis.includes(crisisOf(t))) return false;
    if (tiers.length && !tiers.includes(tierOf(analyses?.[t.threadId]).tier || 'none')) return false;
    return matchesSearch(t, q, analyses?.[t.threadId]);
  });
}

/** Single mentions (no threadId) follow the same filters where they apply (tier: only 'none'). */
export function filterStandalone(entries, filters = {}, now = Date.now()) {
  const { q = '', crisis = [], tiers = [], region = null, category = null, window = DEFAULT_WINDOW } = filters;
  const { days } = windowOf(window);
  const s = q.trim().toLowerCase();
  return entries.filter((e) => {
    if (days !== Infinity && daysSince(e.date, now) >= days) return false;
    if (region && (e.primaryRegion || 'World') !== region) return false;
    if (category && (String(e.category || 'other').toLowerCase()) !== category) return false;
    if (crisis.length && !crisis.includes(crisisTypeForCategory(e.category))) return false;
    if (tiers.length && !tiers.includes('none')) return false;
    if (!s) return true;
    return String(e.title || '').toLowerCase().includes(s) || (e.regions || []).some((r) => r.toLowerCase().includes(s));
  });
}

// ─── Sorts ──────────────────────────────────────────────────────────────────────────────────────

const TREND_ORDER = { rising: 0, new: 1, stable: 2, fading: 3 };

/** sortThreads(threads, 'articles' | 'recent' | 'rising') — returns a new array. */
export function sortThreads(threads, sortBy = 'articles') {
  const copy = [...threads];
  if (sortBy === 'recent') {
    copy.sort((a, b) => b.dateRange.to.localeCompare(a.dateRange.to) || Date.parse(b.changedAt || 0) - Date.parse(a.changedAt || 0));
  } else if (sortBy === 'rising') {
    copy.sort((a, b) => (TREND_ORDER[a.trend] ?? 4) - (TREND_ORDER[b.trend] ?? 4) || b.articleCount - a.articleCount);
  } else {
    copy.sort((a, b) => b.articleCount - a.articleCount);
  }
  return copy;
}

// ─── Counts (header + filter groups) ────────────────────────────────────────────────────────────

/** tierCounts(threads, analyses) -> { high, elevated, moderate, low, none, total } */
export function tierCounts(threads, analyses = {}) {
  const out = { high: 0, elevated: 0, moderate: 0, low: 0, none: 0, total: threads.length };
  for (const t of threads) out[tierOf(analyses?.[t.threadId]).tier || 'none'] += 1;
  return out;
}

export function crisisCounts(threads) {
  const out = { conflict: 0, political: 0, economic: 0, humanitarian: 0 };
  for (const t of threads) { const c = crisisOf(t); if (c in out) out[c] += 1; }
  return out;
}

/** regionCounts(threads) -> [{ region, count }] most stories first, 'World' last (as before). */
export function regionCounts(threads) {
  const m = {};
  for (const t of threads) { const r = t.primaryRegion || 'World'; m[r] = (m[r] || 0) + 1; }
  return Object.entries(m)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => (a.region === 'World') - (b.region === 'World') || b.count - a.count);
}

// ─── Rising ─────────────────────────────────────────────────────────────────────────────────────

/** Threads whose coverage is rising or new (>= 2 articles): the old "Rising this week" rule. */
export function risingThreads(threads, limit = 5, excludeIds = null) {
  return threads
    .filter((t) => (t.trend === 'rising' || t.trend === 'new') && t.articleCount >= 2 && !excludeIds?.has(t.threadId))
    .sort((a, b) => (a.trend === 'rising' && b.trend !== 'rising' ? -1 : b.trend === 'rising' && a.trend !== 'rising' ? 1 : b.articleCount - a.articleCount))
    .slice(0, limit);
}

// ─── Last visit ("changed since your last visit") ───────────────────────────────────────────────

export const VISIT_KEY = 'gp_stories_visit_v1';
export const VISIT_GAP_MS = 30 * 60 * 1000;

/**
 * resolveVisit(stored, now) -> { baseline, next }
 * `stored` = { prev, last } from localStorage (or null). A visit that starts within 30 min of the
 * previous one continues it (a reload must not wipe the diff); otherwise the baseline becomes the
 * previous `last`. `baseline` is null on a first-ever visit (the page then shows "Moving now").
 */
export function resolveVisit(stored, now = Date.now()) {
  const last = Number(stored?.last);
  const prev = Number(stored?.prev);
  if (!Number.isFinite(last) || last <= 0) return { baseline: null, next: { prev: null, last: now } };
  if (now - last < VISIT_GAP_MS) {
    const baseline = Number.isFinite(prev) && prev > 0 ? prev : null;
    return { baseline, next: { prev: baseline, last: now } };
  }
  return { baseline: last, next: { prev: last, last: now } };
}

/** changedSince(threads, baselineMs) — stories whose real last change is after the baseline. */
export function changedSince(threads, baselineMs) {
  if (!Number.isFinite(baselineMs)) return [];
  return threads
    .filter((t) => {
      const ms = Date.parse(t.changedAt || '');
      return Number.isFinite(ms) && ms > baselineMs;
    })
    .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
}

// ─── Timeline (C) ───────────────────────────────────────────────────────────────────────────────

/** Axis span in days for a window (24 h / 3 d -> 3, 7 d -> 7, 30 d -> 30). */
export function timelineSpan(windowValue) {
  return windowOf(windowValue).span;
}

/**
 * timelineLayout(dates, span, now) — dots for the REAL coverage days of a story on an axis of
 * `span` days ending today. `dates` = the thread's unique YYYY-MM-DD keys. A date outside the axis
 * is left out (never clamped to the edge). pct = position 0..100 (span = 1 centres at 50).
 * Returns { dots: [{ date, pct }], first, last, line: { from, to } | null }.
 */
export function timelineLayout(dates, span, now = Date.now()) {
  const dots = [];
  const denom = Math.max(1, span - 1);
  for (const date of [...new Set(dates)].sort()) {
    const ago = daysSince(date, now);
    if (ago < 0 || ago > span - 1) continue;
    dots.push({ date, pct: span === 1 ? 50 : ((span - 1 - ago) / denom) * 100 });
  }
  return {
    dots,
    first: dots[0]?.date || null,
    last: dots[dots.length - 1]?.date || null,
    line: dots.length > 1 ? { from: dots[0].pct, to: dots[dots.length - 1].pct } : null,
  };
}

/** Axis ticks: about `count` evenly spaced local dates across the span, oldest first. */
export function timelineTicks(span, now = Date.now(), count = 6) {
  const denom = Math.max(1, span - 1);
  const n = Math.min(count, span);
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const idx = n === 1 ? span - 1 : Math.round((k * denom) / (n - 1));
    const d = new Date(now - (span - 1 - idx) * MS_DAY);
    out.push({
      idx,
      pct: span === 1 ? 50 : (idx / denom) * 100,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return out;
}
