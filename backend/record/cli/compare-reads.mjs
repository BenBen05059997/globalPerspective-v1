// Compare the read API's country and story rows from DynamoDB with the same rows rebuilt from the record's notes (decision 0053).
// READ ONLY: DynamoDB Get/Query/Scan and S3 Get; nothing is written. Prints one JSON line per check and a summary; exit 1 on any difference.
//
//   node compare-reads.mjs [--countries 10] [--threads 20] [--prefix record/] [--bucket B] [--show 5]
//   Country facts and thread history have no notes until their backfills run: those two are checked on the notes the backfill WOULD
//   write (built in memory from the DynamoDB rows by the same builders), so the projection is proven before anything is written.
//   SDK: see sdk.mjs (RECORD_SDK_DIR); the read API's own records.js is loaded with NODE_PATH=$RECORD_SDK_DIR/node_modules.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { requireSdk, REGION } from './sdk.mjs';

const require = createRequire(import.meta.url);
const { makeS3Json } = require('../../shared/src/s3json.js');
const N = require('../../shared/src/notes.js');
const NR = require('../../shared/src/noteReads.js');
const { resolveIso3 } = require('../../shared/src/resolveIso3.js');

const TABLE = 'SummarizeAndPredict';

/** Pure: the member gate of country_history and corrections_feed, applied to a full list, for the two shapes the page sees. */
export function gateShapes(items, { teaser, limit }) {
  const signedOut = { items: items.slice(0, teaser), total: items.length, gated: items.length > teaser };
  const member = { items: limit ? items.slice(0, limit) : items, total: items.length, gated: false };
  return { signedOut, member };
}

