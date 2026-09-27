// Macro fact rows for the country card (C1 fact rule): each figure carries its own data year
// (World Bank `{ year, value }`), and is shown only if that year is >= current year - 3. The
// payload's `asOf` is when the proxy fetched it, NOT the data year — never label a figure with it.
export const MACRO_MAX_AGE_YEARS = 3;

const FIELDS = [
  { key: 'gdp_usd', label: 'GDP', fmt: (v) => `$${(v / 1e9).toFixed(0)}B` },
  { key: 'cpi_yoy', label: 'CPI YoY', fmt: (v) => `${(+v).toFixed(1)}%` },
];

export function macroRows(macro, now = new Date()) {
  if (!macro || typeof macro !== 'object') return [];
  const currentYear = now.getFullYear();
  const rows = [];
  for (const f of FIELDS) {
    const field = macro[f.key];
    if (!field || typeof field !== 'object') continue; // a bare number has no year: omit
    const year = Number(field.year);
    const value = Number(field.value);
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
    if (currentYear - year > MACRO_MAX_AGE_YEARS) continue;
    rows.push({ k: f.label, v: f.fmt(value), year });
  }
  return rows;
}
