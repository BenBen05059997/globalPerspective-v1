# Cloudflare Worker — Full Updated Code

Replace ALL code in the Worker editor with the code below, then click **Deploy**.

**Secrets required (added 2026-09-08 for the `/data/*` route → S3 world bucket).** Before deploying, set two Worker secrets (Dashboard → Settings → Variables → Encrypt, or `wrangler secret put`):

- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — an access key for the **`gp-worker-s3-reader`** IAM user (read-only on `world/*`, `situations/state/*`, `stories/state/*`; created 2026-09-08). Mint a fresh key with: `aws iam create-access-key --user-name gp-worker-s3-reader`. The SigV4 code below was proven against real S3 from Node before commit.

---

```js
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
<li><a href="${SITE_URL}/">Today's Topics</a> — today's global stories by region, with on-demand AI summary, forecast, and root-cause for any story</li>
<li><a href="${SITE_URL}/daily">Daily Brief</a> — the end-of-day intelligence brief: one synthesised read of what mattered today</li>
<li><a href="${SITE_URL}/weekly-brief">Weekly Brief</a> — Sunday signals digest: the week's discrete signals with fact kept separate from judgment; also delivered by email</li>
<li><a href="${SITE_URL}/breaking">Breaking</a> — rare, human-confirmed alerts for genuinely significant events; quiet is the normal state</li>
</ul>
<h2>Intelligence</h2>
<ul>
<li><a href="${SITE_URL}/weekly">Story Threads</a> — ongoing story arcs ranked by risk, each with a living forecast board that resolves in public</li>
<li><a href="${SITE_URL}/weekly/countries">Countries</a> — every covered country ranked by risk tier, with a standing intelligence briefing; each read self-corrects as news arrives</li>
<li><a href="${SITE_URL}/map">World Map</a> — today's coverage as a spatial view</li>
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

    // Bot pre-rendering
    if (isBotRequest(userAgent)) {
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
    }

    // SPA-aware fallback: any non-asset path (no "." in the last segment) that
    // wasn't already handled above (not /data/*, not /rss, not bot-prerendered)
    // gets the SPA shell (docs/index.html) with a real 200, not GitHub Pages'
    // 404 status for an unrecognised path. This covers every client route
    // (/economy, /analyze, /membership, /track-record, /weekly-brief,
    // /weekly-markets, /breaking, /breaking/:id, /weekly, /weekly/countries,
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
```

---

## Pages covered by bot pre-rendering

| Route | Data source | What bots see |
|-------|-------------|---------------|
| `/` | static (no Lambda) | Value prop (accountability model) + grouped page directory with per-page descriptions. Added 2026-07-06 (`SITE_ORIENTATION_PLAN.md` P4) — previously bots saw the empty SPA shell at the most-linked URL. Static by design: can't go stale-wrong; 24h edge cache |
| `/weekly/country/:name` | `country_preview` | Headline, risk level, summary, key developments, trajectory |
| `/weekly/thread/:id` | `thread_preview` | Thread title, story timeline |
| `/daily` | `daily_brief` (today) | Headline, summary, top stories with predictions, stats |
| `/daily/:dateKey` | `daily_brief` (specific date) | Same for that date |
| `/data/*` | **S3 world bucket** (SigV4) | JSON data for the map-as-home: `world/latest.json`, `situations/state/<id>.json`, `stories/state/<id>.json`. Not bot-gated — this is the app's data API, edge-cached `s-maxage=300`. `*.member.json` requires a Firebase token (currently fail-closed stub). |

## Notes

