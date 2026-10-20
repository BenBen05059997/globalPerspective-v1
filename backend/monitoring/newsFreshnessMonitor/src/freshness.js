'use strict';

async function probe({ fetchImpl = fetch, url, nowMs = Date.now(), staleHours = 9 }) {
  if (!Number.isFinite(staleHours) || staleHours <= 0) throw new Error('STALE_HOURS must be positive');
  let data;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { ok: false, health: 'failed', error: `proxy HTTP ${response.status}`, status: response.status };
    data = await response.json();
  } catch (error) { return { ok: false, health: 'failed', error: `proxy unreachable: ${error.message}` }; }
  const asOf = data.asOf || data.data?.updatedAt || null;
  const ageHours = (nowMs - Date.parse(asOf || '')) / 3600000;
  if (!Number.isFinite(ageHours) || ageHours < -5/60) return { ok: false, health: 'failed', error: 'missing, invalid or future asOf', asOf };
  const stale = ageHours > staleHours;
  return { ok: !stale, health: stale ? 'stale' : 'healthy', stale, ageHours: Math.round(ageHours*100)/100, asOf,
    topicsCount: Array.isArray(data.data?.topics) ? data.data.topics.length : null };
}

// Conditional reservation suppresses concurrent alerts. Publish happens before marking delivered;
// a crash between SNS acceptance and that write can repeat an alert (standard SNS is not exactly-once).
async function notifyTransition({ store, publish, observation, nowMs = Date.now(), dryRun = false, siteUrl }) {
  if (dryRun) return { sent: false, dryRun: true, health: observation.health };
  let { state, etag } = await store.read();
  state ||= { health: 'healthy', revision: 0 };
  let sent = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (state.pending && state.pending.leaseUntil > nowMs) return { sent: sent > 0, suppressed: 'in-flight' };
    if (!state.pending && (state.health === 'healthy') === (observation.health === 'healthy')) return { sent: sent > 0, suppressed: 'unchanged' };
    const recovery = observation.health === 'healthy';
    const pending = state.pending || {
      target: observation.health,
      transitionId: `${state.revision + 1}:${new Date(nowMs).toISOString()}:${observation.health}`,
      subject: recovery ? '[GP] Content RECOVERED' : observation.health === 'stale' ? '[GP] Content STALE' : '[GP] Freshness probe FAILED',
      message: JSON.stringify({ ...observation, siteUrl, checkedAt: new Date(nowMs).toISOString() }, null, 2),
    };
    const claimed = { ...state, pending: { ...pending, leaseUntil: nowMs + 60000 } };
    try { etag = await store.write(claimed, etag); }
    catch (error) { if (error.name === 'PreconditionFailed' || error.$metadata?.httpStatusCode === 412) return { sent: sent > 0, suppressed: 'contended' }; throw error; }
    await publish(pending.subject, `${pending.message}\nTransition: ${pending.transitionId}`);
    state = { health: pending.target, revision: state.revision + 1, lastTransitionId: pending.transitionId, deliveredAt: new Date(nowMs).toISOString() };
    etag = await store.write(state, etag);
    sent++;
  }
  return { sent: sent > 0, count: sent };
}

function s3StateStore(bucket, region) {
  if (!bucket) throw new Error('FRESHNESS_STATE_BUCKET missing; configure persistent dedupe before deployment');
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region });
  const Key = 'monitoring/freshness/state.json';
  return {
    async read() {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
        const state = JSON.parse(await r.Body.transformToString());
        if (!['healthy','stale','failed'].includes(state.health) || !Number.isInteger(state.revision)) throw new Error('Invalid freshness dedupe state');
        return { state, etag: r.ETag };
      } catch (error) { if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return { state: null, etag: null }; throw error; }
    },
    async write(state, etag) {
      const r = await client.send(new PutObjectCommand({ Bucket: bucket, Key, Body: JSON.stringify(state), ContentType: 'application/json',
        ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }) }));
      return r.ETag;
    },
  };
}
module.exports = { probe, notifyTransition, s3StateStore };
