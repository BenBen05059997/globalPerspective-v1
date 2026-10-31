'use strict';

// Views rebuilt from facts (decision 0037 sections 1 and 3). Pure: an array of facts in, view objects out. No I/O, no clock
// (`today` and `builtAt` come in), no model. The same facts give the same objects except manifest.builtAt/runId.
const {addDays} = require('./_shared/world');
const {isResolvable: resolvable} = require('./facts'); // a question with a question id (0038); anything else is legacy
const Rd = require('./readings');
const Q = require('./_shared/questionState');
const {byKey, ordered, resolveAliases, currentAssignments, placeEntries} = require('./_shared/placement');
const {getOutletMeta, registrableDomain} = require('./_shared/outlets');
const {COUNTRIES} = require('./_shared/countries');

const SCHEMA_VERSION = 1;
const ACTIVE_DAYS = 60; // a story is active when a fact of its own falls in the last 60 UTC days, today included
const ENTRY_CAP = 400; // entries kept per story view (newest); more needs a shard decision
const LINKS_MAX = 50;
const SPECIFIC_SHARE = 0.05; // an actor or country links two stories only when fewer than this share of active stories carry it
const LINK_WINDOW_DAYS = 14; // and both stories' lastFactAt dates are at most this far apart
const ALL_INDEX_MAX_BYTES = 5 * 1024 * 1024; // over this the run fails rather than truncate (0037 section 1)
const NO_READING = 'no reading yet';

const unique = (xs) => [...new Set(xs)].sort();
const maxOf = (xs) => xs.reduce((m, x) => (m === null || x > m ? x : m), null);
const minOf = (xs) => xs.reduce((m, x) => (m === null || x < m ? x : m), null);
const bytesOf = (obj) => Buffer.byteLength(`${JSON.stringify(obj)}\n`);

// outlet country and type come from the one outlet table at build time (not stored); snippet and tier where the fact has them
const sourcesOf = (f) => (f.sources || []).map((s) => {
  const meta = s.url ? getOutletMeta(registrableDomain(s.url)) : null;
  return {sourceId: s.sourceId, outlet: s.outlet, url: s.url, title: s.title, outletCountry: meta ? meta.country : null, outletType: meta ? meta.type : null,
    ...(s.snippet ? {snippet: s.snippet} : {}), ...(s.tier ? {tier: s.tier} : {})};
});

/** Entry notes (0042) -> eventId -> {part: {format, content, at, model}}: the latest note per entry and part wins. */
function entryNotesBy(noteLines) {
  const out = new Map();
  for (const n of noteLines) {
    if (!n || n.subtype !== 'entry' || !n.subject || !n.payload) continue;
    const parts = out.get(n.subject.id) || out.set(n.subject.id, {}).get(n.subject.id);
    const cur = parts[n.part];
    const copy = n.payload.from === 'archive';
    // an exact note always beats an archive copy (cut text, no model); then the latest wins
    if (!cur || (cur.copy && !copy) || (cur.copy === copy && n.at > cur.at)) parts[n.part] = {format: n.payload.format, content: n.payload.content, at: n.at, model: n.model, copy};
  }
  for (const parts of out.values()) for (const k of Object.keys(parts)) { const {copy, ...note} = parts[k]; parts[k] = copy ? {...note, from: 'archive'} : note; }
  return out;
}

/** A note as the item its writer stored in DynamoDB (payload + generatedAt + model), so a page switches source, not shape. */
const asStored = (n) => ({...n.payload, generatedAt: n.at, model: n.model});
// Drift depth is a member perk enforced server-side (newsSensitiveData country_history capForTier: 1 note unless member), and
// views are public: a country view carries only the newest drift note, with the count. Members read depth through the action.
const DRIFT_MAX = 1;

