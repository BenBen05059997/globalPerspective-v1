// storyLinkArcs — story-to-story lines on the maps (STORY_WEB_RETHINK_PLAN S7 / S8).
// Only STRONG and MEDIUM judged links are drawn (weak stay list-only), never a link older than 30
// days. The line runs from the selected story's main country to the linked story's most-mentioned
// country OTHER than the focal one; a linked story with no real country gets NO line (a broad
// region is never a point). Both ends are "approx." places, said in the Key. Pure.
import { iso3ForName } from '@/features/map/lib/situationLabels.js';

const DRAWN = new Set(['strong', 'medium']);
const RANK = { strong: 2, medium: 1 };

const iso3OfPlaces = (places, exclude) => {
  for (const p of places || []) {
    const iso3 = iso3ForName(p.name);
    if (iso3 && iso3 !== exclude) return iso3;
  }
  return null;
};

/**
 * @param {{ threadId:string, links:Array<{targetThreadId?:string,sourceThreadId?:string,confidence:string,freshness:string}>,
 *           threads:Object, focalIso3?:string|null }} a
 *   links: the story's fedInto + fedFrom rows (webIndexLinks.deriveFromIndex)
 *   threads: index.threads (per-story title / places)
 * @returns {Array<{fromIso3:string,toIso3:string,confidence:'strong'|'medium',otherThreadId:string,title:string|null}>}
 */
export function buildLinkArcs({ threadId, links = [], threads = {}, focalIso3 = null }) {
  const focal = focalIso3 || iso3OfPlaces(threads?.[threadId]?.places, null);
  if (!focal) return [];
  const best = new Map();
  for (const l of links) {
    if (!DRAWN.has(l.confidence) || l.freshness === 'hidden') continue;
    const other = l.targetThreadId || l.sourceThreadId;
    if (!other || other === threadId) continue;
    const to = iso3OfPlaces(threads?.[other]?.places, focal);
    if (!to) continue;
    const cur = best.get(other);
    if (!cur || RANK[l.confidence] > RANK[cur.confidence]) {
      best.set(other, { fromIso3: focal, toIso3: to, confidence: l.confidence, otherThreadId: other, title: threads?.[other]?.title || null });
    }
  }
  return [...best.values()].sort((a, b) => RANK[b.confidence] - RANK[a.confidence]);
}

// Dash pattern per confidence (the Key says: long dashes = strong, short dashes = medium).
export const DASH = { strong: { on: 6, off: 3, width: 2.2 }, medium: { on: 2, off: 3, width: 1.6 } };

/**
 * Dashed great-circle-ish path between two [lon, lat] points as many short 3-D segments
 * (deck.gl's ArcLayer cannot dash without the extensions package, which we do not add).
 * Lifted by a sine bump so the line reads as an arc on the globe.
 */
export function dashedArcPaths(from, to, confidence, { steps = 48, lift = 220000 } = {}) {
  const pattern = DASH[confidence] || DASH.medium;
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, Math.sin(Math.PI * t) * lift * Math.min(1, dist / 40)]);
  }
  const paths = [];
  const cycle = pattern.on + pattern.off;
  for (let i = 0; i < steps; i++) {
    if ((i % cycle) < pattern.on) paths.push([pts[i], pts[i + 1]]);
  }
  return paths.map((path) => ({ path, confidence }));
}
