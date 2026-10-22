import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../baseline/worker2.mjs';
import patched from './worker.mjs';

const env = { S3_ACCESS_KEY_ID: 'AKIATEST', S3_SECRET_ACCESS_KEY: 'secret' };
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Stub origin: records every outbound call; behaviour keyed on URL. `api(action, payload)` answers
// the proxy's POST actions (default: no data).
function makeFetch(log, api = () => null) {
  return async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const u = new URL(req.url);
    log.push(`${req.method} ${req.url}`);
    if (u.hostname === 'ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com') {
      if (u.searchParams.get('action') === 'rss') return new Response('<rss/>', { status: 200 });
      const body = req.method === 'POST' ? await req.json() : {};
      return new Response(JSON.stringify({ data: api(body.action, body.payload || {}) }), { status: 200 });
    }
    if (u.hostname.endsWith('.amazonaws.com')) {
      return u.pathname.includes('missing') ? new Response('', { status: 403 }) : new Response('{"ok":1}', { status: 200, headers: { etag: '"e1"' } });
    }
    if (u.pathname === '/index.html') return new Response('<title>SHELL</title>', { status: 200 });
    if (u.pathname === '/blog' ) return new Response('', { status: 301, headers: { location: '/blog/' } });
    if (u.pathname === '/blog/') return new Response('<title>Blog — Global Perspectives</title>', { status: 200, headers: { 'X-Origin': 'pages' } });
    if (u.pathname === '/blog/pair-intelligence/') return new Response('<title>Article</title>', { status: 200 });
    if (u.pathname === '/blog/feed.xml') return new Response('<feed/>', { status: 200 });
    if (u.pathname === '/app.js') return new Response('js', { status: 200 });
    return new Response('origin 404', { status: 404 });
  };
}

async function run(worker, url, { method = 'GET', ua, api } = {}) {
  const log = [];
  const orig = globalThis.fetch;
  globalThis.fetch = makeFetch(log, api);
  try {
    const headers = ua ? { 'User-Agent': ua } : {};
    const res = await worker.fetch(new Request(url, { method, headers, redirect: 'manual' }), env, {});
    const body = await res.text();
    return { status: res.status, body, headers: Object.fromEntries([...res.headers].filter(([k]) => k !== 'date')), log };
  } finally { globalThis.fetch = orig; }
}

const H = 'https://globalperspective.net';

test('/blog/ passes through to origin unchanged', async () => {
  const r = await run(patched, `${H}/blog/`);
  assert.equal(r.status, 200);
  assert.match(r.body, /Blog — Global Perspectives/);
  assert.equal(r.headers['x-origin'], 'pages');
  assert.deepEqual(r.log, [`GET ${H}/blog/`]);
});

test('/blog (no slash) passes the origin redirect through', async () => {
  const r = await run(patched, `${H}/blog`);
  assert.equal(r.status, 301);
  assert.equal(r.headers.location, '/blog/');
  assert.deepEqual(r.log, [`GET ${H}/blog`]);
});

test('/blog/<article>/ passes through', async () => {
  const r = await run(patched, `${H}/blog/pair-intelligence/`);
  assert.equal(r.status, 200);
  assert.equal(r.body, '<title>Article</title>');
  assert.deepEqual(r.log, [`GET ${H}/blog/pair-intelligence/`]);
});

test('missing /blog/nope/ returns the origin 404, not the shell', async () => {
  const r = await run(patched, `${H}/blog/nope/`);
  assert.equal(r.status, 404);
  assert.equal(r.body, 'origin 404');
  assert.ok(!r.log.some((l) => l.includes('/index.html')));
});

test('HEAD /blog/ and Googlebot /blog/ pass through (no pre-render, no shell)', async () => {
  for (const opts of [{ method: 'HEAD' }, { ua: GOOGLEBOT }]) {
    const r = await run(patched, `${H}/blog/`, opts);
    assert.equal(r.status, 200);
    assert.ok(!r.log.some((l) => l.includes('/index.html') || l.includes('execute-api')));
  }
});

test('lookalikes (/blogger, /blog-x) still get the shell', async () => {
  for (const p of ['/blogger', '/blog-x/y']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
  }
});

test('shell fallback for /, /weekly, /weekly/thread/x is unchanged', async () => {
  for (const p of ['/', '/weekly', '/weekly/thread/x']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.status, 200);
    assert.equal(r.body, '<title>SHELL</title>');
    assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
  }
});

