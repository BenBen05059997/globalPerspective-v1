const API_BASE = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';
const SITE_URL = 'https://globalperspective.net';

// --- S3 "world" data (map-as-home; DATA_STRATEGY.md) --------------------------
// The private world bucket is read here via SigV4 and served under /data/*.
// Secrets (Worker secret store): S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
// The reader IAM user (gp-worker-s3-reader) is read-only on world/*,
// situations/state/*, stories/state/*.  This SigV4 code was proven against real
// S3 from Node on 2026-09-08 (S0·T3).
const S3_BUCKET = 'globalperspective-world-280362093938';
const S3_REGION = 'ap-northeast-1';
// Only these prefixes may be fetched through /data/* (defence in depth on top of IAM):
const DATA_ALLOWED = [/^world\/[\w./-]+\.json$/, /^situations\/state\/[\w.#:@+-]+\.json$/, /^stories\/state\/[\w.#:@+-]+\.json$/, /^record\/views\/[\w./-]+\.json$/];

const _enc = new TextEncoder();
const _hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function _sha256(str) { return _hex(await crypto.subtle.digest('SHA-256', _enc.encode(str))); }
async function _hmac(key, str) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, _enc.encode(str)));
}
async function s3Get(key, env) {
  const host = `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
  const canonicalUri = '/' + key.split('/').map(encodeURIComponent).join('/');
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await _sha256('');
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join('');
  const canonicalRequest = `GET\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${S3_REGION}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await _sha256(canonicalRequest)}`;
  let signingKey = _enc.encode('AWS4' + env.S3_SECRET_ACCESS_KEY);
  for (const part of [dateStamp, S3_REGION, 's3', 'aws4_request']) signingKey = await _hmac(signingKey, part);
  const signature = _hex((await _hmac(signingKey, stringToSign)).buffer);
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(`https://${host}${canonicalUri}`, { headers: { ...headers, Authorization: authorization } });
}

// Firebase ID-token check for member bundles. STUB — deny until implemented.
// TODO(S2/member): verify RS256 against Google JWKS
// (https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com),
// check aud === FIREBASE_PROJECT_ID and exp. Until then, member bundles are denied so we never
// serve gated depth unauthenticated (fail-closed).
async function isMemberAuthorized(_request, _env) { return false; }


// Bots we want to serve pre-rendered HTML to
const BOT_PATTERNS = [
  // Social preview bots
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'discordbot', 'whatsapp', 'telegrambot', 'pinterest',
  // AI crawlers (high value)
  'gptbot', 'chatgpt-user', 'claude-web', 'claudebot', 'anthropic',
  'perplexitybot', 'google-extended', 'ccbot', 'applebot-extended',
  'bytespider', 'cohere-ai',
  // Search engines
  'googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider',
];

function isBotRequest(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some(pattern => ua.includes(pattern));
}

