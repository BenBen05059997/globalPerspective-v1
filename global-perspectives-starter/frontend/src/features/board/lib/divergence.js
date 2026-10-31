// divergence — where the reader's board differs from ours. Pure reads of one board plus the story views.
// Everything here is the reader's own data; nothing is sent anywhere except through update_board.
import { branchLine, branchScenario, branchPercent } from '@/features/board/lib/branchView.js';

/** Strings of ours the reader cut: [{a, b, cutAt}]. */
export function cutByYou(board) {
  return board.strings.filter((s) => s.owner === 'ours' && s.cutAt).map((s) => ({ a: s.a, b: s.b, cutAt: s.cutAt }));
}

/** Lines only the reader wrote (their own strings that carry a line): [{a, b, line}]. */
export function writtenByYou(board) {
  return board.strings.filter((s) => s.owner === 'yours' && !s.cutAt && s.line).map((s) => ({ a: s.a, b: s.b, line: s.line }));
}

/** Open branches with our stated probability, per fork of the board's pinned stories:
 *  [{forkId, pinId, branches: [{branchId, text, ours, yours|null}]}]; ours and yours are whole percents. */
export function forkWeights(board, stories) {
  const out = [];
  for (const pin of board.pins) {
    const story = pin.kind === 'thread' ? stories?.[pin.refId] : null;
    for (const f of story?.forks || []) {
      const branches = (f.branches || [])
        .filter((b) => branchPercent(b) != null && !b.verdict)
        .map((b) => {
          const w = board.weights?.[f.forkId]?.[b.branchId];
          return { branchId: b.branchId, text: branchScenario(b) || branchLine(b), line: branchLine(b), ours: branchPercent(b), yours: w == null ? null : Math.round(w * 100) };
        });
      if (branches.length) out.push({ forkId: f.forkId, pinId: pin.pinId, branches });
    }
  }
  return out;
}

/** The largest gap, in percentage points, between the reader's weight and ours on one fork (0 when none is set). */
export function weightGap(fork) {
  return Math.max(0, ...fork.branches.filter((b) => b.yours != null).map((b) => Math.abs(b.yours - b.ours)));
}

/** Set (or, with null, clear) the reader's weight for one branch; percent in, stored as 0..1. */
export function setWeight(board, forkId, branchId, percent) {
  const weights = { ...(board.weights || {}) };
  const fork = { ...(weights[forkId] || {}) };
  if (percent == null || Number.isNaN(percent)) delete fork[branchId];
  else fork[branchId] = Math.min(100, Math.max(0, Math.round(percent))) / 100;
  if (Object.keys(fork).length) weights[forkId] = fork; else delete weights[forkId];
  return { ...board, weights };
}
