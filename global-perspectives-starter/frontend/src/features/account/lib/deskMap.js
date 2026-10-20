// deskMap — the small "Following" map on the Desk (A4). Reuses the real coastlines the
// console's SituationMap already loads (topojson `land` + the ±60° `FRAME` crop) instead of
// re-deriving a fake landmass, so the tiny map is honest geography, not decoration.
//
// Hue is fixed (cyan, see Account desk styling) — a followed country's outline never encodes
// its risk score; risk shows as a number in the chip text instead (per CLAUDE.md: hue = crisis
// type only).
// F1.10 (map-console review R1): this file used to pull `land`/`FRAME` from SituationMap.jsx and
// the whole `d3` namespace just for two functions (geoEqualEarth, geoPath). Both dragged the
// ~60KB-gz map chunk into /account, which never uses the globe/radar console. d3-geo is already a
// transitive dependency of `d3` (SituationMap3D.jsx imports from it directly too), so importing
// only the two pieces this file actually needs keeps /account's bundle out of the map chunk.
import { geoEqualEarth, geoPath } from 'd3-geo';
import { land, FRAME } from '@/shared/map/landGeometry.js';
import { ISO3_TO_NUM } from '@/shared/map/countryGeo.js';
import { resolveCountry } from '@/shared/lib/countries.js';

export const WIDTH = 360;
export const HEIGHT = 130;

const projection = geoEqualEarth().fitSize([WIDTH, HEIGHT], FRAME);
const path = geoPath(projection);

// One combined path for every land feature — cheap to render, no per-country styling needed
// since the world outline is just context for the followed-country dots.
export const WORLD_PATH = path(land) || '';

// Followed country name -> its land feature, through the one country table: resolveCountry gives
// the ISO3 (any alias works: "United States", "Ivory Coast", "Czech Republic"). The 110m bundle is
// indexed by ISO3 from countryGeo's ISO3_TO_NUM, plus a by-name resolveCountry fallback for the
// ~40 bundle countries ISO3_TO_NUM does not list yet (Burundi, Estonia, Greenland ...). A country
// the bundle lacks gets no outline; the chip still renders (see DeskFollowing).
let _byIso3 = null;
function featureByIso3() {
  if (_byIso3) return _byIso3;
  const numToIso3 = new Map(Object.entries(ISO3_TO_NUM).map(([iso3, num]) => [num, iso3]));
  _byIso3 = new Map();
  for (const f of land.features) {
    const iso3 = numToIso3.get(String(f.id)) || resolveCountry(f.properties?.name)?.iso3;
    if (iso3 && !_byIso3.has(iso3)) _byIso3.set(iso3, f);
  }
  return _byIso3;
}

export function matchLandFeature(countryName) {
  const iso3 = resolveCountry(countryName)?.iso3;
  return (iso3 && featureByIso3().get(iso3)) || null;
}

// centroidForCountry — [x, y] in the map's own viewBox for a followed country, or null when
// the country has no feature in the bundle (see matchLandFeature).
export function centroidForCountry(countryName) {
  const feature = matchLandFeature(countryName);
  if (!feature) return null;
  const c = path.centroid(feature);
  return Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]) ? c : null;
}
