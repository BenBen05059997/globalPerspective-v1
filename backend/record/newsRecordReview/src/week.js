'use strict';

// ISO weeks in UTC. 'YYYY-Www' <-> Monday..Sunday. Pure; no clock.
const DAY_MS = 86400000;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;
const isWeek = (w) => typeof w === 'string' && WEEK_RE.test(w) && Number(w.slice(6)) >= 1 && Number(w.slice(6)) <= 53;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' -> its ISO week 'YYYY-Www' (the week belongs to the year of its Thursday). */
function weekOf(date) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = ms + (3 - dow) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const n = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(n).padStart(2, '0')}`;
}

/** 'YYYY-Www' -> {from: Monday, to: Sunday} */
function weekRange(week) {
  if (!isWeek(week)) throw new Error(`week must be YYYY-Www, got ${week}`);
  const year = Number(week.slice(0, 4));
  const jan4 = Date.UTC(year, 0, 4);
  const mondayOfW1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS;
  const from = mondayOfW1 + (Number(week.slice(6)) - 1) * DAY_MS * 7;
  const range = {from: day(from), to: day(from + 6 * DAY_MS)};
  if (weekOf(range.from) !== week) throw new Error(`no such ISO week ${week}`);
  return range;
}

/** The earlier week: n weeks before `week`. */
const weekBefore = (week, n = 1) => weekOf(day(Date.parse(`${weekRange(week).from}T00:00:00Z`) - n * 7 * DAY_MS));

/** The ISO week that ended before `nowIso` (the one before the week containing it). */
const lastEndedWeek = (nowIso) => weekBefore(weekOf(nowIso.slice(0, 10)));

const daysBetween = (a, b) => Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / DAY_MS;

module.exports = {isWeek, weekOf, weekRange, weekBefore, lastEndedWeek, daysBetween};
