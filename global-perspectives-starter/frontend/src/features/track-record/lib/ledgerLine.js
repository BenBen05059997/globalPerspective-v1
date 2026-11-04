// ledgerLine — one corrections-ledger note as plain parts, for both pages (the page adds links and the
// follow button, the text version prints them). The note carries a threadId but no story title, so a story
// row is "A story" (linked when the id is a real `thread-` id), never the id text. The cause goes through
// driftNote's safeTriggerEvent / safeWhy so a flagged note shows numbers only.
import { safeTriggerEvent, safeWhy } from '@/shared/lib/driftNote.js';
import { AXES, AXIS_LABELS } from '@/shared/lib/riskTiers.js';

export function ledgerLine(n) {
  const country = n.scope === 'country';
  const id = n.threadId || n.name || '';
  const event = safeTriggerEvent(n);
  // Only a value that moved is shown: a note whose level and score are unchanged (a revised read, e.g. an
  // axis moved or only the reasoning) never prints "72 → 72".
  const moved = (c) => c?.from != null && c?.to != null && c.from !== c.to;
  const axis = AXES.find((a) => moved(n.changeDimensions?.[a]));
  let change = 'read revised';
  if (moved(n.changeLevel)) change = `${n.changeLevel.from} → ${n.changeLevel.to}`;
  else if (moved(n.changeScore)) change = `risk ${n.changeScore.from} → ${n.changeScore.to}`;
  else if (axis) change = `${AXIS_LABELS[axis]} ${n.changeDimensions[axis].from} → ${n.changeDimensions[axis].to}`;
  return {
    country,
    name: country ? n.name : 'A story',
    threadId: !country && /^thread-/.test(id) ? id : null,
    change,
    asOf: n.asOf,
    noSingleDriver: !!n.noSingleDriver,
    event: !n.noSingleDriver && event?.title ? { title: event.title, threadId: event.threadId, date: event.date } : null,
    why: !n.noSingleDriver && !event?.title ? safeWhy(n) : null,
  };
}

export const NO_SINGLE_DRIVER = 'No single driver — a gradual shift across the coverage, not one event.';
export const LEDGER_EMPTY = 'No conclusion changes recorded in the current window.';
export const LEDGER_UNAVAILABLE = 'The ledger of changed reads could not be loaded.';

/** "Showing the 5 most recent of 389 corrections." when the server capped the list, else null. */
export function ledgerGateText({ notes, total, gated }) {
  return gated && total > notes.length ? `Showing the ${notes.length} most recent of ${total} corrections.` : null;
}
