// The library of recover-late-slots.mjs (decision 0061): rebuild what a missed news run saw, run the live selection and the live summary and
// cause-note steps on it, and make the entries-inbox lines and entry notes. Pure apart from the injected `call` (the one model call) and `now`
// (the real clock, used only for the written-at time). No AWS, no env, no key: the script owns those. Tests: recover-late.test.mjs.
//
// What a live run reads that the script has to rebuild as of the slot: the article pool (from the saved raw lines), the seen-today list and the
// archive entries of the slot's day and the 14 before (from the entries inbox, plus the script's own earlier replayed slots), from which the
// shared followedStories builds the stories we follow. The live DynamoDB rows are never read.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const S = require('../../pipeline/newsInvokeGemini/src/selection.js');
const T = require('../../pipeline/NewsProjectInvokeAgentLambda/src/story-text.js');
const agentLib = require('../../pipeline/NewsProjectInvokeAgentLambda/src/lib.js');
const threading = require('../../pipeline/NewsProjectInvokeAgentLambda/src/threading.js');
const reads = require('../../pipeline/NewsProjectInvokeAgentLambda/src/inbox-reads.js');
const inbox = require('../../shared/src/entriesInbox.js');
const notes = require('../../shared/src/notes.js');
const { ageLabel } = require('../../shared/src/rss.js');

export const DAY_MS = 86400000;
export const SLOTS = ['2026-11-14T20:15:00.000Z', '2026-11-15T04:15:00.000Z', '2026-11-15T12:15:00.000Z', '2026-11-15T20:15:00.000Z'];
export const PRODUCER = 'recover-late-slots';
// The slot is when the run started (cron :15); its raw capture stamps fetchedAt about 20 s later, before the model call, so a line counts up to here.
export const FETCH_WINDOW_MS = 5 * 60 * 1000;
const TEXT_TTL_SECONDS = 259200; // the agent's SUMMARY_PREDICT_TTL_SECONDS default (the item is only a carrier for the entry note here)
const ARCHIVE_SOURCE_CAP = 10; // the daily archive row's source cap (DAILY_ARCHIVE_MAX_SOURCES)
const THREADING_DAYS = 7; // the agent's threading window (readPastArchiveEntries(7))
const iso = (ms) => new Date(ms).toISOString();
export const dayOf = (v) => String(v).slice(0, 10);
export const addDays = (day, n) => iso(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).slice(0, 10);
export const slotTag = (slot) => `${slot.slice(0, 10)}T${slot.slice(11, 13)}${slot.slice(14, 16)}`;

// ---- the article pool of a slot ---------------------------------------------------------------------------------------------------------

const FEED_INDEX = new Map(S.RSS_FEEDS.map((f, i) => [f.name, i]));
const SOURCE_OF = new Map(S.RSS_FEEDS.map((f) => [f.name, f.source]));

/**
 * The pool a live run at `slotMs` would have fetched, from the saved raw lines (record/inbox/articles, day files S-3..S): a line counts when it was
 * first seen by that run or before (fetchedAt up to FETCH_WINDOW_MS after the slot); the age label is computed as of the slot; per feed the newest FEED_FETCH_CAP, the live age and blocked-domain
 * filter, one row per url, in feed order. -> { articles, stats }. What the lines cannot give: items that had left a feed's newest 25 by the slot
 * still appear, items without a publish time are placed after the dated ones of their feed and stay for ever, a feed that failed that run is absent.
 */
