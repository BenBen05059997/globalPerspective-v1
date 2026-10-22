'use strict';

// Views rebuilt from facts (decision 0037 sections 1 and 3). Pure: an array of facts in, view objects out. No I/O, no clock
// (`today` and `builtAt` come in), no model. The same facts give the same objects except manifest.builtAt/runId.
const {addDays} = require('./_shared/world');

const SCHEMA_VERSION = 1;
const ACTIVE_DAYS = 60; // a story is active when a fact of its own falls in the last 60 UTC days, today included
const ENTRY_CAP = 400; // entries kept per story view (newest); more needs a shard decision
const LINKS_MAX = 50;
const SPECIFIC_SHARE = 0.05; // an actor or country links two stories only when fewer than this share of active stories carry it
const LINK_WINDOW_DAYS = 14; // and both stories' lastFactAt dates are at most this far apart
const ALL_INDEX_MAX_BYTES = 5 * 1024 * 1024; // over this the run fails rather than truncate (0037 section 1)
const NO_READING = 'no reading yet';

const byKey = (...fns) => (a, b) => { for (const f of fns) { const x = f(a); const y = f(b); if (x < y) return -1; if (x > y) return 1; } return 0; };
const unique = (xs) => [...new Set(xs)].sort();
const maxOf = (xs) => xs.reduce((m, x) => (m === null || x > m ? x : m), null);
const minOf = (xs) => xs.reduce((m, x) => (m === null || x < m ? x : m), null);
const bytesOf = (obj) => Buffer.byteLength(`${JSON.stringify(obj)}\n`);

/** Facts in a stable order (at, eventId) with a repeated eventId dropped, so the output never depends on file order. */
function ordered(facts) {
  const seen = new Set();
  return [...facts].sort(byKey((f) => f.at, (f) => f.eventId)).filter((f) => !seen.has(f.eventId) && seen.add(f.eventId));
}

/**
 * story_merged facts -> {aliases: Map(from -> survivor), applied: [the merge facts that took effect]}. Transitive (A to B to C
 * gives A to C). Oldest merge first; a merge that would close a cycle, or that moves a story already merged, is ignored
 * (0036 section 3).
 */
function resolveAliases(facts) {
  const direct = new Map();
  const applied = [];
  const root = (id) => { const seen = new Set(); let at = id; while (direct.has(at) && !seen.has(at)) { seen.add(at); at = direct.get(at); } return at; };
  for (const f of ordered(facts).filter((x) => x.kind === 'story_merged')) {
    const {from, into} = f.payload;
    if (!from || !into || from === into || direct.has(from) || root(into) === from) continue;
    direct.set(from, into);
    applied.push(f);
  }
  return {aliases: new Map([...direct.keys()].map((from) => [from, root(from)])), applied};
}

const sourcesOf = (f) => (f.sources || []).map((s) => ({sourceId: s.sourceId, outlet: s.outlet, url: s.url, title: s.title}));

/** The entry rows of one story: its own entry facts plus those of stories merged into it (tagged), date ascending. */
function entryRows(group, corrected) {
  return group.flatMap(({threadId, own, facts}) => facts.filter((f) => f.kind === 'entry').map((f) => ({
    eventId: f.eventId, date: f.date, at: f.at, precision: f.precision, title: f.payload.title, summary: f.payload.summary ?? null,
    category: f.payload.category ?? null, eventType: f.payload.eventType ?? null, sources: sourcesOf(f),
    ...(own ? {} : {fromThreadId: threadId}), ...(corrected.has(f.eventId) ? {corrected: true} : {}),
  }))).sort(byKey((e) => e.date, (e) => e.at, (e) => e.eventId));
}

/** forecast_drawn facts of one thread -> forks with each branch's latest verdict attached (null when none). */
function forkRows(facts) {
  const verdicts = new Map();
  for (const v of facts.filter((f) => f.kind === 'verdict')) {
    const key = v.payload.branchId;
    const cur = verdicts.get(key);
    if (!cur || byKey((x) => x.at, (x) => x.payload.revision ?? 0)(cur, v) < 0) verdicts.set(key, v);
  }
  return facts.filter((f) => f.kind === 'forecast_drawn').sort(byKey((f) => f.at, (f) => f.payload.forkId || f.eventId)).map((f) => ({
    forkId: f.payload.forkId, drawnAt: f.at,
    branches: f.payload.branches.map((b) => {
      const v = verdicts.get(b.branchId);
      return {
        branchId: b.branchId, text: b.text, p: b.p, trigger: b.trigger, resolutionSource: b.resolutionSource, due: b.due,
        verdict: v ? {at: v.at, result: v.payload.result, decidedBy: v.payload.decidedBy, evidence: v.payload.evidence ?? null} : null,
      };
    }),
  }));
}

