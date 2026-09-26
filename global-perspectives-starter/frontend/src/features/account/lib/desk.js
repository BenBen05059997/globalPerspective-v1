// Desk (A4) — pure helpers for "Since your last visit". No React, no fetch: everything here
// takes plain data in and returns plain data out, so it's unit-testable without mocking the
// network or the DOM.
//
// Rule this file exists to enforce (CLAUDE.md: never invent facts/dates; fail empty, not fake):
// every date, delta and explanation shown on the Desk must trace back to a real snapshot or
// driftNote the server sent us. Nothing here guesses.
import { AXES, AXIS_LABELS } from '@/shared/lib/riskTiers';
import { freshnessState } from '@/shared/lib/freshness';
import { threadPath } from '@/shared/lib/threadPath';

export const LAST_VISIT_KEY = 'gp_desk_last_visit_v1';

function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// readLastVisit / writeLastVisit — per-browser timestamp, try/catch throughout (private
// browsing, blocked storage, a quota error, or a caller-supplied storage stub that throws must
// never crash the Desk). `storage` is injectable for tests.
export function readLastVisit(storage = safeLocalStorage()) {
  if (!storage) return null;
  try {
    return storage.getItem(LAST_VISIT_KEY) || null;
  } catch {
    return null;
  }
}

export function writeLastVisit(iso = new Date().toISOString(), storage = safeLocalStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(LAST_VISIT_KEY, iso);
    return true;
  } catch {
    return false;
  }
}

// One axis's numeric score from a snapshot's `dimensions` vector — bare number or {score,why}.
// Mirrors features/countries/lib/countryDrift.js's axisScoreOf (kept local: that module isn't
// exported for reuse and the two call sites have different materiality thresholds).
function axisScoreOf(dims, axis) {
  const v = dims && dims[axis];
  if (v == null) return null;
  const n = Number(typeof v === 'object' ? v.score : v);
  return Number.isFinite(n) ? n : null;
}

