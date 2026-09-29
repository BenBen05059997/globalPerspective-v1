// countryRiskLayer — pure helpers for the R4b COUNTRY RISK map layer (REDESIGN_MASTER_PLAN.md
// §3.1 design system + §3.5 country states, project_risk_scoring: tiers 25/50/75, worst axis
// leads, never an average). Kept separate from lib/legend.js (the SITUATIONS layer's tokens)
// because the two layers draw different things and must never blend their rules:
//
//   hue        = the crisis type of the country's WORST axis (never a red/amber/green severity
//                scale — AXIS_HUE, the same hue family the situations layer already uses)
//   weight     = outline weight by tier, HIGH strongest (never colour-coded severity)
//   brightness = freshness of the *briefing* (generatedAt), not of any event:
//                <14d full weight · 14-30d desaturated + "older" · >30d not drawn (counted instead)
//   never briefed = no entry at all here — the caller never tints an un-briefed country.
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { deriveHeadline, tierLabel as tierWord } from '@/shared/lib/riskTiers.js';
import { freshnessState, COUNTRY_OLDER_AFTER_DAYS } from '@/shared/lib/freshness.js';
import { iso3ForName, iso3Name, TIER_LABEL } from '@/features/map/lib/situationLabels.js';

// Backend cap (newsSensitiveData's country_intelligence action silently slices to 15 — see
// CLAUDE.md's "batch ≤15 names per call"): any request bigger than this loses the tail silently,
// so every caller MUST chunk through this helper rather than call the proxy directly.
export const MAX_NAMES_PER_CALL = 15;
export const MAX_CONCURRENT_BATCHES = 3;

/** chunkNames(names, size) -> [[...], [...]] — never yields a chunk bigger than `size`. */
export function chunkNames(names = [], size = MAX_NAMES_PER_CALL) {
  const out = [];
  for (let i = 0; i < names.length; i += size) out.push(names.slice(i, i + size));
  return out;
}

// Outline weight by tier (px) — a double outline is reserved for HIGH, matching the situations
// layer's "double ring = HIGH only" rule (lib/legend.js tierSize) so the two layers agree on what
// "HIGH" looks like even though one draws points and the other draws polygons.
const TIER_OUTLINE = {
  low: { width: 1, double: false },
  moderate: { width: 1.5, double: false },
  elevated: { width: 2.5, double: false },
  high: { width: 3, double: true },
};
export function outlineForTier(tier) {
  return TIER_OUTLINE[tier] || TIER_OUTLINE.low;
}

/**
 * countryRiskEntry(name, intel, now) -> a drawable record, or null when the country has never
 * been briefed (no intel record) or the record carries no usable headline (score/tier). Age is
 * read from the briefing's own `generatedAt` — the moment the country was assessed, not the
 * moment any one event happened.
 */
export function countryRiskEntry(name, intel, now = Date.now()) {
  if (!intel || typeof intel !== 'object') return null;
  const headline = deriveHeadline(intel);
  if (headline.score == null || headline.tier == null) return null;
  const iso3 = iso3ForName(name);
  if (!iso3) return null;

  const generatedAt = intel.generatedAt || null;
  const ageDays = generatedAt ? (now - new Date(generatedAt).getTime()) / 86400000 : null;
  const fresh = ageDays != null && Number.isFinite(ageDays) ? freshnessState(ageDays, COUNTRY_OLDER_AFTER_DAYS) : 'plain';
  // The briefing rule (§3.5) collapses live/plain into one "full" band; only 'older' and 'hidden'
  // change how it's drawn.
  if (fresh === 'hidden') return { iso3, name, hidden: true, generatedAt, ageDays };

  const leadAxis = headline.leadAxis;
  const hue = AXIS_HUE[leadAxis] || '#9aa4b2';
  const outline = outlineForTier(headline.tier);

  return {
    iso3,
    name,
    hidden: false,
    older: fresh === 'older',
    score: headline.score,
    tier: headline.tier,
    tierLabel: TIER_LABEL[headline.tier] || tierWord(headline.tier),
    leadAxis,
    leadLabel: headline.leadLabel,
    hue,
    outlineWidth: outline.width,
    doubleOutline: outline.double,
    generatedAt,
    ageDays,
  };
}

/**
 * buildCountryRiskLayer(intelByName, now) -> { drawn, hiddenOld, hiddenOldDates }
 *   drawn          — ranked list (worst tier first, then score desc, then name) of entries to
 *                    paint on the map and show in the list twin.
 *   hiddenOld      — count of briefed countries older than 30 days, not drawn (never silently
 *                    dropped — the caller shows this count).
 *   hiddenOldDates — their generatedAt values, oldest first (for a "since <date>" line if wanted).
 */
const TIER_RANK = { high: 0, elevated: 1, moderate: 2, low: 3 };
export function buildCountryRiskLayer(intelByName = {}, now = Date.now()) {
  const drawn = [];
  const hiddenOldDates = [];
  for (const [name, intel] of Object.entries(intelByName || {})) {
    const entry = countryRiskEntry(name, intel, now);
    if (!entry) continue;
    if (entry.hidden) { if (entry.generatedAt) hiddenOldDates.push(entry.generatedAt); continue; }
    drawn.push(entry);
  }
  drawn.sort((a, b) => {
    const t = (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
    if (t) return t;
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
  hiddenOldDates.sort();
  return { drawn, hiddenOld: hiddenOldDates.length, hiddenOldDates };
}

/**
 * riskPeekData(entry) -> the StoryPeek-shaped fields for a hovered/focused country in COUNTRY RISK
 * mode: name · RISK <score> <tier> · leading axis · "briefed <date>" (+ "older" when 14-30d).
 * Mirrors shared/lib/peekData.js's contract (headline/hint required, everything else optional) so
 * the same <StoryPeek> component renders both without knowing which mode it's in.
 */
export function riskPeekData(entry) {
  if (!entry) return null;
  const dateLabel = entry.generatedAt ? new Date(entry.generatedAt) : null;
  const dateOk = dateLabel && !Number.isNaN(dateLabel.getTime());
  const out = {
    headline: entry.name,
    category: `RISK ${entry.score} · ${entry.tierLabel}`,
    hue: entry.hue,
    primaryCountry: entry.leadLabel,
    hint: 'Click to open the country page',
  };
  if (dateOk) {
    const d = dateLabel.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    out.updatedLabel = `briefed ${d}${entry.older ? ' · older' : ''}`;
  }
  return out;
}

// Re-exported so callers/tests don't need a second import for the country name a map click
// resolves to (SituationHome navigates to /weekly/country/:name, keyed by name not ISO3).
export { iso3Name };