/** Facts -> one record per thread: its survivor, own facts, and (for a survivor) the facts of the stories merged into it. */
function groupStories(facts, aliases) {
  const own = new Map();
  for (const f of facts) if (f.threadId && f.kind !== 'run') (own.get(f.threadId) || own.set(f.threadId, []).get(f.threadId)).push(f);
  for (const [from, into] of aliases) { if (!own.has(from)) own.set(from, []); if (!own.has(into)) own.set(into, []); }
  const merged = new Map();
  for (const [from, into] of aliases) (merged.get(into) || merged.set(into, []).get(into)).push(from);
  return {own, merged};
}

/**
 * The rows and story views. `rows` has every thread (an alias row for a merged story); `stories` maps threadId -> view.
 * Counts and links are built from the same grouping by buildViews.
 */
function projectStories(facts, {aliases, applied}, {today, builtFrom}) {
  const {own, merged} = groupStories(facts, aliases);
  const stories = new Map();
  const rows = new Map();
  const survivors = new Map();
  for (const threadId of [...own.keys()].sort()) {
    const aliasOf = aliases.get(threadId) || null;
    if (aliasOf) {
      const facts0 = own.get(threadId);
      stories.set(threadId, {schemaVersion: SCHEMA_VERSION, builtFrom, threadId, aliasOf});
      rows.set(threadId, {
        threadId, born: bornOf(facts0), lastFactAt: maxOf(facts0.map((f) => f.at)), iso3: [], actorIds: [], sourceCount: 0, entryCount: 0,
        forkCount: 0, branchCount: 0, liveBranchCount: 0, latestVerdictAt: null, aliasOf, aliases: [], title: titleOf(entryRows([{threadId, own: true, facts: facts0}], new Set())),
      });
      continue;
    }
    const aliasIds = (merged.get(threadId) || []).slice().sort();
    const group = [
      {threadId, own: true, facts: own.get(threadId)},
      // From a merged story only its entries (and corrections of them) move to the survivor (0037 section 3).
      ...aliasIds.map((id) => ({threadId: id, own: false, facts: (own.get(id) || []).filter((f) => f.kind === 'entry' || f.kind === 'correction')})),
    ];
    const mine = group[0].facts;
    const allFacts = group.flatMap((g) => g.facts);
    const ids = new Set(group.map((g) => g.threadId));
    const mergeFacts = applied.filter((f) => ids.has(f.payload.into));
    const corrections = allFacts.filter((f) => f.kind === 'correction');
    const corrected = new Set(corrections.map((f) => f.payload.corrects));
    const entries = entryRows(group, corrected);
    const kept = entries.slice(-ENTRY_CAP);
    const forks = forkRows(mine);
    const branches = forks.flatMap((k) => k.branches);
    const sourceIds = unique(group.flatMap((g) => g.facts.flatMap((f) => f.sourceIds)));
    const iso3 = unique(group.flatMap((g) => g.facts.flatMap((f) => f.iso3)));
    const actorIds = unique(group.flatMap((g) => g.facts.flatMap((f) => f.actorIds)));
    const verdictAts = mine.filter((f) => f.kind === 'verdict').map((f) => f.at);
    const born = minOf(group.map((g) => bornOf(g.facts)).filter(Boolean));
    stories.set(threadId, {
      schemaVersion: SCHEMA_VERSION, builtFrom, threadId, born, aliasOf: null, iso3, actorIds, sourceIds,
      entries: kept, entriesOmitted: entries.length - kept.length, forks,
      merges: mergeFacts.map((f) => ({from: f.payload.from, into: f.payload.into, at: f.at, reason: f.payload.reason})),
      corrections: corrections.map((f) => ({corrects: f.payload.corrects, at: f.at, reason: f.payload.reason})),
      line: null, chapters: [], branchStatus: null, reading: {state: 'none', reason: NO_READING},
    });
    rows.set(threadId, {
      threadId, born, lastFactAt: maxOf(allFacts.map((f) => f.at)), iso3, actorIds, sourceCount: sourceIds.length, entryCount: entries.length,
      forkCount: forks.length, branchCount: branches.length, liveBranchCount: branches.filter((b) => !b.verdict && b.due && b.due >= today).length,
      latestVerdictAt: maxOf(verdictAts), aliasOf: null, aliases: aliasIds, title: titleOf(entries),
    });
    survivors.set(threadId, {iso3, actorIds, sourceIds});
  }
  return {stories, rows, survivors};
}