/** The latest note per key of one subtype (and part, when given). */
function latestBy(noteLines, subtype, keyOf, part) {
  const out = new Map();
  for (const n of noteLines) {
    if (!n || n.subtype !== subtype || !n.subject || !n.payload || (part !== undefined && n.part !== part)) continue;
    const k = keyOf(n);
    const cur = out.get(k);
    if (!cur || n.at > cur.at) out.set(k, n);
  }
  return out;
}

const isKind = (kind) => (n) => n && n.subject && n.subject.kind === kind;

/**
 * Story analysis notes (0042) -> threadId -> the analysis as stored, plus `driftNote` (the story's latest drift note as stored)
 * when it has one: only an analysis carries it, as the old thread_analysis action only attached it to an existing analysis.
 */
function storyAnalysisBy(noteLines) {
  const out = new Map();
  const drift = latestBy(noteLines.filter(isKind('story')), 'drift', (x) => x.subject.id);
  for (const [id, n] of latestBy(noteLines, 'story_analysis', (x) => x.subject.id)) {
    out.set(id, {...asStored(n), threadId: id, iso3: n.iso3, ...(drift.has(id) ? {driftNote: asStored(drift.get(id))} : {})});
  }
  return out;
}

/**
 * The story web (newsSystemsAnalysis buildWebIndex) from its notes: per country the newest web at most WEB_MAX_AGE_DAYS old.
 * `web` notes (one per country web, even one with no edge) say which webs there are; a country with link notes but no web note
 * (a web written before web notes) is read from its link notes alone. Returns {newest: iso3 -> at, webs: iso3 -> web note}.
 */
const WEB_MAX_AGE_DAYS = 30;
function newestWebs(noteLines, today) {
  const cutoff = `${addDays(today, -WEB_MAX_AGE_DAYS)}T00:00:00.000Z`;
  const newest = new Map();
  const webs = new Map();
  for (const n of noteLines) {
    if (!n || !n.subject || !n.payload || (n.subtype !== 'link' && n.subtype !== 'web')) continue;
    const iso3 = n.subtype === 'web' ? n.subject.id : n.part;
    if (!newest.has(iso3) || n.at > newest.get(iso3)) newest.set(iso3, n.at);
    if (n.subtype === 'web' && (!webs.has(iso3) || n.at > webs.get(iso3).at)) webs.set(iso3, n);
  }
  for (const [iso3, at] of newest) if (at < cutoff) { newest.delete(iso3); webs.delete(iso3); }
  return {newest, webs: new Map([...webs].filter(([iso3, n]) => n.at === newest.get(iso3)))};
}

/**
 * Link notes (pair subjects, record.js pairKey a__b; part = the web's country) -> threadId -> judged links, on the story web
 * index's own rules: only each country's newest web, at most WEB_MAX_AGE_DAYS old, one row per pair per country. Model judgment;
 * `otherTitle` from the record's rows.
 */
function judgedLinksBy(noteLines, newest, titleOf = () => null) {
  const out = new Map();
  const seen = new Set();
  for (const n of noteLines) {
    if (!n || n.subtype !== 'link' || !n.subject || !n.payload || n.at !== newest.get(n.part) || seen.has(`${n.subject.id}|${n.part}`)) continue;
    seen.add(`${n.subject.id}|${n.part}`);
    const ids = n.subject.id.split('__');
    if (ids.length !== 2) continue;
    // a web that held both directions of the pair: the note carries the weaker one as `reverse`, which is a row of its own
    const {reverse, ...edge} = n.payload;
    const stored = [asStored({...n, payload: edge}), ...(reverse ? [asStored({...n, payload: {...edge, from: edge.to, to: edge.from, ...reverse}})] : [])];
    for (const [me, other] of [[ids[0], ids[1]], [ids[1], ids[0]]]) {
      for (const row of stored) (out.get(me) || out.set(me, []).get(me)).push({otherThreadId: other, otherTitle: titleOf(other), iso3: n.part, ...row});
    }
  }
  for (const list of out.values()) list.sort(byKey((l) => l.otherThreadId, (l) => l.iso3, (l) => (l.from === l.otherThreadId ? 1 : 0)));
  return out;
}

