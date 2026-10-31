import { dayMonth } from '@/shared/lib/branchWording.js';

// Pure helpers for the verdict, weekly and arrivals panels (artboards 3, 4, 5).

const norm = (s) => String(s ?? '').trim().toLowerCase();

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
