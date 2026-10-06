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
const DATA_ALLOWED = [/^world\/[\w./-]+\.json$/, /^situations\/state\/[\w.#:@+-]+\.json$/, /^stories\/state\/[\w.#:@+-]+\.json$/];

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
<li><a href="${SITE_URL}/daily">Daily Brief</a> — the end-of-day intelligence brief: one synthesised read of what mattered today</li>
<li><a href="${SITE_URL}/weekly-brief">Weekly Brief</a> — Sunday signals digest: the week's discrete signals with fact kept separate from judgment; also delivered by email</li>
</ul>
<h2>Intelligence</h2>
<ul>
<li><a href="${SITE_URL}/weekly">Story Threads</a> — ongoing story arcs ranked by risk, each with a living forecast board that resolves in public</li>
<li><a href="${SITE_URL}/weekly/countries">Countries</a> — every covered country ranked by risk tier, with a standing intelligence briefing; each read self-corrects as news arrives</li>
<li><a href="${SITE_URL}/">World Map (this home page)</a> — the live situation map: open situations, disaster alerts and the stories behind them on a globe, with a click-through story card</li>
</ul>
<h2>Markets &amp; analysis</h2>
<ul>
<li><a href="${SITE_URL}/economy">Economy</a> — live instrument dashboard plus which stories are repricing markets today, with a weekly what-moved-and-why wrap</li>
<li><a href="${SITE_URL}/analyze">Analysis Studio</a> — run a cited AI deep-dive across up to 4 stories</li>
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

async function renderThreadPage(threadId) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'thread_preview', payload: { threadId } }),
      cf: { cacheTtl: 1800, cacheEverything: true },
    });
    const json = await res.json();
    const data = json?.data;
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

async function renderCountryPage(countryName) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'country_preview', payload: { countryName } }),
      cf: { cacheTtl: 1800, cacheEverything: true },
    });
    const json = await res.json();
    const data = json?.data;
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

async function renderDailyPage(dateKey) {
  try {
    // Try the requested date first; fall back up to 7 days to find the most recent brief
    let data = null;
    const base = new Date(dateKey + 'T00:00:00Z');
    for (let daysBack = 0; daysBack <= 7; daysBack++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - daysBack);
      const tryDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'daily_brief', payload: { dateKey: tryDate } }),
        cf: { cacheTtl: 1800, cacheEverything: true },
      });
      const json = await res.json();
      if (json?.data?.headline) { data = json.data; break; }
    }
    if (!data || !data.headline) return null;

    const title = `${data.headline} — Daily Intelligence Brief`;
    const description = data.summary
      ? String(data.summary).replace(/\*\*/g, '').substring(0, 200).trim() + '…'
      : `Global intelligence briefing for ${data.displayDate || dateKey}`;
    const url = dateKey
      ? `${SITE_URL}/daily/${encodeURIComponent(dateKey)}`
      : `${SITE_URL}/daily`;

    const topStoriesHtml = Array.isArray(data.topStories) && data.topStories.length
      ? `<h2>Top Stories</h2><ul>${data.topStories.map(s =>
          `<li><strong>${escapeHtml(s.title)}</strong> — ${escapeHtml(s.prediction || '')}</li>`
        ).join('')}</ul>`
      : '';

    const statsHtml = data.stats
      ? `<p>${escapeHtml(String(data.stats.totalArticles || ''))} articles · ${escapeHtml(String(data.stats.countriesCovered || ''))} countries · ${escapeHtml(String(data.stats.sourceOutlets || ''))} outlets</p>`
      : '';

    return buildBotHtml({
      title,
      description,
      url,
      heading: data.headline,
      bodyHtml: `${statsHtml}<p>${escapeHtml(description)}</p>${topStoriesHtml}`,
    });
  } catch (err) {
    return null;
  }
}

// /briefings (briefing mode: latest daily edition by default, ?date=YYYY-MM-DD for a specific day, ?mode=weekly for the
// weekly signals brief). Uses the public proxy actions latest_daily_brief / daily_brief / weekly_brief. Returns null when
// there is nothing real to show, so the caller falls through to the SPA shell (never an empty or invented page).
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

