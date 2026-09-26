// landGeometry — the real-coastline land features + the console's ±60° crop frame, shared by
// every consumer that needs "the world outline" (RadarMap, SituationMap3D, SituationMap, and the
// Desk's small following map in deskMap.js). Split out in F1.10 (map-console review R1) because
// deskMap.js — loaded on /account — used to reach into SituationMap.jsx for these two constants,
// which dragged that file's `import * as d3 from 'd3'` (the whole library) and its unused default
// component into the /account bundle. This module only needs topojson-client to decode the
// bundled topology; no consumer of `land`/`FRAME` needs a d3 namespace import for that.
import * as topojson from 'topojson-client';
import topoData from '@/features/map/assets/countries-110m.json';

// Exported so every map view (RadarMap, SituationMap3D, deskMap) draws the same real coastlines
// with the same crop, instead of each re-deriving its own land/frame from the topojson bundle.
export const land = topojson.feature(topoData, topoData.objects.countries);
// Frame roughly ±60° latitude — drop Antarctica, which is ~15% of canvas for zero information.
export const FRAME = { type: 'Polygon', coordinates: [[[-180, -58], [180, -58], [180, 72], [-180, 72], [-180, -58]]] };