- All render functions use **POST** with JSON body — not GET query params
- Lambda `payload` is only read from POST body, not query string
- If Lambda returns no data, Worker falls through to GitHub Pages gracefully
- `/data/*` reads the **private** S3 bucket via SigV4 (no public-read); allowed keys are whitelisted (`DATA_ALLOWED`) on top of the read-only IAM scope. Member bundles are **fail-closed** until the Firebase JWKS check is implemented (do not open that branch without it). See `DATA_STRATEGY.md` §3.6/§5.
- **SPA fallback (added 2026-09-24, Stage-0 item (a), PREPARED — NOT YET DEPLOYED):** any GET
  request whose path's last segment has no `.` (i.e. isn't a static asset request) and that wasn't
  already claimed by `/data/*`, `/rss`, or a bot-prerender branch above now gets `docs/index.html`
  fetched from GitHub Pages and returned with **status 200** (`X-Rendered-By:
  cf-worker-spa-fallback`), instead of falling through to GitHub Pages' native 404 for an
  unrecognized path. This fixes real routes (`/economy`, `/analyze`, `/membership`,
  `/track-record`, `/weekly-brief`, `/weekly-markets`, `/breaking`, `/breaking/:id`, `/weekly`,
  `/weekly/countries`, `/signin`, `/account`, `/whitepaper`, `/spider-demo`, etc.) 404ing for
  browsers and crawlers alike. It sits **after** the `/data/*`, `/rss`, and bot-prerender branches
  (which all `return` before reaching it) so none of those are affected. A path that genuinely
  doesn't exist in the SPA still gets a 200'd shell at the edge — the client router's `*` ->
  `NotFound` route renders the real "not found" UI client-side, same as `docs/404.html` already
  does today for humans; the only change is the **HTTP status code**, from 404 to 200, for the
  shell response itself.

### Test plan for the SPA fallback (run before requesting the deploy "yes")

Run against prod (`https://globalperspective.net`) once pasted into the Cloudflare dashboard on a
preview/staging attempt, or immediately after deploy with a fast manual rollback path ready
(previous Worker version is in this file's git history):

1. **Every route in `App.jsx`'s `<Routes>`**, both a default browser UA and
   `-A "Mozilla/5.0 (compatible; Googlebot/2.1)"`:
   ```bash
   for r in / /map /privacy /about /disclosures /contact /daily /daily/2026-09-20 /economy \
            /analyze /membership /track-record /weekly-brief /weekly-markets /breaking \
            /breaking/some-id /weekly /weekly/thread/some-id /weekly/countries \
            /weekly/country/Japan /signin /auth/callback /account /whitepaper /spider-demo; do
     echo "== $r (browser UA) =="; curl -sI "https://globalperspective.net$r" | head -1
     echo "== $r (googlebot UA) =="; curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "https://globalperspective.net$r" | head -1
   done
   ```
   Expect `200` for all of the above, both UAs.
2. **Genuinely bogus path** — `curl -sI https://globalperspective.net/does-not-exist-xyz` — expect
   the fallback's `200` (shell serves, client router shows the "not found" UI after JS loads); this
   is **expected behavior**, not a bug — GitHub Pages already worked this way for humans via
   `docs/404.html`, this just fixes the status code site-wide.
3. **Bot pre-render routes still fire and are unregressed** —
   `curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://globalperspective.net/` and the
   same for a real `/weekly/country/<name>` and `/weekly/thread/<id>` — confirm
   `x-rendered-by: cf-worker-bot` (not `cf-worker-spa-fallback`) is still present, proving those
   branches still return before reaching the new fallback.
4. **`/data/*` and `/rss` unaffected** —
   `curl -sI https://globalperspective.net/data/world/latest.json` (expect `200`,
   `x-rendered-by: cf-worker-data`) and `curl -sI https://globalperspective.net/rss` (expect `200`,
   `Content-Type: application/rss+xml`) — confirm neither got intercepted by the new branch (both
   `return` earlier in the handler, so this should be a no-op check, but verify).
5. **`/daily` bot pre-render** — `curl -A googlebot https://globalperspective.net/daily` and a
   recent `/daily/:dateKey` — confirm real brief HTML content (not a fallback shell) is returned by
   the existing `renderDailyPage()` 7-day-lookback logic; if it returns generic/empty content, that
   is the daily-brief pipeline being stale (operator-side), not this Worker change — do not treat
   as a regression of this fix.
6. **`xmllint --noout docs/sitemap.xml`** — confirm the regenerated sitemap (see below) is
   well-formed, and spot-check a sample of its `<loc>` values 200 per the sweep above.

Status: **prepared — awaiting operator deploy yes.** Not pasted into the Cloudflare dashboard, not
deployed. No `wrangler deploy` run.
