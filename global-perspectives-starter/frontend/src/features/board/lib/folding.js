// Folding rules of the board (design: "Folding rules"). The numbers live here once; the panels and any
// fold in the story tree read them. Pure functions, no React.
export const FOLD_AFTER_DAYS = 28; // a node older than 4 weeks folds into one node with a count
export const DEAD_BRANCH_P = 20;   // a branch under 20% starts folded
export const ARRIVALS_SHOWN = 5;   // the arrivals strip shows at most this many, strongest first
import { branchPercent } from '@/features/board/lib/branchView.js';
const DAY = 86400000;
const STRENGTH_RANK = { strong: 3, medium: 2, weak: 1 };

/** True when the node's date is more than FOLD_AFTER_DAYS before `now`. No date, no fold. */
export function isOldNode(date, now = Date.now()) {
  const t = Date.parse(date);
  return Number.isFinite(t) && now - t > FOLD_AFTER_DAYS * DAY;
}

/** A branch with a stated probability under DEAD_BRANCH_P percent. No probability, not dead. */
export function isDeadBranch(branch) {
  const p = branchPercent(branch);
  return p != null && p < DEAD_BRANCH_P;
}

/** The strongest arrivals first (ties keep their order), at most ARRIVALS_SHOWN; `hidden` is the count left out. */
export function strongestArrivals(arrivals = []) {
  const ranked = arrivals.map((a, i) => ({ a, i }))
    .sort((x, y) => (STRENGTH_RANK[y.a.strength] || 0) - (STRENGTH_RANK[x.a.strength] || 0) || x.i - y.i)
    .map((r) => r.a);
  return { shown: ranked.slice(0, ARRIVALS_SHOWN), hidden: Math.max(0, ranked.length - ARRIVALS_SHOWN) };
}