// Never pre-rendered for bots (SPA shell only): /analyze/s/<id> share links.
const NO_PRERENDER = [/^\/analyze\/s(\/|$)/];

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildBotHtml({ title, description, url, heading, bodyHtml, ogType }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="${ogType || 'article'}">
<meta property="og:url" content="${u}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${SITE_URL}/logo_no_grey_bg.png">
<meta property="og:site_name" content="Global Perspectives">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${SITE_URL}/logo_no_grey_bg.png">
</head>
<body>
<header><h1>${escapeHtml(heading || title)}</h1></header>
<main>${bodyHtml || `<p>${d}</p>`}</main>
<footer><p><a href="${u}">Read the full briefing at Global Perspectives</a></p></footer>
</body>
</html>`;
}

// Root URL — static positioning + page directory. Deliberately no Lambda call:
// static copy can't go stale-wrong, and this is the most-linked URL on the site.
function renderRootPage() {
  const bodyHtml = `
<p>Global Perspectives is an AI-powered global news intelligence platform that <strong>shows its work</strong>:
every forecast is logged the moment it is made with dated, falsifiable triggers and scored in public as
deadlines pass; every revised conclusion is recorded in an open corrections ledger with the real event that
changed the read — never silently overwritten. The running record, including the Brier score and calibration,
is published at <a href="${SITE_URL}/track-record">${SITE_URL}/track-record</a>.</p>
<h2>Briefings</h2>
<ul>
<li><a href="${SITE_URL}/today">Today's Topics</a> — today's global stories by region, with on-demand AI summary, forecast, and root-cause for any story</li>
<li><a href="${SITE_URL}/briefings?mode=read">Daily Brief</a> — the end-of-day intelligence brief: one synthesised read of what mattered today</li>
<li><a href="${SITE_URL}/briefings?mode=weekly">Weekly Brief</a> — Sunday signals digest: the week's discrete signals with fact kept separate from judgment; also delivered by email</li>
</ul>
<h2>Intelligence</h2>
<ul>
<li><a href="${SITE_URL}/weekly">Story Threads</a> — ongoing story arcs ranked by risk, each with a living forecast board that resolves in public</li>
<li><a href="${SITE_URL}/weekly/countries">Countries</a> — every covered country ranked by risk tier, with a standing intelligence briefing; each read self-corrects as news arrives</li>
<li><a href="${SITE_URL}/">World Map (this home page)</a> — the live situation map: open situations, disaster alerts and the stories behind them on a globe, with a click-through story card</li>
</ul>
<h2>Accountability</h2>
<ul>
<li><a href="${SITE_URL}/track-record">Track Record</a> — every forecast publicly scored (Brier + calibration), every revised conclusion logged, methodology published</li>
</ul>`;
  return buildBotHtml({
    title: 'Global Perspectives™ — AI news intelligence that shows its work',
    description: 'AI-powered global news intelligence: forecasts publicly scored against dated triggers, revised conclusions logged in an open corrections ledger. Story arcs, country risk, narrative analysis across 190+ countries.',
    url: `${SITE_URL}/`,
    heading: 'Global Perspectives — AI news intelligence that shows its work',
    bodyHtml,
    ogType: 'website',
  });
}

// --- The record's views (decisions 0037, 0048, 0051, 0054) ----------------------------------------------------
// The bot pre-render reads the record's public view files straight from the world bucket (the same objects /data/record/views/* serves; the
// Worker's own S3 path, no self-fetch) and asks the DynamoDB-backed read API action only where no view answers. A view that is missing,
// unreadable, or (for "the newest") built more than MAX_VIEW_AGE_MS ago answers null and the action is asked, as before.
const MAX_VIEW_AGE_MS = 9 * 60 * 60 * 1000;
const VIEW_ID = /^[A-Za-z0-9_-]{1,200}$/;

async function viewJson(path, env) {
  try {
    const res = await s3Get(`record/views/${path}`, env);
    if (!res.ok) return null; // 404/403 = not generated; anything else is no answer either
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function viewsFresh(env) {
  const built = Date.parse((await viewJson('manifest.json', env))?.builtAt);
  return Number.isFinite(built) && Date.now() - built <= MAX_VIEW_AGE_MS;
}

// the `topics` answer from index/today.json: the latest run's topics in its order, or null when the view has no complete latest run
async function viewTopics(env) {
  if (!(await viewsFresh(env))) return null;
  const view = await viewJson('index/today.json', env);
  if (!view || view.schemaVersion !== 1 || !Array.isArray(view.entries) || !Array.isArray(view.latest?.topicIds)) return null;
  const byId = new Map(view.entries.map((e) => [e.topicId, e]));
  const topics = view.latest.topicIds.map((id) => byId.get(id));
  if (!topics.length || topics.some((t) => !t)) return null;
  return { topics, generatedDate: view.latest.generatedDate, updatedAt: view.latest.updatedAt };
}

// the `daily_brief` (dateKey) / `latest_daily_brief` (no dateKey) answer: the brief view, or null
async function viewDailyBrief(dateKey, env) {
  let key = dateKey;
  if (!key) {
    if (!(await viewsFresh(env))) return null;
    key = (await viewJson('index/briefs.json', env))?.daily?.[0]?.dateKey;
  }
  if (!dateKeyOrNull(key)) return null;
  const brief = (await viewJson(`briefs/daily/${key}.json`, env))?.brief;
  return brief && brief.dateKey === key ? brief : null;
}

// the `weekly_brief` answer (published weeks only, as the action serves them): week = the weekOf asked for, none = the newest
async function viewWeeklyBrief(week, env) {
  let key = week;
  if (!key) {
    if (!(await viewsFresh(env))) return null;
    key = (await viewJson('index/briefs.json', env))?.weekly?.[0]?.weekOf;
  }
  if (!dateKeyOrNull(key)) return null;
  const brief = (await viewJson(`briefs/weekly/${key}.json`, env))?.brief;
  return brief && brief.weekOf === key && brief.status === 'published' ? brief : null;
}

// the `thread_preview` answer: the story view's analysis (a merged story's alias has none: the action answers)
async function viewThreadPreview(threadId, env) {
  if (!VIEW_ID.test(threadId) || !(await viewsFresh(env))) return null;
  const a = (await viewJson(`stories/${threadId}.json`, env))?.analysis;
  return a?.threadTitle ? { threadTitle: a.threadTitle, entryShortTitles: a.entryShortTitles || [], generatedAt: a.generatedAt || null } : null;
}

// the `country_preview` answer: the page names the country, the countries index finds its ISO3, the country view holds the briefing
async function viewCountryPreview(countryName, env) {
  if (!(await viewsFresh(env))) return null;
  const countries = (await viewJson('index/countries.json', env))?.countries;
  const want = String(countryName).trim().toLowerCase();
  const iso3 = Object.keys(countries || {}).find((k) => String(countries[k].countryName || '').trim().toLowerCase() === want);
  if (!iso3) return null;
  const i = (await viewJson(`countries/${iso3}.json`, env))?.intelligence;
  return i?.headline ? {
    headline: i.headline || null, bluf: i.bluf || null, keyDevelopments: i.keyDevelopments || [], riskLevel: i.riskLevel || null,
    trajectory: i.trajectory || null, totalArticles: i.totalArticles || 0, dayCount: i.dayCount || 0, generatedAt: i.generatedAt || null,
  } : null;
}

async function renderThreadPage(threadId, env) {
  try {
    const data = (await viewThreadPreview(threadId, env)) || (await proxyData('thread_preview', { threadId }));
    if (!data || !data.threadTitle) return null;

    const title = data.threadTitle;
    const entries = Array.isArray(data.entryShortTitles) ? data.entryShortTitles : [];
    const description = entries.slice(0, 3).map(e => e.shortTitle || '').filter(Boolean).join(' • ')
      || 'Narrative intelligence thread from Global Perspectives';
    const url = `${SITE_URL}/weekly/thread/${encodeURIComponent(threadId)}`;
    const entriesHtml = entries.length
      ? `<h2>Story Timeline</h2><ul>${entries.map(e => `<li>${escapeHtml(e.shortTitle || '')}</li>`).join('')}</ul>`
      : '';

    return buildBotHtml({ title, description, url, heading: title, bodyHtml: `<p>${escapeHtml(description)}</p>${entriesHtml}` });
  } catch (err) {
    return null;
  }
}

async function renderCountryPage(countryName, env) {
  try {
    const data = (await viewCountryPreview(countryName, env)) || (await proxyData('country_preview', { countryName }));
    if (!data || !data.headline) return null;

    const title = `${data.headline} — ${countryName}`;
    const description = data.bluf || `Intelligence briefing for ${countryName} — risk level: ${data.riskLevel || 'moderate'}`;
    const url = `${SITE_URL}/weekly/country/${encodeURIComponent(countryName)}`;
    const keyDevs = Array.isArray(data.keyDevelopments) ? data.keyDevelopments : [];
    const devsHtml = keyDevs.length
      ? `<h2>Key Developments</h2><ul>${keyDevs.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
      : '';
    const trajectoryHtml = data.trajectory ? `<h2>Trajectory</h2><p>${escapeHtml(data.trajectory)}</p>` : '';

    return buildBotHtml({
      title, description, url, heading: data.headline,
      bodyHtml: `<p><strong>Risk level:</strong> ${escapeHtml(data.riskLevel || 'moderate')}</p><p>${escapeHtml(description)}</p>${devsHtml}${trajectoryHtml}`,
    });
  } catch (err) {
    return null;
  }
}

