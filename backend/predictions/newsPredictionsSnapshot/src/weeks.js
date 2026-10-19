'use strict';

// ISO-week helpers, a copy of the pure functions in newsPredictionResolver/src/lib.js (that
// Lambda writes the weeks; this one reads them). Parity is enforced by
// newsPredictionResolver/test/weeksParity.test.js over 800 days.
const ms = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
const addDays = (d, n) => new Date(ms(d) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);

function weekOf(d) {
  const t = new Date(ms(d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  const w = Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
function weekStart(weekId) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`bad week id ${weekId}`);
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const mondayW1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000;
  return new Date(mondayW1 + (Number(m[2]) - 1) * 7 * 86400000).toISOString().slice(0, 10);
}
const weekEnd = (weekId) => addDays(weekStart(weekId), 6);
const addWeeks = (weekId, n) => weekOf(addDays(weekStart(weekId), 7 * n));

module.exports = { ms, addDays, daysBetween, weekOf, weekStart, weekEnd, addWeeks };
