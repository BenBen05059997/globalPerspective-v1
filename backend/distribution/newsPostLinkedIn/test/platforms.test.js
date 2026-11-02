'use strict';
// newsPostLinkedIn: what is sent to LinkedIn and Bluesky, which topics are skipped as already posted, the daily/per-run caps, and the dedupe row written
// after a post. Offline: DynamoDB is an in-memory fake (shared/test/stubAws), the map generator is stubbed, and global fetch is a fake of both platform APIs.
// handler.test.js covers the alarm contract (every attempted post failing throws); this file does not repeat it.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');

const INDEX = path.resolve(__dirname, '../src/index.js');
const DAY = 86400000;

const TOPICS = [
  { id: 't-low', title: 'Minor harbour dredging approved', significance: 'low', category: 'economy', regions: ['Japan'] },
  { id: 't-high', title: 'Ceasefire collapses in Sudan', significance: 'high', category: 'conflict', regions: ['Sudan', 'Chad', 'Egypt'], threadId: 'thr-sudan' },
  { id: 't-med', title: 'Central bank cuts rates', significance: 'medium', category: 'economy', regions: ['Brazil'] },
];

function makeStore() {
  const s = { topics: TOPICS, summaries: {}, posted: new Set(), recentPosts: 0, puts: [], batchKeys: [], scans: [] };
  s.ddb = (input, cmd) => {
    if (cmd === 'GetCommand') {
      if (input.TableName === 'topics') return { Item: { topics: s.topics } };
      return { Item: s.summaries[`${input.Key.PK}|${input.Key.SK}`] };
    }
    if (cmd === 'BatchGetCommand') {
      const keys = input.RequestItems.posts.Keys.map((k) => k.PK);
      s.batchKeys.push(...keys);
      return { Responses: { posts: keys.filter((k) => s.posted.has(k)).map((PK) => ({ PK })) } };
    }
    if (cmd === 'ScanCommand') {
      s.scans.push(input);
      return { Items: Array.from({ length: s.recentPosts }, (_, i) => ({ PK: `POSTED#X#${i}` })) };
    }
    if (cmd === 'PutCommand') { s.puts.push(input); return {}; }
    throw new Error(`unexpected ${cmd}`);
  };
  return s;
}

// A fake of the LinkedIn and Bluesky APIs. `behave` can override a call: (url) -> response | undefined.
function fakeApis(behave = () => undefined) {
  const calls = [];
  const res = (status, body, headers = {}) => ({
    ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: (h) => headers[h.toLowerCase()] || null },
  });
  const fn = async (url, opts = {}) => {
    const call = { url, method: opts.method, headers: opts.headers || {}, body: opts.body };
    calls.push(call);
    const custom = behave(url, call);
    if (custom) return custom;
    if (url.includes('api.linkedin.com/rest/images?action=initializeUpload')) return res(200, { value: { uploadUrl: 'https://upload.li.example/u1', image: 'urn:li:image:1' } });
    if (url === 'https://upload.li.example/u1') return res(201, {});
    if (url.includes('api.linkedin.com/rest/posts')) return res(201, {}, { 'x-restli-id': `urn:li:share:${calls.length}` });
    if (url.includes('createSession')) return res(200, { accessJwt: 'jwt-1', did: 'did:plc:abc' });
    if (url.includes('uploadBlob')) return res(200, { blob: { ref: 'blob-1' } });
    if (url.includes('createRecord')) return res(200, { uri: `at://did:plc:abc/app.bsky.feed.post/${calls.length}` });
    return res(404, {});
  };
  return { fn, calls };
}

const ENV = {
  TOPICS_DDB_TABLE: 'topics', SUMMARIZE_PREDICT_TABLE: 'summary', LINKEDIN_POSTS_TABLE: 'posts', SOCIAL_POSTS_TABLE: undefined,
  LINKEDIN_ACCESS_TOKEN: 'li-token', LINKEDIN_PERSON_ID: 'person-1', BLUESKY_IDENTIFIER: 'gp.bsky.social', BLUESKY_APP_PASSWORD: 'bsky-pw',
  MAX_POSTS_PER_RUN: '5', MAX_POSTS_PER_DAY: '100', SITE_URL: 'https://site.example/', RECORD_READS: undefined, SUMMARY_PREDICT_PK_PREFIX: undefined,
};

