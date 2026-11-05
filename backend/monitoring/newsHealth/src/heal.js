'use strict';

// Self-healing (ARCHITECTURE_OPS.md phase 4). Runs at the start of every hourly tick, before health.json is built.
//
// A UTC day D whose archive (record/inbox/entries/D.jsonl) has no line is healed in two steps, each at most once per day:
//   1. 21:00-23:00 UTC of D (after the 20:25 agent run is long over, before the 23:45 record run): re-run the agent once. If the staging
//      topics are not today's, re-run the ingest first (one tick), the agent follows on the next tick.
//   2. From D+1 00:30 UTC, if D is still empty: rebuild D's raw articles from public records (newsRecover), then build the record's day
//      from them (newsStoryRecord {recovery:true}). The day is then marked `recovered`: raw articles only, no entries, no forecasts.
// It never fires inside a scheduled run (04, 12, 20 UTC slots) or the 23:45 record run, never twice for one step of one day, and never
// invents anything: a recovered day is exactly what newsRecover read from GDELT and Wayback.
//
// State is one small file per day, monitoring/heal/DAY.json (the ledger). The ledger is written BEFORE each Lambda is invoked, so a
// failed write means no invoke, and a failed invoke still counts as the day's attempt: nothing here can loop.
//
// Ports (injected): readText(key), putJson(key, obj), invoke(functionName, payload) (asynchronous), staging() -> {generationId, updatedAt,
// agentProcessedAt} | null.
const { HEAL, KEYS } = require('./config');
const { dayOf, dayStart, DAY_MS } = require('./days');
const { readJson, readLines } = require('./healthRead');

const MIN = 60000;
const errText = (e) => String((e && e.message) || e).slice(0, 200);
const iso = (ms) => new Date(ms).toISOString();
const hhmm = (ms) => iso(ms).slice(11, 16);

const ledgerKey = (day) => `${KEYS.healPrefix}${day}.json`;
const recoverKey = (day) => `${KEYS.healPrefix}recover/${day}.json`;

const minuteOfDay = (t) => (t - dayStart(dayOf(t))) / MIN;

/** True inside one of the scheduled runs (ingest :15 and agent :25 of 04/12/20 UTC with the time they may take, the record refreshes at
 *  :35, the 23:45 record run): the healer starts nothing there. */
function inScheduledWindow(t, cfg = HEAL) {
  const m = minuteOfDay(t);
  return cfg.quiet.some(([from, to]) => (from <= to ? m >= from && m <= to : m >= from || m <= to));
}

/** The agent step may be started in [21:00, 23:00) UTC of the day itself, outside every scheduled window. */
function inAgentWindow(day, t, cfg = HEAL) {
  if (dayOf(t) !== day) return false;
  const m = minuteOfDay(t);
  return m >= cfg.agentFromMin && m < cfg.agentToMin && !inScheduledWindow(t, cfg);
}

/** When the ingest wrote the staging item (the agent's own rule: `gen-<ms>`, else updatedAt). */
function generationTime(item) {
  const m = /^gen-(\d{13})$/.exec(String((item && item.generationId) || ''));
  const v = m ? Number(m[1]) : Date.parse((item && item.updatedAt) || '');
  return Number.isFinite(v) ? v : null;
}

/** Fresh staging for the day = generated on that UTC day and not yet processed. Returns { fresh, why }. */
function stagingState(item, day) {
  if (!item) return { fresh: false, why: 'no staging item' };
  const g = generationTime(item);
  if (g === null) return { fresh: false, why: 'staging has no generation time' };
  if (dayOf(g) !== day) return { fresh: false, why: `staging was generated ${iso(g).slice(0, 16)}Z, not on ${day}` };
  if (item.agentProcessedAt) return { fresh: false, why: 'staging was already processed and the archive is still empty' };
  return { fresh: true, why: null, generationId: item.generationId || null };
}

const newLedger = (day, t) => ({ schemaVersion: 1, day, createdAt: iso(t), outcome: null, outcomeAt: null, ingest: null, agent: null, recovery: null, record: null, events: [] });

