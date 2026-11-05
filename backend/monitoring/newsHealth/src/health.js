'use strict';

// The pipeline panel: one row per stage per UTC day, facts only. Every row names its source and the time of that source.
// A source that cannot be read gives status 'nodata' with the error text, never a made-up value.
// Statuses: ok | thin (degraded) | missing | failed | nodata | recovered (the agent row only: a day rebuilt from public records, phase 4).
//
// Ports (all injected, so tests run offline):
//   readText(key)                  -> { text, at } | null (no such key); throws on any other failure
//   resolverStatus()               -> the resolver's {action:'status'} reply; throws on failure
//   lambdaErrors(days)             -> { [fn]: { [day]: n } }; throws on failure
//   compareCounts(days)            -> { [fn]: { [day]: n } } (DIFFER lines); throws on failure
const { CONFIG, KEYS, STAGES } = require('./config');
const { lastDays, isClosed, isSunday } = require('./days');
const { readJson, readLines, errText } = require('./healthRead');
const { healFacts, ledgerKey } = require('./heal');

const row = (stage, status, { facts = {}, source, at = null, error = null, note = null } = {}) => ({ stage, status, facts, source, at, error, note });
const nodata = (stage, source, { error = null, note = null } = {}) => row(stage, 'nodata', { source, error, note });

/** A day still open cannot be judged missing or thin. */
const open = (stage, source, facts) => row(stage, 'nodata', { facts, source, note: 'day in progress' });

function ingestRow(day, closed, run) {
  const source = `record/runs/${day}.json inputs.rawDay`;
  if (run.error) return nodata('ingest', source, { error: run.error });
  if (run.missing) return closed ? nodata('ingest', source, { note: 'no record run file for this day' }) : open('ingest', source, {});
  const raw = run.json.inputs && run.json.inputs.rawDay;
  return row('ingest', raw === 'present' ? 'ok' : 'missing', { facts: { rawDay: raw || null }, source, at: run.json.finishedAt || run.at });
}

function agentRow(day, closed, entries, heal = null) {
  const source = `record/inbox/entries/${day}.jsonl (line count)`;
  if (entries.error) return nodata('agent', source, { error: entries.error });
  const n = entries.missing ? 0 : entries.lines;
  const facts = { entries: n, normalRange: [CONFIG.entries.normalLow, CONFIG.entries.normalHigh], thinBelow: CONFIG.entries.thin };
  const L = heal && heal.json ? heal.json : null;
  const hf = healFacts(L);
  if (hf) facts.heal = hf;
  // A day the self-healing rebuilt from public records: raw articles only, no entries and no forecasts (decision 0040). Never 'ok'.
  if (L && L.outcome === 'recovered' && n < CONFIG.entries.thin) {
    return row('agent', 'recovered', { facts, source: `${source} + ${ledgerKey(day)}`, at: L.outcomeAt || null,
      note: `Recovered from public records: ${L.recovered && L.recovered.articles != null ? `${L.recovered.articles} raw articles` : 'raw articles'} (GDELT GKG, Wayback); the model did not run for this day, so there are no story entries and no forecasts.` });
  }
  const healNote = L ? `Self-healing: ${L.outcome ? `${L.outcome}${L.why ? `, ${L.why}` : ''}` : 'in progress'}.`
    : heal && heal.error && n < CONFIG.entries.thin ? `Self-healing ledger unreadable: ${heal.error}` : null;
  if (n >= CONFIG.entries.thin) return row('agent', 'ok', { facts, source, at: entries.at || null, note: L && L.outcome === 'healed' ? healNote : null });
  if (!closed) return { ...open('agent', source, facts), note: healNote ? `day in progress. ${healNote}` : 'day in progress' };
  return row('agent', n === 0 ? 'missing' : 'thin', { facts, source, at: entries.at || null, note: healNote });
}

function recordRow(day, closed, run) {
  const source = `record/runs/${day}.json`;
  if (run.error) return nodata('record', source, { error: run.error });
  if (run.missing) return closed ? row('record', 'missing', { source, note: 'no run file' }) : open('record', source, {});
  const r = run.json;
  const failures = Array.isArray(r.failures) ? r.failures : [];
  const status = r.status === 'ok' && !failures.length ? 'ok' : r.status === 'partial' ? 'thin' : 'failed';
  return row('record', status, {
    facts: { runStatus: r.status || null, counts: r.counts || null, failures: failures.map((f) => `${f.stage}: ${String(f.message || '').slice(0, 120)}`) },
    source, at: r.finishedAt || run.at,
  });
}

