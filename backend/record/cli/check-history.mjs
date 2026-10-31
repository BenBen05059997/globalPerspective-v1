// Measures a copy of the record against DynamoDB after the history copy (decision 0047). Local files only; nothing is written anywhere
// but stdout.
//
//   node check-history.mjs --record DIR [--fallback DIR] --ddb DIR [--live-views DIR] [--from 2026-03-07]
//
//   --record     the record to measure: a directory with facts/, views/, legacy/ (the dry run's <out>/record/shadow/, or `aws s3 sync` of record/)
//   --fallback   read-through for files --record lacks (the seed of the dry run: a copy of the live record/)
//   --ddb        archive.json (archive#DAY rows), pred.json (PRED# rows) and, optionally, thread_analysis.json (THREAD_ANALYSIS items), each a
//                JSON array of plain items (what `backfill-history.mjs --ddb-cache` writes; thread_analysis.json is a Scan with SK = THREAD_ANALYSIS)
//   --live-views a copy of the live record/views/, to compare stories and the track record before and after
//
// Prints one JSON report: entries per archive month against the facts (every archive entry is a fact, or says why not), stories, forecasts,
// analyses and notes the CLIs would write, view sizes, and what changed against the live views.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { memoryClient } from './backfill-history.mjs';
import { planArchiveNotes } from './backfill-entry-notes.mjs';
import { planStoryAnalysisNotes } from './backfill-story-analysis-notes.mjs';

const require = createRequire(import.meta.url);
const world = require('../../shared/src/world');
const R = require('../../shared/src/record.js');

