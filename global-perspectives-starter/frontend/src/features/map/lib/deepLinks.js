// deepLinks — how the map console resolves its address (shared/lib/links.js mapHref builds it):
//   ?focus=<situation id>   a situation by its id, or by an old id it absorbed (`aliases[]`: news
//                           situations are keyed `news#<ISO3>#<threadId>` since L2-JOINS; the tracker
//                           keeps the per-story ids they replaced so old links still land)
//   ?story=<threadId>       today's topic with that thread (or topic) id; else the situation that
//                           carries the thread; else the thread in the story-web index
//                           (`web_index.threads[threadId]`: title + places), shown as a story card
//   ?country=<ISO3 | name>  the country (resolveCountry / parentCountry), flown to and outlined
// Pure: no fetches, no React.
import { parentCountry } from '@/shared/lib/countries.js';
import { crisisHueForCategory } from '@/shared/lib/crisisHue.js';

/** The situation a ?focus= id names: its own id, else the situation that absorbed it. */
export function situationForFocus(situations, focus) {
  if (!focus || !Array.isArray(situations)) return null;
  return situations.find((s) => s.id === focus)
    || situations.find((s) => Array.isArray(s.aliases) && s.aliases.includes(focus))
    || null;
}

/** Today's topic a ?story= id names (thread id, or the topic id of an unthreaded topic). */
export function topicForStory(topics, storyId) {
  if (!storyId || !Array.isArray(topics)) return null;
  return topics.find((t) => (t.threadId || t.topicId) === storyId) || null;
}

/** The situation that carries a thread (news situations get one from the story map). */
export function situationForThread(situations, threadId) {
  if (!threadId || !Array.isArray(situations)) return null;
  return situations.find((s) => s.threadId === threadId) || null;
}

/** The countries of a story-web thread: its `iso3[]` when the read API sends one, else its places
 *  (most-mentioned first) resolved to countries. Regions and seas are dropped. */
function threadCountries(thread) {
  const out = [];
  const add = (c) => { if (c && !out.some((x) => x.iso3 === c.iso3)) out.push(c); };
  if (Array.isArray(thread.iso3) && thread.iso3.length) thread.iso3.forEach((code) => add(parentCountry(code)));
  else (thread.places || []).forEach((p) => add(parentCountry(p?.name)));
  return out;
}

/** A thread from the story-web index as the topic shape StoryCard reads ({ threadId, title, iso3,
 *  regions }), or null when the index does not know the thread. `fromIndex` marks it as not part of
 *  today's feed (the card then shows no feed date). */
export function topicFromWebIndex(index, threadId) {
  const t = threadId && index?.threads ? index.threads[threadId] : null;
  if (!t || !t.title) return null;
  const countries = threadCountries(t);
  return {
    threadId, title: t.title, fromIndex: true,
    iso3: countries.map((c) => c.iso3), regions: countries.map((c) => c.name),
  };
}

/** ?country= -> { iso3, name } (a display name, alias or ISO3; a place inside one country gives that
 *  country) or null for a region / unknown text. */
export function countryForParam(param) {
  return param ? parentCountry(param) : null;
}

/** The name the country card is opened with: the canonical name for an ISO3 code, else the text as
 *  given (records keyed under an older spelling still resolve through the read API's key list). */
export function countryCardName(param) {
  if (!param) return null;
  const c = countryForParam(param);
  return c && /^[A-Z]{3}$/.test(param.trim()) ? c.name : param;
}

/** The map's country washes plus an outline-only entry for the focused country when it has no wash
 *  of its own (a country deep link, or a story from the index), so both map modes can outline it. */
export function withFocusOutline(shading, iso3, name) {
  if (!iso3 || shading.some((e) => e.iso3 === iso3)) return shading;
  return [...shading, { iso3, count: 0, dim: true, outlineOnly: true, top: { title: name || iso3 }, crisisType: 'neutral', hue: crisisHueForCategory(null) }];
}
