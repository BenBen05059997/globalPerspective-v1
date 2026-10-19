// questionStates — one vocabulary for a sampled question's state, shared by the board, the right
// panel, the text page and the story chips. The states come from the server (`questions.sampled[]`
// and `prediction_snapshot`): yes / no / void once a person confirmed it, else awaiting, or
// past_deadline_unchecked once the deadline has passed with no verdict.
// A passed deadline is NEVER "awaiting" and NEVER inferred as a miss.

export const STATE_META = {
  yes: { glyph: '✓', label: 'Happened', short: 'happened', kind: 'yes' },
  no: { glyph: '✗', label: 'Didn’t happen', short: 'didn’t happen', kind: 'no' },
  void: { glyph: '◌', label: 'Void', short: 'void', kind: 'void' },
  awaiting: { glyph: '▢', label: 'Awaiting', short: 'awaiting', kind: 'awaiting' },
  past_deadline_unchecked: { glyph: '▢', label: 'Past deadline, not checked', short: 'past deadline, not checked', kind: 'past' },
};

export const VOID_REASON_LABEL = {
  ambiguous_criterion: 'the question could not be judged as worded',
  source_unavailable: 'the named source was unavailable',
  event_moot: 'the situation changed so the question no longer applied',
  duplicate: 'a duplicate of another question',
  criterion_met_at_issue: 'the criterion was already met when it was issued',
};

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
