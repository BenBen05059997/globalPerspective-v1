// questionStates — one vocabulary for a sampled question's state, shared by the board, the right
// panel, the text page and the story chips. The states come from the server (`questions.sampled[]`
// and `prediction_snapshot`): yes / no / void once a person confirmed it, else awaiting, or
// past_deadline_unchecked once the deadline has passed with no verdict.
// A passed deadline is NEVER "awaiting" and NEVER inferred as a miss; it reads "awaiting check".
// A "no" is a claim about our own coverage ("not reported"), never "didn't happen".

export const STATE_META = {
  yes: { glyph: '✓', label: 'Happened', short: 'happened', kind: 'yes' },
  no: { glyph: '✗', label: 'Not reported', short: 'not reported', kind: 'no' },
  void: { glyph: '◌', label: 'Could not be checked', short: 'could not be checked', kind: 'void' },
  awaiting: { glyph: '▢', label: 'Awaiting', short: 'awaiting', kind: 'awaiting' },
  past_deadline_unchecked: { glyph: '▢', label: 'Awaiting check', short: 'awaiting check', kind: 'past' },
};

// Void reasons are worded once, in branchWording (0038); re-exported so question surfaces share them.
export { VOID_REASON_WORDS as VOID_REASON_LABEL } from '@/shared/lib/branchWording.js';

export function stateMeta(state) {
  return STATE_META[state] || null;
}

// Normalise a board item (a sampled question or a legacy pilot item) to one of the states above.
export function itemState(item) {
  if (!item) return null;
  if (item.state && STATE_META[item.state]) return item.state;
  if (item.verdict === 'fired') return 'yes';
  if (item.verdict === 'not_fired') return 'no';
  return null;
}