// axisMoves(prevSnap, snap, min) — per-axis deltas between two HISTORY snapshots, worst-first,
// filtered to |Δ| >= min (default 10, per the Desk spec — a stricter bar than CountryWhatChanged's
// 8, since this feeds an unsolicited "since you left" summary rather than an on-page explainer).
// Needs both sides scored on an axis; a missing side is skipped, never treated as a 0.
export function axisMoves(prevSnap, snap, min = 10) {
  const out = [];
  for (const axis of AXES) {
    const from = axisScoreOf(prevSnap && prevSnap.dimensions, axis);
    const to = axisScoreOf(snap && snap.dimensions, axis);
    if (from == null || to == null) continue;
    const delta = to - from;
    if (Math.abs(delta) >= min) out.push({ axis, label: AXIS_LABELS[axis] || axis, from, to, delta });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// notesSince(notes, lastVisitIso) — driftNotes with `asOf` strictly after lastVisitIso, newest
// first. A missing/unparseable lastVisitIso or asOf drops the note (never guessed in).
export function notesSince(notes, lastVisitIso) {
  const list = Array.isArray(notes) ? notes : [];
  if (lastVisitIso == null) return [];
  const cutoff = new Date(lastVisitIso).getTime();
  if (!Number.isFinite(cutoff)) return [];
  return list
    .filter((n) => {
      const t = new Date(n?.asOf).getTime();
      return Number.isFinite(t) && t > cutoff;
    })
    .sort((a, b) => String(b.asOf || '').localeCompare(String(a.asOf || '')));
}

// snapshotPairForNote — the two consecutive HISTORY snapshots straddling a driftNote's `asOf`,
// so we can compute which axis actually moved for THAT note (rather than the country's latest
// move, which may be a different day). null when the country's snapshot log doesn't cover it.
export function snapshotPairForNote(snapshots, asOf) {
  const sorted = Array.isArray(snapshots)
    ? [...snapshots].sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')))
    : [];
  const idx = sorted.findIndex((s) => s.dateKey === asOf);
  if (idx <= 0) return null;
  return { prev: sorted[idx - 1], curr: sorted[idx] };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s || '') : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// rowFromNote — one driftNote → a display row. Prefers the computed per-axis moves (only axes
// with |Δ|>=10) over the note's own changeScore; falls back to the overall from→to when the
// country's snapshot log doesn't cover this note's date. Direction-check flagging is explicitly
// out of scope for v1 (needs a backend rule) — this never computes or shows one.
export function rowFromNote(note, country, snapshots) {
  const pair = snapshotPairForNote(snapshots, note?.asOf);
  const moves = pair ? axisMoves(pair.prev, pair.curr, 10) : [];
  let axisLine = null;
  if (moves.length) {
    axisLine = moves.map((m) => `${m.label.toUpperCase()} ${m.from}→${m.to}`).join(', ');
  } else if (note?.changeScore && note.changeScore.from != null && note.changeScore.to != null) {
    axisLine = `${note.changeScore.from}→${note.changeScore.to}`;
  }
  // Link only with a real threadId: a triggerEvent's topicId is NOT a thread id, and
  // /weekly/thread/<topicId> would open a missing page (monitor fix, A4 review).
  const threadId = note?.triggerEvent?.threadId;
  return {
    key: `${country}:${note?.asOf}`,
    asOf: note?.asOf || null,
    dateLabel: fmtDay(note?.asOf),
    country,
    axisLine,
    triggerTitle: note?.triggerEvent?.title || null,
    triggerDateLabel: note?.triggerEvent?.date ? fmtDay(note.triggerEvent.date) : null,
    triggerHref: threadId ? threadPath(threadId) : null,
    why: note?.whyChanged || null,
  };
}

// buildDeskRows — the whole "Since your last visit" list from a batch of per-country
// country_history results (see hooks/useDeskChanges.js) plus the reader's last-visit timestamp.
//   - lastVisitIso === null  → first visit on this browser: newest 5 notes across all follows.
//   - otherwise              → every note newer than lastVisitIso, newest first.
// countryResults entries with `.error` are skipped (the caller shows its own "couldn't load"
// line for those). Also reports the newest asOf seen at all (for the staleness line) and
// whether any country's notes were server-gated.
export function buildDeskRows(countryResults, lastVisitIso) {
  const firstVisit = !lastVisitIso;
  const list = Array.isArray(countryResults) ? countryResults : [];
  const flat = [];
  let anyGated = false;
  let newestAsOf = null;
  for (const cr of list) {
    if (cr.driftNotesGated) anyGated = true;
    if (cr.error) continue;
    const notes = Array.isArray(cr.driftNotes) ? cr.driftNotes : [];
    for (const n of notes) {
      if (n?.asOf && (!newestAsOf || n.asOf > newestAsOf)) newestAsOf = n.asOf;
      flat.push({ note: n, country: cr.country, snapshots: cr.snapshots });
    }
  }

  let selected;
  if (firstVisit) {
    selected = [...flat]
      .sort((a, b) => String(b.note?.asOf || '').localeCompare(String(a.note?.asOf || '')))
      .slice(0, 5);
  } else {
    selected = flat
      .filter(({ note }) => {
        if (lastVisitIso == null) return false;
        const t = new Date(note?.asOf).getTime();
        const cutoff = new Date(lastVisitIso).getTime();
        return Number.isFinite(t) && Number.isFinite(cutoff) && t > cutoff;
      })
      .sort((a, b) => String(b.note?.asOf || '').localeCompare(String(a.note?.asOf || '')));
  }

  const rows = selected.map(({ note, country, snapshots }) => rowFromNote(note, country, snapshots));
  return { rows, firstVisit, anyGated, newestAsOf };
}

// isStaleSince — reuses the site's freshness ramp (shared/lib/freshness.js): once the newest
// note is 7+ days old (freshnessState's "older"/"hidden" bands) we say so plainly instead of
// silently rendering an empty or stale-looking list. Returns a formatted date label, or null
// when there's nothing to report or the newest note is still fresh.
export function isStaleSince(newestAsOf, now = Date.now()) {
  if (!newestAsOf) return null;
  const t = new Date(newestAsOf).getTime();
  if (!Number.isFinite(t)) return null;
  const ageDays = (new Date(now).getTime() - t) / 86400000;
  const state = freshnessState(ageDays);
  if (state === 'live' || state === 'plain') return null;
  return fmtDay(newestAsOf);
}
