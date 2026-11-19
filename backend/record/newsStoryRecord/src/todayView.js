'use strict';

// index/today.json (decision 0051): what the pages that still read DynamoDB for "today" need, built from the entries inbox (the agent's lines of the
// last two UTC days) and the entry notes. It replaces the actions `topics` (NewsCache `latest`), `today` (`today-archive`) and, for the entries of the
// latest run, `summary` / `prediction` / `trace_cause` (SummarizeAndPredict `TOPIC#`). Pure: no I/O, no clock. Public data only: every field here is what
// those five actions answer to an anonymous caller (none of them checks membership; drift depth and the corrections ledger, which are gated, are not here).
//
// Why it reads the inbox lines and not the entry facts: the entry fact keeps what the record needs (identity, sources, places, actors), but the pages
// also show `urgency`, `x_trending`, `primaryCountry` (only the `latest` item holds them) and the order and membership of the latest run, and the
// `today` list keeps the replacement rule of the `today-archive` item (a topic seen again replaces its earlier entry across midnight too). The lines
// carry all of it, and the entry notes (0042) carry the full model text.
const R = require('./_shared/record');
const inbox = require('./_shared/entriesInbox');

const SCHEMA_VERSION = 1;
const PARTS = {summary: 'summary', prediction: 'prediction', cause: 'trace_cause'}; // entry note part -> the action's name

const noteOf = (n) => ({format: n.format, content: n.content, at: n.at, model: n.model});

/**
 * @param {{day: string, lines: object[]}[]} days  the inbox lines of the last two UTC days, oldest day first (a day without a file may be left out)
 * @param {Map<string, object>} notesBy            entryNotesBy(): eventId -> {summary?, prediction?, cause?} (latest note per part)
 * @returns the view, or null when there are no lines at all (the agent has not written the inbox: the pages keep their actions)
 */
function todayIndex(days, notesBy, builtFrom) {
  if (!days.some((d) => d.lines.length)) return null;

  // the today-archive replay, batch by batch in time order, remembering the archive day each entry was written under (its identity needs it)
  let list = [];
  let updatedAt = null;
  for (const {day, lines} of days) {
    for (const b of inbox.batchesOf(lines)) {
      const cutoff = Date.parse(b.batch) - inbox.TODAY_WINDOW_MS;
      const fresh = b.lines.map(inbox.entryOfLine).map((e) => ({...e, eventId: R.entryIdentity({sources: e.sources, date: day, title: e.title}).eventId}));
      list = inbox.mergeArchiveDay(list, fresh, {keep: (e) => Date.parse(e.archivedAt) > cutoff});
      updatedAt = b.batch;
    }
  }
  const floor = Date.parse(updatedAt) - inbox.TODAY_WINDOW_MS; // the entries still inside the 24 h window of the newest write; the page cuts again at read time
  list = list.filter((e) => Date.parse(e.archivedAt) > floor);

  // the latest run: the newest batch of the newest day, when it is the whole selection
  const newest = [...days].reverse().find((d) => d.lines.length);
  const sel = inbox.latestSelection(newest.lines);
  const selected = new Map();
  if (sel) for (const l of sel.lines) selected.set(l.topicId, l);
  const latest = sel ? {
    batch: sel.batch, generationId: sel.run.generationId ?? null, model: sel.run.model ?? null, limit: sel.run.limit ?? null, updatedAt: sel.run.updatedAt ?? null,
    generatedDate: sel.run.generatedDate ?? null, generatedYear: sel.run.generatedYear ?? null, topicIds: sel.topicIds,
  } : null;

  const entries = list.map((e) => {
    const line = selected.get(e.topicId);
    const isLatest = Boolean(line) && e.archivedAt === line.archivedAt;
    const parts = isLatest ? notesBy.get(e.eventId) : null;
    const notes = parts ? Object.fromEntries(Object.entries(parts).filter(([p]) => PARTS[p]).map(([p, n]) => [PARTS[p], noteOf(n)])) : null;
    return {...e, ...(isLatest && line.latest ? {latest: line.latest} : {}), ...(notes && Object.keys(notes).length ? {notes} : {})};
  });
  return {schemaVersion: SCHEMA_VERSION, builtFrom, updatedAt, latest, entries};
}

const ROLES = ['start', 'move', 'measure'];

/** What a Today card or a map row shows of a story, copied from its view (decision 0058: the builder stamps, pages display). */
function storyCard(s) {
  const a = s.analysis || null;
  return {
    title: s.title, born: s.born, category: s.category, iso3: s.iso3, regions: s.regions, tier: s.tier, riskScore: s.riskScore,
    stepCount: s.stepCount, stepDays: s.stepDays, firstStep: s.firstStep, newestStep: s.newestStep,
    // the model's watch questions (analysis note, model text) and when it wrote them; none is an empty list
    watch: a && Array.isArray(a.watchQuestions) ? a.watchQuestions.filter((q) => typeof q === 'string' && q.trim()) : [], watchAt: a ? a.generatedAt ?? null : null,
  };
}

/**
 * The today view with each entry placed in its story (decisions 0058, 0063): `storyId` is the story view that holds the entry's eventId now
 * (merges and moves applied; the entry's own `threadId` stays as the agent wrote it), `role` its kind there (the story view row's role);
 * both null when no story view holds it. `stories` holds a storyCard per storyId, and `latest.roles` counts the latest run's items by role
 * (`none`: no story, or role null). Pure; null in, null out.
 */
function withStories(view, stories) {
  if (!view) return null;
  const at = new Map();
  for (const [id, s] of stories) if (!s.aliasOf) for (const e of s.entries || []) if (e.kind !== 'article') at.set(e.eventId, {storyId: id, role: e.role ?? null});
  const entries = view.entries.map((e) => ({...e, ...(at.get(e.eventId) || {storyId: null, role: null})}));
  const ids = [...new Set(entries.map((e) => e.storyId).filter(Boolean))].sort();
  let latest = view.latest;
  if (latest) {
    const byTopic = new Map();
    for (const e of entries) if (!byTopic.has(e.topicId) || e.latest) byTopic.set(e.topicId, e); // the latest run's entry of a topic carries `latest`
    const roles = {start: 0, move: 0, measure: 0, none: 0};
    for (const id of latest.topicIds) { const r = (byTopic.get(id) || {}).role; roles[ROLES.includes(r) ? r : 'none'] += 1; }
    latest = {...latest, roles};
  }
  return {...view, latest, entries, stories: Object.fromEntries(ids.map((id) => [id, storyCard(stories.get(id))]))};
}

module.exports = {todayIndex, withStories, SCHEMA_VERSION};
