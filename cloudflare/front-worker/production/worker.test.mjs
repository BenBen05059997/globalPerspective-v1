import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import baseline from '../baseline/worker2.mjs';
import patched from './worker.mjs';

const env = { S3_ACCESS_KEY_ID: 'AKIATEST', S3_SECRET_ACCESS_KEY: 'secret' };
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// Stub origin: records every outbound call; behaviour keyed on URL. `api(action, payload)` answers
// the proxy's POST actions (default: no data).
function makeFetch(log, api = () => null, views = null) {
  return async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const u = new URL(req.url);
    log.push(`${req.method} ${req.url}`);
    if (u.hostname === 'ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com') {
      if (u.searchParams.get('action') === 'rss') return new Response('<rss/>', { status: 200 });
      const body = req.method === 'POST' ? await req.json() : {};
      return new Response(JSON.stringify({ data: api(body.action, body.payload || {}) }), { status: 200 });
    }
    if (views && u.hostname.endsWith('.amazonaws.com') && u.pathname.startsWith('/record/views/')) {
      const v = views[u.pathname.slice('/record/views/'.length)];
      return v === undefined ? new Response('', { status: 403 }) : new Response(JSON.stringify(v), { status: 200 });
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
    if (u.pathname === '/config.js' || u.pathname === '/assets/index-z7F9oR-P.js') return new Response('js', { status: 200, headers: { 'cache-control': 'max-age=14400' } });
    return new Response('origin 404', { status: 404 });
  };
}