async function withHandler({ env = {}, fill = () => {}, behave, image = null }, fn) {
  const store = makeStore();
  fill(store);
  const api = fakeApis(behave);
  const realFetch = globalThis.fetch;
  globalThis.fetch = api.fn;
  const real = [console.log, console.warn, console.error];
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  const aws = stubAws({ ddb: store.ddb, modules: { './mapImageGenerator': { generateTopicMapImage: async () => image } } });
  try {
    const mod = aws.load(INDEX, { ...ENV, ...env });
    return await fn(mod.handler, { store, api });
  } finally {
    aws.restore();
    globalThis.fetch = realFetch;
    [console.log, console.warn, console.error] = real;
  }
}
const only = (env) => ({ LINKEDIN_ACCESS_TOKEN: undefined, LINKEDIN_PERSON_ID: undefined, BLUESKY_IDENTIFIER: undefined, BLUESKY_APP_PASSWORD: undefined, ...env });
const LI = only({ LINKEDIN_ACCESS_TOKEN: 'li-token', LINKEDIN_PERSON_ID: 'person-1' });
const BSKY = only({ BLUESKY_IDENTIFIER: 'gp.bsky.social', BLUESKY_APP_PASSWORD: 'bsky-pw' });
const liPosts = (api) => api.calls.filter((c) => c.url === 'https://api.linkedin.com/rest/posts');
const bskyRecords = (api) => api.calls.filter((c) => c.url.includes('createRecord'));

// ── request shapes ──────────────────────────────────────────────────────────

test('LinkedIn: a text post is a PUBLISHED, public post authored by the configured person, with the versioned API headers and no media when there is no image', async () => {
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '1' } }, async (handler, { api }) => {
    await handler({});
    const posts = liPosts(api);
    assert.equal(posts.length, 1);
    const [p] = posts;
    assert.equal(p.method, 'POST');
    assert.equal(p.headers.Authorization, 'Bearer li-token');
    assert.equal(p.headers['Linkedin-Version'], '202601');
    assert.equal(p.headers['X-Restli-Protocol-Version'], '2.0.0');
    const body = JSON.parse(p.body);
    assert.equal(body.author, 'urn:li:person:person-1');
    assert.equal(body.visibility, 'PUBLIC');
    assert.equal(body.lifecycleState, 'PUBLISHED');
    assert.equal(body.distribution.feedDistribution, 'MAIN_FEED');
    assert.equal('content' in body, false);
    assert.match(body.commentary, /^\[[^\]]+\] Ceasefire collapses in Sudan\n\n/); // the high-significance topic goes first
    assert.match(body.commentary, /Read full analysis: https:\/\/site\.example\/weekly\/thread\/thr-sudan/);
    assert.match(body.commentary, /#Sudan #Chad #conflict #GlobalPerspectives$/); // two regions at most, then category, then the brand tag
    assert.ok(body.commentary.length <= 3000);
  });
});

