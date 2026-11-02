'use strict';
// Offline harness for the handler tests of the pipeline Lambdas (newsThreadAnalysis, newsCountryIntelligence, newsDriftCorrector,
// newsSystemsAnalysis, newsCountryFactsUpdater). Nothing here touches AWS or the network:
//   - the AWS SDK modules are replaced (Module._load) by an in-memory DynamoDB (fakeDdb) and S3 (fakeS3),
//   - the shared llm.js `chat` is replaced by a scripted fake (fakeLlm); stripCodeFence stays the real one,
//   - `https` can be replaced too (the facts updater talks to Wikidata and ACLED through it).
// A Lambda is loaded fresh for each test with the environment the test wants (these Lambdas read env at load time).
const Module = require('node:module');
const path = require('node:path');
const realLlm = require('../src/llm');
const { archiveRowKey } = require('../src/dayZero');

const SHARED_SRC = path.resolve(__dirname, '../src');

// Command classes named like the SDK's, so fakeDdb tells a GetCommand from a PutCommand by constructor name.
const GetCommand = class GetCommand { constructor(input) { this.input = input; } };
const PutCommand = class PutCommand { constructor(input) { this.input = input; } };
const QueryCommand = class QueryCommand { constructor(input) { this.input = input; } };
const ScanCommand = class ScanCommand { constructor(input) { this.input = input; } };
const GetObjectCommand = class GetObjectCommand { constructor(input) { this.input = input; } };
const PutObjectCommand = class PutObjectCommand { constructor(input) { this.input = input; } };

const rowKey = (key) => (key.id !== undefined ? `id:${key.id}` : `${key.PK}|${key.SK}`);

/**
 * In-memory DynamoDB. `rows` is an array of items: { id, ... } (NewsCache style) or { PK, SK, ... }.
 *   get    -> { Item } (missing -> {})            put -> stored and logged in `puts` ({ table, item })
 *   query  -> the rows of PK whose SK starts with the begins_with value, newest SK first when ScanIndexForward is false, up to Limit
 *   scan   -> `opts.scan(input)` when given, else every row
 * `opts.fail(cmdName, input)` may return an Error to throw for that call (a DynamoDB outage).
 */
function fakeDdb(rows = [], opts = {}) {
  const store = new Map();
  const put = (item) => store.set(rowKey(item.id !== undefined ? { id: item.id } : item), item);
  rows.forEach(put);
  const d = { store, puts: [], sent: [], put };
  d.send = async (cmd) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    d.sent.push({ name, input });
    const err = opts.fail && opts.fail(name, input);
    if (err) throw err;
    if (name === 'GetCommand') return store.has(rowKey(input.Key)) ? { Item: store.get(rowKey(input.Key)) } : {};
    if (name === 'PutCommand') { d.puts.push({ table: input.TableName, item: input.Item }); put(input.Item); return {}; }
    if (name === 'QueryCommand') {
      const v = input.ExpressionAttributeValues;
      const pk = v[':pk'];
      const prefix = Object.entries(v).find(([k]) => k !== ':pk')[1];
      let items = [...store.values()].filter((it) => it.PK === pk && typeof it.SK === 'string' && it.SK.startsWith(prefix));
      items.sort((a, b) => (a.SK < b.SK ? -1 : 1));
      if (input.ScanIndexForward === false) items.reverse();
      if (input.Limit) items = items.slice(0, input.Limit);
      return { Items: items };
    }
    if (name === 'ScanCommand') return opts.scan ? opts.scan(input, store) : { Items: [...store.values()] };
    throw new Error(`fakeDdb: unexpected ${name}`);
  };
  return d;
}

