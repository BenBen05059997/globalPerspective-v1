// gdacsLevel — L1 (STORY_WEB_RETHINK_PLAN.md §8): a GDACS situation's alert level shown as a TEXT
// badge ("ORANGE ALERT"), never inferred from marker colour (marker hue stays = crisis type, per
// the legend rule). Two places carry the level:
//   - the situation detail's `evidence.gdacs_level` (structured, e.g. "Orange") — preferred;
//   - the list-level `what_changed` template string (e.g. "Alert raised Green→Orange · …", or
//     "GDACS Orange alert opened · …"), which is all the feed row / map callout have, since the
//     lightweight world-bundle entry doesn't carry `evidence` (see newsSituationTracker/index.js
///   `summarize()`).
// Never guesses a level that isn't spelled out in one of these two places (CLAUDE.md: no invented
// facts).
const KNOWN_LEVELS = new Set(['green', 'orange', 'red']);

function fromEvidence(evidence) {
  const lvl = evidence?.gdacs_level || evidence?.gdacsLevel;
  return typeof lvl === 'string' && lvl.trim() ? lvl.trim() : null;
}

function fromWhatChanged(whatChanged) {
  if (typeof whatChanged !== 'string' || !whatChanged) return null;
  // "Alert raised Green→Orange · …" / "Alert lowered Orange→Green" — the level after the arrow
  // is the current one.
  const arrow = whatChanged.match(/→\s*([A-Za-z]+)/);
  if (arrow) return arrow[1];
  // "GDACS Orange alert opened · …"
  const opened = whatChanged.match(/^GDACS\s+([A-Za-z]+)\s+alert/i);
  if (opened) return opened[1];
  return null;
}

/**
 * gdacsLevelBadge(situation, evidence) -> "ORANGE ALERT" | null
 * `situation` is the (lightweight or full) situation record; `evidence` is the optional detail
 * evidence object (from useSituationDetail). Returns null for a non-GDACS situation, or when no
 * level can be read from the data — never a guessed default.
 */
export function gdacsLevelBadge(situation, evidence = null) {
  if (!situation || situation.source !== 'gdacs') return null;
  const level = fromEvidence(evidence) || fromEvidence(situation.evidence) || fromWhatChanged(situation.what_changed);
  if (!level) return null;
  const lower = level.toLowerCase();
  if (!KNOWN_LEVELS.has(lower)) return null; // "Gone"/other — no active alert level to show
  return `${level.toUpperCase()} ALERT`;
}

export default gdacsLevelBadge;
