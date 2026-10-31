'use strict';

// Entries from the inbox instead of the archive (decision 0051). The agent appends record/inbox/entries/DAY.jsonl (shared entriesInbox.js holds the
// line format and the replacement rule); this reads the days and answers in the shape world.archiveRange/archiveDay do, so entryFact, births and the
// provisional refresh do not change. compareEntries tells what differs between the two sources, for ENTRIES_SOURCE=compare and the proof CLI.
const world = require('./_shared/world');
const inbox = require('./_shared/entriesInbox');

/** Map date -> the day's inbox lines, for from..to inclusive (a day with no file or no line is absent). */
async function readInboxDays(s3json, prefix, from, to) {
  const dates = world.eachDay(from, to);
  const parts = await Promise.all(dates.map((d) => s3json.getLines(`${prefix}inbox/entries/${d}.jsonl`)));
  const out = new Map();
  dates.forEach((d, i) => { if (parts[i].lines.length) out.set(d, parts[i].lines); });
  return out;
}

/** world.archiveDay's answer for one day from its lines, or null when the day has none. */
function dayOfLines(date, lines) {
  if (!lines || !lines.length) return null;
  const {entries, updatedAt} = inbox.replayDay(lines);
  return world.archiveDayOfEntries(date, entries, {updatedAt});
}

/** world.archiveRange's answer from readInboxDays' map. */
function rangeOfDays(days, from, to) {
  const dates = world.eachDay(from, to);
  const rows = dates.map((d) => dayOfLines(d, days.get(d)));
  return {from, to, days: rows.filter(Boolean), missingDays: dates.filter((_, i) => !rows[i])};
}

// What a fact is built from, whole: the normalised entry with its provenance (sourceKey, sourceRow, index). Equal here means equal facts.
const keyOf = (e) => `${e.date}|${e.topicId}`;
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The differences between two archiveRange answers (the archive's and the inbox's), per day: counts, topics on one side only, and for the
 * topics on both the fields that differ (in the normalised entry, provenance included). `ignoreDays` = days not to compare (the inbox has no
 * file for days before it started). Returns {days, entries, differing, days: [{date, archive, inbox, onlyArchive, onlyInbox, changed:[{topicId, fields}]}]}.
 */
function compareEntries(archive, fromInbox, {skipDays = []} = {}) {
  const byDate = (range) => new Map(range.days.map((d) => [d.date, d.entries]));
  const a = byDate(archive);
  const b = byDate(fromInbox);
  const dates = [...new Set([...a.keys(), ...b.keys()])].filter((d) => !skipDays.includes(d)).sort();
  const out = [];
  let entries = 0;
  for (const date of dates) {
    const ea = a.get(date) || [];
    const eb = b.get(date) || [];
    entries += ea.length;
    const mb = new Map(eb.map((e) => [keyOf(e), e]));
    const ma = new Map(ea.map((e) => [keyOf(e), e]));
    const changed = [];
    for (const e of ea) {
      const o = mb.get(keyOf(e));
      if (o && !sameJson(e, o)) changed.push({topicId: e.topicId, fields: [...new Set([...Object.keys(e), ...Object.keys(o)])].filter((k) => !sameJson(e[k], o[k]))});
    }
    // the same list in a different order is a difference too: the position is part of the provenance, but say so apart from the fields
    const order = ea.length === eb.length && ea.every((e) => mb.has(keyOf(e))) && !ea.every((e, i) => keyOf(e) === keyOf(eb[i]));
    const row = {date, archive: ea.length, inbox: eb.length, onlyArchive: ea.filter((e) => !mb.has(keyOf(e))).map((e) => e.topicId), onlyInbox: eb.filter((e) => !ma.has(keyOf(e))).map((e) => e.topicId), changed, ...(order ? {orderDiffers: true} : {})};
    if (row.onlyArchive.length || row.onlyInbox.length || changed.length || order) out.push(row);
  }
  return {days: dates.length, entries, differing: out.length, differences: out};
}

module.exports = {readInboxDays, dayOfLines, rangeOfDays, compareEntries};
