// Equality of the record readers with the DynamoDB rows they replace (decision 0054), on LIVE data, READ ONLY: DynamoDB GetItem / BatchGetItem and
// S3 GetObject, plus one GET of the public /rss. Nothing is written, no Lambda is invoked, nothing is sent.
//
//   RECORD_SDK_DIR=<sdk dir> NODE_PATH=<sdk dir>/node_modules node backend/record/cli/compare-record-reads.mjs [--only today,analyses,countries,weekly,rss] [--rss-url URL]
//
// today      NewsCache `latest` and `today-archive` against recordReads' latestItem / todayArchiveItem. The live index/today.json is used when it exists;
//            until the agent writes the entries inbox it does not, so the view is built here from the live archive rows by the code newsStoryRecord uses
//            (todayView.js over inbox lines made by shared entriesInbox.js, the last run ordered as the `latest` item orders it) and labelled `simulated`.
// analyses   every THREAD_ANALYSIS row that has a story-view analysis, against threadAnalysisRow (the row keys PK/SK/ttl are derived, see recordReads.js).
// countries  every COUNTRY_INTELLIGENCE row that has a country view, against countryIntelligenceRow.
// weekly     every WEEKLY_BRIEF# row against its brief view, and the weekly email rendered from the row and from the view (text and html compared).
// rss        the feed built from the DynamoDB items, from the record, and the public /rss as served now.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const R = require('../../shared/src/recordReads.js');
const inbox = require('../../shared/src/entriesInbox.js');
const { todayIndex } = require('../newsStoryRecord/src/todayView.js');
const { renderWeeklyEmail } = require('../../distribution/newsEmailSender/src/renderWeeklyEmail.js');

const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
};

/** Pure: tally diffValues lists -> {equal, differ, paths: {path: count}} (array indexes folded to []). */
export function tally(results) {
  const paths = {};
  let equal = 0;
  let differ = 0;
  for (const d of results) {
    if (!d.length) { equal += 1; continue; }
    differ += 1;
    for (const x of d) { const k = x.path.replace(/\[\d+\]/g, '[]'); paths[k] = (paths[k] || 0) + 1; }
  }
  return { equal, differ, paths: Object.fromEntries(Object.entries(paths).sort((a, b) => b[1] - a[1]).slice(0, 12)) };
}

/** Pure: a diffValues list -> {path (indexes folded to []): {n, example: {a, b}}}. */
export function byPath(diff) {
  const out = {};
  for (const x of diff) { const k = x.path.replace(/\[\d+\]/g, '[]'); out[k] = out[k] || { n: 0, example: { a: x.a, b: x.b } }; out[k].n += 1; }
  return out;
}

