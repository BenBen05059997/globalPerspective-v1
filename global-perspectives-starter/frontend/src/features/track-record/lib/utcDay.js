// utcDay — UTC calendar-day arithmetic shared by the accuracy estimate and the "not ready yet" copy.

export const DAY = 86400000;
/** A date or datetime string -> ms at 00:00 UTC of its calendar day. */
export const ms = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
/** ms -> its UTC calendar day, YYYY-MM-DD. */
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
/** ms -> the first Monday on or after it (the same instant when it is a Monday). */
export const mondayOnOrAfter = (t) => t + ((8 - new Date(t).getUTCDay()) % 7) * DAY;
