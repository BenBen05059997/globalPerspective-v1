'use strict';

// UTC day helpers shared by the readers and the derivations. A "day" is always 'YYYY-MM-DD' in UTC.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** First 10 characters of a date or ISO string ('' when there is none). */
const day = (s) => String(s || '').slice(0, 10);

/** True for a real calendar day written 'YYYY-MM-DD'. */
function isDay(s) {
  return DAY_RE.test(s || '') && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Every day from `from` to `to`, inclusive. Throws on an invalid day or a reversed range. */
function eachDay(from, to) {
  if (!isDay(from) || !isDay(to)) throw new Error('eachDay needs two YYYY-MM-DD days');
  if (from > to) throw new Error('eachDay: from is after to');
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

module.exports = { day, isDay, addDays, eachDay };
