// briefingSlides.js — pure slide-deck builders for /briefings (S3), the same "map + horizontal
// slides" pattern as story mode (features/threads/lib/storyMode.js), built from what the real
// daily_brief / weekly_brief payloads actually contain. A slide is only produced when its data is
// present — never a placeholder/empty slide (CLAUDE.md).
import { parentCountry } from '@/shared/lib/countries.js';
import { crisisHueForCategory, crisisTypeForCategory } from '@/shared/lib/crisisHue.js';

// Daily topStories carry a real `threadId` since 2026-09-30 (newsPostDevTo resolves it from the
// archive entry the story was written from; null when there is no confident match, and older
// briefs have none); the read API adds `iso3[]` to top stories, the country to watch and weekly
// signals. Addresses come from shared/lib/links.js; this file only says which ids are real.

/** threadIdOf — a top story's / signal's / rising thread's real thread id, or null (no confident match,
 *  an old brief, or a title in the id field). Only a real id is ever linked. */
export function threadIdOf(item) {
  const id = item && typeof item.threadId === 'string' ? item.threadId : '';
  return /^thread-/.test(id) ? id : null;
}

/** placeNames — the place names an item carries: daily `regions: string[]`, weekly `region: "A · B"`. */
export function placeNames(item) {
  if (!item) return [];
  if (Array.isArray(item.regions)) return item.regions.filter(Boolean);
  if (typeof item.region === 'string') return item.region.split('·').map((r) => r.trim()).filter(Boolean);
  return [];
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

// firstCountry — the first country an item names, for map focus + shading: its `iso3[]` when the read
// API sent one, else its first place name that is (or lies inside) a country. A region is never a point.
function firstIso3(item) {
  if (Array.isArray(item?.iso3) && item.iso3[0]) return item.iso3[0];
  for (const name of placeNames(item)) {
    const c = parentCountry(name);
    if (c) return c.iso3;
  }
  return null;
}

/** The country a story / signal / country to watch is about, as { iso3, name }, or null. */
export function firstCountry(item) {
  const iso3 = firstIso3(item);
  return iso3 ? parentCountry(iso3) : null;
}

/** mapFocusForDailySlide — the iso3 the map should fly to for a given daily slide. */
export function mapFocusForDailySlide(slide) {
  if (!slide) return null;
  if (slide.kind === 'story') return firstIso3(slide.story);
  if (slide.kind === 'watch') return firstIso3({ iso3: slide.countryToWatch?.iso3, regions: [slide.countryToWatch?.countryName] });
  return null;
}

export function mapFocusForWeeklySlide(slide) {
  if (!slide) return null;
  if (slide.kind === 'signal') return firstIso3(slide.signal);
  return null;
}

// shadingForDailySlides — one wash per top-story/watch country (never a made-up pin), reused by
// the console map exactly like story mode's chapter shading.
export function shadingForDailySlides(brief) {
  const out = [];
  const seen = new Set();
  const push = (country, category, count) => {
    if (!country || seen.has(country.iso3)) return;
    seen.add(country.iso3);
    out.push({
      iso3: country.iso3, count: count || 1, top: { title: country.name, category },
      crisisType: crisisTypeForCategory(category), hue: crisisHueForCategory(category),
    });
  };
  for (const s of (brief?.topStories || [])) push(firstCountry(s), s.category, s.sourceCount);
  const ctw = brief?.countryToWatch;
  if (ctw?.countryName) push(firstCountry({ iso3: ctw.iso3, regions: [ctw.countryName] }), 'conflict', 1);
  return out;
}

export function shadingForWeeklySlides(brief) {
  const out = [];
  const seen = new Set();
  for (const s of (brief?.signals || [])) {
    const iso3 = firstIso3(s);
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
    regions: placeNames(signal).length ? placeNames(signal) : undefined, sources: signal.sources,
  };
}
