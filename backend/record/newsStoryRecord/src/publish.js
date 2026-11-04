'use strict';

// Reads every facts day in the manifest, builds the views (views.js) and writes them under <prefix>views/ in the order of
// decision 0037 section 2: stories, links and counts, then index/active, then index/all, then digests.json and the manifest last.
// A view whose bytes match views/digests.json is not written (digests.js). Plain PutObject (views are derived and replaceable). A failed write stops the sequence, so the old manifest stays: its age is
// the alarm.
const {buildViews, countDaysFor, writeGroups} = require('./views');
const {weeksBetween} = require('./readings');
const {addDays} = require('./_shared/world');
const {DIGESTS_KEY, md5Of, readDigests} = require('./digests');

const READ_BATCH = 10;
const NOTE_SUBTYPES = ['entry', 'story_analysis', 'drift', 'country', 'link', 'web', 'daily_brief', 'weekly_brief']; // decisions 0042, 0048; a subtype with no manifest reads as empty
const WRITE_BATCH = 16;

function makePublisher({s3json, log = console}) {
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

  /** Every note of a subtype (0042): the days in record/notes/<subtype>/manifest.json; none written yet is empty. */
  async function readNotes(prefix, subtype) {
    const manifest = await s3json.getJson(`${prefix}notes/${subtype}/manifest.json`);
    const days = manifest && Array.isArray(manifest.days) ? manifest.days : [];
    const lines = [];
    for (let i = 0; i < days.length; i += READ_BATCH) {
      const parts = await Promise.all(days.slice(i, i + READ_BATCH).map((d) => s3json.getLines(`${prefix}notes/${subtype}/${d}.jsonl`)));
      for (const p of parts) lines.push(...p.lines);
    }
    return lines;
  }

  /** The entries inbox of the last two UTC days (decision 0051): [{day, lines}], oldest first. A day without a file has no lines. A read error throws (the views then keep their old manifest). */
  async function readTodayInbox(prefix, today) {
    const days = [addDays(today, -1), today];
    const parts = await Promise.all(days.map((d) => s3json.getLines(`${prefix}inbox/entries/${d}.jsonl`)));
    return days.map((day, i) => ({day, lines: parts[i].lines}));
  }

  /** Build and write all views. `changedDays` = days whose facts changed in this invocation (their counts are rewritten). `provisional` = today's archive entries and forecasts as provisional entry and forecast_drawn facts (a refresh, 0050, 0052). */
  async function publish({prefix, today, builtAt, runId, changedDays = [], provisional = []}) {
    const {facts, manifestDays} = await readFacts(prefix, changedDays);
    const readings = await readReadings(prefix, facts, today);
    const operatorAliases = await s3json.getJson(`${prefix}operator/aliases.json`); // null when the operator wrote none
    const notes = (await Promise.all(NOTE_SUBTYPES.map((t) => readNotes(prefix, t)))).flat();
    const todayDays = await readTodayInbox(prefix, today);
    const views = buildViews(facts, {today, builtAt, runId, factsManifestDays: manifestDays, countDays: countDaysFor(today, changedDays), readings, operatorAliases, notes, provisional, todayDays});
    // Only a view whose body changed is written (digests.js). The digest map is rebuilt from the views built now, so a view that no
    // longer exists drops out of it (its file stays in S3, as before). digests.json goes just before the manifest.
    const digests = await readDigests(s3json, prefix);
    const next = {};
    let written = 0;
    let skipped = 0;
    const put = (key, obj) => s3json.putLatest(`${prefix}views/${key}`, obj);
    const groups = writeGroups(views);
    const last = groups.pop(); // the manifest group
    for (const group of groups) {
      const todo = [];
      for (const [key, obj] of group) {
        const md5 = md5Of(obj);
        next[key] = md5;
        if (digests.files[key] === md5) skipped += 1; else todo.push([key, obj]);
      }
      for (let i = 0; i < todo.length; i += WRITE_BATCH) {
        await Promise.all(todo.slice(i, i + WRITE_BATCH).map(([key, obj]) => put(key, obj)));
      }
      written += todo.length;
    }
    await put(DIGESTS_KEY, {schemaVersion: 1, builtAt, files: next});
    for (const [key, obj] of last) await put(key, obj);
    written += last.length + 1; // + digests.json
    log.log(`[views] wrote ${written} of ${written + skipped} files (skipped ${skipped} unchanged), digests: ${digests.state}`);
    // viewsSkipped, not `skipped`: a refresh result already has that name (its unreadable inputs)
    return {written, viewsSkipped: skipped, digests: digests.state, stories: views.stories.size, active: views.active.stories.length, provisional: views.manifest.provisionalEntries || 0, provisionalForecasts: views.manifest.provisionalForecasts || 0};
  }

  return {publish, readFacts};
}

module.exports = {makePublisher};
