'use strict';

// The shared story fields (decision 0058 rule 7, schema/views/story-stamp.schema.json): one function, so every view that names a
// story carries the same title, description, countries, regions and tier. Pure. `themeId` is null here; the builder sets it once the themes are grouped (views.js, themes.js).
// Nothing is guessed: a missing value is null and the field beside it says why (0037 section 6).
const COUNTRY_NAMES = require('./_shared/iso3Names.json');
const {regionsOfCountries} = require('./_shared/regions');
const {tierFromScore} = require('./_shared/world/tier');

const NO_READING = 'no reading yet'; // the wording of 0037 section 6 (story view reading.reason, links confirmedLinksReason)
const NO_ANALYSIS = 'no analysis yet';
const NO_SCORE = 'analysis has no score';

/** Valid ISO3 codes only (iso3Names.json) plus EUU, de-duplicated, sorted; WLD, LAT, UNK and anything else are dropped. */
const cleanIso3 = (codes) => [...new Set((codes || []).filter((c) => c === 'EUU' || Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, c)))].sort();

/**
 * @param threadId
 * @param title      the story's titleOf result (views.js), passed in unchanged
 * @param iso3       the story's raw country codes
 * @param born       'YYYY-MM-DD' or null
 * @param lastFactAt ISO time or null (a fact of any kind)
 * @param entries    the story's entry rows (views.js entryRows; placed articles are rows marked kind 'article' and do not count). Sets `lastEntryAt` (the `at` of the newest news entry)
 *                   and `category` (the raw category of the newest news entry that has one; the frontend's crisisHue.js owns the category -> crisis type map, not this file)
 * @param reading    the story's standing readings ({line: reading|null, ...}) or undefined
 * @param analysis   the story's latest story-analysis note as stored ({riskScore, generatedAt, ...}) or null
 */
function storyStamp({threadId, title, iso3, born, lastFactAt, entries = [], reading, analysis}) {
  const news = entries.filter((e) => e.kind !== 'article');
  const newest = (rows) => rows.reduce((best, e) => (!best || e.at >= best.at ? e : best), null); // a tie on `at` goes to the later row (rows are in date, at, eventId order)
  const lastEntry = newest(news);
  const categorised = newest(news.filter((e) => typeof e.category === 'string' && e.category.trim()));
  const line = reading && reading.line ? reading.line : null;
  const score = analysis && analysis.riskScore !== null && analysis.riskScore !== undefined && analysis.riskScore !== '' && Number.isFinite(Number(analysis.riskScore)) ? Number(analysis.riskScore) : null;
  const tier = score === null ? null : tierFromScore(score);
  const countries = cleanIso3(iso3);
  return {
    threadId, title: title ?? null,
    line: line ? line.payload.text : null, lineWeek: line ? line.week : null, lineReason: line ? null : NO_READING,
    iso3: countries, regions: regionsOfCountries(countries),
    tier, riskScore: score, riskAt: score === null ? null : analysis.generatedAt ?? null, tierReason: tier ? null : analysis ? NO_SCORE : NO_ANALYSIS,
    lastFactAt: lastFactAt ?? null, lastEntryAt: lastEntry ? lastEntry.at : null, category: categorised ? categorised.category : null, born: born ?? null, themeId: null,
  };
}

module.exports = {storyStamp, cleanIso3, NO_READING};