async function renderBriefingsPage(searchParams) {
  try {
    const weekly = searchParams.get('mode') === 'weekly';
    const dateParam = searchParams.get('date');
    const validDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;

    if (weekly) {
      const data = await proxyData('weekly_brief', {});
      const signals = Array.isArray(data?.signals) ? data.signals.filter(s => s && (s.lede || s.fact)) : [];
      if (!data || !data.weekOf || !signals.length) return null;
      const title = `Weekly Signals Brief — week of ${data.weekOf}`;
      const description = signals.slice(0, 3).map(s => s.lede || '').filter(Boolean).join(' • ')
        || `Weekly signals brief for the week of ${data.weekOf}`;
      const signalsHtml = `<h2>Signals</h2><ul>${signals.map(s => {
        const link = typeof s.threadId === 'string' && /^thread-/.test(s.threadId)
          ? ` <a href="${SITE_URL}/weekly/thread/${encodeURIComponent(s.threadId)}">Story arc</a>` : '';
        return `<li><strong>${escapeHtml(s.lede || '')}</strong>${s.fact ? ` — ${escapeHtml(s.fact)}` : ''}${s.soWhat ? ` <em>${escapeHtml(s.soWhat)}</em>` : ''}${link}</li>`;
      }).join('')}</ul>`;
      const watch = Array.isArray(data.watch) ? data.watch.filter(w => w && w.event) : [];
      const watchHtml = watch.length
        ? `<h2>Next week</h2><ul>${watch.map(w => `<li><strong>${escapeHtml(w.event)}</strong>${w.stake ? ` — ${escapeHtml(w.stake)}` : ''}</li>`).join('')}</ul>`
        : '';
      return buildBotHtml({
        title, description, url: `${SITE_URL}/briefings?mode=weekly`, heading: title,
        bodyHtml: `<p>${escapeHtml(description)}</p>${signalsHtml}${watchHtml}`,
      });
    }

    const data = validDate
      ? await proxyData('daily_brief', { dateKey: validDate })
      : await proxyData('latest_daily_brief', {});
    if (!data || !data.headline) return null;

    const title = `${data.headline} — Daily Briefing`;
    const description = data.summary
      ? String(data.summary).replace(/\*\*/g, '').substring(0, 200).trim() + '…'
      : `Global intelligence briefing for ${data.displayDate || data.dateKey || ''}`.trim();
    const url = validDate ? `${SITE_URL}/briefings?date=${validDate}` : `${SITE_URL}/briefings`;

    const stories = Array.isArray(data.topStories) ? data.topStories.filter(s => s && s.title) : [];
    const storiesHtml = stories.length
      ? `<h2>Top Stories</h2><ul>${stories.map(s => {
          // a story links to its story page only when the brief carries a real thread id (older briefs have none)
          const t = typeof s.threadId === 'string' && /^thread-/.test(s.threadId)
            ? `<a href="${SITE_URL}/weekly/thread/${encodeURIComponent(s.threadId)}">${escapeHtml(s.title)}</a>`
            : escapeHtml(s.title);
          return `<li><strong>${t}</strong>${s.prediction ? ` — ${escapeHtml(s.prediction)}` : ''}</li>`;
        }).join('')}</ul>`
      : '';
    const watch = data.countryToWatch && data.countryToWatch.countryName
      ? `<h2>Country to watch</h2><p><a href="${SITE_URL}/weekly/country/${encodeURIComponent(data.countryToWatch.countryName)}">${escapeHtml(data.countryToWatch.countryName)}</a>${data.countryToWatch.headline ? ` — ${escapeHtml(data.countryToWatch.headline)}` : ''}</p>`
      : '';
    return buildBotHtml({
      title, description, url, heading: data.headline,
      bodyHtml: `<p>${escapeHtml(description)}</p>${storiesHtml}${watch}`,
    });
  } catch (err) {
    return null;
  }
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
        const html = await renderThreadPage(decodeURIComponent(threadMatch[1]));
        if (html) {
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=1800',
              'X-Rendered-By': 'cf-worker-bot',
            },
          });
        }
      }

      // Country page: /weekly/country/:countryName
      const countryMatch = url.pathname.match(/^\/weekly\/country\/([^/]+)\/?$/);
      if (countryMatch) {
        const html = await renderCountryPage(decodeURIComponent(countryMatch[1]));
        if (html) {
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=1800',
              'X-Rendered-By': 'cf-worker-bot',
            },
          });
        }
      }

      // Daily brief: /daily or /daily/:dateKey
      const dailyMatch = url.pathname.match(/^\/daily(?:\/([^/]+))?\/?$/);
      if (dailyMatch) {
        const now = new Date();
        const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
        const dateKey = dailyMatch[1] ? decodeURIComponent(dailyMatch[1]) : todayKey;
        const html = await renderDailyPage(dateKey);
        if (html) {
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=1800',
              'X-Rendered-By': 'cf-worker-bot',
            },
          });
        }
      }
      // Briefings: /briefings, /briefings?date=YYYY-MM-DD, /briefings?mode=weekly (query strings are read from
      // url.searchParams; url.pathname never contains them, so the same match serves every variant)
      if (/^\/briefings\/?$/.test(url.pathname)) {
        const html = await renderBriefingsPage(url.searchParams);
        if (html) {
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=1800',
              'X-Rendered-By': 'cf-worker-bot',
            },
          });
        }
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
    // (/economy, /analyze, /membership, /track-record, /weekly-brief,
    // /weekly-markets and /breaking(/:id) (both client redirects since 2026-10-01), /weekly, /weekly/countries,
    // /signin, /account, /whitepaper, /spider-demo, etc.) without enumerating
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
