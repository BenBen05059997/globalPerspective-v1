'use strict';

// The real ports for health.js / ops.js: S3, the resolver invoke, CloudWatch metrics, Logs Insights, Cost Explorer.
// The SDK v3 clients ship with the Lambda runtime and are required lazily, so the pure modules and the tests need none.
const { CONFIG, KEYS, BUCKET, REGION, READERS, QUALITY } = require('./config');
const { dayStart, dayOf } = require('./days');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const named = (e, ...names) => e && (names.includes(e.name) || names.includes(e.Code));

/**
 * Run one Logs Insights query over the groups and return its rows as plain objects. Polls GetQueryResults every
 * `pollMs` and gives up after `maxWaitMs` (the query keeps running on AWS's side; nothing to clean up).
 * Groups beyond 50 (the API limit per query) are run as further queries and their rows concatenated.
 */
async function insights(logs, { groups, queryString, startMs, endMs, maxWaitMs = CONFIG.queryMaxWaitMs, pollMs = CONFIG.queryPollMs, wait = sleep }) {
  if (!groups.length) return [];
  const chunks = [];
  for (let i = 0; i < groups.length; i += 50) chunks.push(groups.slice(i, i + 50));
  const out = [];
  for (const chunk of chunks) {
    const { queryId } = await logs.startQuery({ logGroupNames: chunk, startTime: Math.floor(startMs / 1000), endTime: Math.floor(endMs / 1000), queryString, limit: 10000 });
    let waited = 0;
    for (;;) {
      const res = await logs.getQueryResults({ queryId });
      if (res.status === 'Complete') { out.push(...res.results.map((r) => Object.fromEntries(r.filter((f) => f.field !== '@ptr').map((f) => [f.field, f.value])))); break; }
      if (['Failed', 'Cancelled', 'Timeout'].includes(res.status)) throw new Error(`Logs Insights query ${res.status}`);
      if (waited >= maxWaitMs) throw new Error(`Logs Insights query still ${res.status} after ${Math.round(maxWaitMs / 1000)} s`);
      await wait(pollMs); waited += pollMs;
    }
  }
  return out;
}

// Tokens per hour, function, step and model, from the "[usage] {json}" lines every model call logs (shared/src/llm.js).
const USAGE_QUERY = String.raw`filter @message like /\[usage\]/
| parse @message /"fn":"(?<fn>[^"]*)"/
| parse @message /"step":"(?<step>[^"]*)"/
| parse @message /"model":"(?<model>[^"]*)"/
| parse @message /"prompt_tokens":(?<pt>\d+)/
| parse @message /"completion_tokens":(?<ct>\d+)/
| parse @message /"prompt_cache_hit_tokens":(?<hit>\d+)/
| stats count() as calls, sum(pt) as ptok, sum(ct) as ctok, sum(hit) as hitok by bin(1h) as hr, fn, step, model`;

// newsSourceAudit's per-topic verdict lines: "[audit] corroborated | DRIFT | <title>" (one per audited topic, Mon/Wed/Fri runs).
const AUDIT_QUERY = String.raw`filter @message like /\[audit\]/ | fields @timestamp, @message | sort @timestamp asc | limit 1000`;

const DIFFER_QUERY = 'filter @message like /DIFFER/ | stats count() as n by bin(1d) as day, @log';

// Insights prints a bin as "2026-11-03 05:00:00.000" (UTC).
const toIso = (insightsTime) => `${insightsTime.replace(' ', 'T')}Z`;

/** Parse the usage query rows into {hourIso, fn, step, model, calls, promptTokens, completionTokens, cacheHitTokens}. */
function parseUsageRows(rows) {
  return rows.filter((r) => r.hr && r.model).map((r) => ({
    hourIso: toIso(r.hr), fn: r.fn || 'unknown', step: r.step || 'unknown', model: r.model,
    calls: Number(r.calls) || 0, promptTokens: Number(r.ptok) || 0, completionTokens: Number(r.ctok) || 0, cacheHitTokens: Number(r.hitok) || 0,
  }));
}

