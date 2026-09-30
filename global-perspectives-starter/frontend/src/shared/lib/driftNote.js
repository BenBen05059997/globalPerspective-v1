// Drift-note trust (Batch 3 / phase E, D9). A note whose `whyChanged` explained a lower score with a
// worsening (or the reverse) carries `directionFlag`:
//   - new notes (newsDriftCorrector, after 2026-09-30): the server already replaced `whyChanged` with a
//     numbers-only sentence and dropped the cited event; the flag is informational;
//   - existing notes flagged by the audit (`directionFlag.backfilled`): the stored text is untouched but
//     is contradictory, so it must never be shown as an explanation.
// Every reader that shows `whyChanged` / `triggerEvent` goes through these helpers, so a flagged note
// shows the numbers only. Nothing here rewrites data or invents a cause.

export function isNoteFlagged(note) {
  return !!(note && note.directionFlag);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** noteNumbersText - the deterministic "what moved" sentence from the note's own stored numbers (same wording the server stores). */
export function noteNumbersText(note) {
  if (!note) return null;
  const parts = [];
  for (const [axis, v] of Object.entries(note.changeDimensions || {})) {
    const d = Number(v && v.delta);
    if (Number.isFinite(d) && d !== 0) parts.push(`${cap(axis)} risk ${d > 0 ? 'rose' : 'fell'} ${Math.abs(d)} points (${v.from} to ${v.to})`);
  }
  if (!parts.length) {
    const from = Number(note.changeScore && note.changeScore.from); const to = Number(note.changeScore && note.changeScore.to);
    if (Number.isFinite(from) && Number.isFinite(to) && from !== to) parts.push(`Overall risk score ${to > from ? 'rose' : 'fell'} ${Math.abs(to - from)} points (${from} to ${to})`);
  }
  return parts.length ? `${parts.join('; ')}.` : null;
}

/** safeWhy - the explanation text that may be shown for this note (null = show nothing). */
export function safeWhy(note) {
  if (!note || typeof note.whyChanged !== 'string' || !note.whyChanged.trim()) return null;
  if (!isNoteFlagged(note)) return note.whyChanged;
  // new server flag: whyChanged is already numbers-only; backfilled flag: the prose is unsafe, rebuild from numbers
  return note.directionFlag.backfilled ? noteNumbersText(note) : note.whyChanged;
}

/** safeTriggerEvent - a flagged note's cited event is not trusted as the cause. */
export function safeTriggerEvent(note) {
  return note && !isNoteFlagged(note) ? (note.triggerEvent || null) : null;
}
