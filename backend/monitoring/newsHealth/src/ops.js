'use strict';

// The money panel (monitoring/ops.json, private). DeepSeek is an ESTIMATE from the [usage] log lines priced with prices.json;
// AWS is Cost Explorer's own daily figure. Facts only: a source that failed keeps the earlier days and says why in `errors`.
const { CONFIG } = require('./config');
const { lastDays, dayOf, isoWeek } = require('./days');
const { usageUsd, round } = require('./pricing');
const { buildReaders } = require('./readers');
const { buildQuality } = require('./quality');

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * usageRows: [{ hourIso, fn, step, model, calls, promptTokens, completionTokens, cacheHitTokens }] from the Logs Insights query.
 * Returns the per-day lines for the days in `window`: { [day]: { lines:[{fn,step,model,calls,promptTokens,completionTokens,cacheHitTokens,usd}] } }.
 */
function usageDays(usageRows, prices, window) {
  const days = Object.fromEntries(window.map((d) => [d, new Map()]));
  for (const r of usageRows) {
    const day = r.hourIso.slice(0, 10);
    if (!days[day]) continue;
    const key = `${r.fn}|${r.step}|${r.model}`;
    const line = days[day].get(key) || { fn: r.fn, step: r.step, model: r.model, calls: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, usd: 0, priced: true };
    const usd = usageUsd(prices, r);
    line.calls += r.calls; line.promptTokens += r.promptTokens; line.completionTokens += r.completionTokens; line.cacheHitTokens += r.cacheHitTokens;
    if (usd == null) line.priced = false; else line.usd += usd;
    days[day].set(key, line);
  }
  return Object.fromEntries(window.map((d) => [d, [...days[d].values()].map((l) => ({
    fn: l.fn, step: l.step, model: l.model, calls: l.calls, promptTokens: l.promptTokens, completionTokens: l.completionTokens,
    cacheHitTokens: l.cacheHitTokens, usd: l.priced ? round(l.usd, 6) : null,
  })).sort((a, b) => (b.usd || 0) - (a.usd || 0))]));
}

const linesUsd = (lines) => round(sum(lines.map((l) => l.usd || 0)), 4);

/** Spend of the lines that match a unit (fn list and step list; null = any). */
function matchUsd(lines, fn, steps) {
  return round(sum(lines.filter((l) => (!fn || fn.includes(l.fn)) && (!steps || steps.includes(l.step))).map((l) => l.usd || 0)), 6);
}

function unitCostsFor(day, lines, rawDay) {
  const facts = {
    entry: rawDay && rawDay.counts ? rawDay.counts.entry : null,
    forecast_drawn: rawDay && rawDay.counts ? rawDay.counts.forecast_drawn : null,
    country_notes: rawDay ? rawDay.countryNotes : null,
    daily_brief: rawDay ? rawDay.dailyBrief : null,
  };
  const out = { date: day };
  for (const [id, u] of Object.entries(CONFIG.units)) {
    const count = facts[u.count];
    const usd = lines.length ? matchUsd(lines, u.fn, u.steps) : null;
    out[id] = { usd, count: count == null ? null : count, per: count > 0 && usd != null ? round(usd / count, 5) : null };
  }
  return out;
}

function awsDays(costRows) {
  const days = {};
  for (const r of costRows) {
    const d = days[r.day] || (days[r.day] = { date: r.day, usd: 0, byService: [] });
    d.usd += r.usd;
    d.byService.push({ service: r.service, usd: round(r.usd, 4) });
  }
  return Object.values(days).map((d) => ({ date: d.date, usd: round(d.usd, 4), byService: d.byService.filter((s) => s.usd !== 0).sort((a, b) => b.usd - a.usd) }));
}

const byDate = (a, b) => a.date.localeCompare(b.date);
function mergeDays(prevDays, fresh, keep) {
  const map = new Map((prevDays || []).map((d) => [d.date, d]));
  for (const d of fresh) map.set(d.date, d);
  return [...map.values()].sort(byDate).slice(-keep);
}

function monthToDate(days, today) {
  const month = today.slice(0, 7);
  const inMonth = days.filter((d) => d.date.startsWith(month) && d.date <= today);
  return inMonth.length ? { month, from: inMonth[0].date, days: inMonth.length, usd: round(sum(inMonth.map((d) => d.usd || 0)), 4) } : { month, from: null, days: 0, usd: null };
}