/** DIFFER rows -> { [fn]: { [day]: n } }. */
function parseDifferRows(rows) {
  const out = {};
  for (const r of rows) {
    const fn = String(r['@log'] || '').split('/').pop();
    if (!fn || !r.day) continue;
    const day = r.day.slice(0, 10);
    out[fn] = out[fn] || {};
    out[fn][day] = (out[fn][day] || 0) + (Number(r.n) || 0);
  }
  return out;
}

/** CloudWatch GetMetricData Errors daily sums -> { [fn]: { [day]: n } }. */
function parseErrorSeries(results) {
  const out = {};
  for (const r of results) {
    const byDay = {};
    (r.Timestamps || []).forEach((t, i) => { byDay[dayOf(t)] = r.Values[i]; });
    out[r.Label] = byDay;
  }
  return out;
}

function makeAws({ s3Client, lambdaClient, cwClient, logsClient, ceClient, ddbClient } = {}) {
  const lazy = (make) => { let c; return () => c || (c = make()); };
  const s3 = lazy(() => s3Client || new (require('@aws-sdk/client-s3').S3Client)({ region: REGION }));
  const lambda = lazy(() => lambdaClient || new (require('@aws-sdk/client-lambda').LambdaClient)({ region: REGION }));
  const cw = lazy(() => cwClient || new (require('@aws-sdk/client-cloudwatch').CloudWatchClient)({ region: REGION }));
  const logsC = lazy(() => logsClient || new (require('@aws-sdk/client-cloudwatch-logs').CloudWatchLogsClient)({ region: REGION }));
  const ddb = lazy(() => ddbClient || new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({ region: REGION }));
  const ce = lazy(() => ceClient || new (require('@aws-sdk/client-cost-explorer').CostExplorerClient)({ region: 'us-east-1' })); // Cost Explorer's one endpoint

  // The logs port: thin wrappers so insights() stays testable with a fake.
  const logs = {
    startQuery: (input) => { const { StartQueryCommand } = require('@aws-sdk/client-cloudwatch-logs'); return logsC().send(new StartQueryCommand(input)); },
    getQueryResults: (input) => { const { GetQueryResultsCommand } = require('@aws-sdk/client-cloudwatch-logs'); return logsC().send(new GetQueryResultsCommand(input)); },
  };

  let groupsCache = null;
  async function logGroups() {
    if (groupsCache) return groupsCache;
    const { DescribeLogGroupsCommand } = require('@aws-sdk/client-cloudwatch-logs');
    const names = []; let token;
    do {
      const r = await logsC().send(new DescribeLogGroupsCommand({ logGroupNamePrefix: CONFIG.logGroupPrefix, nextToken: token }));
      names.push(...(r.logGroups || []).map((g) => g.logGroupName));
      token = r.nextToken;
    } while (token);
    return (groupsCache = names);
  }

  // One attribute of every row of a table (Scan with a projection: no uid, email or other field is read). Pages until done.
  async function scanAttr(table, attr) {
    const { ScanCommand } = require('@aws-sdk/client-dynamodb');
    const out = []; let start;
    do {
      const r = await ddb().send(new ScanCommand({ TableName: table, ProjectionExpression: '#a', ExpressionAttributeNames: { '#a': attr }, ExclusiveStartKey: start }));
      out.push(...(r.Items || []).map((i) => (i[attr] && i[attr].S) || null));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  // The error sink's rows, three attributes only (no message, stack, user agent, uid or email): [{ day, count, url }].
  async function clientErrorRows() {
    const { ScanCommand } = require('@aws-sdk/client-dynamodb');
    const out = []; let start;
    do {
      const r = await ddb().send(new ScanCommand({
        TableName: QUALITY.errorsTable, ProjectionExpression: '#d, #c, sampleUrl', ExpressionAttributeNames: { '#d': 'day', '#c': 'count' }, ExclusiveStartKey: start,
      }));
      out.push(...(r.Items || []).map((i) => ({ day: (i.day && i.day.S) || null, count: Number(i.count && i.count.N) || 0, url: (i.sampleUrl && i.sampleUrl.S) || '' })));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  return {
    clientErrorRows,
    async listKeys(prefix) {
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      const keys = []; let token;
      do {
        const r = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
        keys.push(...(r.Contents || []).map((o) => o.Key));
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    /** newsSourceAudit's [audit] lines in [startMs, endMs] as [{ '@timestamp', '@message' }]; null when its log group does not exist. */
    async auditLog(startMs, endMs) {
      if (!(await logGroups()).includes(QUALITY.auditGroup)) return null;
      return insights(logs, { groups: [QUALITY.auditGroup], queryString: AUDIT_QUERY, startMs, endMs, maxWaitMs: QUALITY.auditMaxWaitMs });
    },
    async ownRows() {
      const [userCreated, savedKeys, shareCreated] = await Promise.all([
        scanAttr(READERS.tables.users, 'createdAt'), scanAttr(READERS.tables.saved, 'savedKey'), scanAttr(READERS.tables.shares, 'createdAt'),
      ]);
      return { userCreated, savedKeys, shareCreated };
    },
    async readText(key) {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      try {
        const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        return { text: await r.Body.transformToString(), at: r.LastModified ? new Date(r.LastModified).toISOString() : null };
      } catch (e) {
        if (named(e, 'NoSuchKey', 'NotFound')) return null;
        throw e;
      }
    },
    async putJson(key, obj, cacheControl) {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: `${JSON.stringify(obj)}\n`, ContentType: 'application/json', CacheControl: cacheControl }));
    },
    async resolverStatus() {
      const { InvokeCommand } = require('@aws-sdk/client-lambda');
      const r = await lambda().send(new InvokeCommand({ FunctionName: CONFIG.resolver.functionName, Payload: Buffer.from(JSON.stringify({ action: 'status' })) }));
      const text = Buffer.from(r.Payload || []).toString('utf8');
      if (r.FunctionError) throw new Error(`resolver status: ${r.FunctionError} ${text.slice(0, 120)}`);
      return JSON.parse(text);
    },
    async lambdaErrors(days) {
      const { GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      const results = []; let token;
      do {
        const r = await cw().send(new GetMetricDataCommand({
          StartTime: new Date(dayStart(days[0])), EndTime: new Date(dayStart(days[days.length - 1]) + 86400000), ScanBy: 'TimestampAscending', NextToken: token,
          MetricDataQueries: [{ Id: 'errors', ReturnData: true, Expression: `SEARCH('{AWS/Lambda,FunctionName} MetricName="Errors" FunctionName=${CONFIG.metricPrefix}*', 'Sum', 86400)` }],
        }));
        results.push(...(r.MetricDataResults || []));
        token = r.NextToken;
      } while (token);
      return parseErrorSeries(results);
    },
    async usageRows(days, now) {
      const groups = await logGroups();
      const rows = await insights(logs, { groups, queryString: USAGE_QUERY, startMs: dayStart(days[0]), endMs: now });
      return parseUsageRows(rows);
    },
    async compareCounts(days, now) {
      const wanted = new Set(CONFIG.compareFunctions.map((f) => `/aws/lambda/${f}`));
      const groups = (await logGroups()).filter((g) => wanted.has(g));
      return parseDifferRows(await insights(logs, { groups, queryString: DIFFER_QUERY, startMs: dayStart(days[0]), endMs: now }));
    },
    async costByService(days) {
      const { GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
      const rows = []; let token;
      do {
        const r = await ce().send(new GetCostAndUsageCommand({
          TimePeriod: { Start: days[0], End: dayOf(dayStart(days[days.length - 1]) + 86400000) }, Granularity: 'DAILY', Metrics: ['UnblendedCost'],
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }], NextPageToken: token,
        }));
        for (const t of r.ResultsByTime || []) for (const g of t.Groups || []) rows.push({ day: t.TimePeriod.Start, service: g.Keys[0], usd: Number(g.Metrics.UnblendedCost.Amount) || 0 });
        token = r.NextPageToken;
      } while (token);
      return rows;
    },
  };
}

module.exports = { makeAws, insights, parseUsageRows, parseDifferRows, parseErrorSeries, USAGE_QUERY, DIFFER_QUERY, AUDIT_QUERY, KEYS };
