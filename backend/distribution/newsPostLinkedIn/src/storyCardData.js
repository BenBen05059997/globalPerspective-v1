'use strict';

// storyCardData — turns the record's public views into the plain object storyCardImage draws. Pure: the caller GETs the views
// (https://globalperspective.net/data/record/views/...) and hands them in. Mirrors the site's rules, which the back end cannot import:
//   pickLinkLine   = frontend shared/lib/linkLine.js (medium/strong judged links only; a pair the weekly review also confirmed first)
//   pickForecast   = frontend features/threads/lib/forecastOutcome.js forecastLine (open question due soonest with its own chance)
// If either of those changes, change the copy here.

const RANK = { strong: 3, medium: 2 };
const asc = (x) => String(x || '');

/** The ONE link a card shows, or null: { dir: 'feeds'|'fed', otherId, title, strength, confirmed }.
 *  ids: the story's own ids (its id and the ids merged into it, which keep links on their own records). views: their links views. */
function pickLinkLine(ids, views) {
  const own = new Set((ids || []).filter(Boolean));
  const list = (views || []).filter(Boolean);
  const confirmedIds = new Set(list.flatMap((v) => (Array.isArray(v.confirmedLinks) ? v.confirmedLinks : []).map((c) => c.otherThreadId).filter(Boolean)));
  const judged = [];
  for (const v of list) {
    for (const l of Array.isArray(v.judgedLinks) ? v.judgedLinks : []) {
      const fromOwn = own.has(l.from);
      const toOwn = own.has(l.to);
      if (fromOwn === toOwn || !RANK[l.confidence]) continue;
      const otherId = fromOwn ? l.to : l.from;
      judged.push({ dir: fromOwn ? 'feeds' : 'fed', otherId, title: l.otherTitle || null, strength: l.confidence, confirmed: confirmedIds.has(otherId), at: asc(l.generatedAt) });
    }
  }
  const best = judged.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || RANK[b.strength] - RANK[a.strength] || b.at.localeCompare(a.at))[0];
  if (!best) return null;
  const { at, ...line } = best; // eslint-disable-line no-unused-vars
  return line;
}

const BRANCH_ID = /^PRED#(.+)\/\d{4}-\d{2}-\d{2}\/\d+-/;

/** The one forecast of a card from a story or forecasts view: the newest fork that carries questions; its open question due soonest
 *  that has its own chance (a tie goes to the higher chance). -> { chance, text, due } or null. `today` is 'YYYY-MM-DD' (UTC). */
function pickForecast(view, today) {
  let fork = null;
  for (const f of Array.isArray(view?.forks) ? view.forks : []) {
    if (!f.branches?.some((b) => b.qid)) continue;
    if (!fork || asc(f.drawnAt) > asc(fork.drawnAt)) fork = f;
  }
  if (!fork) return null;
  const open = fork.branches
    .filter((b) => BRANCH_ID.test(asc(b.branchId)) && b.question === true && typeof b.p === 'number' && b.due && asc(b.trigger).trim()
      && !/^will\s/i.test(asc(b.trigger).trim()) && !b.state && !b.verdict && b.due >= today)
    .sort((a, b) => asc(a.due).localeCompare(asc(b.due)) || b.p - a.p);
  const t = open[0];
  return t ? { chance: t.p, text: asc(t.trigger).trim().replace(/[.?]$/, ''), due: t.due } : null;
}

/**
 * The places of a story, most "where it happens" first, and the other countries of its newest step.
 * The newest step's `iso3` is the only per-step country list; it is alphabetical (no order, no primary country, no coordinates) and
 * mixes places with actors. If the world bundle has a situation keyed on this story (`news#<ISO>#<threadId>`), its `iso3_affected`
 * is ordered (the keyed country first) and drops pure actors, so the step's countries are ordered and filtered by it; countries of the
 * step it does not name become `context`. Without a situation the step's list stays as it is and the map's frame rule
 * (nothing farther than a third of the world) drops far-away actors.
 * situations: world/latest.json `situations`; ids: the story's own ids.
 */
function placeCountries(step, situations, ids) {
  const stepIso = Array.isArray(step?.iso3) ? step.iso3 : [];
  const own = new Set((ids || []).filter(Boolean));
  const keyed = (situations || []).find((s) => own.has(s.threadId) && new RegExp(`^news#[A-Z]{3}#${s.threadId}$`).test(s.id));
  if (!keyed) return { countries: stepIso, context: [], source: 'step' };
  const affected = (keyed.iso3_affected || []).filter((c) => stepIso.includes(c));
  if (!affected.length) return { countries: stepIso, context: [], source: 'step' };
  return { countries: affected, context: stepIso.filter((c) => !affected.includes(c)), source: 'situation' };
}

const newest = (story) => (Array.isArray(story?.entries) && story.entries.length ? story.entries[story.entries.length - 1] : null);

/**
 * storyCardData({ story, linkViews, otherStory, forecastView, situations, ids, today }) -> the object for buildStoryCardSvg.
 *   story        stories/<id>.json            linkViews   links views of the story and of every id merged into it
 *   otherStory   stories/<otherId>.json of the picked link (for its category and newest-step countries), or null
 *   forecastView forecasts/<id>.json or the story view   situations  world/latest.json `situations` (optional)
 */
function storyCardData({ story, linkViews = [], otherStory = null, forecastView = null, situations = [], ids = null, today }) {
  const myIds = ids || [story.threadId, ...(story.merges || []).map((m) => m.from)];
  const step = newest(story);
  const place = placeCountries(step, situations, myIds);
  const line = pickLinkLine(myIds, linkViews);
  const data = {
    headline: story.title,
    kind: story.newestStep?.role || null,
    category: story.category,
    newestDate: story.newestStep?.date || step?.date || '',
    firstDate: story.firstStep?.date || '',
    stepCount: story.stepCount,
    stepDays: story.stepDays,
    countries: place.countries,
    contextCountries: place.context,
    sourceCount: story.newestStep?.sourceCount ?? null,
    link: null,
    forecast: null,
  };
  if (line) {
    const otherStep = newest(otherStory);
    data.link = { direction: line.dir, strength: line.strength, confirmed: line.confirmed, title: line.title || otherStory?.title || '', category: otherStory?.category || null, countries: Array.isArray(otherStep?.iso3) ? otherStep.iso3 : [], otherId: line.otherId };
  } else {
    data.forecast = pickForecast(forecastView || story, today);
  }
  return data;
}

module.exports = { pickLinkLine, pickForecast, placeCountries, storyCardData };