async function run(worker, url, { method = 'GET', ua, api, views } = {}) {
  const log = [];
  const orig = globalThis.fetch;
  globalThis.fetch = makeFetch(log, api, views);
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

test('lookalikes (/blogger, /blog-x) get the shell, not the blog', async () => {
  for (const p of ['/blogger', '/blog-x/y']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.body, '<title>SHELL</title>');
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

// A path that is no client route, redirect, file or blog page gets the shell with a real 404; client routes keep 200.
const FRONTEND = new URL('../../../global-perspectives-starter/frontend/src/', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, FRONTEND), 'utf8');

// the route patterns App.jsx declares, with the ROUTE.* / OPS_ROUTE constants it uses resolved from their sources
function appJsxRoutes() {
  const ROUTE = Object.fromEntries([...read('shared/lib/links.js').matchAll(/^\s+(\w+): '([^']*)',?\s*$/gm)].map((m) => [m[1], m[2]]));
  const OPS_ROUTE = read('features/ops/index.js').match(/OPS_ROUTE = '([^']+)'/)[1];
  const exprs = [...read('app/App.jsx').matchAll(/<Route path=(?:"([^"]*)"|\{(.+?)\})\s+element=/g)];
  return exprs.map((m) => (m[1] !== undefined ? m[1] : new Function('ROUTE', 'OPS_ROUTE', `return ${m[2]};`)(ROUTE, OPS_ROUTE))).filter((p) => p !== '*');
}

test('the Worker answers 200 for exactly the routes App.jsx declares (a drifted list fails here)', async () => {
  const declared = appJsxRoutes();
  assert.ok(declared.length > 25 && declared.includes('/today') && declared.includes('/board/:boardId') && declared.includes('/ops'), declared.join(' '));
  const listed = [...readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8').match(/const APP_ROUTES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...declared].sort(), 'APP_ROUTES in worker.mjs must list exactly the <Route path> values of App.jsx (except "*")');
  for (const pattern of declared) {
    const path = pattern.replace(/:\w+/g, 'x1');
    const r = await run(patched, `${H}${path}`);
    // a redirect (retired address) or the shell: never the 404
    assert.notEqual(r.status, 404, `${pattern} (${path}) must not be a 404`);
  }
  // and the other way: near-misses of the declared routes are 404
  for (const p of ['/nonexistent-xyz', '/a/b/c', '/weekly/thread', '/weekly/thread/x/y', '/today/extra', '/weekly/country', '/analyze/s', '/board/a/b', '/_boom', '/Today']) {
    assert.equal((await run(patched, `${H}${p}`)).status, 404, p);
  }
});

test('unknown paths get the shell with status 404; client routes (static, dynamic, trailing slash) keep 200', async () => {
  for (const p of ['/nonexistent-xyz', '/nonexistent-xyz/', '/weekly/thread']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.status, 404, p);
    assert.equal(r.body, '<title>SHELL</title>');
    assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
  }
  for (const p of ['/', '/today', '/today/', '/weekly/thread/thread-abc', '/weekly/country/United%20States', '/analyze/s/abc', '/breaking/ev-1', '/breaking', '/track-record/text', '/briefings', '/__boom']) {
    const r = await run(patched, `${H}${p}`);
    assert.equal(r.status, 200, p);
    assert.equal(r.body, '<title>SHELL</title>');
  }
  // HEAD agrees; a bot still gets the pre-render on the routes it is rendered for
  assert.equal((await run(patched, `${H}/nonexistent-xyz`, { method: 'HEAD' })).status, 404);
  assert.equal((await run(patched, `${H}/nonexistent-xyz`, { ua: GOOGLEBOT })).status, 404);
  const bot = await run(patched, `${H}/today/`, { ua: GOOGLEBOT, api: (a) => (a === 'topics' ? { topics: [{ title: 'T1' }] } : null) });
  assert.equal(bot.status, 200);
  assert.equal(bot.headers['x-rendered-by'], 'cf-worker-bot');
});

test('files, redirects and blog pages are not turned into shell 404s', async () => {
  const file = await run(patched, `${H}/app.js`);
  assert.equal(file.status, 200);
  assert.equal(file.body, 'js');
  assert.equal((await run(patched, `${H}/nope.png`)).body, 'origin 404'); // a missing file is the origin's own 404
  assert.equal((await run(patched, `${H}/daily`)).status, 301);
  assert.equal((await run(patched, `${H}/blog/`)).status, 200);
});

// Baseline vs patched must be identical for everything outside /blog, the retired-route 301s, the root
// page directory and the /briefings + /today pre-renders (each tested below).
const SAME = [
  ['GET', '/'], ['GET', '/weekly'], ['GET', '/weekly/thread/x'], ['GET', '/weekly/countries'], ['GET', '/analyze/s/abc'],
  ['GET', '/rss'], ['GET', '/rss/'], ['GET', '/app.js'], ['GET', '/nope.png'],
  ['GET', '/data/world/latest.json'], ['GET', '/data/world/missing.json'], ['GET', '/data/evil/x.json'], ['GET', '/data/world/a.member.json'],
  ['POST', '/weekly'], ['POST', '/daily'],
  ['GET', '/weekly/thread/x', GOOGLEBOT], ['GET', '/briefings', GOOGLEBOT], ['GET', '/analyze/s/abc', GOOGLEBOT],
];
test(`baseline vs patched identical for ${SAME.length} non-blog requests`, async () => {
  for (const [method, path, ua] of SAME) {
    const a = await run(baseline, `${H}${path}`, { method, ua });
    const b = await run(patched, `${H}${path}`, { method, ua });
    // the patched pre-render first looks for a record view (a manifest read, 0054); the origin and API calls and the page must be the baseline's
    b.log = b.log.filter((l) => !l.includes('.amazonaws.com/record/views/'));
    // the one deliberate difference: public /data bundles carry a browser max-age (see the /data test below)
    if (b.headers['cache-control']?.startsWith('public, max-age=60, ')) b.headers['cache-control'] = b.headers['cache-control'].replace('max-age=60, ', '');
    assert.deepEqual(b, a, `${method} ${path} ${ua ? '(bot)' : ''}`);
  }
});

// HEAD is GET without the body: same status and headers for every kind of path the Worker handles.
test('HEAD answers exactly as GET does, minus the body', async () => {
  const paths = ['/', '/today', '/weekly/thread/x', '/blog/', '/blog', '/app.js', '/nope.png', '/rss', '/daily', '/data/world/latest.json', '/data/world/missing.json', '/data/evil/x.json'];
  for (const ua of [undefined, GOOGLEBOT]) {
    for (const path of paths) {
      const get = await run(patched, `${H}${path}`, { ua });
      const head = await run(patched, `${H}${path}`, { method: 'HEAD', ua });
      assert.equal(head.status, get.status, `HEAD ${path}`);
      assert.deepEqual(head.headers, get.headers, `HEAD ${path}`);
      assert.equal(head.body, '', `HEAD ${path} has no body`);
    }
  }
  assert.equal((await run(patched, `${H}/today`, { method: 'HEAD' })).status, 200);
});

// Only content-hashed /assets/* files get the long immutable cache; everything else keeps the origin's headers.
test('hashed /assets/* files are cached for a year, immutable; nothing else changes', async () => {
  const IMMUTABLE = 'public, max-age=31536000, immutable';
  for (const method of ['GET', 'HEAD']) {
    const hashed = await run(patched, `${H}/assets/index-z7F9oR-P.js`, { method });
    assert.equal(hashed.status, 200);
    assert.equal(hashed.headers['cache-control'], IMMUTABLE);
  }
  assert.equal((await run(patched, `${H}/assets/index-z7F9oR-P.js`)).body, 'js');
  assert.equal((await run(patched, `${H}/config.js`)).headers['cache-control'], 'max-age=14400');
  assert.equal((await run(patched, `${H}/assets/unhashed.js`)).headers['cache-control'], undefined);
  // a missing hashed file is the origin's 404, never cached as immutable
  const missing = await run(patched, `${H}/assets/Gone-AAAAAAAA.js`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers['cache-control'], undefined);
});

// Record views (0037) are public through /data/*; facts, runs, readings and shadow views are not.
test('/data/record/views/* is served with the shared cache rule; other record prefixes are 404 without an S3 call', async () => {
  for (const key of ['index/active.json', 'stories/story-a.json', 'links/story-a.json', 'counts/2026-10-21.json', 'manifest.json']) {
    const r = await run(patched, `${H}/data/record/views/${key}`);
    assert.equal(r.status, 200, key);
    // max-age is what keeps the browser from serving a stale copy and revalidating at once (two requests per read)
    assert.equal(r.headers['cache-control'], 'public, max-age=60, s-maxage=300, stale-while-revalidate=600', key);
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

// ── Bot pre-render from the record's views (0054): the view answers, the action is the fallback ───────────────────
const fresh = () => ({ 'manifest.json': { builtAt: new Date(Date.now() - 3600000).toISOString() } });
const stale = () => ({ 'manifest.json': { builtAt: new Date(Date.now() - 30 * 3600000).toISOString() } });
const apiCalls = (r) => r.log.filter((l) => l.includes('execute-api'));
const topic = (n) => ({ topicId: `Topic ${n}-${n}`, title: `View topic ${n}`, regions: ['France'], threadId: `thread-v${n}` });
const todayView = () => ({ schemaVersion: 1, updatedAt: 'u', latest: { topicIds: ['Topic 2-2', 'Topic 1-1'], generatedDate: 'October 31, 2026', updatedAt: '2026-10-31T11:00:00Z' }, entries: [topic(1), topic(2), topic(3)] });

test('bot /today from index/today.json: the latest run in its order, no API call', async () => {
  const r = await run(patched, `${H}/today`, { ua: GOOGLEBOT, views: { ...fresh(), 'index/today.json': todayView() } });
  assert.equal(r.headers['x-rendered-by'], 'cf-worker-bot');
  assert.match(r.body, /Today&#39;s Topics — October 31, 2026/);
  assert.ok(r.body.indexOf('View topic 2') < r.body.indexOf('View topic 1'));
  assert.ok(!r.body.includes('View topic 3'));
  assert.match(r.body, /href="https:\/\/globalperspective.net\/weekly\/thread\/thread-v2">View topic 2</);
  assert.deepEqual(apiCalls(r), []);
});

test('bot /today falls back to the topics action when the view is stale, missing, or has no complete latest run', async () => {
  const api = (action) => (action === 'topics' ? { generatedDate: 'Action day', topics: [{ title: 'Action topic' }] } : null);
  const cases = [{ ...stale(), 'index/today.json': todayView() }, fresh(), { ...fresh(), 'index/today.json': { ...todayView(), latest: null } },
    { ...fresh(), 'index/today.json': { ...todayView(), latest: { ...todayView().latest, topicIds: ['Topic 1-1', 'gone'] } } }];
  for (const views of cases) {
    const r = await run(patched, `${H}/today`, { ua: GOOGLEBOT, api, views });
    assert.match(r.body, /Action topic/);
    assert.equal(apiCalls(r).length, 1);
  }
});

test('bot /briefings (latest daily) from index/briefs.json and the day view; a date reads that day view; no API call', async () => {
  const views = { ...fresh(), 'index/briefs.json': { daily: [{ dateKey: '2026-10-30' }, { dateKey: '2026-10-29' }], weekly: [] },
    'briefs/daily/2026-10-30.json': { brief: daily('2026-10-30') }, 'briefs/daily/2026-10-29.json': { brief: daily('2026-10-29') } };
  const a = await run(patched, `${H}/briefings`, { ua: GOOGLEBOT, views });
  assert.equal(canonical(a.body), `${H}/briefings?mode=read&amp;date=2026-10-30`);
  assert.deepEqual(apiCalls(a), []);
  const b = await run(patched, `${H}/briefings?mode=read&date=2026-10-31`, { ua: GOOGLEBOT, views });
  assert.equal(canonical(b.body), `${H}/briefings?mode=read&amp;date=2026-10-30`, 'the nearest earlier edition, from the views');
  assert.equal(apiCalls(b).length, 1, 'only the day with no view (2026-10-31, before its brief exists) asks the action');
});

test('bot /briefings latest daily: a stale manifest asks the action for the newest; a dated view needs no fresh manifest', async () => {
  const api = (action) => (action === 'latest_daily_brief' ? daily('2026-09-12') : null);
  const views = { ...stale(), 'index/briefs.json': { daily: [{ dateKey: '2026-10-30' }] }, 'briefs/daily/2026-10-30.json': { brief: daily('2026-10-30') } };
  const r = await run(patched, `${H}/briefings`, { ua: GOOGLEBOT, api, views });
  assert.equal(canonical(r.body), `${H}/briefings?mode=read&amp;date=2026-09-12`);
  const dated = await run(patched, `${H}/briefings?mode=read&date=2026-10-30`, { ua: GOOGLEBOT, views });
  assert.equal(canonical(dated.body), `${H}/briefings?mode=read&amp;date=2026-10-30`);
  assert.deepEqual(apiCalls(dated), []);
});

test('bot /briefings?mode=weekly from the weekly views: newest published, a given week, a draft falls to the action', async () => {
  const pub = (weekOf) => ({ brief: { ...weeklyBrief(weekOf), status: 'published' } });
  const views = { ...fresh(), 'index/briefs.json': { daily: [], weekly: [{ weekOf: '2026-10-25' }] }, 'briefs/weekly/2026-10-25.json': pub('2026-10-25'), 'briefs/weekly/2026-10-18.json': pub('2026-10-18') };
  const latest = await run(patched, `${H}/briefings?mode=weekly`, { ua: GOOGLEBOT, views });
  assert.equal(canonical(latest.body), `${H}/briefings?mode=weekly&amp;week=2026-10-25`);
  const week = await run(patched, `${H}/briefings?mode=weekly&week=2026-10-18`, { ua: GOOGLEBOT, views });
  assert.equal(canonical(week.body), `${H}/briefings?mode=weekly&amp;week=2026-10-18`);
  assert.deepEqual([...apiCalls(latest), ...apiCalls(week)], []);
  const asked = [];
  const draft = { ...views, 'briefs/weekly/2026-10-25.json': { brief: { ...weeklyBrief('2026-10-25'), status: 'draft' } } };
  const r = await run(patched, `${H}/briefings?mode=weekly`, { ua: GOOGLEBOT, views: draft, api: (a) => { asked.push(a); return null; } });
  assert.deepEqual(asked, ['weekly_brief']);
  assert.equal(r.headers['x-rendered-by'], 'cf-worker-spa-fallback');
});

test('bot thread page from the story view analysis; an alias, a stale manifest or no analysis asks thread_preview', async () => {
  const story = { threadId: 'thread-a', analysis: { threadTitle: 'View title', entryShortTitles: [{ shortTitle: 'First' }, { shortTitle: 'Second' }] } };
  const a = await run(patched, `${H}/weekly/thread/thread-a`, { ua: GOOGLEBOT, views: { ...fresh(), 'stories/thread-a.json': story } });
  assert.match(a.body, /<h1>View title<\/h1>/);
  assert.match(a.body, /<li>First<\/li><li>Second<\/li>/);
  assert.deepEqual(apiCalls(a), []);
  const api = (action) => (action === 'thread_preview' ? { threadTitle: 'Action title', entryShortTitles: [] } : null);
  for (const views of [{ ...fresh(), 'stories/thread-a.json': { aliasOf: 'thread-b' } }, { ...stale(), 'stories/thread-a.json': story }, { ...fresh(), 'stories/thread-a.json': { analysis: null } }, fresh()]) {
    const r = await run(patched, `${H}/weekly/thread/thread-a`, { ua: GOOGLEBOT, api, views });
    assert.match(r.body, /<h1>Action title<\/h1>/);
  }
  const unsafe = await run(patched, `${H}/weekly/thread/${encodeURIComponent('a/../b')}`, { ua: GOOGLEBOT, api, views: fresh() });
  assert.ok(!unsafe.log.some((l) => l.includes('/record/views/stories/')));
});

test('bot country page: the countries index finds the ISO3, the country view holds the briefing; an unknown name asks country_preview', async () => {
  const intelligence = { headline: 'View headline', bluf: 'View bluf', keyDevelopments: ['One'], riskLevel: 'high', trajectory: 'escalating' };
  const views = { ...fresh(), 'index/countries.json': { countries: { FRA: { countryName: 'France' } } }, 'countries/FRA.json': { intelligence } };
  const a = await run(patched, `${H}/weekly/country/france`, { ua: GOOGLEBOT, views });
  assert.match(a.body, /<h1>View headline<\/h1>/);
  assert.match(a.body, /View bluf/);
  assert.match(a.body, /<li>One<\/li>/);
  assert.deepEqual(apiCalls(a), []);
  const api = (action) => (action === 'country_preview' ? { headline: 'Action headline', riskLevel: 'low' } : null);
  const b = await run(patched, `${H}/weekly/country/Atlantis`, { ua: GOOGLEBOT, api, views });
  assert.match(b.body, /<h1>Action headline<\/h1>/);
});
