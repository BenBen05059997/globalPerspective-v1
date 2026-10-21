#!/usr/bin/env node
// Local dry run of the facts writer against live tables: AWS reads only (dynamodb get-item, query, batch-get-item).
// Would-be S3 writes go to local files through the real shared helpers with local ETags. No model, no AWS mutation.
//   node dryrun.mjs --from 2026-09-06 --to 2026-10-20 --out <dir>
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {makeHandler} = require('./src/index');
const {makeStore} = require('./src/store');
const {makeManifest} = require('./src/manifest');
const {makeS3Json} = require('./src/_shared/s3json');
const world = require('./src/_shared/world');
const run = promisify(execFile);

const args = process.argv.slice(2);
const flag = (n) => args[args.indexOf(n) + 1];
if (!['--from', '--to', '--out'].every((f) => args.includes(f))) throw new Error('usage: dryrun.mjs --from YYYY-MM-DD --to YYYY-MM-DD --out <dir>');
const {from, to} = {from: flag('--from'), to: flag('--to')};
const out = resolve(flag('--out'));
mkdirSync(out, {recursive: true});
const region = 'ap-northeast-1';
const bucket = 'globalperspective-world-280362093938';
const ALLOWED = new Set(['get-item', 'query', 'batch-get-item']);

// ---- read-only DynamoDB over the aws CLI, cached for the life of the run ----
const cache = new Map();
const cached = async (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const aws = async (op, values) => {
  if (!ALLOWED.has(op)) throw new Error(`read-only adapter rejected dynamodb ${op}`);
  const {stdout} = await run('aws', ['dynamodb', op, ...values, '--region', region, '--output', 'json', '--no-cli-pager'], {maxBuffer: 256 * 1024 * 1024});
  return stdout.trim() ? JSON.parse(stdout) : {};
};
function unmarshal(v) {
  if ('S' in v) return v.S;
  if ('N' in v) return Number(v.N);
  if ('BOOL' in v) return v.BOOL;
  if ('NULL' in v) return null;
  if ('SS' in v) return v.SS;
  if ('NS' in v) return v.NS.map(Number);
  if ('L' in v) return v.L.map(unmarshal);
  if ('M' in v) return Object.fromEntries(Object.entries(v.M).map(([k, x]) => [k, unmarshal(x)]));
  throw new Error('unsupported DynamoDB value');
}
const item = (m) => unmarshal({M: m});
const key = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, {S: v}]));
const io = {
  getItem: (table, k) => cached(`g|${table}|${JSON.stringify(k)}`, async () => {
    const r = await aws('get-item', ['--table-name', table, '--key', JSON.stringify(key(k))]);
    return r.Item ? item(r.Item) : null;
  }),
  query: (table, pk, prefix) => cached(`q|${table}|${pk}|${prefix || ''}`, async () => {
    const rows = [];
    let start;
    do {
      const r = await aws('query', ['--table-name', table, '--key-condition-expression', prefix ? 'PK = :pk AND begins_with(SK, :sk)' : 'PK = :pk',
        '--expression-attribute-values', JSON.stringify(key(prefix ? {':pk': pk, ':sk': prefix} : {':pk': pk})), '--no-paginate', ...(start ? ['--exclusive-start-key', JSON.stringify(start)] : [])]);
      rows.push(...(r.Items || []).map(item));
      start = r.LastEvaluatedKey;
    } while (start);
    return rows;
  }),
  batchGet: async (table, keys) => {
    const rows = [];
    for (let i = 0; i < keys.length; i += 100) {
      let pending = {[table]: {Keys: keys.slice(i, i + 100).map(key)}};
      while (pending && Object.keys(pending).length) {
        const r = await aws('batch-get-item', ['--request-items', JSON.stringify(pending)]);
        rows.push(...((r.Responses || {})[table] || []).map(item));
        pending = r.UnprocessedKeys && Object.keys(r.UnprocessedKeys).length ? r.UnprocessedKeys : null;
      }
    }
    return rows;
  },
  getS3Json: async () => null,
};

// ---- would-be S3 writes: local files with local ETags through the real helpers ----
class Get { constructor(input) { this.input = input; } }
class Put { constructor(input) { this.input = input; } }
const etagOf = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const localS3 = {
  async send(command) {
    const i = command.input;
    const path = resolve(out, i.Key);
    if (!path.startsWith(`${out}/`)) throw new Error('unsafe object key');
    if (command instanceof Get) {
      if (!existsSync(path)) throw Object.assign(new Error('missing'), {name: 'NoSuchKey'});
      return {ETag: etagOf(path), Body: {transformToString: async () => readFileSync(path, 'utf8')}};
    }
    if (i.IfMatch && (!existsSync(path) || i.IfMatch !== etagOf(path))) throw Object.assign(new Error('stale etag'), {name: 'PreconditionFailed'});
    if (i.IfNoneMatch && existsSync(path)) throw Object.assign(new Error('exists'), {name: 'PreconditionFailed'});
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(path, i.Body);
    return {};
  },
};
const s3json = makeS3Json({client: localS3, GetObjectCommand: Get, PutObjectCommand: Put, bucket});
const manifest = makeManifest({client: localS3, GetObjectCommand: Get, PutObjectCommand: Put, bucket});

console.error(`Reading live stores (read-only) for ${from}..${to}; local shadow output ${out}`);
const handler = makeHandler({store: makeStore(io), s3json, manifest});
let result;
try { result = await handler({backfill: {from, to}, shadow: true}); } catch (e) { result = {error: e.message, days: e.days}; }

// ---- summary from the Run objects the handler wrote ----
const runsDir = join(out, 'record/shadow/runs');
const days = readdirSync(runsDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf8')));
const summary = {
  from, to, error: result.error || null,
  days: days.map((r) => ({date: r.date, runId: r.runId, status: r.status, inputs: r.inputs, counts: r.counts, failures: r.failures.length})),
  missingDays: days.filter((r) => r.inputs.archiveDay === 'missing').map((r) => r.date),
  thinDays: days.filter((r) => r.inputs.archiveDay && r.inputs.archiveDay.thin !== undefined).map((r) => ({date: r.date, entries: r.inputs.archiveDay.thin})),
  totals: Object.fromEntries(Object.keys(days[0]?.counts || {}).map((k) => [k, days.reduce((n, r) => n + r.counts[k], 0)])),
};
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary.totals), `missing ${summary.missingDays.length}`, `thin ${summary.thinDays.length}`, summary.error || '');
