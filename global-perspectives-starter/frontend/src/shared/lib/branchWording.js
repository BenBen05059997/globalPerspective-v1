// branchWording: the one place that words a forecast branch's status (decisions 0037 §6, 0038 "Wording").
// A "no" is a claim about our own coverage, never about the world: "not reported by <due>".
// Dates are read from the ISO string, never through the local timezone.

export const VOID_REASON_WORDS = {
  ambiguous_criterion: 'the question was ambiguous',
  source_unavailable: 'the source was unavailable',
  event_moot: 'the premise no longer applies',
  duplicate: 'duplicate of another branch',
  criterion_met_at_issue: 'already true when drawn',
  issued_before_method: 'recorded before scoring began',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-20' or '2026-10-20T09:00:00Z' -> '20 Oct'; anything else -> ''. */
export function dayMonth(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '');
  const month = m ? MONTHS[Number(m[2]) - 1] : null;
  return month ? `${Number(m[3])} ${month}` : '';
}

const join = (head, day, sep = ' ') => (day ? `${head}${sep}${day}` : head);

/**
 * Status of one branch of the story view: { kind, text, quote }.
 * kind: open | happened | not_reported | void | legacy. quote is only set for a "yes" that carries one.
 */
export function branchStatus(branch) {
  const v = branch?.verdict;
  if (!v) {
    if (branch?.legacy) return { kind: 'legacy', text: 'recorded before scoring began', quote: null };
    return { kind: 'open', text: join('open', dayMonth(branch?.due), ' · due '), quote: null };
  }
  if (v.result === 'yes') {
    const ev = v.evidence && typeof v.evidence === 'object' ? v.evidence : null;
    const quote = typeof ev?.quote === 'string' && ev.quote.trim() ? ev.quote.trim() : null;
    return { kind: 'happened', text: join('happened', dayMonth(ev?.date) || dayMonth(v.at), ' · '), quote };
  }
  if (v.result === 'no') {
    return { kind: 'not_reported', text: join('not reported', dayMonth(branch.due) || dayMonth(v.at), ' by '), quote: null };
  }
  if (v.result === 'void') {
    const why = VOID_REASON_WORDS[v.voidReason];
    return { kind: 'void', text: why ? `could not be checked · ${why}` : 'could not be checked', quote: null };
  }
  return { kind: 'open', text: join('open', dayMonth(branch?.due), ' · due '), quote: null };
}
