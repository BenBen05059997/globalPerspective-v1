'use strict';

// The read of the NewsCache archive that four Lambdas used to carry as their own `readArchiveEntries`
// (newsCountryIntelligence, newsSystemsAnalysis, newsThreadAnalysis, newsWeeklyBrief): walk back `days` days from now, day 0 is
// the `today-archive` item (filtered by dayZero.keepDayZero), every earlier day is its `archive#YYYY-MM-DD` item, and every
// entry of a day goes through the caller's `project`. What differs between the Lambdas is passed in:
//   getRow(key)            -> the DynamoDB response for the NewsCache item { id: key } (the caller owns the client and the table)
//   project(entry, date)   -> the row to keep for an archive entry (`date` is its UTC 'YYYY-MM-DD'), or a falsy value to skip it
//   onError(key, err)      -> what a failed read does; the default logs `Failed to read <key>:` and goes on, a caller may throw
// A read or a projection that throws is handled per day, as before: entries already collected stay, the next day is read.

const { keepDayZero, archiveRowKey } = require('./dayZero');

const warnFailedRead = (key, err) => console.warn(`Failed to read ${key}:`, err.message);

async function readArchiveEntries({ days, getRow, project, onError = warnFailedRead }) {
  const entries = [];
  const now = new Date();

  for (let i = 0; i <= days; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);

    const key = i === 0 ? 'today-archive' : archiveRowKey(date);
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

    try {
      const { Item } = await getRow(key);
      if (Item && Array.isArray(Item.entries)) {
        for (const e of (i === 0 ? keepDayZero(Item.entries) : Item.entries)) {
          const row = project(e, dateStr);
          if (row) entries.push(row);
        }
      }
    } catch (err) {
      onError(key, err);
    }
  }

  return entries;
}

module.exports = { readArchiveEntries };