export function poolAsOf(lines, slotMs) {
  const stats = { lines: lines.length, afterSlot: 0, duplicateRawId: 0, unknownFeed: 0, unknownFeeds: {}, capped: 0, filtered: 0, duplicateUrl: 0, undated: 0 };
  const byRaw = new Map();
  for (const l of lines) {
    if (!l || !l.url) continue;
    if (Date.parse(l.fetchedAt) > slotMs + FETCH_WINDOW_MS) { stats.afterSlot += 1; continue; }
    const key = l.rawId || l.url;
    const had = byRaw.get(key);
    if (had) { stats.duplicateRawId += 1; if (Date.parse(l.fetchedAt) >= Date.parse(had.fetchedAt)) continue; }
    byRaw.set(key, l);
  }
  const perFeed = new Map();
  for (const l of byRaw.values()) {
    if (!FEED_INDEX.has(l.feed)) { stats.unknownFeed += 1; stats.unknownFeeds[l.feed] = (stats.unknownFeeds[l.feed] || 0) + 1; continue; }
    (perFeed.get(l.feed) || perFeed.set(l.feed, []).get(l.feed)).push(l);
  }
  const rows = [];
  for (const [feed, list] of [...perFeed].sort((a, b) => FEED_INDEX.get(a[0]) - FEED_INDEX.get(b[0]))) {
    list.sort((a, b) => (Date.parse(b.publishedAt) || -Infinity) - (Date.parse(a.publishedAt) || -Infinity) || String(a.url).localeCompare(String(b.url)));
    stats.capped += Math.max(0, list.length - S.FEED_FETCH_CAP);
    for (const l of list.slice(0, S.FEED_FETCH_CAP)) {
      const pub = l.publishedAt ? Date.parse(l.publishedAt) : NaN;
      if (!Number.isFinite(pub)) stats.undated += 1;
      rows.push({
        title: l.title, url: l.url, description: l.snippet || '', age: Number.isFinite(pub) ? ageLabel(pub, slotMs) : '',
        publishedAt: Number.isFinite(pub) ? iso(pub) : null, lang: l.lang || null, source: SOURCE_OF.get(feed), feed,
      });
    }
  }
  const fresh = rows.filter((a) => !S.shouldFilterArticle(a));
  stats.filtered = rows.length - fresh.length;
  const articles = S.dedupeByUrl(fresh);
  stats.duplicateUrl = fresh.length - articles.length;
  stats.pool = articles.length;
  return { articles, stats };
}

// ---- the entries window of a slot -------------------------------------------------------------------------------------------------------

/** The lines of one day as of the slot: the live ones written at or before it (a line the script itself wrote earlier is not "live"), then the replayed ones. */
function dayLines(day, slotMs, liveByDay, replayed) {
  const live = (liveByDay[day] || []).filter((l) => !l.writtenLate && Date.parse(l.batch) <= slotMs);
  return [...live, ...(replayed[day] || [])];
}

/**
 * What the live run read from DynamoDB, rebuilt from the entries inbox as of the slot:
 *   archiveEntries     {date, title, threadId, archivedAt} of the slot's day and the S.FOLLOWED_DAYS before, newest day first (the selector's readArchiveEntries)
 *   pastEntries        the slot's day and the THREADING_DAYS before, as the agent's threading window (readPastArchiveEntries)
 *   seenEntries        the seen-today list: every earlier run's topics, merged as the selector merges them, the last 24 h
 * `liveByDay` = day -> the entries inbox lines of the live runs; `replayed` = day -> the lines of the script's own earlier slots.
 */
