// imported by Node tooling outside src/ — keep relative imports
// Scenario lens picture (S5c F1 §2): "bands from today to dated triggers" — one band per
// scenario that carries a real `by` date (D4, analysisStruct.js), positioned by days from
// today; scenarios with no dated trigger are grouped separately ("timing unclear") rather
// than invented a position. Pure, no Date-object mutation surprises (UTC midnight math).

function daysBetweenISO(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// buildScenarioBands(scenarios, todayISO) -> { today, bands, undated }
//   - bands: dated scenarios, sorted soonest-first, each { name, pLow, pHigh, by, days, places }.
//   - undated: scenarios with no `by`, in input order, { name, pLow, pHigh, places }.
export function buildScenarioBands(scenarios, todayISO) {
  const list = Array.isArray(scenarios) ? scenarios : [];
  const today = ISO_DATE_RE.test(todayISO || '') ? todayISO : new Date().toISOString().slice(0, 10);

  const bands = [];
  const undated = [];
  for (const s of list) {
    if (!s || typeof s.name !== 'string') continue;
    if (ISO_DATE_RE.test(s.by || '')) {
      const days = daysBetweenISO(today, s.by);
      if (days != null) {
        bands.push({ name: s.name, pLow: s.pLow, pHigh: s.pHigh, by: s.by, days, places: Array.isArray(s.places) ? s.places : [] });
        continue;
      }
    }
    undated.push({ name: s.name, pLow: s.pLow, pHigh: s.pHigh, places: Array.isArray(s.places) ? s.places : [] });
  }
  bands.sort((a, b) => a.days - b.days);
  return { today, bands, undated };
}
