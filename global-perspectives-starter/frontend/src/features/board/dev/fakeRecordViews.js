// DEV ONLY. Serves the 0037 view fixtures for `?devRecord=1` (lib/recordViews.js imports it behind import.meta.env.DEV).
// `devRecord=missing` serves nothing, which is the "not generated yet" path. Not a production fallback.
import active from './recordViews/active.json';
import storyA from './recordViews/story-a.json';
import counts from './recordViews/counts.json';
import linksA from './recordViews/links-story-a.json';
import storyB from './recordViews/story-b.json';
import linksB from './recordViews/links-story-b.json';
import { isoWeekOf } from '../lib/recordProjection.js';

export const devRecordMode = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('devRecord'));
export const devRecordIndex = active.stories;

export function fakeView(path) {
  if (devRecordMode() !== '1') return null;
  if (path === 'index/active.json') return active;
  if (path === 'stories/story-a.json') return storyA;
  if (path === 'links/story-a.json') return linksA;
  if (path === 'stories/story-b.json') return storyB;
  // The confirmed link is always in the current ISO week so the weekly list shows it.
  if (path === 'links/story-b.json') return { ...linksB, confirmedLinks: linksB.confirmedLinks.map((l) => ({ ...l, week: isoWeekOf(new Date()) })) };
  if (path.startsWith('counts/')) return { ...counts, date: path.slice(7, 17) };
  return null;
}
