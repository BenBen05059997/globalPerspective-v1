// forecastOutcome — the one mapping from a forecast trigger's verdict to the reader's words (decision 0038:
// open / happened / not reported / could not be checked / awaiting check). ThreadForecast (Read in full) and the
// WATCH slide both use it, so the two never print different words for the same outcome.

import { hasOwnProbability } from '@/shared/lib/questionChips.js';

const utcToday = () => new Date().toISOString().slice(0, 10);

/** 'fired' | 'notfired' | 'unclear' | 'awaiting' | 'pending' for a trigger-like { state, verdict, deadline }. */
export function triggerState(t, today = utcToday()) {
  // per-question verdicts come from `state`; legacy triggers from `verdict`
  if (t.state === 'yes') return 'fired';
  if (t.state === 'no') return 'notfired';
  if (t.state === 'void') return 'unclear';
  if (t.state === 'past_deadline_unchecked') return 'awaiting';
  if (t.verdict === 'fired') return 'fired';
  if (t.verdict === 'not_fired') return 'notfired';
  if (t.verdict === 'unclear') return 'unclear';
  if (t.deadline && t.deadline < today) return 'awaiting'; // deadline passed, not yet resolved
  return 'pending';
}

/** The words for each state; an open outcome has none (its due date says it). */
export const OUTCOME_TAG = {
  fired: 'happened',
  notfired: 'not reported',
  unclear: 'could not be checked',
  awaiting: 'awaiting check',
  pending: null,
};

/** The ONE forecast line of a story card (story page top): the open question due soonest that has a probability of its own
 *  (a tie goes to the higher chance) -> { pct, text, by } ("22% that <outcome>, by Dec 20"), or null. Reads the stored question
 *  forecast the page already holds (`snapshot`, the shape of useThreadForecast); a question already settled or past its date is
 *  not a forecast any more (its outcome shows in the forecast board, decision 0038). */
export function forecastLine(snapshot, today) {
  const open = (snapshot?.scenarios || []).flatMap((s) => s.triggers || [])
    .filter((t) => hasOwnProbability(t) && t.deadline && typeof t.text === 'string' && t.text.trim() && !/^will\s/i.test(t.text.trim()) && triggerState(t, today) === 'pending')
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)) || b.p - a.p);
  const t = open[0];
  return t ? { pct: `${t.p}%`, text: t.text.trim().replace(/[.?]$/, ''), by: t.deadline } : null;
}

/** The words for a trigger-like object, or null while it is open. */
export function outcomeTag(t, today) {
  return OUTCOME_TAG[triggerState(t, today)];
}
