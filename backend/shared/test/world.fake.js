'use strict';
// A fake world client with fixtures shaped like the live rows (checked 2026-10-20). Not a test file.

const T = { cache: 'NewsCache', world: 'SummarizeAndPredict', pred: 'GlobalPerspectivePredictionLog' };
const TID = 'thread-french-student-protests-turn-v-68e0fb';

function fakeClient() {
  const rows = []; // { table, item }
  const s3 = new Map();
  const calls = [];
  const c = {
    calls, rows, s3,
    put(table, item) { rows.push({ table, item }); return c; },
    putS3(key, obj) { s3.set(key, obj); return c; },
    async getItem(table, key) {
      calls.push(['getItem', table, key]);
      const hit = rows.find((r) => r.table === table && Object.entries(key).every(([k, v]) => r.item[k] === v));
      return hit ? hit.item : null;
    },
    async query(table, pk, skPrefix) {
      calls.push(['query', table, pk, skPrefix]);
      return rows.filter((r) => r.table === table && r.item.PK === pk && (!skPrefix || String(r.item.SK).startsWith(skPrefix))).map((r) => r.item);
    },
    async batchGet(table, keys) {
      calls.push(['batchGet', table, keys.length]);
      return keys.map((k) => rows.find((r) => r.table === table && r.item.PK === k.PK && r.item.SK === k.SK)).filter(Boolean).map((r) => r.item);
    },
    async scan(table, spec) {
      calls.push(['scan', table, spec]);
      const { ':p': p, ':f': f, ':t': t } = spec.values;
      return rows.filter((r) => r.table === table && String(r.item.PK).startsWith(p) && r.item.SK >= f && r.item.SK <= t).map((r) => r.item);
    },
    async getS3Json(key) { calls.push(['getS3Json', key]); return s3.has(key) ? s3.get(key) : null; },
  };
  return c;
}

const src = (source, title) => ({ source, title: title || `${source} headline`, url: `https://${source}/a`, tier: 'primary', outletCountry: 'FR', outletType: 'national', snippet: 's', age: '1 hour ago' });
const entry = (topicId, threadId, archivedAt, sources, extra = {}) => ({
  topicId, threadId, title: `Title ${topicId}`, category: 'society', regions: ['France'], search_keywords: ['x'], iso3: ['FRA'], actors: ['Emmanuel Macron'],
  event_type: 'unrest', sources, archivedAt, generationId: 'gen-1', ai: { summary: '- text' }, ...extra,
});

