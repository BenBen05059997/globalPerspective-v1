'use strict';

// S1 SELECT + ASSEMBLE (no model). Reads the views and facts of the record and builds one bundle per
// story for the week. Every fact in a bundle carries its eventId so the model can cite it and the check can verify it.
const {weekRange, weekBefore, daysBetween} = require('./week');
const {ordered, placeEntries} = require('./_shared/placement'); // the one placement rule of views and the resolver

const ENTRY_CAP = 60; // entries per bundle: the newest 60
const FORK_CAP = 10; // forks per bundle: the newest 10
const NEIGHBOURS = 5; // other stories shown to the model for links and merges
const NEIGHBOUR_ENTRIES = 3;
const READINGS_LOOKBACK_WEEKS = 8; // earlier reading files read back (there is no listing of record/readings)
const SPECIFIC_SHARE = 0.05; // same constant and meaning as views.js (decision 0037, links rule)
const NEAR_DAYS = 14;
const READ_BATCH = 10;
const FACT_KINDS = new Set(['entry', 'forecast_drawn', 'verdict', 'correction', 'story_merged', 'article']);
const LOAD_KINDS = new Set([...FACT_KINDS, 'assignment']); // assignments are read to place entries and articles, then dropped
const RECOVERED_NOTE = '[recovered headline, no text]';

const LEGACY_VOID = 'issued_before_method';
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at < b.at ? -1 : a.at > b.at ? 1 : a.eventId < b.eventId ? -1 : 1);

/** Everything the week needs from the record: views, facts up to the week's last day, operator aliases, readings. */
async function loadWorld({store, prefix, week}) {
  const {to} = weekRange(week);
  const manifest = await store.getJson(`${prefix}views/manifest.json`);
  if (!manifest || !manifest.factsThrough || manifest.factsThrough < to) {
    throw new Error(`views not built through ${to} (manifest factsThrough ${manifest ? manifest.factsThrough : 'missing'})`);
  }
  const active = await store.getJson(`${prefix}views/index/active.json`);
  if (!active || !Array.isArray(active.stories)) throw new Error('record/views/index/active.json is missing');
  const factsManifest = await store.getJson(`${prefix}facts/manifest.json`);
  const days = (factsManifest && Array.isArray(factsManifest.days) ? factsManifest.days : []).filter((d) => d <= to).sort();
  const loaded = [];
  for (let i = 0; i < days.length; i += READ_BATCH) {
    const parts = await Promise.all(days.slice(i, i + READ_BATCH).map((d) => store.getLines(`${prefix}facts/${d}.jsonl`)));
    for (const f of parts.flat()) if (LOAD_KINDS.has(f.kind) && f.date <= to) loaded.push(f);
  }
  // Entries and articles sit on the thread of their latest assignment; an unassigned article has no thread and drops out here.
  const factsByThread = new Map();
  for (const f of placeEntries(ordered(loaded)).placed) {
    if (!f.threadId || !FACT_KINDS.has(f.kind)) continue;
    (factsByThread.get(f.threadId) || factsByThread.set(f.threadId, []).get(f.threadId)).push(f);
  }
  const operator = await store.getJson(`${prefix}operator/aliases.json`);
  const operatorAliases = operator && Array.isArray(operator.aliases) ? operator.aliases : [];
  const readings = await loadReadings({store, prefix, week});
  return {week, range: weekRange(week), manifest, rows: active.stories.filter((r) => !r.aliasOf), factsByThread, operatorAliases, ...readings, prefix};
}

/** Earlier readings (up to READINGS_LOOKBACK_WEEKS weeks) and the stored file of this week, if any. */
async function loadReadings({store, prefix, week}) {
  const earlier = [];
  for (let n = 1; n <= READINGS_LOOKBACK_WEEKS; n += 1) {
    const w = weekBefore(week, n);
    earlier.push(...(await store.getLines(`${prefix}readings/${w}.jsonl`)));
  }
  const thisWeek = await store.getLines(`${prefix}readings/${week}.jsonl`);
  return {earlierReadings: earlier, thisWeekReadings: thisWeek};
}

/** (subtype, key) of a reading: what a later reading of the same thing supersedes. */
function keyOf(subtype, payload) {
  if (subtype === 'line') return '';
  if (subtype === 'chapter') return payload.from;
  if (subtype === 'branch_status') return payload.branchId;
  if (subtype === 'link' || subtype === 'merge_proposal') return payload.otherThreadId;
  if (subtype === 'alias') return payload.canonical;
  if (subtype === 'assignment') return payload.entryId;
  throw new Error(`unknown reading subtype ${subtype}`);
}