const WINDOW_DAYS = 30; // the archive days newsSystemsAnalysis reads (ARCHIVE_DAYS); its titles, entry counts and places come from them
const SCOPE_DAYS = 14; // a story is in the index's scope when its newest entry is at most this old
const PLACES_MAX = 3;

/**
 * Entry facts -> threadId -> what the web index keeps of that thread id (the archive groups by the thread id an entry carried, so a
 * merged story's entries stay under its old id here): entry count in the web's window, newest day, title of the newest entry, and
 * the three most-mentioned countries (real countries only, ties by name).
 */
function windowInfos(facts, today) {
  const from = addDays(today, -WINDOW_DAYS);
  const by = new Map();
  for (const f of facts) {
    if (f.kind !== 'entry' || !f.threadId || f.date < from || f.date > today) continue;
    (by.get(f.threadId) || by.set(f.threadId, []).get(f.threadId)).push(f);
  }
  const out = new Map();
  for (const [id, es] of by) {
    es.sort(byKey((f) => f.date, (f) => f.at, (f) => f.eventId));
    const places = new Map();
    for (const f of es) for (const c of f.iso3 || []) if (COUNTRIES[c]) places.set(c, (places.get(c) || 0) + 1);
    out.set(id, {
      n: new Set(es.map((f) => f.payload.topicId || f.eventId)).size, lastDate: es[es.length - 1].date, title: es[es.length - 1].payload.title ?? null,
      places: [...places].map(([iso3, n]) => ({iso3, name: COUNTRIES[iso3].name, n})).sort(byKey((p) => -p.n, (p) => p.name)).slice(0, PLACES_MAX),
    });
  }
  return out;
}

/**
 * Web notes -> threadId -> `web`: how the story sits in the country webs (the part of the old web_index read the judged links do not
 * carry). state mirrors buildWebIndex stateOf: linked (a judged link), analysed_no_links (a node of a web), single_update (under 2
 * entries in the window), country_not_analysed; null when the story is not in the index at all (no entry in the last SCOPE_DAYS and
 * in no web). analysedIn: the webs the story is a node of; backbone: the web's deterministic shared-actor edges (both ends nodes of
 * the web), one row per web and other story; otherPlaces: top places of every story in judgedLinks or backbone.
 */
function webCoverageBy(webs, judged, info, today, titleOf) {
  const analysed = new Map();
  const backbone = new Map();
  const add = (map, id, row) => (map.get(id) || map.set(id, []).get(id)).push(row);
  for (const [iso3, w] of [...webs].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const nodes = new Set(w.payload.nodes.map((x) => x.threadId));
    for (const id of nodes) add(analysed, id, {iso3, country: w.payload.country, generatedAt: w.at, nodes: nodes.size});
    for (const b of w.payload.backbone) {
      if (!nodes.has(b.from) || !nodes.has(b.to)) continue;
      const row = {iso3, country: w.payload.country, generatedAt: w.at, actors: b.sharedActors, weight: b.weight};
      add(backbone, b.from, {otherThreadId: b.to, otherTitle: titleOf(b.to), ...row});
      add(backbone, b.to, {otherThreadId: b.from, otherTitle: titleOf(b.from), ...row});
    }
  }
  const scopeFrom = addDays(today, -SCOPE_DAYS);
  const placesOf = (id) => (info.get(id) || {}).places || [];
  const out = new Map();
  // a story in a web or a link that the record no longer has as its own (a merged one) has no entries here: its state rests on the web alone
  const none = {n: 0, lastDate: '', title: null, places: []};
  for (const id of unique([...info.keys(), ...analysed.keys(), ...judged.keys()])) {
    const i = info.get(id) || none;
    const inWeb = analysed.has(id);
    const inScope = i.lastDate >= scopeFrom;
    const links = judged.get(id) || [];
    const state = !(inWeb || inScope) ? null : links.length ? 'linked' : inWeb ? 'analysed_no_links' : i.n < 2 ? 'single_update' : 'country_not_analysed';
    const sh = (backbone.get(id) || []).sort(byKey((r) => -r.weight, (r) => r.otherThreadId, (r) => r.iso3));
    const others = unique([...links.map((l) => l.otherThreadId), ...sh.map((r) => r.otherThreadId)]);
    out.set(id, {state, entries: i.n, places: i.places, analysedIn: analysed.get(id) || [], backbone: sh, otherPlaces: Object.fromEntries(others.map((o) => [o, placesOf(o)]))});
  }
  return out;
}

