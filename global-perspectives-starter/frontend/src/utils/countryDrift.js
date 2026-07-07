// Deterministic "what changed" for a country's read, computed from the daily HISTORY#
// snapshots we already log (risk level/score/trajectory/headline). No LLM, no fabrication.
//
// Gated on the CONCLUSION (risk level / score / trajectory / a moved DIMENSION axis)
// — NOT the headline: the 2026-06-30 backtest showed ~37% of daily updates are cosmetic
// headline rewording (noise) vs ~18% genuine risk-level/score moves (signal). So we find
// the most recent snapshot whose *conclusion* differs from the current read, and report it.
//
// scoring-model-v2: snapshots now carry a `dimensions` vector, so we also detect which
// AXIS moved (economic/conflict/…). This catches a real per-axis swing the blended-max
// scalar hides — the same masking the D1 newsDriftCorrector fix addresses server-side —
// and names the driving dimension in the band. Mirrors that Lambda's axisMoves logic.
import { AXES, AXIS_LABELS } from './riskTiers';

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'and', 'to', 'as', 'at', 'for', 'amid', 'with']);
function tokens(s) {
  return new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
}

const SCORE_MOVE = 8;        // |Δscore| ≥ 8 = material (backtest: ~18% of day-pairs)
const TRAJ_SIM = 0.6;        // trajectory jaccard below this = materially different
const HEADLINE_SIM = 0.4;    // headline jaccard below this = genuinely new framing

// One axis's numeric score from a snapshot's dimensions vector, or null (sparsity-safe:
// {score:null}/absent axis = "no signal", NEVER 0).
function axisScoreOf(dims, axis) {
  const v = dims && dims[axis];
  if (v == null) return null;
  const n = Number(typeof v === 'object' ? v.score : v);
  return Number.isFinite(n) ? n : null;
}

// Per-axis moves ≥ SCORE_MOVE between two snapshots. Needs BOTH sides scored on an axis
// to compare — a null either side is skipped, so legacy scalar-only snapshots never
// produce a false axis move. Worst-first by |delta|.
function axisMoves(prior, current) {
  const out = [];
  for (const axis of AXES) {
    const from = axisScoreOf(prior && prior.dimensions, axis);
    const to = axisScoreOf(current && current.dimensions, axis);
    if (from == null || to == null) continue;
    const delta = to - from;
    if (Math.abs(delta) >= SCORE_MOVE) out.push({ axis, from, to, delta });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function conclusionMoved(prior, current) {
  const levelChg = prior.riskLevel && current.riskLevel && prior.riskLevel !== current.riskLevel;
  const ps = Number(prior.riskScore); const cs = Number(current.riskScore);
  const scoreChg = Number.isFinite(ps) && Number.isFinite(cs) && Math.abs(cs - ps) >= SCORE_MOVE;
  // Trajectory counts as moved only when BOTH reads have real words and they diverge —
  // two empty/near-empty token sets must NOT read as a change (jaccard(∅,∅)=0).
  const ta = tokens(prior.trajectory); const tb = tokens(current.trajectory);
  const trajChg = ta.size > 0 && tb.size > 0 && jaccard(ta, tb) < TRAJ_SIM;
  // A dimension axis moving is itself a conclusion move — even if the blended scalar
  // stayed flat (the masking case). Gated at the same |Δ|≥8 materiality bar.
  const moves = axisMoves(prior, current);
  const axisChg = moves.length > 0;
  return { levelChg, scoreChg, trajChg, axisChg, axisMoves: moves, any: !!(levelChg || scoreChg || trajChg || axisChg) };
}

// Returns null (no prior / no material change → honest-empty) or a drift descriptor.
export function computeCountryDrift(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')));
  const current = sorted[sorted.length - 1];

  // Walk back to the most recent snapshot whose CONCLUSION differs from today's read.
  let prior = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (conclusionMoved(sorted[i], current).any) { prior = sorted[i]; break; }
  }
  if (!prior) return null;

  const moved = conclusionMoved(prior, current);
  const dims = [];
  if (moved.levelChg) dims.push({ k: 'Risk level', from: prior.riskLevel, to: current.riskLevel });
  const delta = Number(current.riskScore) - Number(prior.riskScore);
  if (moved.scoreChg) dims.push({ k: 'Risk score', from: Number(prior.riskScore), to: Number(current.riskScore), delta });
  // Which DIMENSION drove the move (economic/conflict/…) — the v2 legibility win, worst-first.
  for (const m of moved.axisMoves) {
    dims.push({ k: AXIS_LABELS[m.axis] || m.axis, from: m.from, to: m.to, delta: m.delta, axis: true });
  }
  if (moved.trajChg) dims.push({ k: 'Trajectory', shifted: true });

  const headlineChanged = jaccard(tokens(prior.headline), tokens(current.headline)) < HEADLINE_SIM;
  const daysSince = daysBetween(prior.dateKey, current.dateKey);
  return { since: prior.dateKey, asOf: current.dateKey, daysSince, prior, current, dims, axisMoves: moved.axisMoves, headlineChanged, scoreDelta: delta };
}

function daysBetween(a, b) {
  const pa = parseDay(a); const pb = parseDay(b);
  if (pa == null || pb == null) return null;
  return Math.round((pb - pa) / 86400000);
}
function parseDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}
