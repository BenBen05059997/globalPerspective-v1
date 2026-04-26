// MacroChip — compact inline macro snapshot from useMarketsCountry.
// Renders "GDP $24T · CPI 3.1%" style chip. Shows up to 3 metrics.
// Props:
//   macro:  object from markets.macro { gdp, cpi_yoy, unemployment, debt_to_gdp, asOf }
//   fields: which keys to show, default ["gdp", "cpi_yoy", "unemployment"]

const LABELS = {
  gdp: 'GDP',
  cpi_yoy: 'CPI',
  unemployment: 'Unemp',
  debt_to_gdp: 'Debt/GDP',
  current_account: 'CA',
};

function fmt(key, val) {
  if (val == null) return null;
  if (key === 'gdp') {
    const t = val / 1e12;
    return t >= 1 ? `$${t.toFixed(1)}T` : `$${(val / 1e9).toFixed(0)}B`;
  }
  return `${Number(val).toFixed(1)}%`;
}

export default function MacroChip({
  macro,
  fields = ['gdp', 'cpi_yoy', 'unemployment'],
}) {
  if (!macro) return null;

  const parts = fields
    .map(k => ({ label: LABELS[k] || k, value: fmt(k, macro[k]) }))
    .filter(p => p.value != null);

  if (parts.length === 0) return null;

  return (
    <span className="mchip">
      {parts.map((p, i) => (
        <span key={p.label} className="mchip-pair">
          <span className="mchip-label">{p.label}</span>
          <span className="mchip-val">{p.value}</span>
          {i < parts.length - 1 && <span className="mchip-sep">·</span>}
        </span>
      ))}
    </span>
  );
}
