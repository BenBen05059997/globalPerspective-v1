// trajectory — the one reading of a briefing's `trajectory` field (country intelligence, the daily
// brief's rising thread and country to watch). The backend writes one of "escalating" / "stable" /
// "de-escalating"; anything else reads as stable. Returns the DirectionArrow direction plus the
// word, or null when the record has no trajectory (render nothing, never a guessed arrow).
// Direction is shown as a glyph + word in neutral text, never a tier or status colour.
const TRAJECTORY = {
  escalating: { dir: 'up', label: 'Escalating' },
  stable: { dir: 'flat', label: 'Stable' },
  'de-escalating': { dir: 'down', label: 'De-escalating' },
};

export function trajectoryOf(value) {
  if (!value) return null;
  return TRAJECTORY[String(value).toLowerCase().trim()] || TRAJECTORY.stable;
}