test('LinkedIn: the summary and the structured forecast are rendered as prose in the post, never as raw JSON', async () => {
  await withHandler({
    env: { ...LI, MAX_POSTS_PER_RUN: '1' },
    fill: (s) => {
      s.summaries['TOPIC#t-high|SUMMARY'] = { content: '## Heading\nThe **ceasefire** collapsed overnight.\n\nWatchlist Signals\n- hidden' };
      s.summaries['TOPIC#t-high|PREDICTION'] = { content: JSON.stringify({ scenarios: [{ label: 'Escalation', probability_range: '60-70%', horizon: '2 weeks', rationale: 'Talks have stalled.' }] }) };
    },
  }, async (handler, { api }) => {
    await handler({});
    const text = JSON.parse(liPosts(api)[0].body).commentary;
    assert.match(text, /The ceasefire collapsed overnight\./);
    assert.doesNotMatch(text, /\*\*|##|Watchlist Signals|hidden/);
    assert.match(text, /Forecast:\n\nEscalation \(60-70%, 2 weeks\): Talks have stalled\./);
    assert.doesNotMatch(text, /scenarios|probability_range/);
  });
});

test('LinkedIn: with a map image the image is registered, uploaded as PNG with the token, and attached to the post', async () => {
  const png = Buffer.from('fake-png');
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '1' }, image: png }, async (handler, { api }) => {
    await handler({});
    const urls = api.calls.map((c) => c.url);
    assert.deepEqual(urls.slice(0, 3), ['https://api.linkedin.com/rest/images?action=initializeUpload', 'https://upload.li.example/u1', 'https://api.linkedin.com/rest/posts']);
    assert.equal(JSON.parse(api.calls[0].body).initializeUploadRequest.owner, 'urn:li:person:person-1');
    assert.equal(api.calls[1].method, 'PUT');
    assert.equal(api.calls[1].headers['Content-Type'], 'image/png');
    assert.equal(api.calls[1].headers.Authorization, 'Bearer li-token');
    assert.equal(api.calls[1].body, png);
    assert.deepEqual(JSON.parse(api.calls[2].body).content.media, { id: 'urn:li:image:1', title: 'Global Perspectives Map' });
  });
});

test('LinkedIn: when the image upload fails the post still goes out as text-only', async () => {
  const behave = (url) => (url.includes('images?action=initializeUpload') ? { ok: false, status: 500, text: async () => 'down', json: async () => ({}), headers: { get: () => null } } : undefined);
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '1' }, image: Buffer.from('x'), behave }, async (handler, { api, store }) => {
    const r = JSON.parse((await handler({})).body);
    assert.equal(r.platforms.LINKEDIN.posted, 1);
    assert.equal('content' in JSON.parse(liPosts(api)[0].body), false);
    assert.equal(store.puts.length, 1);
  });
});

test('Bluesky: logs in with the identifier and app password, then creates a post record in that repo with the session token', async () => {
  await withHandler({ env: { ...BSKY, MAX_POSTS_PER_RUN: '1' } }, async (handler, { api }) => {
    await handler({});
    const session = api.calls.find((c) => c.url.includes('createSession'));
    assert.deepEqual(JSON.parse(session.body), { identifier: 'gp.bsky.social', password: 'bsky-pw' });
    const [rec] = bskyRecords(api);
    assert.equal(rec.headers.Authorization, 'Bearer jwt-1');
    const body = JSON.parse(rec.body);
    assert.equal(body.repo, 'did:plc:abc');
    assert.equal(body.collection, 'app.bsky.feed.post');
    assert.equal(body.record.$type, 'app.bsky.feed.post');
    assert.match(body.record.text, /^\[[^\]]+\] Ceasefire collapses in Sudan\n\nhttps:\/\/site\.example\/\n\n#Sudan #Chad #conflict #GlobalPerspectives$/);
    assert.equal('embed' in body.record, false);
    assert.ok(!Number.isNaN(Date.parse(body.record.createdAt)));
  });
});

