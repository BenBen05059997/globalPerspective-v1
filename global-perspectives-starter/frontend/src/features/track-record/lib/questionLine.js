// questionLine — the one status line for a sampled question, in the words of ARCHITECTURE_FORECAST_LOOP §4
// (shared/lib/branchWording.js): "open · due 27 Jan", "happened · 3 Nov", "not reported by 27 Jan",
// "could not be checked · reason". The design has no words for a passed deadline with no verdict; it keeps the
// shared state word ("awaiting check", questionStates.js) and the deadline: "awaiting check · due 26 Oct".
// A no is a claim about our own coverage, never "didn't happen". Used by the board and the text version.
import { dayMonth, VOID_REASON_WORDS } from '@/shared/lib/branchWording.js';
import { itemState, stateMeta } from '@/shared/lib/questionStates.js';

const withDay = (head, day, sep) => (day ? `${head}${sep}${day}` : head);

/** -> { glyph, kind, text, quote, url } or null when the item has no known state. */
export function questionLine(item) {
  const state = itemState(item);
  const meta = stateMeta(state);
  if (!meta) return null;
  const v = item.verdict && typeof item.verdict === 'object' ? item.verdict : null;
  const due = dayMonth(item.deadline);
  let text;
  if (state === 'yes') text = withDay('happened', dayMonth(v?.decidedAt), ' · ');
  else if (state === 'no') text = withDay('not reported', due || dayMonth(v?.decidedAt), ' by ');
  else if (state === 'void') text = VOID_REASON_WORDS[item.voidReason] ? `${meta.short} · ${VOID_REASON_WORDS[item.voidReason]}` : meta.short;
  else if (state === 'awaiting') text = withDay('open', due, ' · due ');
  else text = withDay(meta.short, due, ' · due ');
  return { glyph: meta.glyph, kind: meta.kind, text, quote: v?.quote || null, url: v?.url || item.citation || null };
}
