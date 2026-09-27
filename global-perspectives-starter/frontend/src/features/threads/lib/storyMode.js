// storyMode — pure logic for the story-mode slide deck (S2.1, TASK_2026-09-27_pages_local).
// Everything here is a pure function of real data (entries / analysis / forecast / links): no
// invented dates, no placeholder copy. Freshness gating reuses the shared freshnessState ramp
// (live <24h · plain 1–7d · older 7–30d amber · hidden 30d+) so this file, the map and the feed
// never disagree about what "older" or "too old to show" means (CLAUDE.md, S5).
import { freshnessState } from '@/shared/lib/freshness.js';

const MAX_CHAPTERS = 4;

/** ageDays(iso, now) — real elapsed days, clamped to 0 for clock-skew futures. Null when unparsable. */
function ageDays(iso, now = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now - t) / 86400000);
}

/**
 * analysisTextState(generatedAt) -> 'fresh' | 'older' | 'hidden' | 'unknown'
 * S5: amber "older" label after 7 days; the AI text itself is hidden after 30 days (the computed
 * date is still shown so the page stays honest about when the analysis was last run).
 */
export function analysisTextState(generatedAt, now = Date.now()) {
  const days = ageDays(generatedAt, now);
  if (days == null) return 'unknown';
  const state = freshnessState(days);
  if (state === 'live' || state === 'plain') return 'fresh';
  if (state === 'older') return 'older';
  return 'hidden';
}

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export { shortDate };

/**
 * rawDateLabel(dateStr) -> "Fri, Sep 4" — like formatDateLabel, but never collapses a date that
 * happens to equal today/yesterday to the word "Today"/"Yesterday". Used for the story's overall
 * date SPAN (BRIEF header), where "Today" would misstate a fixed historical range as still-live
 * (review: S2.1 monitor fix #3).
 */
export function rawDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** spanDays(from, to) -> inclusive calendar-day count between two YYYY-MM-DD dates (min 1). */
export function spanDays(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** mostFrequent(list) -> the most common non-empty value, ties broken by first occurrence. */
function mostFrequent(list) {
  const counts = new Map();
  for (const v of list) { if (!v) continue; counts.set(v, (counts.get(v) || 0) + 1); }
  let best = null; let bestN = 0;
  for (const [v, n] of counts) { if (n > bestN) { best = v; bestN = n; } }
  return best;
}

/**
 * buildChapters(entries, entryShortTitles, inflectionTopicId, iso3ForName) ->
 *   [{ key, label, from, to, country, iso3, mentionCount, entries, isInflection, inflectionDate }]
 * `entries` must be sorted OLDEST-FIRST (chronological chapters). Splits into up to
 * MAX_CHAPTERS contiguous, roughly-even groups — a thin story (1–3 entries) gets 1–3 chapters,
 * never an empty one (S6-style "no empty slides" rule applied to chapters too).
 */
export function buildChapters(entries, entryShortTitles, inflectionTopicId, iso3ForName = () => null) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const shortTitleMap = {};
  if (Array.isArray(entryShortTitles)) {
    for (const item of entryShortTitles) shortTitleMap[item.topicId] = item.shortTitle;
  }
  const n = entries.length;
  const numChapters = Math.min(MAX_CHAPTERS, n);
  const base = Math.floor(n / numChapters);
  const extra = n % numChapters;
  const chapters = [];
  let idx = 0;
  for (let c = 0; c < numChapters; c++) {
    const size = base + (c < extra ? 1 : 0);
    const group = entries.slice(idx, idx + size);
    idx += size;
    if (!group.length) continue;
    const first = group[0];
    const last = group[group.length - 1];
    const label = shortTitleMap[first.topicId] || first.title;
    const country = mostFrequent(group.flatMap((e) => e.regions || []));
    const iso3 = country ? iso3ForName(country) : null;
    const hasInflection = inflectionTopicId != null && group.some((e) => e.topicId === inflectionTopicId);
    const inflectionEntry = hasInflection ? group.find((e) => e.topicId === inflectionTopicId) : null;
    chapters.push({
      key: `ch${chapters.length + 1}`,
      label,
      from: first.date,
      to: last.date,
      country,
      iso3,
      mentionCount: group.length,
      entries: group,
      isInflection: hasInflection,
      inflectionDate: inflectionEntry?.date || null,
    });
  }
  return chapters;
}

/**
 * buildScrubberDays(entries) -> [{ date, count }] sorted ascending — real per-day news counts,
 * the scrubber's "news per day" bars. `entries` in any order.
 */
