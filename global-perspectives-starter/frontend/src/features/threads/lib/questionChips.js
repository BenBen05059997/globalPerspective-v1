// questionChips — the own-probability chip for a forecast question (WATCH slide, the story page's
// forecast board, the country card, briefings). Input is a trigger as returned by
// `prediction_snapshot` (or a buildDeadlines() item carrying the same fields). A trigger without
// `question: true` has NO probability of its own: it gets no chip (the scenario probability is
// never shown as its own), and the surface shows one honest note instead.
import { STATE_META } from '@/features/track-record/lib/questionStates.js';

const SCORING_TEXT = {
  awaiting_draw: 'not drawn yet (this week’s sample is drawn after the week closes)',
  not_sampled: 'not in a scored sample',
  warm_up: 'issued before scoring began; not scored',
  not_eligible: 'not sampled (lead time outside 7–84 days); not scored',
  sampled: 'in a scored sample',
};

export function hasOwnProbability(t) {
  return Boolean(t && t.question === true && typeof t.p === 'number');
}

/** @returns {{pct:string, source:string|null, text:string, kind:string}|null} */
export function chipFor(t) {
  if (!hasOwnProbability(t)) return null;
  const meta = t.state ? STATE_META[t.state] : null;
  return {
    pct: `${t.p}%`,
    source: t.source || null,
    text: meta ? meta.short : (SCORING_TEXT[t.scoring] || 'not scored'),
    kind: meta ? meta.kind : 'unscored',
  };
}

/** One honest line when some of the shown triggers have no probability of their own; else null. */
export function legacyNote(triggers) {
  const list = Array.isArray(triggers) ? triggers : [];
  if (!list.length || list.every(hasOwnProbability)) return null;
  return 'Items without a % have no probability of their own (forecast made before per-question probabilities began), so they are not scored.';
}