/** Country views (0042): per ISO3, its drift notes (newest first, capped) and its latest country notes, from notes alone. */
function countryViews(noteLines, builtFrom) {
  const out = new Map();
  const view = (iso3) => out.get(iso3) || out.set(iso3, {schemaVersion: SCHEMA_VERSION, builtFrom, iso3, drift: [], driftCount: 0, intelligence: null, systems: null}).get(iso3);
  const drift = noteLines.filter((n) => n && n.subtype === 'drift' && n.subject && n.subject.kind === 'country' && n.payload).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const seen = new Set();
  for (const n of drift) {
    if (seen.has(n.noteId)) continue;
    seen.add(n.noteId);
    const v = view(n.subject.id);
    v.driftCount += 1;
    if (v.drift.length < DRIFT_MAX) v.drift.push(asStored(n));
  }
  for (const [iso3, n] of latestBy(noteLines, 'country', (x) => x.subject.id, '')) view(iso3).intelligence = asStored(n);
  for (const [iso3, n] of latestBy(noteLines, 'country', (x) => x.subject.id, 'systems')) view(iso3).systems = asStored(n);
  return out;
}

/** A placed article as a story row: marked `kind: 'article'`, no category or event type (an article carries neither). */
function articleRow(f, corrected) {
  const p = f.payload;
  return {
    eventId: f.eventId, date: f.date, at: f.at, precision: f.precision, title: p.title, summary: p.snippet ?? null,
    sources: [{outlet: p.outlet ?? null, url: p.url}], kind: 'article', recovered: Boolean(p.recoveredFrom), recoveredFrom: p.recoveredFrom ?? null,
    ...(corrected.has(f.eventId) ? {corrected: true} : {}),
  };
}

/** The entry rows of one story: its own entry facts and placed articles plus those of stories merged into it (tagged), date ascending. */
function entryRows(group, corrected, reassigned = new Map(), notesBy = new Map()) {
  return group.flatMap(({threadId, own, facts}) => facts.filter((f) => f.kind === 'entry' || f.kind === 'article').map((f) => f.kind === 'article' ? {...articleRow(f, corrected), ...(own ? {} : {fromThreadId: threadId})} : ({
    eventId: f.eventId, date: f.date, at: f.at, precision: f.precision, title: f.payload.title, summary: f.payload.summary ?? null,
    category: f.payload.category ?? null, eventType: f.payload.eventType ?? null, sources: sourcesOf(f),
    topicId: f.payload.topicId ?? null, iso3: f.iso3 || [], // the story page looks up forecasts and analysis by topicId and shows countries
    ...(f.payload.actors ? {actors: f.payload.actors} : {}), ...(notesBy.has(f.eventId) ? {notes: notesBy.get(f.eventId)} : {}),
    ...(own ? {} : {fromThreadId: threadId}), ...(reassigned.has(f.eventId) ? {reassignedFrom: reassigned.get(f.eventId)} : {}), ...(corrected.has(f.eventId) ? {corrected: true} : {}),
  }))).sort(byKey((e) => e.date, (e) => e.at, (e) => e.eventId));
}

