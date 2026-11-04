'use strict';

// UTC day arithmetic. Days are 'YYYY-MM-DD' strings; nothing here reads the local time zone.

const DAY_MS = 86400000;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const dayStart = (day) => Date.parse(`${day}T00:00:00.000Z`);

/** The last n UTC days ending at (and including) the day of `now`, oldest first. */
function lastDays(now, n) {
  const end = dayStart(dayOf(now));
  return Array.from({ length: n }, (_, i) => dayOf(end - (n - 1 - i) * DAY_MS));
}

/** A day is closed once D+1 reaches `afterHour` UTC: nothing more is expected for it. */
const isClosed = (day, now, afterHour) => new Date(now).getTime() >= dayStart(day) + DAY_MS + afterHour * 3600000;

const isSunday = (day) => new Date(dayStart(day)).getUTCDay() === 0;

/** ISO week id 'YYYY-Www' of a day. */
function isoWeek(day) {
  const d = new Date(dayStart(day));
  const dow = (d.getUTCDay() + 6) % 7;            // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + 3);          // the Thursday of this week
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / DAY_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

module.exports = { DAY_MS, dayOf, dayStart, lastDays, isClosed, isSunday, isoWeek };