const dayOf = (sourceKey) => (/^archive#(\d{4}-\d{2}-\d{2})\|/.exec(sourceKey || '') || [])[1] || null;

export function openRecord({ record, fallback }) {
  const find = (rel) => [record, fallback].filter(Boolean).map((d) => path.join(d, rel)).find((p) => fs.existsSync(p)) || null;
  const text = (rel) => { const p = find(rel); return p ? fs.readFileSync(p, 'utf8') : null; };
  return {
    text,
    json: (rel) => { const t = text(rel); return t ? JSON.parse(t) : null; },
    lines: (rel) => { const t = text(rel); return t ? t.split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; },
  };
}

const month = (d) => d.slice(0, 7);
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

export function report({ rec, ddb, liveViews, from }) {
  const factDays = (rec.json('facts/manifest.json') || { days: [] }).days;
  const facts = factDays.flatMap((d) => rec.lines(`facts/${d}.jsonl`));
  const kinds = {};
  for (const f of facts) bump(kinds, f.kind);

  // ---- archive entries against entry facts (the reader's normalised entries, so ids are the ones the facts run computed) ----
  const client = memoryClient({ archive: ddb.archive, pred: ddb.pred });
  const archiveDays = ddb.archive.map((r) => r.id.slice(8)).sort();
  const entryFacts = facts.filter((f) => f.kind === 'entry');
  const bySourceKey = new Map(entryFacts.map((f) => [f.sourceKey, f]));
  const byEvent = new Map();
  for (const f of entryFacts) (byEvent.get(f.eventId) || byEvent.set(f.eventId, []).get(f.eventId)).push(f);
  const months = {};
  const perDay = {};
  const archiveEntries = [];
  return (async () => {
    for (const d of archiveDays) {
      const day = await world.archiveDay(client, d, {});
      for (const e of day.entries) archiveEntries.push(e);
    }
    for (const e of archiveEntries) {
      const m = (months[month(e.date)] ||= { archiveEntries: 0, facts: 0, listedAgainSameDay: 0, listedAgainEarlier: 0, listedAgainLater: 0, noFact: 0, noThread: 0 });
      const day = (perDay[e.date] ||= { archive: 0, facts: 0 });
      m.archiveEntries += 1;
      day.archive += 1;
      if (!e.threadId) m.noThread += 1;
      if (bySourceKey.has(e.sourceKey)) { m.facts += 1; day.facts += 1; continue; }
      const id = R.entryIdentity({ sources: e.sources, date: e.date, title: e.title }).eventId;
      const others = byEvent.get(id) || [];
      if (!others.length) { m.noFact += 1; continue; }
      const first = others.map((f) => dayOf(f.sourceKey)).sort()[0];
      if (first === e.date) m.listedAgainSameDay += 1; else if (first < e.date) m.listedAgainEarlier += 1; else m.listedAgainLater += 1;
    }
    const pre = (k) => Object.entries(months).reduce((t, [mo, m]) => t + m[k], 0);
    const totals = Object.fromEntries(['archiveEntries', 'facts', 'listedAgainSameDay', 'listedAgainEarlier', 'listedAgainLater', 'noFact', 'noThread'].map((k) => [k, pre(k)]));
    const dupEvents = [...byEvent.values()].filter((l) => l.length > 1);
    const entries = {
      archiveDays: archiveDays.length, entryFacts: entryFacts.length, months, totals,
      archiveDaysWithNoEntryFact: archiveDays.filter((d) => !perDay[d] || !perDay[d].facts),
      sameEventTwoFacts: dupEvents.length, // an article listed again more than 100 days later: two facts, the views keep the earlier
      sep05: { archive: (perDay['2026-09-05'] || {}).archive, facts: (perDay['2026-09-05'] || {}).facts, factsInFile: facts.filter((f) => f.kind === 'entry' && f.date === '2026-09-05').length },
    };

    // ---- stories ----
    const all = rec.json('views/index/all.json');
    const stories = (all ? all.stories : []);
    const live = liveViews ? JSON.parse(fs.readFileSync(path.join(liveViews, 'index/all.json'), 'utf8')).stories : [];
    const liveIds = new Set(live.map((s) => s.threadId));
    const archiveThreads = new Set(archiveEntries.filter((e) => e.threadId).map((e) => e.threadId));
    const bornFacts = facts.filter((f) => f.kind === 'story_born');
    const bornIds = new Set(bornFacts.map((f) => f.threadId));
    const firstDay = new Map();
    const lastDay = new Map();
    for (const e of archiveEntries) if (e.threadId) { if (!firstDay.has(e.threadId) || e.date < firstDay.get(e.threadId)) firstDay.set(e.threadId, e.date); if (!lastDay.has(e.threadId) || e.date > lastDay.get(e.threadId)) lastDay.set(e.threadId, e.date); }
    const span = [...archiveThreads].filter((t) => firstDay.get(t) < '2026-09-05' && lastDay.get(t) >= '2026-09-05');
    const byId = new Map(stories.map((s) => [s.threadId, s]));
    const bornDup = new Map();
    for (const f of bornFacts) (bornDup.get(f.eventId) || bornDup.set(f.eventId, []).get(f.eventId)).push(f);
    const storyReport = {
      archiveThreads: archiveThreads.size, storiesInView: stories.length, aliases: stories.filter((s) => s.aliasOf).length, liveStoriesBefore: live.length,
      archiveThreadsWithoutStory: [...archiveThreads].filter((t) => !byId.has(t)).length,
      storyBornFacts: bornFacts.length, storyBornEventIdsWithTwoFacts: [...bornDup.values()].filter((l) => l.length > 1).length,
      storiesWithoutEntries: stories.filter((s) => !s.aliasOf && s.entryCount === 0).length, storiesWithoutTitle: stories.filter((s) => !s.title).length,
      liveStoriesWithoutEntriesBefore: live.filter((s) => !s.aliasOf && s.entryCount === 0).length,
      archiveThreadsWithoutBornFact: [...archiveThreads].filter((t) => !bornIds.has(t)).length,
      spanning0905: {
        threads: span.length,
        bornEarlierNow: span.filter((t) => byId.has(t) && liveIds.has(t) && byId.get(t).born < (live.find((s) => s.threadId === t) || {}).born).length,
        bornFromArchiveFirstDay: span.filter((t) => byId.has(t) && byId.get(t).born === firstDay.get(t)).length,
        inLiveBefore: span.filter((t) => liveIds.has(t)).length,
      },
    };

    // ---- forecasts ----
    const forecastKeys = new Set(facts.filter((f) => f.kind === 'forecast_drawn').map((f) => f.sourceKey));
    const legacyDays = (rec.json('legacy/predictions/manifest.json') || { days: [] }).days;
    const legacy = legacyDays.flatMap((d) => rec.lines(`legacy/predictions/${d}.jsonl`));
    const legacyKeys = new Set(legacy.map((l) => `${l.pk}|${l.sk}`));
    const pm = {};
    for (const r of ddb.pred) {
      const key = `${r.PK}|${r.SK}`;
      const b = (pm[month(r.SK)] ||= { rows: 0, fact: 0, legacyCopy: 0, neither: 0, withQid: 0 });
      b.rows += 1;
      if (forecastKeys.has(key)) b.fact += 1; else if (legacyKeys.has(key)) b.legacyCopy += 1; else b.neither += 1;
      if ((r.scenarios || []).some((s) => (s.triggers || []).some((t) => t.qid))) b.withQid += 1;
    }
    const preRecord = ddb.pred.filter((r) => r.SK < '2026-09-05');
    const sep = ddb.pred.filter((r) => r.SK >= '2026-09-05' && r.SK <= '2026-09-30' && !r.threadId);
    const threadFromTitle = facts.filter((f) => f.kind === 'forecast_drawn' && f.payload.threadFrom === 'title').length;
    const forecasts = {
      predRows: ddb.pred.length, forecastFacts: forecastKeys.size, legacyCopies: legacy.length, byMonth: pm, threadFromTitle,
      preRecordRows: preRecord.length, preRecordAsFact: preRecord.filter((r) => forecastKeys.has(`${r.PK}|${r.SK}`)).length, preRecordLegacy: preRecord.filter((r) => legacyKeys.has(`${r.PK}|${r.SK}`)).length,
      preRecordWithQidOrQuestion: preRecord.filter((r) => (r.scenarios || []).some((s) => (s.triggers || []).some((t) => t.qid || t.question === true))).length,
      unthreaded0905to0930: { rows: sep.length, asFact: sep.filter((r) => forecastKeys.has(`${r.PK}|${r.SK}`)).length, legacy: sep.filter((r) => legacyKeys.has(`${r.PK}|${r.SK}`)).length },
    };

    // ---- analyses and notes the CLIs would write on this record ----
    const producer = { lambda: 'record/cli/check-history', runId: 'check' };
    const storyIds = new Set(stories.map((s) => s.threadId));
    const rows = factDays.map((d) => ({ date: d, entries: (ddb.archive.find((r) => r.id === `archive#${d}`) || {}).entries })).filter((r) => r.entries);
    const analysisPlan = ddb.analysis ? planStoryAnalysisNotes({ items: ddb.analysis, rows, storyIds, producer }) : null;
    const preAnalysis = ddb.analysis ? ddb.analysis.filter((a) => !liveIds.has(a.threadId)) : [];
    const entryPlan = planArchiveNotes({ rows, knownEventIds: new Set(entryFacts.map((f) => f.eventId)), producer });
    const analyses = analysisPlan && {
      rows: ddb.analysis.length, notInLiveStories: preAnalysis.length, matchedNow: analysisPlan.notes.length, unmatchedNow: analysisPlan.unmatched.length, failed: analysisPlan.failed.length,
      withCites: analysisPlan.notes.filter((n) => n.cites.length).length, notInLiveNowMatched: preAnalysis.filter((a) => storyIds.has(a.threadId)).length,
      unmatchedByMonth: analysisPlan.unmatched.reduce((o, u) => { bump(o, (u.generatedAt || '?').slice(0, 7)); return o; }, {}),
    };
    const notes = { entryNotes: entryPlan.notes.length, entryNotesUnmatched: entryPlan.unmatched.length, archiveEntriesWithAi: archiveEntries.length };

    // ---- views: sizes and what changed ----
    const sizeOf = (rel) => { const t = rec.text(rel); return t ? Buffer.byteLength(t) : null; };
    const idx = Object.fromEntries(['active', 'all', 'analyses', 'web', 'countries', 'weekly'].map((n) => [n, sizeOf(`views/index/${n}.json`)]));
    const storyFiles = stories.map((s) => ({ id: s.threadId, bytes: sizeOf(`views/stories/${s.threadId}.json`) })).filter((x) => x.bytes !== null);
    const views = {
      stories: storyFiles.length, indexBytes: idx, storiesBytes: storyFiles.reduce((t, x) => t + x.bytes, 0), largestStory: storyFiles.sort((a, b) => b.bytes - a.bytes)[0],
      allJsonCapBytes: 5 * 1024 * 1024, indexCapBytes: 2 * 1024 * 1024, activeStories: (rec.json('views/index/active.json') || { stories: [] }).stories.length,
    };
    let vsLive = null;
    if (liveViews) {
      const strip = (o) => JSON.stringify(o, (k, v) => (k === 'builtAt' || k === 'runId' ? undefined : v));
      const lv = (rel) => { const p = path.join(liveViews, rel); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
      const changed = { born: 0, entries: 0, forks: 0, iso3: 0, other: 0, same: 0 };
      for (const s of live) {
        const a = lv(`stories/${s.threadId}.json`);
        const b = rec.json(`views/stories/${s.threadId}.json`);
        if (!a || !b) continue;
        if (strip(a) === strip(b)) { changed.same += 1; continue; }
        if (a.born !== b.born) changed.born += 1;
        else if (strip(a.entries) !== strip(b.entries)) changed.entries += 1;
        else if (strip(a.forks) !== strip(b.forks)) changed.forks += 1;
        else changed.other += 1;
      }
      const tr = lv('track-record.json');
      const tn = rec.json('views/track-record.json');
      const drop = (o) => { const { asOf, builtFrom, ...rest } = o; return rest; };
      const trackRecord = tr && tn ? { equalExceptAsOf: strip(drop(tr)) === strip(drop(tn)), issued: [tr.questions.issued, tn.questions.issued], firstIssuedAt: [tr.questions.firstIssuedAt, tn.questions.firstIssuedAt], warmUp: [tr.questions.warmUp, tn.questions.warmUp], sampledTotal: [tr.questions.sampledTotal, tn.questions.sampledTotal], legacyExcluded: [tr.legacy.legacyPredictionsExcluded, tn.legacy.legacyPredictionsExcluded] } : null;
      const wk = [lv('index/weekly.json'), rec.json('views/index/weekly.json')];
      vsLive = { liveStories: live.length, storiesInBothCompared: Object.values(changed).reduce((t, n) => t + n, 0), changed, trackRecord, weeklyDays: wk[0] && wk[1] ? [Object.keys(wk[0].days).length, Object.keys(wk[1].days).length] : null, weeklyEntries: wk[0] && wk[1] ? [Object.values(wk[0].days).reduce((t, d) => t + d.entries.length, 0), Object.values(wk[1].days).reduce((t, d) => t + d.entries.length, 0)] : null };
    }
    return { factDays: factDays.length, firstFactDay: factDays[0], lastFactDay: factDays[factDays.length - 1], kinds, entries, stories: storyReport, forecasts, analyses, notes, views, vsLive };
  })();
}

async function main() {
  const { values } = parseArgs({ options: { record: { type: 'string' }, fallback: { type: 'string' }, ddb: { type: 'string' }, 'live-views': { type: 'string' }, from: { type: 'string' } } });
  if (!values.record || !values.ddb) throw new Error('usage: check-history.mjs --record DIR [--fallback DIR] --ddb DIR [--live-views DIR]');
  const read = (n) => { const p = path.join(values.ddb, n); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
  const out = await report({ rec: openRecord({ record: values.record, fallback: values.fallback }), ddb: { archive: read('archive.json'), pred: read('pred.json'), analysis: read('thread_analysis.json') }, liveViews: values['live-views'], from: values.from });
  console.log(JSON.stringify(out, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code)).catch((e) => { console.error(e.stack || e.message); process.exit(1); });