/** The weekly sample on record (0043): weeks with a commit, weeks with a draw, and every sampled qid. Built once from all facts. */
function sampleLedger(facts) {
  const draws = facts.filter((f) => f.kind === 'question_draw');
  return {
    committed: new Set(facts.filter((f) => f.kind === 'question_commit').map((f) => f.payload.weekId)),
    drawn: new Set(draws.map((f) => f.payload.weekId)),
    sampled: new Set(draws.flatMap((f) => f.payload.picked.map((p) => p.qid))),
  };
}

/** forecast_drawn facts of one thread -> forks with each branch's latest verdict attached (null when none), and for a question its
 *  `scoring` (where it stands in the weekly sample) and `state` (its outcome once sampled), the rules of prediction_snapshot (0043). */
function forkRows(facts, ledger, today) {
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
      const issueDay = f.payload.forkId.slice(f.payload.forkId.lastIndexOf('/') + 1); // forkId = '<PRED pk>/<issue day>'
      const sampled = resolvable(b) && ledger.sampled.has(b.qid);
      const week = Q.isoWeekOfDay(issueDay);
      return {
        branchId: b.branchId, text: b.text, p: b.p, trigger: b.trigger, resolutionSource: b.resolutionSource, due: b.due,
        // the question scheme (0038): the page links a branch to /track-record?q=<qid> and shows the scenario's probability
        question: b.question === true, qid: b.qid || null, scenarioP: b.scenarioP ?? null,
        verdict: v ? {at: v.at, result: v.payload.result, decidedBy: v.payload.decidedBy, evidence: v.payload.evidence ?? null, voidReason: v.payload.voidReason ?? null} : null,
        scoring: resolvable(b) ? Q.sampleState({issueDay, deadline: b.due, sampled, commitExists: ledger.committed.has(week), drawExists: ledger.drawn.has(week)}) : null,
        state: resolvable(b) ? Q.outcomeState({sampled, result: v ? v.payload.result : null, deadline: b.due, today}) : null,
        ...(resolvable(b) ? {} : {legacy: true}),
      };
    }),
  }));
}

/** Facts -> one record per thread: its survivor, own facts, and (for a survivor) the facts of the stories merged into it. */
function groupStories(facts, aliases, keep = new Set()) {
  const own = new Map();
  for (const id of keep) own.set(id, []);
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
function projectStories(facts, {aliases, applied}, {today, builtFrom, readings, canon, reassigned, keep, notesBy, analysisBy = new Map()}) {
  const {own, merged} = groupStories(facts, aliases, keep);
  const ledger = sampleLedger(facts);
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
      // From a merged story only its entries and placed articles (and corrections of them) move to the survivor (0037 section 3).
      ...aliasIds.map((id) => ({threadId: id, own: false, facts: (own.get(id) || []).filter((f) => f.kind === 'entry' || f.kind === 'article' || f.kind === 'correction')})),
    ];
    const mine = group[0].facts;
    const allFacts = group.flatMap((g) => g.facts);
    const ids = new Set(group.map((g) => g.threadId));
    const mergeFacts = applied.filter((f) => ids.has(f.payload.into));
    const corrections = allFacts.filter((f) => f.kind === 'correction');
    const corrected = new Set(corrections.map((f) => f.payload.corrects));
    const entries = entryRows(group, corrected, reassigned, notesBy);
    const kept = entries.slice(-ENTRY_CAP);
    const forks = forkRows(mine, ledger, today);
    const branches = forks.flatMap((k) => k.branches);
    const sourceIds = unique(group.flatMap((g) => g.facts.flatMap((f) => f.sourceIds)));
    const iso3 = unique(group.flatMap((g) => g.facts.flatMap((f) => f.iso3)));
    const actorIds = unique(group.flatMap((g) => g.facts.flatMap((f) => f.actorIds.map(canon))));
    const verdictAts = mine.filter((f) => f.kind === 'verdict').map((f) => f.at);
    const born = minOf(group.map((g) => bornOf(g.facts)).filter(Boolean));
    stories.set(threadId, {
      schemaVersion: SCHEMA_VERSION, builtFrom, threadId, born, aliasOf: null, iso3, actorIds, sourceIds,
      entries: kept, entriesOmitted: entries.length - kept.length, forks,
      merges: mergeFacts.map((f) => ({from: f.payload.from, into: f.payload.into, at: f.at, reason: f.payload.reason})),
      corrections: corrections.map((f) => ({corrects: f.payload.corrects, at: f.at, reason: f.payload.reason})),
      ...readingFields(readings.get(threadId)),
      analysis: analysisBy.get(threadId) ?? null, // the latest story analysis note (model text), as stored
    });
    rows.set(threadId, {
      threadId, born, lastFactAt: maxOf(allFacts.map((f) => f.at)), iso3, actorIds, sourceCount: sourceIds.length, entryCount: entries.length,
      forkCount: forks.length, branchCount: branches.length, liveBranchCount: branches.filter((b) => !b.legacy && !b.verdict && b.due && b.due >= today).length,
      latestVerdictAt: maxOf(verdictAts), aliasOf: null, aliases: aliasIds, title: titleOf(entries),
      ...(readings.get(threadId) && readings.get(threadId).line ? {line: readings.get(threadId).line.payload.text} : {}),
    });
    survivors.set(threadId, {iso3, actorIds, sourceIds});
  }
  return {stories, rows, survivors};
}