export function buildScrubberDays(entries) {
  if (!Array.isArray(entries)) return [];
  const counts = new Map();
  for (const e of entries) {
    if (!e?.date) continue;
    counts.set(e.date, (counts.get(e.date) || 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * buildDeadlines(forecast) -> [{ id, label, deadline, fired, scenarioLabel }] — only real dated
 * triggers from the thread's own v1 prediction snapshot. Empty when there is no forecast, or the
 * forecast carries no dated triggers (never invented).
 */
export function buildDeadlines(forecast) {
  if (!forecast?.scenarios?.length) return [];
  const out = [];
  for (const scenario of forecast.scenarios) {
    for (const trig of scenario.triggers || []) {
      if (!trig.deadline) continue;
      out.push({
        id: trig.id || `${scenario.label}-${trig.deadline}`,
        label: trig.text,
        deadline: trig.deadline,
        verdict: trig.verdict || null,
        scenarioLabel: scenario.label,
      });
    }
  }
  return out.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
}

/**
 * buildSlides(...) -> [{ key, label }] — the horizontal slide order: BRIEF, CH1..CHn (n<=4),
 * FED INTO (only when fedInto has entries — S6), WATCH (only when there are real deadlines).
 */
export function buildSlides({ chapters = [], fedInto = [], deadlines = [] }) {
  const slides = [{ key: 'brief', label: 'BRIEF' }];
  chapters.forEach((c, i) => slides.push({ key: c.key, label: `CH${i + 1}` }));
  if (fedInto.length > 0) slides.push({ key: 'fedinto', label: 'FED INTO' });
  if (deadlines.length > 0) slides.push({ key: 'watch', label: 'WATCH' });
  return slides;
}

/**
 * viewFrom(entries) -> { byCountry: [{ code, count }], byType: [{ type, count }], total,
 *   unknownCount } | null — coverage by outlet country/type from the story's own `sources[]`
 *   metadata (STORY_DOSSIER_BOARD_DESIGN_BRIEF §"the view from"). Null when no source carries
 *   this metadata at all (hide the drawer rather than show an empty shell).
 */
/**
 * scrubberRange(fromDate, toDate, deadlines, now) -> { startMs, endMs } — the scrubber's date
 * span. Extends past the story's newest entry to the furthest real forecast deadline (so ◆ marks
 * are reachable), and always includes "today" (TODAY is a real fact even for a quiet story).
 */
export function scrubberRange(fromDate, toDate, deadlines = [], now = Date.now()) {
  const startMs = fromDate ? new Date(fromDate).getTime() : now;
  let endMs = toDate ? new Date(toDate).getTime() : now;
  endMs = Math.max(endMs, now);
  for (const d of deadlines) {
    const t = new Date(d.deadline).getTime();
    if (Number.isFinite(t)) endMs = Math.max(endMs, t);
  }
  if (endMs <= startMs) endMs = startMs + 86400000; // never a zero-width range
  return { startMs, endMs };
}

/** pctForDate(dateStr, startMs, endMs) -> 0..100, clamped — position along the scrubber track. */
export function pctForDate(dateStr, startMs, endMs) {
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t) || endMs <= startMs) return 0;
  return Math.max(0, Math.min(100, ((t - startMs) / (endMs - startMs)) * 100));
}

const DAY_MS = 86400000;
const NICE_STEPS_DAYS = [1, 2, 5, 7, 14, 30, 60, 90, 180, 365];

/**
 * buildScrubberTicks(startMs, endMs, targetCount) -> [{ ms, label }] — date ticks for the
 * scrubber axis so the track is readable (review fix #4: "the scrubber can't be read"). Always
 * includes the start and end of the range; fills in with a "nice" day step (1/2/5/7/14/30/60/90d)
 * closest to `targetCount` intermediate ticks.
 */
export function buildScrubberTicks(startMs, endMs, targetCount = 5) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  const spanDaysN = (endMs - startMs) / DAY_MS;
  const rawStep = spanDaysN / Math.max(1, targetCount);
  const stepDays = NICE_STEPS_DAYS.find((s) => s >= rawStep) || NICE_STEPS_DAYS[NICE_STEPS_DAYS.length - 1];
  const stepMs = stepDays * DAY_MS;
  const ticks = [];
  const seen = new Set();
  const label = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const add = (ms) => {
    const key = Math.round(ms / DAY_MS);
    if (seen.has(key)) return;
    seen.add(key);
    ticks.push({ ms, label: label(ms) });
  };
  add(startMs);
  for (let t = startMs + stepMs; t < endMs; t += stepMs) add(t);
  add(endMs);
  return ticks.sort((a, b) => a.ms - b.ms);
}

export function viewFrom(entries) {
  if (!Array.isArray(entries)) return null;
  const byCountry = new Map();
  const byType = new Map();
  let total = 0;
  let unknown = 0;
  const seenOutlets = new Set();
  for (const e of entries) {
    for (const s of e.sources || []) {
      const outletKey = (s.source || s.title || '').toLowerCase();
      if (outletKey && seenOutlets.has(outletKey)) continue;
      if (outletKey) seenOutlets.add(outletKey);
      total++;
      if (s.outletCountry && s.outletCountry.length === 2) {
        byCountry.set(s.outletCountry, (byCountry.get(s.outletCountry) || 0) + 1);
      } else {
        unknown++;
      }
      if (s.outletType) byType.set(s.outletType, (byType.get(s.outletType) || 0) + 1);
    }
  }
  if (total === 0 || (byCountry.size === 0 && byType.size === 0)) return null;
  return {
    total,
    unknownCount: unknown,
    byCountry: [...byCountry.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
  };
}
