'use strict';
// Handler-level tests with DynamoDB, the map generator and fetch stubbed (no network, no AWS).
// They pin the alarm contract: a platform that attempted posts and posted none makes the run throw.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
const path = require('node:path');

process.env.TOPICS_DDB_TABLE = 'topics';
process.env.SUMMARIZE_PREDICT_TABLE = 'summary';
process.env.LINKEDIN_POSTS_TABLE = 'posts';
process.env.LINKEDIN_ACCESS_TOKEN = 'li-token';
process.env.LINKEDIN_PERSON_ID = 'person';
process.env.BLUESKY_IDENTIFIER = 'gp.bsky.social';
process.env.BLUESKY_APP_PASSWORD = 'pw';
process.env.MAX_POSTS_PER_RUN = '2';

const TOPICS = [
  { id: 't1', title: 'Parliament passes the budget', significance: 'high', regions: ['France'], threadId: 'thread-budget 1' },
  { id: 't2', title: 'Central bank cuts rates', significance: 'medium', regions: ['Japan'] },
];

class Cmd { constructor(input) { this.input = input; } }
class GetCommand extends Cmd {}
const ddbSend = async (cmd) => {
  if (cmd instanceof GetCommand) return cmd.input.Key.id === 'latest' ? { Item: { topics: TOPICS } } : { Item: { content: 'Summary.' } };
  if (cmd.constructor.name === 'BatchGetCommand') return { Responses: {} };
  if (cmd.constructor.name === 'ScanCommand') return { Items: [] };
  return {};
};
const stubs = {
  '@aws-sdk/client-dynamodb': { DynamoDBClient: class {} },
  '@aws-sdk/lib-dynamodb': {
    DynamoDBDocumentClient: { from: () => ({ send: ddbSend }) },
    GetCommand,
    PutCommand: class PutCommand extends Cmd {},
    BatchGetCommand: class BatchGetCommand extends Cmd {},
    ScanCommand: class ScanCommand extends Cmd {},
  },
  './mapImageGenerator': { generateTopicMapImage: async () => null },
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  return Object.prototype.hasOwnProperty.call(stubs, request) ? stubs[request] : origLoad.call(this, request, ...rest);
};
const { handler } = require(path.join(__dirname, '../src/index.js'));
Module._load = origLoad;

// fetch stub: `linkedin` / `bluesky` decide each platform's post outcome ('ok' | status code).
function stubFetch({ linkedin, bluesky }) {
  const json = (status, body, headers = {}) => ({
    ok: status < 400, status,
    json: async () => body, text: async () => JSON.stringify(body),
    headers: { get: (h) => headers[h.toLowerCase()] || null },
  });
  global.fetch = async (url) => {
    if (url.includes('api.linkedin.com/rest/posts')) {
      return linkedin === 'ok' ? json(201, {}, { 'x-restli-id': 'urn:li:share:1' }) : json(linkedin, { message: 'fail' });
    }
    if (url.includes('createSession')) return json(200, { accessJwt: 'jwt', did: 'did:plc:x' });
    if (url.includes('createRecord')) return bluesky === 'ok' ? json(200, { uri: 'at://x' }) : json(bluesky, { error: 'fail' });
    return json(404, {});
  };
}

test('every LinkedIn post failing throws (alarm fires), even when Bluesky succeeds', async () => {
  stubFetch({ linkedin: 500, bluesky: 'ok' });
  await assert.rejects(handler({}), /Every attempted post failed on LINKEDIN/);
});

test('an expired LinkedIn token (401 stops after one attempt) throws', async () => {
  stubFetch({ linkedin: 401, bluesky: 'ok' });
  await assert.rejects(handler({}), /LINKEDIN/);
});

test('both platforms failing names both', async () => {
  stubFetch({ linkedin: 500, bluesky: 500 });
  await assert.rejects(handler({}), /LINKEDIN, BLUESKY/);
});

test('all posts succeeding returns 200 with per-platform counts', async () => {
  stubFetch({ linkedin: 'ok', bluesky: 'ok' });
  const res = await handler({});
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.platforms.LINKEDIN.posted, 2);
  assert.strictEqual(body.platforms.BLUESKY.posted, 2);
});

test('partial success on a platform is a normal return', async () => {
  let n = 0;
  stubFetch({ linkedin: 'ok', bluesky: 'ok' });
  const ok = global.fetch;
  global.fetch = async (url, opts) => {
    if (url.includes('api.linkedin.com/rest/posts') && n++ === 0) return { ok: false, status: 500, text: async () => 'boom', headers: { get: () => null } };
    return ok(url, opts);
  };
  const res = await handler({});
  assert.strictEqual(res.statusCode, 200);
  const li = JSON.parse(res.body).platforms.LINKEDIN;
  assert.deepStrictEqual([li.posted, li.attempted], [1, 2]);
});

test('a LinkedIn post links its story page when the topic has a thread, else the site', async () => {
  stubFetch({ linkedin: 'ok', bluesky: 'ok' });
  const sent = [];
  const ok = global.fetch;
  global.fetch = async (url, opts) => {
    if (url.includes('api.linkedin.com/rest/posts')) sent.push(JSON.parse(opts.body).commentary);
    return ok(url, opts);
  };
  await handler({});
  assert.ok(sent.some((c) => c.includes('Read full analysis: https://globalperspective.net/weekly/thread/thread-budget%201')));
  assert.ok(sent.some((c) => c.includes('Read full analysis: https://globalperspective.net/\n')));
});
