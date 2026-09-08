# Cloudflare Worker — Full Updated Code

Replace ALL code in the Worker editor with the code below, then click **Deploy**.

---

```js
const API_BASE = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';
const SITE_URL = 'https://globalperspective.net';

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
  async fetch(request) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';

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

## Notes

- All render functions use **POST** with JSON body — not GET query params
- Lambda `payload` is only read from POST body, not query string
- If Lambda returns no data, Worker falls through to GitHub Pages gracefully