/** line, chapters and reading of a story view from its standing readings (`t`, may be undefined). */
function readingFields(t) {
  if (!t) return {line: null, chapters: [], reading: {state: 'none', reason: NO_READING}};
  return {
    line: t.line ? {text: t.line.payload.text, week: t.line.week, cites: Rd.cites(t.line)} : null,
    chapters: t.chapters.map((r) => ({title: r.payload.title, from: r.payload.from, to: r.payload.to, summary: r.payload.summary, cites: Rd.cites(r)}))
      .sort(byKey((c) => c.from, (c) => c.to, (c) => c.title)),
    reading: {state: 'read', week: t.week},
  };
}

const bornOf = (facts) => minOf([...facts.filter((f) => f.kind === 'story_born').map((f) => f.payload.born || f.date), ...facts.filter((f) => f.kind === 'entry' || f.kind === 'article').map((f) => f.date)]);
const titleOf = (entries) => (entries.length ? entries[0].title : null);

const rowOrder = byKey((r) => -Date.parse(r.lastFactAt || 0), (r) => r.threadId);

/**
 * Shared facts between active stories (0037 section 1, amended 2026-10-22). Not judged links. Only actors and countries count as
 * grounds, and only when fewer than SPECIFIC_SHARE of the active stories carry them; sources are listed, never counted. Both
 * stories need a fact within LINK_WINDOW_DAYS of each other (lastFactAt dates). `rows` are the active index rows.
 */
function buildLinks(rows, survivors, builtFrom, readings, aliases, isGeneric = () => false) {
  const lastDay = new Map(rows.map((r) => [r.threadId, r.lastFactAt.slice(0, 10)]));
  const ids = rows.map((r) => r.threadId);
  const index = {actorIds: new Map(), iso3: new Map(), sourceIds: new Map()};
  for (const id of ids) for (const kind of Object.keys(index)) for (const v of survivors.get(id)[kind]) (index[kind].get(v) || index[kind].set(v, []).get(v)).push(id);
  const shareOf = (kind, v) => index[kind].get(v).length / ids.length;
  const specific = (kind, v) => !(kind === 'actorIds' && isGeneric(v)) && shareOf(kind, v) < SPECIFIC_SHARE; // a generic group (0040 answer 7) is never a ground
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
    const confirmed = confirmedLinks(readings.get(id), aliases, id);
    out.set(id, {
      schemaVersion: SCHEMA_VERSION, builtFrom, threadId: id, links: links.slice(0, LINKS_MAX).map(({rarest, ...row}) => row),
      confirmedLinks: confirmed, confirmedLinksReason: confirmed.length ? null : NO_READING,
    });
  }
  return out;
}