const bornOf = (facts) => minOf([...facts.filter((f) => f.kind === 'story_born').map((f) => f.payload.born || f.date), ...facts.filter((f) => f.kind === 'entry').map((f) => f.date)]);
const titleOf = (entries) => (entries.length ? entries[0].title : null);

const rowOrder = byKey((r) => -Date.parse(r.lastFactAt || 0), (r) => r.threadId);

/**
 * Shared facts between active stories (0037 section 1, amended 2026-10-22). Not judged links. Only actors and countries count as
 * grounds, and only when fewer than SPECIFIC_SHARE of the active stories carry them; sources are listed, never counted. Both
 * stories need a fact within LINK_WINDOW_DAYS of each other (lastFactAt dates). `rows` are the active index rows.
 */
function buildLinks(rows, survivors, builtFrom) {
  const lastDay = new Map(rows.map((r) => [r.threadId, r.lastFactAt.slice(0, 10)]));
  const ids = rows.map((r) => r.threadId);
  const index = {actorIds: new Map(), iso3: new Map(), sourceIds: new Map()};
  for (const id of ids) for (const kind of Object.keys(index)) for (const v of survivors.get(id)[kind]) (index[kind].get(v) || index[kind].set(v, []).get(v)).push(id);
  const shareOf = (kind, v) => index[kind].get(v).length / ids.length;
  const specific = (kind, v) => shareOf(kind, v) < SPECIFIC_SHARE;
  const out = new Map();
  for (const id of ids) {
    const shared = new Map();
    for (const [kind, field] of [['actorIds', 'sharedActorIds'], ['iso3', 'sharedIso3'], ['sourceIds', 'sharedSourceIds']]) {
      for (const v of survivors.get(id)[kind]) {
        for (const other of index[kind].get(v)) {
          if (other === id) continue;
          const row = shared.get(other) || shared.set(other, {otherThreadId: other, sharedActorIds: [], sharedIso3: [], sharedSourceIds: [], rarest: 1}).get(other);
          row[field].push(v);
          if (kind !== 'sourceIds' && specific(kind, v)) row.rarest = Math.min(row.rarest, shareOf(kind, v));
        }
      }
    }
    const links = [];
    for (const r of shared.values()) {
      const daysApart = Math.abs(Date.parse(lastDay.get(id)) - Date.parse(lastDay.get(r.otherThreadId))) / 86400000;
      if (daysApart > LINK_WINDOW_DAYS) continue;
      // Only the specific actors and countries are shared grounds; a background ID (USA) never links on its own.
      const actors = r.sharedActorIds.filter((v) => specific('actorIds', v)).sort();
      const iso3 = r.sharedIso3.filter((v) => specific('iso3', v)).sort();
      const grounds = (actors.length ? 1 : 0) + (iso3.length ? 1 : 0);
      if (!grounds) continue;
      links.push({otherThreadId: r.otherThreadId, sharedActorIds: actors, sharedIso3: iso3, sharedSourceIds: r.sharedSourceIds.sort(), grounds, daysApart, rarest: r.rarest});
    }
    links.sort(byKey((r) => r.rarest, (r) => r.otherThreadId));
    out.set(id, {schemaVersion: SCHEMA_VERSION, builtFrom, threadId: id, links: links.slice(0, LINKS_MAX).map(({rarest, ...row}) => row), confirmedLinks: [], confirmedLinksReason: NO_READING});
  }
  return out;
}