test('Bluesky: a long title is trimmed so the whole post fits in 300 characters', async () => {
  await withHandler({ env: { ...BSKY, MAX_POSTS_PER_RUN: '1' }, fill: (s) => { s.topics = [{ id: 'long', title: 'Very long headline '.repeat(30), significance: 'high', category: 'conflict', regions: ['Sudan'] }]; } }, async (handler, { api }) => {
    await handler({});
    const text = JSON.parse(bskyRecords(api)[0].body).record.text;
    assert.ok(text.length <= 300, `length ${text.length}`);
    assert.match(text, /\.\.\.\n\nhttps:\/\/site\.example\/\n\n#Sudan/);
  });
});

test('Bluesky: with a map image the blob is uploaded and embedded with alt text; if the blob upload fails the post is text-only', async () => {
  await withHandler({ env: { ...BSKY, MAX_POSTS_PER_RUN: '1' }, image: Buffer.from('png') }, async (handler, { api }) => {
    await handler({});
    const up = api.calls.find((c) => c.url.includes('uploadBlob'));
    assert.equal(up.headers['Content-Type'], 'image/png');
    assert.equal(up.headers.Authorization, 'Bearer jwt-1');
    const rec = JSON.parse(bskyRecords(api)[0].body).record;
    assert.equal(rec.embed.$type, 'app.bsky.embed.images');
    assert.deepEqual(rec.embed.images[0].image, { ref: 'blob-1' });
    assert.equal(rec.embed.images[0].alt, rec.text.substring(0, 300));
  });
  const behave = (url) => (url.includes('uploadBlob') ? { ok: false, status: 413, text: async () => 'big', json: async () => ({}), headers: { get: () => null } } : undefined);
  await withHandler({ env: { ...BSKY, MAX_POSTS_PER_RUN: '1' }, image: Buffer.from('png'), behave }, async (handler, { api }) => {
    const r = JSON.parse((await handler({})).body);
    assert.equal(r.platforms.BLUESKY.posted, 1);
    assert.equal('embed' in JSON.parse(bskyRecords(api)[0].body).record, false);
  });
});

// ── what is chosen: dedupe, order, caps ─────────────────────────────────────

test('topics are posted high significance first, and MAX_POSTS_PER_RUN limits how many', async () => {
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '2' } }, async (handler, { api }) => {
    const r = JSON.parse((await handler({})).body);
    assert.deepEqual([r.platforms.LINKEDIN.posted, r.platforms.LINKEDIN.attempted], [2, 2]);
    const titles = liPosts(api).map((c) => JSON.parse(c.body).commentary.split('\n')[0]);
    assert.match(titles[0], /Ceasefire collapses in Sudan/);
    assert.match(titles[1], /Central bank cuts rates/);
    assert.ok(!titles.some((t) => /dredging/.test(t)), 'the low-significance topic is left for a later run');
  });
});

test('a topic already posted on a platform is skipped there, the old un-prefixed LinkedIn key counts for LinkedIn only, and each platform dedupes on its own', async () => {
  const fill = (s) => { s.posted = new Set(['POSTED#LINKEDIN#ceasefire-collapses-in-sudan', 'POSTED#central-bank-cuts-rates']); };
  await withHandler({ env: LI, fill }, async (handler, { api }) => {
    const r = JSON.parse((await handler({})).body);
    assert.equal(r.platforms.LINKEDIN.posted, 1);
    assert.match(JSON.parse(liPosts(api)[0].body).commentary, /Minor harbour dredging approved/);
  });
  await withHandler({ env: BSKY, fill }, async (handler, { api }) => {
    const r = JSON.parse((await handler({})).body);
    assert.equal(r.platforms.BLUESKY.posted, 3, 'LinkedIn history does not suppress Bluesky');
    assert.equal(bskyRecords(api).length, 3);
  });
});

test('when everything was posted already the platform is skipped with no API call at all', async () => {
  await withHandler({
    env: LI,
    fill: (s) => { s.posted = new Set(['minor-harbour-dredging-approved', 'ceasefire-collapses-in-sudan', 'central-bank-cuts-rates'].map((f) => `POSTED#LINKEDIN#${f}`)); },
  }, async (handler, { api }) => {
    const r = JSON.parse((await handler({})).body);
    assert.deepEqual(r.platforms.LINKEDIN, { status: 'skipped', reason: 'no new topics' });
    assert.equal(api.calls.length, 0);
  });
});

test('daily cap: at the cap nothing is posted; below it only the remaining slots are used', async () => {
  await withHandler({ env: { ...LI, MAX_POSTS_PER_DAY: '3' }, fill: (s) => { s.recentPosts = 3; } }, async (handler, { api }) => {
    const r = JSON.parse((await handler({})).body);
    assert.deepEqual(r.platforms.LINKEDIN, { status: 'skipped', reason: 'daily limit reached', dailyCount: 3 });
    assert.equal(api.calls.length, 0);
  });
  await withHandler({ env: { ...LI, MAX_POSTS_PER_DAY: '3' }, fill: (s) => { s.recentPosts = 2; } }, async (handler, { api, store }) => {
    const r = JSON.parse((await handler({})).body);
    assert.equal(r.platforms.LINKEDIN.posted, 1);
    assert.equal(liPosts(api).length, 1);
    // the count is of this platform's posts in the last 24 hours
    assert.equal(store.scans[0].ExpressionAttributeValues[':prefix'], 'POSTED#LINKEDIN#');
    const since = Date.parse(store.scans[0].ExpressionAttributeValues[':since']);
    assert.ok(Math.abs(Date.now() - DAY - since) < 5000);
  });
});

