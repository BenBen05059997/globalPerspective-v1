'use strict';

// storyCardPost — the social post picture of one story: GETs the story's public record views from the site
// (<SITE_URL>/data/record/views/..., the same files the site reads) and draws the story card (storyCardImage).
// Operator 2026-11-22: the card replaces the old map picture; a link to a story in the same places does not lead
// the picture (no arrow, says little), so the story's forecast leads instead.

const { storyCardData, pickForecast } = require('./storyCardData');
const { planMap, renderStoryCardPng } = require('./storyCardImage');

const ID = /^[A-Za-z0-9_-]{1,120}$/;
const V = 'record/views';

/** A GET reader over <siteUrl>/data/: path -> parsed JSON, null on 404; any other failure throws. */
function siteDataReader(siteUrl, { fetchFn = fetch, timeoutMs = 8000 } = {}) {
  const base = new URL('data/', siteUrl).href;
  return async (path) => {
    const res = await fetchFn(base + path, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  };
}

/** The card data of a story (storyCardData), or null when the story has no view. `get` reads a path under /data/. */
async function storyCardFor(threadId, { get, today }) {
  if (!ID.test(threadId || '')) return null;
  let story = await get(`${V}/stories/${threadId}.json`);
  if (story?.aliasOf && ID.test(story.aliasOf)) story = await get(`${V}/stories/${story.aliasOf}.json`);
  if (!story) return null;
  const ids = [...new Set([story.threadId, ...(story.merges || []).map((m) => m.from)].filter((i) => ID.test(i || '')))];
  const [world, forecastView, ...linkViews] = await Promise.all([
    get('world/latest.json').catch(() => null), // only orders the countries; the card is drawn without it
    get(`${V}/forecasts/${story.threadId}.json`),
    ...ids.map((i) => get(`${V}/links/${i}.json`)),
  ]);
  const base = { story, linkViews, forecastView, situations: world?.situations, today };
  const probe = storyCardData(base);
  if (!probe.link) return probe;
  const otherStory = ID.test(probe.link.otherId || '') ? await get(`${V}/stories/${probe.link.otherId}.json`) : null;
  const data = storyCardData({ ...base, otherStory });
  if (planMap(data).placeNames.length) return data;
  const { linkPlaces, ...rest } = data; // eslint-disable-line no-unused-vars
  return { ...rest, link: null, forecast: pickForecast(forecastView || story, today) };
}

/** The post picture (PNG buffer, 1200x630) of a story, or null when it has no view. */
async function storyCardPng(threadId, { siteUrl, fetchFn, now = new Date() } = {}) {
  const data = await storyCardFor(threadId, { get: siteDataReader(siteUrl, { fetchFn }), today: now.toISOString().slice(0, 10) });
  return data ? renderStoryCardPng(data) : null;
}

module.exports = { siteDataReader, storyCardFor, storyCardPng };
