// storyShading — pure helper for H2 (REDESIGN_MASTER_PLAN.md §3.2): a story with no exact place
// shades its country instead of getting a made-up pin. Used by both map modes (globe GeoJsonLayer,
// radar SVG fills) so they never disagree about which countries are shaded or why.
//
// Rules:
//   - a story whose threadId matches an open world situation is skipped — it already has a real
//     pin, so shading it too would double-claim the same event;
//   - a story with no resolvable ISO3 (a broad region like "Middle East", not an exact place) is
//     skipped — it appears only in the list, never as a made-up country wash (H2);
//   - stories sharing a country are grouped: the group's count is drawn as a small badge, and its
//     hue/top story favour a real crisis category over 'neutral' when the group is mixed.
import { crisisTypeForCategory, crisisHueForCategory } from '@/features/map/lib/crisisHue.js';

function topicIso3(topic) {
  if (Array.isArray(topic?.iso3) && topic.iso3[0]) return topic.iso3[0];
  return null;
}

/**
 * storiesForShading(topics, situations) -> [{ iso3, count, top, stories, crisisType, hue }]
 * `situations` is the world bundle's situation list (each may carry a `threadId`); pass `[]` or
 * omit if unavailable — nothing will be excluded on that basis then.
 */
export function storiesForShading(topics = [], situations = []) {
  const pinnedThreadIds = new Set((situations || []).map((s) => s?.threadId).filter(Boolean));
  const byCountry = new Map();

  for (const topic of topics || []) {
    if (!topic || !topic.title) continue;
    if (topic.threadId && pinnedThreadIds.has(topic.threadId)) continue; // already has a pin
    const iso3 = topicIso3(topic);
    if (!iso3) continue; // broad region — list only, never a made-up wash

    const entry = byCountry.get(iso3) || { iso3, count: 0, stories: [] };
    entry.count += 1;
    entry.stories.push(topic);
    byCountry.set(iso3, entry);
  }

  return [...byCountry.values()].map((entry) => {
    // Prefer a story with a real crisis category (not neutral) to represent the group's hue.
    const withCrisis = entry.stories.find((t) => crisisTypeForCategory(t.category) !== 'neutral');
    const top = withCrisis || entry.stories[0];
    return {
      iso3: entry.iso3,
      count: entry.count,
      stories: entry.stories,
      top,
      crisisType: crisisTypeForCategory(top.category),
      hue: crisisHueForCategory(top.category),
    };
  });
}

export default storiesForShading;