export function windowAsOf({ liveByDay, replayed, slotMs }) {
  const slotDay = dayOf(iso(slotMs));
  const archiveEntries = [];
  const pastEntries = [];
  for (let i = 0; i <= S.FOLLOWED_DAYS; i++) {
    const day = addDays(slotDay, -i);
    const item = reads.archiveOfLines(dayLines(day, slotMs, liveByDay, replayed));
    if (!item) continue;
    for (const e of item.entries) if (e.title) archiveEntries.push({ date: day, title: e.title, threadId: e.threadId || null, archivedAt: e.archivedAt || null });
    if (i <= THREADING_DAYS) pastEntries.push(...reads.pastEntriesOfDay(day, item.entries));
  }
  // the seen-today list: runs in time order; the ingest wrote it at its own time (the staging item's updatedAt), the replayed ones at the slot
  const runs = [];
  for (const day of [addDays(slotDay, -1), slotDay]) {
    for (const b of inbox.batchesOf((liveByDay[day] || []).filter((l) => !l.writtenLate))) {
      const withRun = b.lines.find((l) => l.run && l.run.updatedAt);
      const atMs = Date.parse(withRun ? withRun.run.updatedAt : b.batch);
      if (Number.isFinite(atMs) && atMs <= slotMs) runs.push({ atMs, titles: b.lines.map((l) => l.title).filter(Boolean) });
    }
    for (const b of inbox.batchesOf(replayed[day] || [])) {
      const atMs = Date.parse(b.lines[0].writtenLate.slot);
      if (atMs <= slotMs) runs.push({ atMs, titles: b.lines.map((l) => l.title).filter(Boolean) });
    }
  }
  let seen = [];
  for (const r of runs.sort((a, b) => a.atMs - b.atMs)) seen = S.nextSeenEntries(S.freshSeen(seen, r.atMs), r.titles.map((title) => ({ title })), r.atMs);
  return { archiveEntries, pastEntries, seenEntries: S.freshSeen(seen, slotMs) };
}

// ---- the model, metered -----------------------------------------------------------------------------------------------------------------

/** USD per million tokens from newsHealth's prices.json for a model (an `anthropic:` prefix is ignored); throws for a model without a price. */
export function priceOf(prices, model) {
  const name = String(model).replace(/^[a-z]+:/, '');
  const p = (prices.prices || []).find((x) => x.model === name || (x.aliases || []).includes(name));
  if (!p) throw new Error(`no price for model ${name}`);
  return p.offPeak;
}

/** The cost in USD of one usage object ({prompt_tokens, completion_tokens, prompt_cache_hit_tokens}). */
export function costOf(price, usage) {
  const u = usage || {};
  const hit = u.prompt_cache_hit_tokens || 0;
  return (((u.prompt_tokens || 0) - hit) * price.in + hit * price.cacheHit + (u.completion_tokens || 0) * price.out) / 1e6;
}

/**
 * The one door to the model: asserts the request is an Anthropic one (never DeepSeek), refuses a call that could take the spend past the cap, and
 * counts every request (a retry inside `chat` is its own `[usage]` line, which `count()` is fed with). `chat` is the shared llm.js chat, injected.
 */
export function makeMeter({ chat, resolveProvider, prices, capUsd, maxInFlight = 2, log = () => {} }) {
  const m = { calls: 0, requests: 0, usd: 0, reserved: 0, promptTokens: 0, completionTokens: 0, byStep: {}, log: [], inFlight: 0, peakInFlight: 0 };
  const count = (step, model, usage) => {
    const cost = costOf(priceOf(prices, model), usage);
    m.requests += 1;
    m.usd += cost;
    m.promptTokens += (usage && usage.prompt_tokens) || 0;
    m.completionTokens += (usage && usage.completion_tokens) || 0;
    const s = (m.byStep[step] ||= { requests: 0, usd: 0, promptTokens: 0, completionTokens: 0 });
    s.requests += 1; s.usd += cost; s.promptTokens += (usage && usage.prompt_tokens) || 0; s.completionTokens += (usage && usage.completion_tokens) || 0;
    m.log.push({ step, model, usage, usd: cost });
  };
  async function call(opts) {
    if (resolveProvider(opts).provider !== 'anthropic') throw new Error(`refusing a call to ${resolveProvider(opts).provider}: this script calls Anthropic only`);
    const price = priceOf(prices, opts.model);
    // the most one call can cost: its input (a character is at most one token) and its output cap
    const worst = ((String(opts.user || '').length + String(opts.system || '').length) * price.in + (opts.maxTokens || 0) * price.out) / 1e6;
    if (m.usd + m.reserved + worst > capUsd) throw new Error(`spend cap: ${m.usd.toFixed(2)} USD spent, this call could take it past ${capUsd} USD`);
    if (m.inFlight >= maxInFlight) throw new Error('more than the allowed calls in flight');
    m.inFlight += 1;
    m.reserved += worst;
    m.peakInFlight = Math.max(m.peakInFlight, m.inFlight);
    m.calls += 1;
    try { return await chat(opts); } finally { m.inFlight -= 1; m.reserved -= worst; }
  }
  return { call, count, state: m, log };
}