function note(L, t, step, text) {
  L.events.push({ at: iso(t), step, note: text });
  if (L.events.length > 30) L.events.splice(0, L.events.length - 30);
}

/** What newsHealth shows of a ledger (health.json facts and the /ops detail card). */
function healFacts(L) {
  if (!L) return null;
  const rec = L.recovery;
  const last = rec && rec.attempts && rec.attempts[rec.attempts.length - 1];
  return {
    outcome: L.outcome || 'in progress',
    ingestRerunAt: (L.ingest && L.ingest.invokedAt) || null,
    agentRerunAt: (L.agent && L.agent.invokedAt) || null,
    agent: (L.agent && (L.agent.outcome || (L.agent.invokedAt ? 'running' : null))) || null,
    recoveryAttempts: rec ? rec.attempts.length : 0,
    recoveryStatus: (last && last.result && last.result.status) || (last ? 'running' : null),
    recoveredArticles: (L.recovered && L.recovered.articles) || null,
    recordRunAt: (L.record && L.record.invokedAt) || null,
    why: L.why || null,
  };
}

/**
 * One day. Returns nothing; pushes what it did (or, in dry mode, would do) onto `out.actions`, anything it could not read onto `out.skipped`.
 */
async function healDay(day, { now, ports, mode, cfg, out }) {
  const entries = await readLines(ports, `record/inbox/entries/${day}.jsonl`);
  if (entries.error) { out.skipped.push({ day, why: `entries unreadable: ${entries.error}` }); return; }
  const n = entries.missing ? 0 : entries.lines;
  const led = await readJson(ports, ledgerKey(day));
  if (led.error) { out.skipped.push({ day, why: `ledger unreadable: ${led.error}` }); return; }
  let L = led.json || null;
  if (L && L.outcome) return;                                // settled: never touched again

  const d0 = dayStart(day);
  const d1 = d0 + DAY_MS;
  const live = mode === 'on';
  const key = ledgerKey(day);

  const save = async () => { if (live) await ports.putJson(key, L, 'no-cache'); };
  const record = (step, fn, payload, text) => out.actions.push({ day, step, fn: fn || null, payload: payload || null, note: text, dry: !live });
  /** Mark the attempt in the ledger, write the ledger, then invoke. A throwing ledger write means no invoke; a throwing invoke is kept in the ledger. */
  const act = async (step, fn, payload, mark, text) => {
    L = L || newLedger(day, now);
    const slot = mark(L);
    note(L, now, step, text);
    if (live) {
      await save();
      try { await ports.invoke(fn, payload); } catch (e) { slot.error = errText(e); note(L, now, step, `invoke failed: ${slot.error}`); await save(); }
    }
    record(step, fn, payload, text);
  };
  const settle = async (outcome, why, extra = {}) => {
    L = L || newLedger(day, now);
    Object.assign(L, { outcome, outcomeAt: iso(now), why }, extra);
    note(L, now, 'outcome', `${outcome}: ${why}`);
    await save();
    record('outcome', null, null, `${outcome}: ${why}`);
  };

  // ---- the day has an archive ----
  if (n > 0) {
    if (L && !L.outcome) {
      const byRerun = L.agent && L.agent.invokedAt && entries.at && Date.parse(entries.at) >= Date.parse(L.agent.invokedAt);
      await settle('healed', byRerun ? `the agent re-run at ${hhmm(Date.parse(L.agent.invokedAt))} UTC wrote ${n} entries` : `${n} entries appeared without a re-run`);
    }
    return;
  }

  const closed = now >= d1;

  // ---- step 1: the agent (and, if its staging is not today's, the ingest first) ----
  if (!closed) {
    if (L && L.agent && L.agent.outcome) return;
    if (L && L.agent && L.agent.invokedAt) {
      if (now - Date.parse(L.agent.invokedAt) >= cfg.inflightMin * MIN) {
        L.agent.outcome = 'no_archive';
        L.agent.why = `the archive is still empty ${Math.round((now - Date.parse(L.agent.invokedAt)) / MIN)} min after the re-run`;
        note(L, now, 'agent', L.agent.why);
        await save();
        record('agent', null, null, L.agent.why);
      }
      return;
    }
    if (!inAgentWindow(day, now, cfg)) return;
    if (L && L.ingest && L.ingest.invokedAt && now - Date.parse(L.ingest.invokedAt) < cfg.inflightMin * MIN) return;
    let item;
    try { item = await ports.staging(); } catch (e) { out.skipped.push({ day, why: `staging unreadable: ${errText(e)}` }); return; }
    const st = stagingState(item, day);
    if (st.fresh) {
      await act('agent', cfg.functions.agent, {}, (l) => (l.agent = { invokedAt: iso(now), outcome: null, staging: st.generationId }), `agent re-run (archive empty, staging ${st.generationId} is fresh)`);
    } else if (!L || !L.ingest) {
      await act('ingest', cfg.functions.ingest, {}, (l) => (l.ingest = { invokedAt: iso(now), reason: st.why }), `ingest re-run (${st.why}); the agent follows on the next tick`);
    } else {
      L.agent = { invokedAt: null, outcome: 'skipped', why: `the ingest re-run left no fresh staging (${st.why})` };
      note(L, now, 'agent', L.agent.why);
      await save();
      record('agent', null, null, L.agent.why);
    }
    return;
  }

  // ---- the day is closed: settle step 1, then step 2 ----
  L = L || newLedger(day, now);
  if (!L.agent) {
    L.agent = { invokedAt: null, outcome: 'not_attempted', why: L.ingest ? 'the window closed after the ingest re-run' : 'the healer did not run the agent in the 21:00-23:00 UTC window' };
    note(L, now, 'agent', L.agent.why);
    await save();
  } else if (!L.agent.outcome) {
    L.agent.outcome = 'no_archive';
    L.agent.why = L.agent.why || 'the archive was still empty when the day closed';
    await save();
  }
  if (now < d1 + cfg.recoverFromMin * MIN) return;
  if (now >= d1 + cfg.recoverUntilHours * 3600000) { await settle('unhealed', `no recovery within ${cfg.recoverUntilHours} h of the day closing`); return; }
  const quiet = inScheduledWindow(now, cfg);

  const rec = L.recovery || (L.recovery = { attempts: [] });
  const last = rec.attempts[rec.attempts.length - 1];
  if (last && !last.result) {
    const res = await readJson(ports, recoverKey(day));
    if (res.error) { out.skipped.push({ day, why: `recovery result unreadable: ${res.error}` }); return; }
    const fresh = res.json && Date.parse(res.json.startedAt) >= Date.parse(last.invokedAt) - MIN;
    if (fresh) {
      const r = res.json;
      last.result = { status: r.status, error: r.error || null, finishedAt: r.finishedAt || null, appended: (r.counts && r.counts.appended) || 0, inboxLines: (r.counts && r.counts.inboxLines) || 0, gkg: (r.gkg && r.gkg.status) || null, failureCount: r.failureCount || 0 };
    } else if (now - Date.parse(last.invokedAt) >= cfg.inflightMin * MIN) {
      last.result = { status: 'error', error: `no result file ${Math.round((now - Date.parse(last.invokedAt)) / MIN)} min after the invoke${last.error ? ` (${last.error})` : ''}`, inboxLines: 0 };
    } else return;                                           // still running
    note(L, now, 'recovery', `attempt ${rec.attempts.length}: ${last.result.status}, ${last.result.inboxLines} articles in the day file`);
    await save();
  }

  const usable = last && last.result && ['ok', 'partial'].includes(last.result.status) && last.result.inboxLines >= cfg.minArticles;
  if (!usable) {
    const retry = !last || (last.result.status !== 'ok' && last.result.status !== 'refused');
    if (last && (!retry || rec.attempts.length >= cfg.recoverAttempts)) {
      const r = last.result;
      await settle('unhealed', r.status === 'ok' || r.status === 'partial'
        ? `public records gave ${r.inboxLines} articles, under the ${cfg.minArticles} that make a day`
        : `recovery ${r.status}${r.error ? `: ${r.error}` : ''} after ${rec.attempts.length} attempt(s)`);
      return;
    }
    if (quiet) return;
    await act('recovery', cfg.functions.recover, { day }, (l) => { const a = { invokedAt: iso(now), result: null }; l.recovery.attempts.push(a); return a; }, `recovery attempt ${rec.attempts.length + 1} of ${cfg.recoverAttempts} from public records (GDELT GKG, Wayback)`);
    return;
  }

  // the articles are in the inbox: build the record's day from them
  if (!L.record) {
    if (quiet) return;
    await act('record', cfg.functions.record, { recovery: true, date: day }, (l) => (l.record = { invokedAt: iso(now), attempts: 1 }), `record run for ${day} from the recovered articles (newsStoryRecord recovery)`);
    return;
  }
  const run = await readJson(ports, `record/runs/${day}.json`);
  if (run.error) { out.skipped.push({ day, why: `run file unreadable: ${run.error}` }); return; }
  const r = run.json;
  const mine = r && /recovery/.test(r.notes || '') && r.inputs && r.inputs.recovered === true && Date.parse(r.finishedAt) >= Date.parse(L.record.invokedAt) - MIN;
  if (mine && r.status === 'ok' && !(r.failures || []).length) {
    await settle('recovered', `${last.result.inboxLines} raw articles from public records, record run ${r.runId || ''}`.trim(), { recovered: { articles: last.result.inboxLines, appended: last.result.appended, gkg: last.result.gkg, recordRunId: r.runId || null } });
    return;
  }
  const waited = now - Date.parse(L.record.invokedAt) >= cfg.inflightMin * MIN;
  if (!mine && !waited) return;
  if (L.record.attempts >= cfg.recordAttempts) {
    await settle('unhealed', mine ? `the recovery record run ended ${r.status}${(r.failures || []).length ? ` with ${(r.failures || []).length} failure(s)` : ''}` : `newsStoryRecord left no recovery run for ${day}`);
    return;
  }
  if (quiet) return;
  await act('record', cfg.functions.record, { recovery: true, date: day }, (l) => { l.record.attempts += 1; l.record.invokedAt = iso(now); return l.record; }, `record run for ${day}, attempt ${L.record.attempts + 1}`);
}