/** The newest earlier reading per (threadId, subtype, key). */
function latestEarlier(readings) {
  const latest = new Map();
  for (const r of readings) {
    const k = `${r.threadId}|${r.subtype}|${keyOf(r.subtype, r.payload)}`;
    const cur = latest.get(k);
    if (!cur || r.week >= cur.week) latest.set(k, r);
  }
  return latest;
}

/** Share of active stories that carry an actor id / an iso3. */
function shareIndex(rows) {
  const counts = {actorIds: new Map(), iso3: new Map()};
  for (const r of rows) {
    for (const kind of ['actorIds', 'iso3']) for (const v of new Set(r[kind] || [])) counts[kind].set(v, (counts[kind].get(v) || 0) + 1);
  }
  return (kind, v) => (counts[kind].get(v) || 0) / (rows.length || 1);
}
const isSpecific = (share, kind, v) => share(kind, v) < SPECIFIC_SHARE;

/** The facts of a story: its own and those of the stories merged into it (the row's aliases). */
const factsOf = (world, row) => [row.threadId, ...(row.aliases || [])].flatMap((id) => world.factsByThread.get(id) || []).sort(byDate);

/** Which stories to read this week and which to skip (with the reason). */
function selectStories(world, {threadIds} = {}) {
  const lastCover = new Map();
  for (const r of world.earlierReadings) if (r.covers && r.covers.to > (lastCover.get(r.threadId) || '')) lastCover.set(r.threadId, r.covers.to);
  const selected = [];
  const skipped = [];
  for (const row of world.rows) {
    if (threadIds && !threadIds.includes(row.threadId)) continue;
    const facts = factsOf(world, row);
    if (!facts.length) { skipped.push({threadId: row.threadId, reason: 'no_facts_by_week_end'}); continue; }
    const since = lastCover.get(row.threadId);
    if (since) {
      const fresh = facts.some((f) => (f.kind === 'entry' || f.kind === 'verdict') && f.date > since);
      if (!fresh) { skipped.push({threadId: row.threadId, reason: 'no_new_fact', since}); continue; }
    }
    selected.push(row);
  }
  return {selected, skipped};
}

const trim = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? null);

/** A placed article as a bundle item: headline only, marked so the model cites it for what happened and expects no detail. */
const articleItem = (f) => ({eventId: f.eventId, date: f.date, title: trim(f.payload.title, 200), summary: RECOVERED_NOTE, category: null, eventType: null,
  outlets: f.payload.outlet ? [f.payload.outlet] : [], kind: 'article', recovered: Boolean(f.payload.recoveredFrom || f.payload.recoveredAt)});