/** counts/{date}.json: per story, entries added that day, branches due that day, verdicts that day (by fact date). */
function buildCount(date, facts, aliases, builtFrom) {
  const byStory = {};
  const bump = (threadId, field, n = 1) => {
    const id = aliases.get(threadId) || threadId;
    const row = byStory[id] || (byStory[id] = {newEntries: 0, branchesDue: 0, verdicts: 0});
    row[field] += n;
  };
  for (const f of facts) {
    if (!f.threadId) continue;
    if (f.kind === 'entry' && f.date === date) bump(f.threadId, 'newEntries');
    else if (f.kind === 'verdict' && f.date === date) bump(f.threadId, 'verdicts');
    else if (f.kind === 'forecast_drawn') { const n = f.payload.branches.filter((b) => b.due === date).length; if (n) bump(f.threadId, 'branchesDue', n); }
  }
  const sorted = Object.fromEntries(Object.keys(byStory).sort().map((k) => [k, byStory[k]]));
  const total = {newEntries: 0, branchesDue: 0, verdicts: 0};
  for (const r of Object.values(sorted)) for (const k of Object.keys(total)) total[k] += r[k];
  return {schemaVersion: SCHEMA_VERSION, builtFrom, date, byStory: sorted, total};
}

/** Days whose counts file is written: the previous and current ISO week up to today, plus days whose facts changed this run. */
function countDaysFor(today, changedDays = []) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((dow + 6) % 7));
  const days = [];
  for (let d = addDays(monday, -7); d <= today; d = addDays(d, 1)) days.push(d);
  return unique([...days, ...changedDays.filter(Boolean)]);
}

/**
 * Everything 0037 section 1 lists. Options: today (UTC day), builtAt, runId, factsManifestDays (count), countDays (default
 * countDaysFor(today)). Throws when all.json is over its hard cap.
 */
function buildViews(allFacts, {today, builtAt, runId, factsManifestDays, countDays = countDaysFor(today)}) {
  const facts = ordered(allFacts);
  const factsThrough = maxOf(facts.filter((f) => f.kind !== 'run').map((f) => f.date));
  const builtFrom = {factsThrough, readingsThrough: null};
  const resolved = resolveAliases(facts);
  const {aliases} = resolved;
  const {stories, rows, survivors} = projectStories(facts, resolved, {today, builtFrom});

  const cutoff = addDays(today, 1 - ACTIVE_DAYS);
  const all = [...rows.values()].sort(rowOrder);
  const activeRows = all.filter((r) => !r.aliasOf && r.lastFactAt && r.lastFactAt.slice(0, 10) >= cutoff);
  const links = buildLinks(activeRows, survivors, builtFrom);
  const counts = new Map(countDays.map((d) => [d, buildCount(d, facts, aliases, builtFrom)]));
  const active = {schemaVersion: SCHEMA_VERSION, builtFrom, stories: activeRows};
  const everything = {schemaVersion: SCHEMA_VERSION, builtFrom, stories: all};
  const size = bytesOf(everything);
  if (size > ALL_INDEX_MAX_BYTES) throw new Error(`views: index/all.json is ${size} bytes, over the ${ALL_INDEX_MAX_BYTES} cap; it needs the shard decision of 0037`);
  const manifest = {schemaVersion: SCHEMA_VERSION, builtAt, runId, factsManifestDays, factsThrough, readingsThrough: null};
  return {stories, links, counts, active, all: everything, manifest};
}

/** The write order of 0037 section 2 as groups of [key, object]; the groups are written one after another, manifest last. */
function writeGroups(views) {
  const keyed = (dir, map) => [...map].map(([id, obj]) => [`${dir}/${id}.json`, obj]);
  return [
    [...keyed('stories', views.stories), ...keyed('links', views.links), ...keyed('counts', views.counts)],
    [['index/active.json', views.active]],
    [['index/all.json', views.all]],
    [['manifest.json', views.manifest]],
  ];
}

module.exports = {SCHEMA_VERSION, ACTIVE_DAYS, ENTRY_CAP, LINKS_MAX, SPECIFIC_SHARE, LINK_WINDOW_DAYS, ALL_INDEX_MAX_BYTES, resolveAliases, buildViews, countDaysFor, writeGroups, bytesOf};