// /briefings (one page, three modes — see features/briefings/README.md): read = the daily brief
// (?date=YYYY-MM-DD), weekly = the weekly signals brief (?week=YYYY-MM-DD), present = the slide deck
// (?deck=weekly for the weekly one). Bots get the brief behind the mode; present renders the same
// brief as read/weekly and names that page as canonical. The canonical always names the edition
// actually served (a requested date with no edition falls back to the nearest earlier one), never the
// requested date. Each renderer returns null when there is nothing real to show, so the caller falls
// through to the SPA shell (never an empty or invented page).
async function proxyData(action, payload) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
    cf: { cacheTtl: 1800, cacheEverything: true },
  });
  const json = await res.json();
  return json?.data || null;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const dateKeyOrNull = (v) => (typeof v === 'string' && DATE_KEY.test(v) ? v : null);
function addDaysKey(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const threadLink = (threadId, text) => (typeof threadId === 'string' && /^thread-/.test(threadId)
  ? `<a href="${SITE_URL}/weekly/thread/${encodeURIComponent(threadId)}">${escapeHtml(text)}</a>`
  : escapeHtml(text));
const countryLink = (name) => `<a href="${SITE_URL}/weekly/country/${encodeURIComponent(name)}">${escapeHtml(name)}</a>`;

async function renderDailyBrief(dateParam, env) {
  // A requested date walks back up to 7 days to the nearest earlier edition (as the page does).
  let data = null;
  if (dateParam) {
    for (let back = 0; back <= 7 && !data; back++) {
      const key = addDaysKey(dateParam, -back);
      const d = (await viewDailyBrief(key, env)) || (await proxyData('daily_brief', { dateKey: key }));
      if (d && d.headline) data = d;
    }
  } else {
    data = (await viewDailyBrief(null, env)) || (await proxyData('latest_daily_brief', {}));
  }
  if (!data || !data.headline || !dateKeyOrNull(data.dateKey)) return null;

  const served = data.dateKey;
  const title = `${data.headline} — Daily Brief, ${data.displayDate || served}`;
  const description = data.summary
    ? String(data.summary).replace(/\*\*/g, '').substring(0, 200).trim() + '…'
    : `Global intelligence briefing for ${data.displayDate || served}`;
  const stats = data.stats || {};
  const statsHtml = (stats.totalArticles || stats.countriesCovered || stats.sourceOutlets)
    ? `<p>${escapeHtml(String(stats.totalArticles || 0))} articles · ${escapeHtml(String(stats.countriesCovered || 0))} countries · ${escapeHtml(String(stats.sourceOutlets || 0))} outlets</p>`
    : '';
  const stories = Array.isArray(data.topStories) ? data.topStories.filter(s => s && s.title) : [];
  // a story links to its story page only when the brief carries a real thread id (older briefs have none)
  const storiesHtml = stories.length
    ? `<h2>Top Stories</h2><ul>${stories.map(s => `<li><strong>${threadLink(s.threadId, s.title)}</strong>${(s.regions || []).length ? ` (${s.regions.map(countryLink).join(', ')})` : ''}${s.prediction ? ` — ${escapeHtml(s.prediction)}` : ''}</li>`).join('')}</ul>`
    : '';
  const rising = data.risingThread && data.risingThread.title
    ? `<h2>Story to watch</h2><p>${threadLink(data.risingThread.threadId, data.risingThread.title)}${data.risingThread.oneLiner ? ` — ${escapeHtml(data.risingThread.oneLiner)}` : ''}</p>`
    : '';
  const watch = data.countryToWatch && data.countryToWatch.countryName
    ? `<h2>Country to watch</h2><p>${countryLink(data.countryToWatch.countryName)}${data.countryToWatch.headline ? ` — ${escapeHtml(data.countryToWatch.headline)}` : ''}</p>`
    : '';
  return buildBotHtml({
    title, description, url: `${SITE_URL}/briefings?mode=read&date=${served}`, heading: data.headline,
    bodyHtml: `${statsHtml}<p>${escapeHtml(description)}</p>${storiesHtml}${rising}${watch}`,
  });
}

async function renderWeeklyBrief(weekParam, env) {
  const data = (await viewWeeklyBrief(weekParam, env)) || (await proxyData('weekly_brief', weekParam ? { week: weekParam } : {}));
  const signals = Array.isArray(data?.signals) ? data.signals.filter(s => s && (s.lede || s.fact)) : [];
  if (!data || !dateKeyOrNull(data.weekOf) || !signals.length) return null;
  const title = `Weekly Signals Brief — week of ${data.weekOf}`;
  const description = signals.slice(0, 3).map(s => s.lede || '').filter(Boolean).join(' • ')
    || `Weekly signals brief for the week of ${data.weekOf}`;
  const signalsHtml = `<h2>Signals</h2><ul>${signals.map(s => {
    const link = typeof s.threadId === 'string' && /^thread-/.test(s.threadId)
      ? ` <a href="${SITE_URL}/weekly/thread/${encodeURIComponent(s.threadId)}">Story arc</a>` : '';
    return `<li><strong>${escapeHtml(s.lede || '')}</strong>${s.region ? ` (${escapeHtml(s.region)})` : ''}${s.fact ? ` — ${escapeHtml(s.fact)}` : ''}${s.soWhat ? ` <em>${escapeHtml(s.soWhat)}</em>` : ''}${link}</li>`;
  }).join('')}</ul>`;
  const watch = Array.isArray(data.watch) ? data.watch.filter(w => w && w.event) : [];
  const watchHtml = watch.length
    ? `<h2>Next week</h2><ul>${watch.map(w => `<li><strong>${escapeHtml(w.event)}</strong>${w.stake ? ` — ${escapeHtml(w.stake)}` : ''}</li>`).join('')}</ul>`
    : '';
  return buildBotHtml({
    title, description, url: `${SITE_URL}/briefings?mode=weekly&week=${data.weekOf}`, heading: title,
    bodyHtml: `<p>${escapeHtml(description)}</p>${signalsHtml}${watchHtml}`,
  });
}

async function renderBriefingsPage(searchParams, env) {
  try {
    const mode = searchParams.get('mode');
    const weekly = mode === 'weekly' || (mode === 'present' && searchParams.get('deck') === 'weekly');
    return weekly
      ? await renderWeeklyBrief(dateKeyOrNull(searchParams.get('week')), env)
      : await renderDailyBrief(dateKeyOrNull(searchParams.get('date')), env);
  } catch (err) {
    return null;
  }
}

// /today — today's topics (the `topics` proxy action the page reads): each topic with its regions,
// linked to its story page only when it carries a real thread id.
async function renderTodayPage(env) {
  try {
    const data = (await viewTopics(env)) || (await proxyData('topics', {}));
    const topics = Array.isArray(data?.topics) ? data.topics.filter(t => t && t.title) : [];
    if (!topics.length) return null;
    const when = data.generatedDate || (data.updatedAt ? String(data.updatedAt).slice(0, 10) : '');
    const title = `Today's Topics${when ? ` — ${when}` : ''}`;
    const description = topics.slice(0, 3).map(t => t.title).join(' • ');
    const listHtml = `<ul>${topics.map(t => `<li><strong>${threadLink(t.threadId, t.title)}</strong>${(t.regions || []).length ? ` (${t.regions.map(countryLink).join(', ')})` : ''}</li>`).join('')}</ul>`;
    return buildBotHtml({
      title, description, url: `${SITE_URL}/today`, heading: title,
      bodyHtml: `<p>Today's global stories by region, with on-demand AI summary, forecast and root cause for each.</p>${listHtml}`,
      ogType: 'website',
    });
  } catch (err) {
    return null;
  }
}

// Retired addresses answer with a real 301 (decisions 0017 and 0028; the client redirects in
// app/LegacyRedirects.jsx and app/MapRedirect.jsx stay as the fallback). The request's query string
// is kept: its keys are appended after the target's own (a target key wins).
function legacyTarget(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/daily') return '/briefings?mode=read';
  if (path.startsWith('/daily/')) {
    // a malformed date (or escape) goes to the latest edition, never a guessed date
    const date = dateKeyOrNull(path.slice('/daily/'.length));
    return date ? `/briefings?mode=read&date=${date}` : '/briefings?mode=read';
  }
  if (path === '/weekly-brief') return '/briefings?mode=weekly';
  if (path === '/spider-demo') return '/weekly?view=web';
  if (path === '/map') return '/';
  if (path === '/weekly' && url.searchParams.get('section') === 'countries') return '/weekly/countries';
  if (path === '/analyze') {
    // the retired Analysis Studio (2026-10-20): the first requested story when it is a thread id, else the
    // countries list. /analyze/s/<id> (shared runs) is a longer path and stays the SPA.
    const first = (url.searchParams.get('stories') || '').split(',')[0].trim();
    return /^thread-[^/?#]+$/.test(first) ? `/weekly/thread/${encodeURIComponent(first)}` : '/weekly/countries';
  }
  return null;
}

function legacyRedirect(url) {
  const target = legacyTarget(url);
  if (!target) return null;
  const out = new URL(target, url.origin);
  const path = url.pathname.replace(/\/+$/, '');
  const dropped = path === '/weekly' ? 'section' : path === '/analyze' ? 'stories' : null;
  for (const [k, v] of url.searchParams) {
    if (k === dropped) continue;
    if (!out.searchParams.has(k)) out.searchParams.append(k, v);
  }
  return new Response(null, {
    status: 301,
    headers: { Location: out.toString(), 'Cache-Control': 'public, max-age=86400', 'X-Rendered-By': 'cf-worker-redirect' },
  });
}

function botHtmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
      'X-Rendered-By': 'cf-worker-bot',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';

    // World data (map-as-home): /data/<key> → SigV4 GET from the private S3 bucket.
    // e.g. /data/world/latest.json, /data/situations/state/<id>.json
    if (url.pathname.startsWith('/data/')) {
      const key = decodeURIComponent(url.pathname.slice('/data/'.length));
      // CORS header on ALL responses (incl. errors) so a 404/401 isn't masked as a CORS failure.
      const dataErr = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      if (!DATA_ALLOWED.some((re) => re.test(key))) {
        return dataErr({ error: 'not found' }, 404);
      }
      const isMember = key.includes('.member.');
      if (isMember && !(await isMemberAuthorized(request, env))) {
        return dataErr({ error: 'unauthorized' }, 401);
      }
      try {
        const upstream = await s3Get(key, env);
        // The reader IAM user has GetObject but not ListBucket, so S3 answers a MISSING key with
        // 403 (not 404) to avoid leaking existence. Auth is proven working by the bundles that do
        // resolve, so treat 403/404 here as "not there yet" for the client.
        if (upstream.status === 404 || upstream.status === 403) {
          return dataErr({ error: 'not generated yet' }, 404);
        }
        if (!upstream.ok) {
          return dataErr({ error: 'upstream', status: upstream.status }, 502);
        }
        // Public bundles cache at the edge; member bundles are private to the viewer.
        const cacheControl = isMember
          ? 'private, no-store'
          : 'public, s-maxage=300, stale-while-revalidate=600';
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': cacheControl,
            'Access-Control-Allow-Origin': '*',
            'X-Rendered-By': 'cf-worker-data',
            ...(upstream.headers.get('etag') ? { ETag: upstream.headers.get('etag') } : {}),
          },
        });
      } catch (err) {
        return dataErr({ error: 'fetch failed' }, 502);
      }
    }

    // RSS Feed
    if (url.pathname === '/rss' || url.pathname === '/rss/') {
      const upstream = await fetch(`${API_BASE}?action=rss`, {
        cf: { cacheTtl: 1800, cacheEverything: true },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Retired addresses: real 301s for every client (GET/HEAD), before any pre-render or shell.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const redirect = legacyRedirect(url);
      if (redirect) return redirect;
    }

    // Bot pre-rendering. Paths in NO_PRERENDER are never pre-rendered (Studio share links: per-reader,
    // private-by-default content; they get the plain SPA shell through the fallback below, like a human).
    const skipPrerender = NO_PRERENDER.some((re) => re.test(url.pathname));
    if (isBotRequest(userAgent) && !skipPrerender) {
      // Root URL: static positioning + page directory (no Lambda call)
      if (url.pathname === '/') {
        return new Response(renderRootPage(), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
            'X-Rendered-By': 'cf-worker-bot',
          },
        });
      }

      // Thread page: /weekly/thread/:threadId
      const threadMatch = url.pathname.match(/^\/weekly\/thread\/([^/]+)\/?$/);
      if (threadMatch) {
        const html = await renderThreadPage(decodeURIComponent(threadMatch[1]), env);
        if (html) return botHtmlResponse(html);
      }

      // Country page: /weekly/country/:countryName
      const countryMatch = url.pathname.match(/^\/weekly\/country\/([^/]+)\/?$/);
      if (countryMatch) {
        const html = await renderCountryPage(decodeURIComponent(countryMatch[1]), env);
        if (html) return botHtmlResponse(html);
      }

      // Briefings: /briefings with ?mode=read|weekly|present, ?date=, ?week=, ?deck= (query strings are
      // read from url.searchParams; url.pathname never contains them, so one match serves every variant)
      if (/^\/briefings\/?$/.test(url.pathname)) {
        const html = await renderBriefingsPage(url.searchParams, env);
        if (html) return botHtmlResponse(html);
      }

      // Today's topics: /today
      if (/^\/today\/?$/.test(url.pathname)) {
        const html = await renderTodayPage(env);
        if (html) return botHtmlResponse(html);
      }
    }

    // Static blog (docs/blog/**/index.html on the origin): /blog and /blog/* are real pages, not client
    // routes, so they skip the SPA-shell fallback below and go straight to the origin (GitHub Pages),
    // which supplies its own /blog -> /blog/ redirect and genuine 404s. No bot branch above matches /blog.
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/blog' || url.pathname.startsWith('/blog/'))) {
      return fetch(request);
    }

    // SPA-aware fallback: any non-asset path (no "." in the last segment) that
    // wasn't already handled above (not /data/*, not /rss, not bot-prerendered)
    // gets the SPA shell (docs/index.html) with a real 200, not GitHub Pages'
    // 404 status for an unrecognised path. This covers every client route
    // (/analyze, /membership, /track-record, /briefings,
    // /breaking(/:id) (a client redirect since 2026-10-01), /weekly, /weekly/countries,
    // /signin, /account, /whitepaper, etc.) without enumerating
    // them, and survives future route additions. A genuinely bogus path still
    // 200s the shell at the edge — the client router's own catch-all
    // (`*` -> NotFound in App.jsx) renders the real "not found" UI once the
    // shell's JS loads; this fix is purely about the HTTP status code a
    // crawler reads before executing JS.
    const lastSegment = url.pathname.split('/').pop() || '';
    const looksLikeAsset = lastSegment.includes('.');
    if (request.method === 'GET' && !looksLikeAsset) {
      const shellUrl = new URL('/index.html', url.origin);
      const shellRes = await fetch(shellUrl.toString(), request);
      if (shellRes.ok) {
        return new Response(shellRes.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'X-Rendered-By': 'cf-worker-spa-fallback',
          },
        });
      }
      // If fetching the shell itself failed for some reason, fall through to
      // the default passthrough below rather than surfacing a worker error.
    }

    // Everything else: pass through to GitHub Pages
    return fetch(request);
  },
};
