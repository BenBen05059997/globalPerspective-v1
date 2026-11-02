// trFormatDate — one date formatter shared by every track-record lib/component, so a date never
// silently reformats differently in two places. Accepts either a bare 'YYYY-MM-DD' day or a full
// ISO timestamp; returns '' for anything else rather than guessing.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDay(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return `${MONTHS[+m[2] - 1]} ${+m[3]} ${m[1]}`;
}

// Monday 00:00 UTC of the week containing dateLike.
export function weekStart(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (utc.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  utc.setUTCDate(utc.getUTCDate() - dayNum);
  return utc;
}