async function scan(ddb, ScanCommand, FilterExpression, ExpressionAttributeValues) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const r = await ddb.send(new ScanCommand({ TableName: TABLE, FilterExpression, ExpressionAttributeValues, ExclusiveStartKey }));
    out.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { countries: { type: 'string' }, threads: { type: 'string' }, prefix: { type: 'string' }, bucket: { type: 'string' }, show: { type: 'string' } } });
  const bucket = values.bucket || process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  const prefix = values.prefix || 'record/';
  const nCountries = Number(values.countries || 10);
  const nThreads = Number(values.threads || 20);
  const show = Number(values.show || 5);
  const s3sdk = requireSdk('@aws-sdk/client-s3');
  const { DynamoDBClient } = requireSdk('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = requireSdk('@aws-sdk/lib-dynamodb');
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
  const s3json = makeS3Json({ client: new s3sdk.S3Client({ region: REGION }), GetObjectCommand: s3sdk.GetObjectCommand, PutObjectCommand: s3sdk.PutObjectCommand, bucket });
  const reader = NR.makeNoteReader({ s3json, prefix, ttlMs: 3600000 });

  const { makeRecords, correctionOf, diff } = require('../../read-api/newsSensitiveData/src/records.js');
  const { capForTier } = require('../../read-api/newsSensitiveData/src/lib.js');
  // the in-memory notes of the two subtypes that have none yet
  const inMemory = {};
  const records = makeRecords({ getClient: () => client, table: TABLE, mode: 'ddb', log: { info() {}, warn() {} }, notes: { all: (s) => (inMemory[s] ? Promise.resolve(inMemory[s]) : reader.all(s)) } });

  const results = [];
  const check = (name, key, a, b) => {
    const d = diff(a, b);
    results.push({ name, key, same: !d, ...(d ? { diff: d } : {}) });
  };

  // ── samples ──
  const countryNotes = await reader.all('country');
  const realDriftNotes = await reader.all('drift');
  // coverage first, from the notes as they are: DRIFT#/DRIFTLOG# rows with no drift note
  const driftRowsAll = await scan(client, ScanCommand, 'begins_with(SK, :d) OR begins_with(SK, :l)', { ':d': 'DRIFT#', ':l': 'DRIFTLOG#' });
  const haveKey = new Set(realDriftNotes.map((n) => `${n.subject.kind === 'story' ? 'THREAD#' : 'COUNTRY#'}${n.subject.kind === 'story' ? n.subject.id : n.payload.countryName}|${n.payload.asOf}`));
  const asOfOf = (r) => r.asOf || String(r.SK).replace(/^DRIFT(LOG)?#/, '');
  const uncovered = driftRowsAll.filter((r) => !haveKey.has(`${r.PK}|${asOfOf(r)}`));
  const by = (list) => ({ country: list.filter((r) => r.PK.startsWith('COUNTRY#')).length, thread: list.filter((r) => r.PK.startsWith('THREAD#')).length });
  results.push({ name: 'drift.coverage', key: 'DRIFT#/DRIFTLOG# dates with no drift note, before the backfill', same: true,
    counts: { driftRows: by(driftRowsAll.filter((r) => r.SK.startsWith('DRIFT#'))), driftLogRows: by(driftRowsAll.filter((r) => r.SK.startsWith('DRIFTLOG#'))), datesWithoutNote: by([...new Map(uncovered.map((r) => [`${r.PK}|${asOfOf(r)}`, r])).values()]) },
    missing: [...new Set(uncovered.map((r) => `${r.PK}|${asOfOf(r)}`))].slice(0, show) });
  const driftOnlyKeys = new Set(uncovered.map((r) => `${r.PK}|${asOfOf(r)}`));
  // the notes the (updated) backfill CLIs would add, built in memory, so equality is proven for the state after the backfill
  const { planDriftNotes } = await import('./backfill-drift-notes.mjs');
  const planned = planDriftNotes({ items: driftRowsAll.filter((r) => r.PK.startsWith('COUNTRY#')), producer: { lambda: 'record/cli/compare-reads', runId: 'compare' } }).notes;
  const known = new Set(realDriftNotes.map((n) => n.noteId));
  const driftNotes = [...realDriftNotes, ...planned.filter((n) => !known.has(n.noteId))];
  inMemory.drift = driftNotes;
  results.push({ name: 'drift.backfill', key: 'country drift notes: in the record / the backfill adds', same: true, counts: { real: realDriftNotes.filter((n) => n.subject.kind === 'country').length, adds: planned.filter((n) => !known.has(n.noteId)).length } });
  const analysisNotes = await reader.all('story_analysis');
  const countryNames = [...new Set(countryNotes.filter((n) => !n.payload.from).map((n) => n.payload.countryName))].sort();
  // the countries with the most drift notes first (the member shape differs only where there is depth), then the rest
  const driftCount = (name) => driftNotes.filter((n) => n.subject.kind === 'country' && n.payload.countryName === name).length;
  const sample = countryNames.slice().sort((a, b) => driftCount(b) - driftCount(a) || (a < b ? -1 : 1)).slice(0, nCountries);

  // 1. country_history: snapshots, full drift chain, and both gated shapes
  for (const name of sample) {
    const a = await records.fromDdb.countryHistory(name);
    const b0 = await records.fromNotes.countryHistory(name);
    // After the backfill the notes also hold the DRIFT#-only rows older than the newest 10 (June-July), which the action never read:
    // a deliberate superset. Everything the action served must match; the extras must be exactly such rows.
    const ddbDays = new Set(a.driftNotes.map((x) => x.asOf));
    const extras = b0.driftNotes.filter((x) => !ddbDays.has(x.asOf));
    const b = { snapshots: b0.snapshots, driftNotes: b0.driftNotes.filter((x) => ddbDays.has(x.asOf)) };
    results.push({ name: 'country_history.olderNotes', key: name, same: extras.every((x) => driftOnlyKeys.has(`COUNTRY#${name}|${x.asOf}`)), counts: { extraOlderNotes: extras.length } });
    check('country_history.snapshots', name, a.snapshots, b.snapshots);
    check('country_history.driftNotes', name, a.driftNotes, b.driftNotes);
    for (const tier of ['free', 'member']) {
      const cap = (list) => capForTier(list, tier, 1);
      const ca = cap(a.driftNotes);
      const cb = cap(b.driftNotes);
      check(`country_history.${tier}`, name, { snapshots: a.snapshots, driftNotes: ca.items, driftNotesTotal: ca.total, driftNotesGated: ca.gated }, { snapshots: b.snapshots, driftNotes: cb.items, driftNotesTotal: cb.total, driftNotesGated: cb.gated });
    }
    results[results.length - 1].counts = { snapshots: a.snapshots.length, driftNotes: a.driftNotes.length };
  }

  // 2. country_intelligence and country_preview for the same countries
  for (const name of sample) {
    check('country_intelligence', name, await records.fromDdb.countryIntelligence(name), await records.fromNotes.countryIntelligence(name));
    check('country_preview', name, await records.fromDdb.countryPreview(name), await records.fromNotes.countryPreview(name));
  }

  // 3. corrections_feed: both shapes (signed out: newest 5 + total; member: newest 40 + total)
  {
    const shape = async (src) => {
      const list = (await src.driftRows()).map(correctionOf).filter((n) => n.asOf && n.scope !== 'other').sort((x, y) => String(y.asOf).localeCompare(String(x.asOf)) || (`${x.scope}${x.name}` < `${y.scope}${y.name}` ? -1 : 1));
      return list;
    };
    const a = await shape(records.fromDdb);
    const b = await shape(records.fromNotes);
    const g = (list) => gateShapes(list, { teaser: 5, limit: 40 });
    check('corrections_feed.total', 'all', { total: a.length, scopes: [a.filter((x) => x.scope === 'country').length, a.filter((x) => x.scope === 'thread').length] }, { total: b.length, scopes: [b.filter((x) => x.scope === 'country').length, b.filter((x) => x.scope === 'thread').length] });
    // same asOf across notes sort ties differently; compare as sets for the full list, and the gated shapes by their sorted rows
    const k = (x) => `${x.scope}|${x.name}|${x.asOf}`;
    check('corrections_feed.rows', 'all', a.slice().sort((x, y) => (k(x) < k(y) ? -1 : 1)), b.slice().sort((x, y) => (k(x) < k(y) ? -1 : 1)));
    check('corrections_feed.signedOut', 'newest 5', g(a).signedOut.items.map(k).sort(), g(b).signedOut.items.map(k).sort());
    check('corrections_feed.member', 'newest 40', g(a).member.items.map(k).sort(), g(b).member.items.map(k).sort());
    const onlyDdb = a.filter((x) => !b.some((y) => k(y) === k(x))).map(k);
    const onlyNotes = b.filter((x) => !a.some((y) => k(y) === k(x))).map(k);
    results.push({ name: 'corrections_feed.missing', key: 'rows only in DynamoDB / only in notes', same: !onlyDdb.length && !onlyNotes.length, onlyDdb: onlyDdb.slice(0, show), onlyDdbCount: onlyDdb.length, onlyNotes: onlyNotes.slice(0, show), onlyNotesCount: onlyNotes.length });
  }

  // 4. thread_analysis: 20 threads (stories with a note, then any with a row), analysis + latest drift note
  const threadIds = [...new Set(analysisNotes.map((n) => n.subject.id))].sort();
  const step = Math.max(1, Math.floor(threadIds.length / nThreads));
  const sampleThreads = threadIds.filter((_, i) => i % step === 0).slice(0, nThreads);
  for (const tid of sampleThreads) check('thread_analysis', tid, await records.fromDdb.threadAnalysis(tid), await records.fromNotes.threadAnalysis(tid));
  for (const tid of sampleThreads.slice(0, 5)) check('thread_preview', tid, await records.fromDdb.threadPreview(tid), await records.fromNotes.threadPreview(tid));

  // 5. country_facts, on the notes the backfill would write
  {
    const rows = await scan(client, ScanCommand, 'begins_with(PK, :p) AND SK = :s', { ':p': 'FACTS#', ':s': 'COUNTRY_FACTS' });
    const producer = { lambda: 'record/cli/compare-reads', runId: 'compare' };
    const made = [];
    for (const item of rows) { const r = resolveIso3(item.countryName); if (r) { const n = N.countryFactsNote({ item, iso3: r.iso3, producer }); if (n) made.push(n); } }
    inMemory.country_facts = made;
    results.push({ name: 'country_facts.rows', key: 'FACTS# rows / notes built / unresolved', same: made.length === rows.length, counts: { rows: rows.length, notes: made.length } });
    for (const item of rows) check('country_facts', item.countryName, await records.fromDdb.countryFacts(item.countryName), await records.fromNotes.countryFacts(item.countryName));
    // and the raw row (what newsCountryIntelligence and the agent read), not just the public shape
    for (const item of rows.slice(0, 10)) {
      const r = resolveIso3(item.countryName);
      const back = r && NR.countryFacts(made, r.iso3);
      const { PK, SK, ttl, ...rest } = item;
      check('country_facts.row', item.countryName, rest, back);
    }
  }

  // 6. THREAD_HISTORY#, on the notes the backfill would write beside the story_analysis notes
  {
    const rows = await scan(client, ScanCommand, 'begins_with(PK, :p) AND begins_with(SK, :s)', { ':p': 'THREAD#', ':s': 'THREAD_HISTORY#' });
    const producer = { lambda: 'record/cli/compare-reads', runId: 'compare' };
    const made = rows.map((item) => N.storyHistoryNote({ item, producer })).filter(Boolean);
    const byThread = new Map();
    for (const r of rows) { (byThread.get(r.threadId) || byThread.set(r.threadId, []).get(r.threadId)).push(r); }
    const covered = (r) => analysisNotes.some((n) => n.subject.id === r.threadId && n.date === r.dateKey);
    results.push({ name: 'thread_history.rows', key: 'THREAD_HISTORY# rows / with a story_analysis note of that day', same: true, counts: { rows: rows.length, threads: byThread.size, coveredByAnalysisNote: rows.filter(covered).length, needCopy: rows.filter((r) => !covered(r)).length } });
    const ids = [...byThread.keys()].sort();
    const stepT = Math.max(1, Math.floor(ids.length / nThreads));
    for (const tid of ids.filter((_, i) => i % stepT === 0).slice(0, nThreads)) {
      const want = byThread.get(tid).map(({ PK, SK, ttl, ...r }) => r).sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
      const got = NR.threadHistory(analysisNotes, made, tid);
      // the history row of a day written by the same run as an analysis note: the analysis note carries the same scalars
      check('thread_history', tid, want.map((r) => ({ ...r, generatedAt: undefined })), got.map((r) => ({ ...r, generatedAt: undefined })));
    }
  }

  const bad = results.filter((r) => !r.same);
  const byName = {};
  for (const r of results) { const e = byName[r.name] || (byName[r.name] = { checked: 0, same: 0 }); e.checked += 1; e.same += r.same ? 1 : 0; }
  for (const r of bad.slice(0, 40)) console.log(JSON.stringify(r));
  for (const r of results.filter((x) => x.same && x.counts && !/^country_history\.(olderNotes)$/.test(x.name))) console.log(JSON.stringify(r)); // the counts behind the equal checks
  const extraOlder = results.filter((x) => x.name === 'country_history.olderNotes').map((x) => `${x.key}:${x.counts.extraOlderNotes}`);
  console.log(`older drift notes the backfill adds beyond what the action served: ${extraOlder.join(', ')}`);
  console.log(JSON.stringify({ summary: byName, differences: bad.length, sampleCountries: sample, sampleThreads: sampleThreads.length }, null, 1));
  return bad.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((c) => process.exit(c)).catch((e) => { console.error(e.stack || e.message); process.exit(1); });
