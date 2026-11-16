// Decision 0061: a story written after its run slot (the news pipeline was down) carries
// `writtenLate: { writtenAt, slot }` (ISO times). Readers say so in one quiet line. A marker whose
// `writtenAt` or `slot` is missing or not a time is ignored: no line, no placeholder.
import { dayMonth } from '@/shared/lib/branchWording.js';

const isoOf = (v) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
};

/** 'Written 16 Nov from articles saved on 15 Nov' (UTC days) for an entry with a valid marker; null otherwise. */
export function writtenLateText(entry) {
  const m = entry?.writtenLate;
  if (!m || typeof m !== 'object') return null;
  const written = dayMonth(isoOf(m.writtenAt));
  const slot = dayMonth(isoOf(m.slot));
  return written && slot ? `Written ${written} from articles saved on ${slot}` : null;
}

/** `{ writtenLate }` when the entry carries a valid marker, else `{}`: for mappers that pick named fields (spread the result). */
export const writtenLateOf = (e) => (writtenLateText(e) ? { writtenLate: e.writtenLate } : {});