// Baseline vs patched must be identical for everything outside /blog, the retired-route 301s, the root
// page directory and the /briefings + /today pre-renders (each tested below).
const SAME = [
  ['GET', '/'], ['GET', '/weekly'], ['GET', '/weekly/thread/x'], ['GET', '/weekly/countries'], ['GET', '/analyze/s/abc'],
  ['GET', '/rss'], ['GET', '/rss/'], ['GET', '/app.js'], ['GET', '/nope.png'],
  ['GET', '/data/world/latest.json'], ['GET', '/data/world/missing.json'], ['GET', '/data/evil/x.json'], ['GET', '/data/world/a.member.json'],
  ['POST', '/weekly'], ['HEAD', '/weekly'], ['POST', '/daily'],
  ['GET', '/weekly/thread/x', GOOGLEBOT], ['GET', '/briefings', GOOGLEBOT], ['GET', '/analyze/s/abc', GOOGLEBOT],
];
test(`baseline vs patched identical for ${SAME.length} non-blog requests`, async () => {
  for (const [method, path, ua] of SAME) {
    const a = await run(baseline, `${H}${path}`, { method, ua });
    const b = await run(patched, `${H}${path}`, { method, ua });
    assert.deepEqual(b, a, `${method} ${path} ${ua ? '(bot)' : ''}`);
  }
});

// Record views (0037) are public through /data/*; facts, runs, readings and shadow views are not.
test('/data/record/views/* is served with the shared cache rule; other record prefixes are 404 without an S3 call', async () => {
  for (const key of ['index/active.json', 'stories/story-a.json', 'links/story-a.json', 'counts/2026-10-21.json', 'manifest.json']) {
    const r = await run(patched, `${H}/data/record/views/${key}`);
    assert.equal(r.status, 200, key);
    assert.equal(r.headers['cache-control'], 'public, s-maxage=300, stale-while-revalidate=600', key);
    assert.equal(r.headers.etag, '"e1"', key);
    assert.equal(r.log.filter((l) => l.includes('amazonaws.com')).length, 1, key);
  }
  const absent = await run(patched, `${H}/data/record/views/stories/missing.json`);
  assert.equal(absent.status, 404);
  assert.equal(JSON.parse(absent.body).error, 'not generated yet');
  for (const key of ['record/facts/2026-10-21.jsonl', 'record/facts/x.json', 'record/runs/x.json', 'record/readings/x.json', 'record/shadow/views/index/active.json', 'record/index.json', 'record/views/x.txt']) {
    const r = await run(patched, `${H}/data/${key}`);
    assert.equal(r.status, 404, key);
    assert.deepEqual(r.log, [], key);
  }
});

test('baseline really did shadow /blog/ (regression proof)', async () => {
  const a = await run(baseline, `${H}/blog/`);
  assert.equal(a.body, '<title>SHELL</title>');
});

// ── Retired addresses: real 301s, query strings kept ────────────────────────────────────────────
const REDIRECTS = [
  ['/daily', '/briefings?mode=read'],
  ['/daily/', '/briefings?mode=read'],
  ['/daily/2026-09-12', '/briefings?mode=read&date=2026-09-12'],
  ['/daily/yesterday', '/briefings?mode=read'],
  ['/daily?utm_source=x', '/briefings?mode=read&utm_source=x'],
  ['/weekly-brief', '/briefings?mode=weekly'],
  ['/weekly-brief?utm_source=email', '/briefings?mode=weekly&utm_source=email'],
  ['/weekly-markets', '/briefings?from=markets'],
  ['/spider-demo', '/weekly?view=web'],
  ['/map', '/'],
  ['/map?story=thread-a&layer=b', '/?story=thread-a&layer=b'],
  ['/weekly?section=countries', '/weekly/countries'],
  ['/weekly?section=countries&q=x', '/weekly/countries?q=x'],
  ['/analyze', '/weekly/countries'],
  ['/analyze/', '/weekly/countries'],
  ['/analyze?stories=thread-us-supreme-court-c1602d', '/weekly/thread/thread-us-supreme-court-c1602d'],
  ['/analyze?stories=thread-a,thread-b&utm_source=x', '/weekly/thread/thread-a?utm_source=x'],
  ['/analyze?stories=t1', '/weekly/countries'],
  ['/analyze?stories=', '/weekly/countries'],
];
test(`retired addresses answer 301 with the query kept (${REDIRECTS.length} cases, human and bot)`, async () => {
  for (const [from, to] of REDIRECTS) {
    for (const ua of [undefined, GOOGLEBOT]) {
      const r = await run(patched, `${H}${from}`, { ua });
      assert.equal(r.status, 301, from);
      assert.equal(r.headers.location, `${H}${to}`, from);
      assert.deepEqual(r.log, [], `${from} makes no outbound call`);
    }
  }
  const head = await run(patched, `${H}/daily`, { method: 'HEAD' });
  assert.equal(head.status, 301);
});

test('/analyze/s/:id shared runs are not redirected and never bot-rendered', async () => {
  for (const ua of [undefined, GOOGLEBOT]) {
    const r = await run(patched, `${H}/analyze/s/abc`, { ua });
    assert.equal(r.status, 200);
    assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
  }
});

test('/weekly without section=countries is not redirected', async () => {
  const r = await run(patched, `${H}/weekly?view=web`);
  assert.equal(r.status, 200);
  assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
});

