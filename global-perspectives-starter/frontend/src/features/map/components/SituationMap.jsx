// SituationMap.jsx — shared map-console constants (marker radius by tier) plus a
// re-export of the land/frame geometry, kept here for import-path back-compat with the callers
// that already reference this file. The flat-mode SVG component this file used to default-export
// was replaced by RadarMap (M4) and SituationMap3D (globe); nothing imports it any more (verified
// F2.21, map-console review R1), so it was removed as dead code along with its now-unused local
// helpers (agoShort, STATE_WORD, TIER_WORD). `land`/`FRAME` themselves live in
// `lib/landGeometry.js` (F1.10) so consumers that only need geometry — e.g. the Desk's small
// following map on /account — never pull in this file's history.
export { land, FRAME } from '@/features/map/lib/landGeometry.js';

// Marker radius by tier (severity) — widened so severity reads (interim until S5's 2.5D columns).
// Exported so RadarMap (M4) draws the same-size markers instead of forking its own scale.
export const TIER_R = { low: 4, moderate: 6.5, elevated: 9, high: 13 };