/**
 * The self-healing pass. mode: 'off' (nothing), 'dry' (decide and report, write and invoke nothing), 'on'.
 * -> { mode, at, actions: [{ day, step, fn, payload, note, dry }], skipped: [{ day, why }], errors: [] }. Never throws: a day that fails is listed in errors.
 */
async function heal({ ports, now = Date.now(), mode = HEAL.mode, cfg = HEAL } = {}) {
  const out = { mode, at: iso(now), actions: [], skipped: [], errors: [] };
  if (mode !== 'on' && mode !== 'dry') return { ...out, mode: 'off' };
  const today = dayOf(now);
  for (let i = cfg.lookbackDays; i >= 0; i -= 1) {
    const day = dayOf(dayStart(today) - i * DAY_MS);
    try { await healDay(day, { now, ports, mode, cfg, out }); } catch (e) { out.errors.push({ day, error: errText(e) }); }
  }
  return out;
}

const MODES = ['off', 'dry', 'on'];
/** The lower of the configured mode and a flag (an unknown value counts as off): a test invoke or a dry run can never turn healing up. */
function effectiveMode(configured, flag) {
  const rank = (m) => Math.max(0, MODES.indexOf(m));
  return MODES[Math.min(rank(configured), flag == null ? 2 : rank(flag))];
}

/** The part of a heal pass that goes into health.json `now.heal` (the public file): what ran, nothing about the ledger's internals. */
function healSummary(h) {
  return { mode: h.mode, at: h.at, actions: h.actions.map((a) => ({ day: a.day, step: a.step, note: a.note, dry: a.dry })), skipped: h.skipped, errors: h.errors };
}

module.exports = { effectiveMode, healSummary, heal, healDay, healFacts, ledgerKey, recoverKey, inScheduledWindow, inAgentWindow, stagingState, generationTime };
