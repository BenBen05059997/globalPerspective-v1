// Reading ops.json (the operator's money file written hourly by newsHealth). DeepSeek is an estimate; AWS is Cost Explorer.
// Nothing here invents a number: a null stays absent and the caller says so.

/** '$0.37' · '$0.0037' · '$12.40'; null for a missing number. */
export function usd(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n === 0) return '$0.00';
  return `$${Math.abs(n) >= 0.1 ? n.toFixed(2) : Math.abs(n) >= 0.01 ? n.toFixed(3) : n.toPrecision(2)}`;
}

/** 1234567 -> '1.2M', 52000 -> '52k', 900 -> '900'. */
export function tokens(n) {
  if (typeof n !== 'number') return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

/**
 * DeepSeek by Lambda: yesterday and the month to date, from the per-day lines.
 * -> [{ fn, calls, promptTokens, completionTokens, yesterday, month, unpriced }] sorted by month spend.
 * `yesterday` / `month` are null when the Lambda has only unpriced lines in that span.
 */
export function byLambda(deepseek) {
  const days = deepseek?.days || [];
  const yDate = deepseek?.yesterday?.date;
  const month = deepseek?.monthToDate?.month;
  const acc = new Map();
  for (const d of days) {
    const inMonth = month && d.date.startsWith(month);
    const isYesterday = d.date === yDate;
    if (!inMonth && !isYesterday) continue;
    for (const l of d.lines || []) {
      const e = acc.get(l.fn) || { fn: l.fn, calls: 0, promptTokens: 0, completionTokens: 0, yesterday: 0, month: 0, pricedY: false, pricedM: false, unpriced: false };
      if (l.usd == null) e.unpriced = true;
      if (isYesterday) { e.calls += l.calls; e.promptTokens += l.promptTokens; e.completionTokens += l.completionTokens; if (l.usd != null) { e.yesterday += l.usd; e.pricedY = true; } }
      if (inMonth && l.usd != null) { e.month += l.usd; e.pricedM = true; }
      acc.set(l.fn, e);
    }
  }
  return [...acc.values()]
    .map((e) => ({ fn: e.fn, calls: e.calls, promptTokens: e.promptTokens, completionTokens: e.completionTokens, yesterday: e.pricedY ? e.yesterday : null, month: e.pricedM ? e.month : null, unpriced: e.unpriced }))
    .sort((a, b) => (b.month || 0) - (a.month || 0) || a.fn.localeCompare(b.fn));
}

/** The last `n` days for the bars: [{ date, deepseek, aws }] (null = no data that day), oldest first. */
export function dailyBars(ops, n = 14) {
  const ds = new Map((ops?.deepseek?.days || []).map((d) => [d.date, d.usd]));
  const aws = new Map((ops?.aws?.days || []).map((d) => [d.date, d.usd]));
  const dates = [...new Set([...ds.keys(), ...aws.keys()])].sort().slice(-n);
  return dates.map((date) => ({ date, deepseek: ds.has(date) ? ds.get(date) : null, aws: aws.has(date) ? aws.get(date) : null }));
}

/** Unit costs of the newest day that has a count: [{ id, label, date, usd, count, per }]. A unit with no count anywhere is left out. */
export function unitRows(unitCosts) {
  const labels = unitCosts?.labels || {};
  const days = [...(unitCosts?.days || [])].sort((a, b) => b.date.localeCompare(a.date));
  return Object.keys(labels).map((id) => {
    const d = days.find((x) => x[id] && x[id].per != null);
    return d ? { id, label: labels[id], date: d.date, usd: d[id].usd, count: d[id].count, per: d[id].per } : null;
  }).filter(Boolean);
}
