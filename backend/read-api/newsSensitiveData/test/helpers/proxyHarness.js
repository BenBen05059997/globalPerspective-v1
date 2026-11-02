'use strict';
// Shared fakes for the handler-level tests of newsSensitiveData. Offline: the AWS SDK is stubbed through Module._load (the way the
// older tests in this folder do), DynamoDB is a `send(commandName, input)` function the test supplies, and the Firebase verifier can
// be replaced the same way. Every load builds a fresh copy of index.js, so module-level state (tables, doc client, notes) never leaks.
const Module = require('node:module');

const ENV_DEFAULTS = {
  TOPICS_DDB_TABLE: 'topics',
  SUMMARIZE_PREDICT_TABLE: 'summary',
  USERS_DDB_TABLE: undefined, // unset: the Lambda's own default table name
  FIREBASE_PROJECT_ID: undefined,
  NOTES_READS: 'ddb',
  RECORD_READS: 'ddb',
};

/**
 * @param {object} o
 * @param {object} [o.env]    overrides for the env the Lambda reads at load; an `undefined` value unsets the variable
 * @param {(name:string, input:object)=>any} [o.send]  fake DynamoDB: `name` is GetCommand / BatchGetCommand / ScanCommand / QueryCommand
 * @param {(authHeader:string)=>Promise<object|null>} [o.verify]  replaces the Firebase token verifier (default: the real one)
 */
function loadProxy({ env = {}, send = async () => ({}), verify } = {}) {
  const calls = [];
  for (const [k, v] of Object.entries({ ...ENV_DEFAULTS, ...env })) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  const original = Module._load;
  const cmd = (name) => ({ [name]: class { constructor(input) { this.input = input; this.commandName = name; } } })[name];
  Module._load = function stubbed(request, ...rest) {
    if (request === '@aws-sdk/lib-dynamodb') {
      return {
        GetCommand: cmd('GetCommand'), BatchGetCommand: cmd('BatchGetCommand'), ScanCommand: cmd('ScanCommand'), QueryCommand: cmd('QueryCommand'),
        DynamoDBDocumentClient: { from: () => ({ send: async (c) => { calls.push({ name: c.commandName, input: c.input }); return send(c.commandName, c.input); } }) },
      };
    }
    if (request === '@aws-sdk/client-dynamodb') return { DynamoDBClient: class {} };
    if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
    if (verify && request === './_shared/firebaseAuth') return { makeFirebaseVerifier: () => verify };
    return original.call(this, request, ...rest);
  };
  for (const f of ['../../src/index.js', '../../src/records.js']) delete require.cache[require.resolve(f, { paths: [__dirname] })];
  try {
    const { handler } = require('../../src/index.js');
    return { handler, calls };
  } finally { Module._load = original; }
}

/** One request through the handler: `{ status, headers, body }` with the JSON body parsed (`raw` when it is not JSON). */
async function invoke(handler, { action, payload, headers = {}, method = 'POST', qs } = {}) {
  const event = { headers, httpMethod: method, ...(qs ? { queryStringParameters: qs } : {}), ...(method === 'POST' ? { body: JSON.stringify({ action, payload }) } : {}) };
  const quiet = {}; // the handler logs every request; keep the test output readable
  for (const level of ['info', 'warn', 'error']) { quiet[level] = console[level]; console[level] = () => {}; }
  try {
    const res = await handler(event);
    let body = null;
    try { body = JSON.parse(res.body); } catch { /* not JSON (rss, preflight) */ }
    return { status: res.statusCode, headers: res.headers, body, raw: res.body };
  } finally { Object.assign(console, quiet); }
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const dayKey = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

module.exports = { loadProxy, invoke, hoursAgo, dayKey };