/** `[usage] {...}` lines printed by llm.js -> count() calls, so every request (a retry too) is priced. Returns the restore function. */
export function captureUsage(meter, sink = console) {
  const orig = sink.log;
  sink.log = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith('[usage] ')) {
      try { const u = JSON.parse(first.slice(8)); meter.count(u.step, u.model, u); } catch { /* not a usage line */ }
      return;
    }
    orig.apply(sink, args);
  };
  return () => { sink.log = orig; };
}

/** Run `fn` over the items, at most `n` at a time, keeping order. */
export async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next; next += 1; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// ---- one slot ---------------------------------------------------------------------------------------------------------------------------

const dateText = (ms) => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * Replay one missed slot. Selection with the live prompt and rules, then the live summary and cause-note steps per topic (never the forecast), then
 * the entries-inbox lines and entry notes. -> { ok, ... }. `cfg` = { limit, selectionModel, agentModel, agentEnv (MAX_TOKENS...), concurrency }.
 * `deps` = { call (meter.call), now (the real clock) }. Nothing is written here.
 */
export async function replaySlot({ slot, articleLines, liveByDay, replayed, deps, cfg }) {
  const slotMs = Date.parse(slot);
  const slotDay = dayOf(slot);
  const out = { slot, tag: slotTag(slot), day: slotDay, ok: false, failures: [] };
  const { articles, stats } = poolAsOf(articleLines, slotMs);
  const win = windowAsOf({ liveByDay, replayed, slotMs });
  out.pool = stats;
  const { stories } = S.followedStories(win.archiveEntries, slotMs);
  out.window = { archiveEntries: win.archiveEntries.length, followedStories: stories.length, pastEntries: win.pastEntries.length, seenEntries: win.seenEntries.length };

  // 1. topic selection: the live prompt, options and rules
  const { prompt, promptCount } = S.selectionRequest({ articles, limit: cfg.limit, stories });
  out.promptArticles = promptCount;
  out.selectionPrompt = prompt;
  const reply = await deps.call(S.selectionChatOptions({ prompt, model: cfg.selectionModel }));
  out.selectionReply = reply.content;
  out.selectionFinish = reply.finishReason;
  let selection;
  try {
    selection = S.processSelection({ text: reply.content, articles, seenEntries: win.seenEntries, archiveEntries: win.archiveEntries, stories, limit: cfg.limit, nowMs: slotMs, env: {} });
  } catch (e) {
    out.failures.push({ stage: 'selection-parse', message: e.message });
    return out;
  }
  out.selection = { topics: selection.topics.length, beforeFilters: selection.normalizedCount, droppedRepeats: selection.droppedRepeats, sourcesFiltered: selection.sourcesFiltered };
  if (!selection.topics.length) { out.failures.push({ stage: 'selection', message: 'no topic passed the filters' }); return out; }

  // 2. the agent's text steps on the topics, as the live agent built them
  const generatedDate = dateText(slotMs);
  const generationId = `gen-late-${slotMs}`;
  const raw = selection.topics;
  const topics = raw.map((t, idx) => T.buildTopic(t, idx));
  const threadIdById = {};
  for (const rec of threading.joinRun(raw.map((t, idx) => ({ ...t, id: T.buildStableTopicId(t, idx) })), win.pastEntries)) threadIdById[rec.topicId] = rec.threadId;
  const defaults = T.storyDefaults(cfg.agentEnv);
  const texts = await mapLimit(topics, cfg.concurrency, async (topic) => {
    const got = { topic, items: {}, errors: [] };
    for (const kind of T.TEXT_KINDS) {
      try {
        const prompt2 = T.textPrompt(kind, topic, generatedDate);
        const r = await deps.call(T.storyChatOptions({ prompt: prompt2, maxTokens: defaults.maxTokens, model: agentModelFor(kind, cfg), step: kind, json: kind === 'trace_cause', temperature: defaults.temperature, topP: defaults.topP }));
        const response = T.finishText(kind, T.storyAnswer(r));
        got.items[kind] = T.buildCacheItem({
          pk: `TOPIC#${topic.id}`, sk: kind === 'summary' ? 'SUMMARY' : 'TRACE_CAUSE', topic, kind, response, ttlSeconds: TEXT_TTL_SECONDS, generationId,
          fingerprint: agentLib.sourceFingerprint(topic), threadId: threadIdById[topic.id], nowMs: Date.parse(deps.now()),
        });
        got.items[kind].finishReason = r.finishReason;
      } catch (e) {
        got.errors.push({ kind, message: e.message });
      }
    }
    return got;
  });
  for (const t of texts) for (const e of t.errors) out.failures.push({ stage: e.kind, topicId: t.topic.id, message: e.message });

  // 3. the archive entries and the inbox lines, marked written late; a story with neither text is left out (nothing to show), and said so
  const writtenAt = deps.now();
  const kept = texts.filter((t) => t.items.summary || t.items.trace_cause);
  out.skippedNoText = texts.filter((t) => !(t.items.summary || t.items.trace_cause)).map((t) => t.topic.id);
  const entries = kept.map((t) => ({
    ...T.buildArchiveEntry(t.topic, { summary: t.items.summary ? t.items.summary.content : null, prediction: null, trace_cause: t.items.trace_cause ? t.items.trace_cause.content : null }, generationId, ARCHIVE_SOURCE_CAP, threadIdById[t.topic.id], writtenAt),
    writtenLate: { writtenAt, slot },
  }));
  const rawById = {};
  raw.forEach((t, idx) => { rawById[T.buildStableTopicId(t, idx)] = t; });
  const run = { of: raw.length, model: cfg.selectionModel, limit: cfg.limit, updatedAt: slot, generatedDate, generatedYear: new Date(slotMs).getUTCFullYear(), generationId };
  out.lines = inbox.inboxLines(entries, { batch: writtenAt, selection: { topics: rawById, run } });
  const producer = { lambda: PRODUCER, runId: generationId };
  out.notes = kept.flatMap((t, i) => Object.values(t.items).map((item) => notes.entryNote({ item, topic: entries[i], archiveDate: slotDay, producer })).filter(Boolean));
  out.stories = kept.map((t, i) => ({ topicId: t.topic.id, title: t.topic.title, category: entries[i].category, threadId: entries[i].threadId, sources: entries[i].sources, summary: t.items.summary ? t.items.summary.content : null, cause: t.items.trace_cause ? t.items.trace_cause.content : null }));
  out.topicTitles = raw.map((t) => ({ title: t.title, category: t.category, sources: t.sources.length, outlets: new Set(t.sources.map((s) => s.outlet || s.source)).size }));
  out.ok = true;
  return out;
}

/** The agent's model for a text kind: the same rule the live agent applies (lib.modelForKind over GROK_MODEL and PREDICTION_MODEL). */
function agentModelFor(kind, cfg) {
  return agentLib.modelForKind(kind, { GROK_MODEL: cfg.agentModel, PREDICTION_MODEL: '' });
}

/** The replayed lines of a day after this slot joined them (file order = time order). */
export function addReplayed(replayed, day, lines) {
  replayed[day] = [...(replayed[day] || []), ...lines];
}

/** How many entries the day's replay keeps: a day holds at most MAX_ARCHIVE_ENTRIES, an earlier topic of the same id is replaced. */
export function dayReplay(lines) {
  const { entries } = inbox.replayDay(lines);
  const topics = new Set(lines.map((l) => l.topicId));
  return { kept: entries.length, distinctTopics: topics.size, dropped: topics.size - entries.length };
}
