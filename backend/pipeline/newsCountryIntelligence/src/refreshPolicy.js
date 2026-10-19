'use strict';

// Country-briefing refresh policy (Batch 1 / R1). Pure: no AWS, no network (the caller passes
// the already-fetched world file), so it is unit-tested in ../test/refresh.test.js.
//
// A country is re-briefed only when there is something new to say:
//   new            no record yet
//   same-day       already briefed today (UTC) -> never twice a day (HISTORY#<day> is one row per day)
//   unchanged      article count identical to the last briefing (today's rule, kept)
//   alert          an open HIGH situation or GDACS alert that opened / changed after the last briefing
//   baseline       last briefing older than baselineHours (weekly)
//   coverage-jump  >= jumpMin new stories since the last briefing AND >= jumpFactor x the country's own pace
// The top `topN` countries by coverage are always candidates; up to `maxExtras` further countries are
// candidates ONLY while they have an active alert.

// Country identity (names, aliases, sub-national places) is the one shared resolver.
const { isCountryName, normKey, canonicalName } = require('./_shared/placeFilter');

const ACTIVE_STATES = new Set(['emerging', 'escalating']);

const DEFAULT_CFG = {
  baselineHours: 156,   // 6.5 d: a Monday 05:15 briefing is due again the following Monday 05:15
  jumpMin: 8,
  jumpFactor: 2,
  archiveDays: 30,
  topN: 20,
  maxExtras: 5,
};

const ymd = (iso) => String(iso || '').slice(0, 10);

/**
 * hotCountriesFromWorld(world, iso3Names) -> Map<canonicalName, [{ id, kind, since }]>
 * Active situations (emerging / escalating) that are HIGH tier or GDACS-sourced (GDACS opens only
 * Orange / Red). Countries come from affected_names plus iso3_affected via the ISO3 table (news
 * situations carry only ISO3 codes).
 */
function hotCountriesFromWorld(world, iso3Names = {}) {
  const hot = new Map();
  for (const s of (world && Array.isArray(world.situations) ? world.situations : [])) {
    if (!s || !ACTIVE_STATES.has(s.state)) continue;
    const isHigh = s.tier === 'high';
    const isGdacs = s.source === 'gdacs';
    if (!isHigh && !isGdacs) continue;
    const names = new Set();
    for (const n of s.affected_names || []) names.add(canonicalName(n));
    for (const c of s.iso3_affected || []) if (iso3Names[c]) names.add(canonicalName(iso3Names[c].name));
    const since = [s.last_change_at, s.tier_changed_at, s.opened_at].filter(Boolean).sort().pop() || null;
    for (const n of names) {
      if (!n) continue;
      if (!hot.has(n)) hot.set(n, []);
      hot.get(n).push({ id: s.id, kind: isHigh ? 'HIGH' : 'GDACS', since });
    }
  }
  return hot;
}

/** decideRefresh -> { refresh, reason, detail? } for ONE country (see the header for the rules). */
function decideRefresh({ existing, country, now, alerts, cfg = DEFAULT_CFG }) {
  if (!existing) return { refresh: true, reason: 'new' };
  const lastIso = existing.generatedAt;
  if (ymd(lastIso) === now.toISOString().slice(0, 10)) return { refresh: false, reason: 'already-today' };
  if (existing.totalArticles === country.totalArticles) return { refresh: false, reason: 'unchanged' };

  // an alert that opened / changed after the last briefing (an alert already covered by it does not retrigger)
  const fresh = (alerts || []).filter((a) => !a.since || a.since > lastIso);
  if (fresh.length) return { refresh: true, reason: 'alert', detail: fresh.map((a) => `${a.kind}:${a.id}`).join(',') };

  const ageH = (now - Date.parse(lastIso)) / 3600000;
  if (Number.isFinite(ageH) && ageH >= cfg.baselineHours) return { refresh: true, reason: 'weekly-baseline', detail: `${(ageH / 24).toFixed(1)}d old` };

  const dates = country.entryDates || [];
  const newSince = dates.filter((d) => d > ymd(lastIso)).length;
  const expected = ((existing.totalArticles || 0) / cfg.archiveDays) * (Math.max(ageH, 0) / 24);
  if (newSince >= cfg.jumpMin && newSince >= cfg.jumpFactor * Math.max(expected, 1)) {
    return { refresh: true, reason: 'coverage-jump', detail: `${newSince} new vs ~${expected.toFixed(1)} expected` };
  }
  return { refresh: false, reason: 'not-due', detail: alerts && alerts.length ? 'alert already covered' : undefined };
}

/**
 * planRun({ countries, existingByName, hot, now, cfg }) -> array of
 *   { country, tier: 'top20' | 'alert-extra' | 'outside', ...decision }
 * `countries` are groupByCountry() results sorted by coverage (>= 2 stories).
 */
function planRun({ countries, existingByName, hot, now, cfg = DEFAULT_CFG }) {
  const plan = [];
  let extras = 0;
  countries.forEach((country, i) => {
    const alerts = hot.get(canonicalName(country.countryName)) || [];
    if (i < cfg.topN) {
      plan.push({ country: country.countryName, tier: 'top20', alerts: alerts.length, ...decideRefresh({ existing: existingByName[country.countryName], country, now, alerts, cfg }) });
    } else if (alerts.length) {
      if (extras >= cfg.maxExtras) {
        plan.push({ country: country.countryName, tier: 'alert-extra', alerts: alerts.length, refresh: false, reason: 'extras-cap', detail: `max ${cfg.maxExtras} alert extras` });
      } else {
        const d = decideRefresh({ existing: existingByName[country.countryName], country, now, alerts, cfg });
        // an extra is only ever briefed because of its alert (no baseline / coverage-jump for it)
        const ok = d.refresh && (d.reason === 'alert' || d.reason === 'new');
        if (ok) extras += 1;
        plan.push({ country: country.countryName, tier: 'alert-extra', alerts: alerts.length, ...(ok || !d.refresh ? d : { refresh: false, reason: 'not-due', detail: 'extra: only an alert refreshes it' }) });
      }
    } else {
      plan.push({ country: country.countryName, tier: 'outside', alerts: 0, refresh: false, reason: 'outside-top-n' });
    }
  });
  return plan;
}

/** Which hot canonical names have no country record among today's countries (for the dry-run report). */
function unmatchedAlerts(hot, countries) {
  const have = new Set(countries.map((c) => canonicalName(c.countryName)));
  return [...hot.keys()].filter((n) => !have.has(n));
}

module.exports = { isCountryName, normKey, DEFAULT_CFG, canonicalName, hotCountriesFromWorld, decideRefresh, planRun, unmatchedAlerts };
