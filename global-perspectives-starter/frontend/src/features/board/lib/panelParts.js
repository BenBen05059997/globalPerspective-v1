import { dayMonth } from '@/shared/lib/branchWording.js';

// Pure helpers for the verdict, weekly and arrivals panels (artboards 3, 4, 5).

const norm = (s) => String(s ?? '').trim().toLowerCase();
const DAY = 86400000;

/** Dated headlines from the story records, one row per source of a shared outlet, newest first. */
export function evidenceRows(stories, outlets, limit = 5) {
  const want = new Set((outlets || []).map(norm));
  if (!want.size) return [];
  const seen = new Set();
  const rows = [];
  for (const story of Object.values(stories || {})) {
    for (const entry of story?.entries || []) {
      for (const src of entry.sources || []) {
        const headline = src.title || entry.title;
        const key = `${norm(src.outlet)}|${headline}`;
        if (!want.has(norm(src.outlet)) || !headline || seen.has(key)) continue;
        seen.add(key);
        rows.push({ key, date: entry.date, outlet: src.outlet, headline });
      }
    }
  }
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

/** Open branches due from today through the next six days: { key, text, due, p }, soonest first. */
export function dueThisWeek(stories, now = new Date()) {
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 6 * DAY).toISOString().slice(0, 10);
  return Object.values(stories || {}).flatMap((s) => (s?.forks || []).flatMap((f) => f.branches
    .filter((b) => !b.verdict && b.due >= from && b.due <= to)
    .map((b) => ({ key: `${s.threadId}:${b.branchId}`, text: b.text, due: b.due, p: Number.isFinite(b.p) ? b.p : null }))))
    .sort((a, b) => a.due.localeCompare(b.due) || a.key.localeCompare(b.key));
}

/** Plain-text memo of a verdict, for copying. */
export function verdictMemo({ labelA, labelB, strengthWord, note, shared, evidence, line }) {
  const out = [`${labelA} / ${labelB}`, strengthWord];
  if (note) out.push(note);
  if (shared.length) out.push(`Shared: ${shared.join(', ')}`);
  if (evidence.length) out.push('Evidence:', ...evidence.map((e) => `- ${dayMonth(e.date)} ${e.outlet}: ${e.headline}`));
  if (line.trim()) out.push(`My line: ${line.trim()}`);
  out.push('Computed from what we hold; it is a test, not a finding.');
  return out.join('\n');
}
