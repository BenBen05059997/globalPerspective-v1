// Reading health.json (the pipeline panel written hourly by newsHealth): one row per stage, one cell per UTC day.
// Facts only. A cell whose source could not be read keeps its status 'nodata' and its error text; nothing here fills a gap.

export const STATUS = {
  ok: { glyph: '✓', label: 'ok' },
  thin: { glyph: '~', label: 'thin' },
  missing: { glyph: '✕', label: 'missing' },
  failed: { glyph: '!', label: 'failed' },
  nodata: { glyph: '·', label: 'no data' },
};

/** The status entry for any value; an unknown status reads as no data. */
export const statusOf = (status) => STATUS[status] || STATUS.nodata;

/**
 * health.json -> [{ id, label, cells: [{ date, row }] }] in the file's stage order, days oldest first.
 * `row` is null when a day has no row for the stage (an older file); the cell then reads as no data.
 */
export function pivot(health) {
  const stages = Array.isArray(health?.stages) ? health.stages : [];
  const days = Array.isArray(health?.days) ? health.days : [];
  return stages.map((s) => ({
    id: s.id,
    label: s.label,
    cells: days.map((d) => ({ date: d.date, row: (d.rows || []).find((r) => r.stage === s.id) || null })),
  }));
}

/** A stage row has "no run" when every cell is no data (or absent). Returns { noRun, error }: the first error text, if any cell has one. */
export function noRun(cells) {
  const empty = cells.every((c) => !c.row || c.row.status === 'nodata');
  if (!empty) return { noRun: false, error: null };
  const withError = cells.find((c) => c.row && c.row.error);
  return { noRun: true, error: withError ? withError.row.error : null };
}

const scalar = (v) => (Array.isArray(v) ? v.map(scalar).join(', ') : v && typeof v === 'object' ? flatText(v) : String(v));
function flatText(obj) {
  return Object.entries(obj).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k} ${scalar(v)}`).join(', ');
}

/** The facts of a cell as [name, text] pairs for the detail card; null and empty values are left out, objects shown as "key n, key n". */
export function factLines(facts) {
  if (!facts || typeof facts !== 'object') return [];
  return Object.entries(facts)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length))
    .map(([k, v]) => [k, scalar(v)]);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-11-03' -> { day: '3', month: 'Nov', long: '3 Nov' } (UTC day as written; no time zone shift). */
export function dayParts(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return { day: '', month: '', long: date || '' };
  const month = MONTHS[Number(m[2]) - 1];
  return { day: String(Number(m[3])), month, long: `${Number(m[3])} ${month}` };
}