/** One bundle for a story: what the model sees. `citable` (a Set) is the check's list of valid eventIds; it is not sent. */
function assemble(world, row, {withNeighbours = true} = {}) {
  const facts = factsOf(world, row);
  const entries = facts.filter((f) => f.kind === 'entry');
  const items = facts.filter((f) => f.kind === 'entry' || f.kind === 'article'); // entries and placed (recovered) articles, date order
  const shown = items.slice(-ENTRY_CAP);
  const verdicts = new Map();
  for (const v of facts.filter((f) => f.kind === 'verdict')) {
    const cur = verdicts.get(v.payload.branchId);
    if (!cur || (v.payload.revision ?? 0) >= (cur.payload.revision ?? 0)) verdicts.set(v.payload.branchId, v);
  }
  const forks = facts.filter((f) => f.kind === 'forecast_drawn').slice(-FORK_CAP).map((f) => ({
    eventId: f.eventId, forkId: f.payload.forkId, drawnAt: f.at,
    branches: f.payload.branches.map((b) => {
      const v = verdicts.get(b.branchId);
      return {
        branchId: b.branchId, text: b.text, p: b.p, trigger: b.trigger, due: b.due,
        verdict: v ? {eventId: v.eventId, at: v.at, result: v.payload.result, voidReason: v.payload.voidReason ?? null, evidence: v.payload.evidence ?? null} : null,
      };
    }).filter((b) => !(b.verdict && b.verdict.voidReason === LEGACY_VOID)),
  })).filter((f) => f.branches.length);
  const corrections = facts.filter((f) => f.kind === 'correction').map((f) => ({eventId: f.eventId, at: f.at, corrects: f.payload.corrects, reason: f.payload.reason ?? null}));
  const merges = facts.filter((f) => f.kind === 'story_merged').map((f) => ({eventId: f.eventId, at: f.at, from: f.payload.from, into: f.payload.into, reason: f.payload.reason ?? null}));
  const actorIds = [...new Set(shown.flatMap((f) => f.actorIds || []))].sort();
  const iso3 = [...new Set(shown.flatMap((f) => f.iso3 || []))].sort();
  const latest = latestEarlier(world.earlierReadings);
  const previous = [...latest.values()].filter((r) => r.threadId === row.threadId).sort((a, b) => (a.subtype + a.week < b.subtype + b.week ? -1 : 1))
    .map((r) => ({week: r.week, subtype: r.subtype, payload: r.payload, cites: r.cites}));
  const wanted = new Set(actorIds);
  const operatorAliases = world.operatorAliases.filter((a) => [a.canonical, ...(a.variants || [])].some((x) => wanted.has(x)));
  const bundle = {
    threadId: row.threadId, week: world.week, weekFrom: world.range.from, weekTo: world.range.to, title: row.title ?? null, born: row.born ?? null,
    iso3, actorIds,
    entriesOmitted: items.length - shown.length,
    entries: shown.map((f) => f.kind === 'article' ? articleItem(f) : ({eventId: f.eventId, date: f.date, title: trim(f.payload.title, 200), summary: trim(f.payload.summary, 280), category: f.payload.category ?? null, eventType: f.payload.eventType ?? null,
      outlets: [...new Set((f.sources || []).map((s) => s.outlet).filter(Boolean))].slice(0, 4)})),
    forks, corrections, merges, previousReadings: previous, operatorAliases,
    neighbours: withNeighbours ? neighboursOf(world, row) : [],
  };
  const citable = new Set([...bundle.entries.map((e) => e.eventId), ...forks.flatMap((f) => [f.eventId, ...f.branches.filter((b) => b.verdict).map((b) => b.verdict.eventId)]),
    ...corrections.map((c) => c.eventId), ...merges.map((m) => m.eventId)]);
  const dates = new Map([...shown, ...facts.filter((f) => f.kind !== 'entry')].map((f) => [f.eventId, f.date]));
  const covers = {from: facts[0].date, to: world.range.to};
  const entryIds = new Set(bundle.entries.filter((e) => e.kind !== 'article').map((e) => e.eventId)); // an assignment proposal names an entry, not an article
  const neighbourEntries = new Map(bundle.neighbours.flatMap((n) => n.entries.map((e) => [e.eventId, n.threadId])));
  return {bundle, citable, entryIds, neighbourEntries, dates, covers, actorIds, iso3, lastEntry: entries.length ? entries[entries.length - 1].date : null, branches: branchIndex(forks)};
}

/** branchId -> {verdict: result|null, due} for the branches in the bundle. */
function branchIndex(forks) {
  const out = new Map();
  for (const f of forks) for (const b of f.branches) out.set(b.branchId, {result: b.verdict ? b.verdict.result : null, due: b.due});
  return out;
}

/** Other active stories that share a specific actor or country and are near in time: the model may propose links to them. */
function neighboursOf(world, row) {
  const share = shareIndex(world.rows);
  const out = [];
  for (const other of world.rows) {
    if (other.threadId === row.threadId) continue;
    if (daysBetween(other.lastFactAt, row.lastFactAt) > NEAR_DAYS) continue;
    const shared = [
      ...(row.actorIds || []).filter((v) => (other.actorIds || []).includes(v) && isSpecific(share, 'actorIds', v)).map((v) => ({v, s: share('actorIds', v)})),
      ...(row.iso3 || []).filter((v) => (other.iso3 || []).includes(v) && isSpecific(share, 'iso3', v)).map((v) => ({v, s: share('iso3', v)})),
    ];
    if (!shared.length) continue;
    out.push({other, shared: shared.map((x) => x.v).sort(), rarest: Math.min(...shared.map((x) => x.s))});
  }
  out.sort((a, b) => a.rarest - b.rarest || (a.other.threadId < b.other.threadId ? -1 : 1));
  return out.slice(0, NEIGHBOURS).map(({other, shared}) => ({
    threadId: other.threadId, title: other.title ?? null, shared,
    entries: factsOf(world, other).filter((f) => f.kind === 'entry').slice(-NEIGHBOUR_ENTRIES).map((f) => ({eventId: f.eventId, date: f.date, title: trim(f.payload.title, 200)})),
  }));
}

module.exports = {RECOVERED_NOTE, ENTRY_CAP, FORK_CAP, NEIGHBOURS, SPECIFIC_SHARE, NEAR_DAYS, READINGS_LOOKBACK_WEEKS, loadWorld, selectStories, assemble, keyOf, latestEarlier, shareIndex, isSpecific, factsOf};
