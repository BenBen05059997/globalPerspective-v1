// briefingSlides.js — pure slide-deck builders for /briefings (S3), the same "map + horizontal
// slides" pattern as story mode (features/threads/lib/storyMode.js), built from what the real
// daily_brief / weekly_brief payloads actually contain. A slide is only produced when its data is
// present — never a placeholder/empty slide (CLAUDE.md).
import { iso3ForName } from '@/features/map/lib/situationLabels.js';
import { crisisHueForCategory, crisisTypeForCategory } from '@/shared/lib/crisisHue.js';

// Daily topStories carry a real `threadId` since 2026-09-30 (newsPostDevTo resolves it from the
// archive entry the story was written from; null when there is no confident match, and older
// briefs have none). countryToWatch still carries only a country name. A link is only ever built
// to a route that really exists: /weekly/thread/:id (ThreadPage) when a threadId is present, and
// /weekly/country/:countryName (CountryPage) for countries.
import { threadPath } from '@/shared/lib/threadPath.js';

/** storyLinkPath — the story page for a top story, or null when it has no real threadId. */
export function storyLinkPath(story) {
  const id = story && typeof story.threadId === 'string' ? story.threadId : '';
  return /^thread-/.test(id) ? threadPath(id) : null;
}

export function countryLinkPath(countryName) {
  if (!countryName) return null;
  return `/weekly/country/${encodeURIComponent(countryName)}`;
}

export function buildDailySlides(brief) {
  if (!brief) return [];
  const slides = [{ key: 'day', kind: 'day', label: 'THE DAY' }];
  (brief.topStories || []).forEach((story, i) => {
    if (!story?.title) return;
    slides.push({ key: `story-${i}`, kind: 'story', label: `STORY ${i + 1}`, story, index: i });
  });
  if (brief.countryToWatch?.countryName) {
    slides.push({ key: 'watch', kind: 'watch', label: 'COUNTRY TO WATCH', countryToWatch: brief.countryToWatch, risingThread: brief.risingThread });
  }
  return slides;
}

export function buildWeeklySlides(brief) {
  if (!brief) return [];
  const slides = [{ key: 'week', kind: 'week', label: 'THE WEEK' }];
  (brief.signals || []).forEach((signal, i) => {
    if (!signal?.fact && !signal?.lede) return;
    slides.push({ key: `signal-${i}`, kind: 'signal', label: `SIGNAL ${i + 1}`, signal, index: i });
  });
  if ((brief.watch || []).length > 0) {
    slides.push({ key: 'next', kind: 'next', label: 'NEXT WEEK', watch: brief.watch });
  }
  return slides;
}

// regionsOf — first region string a slide's data carries, for map-focus + shading. Daily stories
// use `regions: string[]`; weekly signals use `region: "A · B · C"`.
function firstRegion(item) {
  if (!item) return null;
  if (Array.isArray(item.regions) && item.regions.length) return item.regions[0];
  if (typeof item.region === 'string' && item.region.trim()) return item.region.split('·')[0].trim();
  return null;
}

/** mapFocusForDailySlide — the iso3 the map should fly to for a given daily slide. */
export function mapFocusForDailySlide(slide) {
  if (!slide) return null;
  if (slide.kind === 'story') return iso3ForName(firstRegion(slide.story));
  if (slide.kind === 'watch') return iso3ForName(slide.countryToWatch?.countryName);
  return null;
}

export function mapFocusForWeeklySlide(slide) {
  if (!slide) return null;
  if (slide.kind === 'signal') return iso3ForName(firstRegion(slide.signal));
  return null;
}

// shadingForDailySlides — one wash per top-story/watch country (never a made-up pin), reused by
// the console map exactly like story mode's chapter shading.
export function shadingForDailySlides(brief) {
  const out = [];
  const seen = new Set();
  const push = (name, category, count) => {
    const iso3 = iso3ForName(name);
    if (!iso3 || seen.has(iso3)) return;
    seen.add(iso3);
    out.push({
      iso3, count: count || 1, top: { title: name, category },
      crisisType: crisisTypeForCategory(category), hue: crisisHueForCategory(category),
    });
  };
  for (const s of (brief?.topStories || [])) push(firstRegion(s), s.category, s.sourceCount);
  if (brief?.countryToWatch?.countryName) push(brief.countryToWatch.countryName, 'conflict', 1);
  return out;
}

export function shadingForWeeklySlides(brief) {
  const out = [];
  const seen = new Set();
  for (const s of (brief?.signals || [])) {
    const name = firstRegion(s);
    const iso3 = iso3ForName(name);
    if (!iso3 || seen.has(iso3)) continue;
    seen.add(iso3);
    // Weekly signals carry only kind threat|development, no crisis type: never invent one
    // (a disaster "threat" is not a conflict). Neutral hue, no category.
    const category = undefined;
    out.push({
      iso3, count: 1, top: { title: s.lede, category },
      crisisType: crisisTypeForCategory(category), hue: crisisHueForCategory(category),
    });
  }
  return out;
}

// peekInput — shapes a top-story / signal into the plain-object shape shared/lib/peekData.js
// expects ({ title, category, regions, sources }), so StoryPeek reads the same way it does
// everywhere else on the site.
export function peekInputForStory(story) {
  if (!story) return null;
  return { title: story.title, category: story.category, regions: story.regions, sources: story.sourceCount };
}
export function peekInputForSignal(signal) {
  if (!signal) return null;
  return {
    title: signal.lede, category: undefined,
    regions: firstRegion(signal) ? [firstRegion(signal)] : undefined, sources: signal.sources,
  };
}