/** Pure: the inbox lines a run of the agent would have appended for `rows` ([{day, entries}], oldest first), the last run ordered as `latest` orders it. */
export function simulateInbox(rows, latest) {
  const out = [];
  rows.forEach(({ day, entries }, di) => {
    const lines = [];
    const byGen = [];
    for (const e of entries) { const g = byGen.at(-1); if (g && g[0].generationId === e.generationId) g.push(e); else byGen.push([e]); }
    byGen.forEach((group, gi) => {
      const last = di === rows.length - 1 && gi === byGen.length - 1 && latest;
      let list = group;
      let selection = null;
      if (last) {
        const order = new Map((latest.topics || []).map((t, i) => [t.topicId || t.id, i]));
        list = [...group].sort((a, b) => (order.get(a.topicId) ?? 1e9) - (order.get(b.topicId) ?? 1e9));
        selection = {
          topics: Object.fromEntries((latest.topics || []).map((t) => [t.topicId || t.id, t])),
          run: { of: list.length, model: latest.model, limit: latest.limit, updatedAt: latest.updatedAt, generatedDate: latest.generatedDate, generatedYear: latest.generatedYear, generationId: latest.generationId },
        };
      }
      const batch = new Date(group.map((e) => e.archivedAt).sort().at(-1)).toISOString();
      lines.push(...inbox.inboxLines(list, { batch, selection }));
    });
    out.push({ day, lines });
  });
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { only: { type: 'string' }, 'rss-url': { type: 'string' } } });
  const only = new Set((values.only || 'today,analyses,countries,weekly,rss').split(','));
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, BatchGetCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: null, bucket: BUCKET });
  const reads = R.makeRecordReads({ getJson: (k) => s3json.getJson(k), ttlMs: 600000 });
  const getItem = async (table, Key) => (await ddb.send(new GetCommand({ TableName: table, Key }))).Item || null;
  const report = { at: new Date().toISOString(), fresh: await reads.fresh() };

  if (only.has('today') || only.has('rss')) {
    const latest = await getItem('NewsCache', { id: 'latest' });
    const todayArchive = await getItem('NewsCache', { id: 'today-archive' });
    let view = await s3json.getJson('record/views/index/today.json');
    let source = 'live index/today.json';
    if (!view) {
      source = 'simulated from the live archive rows (index/today.json is not written yet)';
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const rows = [];
      for (const day of [yesterday, today]) { const row = await getItem('NewsCache', { id: `archive#${day}` }); if (row && Array.isArray(row.entries)) rows.push({ day, entries: row.entries }); }
      const lines = simulateInbox(rows, latest);
      view = todayIndex(lines, new Map(), { factsThrough: today });
    }
    const latestRec = R.latestItemOfView(view);
    const todayRec = R.todayArchiveItemOfView(view);
    if (only.has('today')) {
      report.today = {
        source,
        latest: latestRec ? { topicsDdb: latest.topics.length, topicsRecord: latestRec.topics.length, diffByPath: byPath(R.diffValues(latest, latestRec, { max: 5000 })) } : 'the view has no complete latest run',
        todayArchive: todayRec ? { entriesDdb: todayArchive.entries.length, entriesRecord: todayRec.entries.length, diffByPath: byPath(R.diffValues(todayArchive, todayRec, { max: 5000 })) } : 'unusable view',
      };
    }
    if (only.has('rss')) {
      const require2 = createRequire(import.meta.url);
      process.env.TOPICS_DDB_TABLE = 'NewsCache';
      process.env.SUMMARIZE_PREDICT_TABLE = 'SummarizeAndPredict';
      const { buildRssFeed } = require2('../../read-api/newsSensitiveData/src/index.js');
      const event = { requestContext: { domainName: 'ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com', stage: 'default' } };
      const fromDdb = await buildRssFeed(event, { getToday: async () => todayArchive, getLatest: async () => latest });
      const fromRecord = await buildRssFeed(event, { getToday: async () => todayRec, getLatest: async () => latestRec });
      const liveUrl = values['rss-url'] || 'https://globalperspective.net/rss';
      const live = await (await fetch(liveUrl)).text();
      const first = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1; return i === a.length && i === b.length ? null : { at: i, a: a.slice(i, i + 80), b: b.slice(i, i + 80) }; };
      report.rss = {
        source, items: { ddb: fromDdb.count, record: fromRecord.count }, bytes: { ddb: fromDdb.xml.length, record: fromRecord.xml.length, live: live.length },
        recordEqualsDdb: fromRecord.xml === fromDdb.xml, firstDifferenceRecordVsDdb: first(fromDdb.xml, fromRecord.xml),
        liveEqualsDdbNow: live === fromDdb.xml, firstDifferenceLiveVsDdb: first(live, fromDdb.xml),
      };
    }
  }

  if (only.has('analyses')) {
    const index = await s3json.getJson('record/views/index/analyses.json');
    const ids = Object.keys((index && index.analyses) || {});
    const keys = ids.map((id) => ({ PK: `THREAD#${id}`, SK: 'THREAD_ANALYSIS' }));
    const rows = new Map();
    for (let i = 0; i < keys.length; i += 100) {
      const out = await ddb.send(new BatchGetCommand({ RequestItems: { SummarizeAndPredict: { Keys: keys.slice(i, i + 100) } } }));
      for (const r of out.Responses.SummarizeAndPredict || []) rows.set(r.PK.replace('THREAD#', ''), r);
    }
    const nowSec = Date.now() / 1000;
    const results = await pool(ids, 8, async (id) => {
      const row = rows.get(id);
      if (!row) return { id, kind: 'noDdbRow' };
      const rec = await reads.threadAnalysisRow(id);
      if (!rec) return { id, kind: 'noRecordRow' };
      const sameSet = JSON.stringify([...(row.iso3 || [])].sort()) === JSON.stringify([...(rec.iso3 || [])].sort());
      return {
        id, kind: 'both', diff: R.diffValues(row, rec, { max: 20, ignore: ['ttl'] }),
        iso3: sameSet ? ((row.iso3 || []).join() === (rec.iso3 || []).join() ? 'same' : 'sameSetOtherOrder') : 'differentSet',
        ttlAliveDiffers: (row.ttl > nowSec) !== (rec.ttl > nowSec),
      };
    });
    const both = results.filter((r) => r.kind === 'both');
    const count = (f) => both.filter(f).length;
    report.analyses = {
      storiesWithAnalysisInRecord: ids.length, ddbRows: rows.size, noDdbRow: results.filter((r) => r.kind === 'noDdbRow').length, noRecordRow: results.filter((r) => r.kind === 'noRecordRow').length,
      compared: both.length, 'allFieldsExceptTtlAndIso3Order': tally(both.map((r) => r.diff.filter((d) => !d.path.startsWith('.iso3')))),
      iso3: { same: count((r) => r.iso3 === 'same'), sameSetOtherOrder: count((r) => r.iso3 === 'sameSetOtherOrder'), differentSet: count((r) => r.iso3 === 'differentSet') },
      ttl: { aliveInDdbButNotInRecordOrReverse: count((r) => r.ttlAliveDiffers) },
      examples: both.filter((r) => r.diff.some((d) => !d.path.startsWith('.iso3'))).slice(0, 3).map((r) => ({ id: r.id, diff: r.diff.slice(0, 5) })),
    };
  }

  if (only.has('countries')) {
    const index = await s3json.getJson('record/views/index/countries.json');
    const entries = Object.entries((index && index.countries) || {});
    const results = await pool(entries, 6, async ([iso3, c]) => {
      const name = c.countryName;
      const row = await getItem('SummarizeAndPredict', { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE' });
      if (!row) return { iso3, name, kind: 'noDdbRow' };
      const rec = await reads.countryIntelligenceRow(name);
      if (!rec) return { iso3, name, kind: 'noRecordRow' };
      return { iso3, name, kind: 'both', diff: R.diffValues(row, rec, { max: 20, ignore: ['ttl'] }) };
    });
    const both = results.filter((r) => r.kind === 'both');
    report.countries = {
      countriesInRecord: entries.length, noDdbRow: results.filter((r) => r.kind === 'noDdbRow').map((r) => r.name), noRecordRow: results.filter((r) => r.kind === 'noRecordRow').map((r) => r.name),
      compared: both.length, ...tally(both.map((r) => r.diff)), examples: both.filter((r) => r.diff.length).slice(0, 3).map((r) => ({ name: r.name, diff: r.diff.slice(0, 5) })),
    };
  }

  if (only.has('weekly')) {
    const index = await s3json.getJson('record/views/index/briefs.json');
    const weeks = ((index && index.weekly) || []).map((w) => w.weekOf);
    const per = [];
    for (const weekOf of weeks) {
      const row = await getItem('SummarizeAndPredict', { PK: `WEEKLY_BRIEF#${weekOf}`, SK: 'WEEKLY_BRIEF' });
      const view = await s3json.getJson(`record/views/briefs/weekly/${weekOf}.json`);
      if (!row || !view) { per.push({ weekOf, row: Boolean(row), view: Boolean(view) }); continue; }
      const { PK, SK, ttl, ...stored } = row;
      const a = renderWeeklyEmail(row, { siteUrl: undefined, unsubUrl: 'https://u.example/?x=1' });
      const b = renderWeeklyEmail(view.brief, { siteUrl: undefined, unsubUrl: 'https://u.example/?x=1' });
      per.push({ weekOf, status: row.status, briefDiff: R.diffValues(stored, view.brief, { ignore: ['iso3'] }), // the views add iso3 to signals and stories (briefs.js, 0048); the email does not read it
 subjectEqual: a.subject === b.subject, textEqual: a.text === b.text, htmlEqual: a.html === b.html, htmlBytes: a.html.length });
    }
    const latestRow = (await Promise.all(weeks.map((w) => getItem('SummarizeAndPredict', { PK: `WEEKLY_BRIEF#${w}`, SK: 'WEEKLY_BRIEF' })))).filter((r) => r && r.status === 'published').sort((x, y) => String(y.weekOf).localeCompare(String(x.weekOf)))[0];
    const latestRec = await reads.latestWeeklyBrief();
    report.weekly = {
      weeksInIndex: weeks.length, allBriefsEqual: per.every((p) => p.briefDiff && !p.briefDiff.length), allEmailsIdentical: per.every((p) => p.subjectEqual && p.textEqual && p.htmlEqual),
      latestPublishedDdb: latestRow && latestRow.weekOf, latestPublishedRecord: latestRec && latestRec.weekOf, perWeek: per.map((p) => ({ weekOf: p.weekOf, ...(p.briefDiff ? { briefEqual: !p.briefDiff.length, email: p.subjectEqual && p.textEqual && p.htmlEqual, htmlBytes: p.htmlBytes } : p)})),
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
