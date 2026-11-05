const TOKYO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * The calendar day in Tokyo (YYYY-MM-DD) at `ms`. The site's editions and pages are dated in JST, so
 * "today" is the Tokyo day, whatever the reader's own timezone is. Tokyo has no DST, so a day back is 86400000 ms.
 */
export function tokyoDayKey(ms = Date.now()) {
  return TOKYO_DAY.format(ms);
}

/**
 * A date key (YYYY-MM-DD) as a label. A key is a calendar date, shown as written ("Fri, Sep 4"); only
 * "Today" / "Yesterday" are decided, by the Tokyo calendar day. Archive keys are UTC days, so between
 * 00:00 and 09:00 JST the still-open UTC day reads "Yesterday": its date is the day before Tokyo's.
 */
export function formatDateLabel(dateStr) {
  const now = Date.now();
  const today = tokyoDayKey(now);
  const yesterday = tokyoDayKey(now - 86400000);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** True for a real calendar day written YYYY-MM-DD ('2026-02-30' and '2026-13-45' are not). */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