function viewsRow(day, today, manifest, now) {
  const source = KEYS.manifest;
  if (manifest.error) return nodata('views', source, { error: manifest.error });
  if (manifest.missing) return nodata('views', source, { note: 'manifest not generated' });
  const m = manifest.json;
  const through = m.provisionalThrough || m.factsThrough;
  const builtAgeH = m.builtAt ? (new Date(now).getTime() - Date.parse(m.builtAt)) / 3600000 : null;
  const facts = { builtAt: m.builtAt || null, factsThrough: m.factsThrough || null, provisionalThrough: m.provisionalThrough || null };
  if (!through || day > through) return row('views', 'missing', { facts, source, at: m.builtAt || null, note: `views run to ${through || 'unknown'}` });
  const stale = day === today && builtAgeH != null && builtAgeH > CONFIG.viewsStaleHours;
  return row('views', stale ? 'thin' : 'ok', { facts, source, at: m.builtAt || null, note: stale ? `last build ${Math.round(builtAgeH)} h ago` : null });
}

function situationsRow(world, now) {
  const source = KEYS.world;
  if (world.error) return nodata('situations', source, { error: world.error });
  if (world.missing) return nodata('situations', source, { note: 'world/latest.json not found' });
  const w = world.json;
  const list = Array.isArray(w.situations) ? w.situations : [];
  const src = w.sources || {};
  const ageH = w.generated_at ? (new Date(now).getTime() - Date.parse(w.generated_at)) / 3600000 : null;
  const facts = {
    generatedAt: w.generated_at || null, ageHours: ageH == null ? null : Math.round(ageH * 10) / 10,
    stale: Boolean(w.stale), newsDegraded: Boolean(src.newsDegraded), gdacsDegraded: Boolean(src.gdacsDegraded),
    open: list.filter((s) => s.state !== 'closed').length, total: list.length,
  };
  let status = 'ok';
  if (ageH == null || ageH > CONFIG.situations.failedAfterHours) status = 'failed';
  else if (ageH > CONFIG.situations.thinAfterHours || facts.stale || facts.newsDegraded || facts.gdacsDegraded) status = 'thin';
  return row('situations', status, { facts, source, at: w.generated_at || world.at });
}

/** The row for the day of the resolver's last tick (the heartbeat object `h`); `status` (the live status reply) only for today. */
function resolverRow(h, status) {
  const source = `${KEYS.heartbeat} + resolver status action`;
  const due = status && typeof status.due === 'number' ? status.due : null;
  const facts = { tickAt: h.at, committed: h.committed, drawn: h.drawn, drafted: h.drafted, settled: h.settled, errors: h.errors, due, sampled: status ? status.sampled : null, verdicts: status ? status.verdicts : null };
  let st = 'ok';
  if (h.errors > 0) st = 'failed';
  else if (due > 0 && h.settled === 0) st = 'thin';
  return row('resolver', st, { facts, source, at: h.at });
}

function briefsRow(day, closed, daily, weekly) {
  const sunday = isSunday(day);
  const source = `record/notes/daily_brief/${day}.jsonl${sunday ? ` + record/notes/weekly_brief/${day}.jsonl` : ''}`;
  const err = daily.error || (sunday && weekly && weekly.error);
  if (err) return nodata('briefs', source, { error: err });
  const facts = { daily: !daily.missing, weekly: sunday ? !weekly.missing : null };
  if (facts.daily && (!sunday || facts.weekly)) return row('briefs', 'ok', { facts, source, at: daily.at || null });
  return closed ? row('briefs', 'missing', { facts, source }) : open('briefs', source, facts);
}

/** Per-function counts for the days, folded to one row per day. */
function countRows(stage, byFn, days, { thinAt, failedAt }, source) {
  const out = {};
  for (const day of days) {
    const per = {};
    let total = 0;
    for (const [fn, byDay] of Object.entries(byFn)) {
      const n = byDay[day] || 0;
      if (n) { per[fn] = n; total += n; }
    }
    out[day] = row(stage, total >= failedAt ? 'failed' : total >= thinAt ? 'thin' : 'ok', { facts: { total, byFunction: per }, source });
  }
  return out;
}

/**
 * Build health.json. `prev` is the previous health.json (or null): snapshot stages (resolver, situations) cannot be
 * recomputed for a past day, so a closed day keeps the row last written for it.
 * Returns { health, raw } where raw[day] holds the facts the money panel needs (run counts, country notes, brief).
 */
