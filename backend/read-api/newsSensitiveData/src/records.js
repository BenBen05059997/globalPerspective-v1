'use strict';

// The country and story rows the read API serves (decision 0053): thread analysis and drift, country briefing, facts, history,
// drift depth and the corrections ledger. Each reader returns the row as SummarizeAndPredict held it, minus keys and ttl, and is
// read from DynamoDB (NOTES_READS=ddb, the default), from the record's notes (notes), or from DynamoDB with every difference to
// the notes logged as `[notes-compare]` (compare). Member gating is NOT here: these return everything and the handler caps it, so
// gated depth never reaches a view. All readers are best-effort per key, as the handler was: a failed read is an absent row.
const { GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const NR = require('./_shared/noteReads');
const { iso3List } = require('./_shared/resolveIso3');
const { countryKeys, dedupeByAsOf, shapeCountryFacts } = require('./lib');

const strip = ({ PK, SK, ttl, ...rest }) => rest;
// the drift fields the ledger reads (the old Scan projected exactly these)
const LEDGER_FIELDS = ['threadId', 'asOf', 'changeLevel', 'changeScore', 'changeDimensions', 'triggerEvent', 'whyChanged', 'noSingleDriver', 'directionFlag'];
const ledgerRow = (it) => Object.fromEntries(LEDGER_FIELDS.filter((k) => it[k] !== undefined).map((k) => [k, it[k]]));

function makeRecords({ getClient, table, notes, mode = 'ddb', log = console }) {
  const ddb = () => getClient();

  // ── DynamoDB ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const fromDdb = {
    async threadAnalysis(tid) {
      const [analysisOut, driftOut] = await Promise.all([
        ddb().send(new GetCommand({ TableName: table, Key: { PK: `THREAD#${tid}`, SK: 'THREAD_ANALYSIS' } })),
        // Living-analysis Phase 3: the latest grounded "what changed" note for this thread.
        ddb().send(new QueryCommand({
          TableName: table, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :d)',
          ExpressionAttributeValues: { ':pk': `THREAD#${tid}`, ':d': 'DRIFT#' }, ScanIndexForward: false, Limit: 1,
        })),
      ]);
      if (!analysisOut.Item) return null;
      const rest = strip(analysisOut.Item);
      const driftItem = (driftOut.Items || [])[0];
      if (driftItem) rest.driftNote = strip(driftItem);
      return rest;
    },
    async countryIntelligence(name) {
      for (const key of countryKeys(name)) { // canonical record first, then the requested spelling
        const { Item } = await ddb().send(new GetCommand({ TableName: table, Key: { PK: `COUNTRY#${key}`, SK: 'COUNTRY_INTELLIGENCE' } }));
        if (Item) return strip(Item);
      }
      return null;
    },
    async countryFacts(name) {
      for (const key of countryKeys(name)) {
        const { Item } = await ddb().send(new GetCommand({ TableName: table, Key: { PK: `FACTS#${key}`, SK: 'COUNTRY_FACTS' } }));
        const shaped = shapeCountryFacts(Item);
        if (shaped) return shaped;
      }
      return null;
    },
    async countryHistory(name) {
      const q = (key, prefix, Limit) => ddb().send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `COUNTRY#${key}`, ':prefix': prefix }, ScanIndexForward: false, Limit,
      }));
      // canonical record first, then the requested spelling (records not yet merged)
      let hist; let live; let archive;
      for (const key of countryKeys(name)) {
        [hist, live, archive] = await Promise.all([q(key, 'HISTORY#', 90), q(key, 'DRIFT#', 10), q(key, 'DRIFTLOG#', 90)]);
        if ([hist, live, archive].some((o) => (o.Items || []).length)) break;
      }
      return {
        snapshots: (hist.Items || []).map(strip),
        // the permanent archive (DRIFTLOG#, the superset) first, then the live TTL'd notes, one per asOf, newest first
        driftNotes: dedupeByAsOf([...(archive.Items || []).map(strip), ...(live.Items || []).map(strip)]),
      };
    },
    async driftRows() {
      const items = [];
      let ExclusiveStartKey;
      do {
        const res = await ddb().send(new ScanCommand({
          TableName: table, FilterExpression: 'begins_with(SK, :d)', ExpressionAttributeValues: { ':d': 'DRIFT#' },
          ProjectionExpression: 'PK, SK, threadId, asOf, changeLevel, changeScore, changeDimensions, triggerEvent, whyChanged, noSingleDriver, directionFlag',
          ExclusiveStartKey,
        }));
        items.push(...(res.Items || []));
        ExclusiveStartKey = res.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return items.map((it) => {
        const pk = String(it.PK || '');
        const scope = pk.startsWith('COUNTRY#') ? 'country' : pk.startsWith('THREAD#') ? 'thread' : 'other';
        return { scope, name: pk.replace(/^(COUNTRY#|THREAD#)/, ''), row: { ...ledgerRow(it), asOf: it.asOf || String(it.SK || '').replace(/^DRIFT#/, '') } };
      });
    },
    async threadPreview(tid) {
      const { Item } = await ddb().send(new GetCommand({ TableName: table, Key: { PK: `THREAD#${tid}`, SK: 'THREAD_ANALYSIS' } }));
      return Item ? strip(Item) : null;
    },
    async countryPreview(name) {
      const { Item } = await ddb().send(new GetCommand({ TableName: table, Key: { PK: `COUNTRY#${name}`, SK: 'COUNTRY_INTELLIGENCE' } }));
      return Item ? strip(Item) : null;
    },
  };

  // ── The record's notes ────────────────────────────────────────────────────────────────────────────────────────────
  const fromNotes = {
    async threadAnalysis(tid) {
      const [analyses, drifts] = await Promise.all([notes.all('story_analysis'), notes.all('drift')]);
      const analysis = NR.storyAnalysis(analyses, tid);
      if (!analysis) return null;
      const drift = NR.storyDrift(drifts, tid);
      return drift ? { ...analysis, driftNote: drift } : analysis;
    },
    async countryIntelligence(name) {
      const iso3 = NR.iso3Of(name);
      return iso3 ? NR.countryIntelligence(await notes.all('country'), iso3) : null;
    },
    async countryFacts(name) {
      const iso3 = NR.iso3Of(name);
      return iso3 ? shapeCountryFacts(NR.countryFacts(await notes.all('country_facts'), iso3)) : null;
    },
    async countryHistory(name) {
      const iso3 = NR.iso3Of(name);
      if (!iso3) return { snapshots: [], driftNotes: [] };
      const [country, drift] = await Promise.all([notes.all('country'), notes.all('drift')]);
      return { snapshots: NR.countryHistory(country, iso3), driftNotes: NR.countryDrift(drift, iso3) };
    },
    async driftRows() {
      return NR.driftFeed(await notes.all('drift')).map(({ scope, name, row }) => ({ scope, name, row: ledgerRow(row) }));
    },
    async threadPreview(tid) { return fromNotes.threadAnalysis(tid).then((a) => (a ? (({ driftNote, ...rest }) => rest)(a) : null)); },
    async countryPreview(name) { return fromNotes.countryIntelligence(name); },
  };

  /** The reader of `kind` under the mode (shared viaMode: in compare mode DynamoDB answers and a difference is logged). */
  function reader(kind, normalise) {
    return (...args) => NR.viaMode({
      mode, label: `${kind} ${JSON.stringify(args)}`, fromDdb: () => fromDdb[kind](...args), fromNotes: () => fromNotes[kind](...args), normalise, log,
    });
  }
  // the ledger is compared as sets of (scope, name, asOf, row), whatever the order
  const keyed = (list) => (list || []).map((x) => ({ k: `${x.scope}|${x.name}|${x.row.asOf}`, row: x.row })).sort((a, b) => (a.k < b.k ? -1 : 1));

  return {
    mode,
    threadAnalysis: reader('threadAnalysis'),
    countryIntelligence: reader('countryIntelligence'),
    countryFacts: reader('countryFacts'),
    countryHistory: reader('countryHistory'),
    driftRows: reader('driftRows', keyed),
    threadPreview: reader('threadPreview'),
    countryPreview: reader('countryPreview'),
    fromDdb, fromNotes,
  };
}

/** One ledger entry as corrections_feed serves it. */
function correctionOf({ scope, name, row }) {
  return {
    scope, name,
    // links: a country note's iso3 (resolver over its name), the thread (a thread note's own, else the trigger event's thread)
    iso3: scope === 'country' ? iso3List([name]) : [],
    threadId: row.threadId || row.triggerEvent?.threadId || null,
    asOf: row.asOf,
    changeLevel: row.changeLevel || null,
    changeScore: row.changeScore || null,
    changeDimensions: row.changeDimensions || null,
    triggerEvent: row.triggerEvent || null,
    whyChanged: row.whyChanged || null,
    noSingleDriver: !!row.noSingleDriver,
    directionFlag: row.directionFlag || null, // D9: the client shows numbers only for a flagged note
  };
}

module.exports = { makeRecords, correctionOf };