/** The review's confirmed links of one story: the other story is the survivor when it was merged; a link to itself is dropped. */
function confirmedLinks(t, aliases, self) {
  if (!t) return [];
  return t.links.map((r) => ({otherThreadId: aliases.get(r.payload.otherThreadId) || r.payload.otherThreadId, mechanism: r.payload.mechanism, direction: r.payload.direction, week: r.week, cites: Rd.cites(r)}))
    .filter((l) => l.otherThreadId !== self)
    .sort(byKey((l) => l.otherThreadId, (l) => l.week, (l) => l.direction));
}

/** counts/{date}.json: per story, entries added that day, resolvable branches due that day, verdicts that day (by fact date); `articles` = article facts of that day (raw, not stories); `articlesPlaced` (only when nonzero) = those placed on a story by an assignment. */
function buildCount(date, facts, aliases, builtFrom) {
  const byStory = {};
  const bump = (threadId, field, n = 1) => {
    const id = aliases.get(threadId) || threadId;
    const row = byStory[id] || (byStory[id] = {newEntries: 0, branchesDue: 0, verdicts: 0});
    row[field] = (row[field] || 0) + n;
  };
  let articles = 0;
  for (const f of facts) {
    if (f.kind === 'article' && f.date === date) articles += 1;
    if (!f.threadId) continue;
    if (f.kind === 'entry' && f.date === date) bump(f.threadId, 'newEntries');
    else if (f.kind === 'article' && f.date === date) bump(f.threadId, 'articlesPlaced'); // placed by an assignment; not selected news
    else if (f.kind === 'verdict' && f.date === date) bump(f.threadId, 'verdicts');
    else if (f.kind === 'forecast_drawn') { const n = f.payload.branches.filter((b) => resolvable(b) && b.due === date).length; if (n) bump(f.threadId, 'branchesDue', n); }
  }
  const sorted = Object.fromEntries(Object.keys(byStory).sort().map((k) => [k, byStory[k]]));
  const total = {newEntries: 0, branchesDue: 0, verdicts: 0};
  for (const r of Object.values(sorted)) for (const k of Object.keys(total)) total[k] += r[k];
  const placed = Object.values(sorted).reduce((n, r) => n + (r.articlesPlaced || 0), 0);
  if (placed) total.articlesPlaced = placed; // only when an article was placed that day, so a build with none is unchanged
  return {schemaVersion: SCHEMA_VERSION, builtFrom, date, articles, byStory: sorted, total};
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
 * Everything 0037 section 1 lists. Options: today (UTC day), builtAt, runId, factsManifestDays (count),  countDays (default
 * countDaysFor(today)), readings (the lines of record/readings/*.jsonl, any order), operatorAliases
 * (record/operator/aliases.json or null). Throws when all.json is over its hard cap.
 */
function buildViews(allFacts, {today, builtAt, runId, factsManifestDays, countDays = countDaysFor(today), readings: readingLines = [], operatorAliases = null, notes: noteLines = []}) {
  const sorted = ordered(allFacts);
  const {placed: facts, reassigned, keep} = placeEntries(sorted);
  const factsThrough = maxOf(sorted.filter((f) => f.kind !== 'run').map((f) => f.date));
  const standingReadings = Rd.standing(readingLines);
  const readingsThrough = Rd.maxWeek(standingReadings);
  const builtFrom = {factsThrough, readingsThrough};
  const readings = Rd.byThread(standingReadings);
  const {canon, isGeneric} = Rd.actorAliases(operatorAliases, standingReadings);
  const resolved = resolveAliases(facts);
  const {aliases} = resolved;
  const {stories, rows, survivors} = projectStories(facts, resolved, {today, builtFrom, readings, canon, reassigned, keep, notesBy: entryNotesBy(noteLines), analysisBy: storyAnalysisBy(noteLines)});

  const cutoff = addDays(today, 1 - ACTIVE_DAYS);
  const all = [...rows.values()].sort(rowOrder);
  const activeRows = all.filter((r) => !r.aliasOf && r.lastFactAt && r.lastFactAt.slice(0, 10) >= cutoff);
  const links = buildLinks(activeRows, survivors, builtFrom, readings, aliases, isGeneric);
  // Every story gets a links view, so a story that was merged or went inactive overwrites its old file instead of leaving it stale
  // (views are never deleted; the rebuild test found 7 merged stories still showing links from 2026-10-23).
  for (const id of stories.keys()) {
    if (!links.has(id)) links.set(id, {schemaVersion: SCHEMA_VERSION, builtFrom, threadId: id, links: [], confirmedLinks: [], confirmedLinksReason: NO_READING});
  }
  // the story web's model-judged links (link notes, 0042) beside the computed shared-fact links
  // titles and places as the web index keeps them (newest entry of the last 30 days), not the story row's first title
  const info = windowInfos(facts, today);
  const rowTitles = new Map(all.map((r) => [r.threadId, r.title || null]));
  const {newest, webs} = newestWebs(noteLines, today);
  // a story with no entry in the window is titled by its node summary in the web (the index's titleOf), then by the record's row
  const summaries = new Map();
  for (const [, w] of [...webs].sort((a, b) => (a[0] < b[0] ? -1 : 1))) for (const x of w.payload.nodes) if (x.summary && !summaries.has(x.threadId)) summaries.set(x.threadId, x.summary);
  const titleOf = (id) => (info.get(id) || {}).title ?? summaries.get(id) ?? rowTitles.get(id) ?? null;
  const judged = judgedLinksBy(noteLines, newest, titleOf);
  const coverage = webCoverageBy(webs, judged, info, today, titleOf);
  for (const [id, view] of links) {
    view.judgedLinks = judged.get(id) || [];
    view.web = coverage.get(id) || {state: null, entries: 0, places: [], analysedIn: [], backbone: [], otherPlaces: {}};
  }
  const counts = new Map(countDays.map((d) => [d, buildCount(d, facts, aliases, builtFrom)]));
  const active = {schemaVersion: SCHEMA_VERSION, builtFrom, stories: activeRows};
  const everything = {schemaVersion: SCHEMA_VERSION, builtFrom, stories: all};
  const size = bytesOf(everything);
  if (size > ALL_INDEX_MAX_BYTES) throw new Error(`views: index/all.json is ${size} bytes, over the ${ALL_INDEX_MAX_BYTES} cap; it needs the shard decision of 0037`);
  const manifest = {schemaVersion: SCHEMA_VERSION, builtAt, runId, factsManifestDays, factsThrough, readingsThrough};
  return {stories, links, counts, active, all: everything, manifest, countries: countryViews(noteLines, builtFrom)};
}

/** The write order of 0037 section 2 as groups of [key, object]; the groups are written one after another, manifest last. */
function writeGroups(views) {
  const keyed = (dir, map) => [...map].map(([id, obj]) => [`${dir}/${id}.json`, obj]);
  return [
    [...keyed('stories', views.stories), ...keyed('links', views.links), ...keyed('counts', views.counts), ...keyed('countries', views.countries || new Map())],
    [['index/active.json', views.active]],
    [['index/all.json', views.all]],
    [['manifest.json', views.manifest]],
  ];
}

module.exports = {SCHEMA_VERSION, ACTIVE_DAYS, ENTRY_CAP, LINKS_MAX, SPECIFIC_SHARE, LINK_WINDOW_DAYS, ALL_INDEX_MAX_BYTES, resolveAliases, currentAssignments, buildViews, countDaysFor, writeGroups, bytesOf};
