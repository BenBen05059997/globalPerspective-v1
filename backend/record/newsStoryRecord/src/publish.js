'use strict';

// Reads every facts day in the manifest, builds the views (views.js) and writes them under <prefix>views/ in the order of
// decision 0037 section 2: stories, links and counts, then index/active, then index/all, then manifest last. Plain
// PutObject (views are derived and replaceable). A failed write stops the sequence, so the old manifest stays: its age is
// the alarm.
const {buildViews, countDaysFor, writeGroups} = require('./views');
const {weeksBetween} = require('./readings');

const READ_BATCH = 10;
const WRITE_BATCH = 16;

function makePublisher({s3json}) {
  async function readFacts(prefix, extraDays) {
    const manifest = await s3json.getJson(`${prefix}facts/manifest.json`);
    const days = [...new Set([...(manifest && Array.isArray(manifest.days) ? manifest.days : []), ...extraDays])].sort();
    const facts = [];
    for (let i = 0; i < days.length; i += READ_BATCH) {
      const parts = await Promise.all(days.slice(i, i + READ_BATCH).map((d) => s3json.getLines(`${prefix}facts/${d}.jsonl`)));
      for (const p of parts) facts.push(...p.lines);
    }
    return {facts, manifestDays: manifest && Array.isArray(manifest.days) ? manifest.days.length : 0};
  }

  /** Every reading line of every ISO week from the first facts day to today (record/readings/YYYY-Www.jsonl; a missing week is empty; no listing). */
  async function readReadings(prefix, facts, today) {
    const days = facts.filter((f) => f.kind !== 'run').map((f) => f.date).sort();
    if (!days.length) return [];
    const weeks = weeksBetween(days[0], days[days.length - 1] > today ? days[days.length - 1] : today);
    const lines = [];
    for (let i = 0; i < weeks.length; i += READ_BATCH) {
      const parts = await Promise.all(weeks.slice(i, i + READ_BATCH).map((w) => s3json.getLines(`${prefix}readings/${w}.jsonl`)));
      for (const p of parts) lines.push(...p.lines);
    }
    return lines;
  }

  /** Build and write all views. `changedDays` = days whose facts changed in this invocation (their counts are rewritten). */
  async function publish({prefix, today, builtAt, runId, changedDays = []}) {
    const {facts, manifestDays} = await readFacts(prefix, changedDays);
    const readings = await readReadings(prefix, facts, today);
    const views = buildViews(facts, {today, builtAt, runId, factsManifestDays: manifestDays, countDays: countDaysFor(today, changedDays), readings});
    let written = 0;
    for (const group of writeGroups(views)) {
      for (let i = 0; i < group.length; i += WRITE_BATCH) {
        await Promise.all(group.slice(i, i + WRITE_BATCH).map(([key, obj]) => s3json.putLatest(`${prefix}views/${key}`, obj)));
      }
      written += group.length;
    }
    return {written, stories: views.stories.size, active: views.active.stories.length};
  }

  return {publish, readFacts};
}

module.exports = {makePublisher};