/** In-memory S3 with ETags: a write whose If-Match / If-None-Match fails answers 412, a missing key NoSuchKey. */
function fakeS3(initial = {}, opts = {}) {
  const objs = new Map(Object.entries(initial)); // key -> { body, etag }
  let n = 0;
  const s = { objs, puts: [] };
  s.send = async (cmd) => {
    const i = cmd.input;
    const err = opts.fail && opts.fail(cmd.constructor.name, i);
    if (err) throw err;
    if (cmd instanceof GetObjectCommand) {
      const o = objs.get(i.Key);
      if (!o) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
      return { Body: { transformToString: async () => o.body }, ETag: o.etag };
    }
    const o = objs.get(i.Key);
    if ((i.IfNoneMatch === '*' && o) || (i.IfMatch && (!o || o.etag !== i.IfMatch))) {
      throw Object.assign(new Error('PreconditionFailed'), { name: 'PreconditionFailed', $metadata: { httpStatusCode: 412 } });
    }
    n += 1;
    s.puts.push(i);
    objs.set(i.Key, { body: String(i.Body), etag: `"e${n}"` });
    return { ETag: `"e${n}"` };
  };
  /** The JSON lines stored at key. */
  s.lines = (key) => (objs.has(key) ? objs.get(key).body.split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  /** Every key written under prefix. */
  s.keys = (prefix = '') => [...objs.keys()].filter((k) => k.startsWith(prefix)).sort();
  return s;
}

/**
 * Scripted replacement for llm.js `chat`. `script` is a string, an Error (thrown), a function (opts, callNumber) -> string | Error | { content },
 * or an array of those used in order (the last one repeats). Every call is kept in `calls` (the options chat got: step, model, user, ...).
 */
function fakeLlm(script) {
  const l = { calls: [] };
  l.chat = async (o) => {
    l.calls.push(o);
    const items = Array.isArray(script) ? script : [script];
    let r = items[Math.min(l.calls.length - 1, items.length - 1)];
    if (typeof r === 'function') r = await r(o, l.calls.length);
    if (r instanceof Error) throw r;
    return { content: typeof r === 'string' ? r : r.content, model: (r && r.model) || 'fake-model', latencyMs: 7 };
  };
  return l;
}

/** archive#YYYY-MM-DD row key and the UTC 'YYYY-MM-DD' of `daysAgo` days ago (what archiveEntries.js stamps on the entries of that row). */
function dayAgo(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return { key: archiveRowKey(d), date: d.toISOString().slice(0, 10) };
}
/** NewsCache rows { id: 'archive#...', entries } from { daysAgo: [entries] }. */
function archiveRows(byDaysAgo) {
  return Object.entries(byDaysAgo).map(([n, entries]) => ({ id: dayAgo(Number(n)).key, entries }));
}

function inDir(file, dir) { return file.startsWith(dir + path.sep); }

/**
 * Load `file` (absolute path of a Lambda's index.js) fresh and run `body(ctx)` with the fakes in place, then restore everything.
 *   env    variables to set for the load and the run (undefined deletes one)
 *   ddb, s3, llm, https, extra   the fakes (see above); `extra` is { moduleName: replacement } for anything else the Lambda requires
 * ctx = { mod, logs: { log, info, warn, error } (everything the Lambda printed, one string per call), ...the fakes }
 */
async function withLambda(file, opts, body) {
  const { env = {}, ddb = fakeDdb(), s3 = fakeS3(), llm = fakeLlm(() => { throw new Error('unexpected LLM call'); }), https, extra = {} } = opts;
  const lambdaSrc = path.dirname(file);
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const originalLoad = Module._load;
  Module._load = function load(name, ...args) {
    if (Object.prototype.hasOwnProperty.call(extra, name)) return extra[name];
    if (name === '@aws-sdk/client-dynamodb') return { DynamoDBClient: class DynamoDBClient {} };
    if (name === '@aws-sdk/lib-dynamodb') return { DynamoDBDocumentClient: { from: () => ({ send: ddb.send }) }, GetCommand, PutCommand, QueryCommand, ScanCommand };
    if (name === '@aws-sdk/client-s3') return { S3Client: class S3Client { send(c) { return s3.send(c); } }, GetObjectCommand, PutObjectCommand };
    if (name === './_shared/llm') return { ...realLlm, chat: llm.chat };
    if (name === 'https' && https) return https;
    return originalLoad.call(this, name, ...args);
  };
  for (const f of Object.keys(require.cache)) if (inDir(f, lambdaSrc) || inDir(f, SHARED_SRC)) delete require.cache[f];
  const logs = { log: [], info: [], warn: [], error: [] };
  const originalConsole = {};
  for (const k of Object.keys(logs)) { originalConsole[k] = console[k]; console[k] = (...a) => { logs[k].push(a.map(String).join(' ')); }; }
  try {
    const mod = require(file);
    return await body({ mod, logs, ddb, s3, llm });
  } finally {
    for (const k of Object.keys(logs)) console[k] = originalConsole[k];
    Module._load = originalLoad;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    for (const f of Object.keys(require.cache)) if (inDir(f, lambdaSrc) || inDir(f, SHARED_SRC)) delete require.cache[f];
  }
}

module.exports = { withLambda, fakeDdb, fakeS3, fakeLlm, dayAgo, archiveRows, GetCommand, PutCommand, QueryCommand, ScanCommand, GetObjectCommand, PutObjectCommand };
