'use strict';
// Test doubles: an S3 client that models ETags and conditional writes (like backend/shared s3json tests), and
// a handler harness that runs src/index.js with a fixed clock, fixture feeds, a fake model and a fake DynamoDB.
const fs = require('node:fs');
const path = require('node:path');
const { loadIndex } = require('./load');

class FakeS3 {
  constructor(events = []) { this.store = new Map(); this.events = events; this.n = 0; this.failPuts = false; }
  makeClient() {
    const self = this;
    class GetObjectCommand { constructor(i) { this.input = i; } }
    class PutObjectCommand { constructor(i) { this.input = i; } }
    const client = {
      async send(cmd) {
        const { Key, Body, IfMatch, IfNoneMatch } = cmd.input;
        if (cmd instanceof GetObjectCommand) {
          const o = self.store.get(Key);
          if (!o) { const e = new Error('no key'); e.name = 'NoSuchKey'; throw e; }
          return { Body: { transformToString: async () => o.body }, ETag: o.etag };
        }
        self.events.push(`s3 put ${Key}`);
        if (self.failPuts) throw new Error('S3 is down');
        const o = self.store.get(Key);
        if ((IfNoneMatch === '*' && o) || (IfMatch && (!o || o.etag !== IfMatch))) { const e = new Error('precondition'); e.name = 'PreconditionFailed'; e.$metadata = { httpStatusCode: 412 }; throw e; }
        self.store.set(Key, { body: String(Body), etag: `"e${++self.n}"` });
        return {};
      },
    };
    return { client, GetObjectCommand, PutObjectCommand };
  }
  lines(key) { const o = this.store.get(key); return o ? o.body.split('\n').filter(Boolean).map((l) => JSON.parse(l)) : null; }
  keys() { return [...this.store.keys()].sort(); }
}

const FIXTURES = path.join(__dirname, 'fixtures', 'feeds');
const NOW = '2026-10-22T12:00:00.000Z';

/** Runs the handler once. opts: env, s3 (FakeS3), failPuts, topics(urls) -> model topics, archive: {[date]: [titles]}, seen: [titles]. */
async function runHandler({ env = {}, s3 = new FakeS3(), topics, archive = {}, seen = [], modelError } = {}) {
  const events = s3.events;
  const { client, GetObjectCommand, PutObjectCommand } = s3.makeClient();
  const prompts = [];
  const written = [];
  const ddb = {
    send: async (cmd) => {
      const i = cmd.input || {};
      if (cmd.constructor.name === 'PutCommand') { written.push(i.Item); return {}; }
      if (i.Key && i.Key.id === 'seen-today') return { Item: { entries: seen.map((title) => ({ title, fingerprint: title, seenAt: Date.parse(NOW) - 1000 })) } };
      const m = i.Key && String(i.Key.id).match(/^archive#(.+)$/);
      if (m && archive[m[1]]) return { Item: { entries: archive[m[1]].map((title) => ({ title })) } };
      return {};
    },
  };
  const fetchMock = async (url) => {
    const { RSS_FEEDS } = mod._internal;
    const feed = RSS_FEEDS.find((f) => f.url === url);
    const xml = fs.readFileSync(path.join(FIXTURES, `${feed.name.replace(/\W+/g, '_')}.xml`), 'utf8');
    return { ok: true, status: 200, text: async () => xml };
  };
  const mod = loadIndex({
    now: NOW,
    env: { XAI_API_KEY: 'test', TOPICS_DDB_TABLE: 'T', WORLD_BUCKET: 'bucket', ...env },
    overrides: {
      fetch: fetchMock,
      '@aws-sdk/client-s3': { S3Client: class { constructor() { return client; } }, GetObjectCommand, PutObjectCommand },
      '@aws-sdk/lib-dynamodb': { DynamoDBDocumentClient: { from: () => ddb }, GetCommand: class { constructor(i) { this.input = i; } }, PutCommand: class { constructor(i) { this.input = i; } } },
      './_shared/llm': {
        chat: async ({ user }) => {
          events.push('model');
          prompts.push(user);
          if (modelError) throw new Error(modelError);
          const urls = [...user.matchAll(/URL: (\S+)/g)].map((m) => m[1]);
          const list = topics ? topics(urls) : [{ title: 'Test topic one', category: 'politics', sources: [{ url: urls[0] }] }];
          return { content: JSON.stringify({ topics: list }), finishReason: 'stop', usage: {} };
        },
      },
    },
  });
  const result = await mod.handler({ source: 'aws.events' });
  return { result, events, prompts, written, s3 };
}

module.exports = { FakeS3, runHandler, NOW };