// ── Bot pre-render: /briefings modes and /today ─────────────────────────────────────────────────
const daily = (dateKey) => ({
  dateKey, displayDate: dateKey, headline: `Headline ${dateKey}`, summary: '**Bold** summary.',
  stats: { totalArticles: 10, countriesCovered: 3, sourceOutlets: 4 },
  topStories: [{ title: 'Story A', threadId: 'thread-a', regions: ['France'], prediction: 'p' }, { title: 'Story B', threadId: null }],
  risingThread: { title: 'Rising', threadId: 'thread-r', oneLiner: 'grows' },
  countryToWatch: { countryName: 'Sudan', headline: 'h' },
});
const weeklyBrief = (weekOf) => ({ weekOf, signals: [{ lede: 'Signal', fact: 'F', region: 'Sudan', threadId: 'thread-s' }], watch: [{ event: 'Vote' }] });
const canonical = (body) => body.match(/<link rel="canonical" href="([^"]+)">/)[1];

test('bot /briefings (read, latest): canonical names the served date', async () => {
  const api = (action) => (action === 'latest_daily_brief' ? daily('2026-09-12') : null);
  const r = await run(patched, `${H}/briefings`, { ua: GOOGLEBOT, api });
  assert.equal(r.headers['x-rendered-by'], 'cf-worker-bot');
  assert.equal(canonical(r.body), `${H}/briefings?mode=read&amp;date=2026-09-12`);
  assert.match(r.body, /href="https:\/\/globalperspective.net\/weekly\/thread\/thread-a">Story A</);
  assert.match(r.body, /<strong>Story B<\/strong>/);
  assert.match(r.body, /href="https:\/\/globalperspective.net\/weekly\/thread\/thread-r">Rising</);
});

test('bot /briefings?mode=read&date= with no edition that day: the nearest earlier one, canonical served', async () => {
  const api = (action, payload) => (action === 'daily_brief' && payload.dateKey === '2026-09-10' ? daily('2026-09-10') : null);
  const r = await run(patched, `${H}/briefings?mode=read&date=2026-09-12`, { ua: GOOGLEBOT, api });
  assert.equal(canonical(r.body), `${H}/briefings?mode=read&amp;date=2026-09-10`);
});

test('bot /briefings?mode=present names the read page as canonical; deck=weekly the weekly one', async () => {
  const api = (action) => (action === 'latest_daily_brief' ? daily('2026-09-12') : action === 'weekly_brief' ? weeklyBrief('2026-10-11') : null);
  const a = await run(patched, `${H}/briefings?mode=present`, { ua: GOOGLEBOT, api });
  assert.equal(canonical(a.body), `${H}/briefings?mode=read&amp;date=2026-09-12`);
  const b = await run(patched, `${H}/briefings?mode=present&deck=weekly`, { ua: GOOGLEBOT, api });
  assert.equal(canonical(b.body), `${H}/briefings?mode=weekly&amp;week=2026-10-11`);
});

test('bot /briefings?mode=weekly&week= asks for that week; canonical names the week served', async () => {
  const asked = [];
  const api = (action, payload) => { if (action === 'weekly_brief') { asked.push(payload.week); return weeklyBrief('2026-10-04'); } return null; };
  const r = await run(patched, `${H}/briefings?mode=weekly&week=2026-10-04`, { ua: GOOGLEBOT, api });
  assert.deepEqual(asked, ['2026-10-04']);
  assert.equal(canonical(r.body), `${H}/briefings?mode=weekly&amp;week=2026-10-04`);
  assert.match(r.body, /Weekly Signals Brief — week of 2026-10-04/);
});

test("bot /today renders today's topics; no topics falls through to the shell", async () => {
  const api = (action) => (action === 'topics' ? { generatedDate: 'October 19, 2026', topics: [{ title: 'Topic one', regions: ['France'], threadId: 'thread-t' }, { title: 'Topic two' }] } : null);
  const r = await run(patched, `${H}/today`, { ua: GOOGLEBOT, api });
  assert.equal(r.headers['x-rendered-by'], 'cf-worker-bot');
  assert.equal(canonical(r.body), `${H}/today`);
  assert.match(r.body, /Today&#39;s Topics — October 19, 2026/);
  assert.match(r.body, /href="https:\/\/globalperspective.net\/weekly\/thread\/thread-t">Topic one</);
  const empty = await run(patched, `${H}/today`, { ua: GOOGLEBOT });
  assert.equal(empty.headers['x-rendered-by'], 'cf-worker-spa-fallback');
});

test('bot root page directory links the briefings modes, not the retired addresses', async () => {
  const r = await run(patched, `${H}/`, { ua: GOOGLEBOT });
  assert.match(r.body, /href="https:\/\/globalperspective.net\/briefings\?mode=read"/);
  assert.match(r.body, /href="https:\/\/globalperspective.net\/briefings\?mode=weekly"/);
  assert.match(r.body, /href="https:\/\/globalperspective.net\/today"/);
  assert.doesNotMatch(r.body, /\/daily"|\/weekly-brief"|\/analyze"/);
});
