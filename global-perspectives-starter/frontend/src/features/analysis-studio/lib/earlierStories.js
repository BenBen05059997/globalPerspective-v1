// Analysis Studio — "Earlier stories (last 30 days)" picker section (D2, S5b monitor
// round: today's ~17-topic picker was the whole D2 goal's remaining gap — a story
// from the last 30 days couldn't be SELECTED at all, so it never reached the typed-
// source feed no matter how rich its stored material was). Pure, so it's testable
// without the network — AnalysisStudio.jsx supplies the fetched `dayMap` (from
// useWeeklyArchive, the same hook /weekly already uses) and calls this.

import { dropRedatedRepeats } from '@/features/threads/hooks/useNarrativeThread';

// buildEarlierStoryList(dayMap, { excludeTopicIds, query }) → rows, newest-real-date first.
//   dayMap:          useWeeklyArchive()'s `{ [dateLabel]: { entries, source, updatedAt } }`
//                    (fetchArchiveRange's lightweight per-day entries — headline/category/
//                    regions/sources/threadId only, no heavy AI fields; 6MB-safe per the
//                    archive_range payload-limit rule). `source === 'latest'` is today —
//                    excluded here since today's own topics are already the picker's first
//                    section.
//   excludeTopicIds: today's topicIds (Set) — never list the same story twice.
//   query:           case-insensitive substring filter over the title.
//
// A thread can appear on several days (its topicId/title evolves as coverage continues,
// or — the archive re-dating bug story mode already guards against — the SAME headline
// resurfaces under a later date). dropRedatedRepeats (the same rule the D2 NEWS feed and
// story mode use) collapses an exact re-dated repeat to its earliest real appearance
// BEFORE this collapses everything to one row per threadId, keeping the LATEST remaining
// date — so "last real date" is genuinely the last time this thread had real coverage,
// never an artifact of the re-dating bug.
export function buildEarlierStoryList(dayMap, { excludeTopicIds = new Set(), query = '' } = {}) {
  const flat = [];
  for (const [dateLabel, day] of Object.entries(dayMap || {})) {
    if (!day || day.source === 'latest') continue; // today — the picker's first section
    for (const e of Array.isArray(day.entries) ? day.entries : []) {
      if (!e?.threadId) continue; // no thread id → can't feed buildAnalysisContext's D2 path
      const topicId = e.topicId || e.id;
      if (!topicId || excludeTopicIds.has(topicId)) continue;
      flat.push({ ...e, topicId, date: dateLabel });
    }
  }

  const deduped = dropRedatedRepeats(flat);

  const byThread = new Map();
  for (const e of deduped) {
    const prev = byThread.get(e.threadId);
    if (!prev || String(e.date || '') > String(prev.date || '')) byThread.set(e.threadId, e);
  }
  let rows = [...byThread.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const q = query.trim().toLowerCase();
  if (q) rows = rows.filter((r) => String(r.title || '').toLowerCase().includes(q));
  return rows;
}