// ── the dedupe row ──────────────────────────────────────────────────────────

test('after a successful post a POSTED#<platform>#<fingerprint> row is written with the platform post id and a 30-day ttl; a failed post writes none', async () => {
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '1' } }, async (handler, { store }) => {
    const before = Math.floor(Date.now() / 1000);
    await handler({});
    assert.equal(store.puts.length, 1);
    assert.equal(store.puts[0].TableName, 'posts');
    const item = store.puts[0].Item;
    assert.equal(item.PK, 'POSTED#LINKEDIN#ceasefire-collapses-in-sudan');
    assert.equal(item.platform, 'LINKEDIN');
    assert.equal(item.topicTitle, 'Ceasefire collapses in Sudan');
    assert.equal(item.topicId, 't-high');
    assert.match(item.postId, /^urn:li:share:/);
    assert.ok(Date.parse(item.postedAt) <= Date.now());
    assert.ok(item.ttl >= before + 30 * 86400 - 2 && item.ttl <= before + 30 * 86400 + 5);
  });
  await withHandler({ env: { ...BSKY, MAX_POSTS_PER_RUN: '1' } }, async (handler, { store }) => {
    await handler({});
    assert.equal(store.puts[0].Item.PK, 'POSTED#BLUESKY#ceasefire-collapses-in-sudan');
    assert.match(store.puts[0].Item.postId, /^at:\/\//);
  });
  const fail = (url) => (url.includes('rest/posts') ? { ok: false, status: 500, text: async () => 'boom', json: async () => ({}), headers: { get: () => null } } : undefined);
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '1' }, behave: fail }, async (handler, { store }) => {
    await assert.rejects(handler({}), /Every attempted post failed on LINKEDIN/);
    assert.equal(store.puts.length, 0, 'so the same topic is tried again next run');
  });
});

test('the fingerprint folds case, accents and punctuation: a re-worded punctuation or accent change is still the same story', async () => {
  const fill = (s) => { s.topics = [{ id: 'a', title: '  Élysée: Budget -- Passes!! ', significance: 'high', category: 'politics', regions: ['France'] }]; };
  await withHandler({ env: { ...LI, MAX_POSTS_PER_RUN: '1' }, fill }, async (handler, { store }) => {
    await handler({});
    assert.equal(store.puts[0].Item.PK, 'POSTED#LINKEDIN#elysee-budget-passes');
  });
});

// ── skip paths ──────────────────────────────────────────────────────────────

test('no platform configured, no topics, or a missing table env: 200 skipped, 200 skipped, 500 naming the variable', async () => {
  await withHandler({ env: only({}) }, async (handler, { api }) => {
    assert.deepEqual(JSON.parse((await handler({})).body), { status: 'skipped', reason: 'no platforms configured' });
    assert.equal(api.calls.length, 0);
  });
  await withHandler({ env: LI, fill: (s) => { s.topics = []; } }, async (handler, { api }) => {
    assert.deepEqual(JSON.parse((await handler({})).body), { status: 'skipped', reason: 'no topics' });
    assert.equal(api.calls.length, 0);
  });
  await withHandler({ env: { LINKEDIN_POSTS_TABLE: undefined } }, async (handler, { api }) => {
    const r = await handler({});
    assert.equal(r.statusCode, 500);
    assert.match(JSON.parse(r.body).error, /SOCIAL_POSTS_TABLE \/ LINKEDIN_POSTS_TABLE/);
    assert.equal(api.calls.length, 0);
  });
});

test('LinkedIn needs both the token and the person id; Bluesky needs both the identifier and the app password', async () => {
  await withHandler({ env: only({ LINKEDIN_ACCESS_TOKEN: 'li-token', BLUESKY_IDENTIFIER: 'x.bsky.social' }) }, async (handler) => {
    assert.equal(JSON.parse((await handler({})).body).reason, 'no platforms configured');
  });
});
