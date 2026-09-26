// deskMap — the small "Following" map on the Desk (A4). Reuses the real coastlines the
// console's SituationMap already loads (topojson `land` + the ±60° `FRAME` crop) instead of
// re-deriving a fake landmass, so the tiny map is honest geography, not decoration.
//
// Hue is fixed (cyan, see Account desk styling) — a followed country's outline never encodes
// its risk score; risk shows as a number in the chip text instead (per CLAUDE.md: hue = crisis
// type only).
import * as d3 from 'd3';
import { land, FRAME } from '@/features/map/components/SituationMap';

export const WIDTH = 360;
export const HEIGHT = 130;

const projection = d3.geoEqualEarth().fitSize([WIDTH, HEIGHT], FRAME);
const path = d3.geoPath(projection);

// One combined path for every land feature — cheap to render, no per-country styling needed
// since the world outline is just context for the followed-country dots.
export const WORLD_PATH = path(land) || '';

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

// A handful of common name mismatches between our country names (as followed / shown
// elsewhere in the app) and the 110m bundle's `properties.name`. Best-effort only — a country
// not in this bundle or not listed here simply gets no outline; the chip still renders (see
// DeskFollowing), so a mismatch never hides the country entirely.
const NAME_ALIASES = {
  'united states': 'united states of america',
  'democratic republic of the congo': 'dem. rep. congo',
  'czech republic': 'czechia',
  'bosnia and herzegovina': 'bosnia and herz.',
  'dominican republic': 'dominican rep.',
  "cote d'ivoire": "côte d'ivoire",
  'ivory coast': "côte d'ivoire",
};

let _index = null;
function nameIndex() {
  if (_index) return _index;
  _index = new Map();
  for (const f of land.features) {
    const n = normalize(f.properties?.name);
    if (n) _index.set(n, f);
  }
  return _index;
}

export function matchLandFeature(countryName) {
  const idx = nameIndex();
  const n = normalize(countryName);
  return idx.get(n) || idx.get(NAME_ALIASES[n]) || null;
}

// centroidForCountry — [x, y] in the map's own viewBox for a followed country, or null when
// the name doesn't match any feature in the bundle (see NAME_ALIASES above).
export function centroidForCountry(countryName) {
  const feature = matchLandFeature(countryName);
  if (!feature) return null;
  const c = path.centroid(feature);
  return Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]) ? c : null;
}