/**
 * Build ops.json.
 *   usage: { rows, error }       Logs Insights result (rows null when the query failed)
 *   cost:  { rows, error, pulledAt } | null   Cost Explorer pull, null when not pulled this run (the earlier AWS days stay)
 *   readers: the daily pull from readers.pullReaders, null when not due this run (the earlier readers section stays)
 *   quality: the daily pull from quality.pullQuality, null when not due this run (the earlier quality section stays; null when never built)
 *   raw:   per-day facts from buildHealth (run counts, country notes, daily brief)
 */
function buildOps({ usage, cost, readers: readersPull, quality: qualityPull = null, raw, prices, prev, now }) {
  const window = lastDays(now, CONFIG.days);
  const today = window[window.length - 1];
  const keep = CONFIG.retainOpsDays;
  const p = prev || {};

  let dsDays = (p.deepseek && p.deepseek.days) || [];
  let unitDays = (p.unitCosts && p.unitCosts.days) || [];
  if (usage.rows) {
    const perDay = usageDays(usage.rows, prices, window);
    // No usage line at all for a day means no data (log retention, or an outage), not a free day.
    dsDays = mergeDays(dsDays, window.map((d) => ({ date: d, usd: perDay[d].length ? linesUsd(perDay[d]) : null, lines: perDay[d] })), keep);
    unitDays = mergeDays(unitDays, window.map((d) => unitCostsFor(d, perDay[d], raw[d])), keep);
  }
  const unpriced = [...new Set(dsDays.flatMap((d) => d.lines.filter((l) => l.usd == null).map((l) => l.model)))].sort();

  const weeks = {};
  for (const d of dsDays) {
    const w = isoWeek(d.date);
    weeks[w] = (weeks[w] || 0) + matchUsd(d.lines, CONFIG.weeklyReview.fn, null);
  }
  const yesterday = dayOf(Date.parse(`${today}T00:00:00Z`) - 86400000);

  const pAws = p.aws || {};
  let awsDaysOut = pAws.days || [];
  let pulledAt = pAws.pulledAt || null;
  let awsError = pAws.error || null;
  if (cost) {
    if (cost.rows) { awsDaysOut = mergeDays(awsDaysOut, awsDays(cost.rows), keep); pulledAt = cost.pulledAt; awsError = null; }
    else awsError = cost.error;
  }

  const dsYesterday = dsDays.find((d) => d.date === yesterday);
  const awsYesterday = awsDaysOut.find((d) => d.date === yesterday);
  return {
    schemaVersion: 1,
    asOf: new Date(now).toISOString(),
    producer: 'newsHealth',
    deepseek: {
      estimate: true,
      method: 'tokens from the [usage] log lines, priced hour by hour (peak and off-peak) with src/prices.json',
      pricesSource: prices.source, pricesFetchedAt: prices.fetchedAt,
      error: usage.error || null,
      yesterday: dsYesterday ? { date: yesterday, usd: dsYesterday.usd } : null,
      monthToDate: monthToDate(dsDays, today),
      unpriced,
      days: dsDays,
    },
    aws: {
      source: 'Cost Explorer GetCostAndUsage, UnblendedCost, daily by service',
      pulledAt, error: awsError,
      yesterday: awsYesterday ? { date: yesterday, usd: awsYesterday.usd } : null,
      monthToDate: monthToDate(awsDaysOut, today),
      days: awsDaysOut,
    },
    readers: buildReaders({ pull: readersPull, prev, dsDays, now }),
    quality: buildQuality({ pull: qualityPull, prev, now }),
    unitCosts: {
      labels: Object.fromEntries(Object.entries(CONFIG.units).map(([id, u]) => [id, u.label])),
      days: unitDays,
      weeklyReview: Object.entries(weeks).filter(([, usd]) => usd > 0).sort().slice(-8).map(([week, usd]) => ({ week, usd: round(usd, 4) })),
    },
  };
}

/** True when the AWS cost pull is due: never pulled, or the last pull was on an earlier UTC day. */
const awsPullDue = (prev, now) => !(prev && prev.aws && prev.aws.pulledAt) || prev.aws.pulledAt.slice(0, 10) < dayOf(now);

module.exports = { buildOps, usageDays, unitCostsFor, awsDays, mergeDays, monthToDate, awsPullDue };
