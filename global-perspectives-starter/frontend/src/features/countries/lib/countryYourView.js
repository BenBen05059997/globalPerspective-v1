// countryYourView — the reader's private view and "I'd change my mind if…" rows, one record per country in this
// browser's localStorage. Never sent anywhere. Every storage call is guarded (private windows, blocked storage).
export const VIEW_MAX = 280;
export const ROWS_MAX = 3;
const key = (country) => `gp_country_view_${country}`;
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

export const emptyRow = () => ({ ifText: '', by: '', source: '', p: '' });

/** Shape any stored/typed value into { view, rows } within the limits. */
export function clean(v) {
  const rows = (Array.isArray(v?.rows) ? v.rows : []).slice(0, ROWS_MAX)
    .map((r) => ({ ifText: str(r?.ifText, 200), by: str(r?.by, 10), source: str(r?.source, 120), p: str(r?.p, 8) }));
  return { view: str(v?.view, VIEW_MAX), rows };
}

export function loadView(country, storage = globalThis.localStorage) {
  try { return clean(JSON.parse(storage.getItem(key(country)))); } catch { return clean(null); }
}

export function saveView(country, value, storage = globalThis.localStorage) {
  try {
    const v = clean(value);
    if (!v.view && !v.rows.length) storage.removeItem(key(country));
    else storage.setItem(key(country), JSON.stringify(v));
    return true;
  } catch { return false; }
}