function seed(c) {
  // archive days: 2026-10-14 (A thread), 2026-10-15 missing, 2026-10-16 (A + B), 2026-10-17 (B, no archivedAt, www source)
  c.put(T.cache, { id: 'archive#2026-10-14', updatedAt: '2026-10-14T12:00:00.000Z', ttl: 1, entries: [
    entry('t-a1', 'thread-a', '2026-10-14T04:26:36.158Z', [src('bbc.com'), src('reuters.com')]),
    entry('t-a1b', 'thread-a', '2026-10-14T01:00:00.000Z', [src('bbc.com')]),
  ] });
  c.put(T.cache, { id: 'archive#2026-10-16', entries: [
    entry('t-a2', 'thread-a', '2026-10-16T04:00:00.000Z', [src('bbc.com')]),
    entry('t-b1', 'thread-b', '2026-10-16T05:00:00.000Z', [src('www.Reuters.com'), { title: 'no source' }]),
    { id: 'legacy-id-only', title: 'no thread', sources: [] },
  ] });
  c.put(T.cache, { id: 'archive#2026-10-17', entries: [entry('t-b2', 'thread-b', undefined, [src('ft.com')])] });
  c.put(T.cache, { id: 'latest', model: 'deepseek-v4-pro', limit: 13, topics: [
    { id: 'Topic X', topicId: 'Topic X', threadId: 'thread-a', title: 'Topic X', actors: ['Iran'], iso3: ['IRN'], regions: ['Iran'], category: 'conflict', sources: [src('reuters.com'), src('bbc.com')] },
    { id: 'Only id', title: 'No thread', sources: [] },
  ] });
  // thread rows
  c.put(T.world, { PK: 'THREAD#thread-a', SK: 'THREAD_ANALYSIS', threadId: 'thread-a', threadTitle: 'Story A', riskScore: 78, lead: 'political', trajectory: 'Heading up', iso3: ['FRA'],
    keyActors: [{ mentionCount: 8, name: 'Emmanuel Macron', role: 'France · President' }, 'Marine Le Pen'], entryCount: 31, generatedAt: '2026-10-19T04:40:34.451Z', ttl: 4102444800 });
  c.put(T.world, { PK: 'THREAD#thread-old', SK: 'THREAD_ANALYSIS', threadId: 'thread-old', threadTitle: 'Old row', riskScore: 24, generatedAt: '2026-10-01T00:00:00.000Z', ttl: 1000 });
  c.put(T.world, { PK: 'THREAD#thread-a', SK: 'THREAD_HISTORY#2026-10-16', dateKey: '2026-10-16', riskScore: 49, trajectory: 'h1', threadTitle: 'Story A', lead: 'political' });
  c.put(T.world, { PK: 'THREAD#thread-a', SK: 'THREAD_HISTORY#2026-10-14', dateKey: '2026-10-14', riskScore: 50, trajectory: 'h0' });
  c.put(T.world, { PK: 'THREAD#thread-a', SK: 'THREAD_HISTORY#2026-10-18', dateKey: '2026-10-18', riskScore: 75 });
  c.put(T.world, { PK: 'THREAD#thread-a', SK: 'THREAD_HISTORY#2026-10-19', dateKey: '2026-10-19' }); // no score: dropped
  c.put(T.world, { PK: 'COUNTRY#France', SK: 'HISTORY#2026-10-14', dateKey: '2026-10-14', riskScore: 65, riskLevel: 'elevated', trajectory: 'escalating', headline: 'France faces' });
  c.put(T.world, { PK: 'COUNTRY#France', SK: 'HISTORY#2026-10-15', riskScore: '24' }); // date from SK, score as string
  // drift: 10-16 has both rows (same note), 10-18 only DRIFT, country has DRIFT only
  const note = { threadId: 'thread-a', asOf: '2026-10-16', since: '2026-10-14', changeScore: { from: 50, to: 49, delta: -1 }, priorTitle: 'P', currentTitle: 'C', whyChanged: 'because', noSingleDriver: false, triggerEvent: { date: '2026-10-16', topicId: 't-a2', title: 'T' }, generatedAt: '2026-10-16T05:30:00.000Z' };
  c.put(T.world, { ...note, PK: 'THREAD#thread-a', SK: 'DRIFT#2026-10-16', ttl: 5 });
  c.put(T.world, { ...note, PK: 'THREAD#thread-a', SK: 'DRIFTLOG#2026-10-16', whyChanged: 'because (log)' });
  c.put(T.world, { ...note, asOf: '2026-10-18', PK: 'THREAD#thread-a', SK: 'DRIFT#2026-10-18', triggerEvent: undefined, noSingleDriver: true, directionFlag: { kinds: ['x'] } });
  c.put(T.world, { PK: 'COUNTRY#France', SK: 'DRIFT#2026-10-17', asOf: '2026-10-17', since: '2026-10-16', countryName: 'France', changeScore: { from: 60, to: 62, delta: 2 }, priorHeadline: 'ph', currentHeadline: 'ch', whyChanged: 'w', changeLevel: { from: 'moderate', to: 'elevated' }, emailedAt: 'x' });
  // pointer + forecasts
  c.put(T.world, { PK: 'THREAD#thread-a', SK: 'TOPICS', threadId: 'thread-a', topicId: 't-a2', topicIds: ['t-a2', 't-a1'] });
  c.put(T.pred, { PK: 'PRED#t-a1', SK: '2026-10-14', topicId: 't-a1', title: 'A1', generatedAt: '2026-10-14T05:00:00.000Z', model: 'm', scenarios: [ // older row: no threadId/questionSchema, no p
    { label: 'Most Likely', probability: 0.6, probabilityRange: '55-65%', horizon: '3-6 months', rationale: 'r', scoreable: true, triggers: [{ id: '0-0', text: 'Old trigger', deadline: '2026-12-31', status: 'pending' }] }] });
  c.put(T.pred, { PK: 'PRED#t-a2', SK: '2026-10-16', topicId: 't-a2', title: 'A2', threadId: 'thread-a', questionSchema: 1, generatedAt: '2026-10-16T05:00:00.000Z', model: 'deepseek-v4-pro', scenarios: [
    { label: 'Most Likely', probability: 0.6, probabilityRange: '55-65%', horizon: 'h', rationale: 'r', scoreable: true, triggers: [
      { id: '0-0', text: 'Charges filed', deadline: '2027-01-05', status: 'pending', question: true, qid: 'q1', p: 65, resolutionSource: 'AG announcement', resolver: 'human' },
      { id: '0-1', text: 'Narrative only', deadline: '2026-11-07', status: 'pending', question: false }] },
    { label: 'Tail', probability: 0.15, triggers: [{ text: 'No id', deadline: '2027-04-05' }] }] });
  c.put(T.pred, { PK: 'PRED#t-other', SK: '2026-10-16', topicId: 't-other', threadId: 'thread-zzz', scenarios: [] });
  c.put(T.pred, { PK: 'PRED#t-x', SK: '2026-10-20', topicId: 't-x', scenarios: [] });
  // verdicts
  c.put(T.pred, { PK: 'Q#q1', SK: 'SAMPLED', qid: 'q1', question: 'Q?' });
  c.put(T.pred, { PK: 'Q#q1', SK: 'VERDICT', qid: 'q1', verdict: 'no', decidedAt: '2026-10-18T10:00:00.000Z', decidedBy: 'resolver', evidence: { url: 'u', quote: 'q' } });
  c.put(T.pred, { PK: 'Q#q1', SK: 'VERDICT#10', qid: 'q1', verdict: 'void', decidedAt: '2026-10-25T10:00:00.000Z', decidedBy: 'operator', reason: 'fix', voidReason: 'v' });
  c.put(T.pred, { PK: 'Q#q1', SK: 'VERDICT#2', qid: 'q1', verdict: 'yes', decidedAt: '2026-10-20T10:00:00.000Z', decidedBy: 'operator', reason: 'dispute' });
  c.put(T.pred, { PK: 'Q#q2', SK: 'SAMPLED', qid: 'q2' });
  // web
  const web = { links: [{ from: 'thread-a', to: 'thread-b', confidence: 'strong', lagDays: 1, mechanism: 'm', cited: [{ date: '2026-10-14', topicId: 't-a1', title: 'T' }], country: 'France', generatedAt: '2026-10-19T05:00:00.000Z' }, { from: 'thread-a' }, { a: 'thread-b', b: 'thread-c', confirmed: true, confirmedBy: 'rule', strength: 'strong' }],
    shared: [{ a: 'thread-a', b: 'thread-b', actors: ['Iran'], weight: 2, country: 'France' }, { a: 'x' }],
    threads: { 'thread-a': { state: 'linked', title: 'Story A', entries: 4, places: [{ name: 'France', n: 3 }, { n: 1 }], analysedIn: [] }, bad: null } };
  c.put(T.world, { PK: 'WEB#INDEX', SK: 'LATEST', ...web, generatedAt: '2026-10-20T05:00:21.595Z' });
  c.putS3('web/latest.json', { runId: 'web-1', generatedAt: '2026-10-20T05:00:21.595Z', index: { runId: 'web-1', generatedAt: '2026-10-20T05:00:21.595Z', ...web } });
  return c;
}

module.exports = { T, TID, fakeClient, seed, entry, src };