async function buildHealth(ports, now, prev = null) {
  const days = lastDays(now, CONFIG.days);
  const today = days[days.length - 1];

  const [manifest, world, heartbeat] = await Promise.all([readJson(ports, KEYS.manifest), readJson(ports, KEYS.world), readJson(ports, KEYS.heartbeat)]);
  const perDay = await Promise.all(days.map(async (day) => {
    const [run, entries, daily, weekly, country, heal] = await Promise.all([
      readJson(ports, `record/runs/${day}.json`),
      readLines(ports, `record/inbox/entries/${day}.jsonl`),
      readLines(ports, `record/notes/daily_brief/${day}.jsonl`),
      isSunday(day) ? readLines(ports, `record/notes/weekly_brief/${day}.jsonl`) : Promise.resolve(null),
      readLines(ports, `record/notes/country/${day}.jsonl`),
      readJson(ports, ledgerKey(day)),
    ]);
    return { day, run, entries, daily, weekly, country, heal };
  }));

  let resolverStatus = null; let resolverStatusError = null;
  try { resolverStatus = await ports.resolverStatus(); } catch (e) { resolverStatusError = errText(e); }
  let errors = null; let errorsError = null;
  try { errors = await ports.lambdaErrors(days); } catch (e) { errorsError = errText(e); }
  let compare = null; let compareError = null;
  try { compare = await ports.compareCounts(days); } catch (e) { compareError = errText(e); }

  const errorsSource = 'CloudWatch AWS/Lambda Errors (Sum per day, news* functions)';
  const compareSource = 'CloudWatch Logs Insights: DIFFER lines in the step-5d groups, newsAgent, newsEmailSender';
  const errorRows = errors ? countRows('errors', errors, days, CONFIG.errors, errorsSource) : null;
  const compareRows = compare ? countRows('compare', compare, days, CONFIG.compare, compareSource) : null;
  const prevRow = (day, stage) => {
    const d = prev && Array.isArray(prev.days) ? prev.days.find((x) => x.date === day) : null;
    return d && Array.isArray(d.rows) ? d.rows.find((r) => r.stage === stage) || null : null;
  };
  const tickDay = heartbeat.json && heartbeat.json.at ? heartbeat.json.at.slice(0, 10) : null;

  const raw = {};
  const outDays = perDay.map(({ day, run, entries, daily, weekly, country, heal }) => {
    const closed = isClosed(day, now, CONFIG.closeAfterUtcHour);
    const carry = (stage) => (day === today ? null : prevRow(day, stage));

    let resolver;
    if (tickDay === day) resolver = resolverRow(heartbeat.json, day === today ? resolverStatus : null);
    else resolver = carry('resolver');
    if (!resolver) {
      if (heartbeat.error) resolver = nodata('resolver', KEYS.heartbeat, { error: heartbeat.error });
      else if (heartbeat.missing) resolver = nodata('resolver', KEYS.heartbeat, { note: 'no heartbeat object' });
      else resolver = nodata('resolver', KEYS.heartbeat, { note: day === today ? 'no tick yet today' : 'no snapshot was kept for this day', error: day === today ? resolverStatusError : null });
    }
    const situations = day === today ? situationsRow(world, now)
      : carry('situations') || nodata('situations', KEYS.world, { note: 'no snapshot was kept for this day' });

    const rows = [
      ingestRow(day, closed, run),
      agentRow(day, closed, entries, heal),
      recordRow(day, closed, run),
      viewsRow(day, today, manifest, now),
      resolver,
      situations,
      briefsRow(day, closed, daily, weekly),
      errorRows ? errorRows[day] : nodata('errors', errorsSource, { error: errorsError }),
      compareRows ? compareRows[day] : nodata('compare', compareSource, { error: compareError }),
    ];
    raw[day] = {
      counts: run.json ? run.json.counts || null : null,
      countryNotes: country.lines == null ? null : country.lines,
      dailyBrief: daily.error ? null : (daily.missing ? 0 : 1),
    };
    return { date: day, closed, rows };
  });

  const health = {
    schemaVersion: 1,
    asOf: new Date(now).toISOString(),
    producer: 'newsHealth',
    stages: STAGES.map((s) => ({ ...s })),
    days: outDays,
    now: {
      resolver: resolverStatus
        ? { sampled: resolverStatus.sampled, due: resolverStatus.due, drafted: resolverStatus.drafted, verdicts: resolverStatus.verdicts, commits: Array.isArray(resolverStatus.commits) ? resolverStatus.commits.length : null, error: null }
        : { error: resolverStatusError },
    },
  };
  return { health, raw };
}

module.exports = { buildHealth, ingestRow, agentRow, recordRow, viewsRow, situationsRow, resolverRow, briefsRow, countRows };
