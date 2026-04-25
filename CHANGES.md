# Global Perspectives — Change Log

## 2026-04-25b (newsSystemsAnalysis Lambda — Phase 1 causal graphs)

### Backend — newsSystemsAnalysis (NEW)
- New Lambda function for cross-domain causal relationship analysis within countries
- Reads 30-day archive; groups entries by threadId; identifies causal links between story threads
- Anti-hallucination: all edges must cite real topicIds, invalid IDs dropped post-LLM, edges capped per node
- Confidence levels: weak (inferential) / medium (2+ citations, 7+ day span) / strong (3+ citations + named mechanism)
- Output: `SYSTEMS#{country}` / `SYSTEMS_ANALYSIS` in `SummarizeAndPredict` DDB table
- Phase 1 restricted to `SYSTEMS_TEST_COUNTRIES=Argentina,Iran` env var (test only)
- First run verified: Iran produced 15 valid nodes, 8 edges tracing escalation sequence (threats → mediation → collapse → blockade)
- Timeout: 300s, Memory: 512MB

**Files added:** `amplify/backend/function/newsSystemsAnalysis/src/index.js`, `package.json`, CFN template

---

## 2026-04-25 (Topic mix rebalance: more climate, science, energy, business, society)

### Backend — newsInvokeGemini
- Expanded `VALID_CATEGORIES` from 7 → 12: added `climate`, `science`, `business`, `society`, `energy`
- Raised `DEFAULT_LIMIT` from 13 → 15 topics per run to support broader category coverage
- Added 4 new RSS feeds: Inside Climate News, Grist (climate), Ars Technica, MIT Technology Review (tech/science)
- Rewrote all Brave Search queries — stripped `"politics economy"` suffix from every query; added 3 queries targeting climate/energy, science, and business/society
- Rewrote Grok prompt: added rule 7 (25% category cap; minimum coverage for climate, science, society, energy, business) and rule 8 (reframed "significance" as material second-order impact, not political theater)
- Updated GOOD EXAMPLES to include diverse non-political topics
- Updated fallback prompt (no-articles mode) to include new categories and balance rule

### Frontend
- `WorldMap.jsx`: added color entries for 5 new categories; updated `CATEGORY_DISPLAY_ORDER`
- `WeeklyPage.jsx`: added badge color pairs for 5 new categories; updated `CATEGORY_ORDER` (removed stale `environment`, `culture`)
- `WeeklyMap.jsx`: updated `ORDER` to match new canonical category list

**Files modified:** `amplify/backend/function/newsInvokeGemini/src/index.js`, `src/components/WorldMap.jsx`, `src/components/WeeklyPage.jsx`, `src/components/WeeklyMap.jsx`

---

## 2026-04-22b (Hide Pair Intelligence from production)

### Feature Flag
- Removed "Pair Intel" nav link from Layout.jsx and /weekly/pairs + /weekly/pair/:slug routes from App.jsx
- Components, hooks, and backend remain intact — can be re-enabled by restoring routes

**Files modified:** `src/App.jsx`, `src/components/Layout.jsx`

## 2026-04-22 (Fix: intelligence visible to anonymous users)

### Bug Fix
- Removed auth guard from `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence` hooks — these hooks were blocking the API fetch for unauthenticated visitors (incognito mode), showing "No archive data yet" even though the backend is fully public in early access mode. All three hooks now fetch without requiring a signed-in user.

**Files modified:** `src/hooks/useWeeklyArchive.js`, `src/hooks/useThreadAnalyses.js`, `src/hooks/useCountryIntelligence.js`

## 2026-04-11 (Google Analytics + Search Console sitemap)

### SEO & Discovery
- **Google Analytics:** GA4 measurement ID `G-VT6QENX4MB` installed in `docs/index.html` — tracking live events, user flow, engagement
- **Google Search Console:** Property verified and sitemap.xml submitted — `https://globalperspective.net/sitemap.xml` now discoverable by Google crawler
- **robots.txt:** serves from production, correctly references sitemap
- **Timeline:** Expect Google to crawl sitemap within 2-24 hours, first indexed URLs in 2-7 days

### Next steps for SEO
- Current sitemap lists 18 static pages; dynamic content (daily briefs, countries, threads) not yet in sitemap → consider auto-generating URLs from DDB keys for maximum coverage

---

## 2026-04-11 (RSS feed links to source articles instead of thread pages)

### Backend (`newsSensitiveData`)
- `generateRssFeed`: changed link strategy — items now link to the first source article URL (e.g., `aljazeera.com`) instead of thread pages. Preserves fallback to thread page if no sources, then site root.
- User experience: RSS readers (Feedly, Inoreader) now click through to the original article; readers still see our AI-generated description (BLUF, regions, sources).
- Note: Feedly-cached old items still link to thread pages; new items will link to sources. Cache will naturally refresh over 1-2 days.

---

## 2026-04-11 (Fix archive_range 502 + daily brief 7-day fallback)

### Backend (`newsSensitiveData`)
- `readArchiveRange`: strip archived entries to essential fields only (`topicId, title, category, regions, sources, threadId`) — previously returned full entries with AI summary/prediction/trace_cause text, pushing 30-day responses past Lambda's 6MB payload limit and causing 502 errors on WeeklyPage
- Added `threadId` to today's entry shape so latest and archive days have matching structure

### Frontend (`useDailyBrief`)
- Added 7-day fallback loop: when the requested date returns null data, hook tries the previous day, then the day before, etc. up to 7 days back
- Fixed cache to skip storing null results and to skip returning null from cache (prevents stale empty-state getting stuck)
- User experience: `/daily` now shows the most recent brief available instead of an empty page when today's hasn't been generated yet

### Cloudflare Worker (`globalperspective-rss`)
- `renderDailyPage`: extended fallback from 1 day to 7 days back — bots hitting `/daily` always get pre-rendered HTML with the latest available brief

---

## 2026-04-11 (Redesign Account page — tabs + saved items card grid)

### Frontend
- `Account`: tabs (Profile | Saved) with URL state (`?tab=`); default tab = Saved
- `SavedPanel`: card grid (2-col on desktop), type-color-coded left border, inline unsave with collapse animation, filter chips (All / Threads / Countries / Daily), relative timestamps
- `ProfilePanel`: same content, centered 520px inside wider 900px container
- New `Account.css` for tab, chip, and card styles + hover/animation

---

## 2026-04-11 (SaveButton heart icon — fix CORS duplicate headers)

### Frontend
- `SaveButton`: switched to heart icon (red #ef4444 filled when saved, outline when not), scale animation on saved state

### Backend
- `newsSavedItems`: removed CORS headers from Lambda code — Function URL CORS config handles it exclusively (fixes duplicate Access-Control-Allow-Origin browser error)

---

## 2026-04-11 (Add SaveButton to DailyPage)

### Frontend
- `DailyPage`: SaveButton next to brief headline (itemType=daily, itemId=dateKey)

---

## 2026-04-11 (Save/bookmark feature — newsSavedItems Lambda + DynamoDB)

### Backend
- New `newsSavedItems` Lambda with Function URL — save/unsave/list bookmarks per user
- New `GlobalPerspectiveSavedItems` DynamoDB table (PK: `uid`, SK: `itemType#itemId`)
- Firebase JWT auth; supports itemTypes: thread, country, daily, pair
- Lambda URL: `https://y57kgqdctggtjtieddcts2byke0madfd.lambda-url.ap-northeast-1.on.aws/`

### Frontend
- `restProxy.js`: added `saveItem`, `unsaveItem`, `fetchSavedItems` functions
- New `useSavedItems` hook — fetches from backend, in-memory cache per session
- New `SaveButton` component — bookmark icon (filled=saved, outline=unsaved), auth-gated
- `ThreadPage`: SaveButton in title area (itemType=thread)
- `CountryPage`: SaveButton in title area (itemType=country)
- `Account`: Saved items section lists all bookmarks grouped with links
- `docs/config.js`: added `window.SAVED_ITEMS_ENDPOINT`

---

## 2026-04-11 (Early access: remove all auth gates, remove Pricing page)

### Backend (`newsSensitiveData`)
- Removed auth gates from `daily_brief` (past dates), `narrative_thread`, `archive_range`, `thread_analysis`, `country_intelligence` — all content now public
- `archive_range` now allows up to 90 days for all callers (was capped at 7 for free tier)

### Frontend
- All content accessible without sign-in (auth/save still works for logged-in users)
- Removed gate UI from: WeeklyPage, ThreadPage, CountryPage, CountryListPage, WeeklyMap, DailyPage
- Removed `/pricing` route and nav link; `Pricing.jsx` kept in codebase
- Removed dead `/pricing` links from CLIPage, AboutContact, Contact, WhitepaperPage, Account, TrialBanner

---

## 2026-04-11 (Cloudflare Worker — RSS + bot pre-rendering + OG tags)

### Infrastructure

- **Cloudflare Worker `globalperspective-rss`** — deployed, routes: `globalperspective.net/*` + `globalperspective.net/rss*`
  - **RSS proxy:** `globalperspective.net/rss` → `newsSensitiveData ?action=rss`, 30 min edge cache
  - **Bot pre-rendering:** detects 25+ bot user-agents (Twitterbot, GPTBot, Googlebot, PerplexityBot, ClaudeBot, LinkedInBot, etc.)
    - `/weekly/country/:name` → POSTs `country_preview` to Lambda → returns full HTML with OG tags, real headline, situation summary, key developments, trajectory
    - `/weekly/thread/:id` → POSTs `thread_preview` to Lambda → returns full HTML with OG tags, thread title, story timeline
  - Human visitors always get the normal React app unchanged
  - **Impact:** rich social share previews on Twitter/LinkedIn/Slack; ChatGPT/Perplexity/Claude can now read and cite page content
- **`WORKER_FULL_CODE.md`** — full Worker source code on file
- **`RSS_CLOUDFLARE_TODO.md`** — migration runbook (complete)
- No DNS changes needed — domain already registered in Cloudflare (orange cloud already enabled)

---

## 2026-04-08 (Daily Intelligence Brief — full feature)

### Backend

- **`newsPostDevTo`** — repurposed as Daily Intelligence Brief generator:
  - Runs after Dev.to publish (wrapped in try/catch — brief failure never blocks Dev.to)
  - Reads thread analyses + country intelligence from `SUMMARIZE_PREDICT_TABLE`
  - Calls Grok to generate structured brief JSON (headline, summary, topStories[], risingThread, countryToWatch, categoryBreakdown, stats)
  - Stores as `DAILY_BRIEF#YYYY-MM-DD` / `DAILY_BRIEF` in `SUMMARIZE_PREDICT_TABLE`, TTL 90 days
  - New env vars: `SUMMARIZE_PREDICT_TABLE`, `XAI_API_KEY`, `GROK_MODEL`
  - **Deploy:** `newsPostDevTo-deploy.zip` (3.4MB) — upload + set env vars + trigger manually to seed first brief

- **`newsSensitiveData`** — added `daily_brief` action:
  - Today's date: **public** (no auth required, SEO indexable)
  - Past dates: **member-gated** (JWT required, resolveUserTier check)
  - Also added GET query param support (`?action=daily_brief&dateKey=...`)
  - **Deploy:** `newsSensitiveData-deploy.zip` (13MB)

### Frontend

- **`src/services/restProxy.js`** — added `fetchDailyBrief(dateKey)`:
  - Today → `proxyAction()` (public, no auth)
  - Past → `proxyActionWithAuth()` (JWT required)

- **`src/hooks/useDailyBrief.js`** — new hook:
  - 30-min localStorage cache keyed per dateKey
  - Max 7 cached days (oldest evicted)
  - Today doesn't require auth; past dates do

- **`src/components/DailyPage.jsx`** — new page at `/daily` and `/daily/:dateKey`:
  - Sections: Lead Story, Global Overview (BoldText), Top Stories (with one-line predictions + region links → CountryPage), Rising Thread (→ ThreadPage), Country to Watch (→ CountryPage), Category Breakdown + Stats
  - Prev/next day navigation arrows
  - Auth gate for past dates when not signed in (sign-in prompt)
  - ShareButtons + CopyBriefing
  - `page-with-sidenav` layout with SideNav anchors

- **`src/components/CopyBriefing.jsx`** — added `formatDailyBrief(brief)` export

- **`src/App.jsx`** — added routes `/daily` and `/daily/:dateKey`

- **`src/components/Layout.jsx`** — added "Daily Brief" nav link

### Pending Deploy Steps
1. Upload `newsPostDevTo-deploy.zip` → set env vars `SUMMARIZE_PREDICT_TABLE`, `XAI_API_KEY`, `GROK_MODEL`
2. Upload `newsSensitiveData-deploy.zip`
3. Trigger `newsPostDevTo` manually → verify DDB item `DAILY_BRIEF#today` + CloudWatch log
4. Build frontend + copy to `/docs/` + push

---

## 2026-04-08 (Data retention extended to 90 days)

- **DynamoDB TTL extended** from 31 → 90 days across 3 Lambdas:
  - `NewsProjectInvokeAgentLambda`: `DAILY_ARCHIVE_TTL_DAYS` 31→90
  - `newsThreadAnalysis`: `THREAD_TTL_DAYS` 31→90
  - `newsCountryIntelligence`: `COUNTRY_TTL_DAYS` 31→90
- **Enterprise archive access** extended: `ENTERPRISE_MAX_DAYS` 30→90 in `newsSensitiveData`
- **AI analysis windows unchanged** at 30 days — prevents Grok prompt bloat on long threads
- **Thread matching window unchanged** at 7 days
- **Member tier unchanged** at 7 days
- **Cost impact:** ~$0.02/month extra (18MB storage vs 6MB)
- **Deploy:** 4 Lambda zips

---

## 2026-04-08 (newsPostLinkedIn: font fix — map text now renders correctly)

- **Root cause found:** librsvg (used by sharp) does NOT support `@font-face`, woff2, or data URIs — only system TTF/OTF via fontconfig
- **Fix:** Bundle Inter TTF fonts (Regular, Bold, SemiBold) in `fonts/` dir → copy to `/tmp/fonts/` at Lambda cold start → write fontconfig pointing to `/tmp/fonts/` → set `FONTCONFIG_PATH` env var
- **Connection dots improved:** endpoint dots now have colored ring (r=5) + white center (r=2), thicker connection lines
- **LinkedIn token refreshed** via OAuth 2.0 tools (expires every 60 days)
- **Removed:** old woff2 files, base64 `@font-face` `<style>` injection (never worked with librsvg)

---

## 2026-04-05 (newsPostLinkedIn: map image generation for social posts)

- **New `mapImageGenerator.js`** — generates 1200x630 PNG map images per topic for social media
- **Features:** highlighted countries with glow effect, curved connection lines between involved countries, country name labels, category badge, source count, date stamp, logo branding
- **LinkedIn integration:** 3-step image upload (initializeUpload → PUT binary → attach imageUrn to post)
- **Bluesky integration:** uploadBlob → embed image in post record
- **Fallback:** if image generation or upload fails, posts text-only (existing behavior preserved)
- **Assets bundled:** `world-map-template.svg` (147 countries, ISO-coded paths), `logo_small.png` (60x60), `sharp` with Linux binary
- **Deploy:** `~/Downloads/newsPostLinkedIn-deploy.zip` (20MB)

---

## 2026-04-05 (Home page sidebar UI refresh)

- **Restyle TopicNav + TodayArchiveSidebar** to match the SideNav frosted-glass design from ThreadPage
  - Frosted glass background (`rgba(255,255,255,0.95)` + `backdrop-filter: blur(8px)`)
  - Lighter borders, compact padding, thinned scrollbars
  - Active state: solid black pill instead of blue tint / border-left accent
- **TopicNav now starts collapsed** (matching TodayArchiveSidebar behavior)
- **TopicNav region accordions** — topics grouped by region with collapsible headers instead of flat list with badges
- **Full topic titles** — 2-line CSS clamp replaces hard 35-char JS truncation
- Updated `TopicNav.jsx`, `TopicNav.css`, `TodayArchiveSidebar.css`

---

## 2026-04-05 (NewsProjectInvokeAgentLambda: two-pass prediction agent)

- **Two-pass prediction architecture** — Research Agent → Prediction Agent, inspired by IARPA Hybrid Forecasting Competition
- **Pass 1 (Research Agent, 800 tokens):** Gathers structured context before any prediction:
  - Historical precedents (2-3 analogous events with outcomes)
  - Key actors & motivations (3-5 decision-makers, what they want, constraints)
  - Upcoming deadlines (elections, summits, central bank meetings, treaty dates)
  - Balance of forces (who has initiative, leverage, momentum)
- **Pass 2 (Prediction Agent, 1500 tokens):** Receives topic + snippets + research briefing, generates:
  - 3 scenarios (Most Likely/Optimistic/Pessimistic) grounded in research precedents
  - Winners & Losers
  - 3 trigger signals referencing real upcoming deadlines from research
- **Research output is ephemeral** — not stored, only fed into prediction prompt
- **Per-topic cost:** 4 Grok calls now (summary 600 + trace_cause 600 + research 800 + prediction 1500) vs 3 before
- **Deploy:** Lambda-only, zip at `~/Downloads/NewsProjectInvokeAgentLambda-deploy.zip`

---

## 2026-04-05 (NewsProjectInvokeAgentLambda: structured prediction with 3 scenarios)

- **Prediction prompt rewritten** using structured analytic techniques (superforecasting / ACH methodology)
- **5 changes in one commit:**
  1. **Article snippets** now fed into prediction prompt (was only title + description; trace_cause already had this)
  2. **Historical precedent** — prompt asks for 2-3 analogous situations as base rate before predicting
  3. **3 scenarios with probabilities** — Most Likely (~60%), Optimistic (~20%), Pessimistic (~20%) with adjustable weights
  4. **Falsifiable trigger signals** — 3 specific events with real dates/deadlines instead of vague watchlist
  5. **max_tokens raised** from 600 → 1500 for predictions (summary/trace_cause unchanged at 600)
- **`invokeGrok()` updated** to accept per-call `maxTokens` parameter
- **Motivation:** User feedback that single-path predictions aren't credible; professional analysts always provide multiple scenarios
- **Deploy:** Lambda-only, zip at `~/Downloads/NewsProjectInvokeAgentLambda-deploy.zip`

---

## 2026-04-04 (NewsProjectInvokeAgentLambda: fix 403 crash bug)

- **Per-topic generation now wrapped in try/catch** — a Grok API 403 on one topic no longer crashes the entire run
- **Partial results published** — if 12/13 topics succeed, the pipeline still swaps staging → latest and writes archives
- **Swap skipped only if zero topics succeed** — prevents publishing empty data
- **Logs improved** — now reports failed count alongside generated count
- **Root cause:** `invokeGrok()` threw on 403, unwound to outer catch, skipped `swapStagingToActive()` entirely → frontend showed stale data 503
- **Deploy:** Lambda-only, zip at `~/Downloads/NewsProjectInvokeAgentLambda-deploy.zip`

---

## 2026-04-04 (newsSensitiveData: RSS feed endpoint)

- **New `rss` action** on `newsSensitiveData` Lambda — serves RSS 2.0 XML feed of daily topics
- **Supports GET requests** via `?action=rss` query param (for RSS readers) + POST body
- **Content:** Today's archive entries with AI summaries, regions, sources; falls back to `latest` topics
- **Each item includes:** title, category, description (AI summary + regions + sources), pubDate, link to thread page
- **Headers:** `Content-Type: application/rss+xml`, `Cache-Control: public, max-age=1800` (30min cache)
- **Public, no auth required** — RSS readers/platforms can subscribe directly
- **Self-referencing** `<atom:link>` auto-constructed from API Gateway request context
- **Deploy:** Lambda-only change, zip at `~/Downloads/newsSensitiveData-deploy.zip`
- **Next steps:** Submit feed URL to Feedly, Flipboard, Inoreader; add `<link rel="alternate">` to frontend HTML

---

## 2026-04-02 (newsInvokeGemini: expand RSS sources from 8 → 22)

- **14 new RSS feeds added** to `newsInvokeGemini` Lambda, tripling source diversity:
  - Americas: NPR World, CBC World
  - Europe: The Guardian, DW English, EuroNews (moved from Brave Search → RSS)
  - Africa: AllAfrica, Daily Maverick, The East African
  - Middle East: Middle East Eye, Al-Monitor (moved from Brave Search → RSS)
  - Asia: Channel News Asia, Nikkei Asia, Bangkok Post
  - Oceania: ABC Australia
- **Brave Search queries reduced** from 12 → 7 (removed Guardian, DW, EuroNews, Al-Monitor, generic Africa — all now covered by RSS)
- **Per-feed cap** added: `MAX_ARTICLES_PER_FEED = 8` to keep Grok prompt size manageable
- **Expected article pool:** ~200-250 articles (up from ~80), covering all major world regions
- **Brave fetch time reduced:** 7 queries × 2s = ~14s (down from ~24s)
- **Motivation:** User feedback that source count was too low and hard to trust
- **Deploy:** Lambda-only change, zip at `amplify/backend/function/newsInvokeGemini/deploy.zip`

---

## 2026-04-02 (IntelligenceLoader: animated loading screens)

- **New component: `IntelligenceLoader.jsx` + `IntelligenceLoader.css`** — reusable dark-background loading animation component with two modes:
  - `type="typewriter"` — sentence typewriter effect with country name highlights → fades out → constellation of country nodes connected by co-occurrence edges. Used for data-heavy pages.
  - `type="explode"` — headline list shakes → explodes outward → words cluster by country → constellation. Reserved for future use (stored but not currently active on Home).
- **Showcase page: `/intelligence-map`** — existing tab page (A/B/C/D) serves as live preview of all 4 animation concepts. Tabs C (Typewriter) and D (Explode) are the ones extracted into `IntelligenceLoader`.
- **Applied to:**
  - `WeeklyPage.jsx` — replaces skeleton cards while archive loads (`type="typewriter"`)
  - `ThreadPage.jsx` — replaces `"Loading story arc…"` text (`type="typewriter"`)
  - `CountryPage.jsx` — replaces `"Loading…"` text (`type="typewriter"`)
  - `AuthCallback.jsx` — replaces `⏳ Signing you in…` gate (`type="typewriter"`)
- **Home.jsx** — `type="explode"` ready but reverted; loads too fast from cache to be useful now. Re-add with `<IntelligenceLoader type="explode" />` when needed.
- **Data source:** `useGeminiTopics()` (public, no auth, 1hr localStorage cache) — animation data available near-instantly on repeat visits. Falls back to simple spinner when no topics cached yet.
- **Exports:** `default IntelligenceLoader`, `AnimTypewriter`, `AnimExplode`, `buildGraph`

---

## 2026-04-01 (GEO: publish 3 long-form blog articles)

- **3 new blog articles** published for GEO authority building:
  - `/blog/ai-news-aggregation-guide/` — "What is AI News Aggregation? A Complete Guide" (target: AI news aggregator queries)
  - `/blog/country-risk-analysis-ai/` — "Country Risk Analysis: How AI is Changing Geopolitical Intelligence" (target: country risk tool queries)
  - `/blog/google-news-vs-ai-news/` — "Google News vs AI News Platforms: What's the Difference?" (target: Google News alternative queries)
- Each article includes Article schema JSON-LD, OG tags, canonical URLs
- Article 3 also includes FAQPage schema for direct AI engine citation
- Blog index updated with 3 new entries, sitemap updated with 3 new URLs at priority 0.7
- All articles include balanced competitor mentions (Feedly, Dataminr, Particle, Recorded Future, etc.) for credibility

---

## 2026-03-31 (GEO: sitemap update)

- **Sitemap updated** — Added 4 missing public pages: `/cli`, `/blog/`, `/blog/thread-and-country-intelligence/`, `/blog/geopolitical-intelligence-for-ai-agents/`. Bumped `/whitepaper` priority to 0.7. Organized with section comments.

---

## 2026-03-31 (GEO: noscript fallback for AI crawlers)

- **`<noscript>` content block** — Added keyword-rich fallback content in `index.html` for crawlers that don't execute JavaScript (Perplexity, ChatGPT browse, etc.). Contains product description, feature list, audience info, and FAQ-style content matching the Schema.org FAQ. Invisible to normal users (only rendered when JS is disabled).

---

## 2026-03-31 (GEO optimization: structured data + homepage keywords)

- **Schema.org structured data** — Added `Organization` + `WebApplication` + `FAQPage` JSON-LD to `<head>` for AI search engine discoverability (Perplexity, ChatGPT, Gemini).
- **Twitter Card upgrade** — Changed from `summary` to `summary_large_image`, added `twitter:site` and `twitter:creator` tags.
- **Homepage keyword copy** — Added subtle tagline under main heading with key phrases: "AI news aggregator", "geopolitical intelligence platform", "country risk analysis", "narrative patterns". Helps AI crawlers match page content to structured data.
- Files changed: `index.html` (source + docs), `Home.jsx`, `docs/assets/`.

---

## 2026-03-31 (Guest sign-out button)

- **Guest sign-out in nav** — anonymous (guest) users now see "Guest · Sign out" in the nav bar instead of a blank link. Clicking it calls `signOut()` and returns them to the signed-out state. Registered users are unaffected (still see email → `/account`). Change in `Layout.jsx`.

---

## 2026-03-23 (Share buttons + Copy Briefing)

- **Share buttons always visible** — X/Twitter and LinkedIn share links now always show on desktop alongside the copy-link button. Native OS share sheet (`navigator.share`) shown only when available (mobile/supported browsers). Fixed previous behaviour where X + LinkedIn were hidden on desktop.
- **Copy Briefing button** — new `CopyBriefing.jsx` component with `formatThreadBriefing()` and `formatCountryBriefing()` formatters. Copies plain-text briefing to clipboard with AI analysis, stats, and canonical URL. Used on ThreadPage and CountryPage.
- **Share + Copy Briefing alignment fixed** — removed `margin-bottom: 12px` from `.share-buttons` CSS rule; the parent wrapper div handles spacing, so both buttons now sit on the same baseline.

---

## 2026-03-22c (Blog: Thread Intelligence and Country Intelligence announcement)

- **New blog:** Added `docs/blog/` with index page and first post announcing Thread Intelligence and Country Intelligence features.
- Post URL: `globalperspective.net/blog/thread-and-country-intelligence/`
- Updated `.agents/product-marketing-context.md` to reflect current product state (Paddle, 3 tiers, launch mode, all 5 personas, accurate feature list).

## 2026-03-22b (CLI: global news intelligence from the terminal)

### CLI Package (`cli/`, published to npm as `global-perspectives`)
- **Interactive topic browser** — `gp today` launches a full-screen terminal UI:
  - Category tabs at top (conflict, politics, economy, etc.) — switch with `←→` or `1-9`
  - Reverse-video highlight for selected item
  - `↑↓`/`j`/`k` to navigate, `Enter` to expand
  - `Tab` to cycle AI tabs (Summarize / Predict / Trace Cause)
  - `Esc` to collapse, `g`/`G` for top/bottom
  - Alternate screen buffer (doesn't pollute terminal scrollback)
  - Keybindings bar at bottom
  - Falls back to flat list when piped (non-TTY)
- **Country intelligence** — `gp country "Iran"` shows BLUF, key developments, risk level with trajectory arrow
- **Countries list** — `gp countries` shows top 15 countries by mention count
- **Thread preview** — `gp thread <id>` shows thread title and entry timeline
- **JSON mode** — `--json` flag on any command for raw JSON output (pipeable to `jq`, scripts, agents)
- **Country flag emojis** — each topic shows the flag of its primary region (🇮🇷 🇺🇸 🇮🇱 🇨🇳). Regions without a country code show 🌐
- **Zero dependencies** — pure Node.js 18+, uses built-in `fetch` and ANSI escape codes
- **Published to npm** — `npx global-perspectives today` works globally

### Installation
```bash
npx global-perspectives today              # instant, no install
npm install -g global-perspectives && gp today  # permanent
```

---

## 2026-03-22 (SEO, public previews, Google Sign-In, launch mode, full site open)

### SEO: Public Content Previews
- **`country_preview` public API action** (no auth) in `newsSensitiveData`. Returns `headline`, `bluf`, `keyDevelopments`, `riskLevel`, `trajectory`, `totalArticles`, `dayCount` for a single country. Google can now index real country intelligence content.
- **`thread_preview` public API action** (no auth). Returns `threadTitle` and `entryShortTitles` for a single thread.
- **CountryPage preview gate** now fetches real data via `fetchCountryPreview()`. Non-signed-in users (and Google) see the actual headline, BLUF, key developments timeline, and risk level — not mock placeholder content.
- **ThreadPage preview gate** now fetches real data via `fetchThreadPreview()`. Shows real thread title and entry short titles.
- **`fetchCountryPreview(name)`** and **`fetchThreadPreview(threadId)`** added to `restProxy.js` as public (no auth) functions.

### SEO: Dynamic Page Titles
- Every page now sets `document.title` dynamically:
  - Home: "Global Perspectives™ — AI-Powered News Intelligence"
  - Weekly: "Story Intelligence — Global Perspectives"
  - Thread: "{threadTitle} — Story Arc | Global Perspectives"
  - Country: "{name} Intelligence Briefing — Global Perspectives"
  - Country List: "Country Intelligence — Global Perspectives"
  - Pricing / About / Sign In: unique titles per page

### SEO: robots.txt + sitemap.xml
- **`docs/robots.txt`** — allows all crawlers, points to sitemap.
- **`docs/sitemap.xml`** — 10 public routes with `changefreq` and `priority`. Home (hourly/1.0), Map (hourly/0.8), Weekly + Countries (daily/0.9), Pricing (weekly/0.7), static pages (monthly).
- **`public/robots.txt`** in frontend source so builds include it.

### Auth: Google Sign-In
- **`signInWithGoogle()`** added to `AuthContext.jsx` using Firebase `signInWithPopup` + `GoogleAuthProvider`.
- **SignIn page** redesigned: Google button at top with official logo SVG, "or" divider, magic link form below.
- **Error handling** for `auth/account-exists-with-different-credential` — shows helpful message instead of crash.
- **Logo** replaces emoji on sign-in page.
- **Terms agreement** text: "By signing in, you agree to our Privacy & Terms and Disclosures."
- **Launch messaging**: "All features are free during our launch period — no credit card required."

### Auth: Launch Mode (Free for All)
- **`resolveUserTier()`** in `newsSensitiveData` Lambda — verifies Firebase JWT, auto-creates user record on first sign-in (`uid`, `email`, `trialStartedAt`), returns `member` tier for all signed-in users (launch mode).
- **Trial logic commented out** with clear instructions — uncomment and reset `trialStartedAt` when ready to charge.
- **All gated actions re-gated** with JWT auth: `archive_range`, `thread_analysis`, `country_intelligence`, `narrative_thread`. Non-signed-in requests get 401.
- **Hooks guard restored** — `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence` check `!user` in production (with dev bypass).
- **`useUserProfile` hook** — fetches `user_profile` action, returns `{ tier, trialDaysLeft, isTrial }`.
- **`TrialBanner` component** — ready for when trial mode is enabled (blue/amber banner with days countdown).

### Frontend: Full Site Open
- **Construction gate removed** — all routes render real components (no `<Gate>` wrapper).
- **Full nav bar** in production: Home | Map | Weekly Analysis | Country Intel | Pricing | About | Sign in/email.
- **WeeklyLockedPreview** updated — "Sign in to access Story Intelligence" with logo, "Free during launch" messaging, "Sign in free →" as primary button.
- **Pricing page**: green "Currently free for all signed-in users" badge under $15/mo, Member button → "Sign in for free access →", launch offer notice at top.
- **Account page**: billing section replaced with "All features are currently free for early users."
- **Home page**: feature promotion banner — "New: Story Arc Intelligence & Country Briefings" with CTA buttons.
- **Welcome banner** on WeeklyPage after sign-in: "Welcome to Story Intelligence!"
- **Skeleton loading** — WeeklyPage shows pulsing skeleton cards instead of "Loading..." text.

### Frontend: Page Updates
- **About page rewritten** — What We Do, How It Works (4-step grid), Key Features, Who We Are. Technology section removed.
- **Contact page rewritten** — 3 contact cards (General, Billing, Enterprise) with subject-prefixed mailto links.
- **Privacy page**: Stripe → Paddle references updated.
- **Enterprise tier**: fake features removed, replaced with "Custom requirements — we build to your needs."
- **Tier badge** removed from Weekly Analysis header.
- **Loading text**: "Loading Gemini topics..." → "Loading topics..."

### Bug Fixes
- **`intel.riskLevel.toUpperCase()` crash** — fallback to `'moderate'` when undefined (CountryPage + CountryListPage).
- **Auth guards for production** — hooks no longer fire 401 API requests for non-signed-in users.
- **Missing routes in `knownRoutes`** — added `whitepaper`, `upgrade` to AuthContext callback URL resolver.
- **GA4 analytics restored** — `G-VT6QENX4MB` tag re-added to `index.html`.

### Files Created
| File | Purpose |
|------|---------|
| `src/components/TrialBanner.jsx` | Trial countdown banner (ready for trial mode) |
| `src/hooks/useUserProfile.js` | Fetch user tier/trial status |
| `docs/robots.txt` | Search engine instructions |
| `docs/sitemap.xml` | Search engine route discovery |
| `public/robots.txt` | Source copy for builds |

### Files Modified
| File | Changes |
|------|---------|
| `amplify/backend/function/newsSensitiveData/src/index.js` | `resolveUserTier()`, `country_preview`, `thread_preview`, launch mode, auto-create user |
| `src/App.jsx` | Construction gates removed, all routes open |
| `src/components/Layout.jsx` | Full nav, auth links restored |
| `src/components/SignIn.jsx` | Google Sign-In, logo, terms, launch messaging |
| `src/components/AuthCallback.jsx` | Sets welcome flag in sessionStorage |
| `src/contexts/AuthContext.jsx` | `signInWithGoogle()`, `GoogleAuthProvider`, updated `knownRoutes` |
| `src/components/CountryPage.jsx` | Real preview data for SEO, dynamic title |
| `src/components/ThreadPage.jsx` | Real preview data for SEO, dynamic title |
| `src/components/WeeklyPage.jsx` | Dynamic title, welcome banner, skeleton loading, trial banner |
| `src/components/CountryListPage.jsx` | Dynamic title |
| `src/components/Pricing.jsx` | Launch notice, free hint, disabled Member purchase, dynamic title |
| `src/components/Account.jsx` | Billing section → free access message |
| `src/components/AboutContact.jsx` | Full rewrite, dynamic title |
| `src/components/Contact.jsx` | Full rewrite |
| `src/components/Home.jsx` | Feature promo banner, dynamic title, removed "Gemini" loading text |
| `src/components/WeeklyLockedPreview.jsx` | Logo, launch messaging |
| `src/components/PrivacyTerms.jsx` | Stripe → Paddle |
| `src/services/restProxy.js` | `fetchCountryPreview`, `fetchThreadPreview` |
| `src/hooks/useWeeklyArchive.js` | User guard for production |
| `src/hooks/useThreadAnalyses.js` | User guard for production |
| `src/hooks/useCountryIntelligence.js` | User guard for production |
| `index.html` | GA4 restored |

---

## 2026-03-21b (Disclosures update: 14-day free trial, Enterprise contact-us, Paddle payment processor)

### Frontend: Disclosures Page — Subscription Terms Updated
- **Free Trial**: changed from "No free trial is currently offered" to 14-day free trial, no credit card required.
- **Enterprise tier**: removed fixed $45/month price, now "Contact us for pricing" model.
- **Cancellation**: removed Stripe-specific reference, now generic "Customer Portal".
- **Payment Processing**: updated from Stripe to Paddle; added note that Paddle is the Merchant of Record handling VAT/taxes globally.
- Last updated date: 2026-03-21.

## 2026-03-21 (Whitepaper page, Paddle migration, legal/compliance updates, SPA routing fix)

### Frontend: Whitepaper Page
- **New `WhitepaperPage.jsx`** — full white paper rendered as a styled React page at `/whitepaper`. Sections: Executive Summary, Problem (3 parts), Solution (6-step Narrative Arc Intelligence pipeline), Who It's For (5 personas), Platform (3 tiers), Design Principles, Why Now, Conclusion + CTA.
- **Route added** in `App.jsx` — `/whitepaper` is public (no Gate).
- **Footer link added** in `Layout.jsx` — "White Paper" link in footer nav.

### Frontend: Disclosures Page — Strengthened Legal Language
- **AI-Generated Content section rewritten** — explicit "not financial, investment, legal, political, or security advice" statement. Forward-looking statements disclaimer. "Do not rely solely on this platform" language.
- **New Limitation of Liability section** — "as is" disclaimer, no warranties, no consequential damages.
- **Data Sources section updated** — added note that source article text is not reproduced.
- Last updated date bumped to 2026-03-21.

### Payment: Stripe → Paddle Migration
- **`newsStripeWebhook/src/index.js` rewritten for Paddle** — handles `subscription.created`, `subscription.updated`, `subscription.canceled`. Signature verification uses HMAC-SHA256 with built-in Node `crypto` (no external deps). Reads `uid` from `data.custom_data.uid`. Stores `paddleCustomerId` and `paddleSubscriptionId` in `USERS_TABLE`.
- **`newsStripeWebhook/src/package.json`** — removed `stripe` dependency (crypto is Node built-in).
- **`Pricing.jsx` `buildCheckoutUrl()` updated** — reads `window.PADDLE_CHECKOUT_URL` (set in `docs/config.js`). Passes `checkout[custom][uid]` and `customer[email]` as URL params.
- **`newsSensitiveData/src/index.js`** — added `user_profile` action (Firebase JWT auth → DynamoDB lookup → return tier/status). Added `portal_session` action (Firebase JWT auth → get `paddleCustomerId` → call Paddle auth-token API → return portal URL). Firebase JWT verification implemented using Node `crypto` + Google public key fetch (cached 1hr, no firebase-admin needed). New env vars: `USERS_DDB_TABLE`, `FIREBASE_PROJECT_ID`, `PADDLE_API_KEY`.

### Docs: Legal Notes
- **New `docs/LEGAL_NOTES.md`** — documents content usage legal research: Brave Search API ToS analysis, industry precedents (Perplexity lawsuits), risk matrix, what keeps the platform protected.

### Frontend: Navigation — Pricing Added to Production Nav
- **`Layout.jsx`** — added "Pricing" link to the production nav bar (previously only visible in dev mode). Pricing page is now accessible from the top nav on the live site.

### Infrastructure: GitHub Pages SPA Routing Fix (two-part)
- **`resolveBasename()` fix in `App.jsx`** — was incorrectly using the first path segment (e.g. `/pricing`) as the React Router basename on custom domain, causing every link to double-prefix (e.g. `/pricing/pricing`) and direct URL loads to render the wrong page. Fix: basename detection now only activates on `github.io` hostname; returns `undefined` on custom domain so all routes are treated as absolute paths.
- **`global-perspectives-starter/frontend/index.html`** — added `sessionStorage.redirect` restore script to the source file (not just `docs/index.html`). When GitHub Pages serves `404.html` for a deep link (e.g. `/whitepaper`), the path is restored after redirect so React Router renders the right page. Moving the script to source ensures it survives every build.

### Pending (requires Paddle account setup)
- Set `window.PADDLE_CHECKOUT_URL` in `docs/config.js` after creating product in Paddle dashboard
- Set Lambda env vars: `PADDLE_WEBHOOK_SECRET` (newsStripeWebhook), `USERS_DDB_TABLE` + `FIREBASE_PROJECT_ID` + `PADDLE_API_KEY` (newsSensitiveData)
- Add webhook in Paddle Dashboard → Notifications pointing to newsStripeWebhook API Gateway URL
- Subscribe to: `subscription.created`, `subscription.updated`, `subscription.canceled`

---

## 2026-03-21 (Country Intelligence structured briefing, timeline, sidebar nav, dev bypass)

### Lambda: `newsCountryIntelligence` — Structured Output
- **New `bluf` field.** Single-sentence bottom-line-up-front assessment.
- **New `keyDevelopments` field.** Array of 5-7 dated events (date + text), most recent first. Replaces scanning paragraphs for key facts.
- **New `whyItMatters` field.** 2-3 sentences with `**bold**` key phrases for scannable reading.
- **New `backgroundTimeline` field.** Array of 10-15 chronological events with `date`, `event`, `category` (conflict/politics/economy/diplomacy/security/society), and `topicId` for article linking.
- **`trajectory` changed to enum.** Now returns "escalating", "stable", or "de-escalating" instead of freeform text. Detailed trajectory moved to `trajectoryDetail`.
- **All text fields use `**bold**` markers** for frontend rendering of key phrases.
- **Watch triggers forced forward-looking.** Prompt includes today's date and requires all signals to reference future dates.
- **`topicId` passed to prompt** so AI can reference specific articles in the timeline.
- **MAX_TOKENS increased to 5000** to accommodate structured output.

### Lambda: `newsSensitiveData` — Auth Bypass for Dev
- **All gated actions temporarily public** (`archive_range`, `thread_analysis`, `country_intelligence`, `narrative_thread`). Auth checks replaced with `// TODO: Add Firebase JWT auth before public release` comments.
- **Local source synced** with deployed version — `thread_analysis`, `country_intelligence` actions now in local index.js. All pass through full DynamoDB item (minus PK/SK/ttl).

### CountryPage — Structured Briefing Redesign
- **Risk indicator as 4-dot visual scale** (low/moderate/elevated/high) with colored dots instead of text-only badge.
- **Trajectory badge** (↗ Escalating / → Stable / ↘ De-escalating) with color next to risk dots.
- **BOTTOM LINE section** — blue left-border card with the one-sentence BLUF assessment. Immediately visible, no click needed.
- **KEY DEVELOPMENTS timeline** — dated bullet list of 5-7 key events with blue dots.
- **Metrics strip moved to header area** — articles/stories/days cards between headline and section nav.
- **WHY IT MATTERS section** — amber callout box with bold key phrases rendered via `BoldText` component.
- **`BoldText` component** — parses `**text**` markdown into `<strong>` tags for inline bold rendering.
- **Background Timeline** (`BackgroundTimeline.jsx`) — vertical day-grouped timeline:
  - Events grouped by date, primary event always visible, "+N more events" expand button
  - Category-colored dots with numbering (conflict #1, politics #2, etc.)
  - Category legend at bottom with totals
  - Click event → scroll to matching article in coverage with yellow flash highlight
  - Related articles shown inline when expanded (fuzzy-matched by keyword overlap with coverage entries)
- **Deep Analysis renamed** — "Full Situation Analysis" → removed (replaced by timeline). "What's Next" and "Cross-Thread Connections" remain as expandable accordions.
- **Watch triggers as amber chips** — ⚡-prefixed pills instead of bullet list. Section renamed to "WHAT TO WATCH".
- **Related coverage collapsed by default** — toggle button "Related coverage (N) ▾" expands to reveal filters and day groups.
- **Dismissible explainer** — "This briefing is generated daily by AI..." with "Got it" button, persists in localStorage.
- **"Updated Xh ago" timestamp** from `intel.generatedAt` in subtitle.
- **Auto-open first AI tab removed** — structured sections (BLUF, developments, why it matters) replaced the need for tab auto-open.
- **Section IDs** on all major sections for scroll-spy navigation.

### SideNav — Reusable Floating Sidebar (`SideNav.jsx`)
- **Desktop only** (1100px+), hidden on mobile. Fixed position on the right side of viewport, outside content container.
- **Scroll-spy** via IntersectionObserver — active section highlighted as user scrolls.
- **Bottom-of-page detection** — when scrolled to bottom, last section activates.
- **Section counts** shown as small badges (e.g., "Coverage 144", "Watch 4").
- **Click to jump** with smooth scroll.
- **Glassmorphism style** — semi-transparent white background with backdrop blur, subtle border, 10px border-radius.
- **Reusable** — any page can use `<SideNav sections={[...]} />` with `page-with-sidenav` / `page-main-content` wrapper classes.

### SectionNav — Floating Pill Bar (kept for mobile)
- Sticky horizontal pill bar with scroll-spy, used on CountryPage for mobile navigation.

### CountryListPage — Full Redesign
- **CountryOverviewMap** (`CountryOverviewMap.jsx`) — clean risk-colored dot map:
  - One dot per country, no connection lines
  - Color = risk level (red/orange/yellow/green/grey)
  - Size = log(article count)
  - Hover tooltip: country name, article count, risk dot, AI headline, "Click for full briefing"
  - Close button hidden on InfoWindow, auto-pan enabled
  - Map hero container `overflow: visible` so tooltip isn't clipped
- **Search bar** — filters featured cards and "other countries" by name and headline
- **Sort toggle** — Risk level (default) / Most covered / A→Z
- **Region filter pills** — All (8) / Middle East (3) / Europe (2) etc.
- **Risk legend** — colored dots for High/Elevated/Moderate/Low + trend arrows
- **Map hint** — "Dot size = coverage volume · Color = risk level · Click any country"
- **Section headers** — "AI BRIEFINGS" with hint, "Other countries" with explanation
- **Featured cards** sorted by risk level (high first), with:
  - Colored left border by risk
  - Trend arrow (↗ Escalating derived from trajectory text)
  - Top 2 category tags with colors
  - "View briefing →" link
- **"Updated Xh ago"** timestamp from intelligence data
- **Compact pill grid** for countries without intelligence

### Dev Mode Bypass
- **All auth gates bypass in dev** — `import.meta.env.DEV` check on WeeklyPage, CountryPage, CountryListPage, ThreadPage. No sign-in needed for `npm run dev`.
- **Hooks fetch without user** — `useWeeklyArchive`, `useThreadAnalyses`, `useCountryIntelligence` no longer require `user` to be set.
- **Dev-only full nav** — Layout shows Weekly Analysis, Country Intel, Pricing links in dev mode.

### Other
- **Home page FreeGate removed** — all topics visible to everyone, no forced sign-in overlay.
- **WeeklyMap map bounds** — `minZoom: 2`, `maxZoom: 12`, `restriction` with `strictBounds` prevents grey areas.
- **WeeklyMap country selection visuals** — selected country bright + large, connected countries same color at 35% opacity, unrelated hidden entirely.
- **CoverageList show top 3** day groups with "Show N more days" button.

### Files Created
| File | Purpose |
|------|---------|
| `src/components/BackgroundTimeline.jsx` | Vertical day-grouped timeline with category dots, expand, and article linking |
| `src/components/SideNav.jsx` | Reusable floating sidebar nav with scroll-spy (desktop only) |
| `src/components/CountryOverviewMap.jsx` | Clean risk-colored dot map for country list |
| `src/components/SectionNav.jsx` | Sticky horizontal pill bar with scroll-spy (mobile) |

### Files Modified
| File | Changes |
|------|---------|
| `src/components/CountryPage.jsx` | Full structured briefing redesign, SideNav, BackgroundTimeline, BoldText, coverage collapse |
| `src/components/CountryListPage.jsx` | Full redesign with overview map, search, sort, filters, legends, hints |
| `src/components/WeeklyPage.css` | All new CSS for timeline, sidebar, overview map, briefing sections, coverage toggle |
| `src/components/WeeklyPage.jsx` | CATEGORY_ORDER/RISK_COLORS exports, dev auth bypass |
| `src/components/WeeklyMap.jsx` | hidePanel, defaultCountry/Thread, onCountryClick, country selection visuals, map bounds |
| `src/components/ThreadPage.jsx` | Dev auth bypass |
| `src/components/Home.jsx` | FreeGate removed |
| `src/components/Layout.jsx` | Dev-only nav links |
| `src/App.jsx` | Dev mode gate bypass |
| `src/hooks/useWeeklyArchive.js` | User check removed for dev |
| `src/hooks/useThreadAnalyses.js` | User check removed for dev |
| `src/hooks/useCountryIntelligence.js` | User check removed for dev |
| `src/services/restProxy.js` | Added fetchCountryIntelligence |
| `amplify/backend/function/newsCountryIntelligence/src/index.js` | Structured output prompt, backgroundTimeline, forward-looking watch triggers |
| `amplify/backend/function/newsSensitiveData/src/index.js` | Added thread_analysis + country_intelligence actions, auth bypass |

---

## 2026-03-20 (WeeklyMap props, CountryPage/ThreadPage map fixes, CountryListPage redesign)

### WeeklyMap — New Embedding Props
- **`hidePanel` prop.** Hides sidebar panel, toggle button, playback overlay, and legend. Map takes full width. Used by CountryPage and ThreadPage.
- **`defaultCountry` prop.** Sets `activeCountry` on mount, filters markers to that country's threads, auto-zooms to related markers.
- **`defaultThread` prop.** Sets `highlightThread` on mount, auto-zooms to that thread's markers.
- **`onCountryClick` prop.** When set, clicking a map dot calls this callback with the country name instead of showing an InfoWindow. Used by CountryPage to navigate between countries.
- **`disableInfoWindow`** passed to `WeeklyGoogleMap` when `onCountryClick` is set.

### WeeklyMap — Country Selection Visuals
- **Selected country** renders at full color, larger scale (+4), white border, topic count label, z-index 300.
- **Connected countries** keep their thread color but at 35% opacity, normal size — visually linked but clearly not selected.
- **Unrelated markers and lines** are fully hidden (not rendered at all) when a country is active.
- **Connection lines** in country mode use original thread color at 30% opacity, thin weight.

### WeeklyMap — Map Bounds & Zoom
- **`minZoom: 2`** prevents zooming out past the world view.
- **`restriction`** with `strictBounds: true` prevents panning to grey areas outside world bounds (lat ±85, lng ±180).
- **`maxZoom: 12`** added.
- **`fitBounds` clamp.** After auto-fit, an `idle` listener ensures zoom doesn't drop below 2. Single-point coordinates use `setZoom(5)` instead of zero-area bounds.

### CountryPage — Coverage List
- **Show top 3 day groups** by default with a "Show N more days" button for the rest, saving vertical space.

### CountryListPage — Full Redesign
- **CountryOverviewMap** — new lightweight map component (`CountryOverviewMap.jsx`). Shows one dot per country (no connection lines, no thread data). Dots colored by risk level (red=high, orange=elevated, yellow=moderate, green=low, grey=no intel). Size scaled logarithmically by article count.
- **Hover tooltips** on map dots: country name, article count, risk level with colored dot, AI headline, "Click for full briefing" hint. Close button hidden. Map auto-pans to keep tooltip visible (`disableAutoPan: false`). Container `overflow: visible` so tooltip isn't clipped.
- **Featured cards** sorted by risk level (high first, then by article count). Each card shows: colored left border (risk), country name, risk dot + label, trend arrow (Escalating/Stable/De-escalating derived from trajectory text), AI headline, top 2 category tags, article/story count, "View briefing →" link.
- **Region filter pills** above featured cards (All, Middle East, Europe, Asia, etc.) with counts.
- **Other countries** shown as compact tag-style pills (name + article count) below featured section.
- **Hooks rule fix.** All `useState`/`useMemo` hooks moved before early returns to prevent "Rendered more hooks" error.

### Construction Gate + Preview Mode
- **`ComingSoon` component** replaces WIP routes (weekly, signin, pricing, account, etc.) in production.
- **`?preview=1`** URL param bypasses gate, persists in `sessionStorage` for the tab session.
- **`import.meta.env.DEV`** automatically bypasses gate in dev mode (`npm run dev`).
- **Dev-only nav links** — Layout shows full nav (Weekly Analysis, Country Intel, Pricing) in dev, trimmed nav (Home, Map, About) in prod.

### Home Page
- **Removed `FreeGate` overlay** that forced non-authenticated users to sign in after 1 topic. All topics now visible to everyone.

### Other
- **Removed CI auto-deploy workflow** (`.github/workflows/deploy.yml`). Build + copy to `docs/` is done locally. Prevents push conflicts from CI pushing build artifacts.
- **Added `fetchCountryIntelligence`** to `restProxy.js`.
- **Disclosures page updated** — subscription terms (tiers, pricing, refund policy, cancellation, payment processing via Stripe), contact info, business name, corrected data sources (xAI Grok + Brave Search).
- **Privacy page updated** — Firebase auth, Stripe payment data, account deletion process, corrected third-party services, cookies section for GA4/Firebase.

### Files Created
| File | Purpose |
|------|---------|
| `src/components/CountryOverviewMap.jsx` | Lightweight risk-colored dot map for country list page |

### Files Modified
| File | Changes |
|------|---------|
| `src/components/WeeklyMap.jsx` | `hidePanel`, `defaultCountry`, `defaultThread`, `onCountryClick` props; country selection visuals; marker/line hiding; map bounds restriction; `disableInfoWindow` + `activeCountry` on WeeklyGoogleMap |
| `src/components/CountryPage.jsx` | CoverageList show 3 + "Show more" |
| `src/components/CountryListPage.jsx` | Full redesign: overview map, risk-sorted cards, trend arrows, category tags, region filters, compact others grid |
| `src/components/WeeklyPage.css` | CountryOverviewMap hero, featured card, filter pill, trend, others grid CSS |
| `src/components/Layout.jsx` | Dev-only full nav links |
| `src/components/Home.jsx` | Removed FreeGate, unused auth import |
| `src/components/Disclosures.jsx` | Subscription terms, refund policy, contact, Stripe info |
| `src/components/PrivacyTerms.jsx` | Auth, Stripe, account deletion, corrected services |
| `src/App.jsx` | ComingSoon gate, preview mode, dev bypass, real routes behind Gate |
| `src/services/restProxy.js` | Added `fetchCountryIntelligence` |

---

## 2026-03-15 (Category grouping on Weekly Analysis + WeeklyMap panel)
- **Thread list grouped by category.** Both the Weekly Analysis feed (`WeeklyPage.jsx`) and the WeeklyMap side panel (`WeeklyMap.jsx`) now group threads into collapsible category sections (politics, economy, conflict, technology, environment, health, society, culture, science, other) instead of a flat list. Each section shows a colored header with the category name and thread count, and collapses/expands on click with an animated chevron.
- **Show 5 / Show more pattern.** Each category group shows the first 5 threads by default. If more exist, a "Show X more" button appears at the bottom of the group. Expanding one group is independent of others.
- **Category badge color fix.** Category group names were incorrectly using the badge background color (`c.bg`) as text color — fixed to use `c.color` (the dark variant) so labels are legible.
- **Per-item category badge removed from list view.** Now that threads are already grouped under a category header, the redundant inline category badge on each thread card/item has been removed.
- CSS added: `.weekly-category-group`, `.weekly-category-group-header`, `.weekly-category-group-name/count/chevron`, `.weekly-category-show-more` in `WeeklyPage.css`; matching `.wmap-category-group*` and `.wmap-category-show-more` in `WeeklyMap.css`.

## 2026-03-15 (Weekly Analysis + WeeklyMap UI improvements)
- **Trending cards cleaned up.** Removed inline AI summary text from "Rising This Week" featured cards and StoryCard list items — cards now show title, badges, and arc dots only. Full titles no longer truncated.
- **Filter bar improvements.** Period filter labels changed from cryptic "3d/7d" to "3 days / 7 days". "All Xd" button hidden when archive is exactly 7 days (member tier) to avoid duplication. "Show" label added before the period group. Country dropdown added after sort selector — filters threads to a specific country.
- **WeeklyMap side panel widened** from 320px → 500px with consistent 20px horizontal padding. Entry title font size increased, AI buttons larger. Detail header and meta paddings increased throughout.
- **MiniMap single-country zoom fix.** When a story involves only one country, the map now pads out 60°lat × 90°lng so the full country and its neighbors are visible rather than zooming in too close.
- **Map AI toolbar wrapping.** AI Arc Analysis buttons now wrap onto multiple lines in narrow contexts instead of overflowing.
- **CompactTimeline entry click → map focus.** Clicking a daily entry in "Daily coverage" sets the map to that entry's date (paused playback), zooms to that entry's countries, and dims others.
- **Playback overlay removed.** The floating top-right overlay during story playback has been removed. Play/stop is controlled entirely via the side panel button.
- **Country filter on WeeklyMap.** Dropdown in the panel filters the thread list and dims non-matching markers/lines on the map. Hint text shown when no country is selected.
- **Country Replay animation.** Select any country → "▶ Replay [Country] — N days" button appears. Clicking starts a day-by-day animation: map shows that country's active threads stepping forward at 1.5s/day, panel thread list updates to show only threads active on that day, progress bar + ◀ ❚❚ ▶ ✕ controls in the panel (no floating overlay).
- **Category badges unified.** `CATEGORY_BADGE_COLORS` exported from `WeeklyPage.jsx` and imported in `StoryEntryCard.jsx` and `WeeklyMap.jsx` so all category badges (thread list items, entry cards, detail header) use the same color scheme.
- **WeeklyMap thread list.** Colored thread dots removed from panel list cards and detail header (kept on map markers). Category badge added above each thread title and in the detail header meta.
- **Full Map link removed** from Weekly Analysis header — redundant with the Map toggle.
- **Navigation.** "Full Map →" link removed from Weekly Analysis page header.

## 2026-03-15 (Analytics, CI/CD, and deployment infrastructure)
- **Google Analytics 4 added.** Tag `G-VT6QENX4MB` injected into `docs/index.html`. Tracks real-time visitors, page views, traffic sources, countries, new vs returning users. Data starts accumulating from today. Verify via GA4 → Realtime at analytics.google.com.
- **GitHub Actions auto-deploy workflow added.** `.github/workflows/deploy.yml` — triggers on push to `main` when `src/` files change. Automatically runs `npm ci`, `npm run build`, copies `dist/` to `docs/`, and commits back. Eliminates the manual build + copy + commit workflow entirely.
- **Wrangler CLI installed and authenticated.** `wrangler` v4.73.0 installed globally. Authenticated with `globalperspectives.app@gmail.com` (account ID `45efe64168fc55da3937e2c01b1ca43a`). Zone `globalperspective.net` confirmed linked.
- **`.gitignore` updated.** Added `*-firebase-adminsdk-*.json` pattern to prevent Firebase Admin SDK service account keys from being accidentally committed.
- **`weekly-ui-redesign` branch deployed.** Built and pushed all frontend changes (Story Intelligence page, loading indicators, auth components, Firebase config) to `weekly-ui-redesign`. Branch is live on GitHub — merge to `main` when ready to go to production.

## 2026-03-15 (Thread analysis improvements — watchQuestions, Brave Search, richer context)
- **`newsThreadAnalysis`: Brave Search grounding.** Before calling Grok, now performs two web searches on the latest entry title: `/news/search` (past week, 4 results) + `/web/search` (background/analysis, 2 results). Up to 6 external references injected into the prompt with `[1]`, `[2]` citation instructions. Requires `BRAVE_SEARCH_API_KEY` env var (same key as `newsInvokeGemini`).
- **`newsThreadAnalysis`: Full entry context.** Removed 300-char summary truncation — full summaries now passed to Grok. Added individual entry `ai.prediction` (250 chars) and `ai.trace_cause` (200 chars) per entry so Grok sees how analysts assessed the story each day. Added source outlet names per entry.
- **`newsThreadAnalysis`: Prompt overhaul.** All three analysis fields given explicit structure instructions: `storyArc` → analytical journalism style with turning points; `trajectory` → specific actors/scenarios/timeframes, no vague language; `rootCauseChain` → 3-layer causal chain (immediate trigger → enabling condition → structural factor).
- **`newsThreadAnalysis`: `watchQuestions` field added.** New field: array of exactly 3 specific, actor-named follow-up questions a reader should watch for (e.g. "Will the ECB raise rates at its June meeting in response?"). Stored in DDB, passed through to frontend.
- **`newsThreadAnalysis`: MAX_TOKENS raised 2000 → 3000.** Needed for richer multi-field responses.
- **`newsSensitiveData`: `watchQuestions` passthrough.** Added `watchQuestions` to `readThreadAnalyses()` field allowlist so frontend receives the new field.
- **`ThreadIntelligence.jsx`: Tab labels renamed.** "Story Arc" → "How It Evolved", "Trajectory" → "What's Next", "Root Causes" → "Why It Happened". More intuitive for first-time readers.
- **`ThreadIntelligence.jsx`: Watch questions UI.** Always-visible amber-bordered question list shown above the analysis tabs — no click needed. Label "Questions to follow". Renders only when `watchQuestions` array is non-empty.
- **Zips:** `newsThreadAnalysis.zip` and `newsSensitiveData.zip` updated and ready to upload.

## 2026-03-15 (Loading indicators — progress bar + AI toast)
- **`LoadingBar.jsx` (new).** Thin 3px fixed progress bar at the very top of every page. Blue→purple→cyan gradient with glow. Animates 0%→85% on load start, completes to 100% and fades out on finish. Event-driven via `window.dispatchEvent('gp-loading-start' / 'gp-loading-end')` — no context wiring needed.
- **`AIToast.jsx` (new).** Non-blocking frosted-glass pill fixed at bottom-right. Appears when any AI generation operation is running. Shows contextual messages: "Generating summary…" / "Mapping chain reactions…" / "Tracing origins…". Stacks multiple concurrent ops with a `+N` count badge. Slides in with spring animation. Event-driven via `gp-ai-start` (with `{id, message}`) / `gp-ai-end` (with `{id}`).
- **`LoadingIndicators.css` (new).** Styles for both components.
- **`Layout.jsx` updated.** Renders `<LoadingBar />` and `<AIToast />` inside the layout wrapper so they appear on every page.
- **`useGeminiTopics.js` updated.** Fires `gp-loading-start` before network fetch, `gp-loading-end` in finally block.
- **`useWeeklyArchive.js` updated.** Same pattern — fires loading events around archive fetch.
- **`MapSidePanel.jsx` updated.** Each AI handler (Summary, Prediction, TraceCause) fires `gp-ai-start` with contextual message and `gp-ai-end` with per-operation ID on completion.

## 2026-03-15 (Weekly page redesign — Story Intelligence branch)
- **Branch: `weekly-ui-redesign`.** Full visual redesign of the Weekly page on a separate branch.
- **Title renamed.** "Weekly Analysis" → "Story Intelligence".
- **`FeaturedSection` (new component).** Replaces horizontal-scroll `TrendingSection`. 3-column grid of rising/new arcs. Each card has a gradient top border, always-visible summary, "Read full arc →" CTA. Stacks to 1 column on mobile.
- **`StoryCard` redesigned.** Summary always visible (no click needed). `▼ Analyze` pill button on the right expands the full analysis (ThreadIntelligence + MiniMap + CompactTimeline). Dark pill when expanded.
- **`ArcDots` updated.** Date labels on both ends (`Mar 10 ●───○───● Mar 14`). Gap dots for days with no coverage. Only shown for multi-day threads.
- **`FilterControls` (new component).** Replaces `FilterBar` and region accordion. Single bar: search input + 3d/7d/all period toggles + sort select. Region chips row below for one-click filtering. Active chip turns dark.
- **Flat `weekly-feed`.** Single scrollable feed replacing nested region accordion sections. Region chips provide filtering instead of grouping.
- **Category badges.** Each story card and featured card shows a colored category badge (conflict/military/disaster/politics/economy/technology/health) derived from the latest entry.
- **Story activity status dot.** Each card shows ● Active (green, ≤2 days), ● Ongoing (amber, 3–7 days), or ● Quieting (gray, 7+ days) based on `dateRange.to` vs today.
- **Map navigation fixes.** `WorldMap.jsx`: added `← Back` button in page header; story banner replaced with `← Back` + "Showing connections for: …" layout. `MapSidePanel.jsx`: added sticky "← Back to all" bar when a topic is selected; "☆ Related" → "✕ Deselect" when active.
- **`MiniMap.jsx`: `static` prop.** Disables navigation and hides "Open full map →" footer when used inside modals (prevents accidental page change). Keyboard accessible (`role="button"`, `onKeyDown`).
- **New CSS classes.** `.featured-section`, `.featured-card`, `.story-card-main`, `.story-card-content`, `.story-card-summary`, `.story-expand-btn`, `.filter-controls`, `.filter-region-chip`, `.weekly-feed`, `.arc-dot-date-label`, `.story-category-badge`, `.story-activity-dot`, `.watch-questions`, `.watch-question-item`.
- **Files changed:** `WeeklyPage.jsx`, `WeeklyPage.css`, `MiniMap.jsx`, `WorldMap.jsx`, `MapSidePanel.jsx`, `ThreadIntelligence.jsx`.

## 2026-03-15 (Home page freemium gate)
- **Home: Freemium gate.** Signed-out visitors see only the first topic fully (with AI toolbar, sources, Google News link). The rest of today's topics are blurred behind a sign-in gate with a "🌍 N more topics today" CTA, "Sign in free →" button, and "See Member plans" link.
- **Home: `FreeGate` component.** Inline component that renders a blurred preview of up to 3 locked regions with their topic titles (pointer-events disabled), with a gradient overlay fading from transparent to white. Shows exact count of locked topics.
- Signed-in users (any tier) see all topics unchanged. Gate only activates for unauthenticated visitors.
- Updated `src/components/Home.jsx`.

## 2026-03-15 (Nav cleanup + Account page)
- **Nav: Simplified.** Removed Contact, Privacy, Disclosures from main nav (still in footer). Nav is now: Home | Map | Weekly Analysis | Pricing | About | [email / Sign in].
- **Nav: Renamed Weekly → Weekly Analysis.** Label updated in `Layout.jsx`.
- **Nav: Member hint.** Small 🔒 superscript shown next to "Weekly Analysis" for signed-out users only. Hidden for signed-in members — no clutter for paying users.
- **Nav: Removed duplicate Upgrade link.** Signed-out users previously saw both "Pricing" in nav and a separate blue "Upgrade" button. Removed the redundant Upgrade button; Pricing link in nav is sufficient.
- **Account page: Full rebuild.** Replaced minimal 3-field layout with a proper multi-card profile page:
  - **Identity card** — initials avatar (blue circle), email, tier badge, Active/status indicator, "Since [month year]" (from Firebase `user.metadata.creationTime`) all in one row.
  - **Your plan includes** — perks list with icons per tier (member: 4 perks, enterprise: 5 perks, free: hidden). Lists Weekly Analysis, Weekly Map, Thread Intelligence, Trending, Narrative Thread.
  - **Quick access** — direct links to Weekly Analysis and Weekly Map. Member/enterprise only.
  - **Billing card** — Manage billing & subscription button (member/enterprise) or Upgrade CTA (free). "Billing issue? Contact support →" mailto link always visible.
  - **Account card** — Sign out as a proper bordered button (was previously invisible plain muted text). Delete account flow: clicking shows a confirmation panel with instructions to email support for deletion within 24 hours.
- Updated `src/components/Account.jsx`, `src/components/Layout.jsx`.

## 2026-03-15 (Infrastructure setup + bug fixes)
- **Firebase Auth configured.** Added `window.FIREBASE_CONFIG` to `docs/config.js`. Added `.env.local` with `VITE_FIREBASE_*` vars for local dev fallback. Enabled Email link (passwordless) sign-in in Firebase Console. Added `benben05059997.github.io` and `globalperspective.net` to Firebase authorized domains.
- **Stripe setup.** Installed Stripe CLI. Created live product (`prod_U9N7L4KtBAUPso`), price (`price_1TB4NWHAFyhbSKzgEbqhcz3C`, $15/mo recurring), and webhook endpoint (`we_1TB51WHAFyhbSKzgVM8syUnI`) pointing at Lambda Function URL. Webhook subscribes to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **`newsStripeWebhook` Lambda deployed.** New Lambda handling Stripe webhook events — creates/upgrades user to `member` on checkout, downgrades to `free` on cancellation, updates tier on subscription status change. Function URL created: `https://tu2abnue3kefs2lkeczezoez3m0fzztr.lambda-url.ap-northeast-1.on.aws/`. Env vars: `USERS_DDB_TABLE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Users DynamoDB table created.** `GlobalPerspectiveUserTable`, PK: `uid` (String). Stores `tier`, `email`, `stripeCustomerId`, `subscriptionId`, `subscriptionStatus`.
- **`newsSensitiveData` bug fixes deployed.** Fixed `ddb.send()` → `getDynamoClient().send()` crash in `readThreadAnalyses()`. Removed unused `UpdateCommand` import. Zip uploaded to Lambda.
- **`newsSensitiveData` env vars added.** `USERS_DDB_TABLE`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FRONTEND_URL` (`https://globalperspective.net`).
- **Phase 5 legacy apiKey cleanup.** Removed all remaining `apiKey` refs from weekly archive flow: `useThreadAnalyses`, `WeeklyPage`, `WeeklyMap` (replaced `embeddedApiKey` prop with `embedded` boolean). Fixed `fetchNarrativeThread` dead param. Fixed `AuthCallback` hardcoded `/signin` href → `<Link>`.

## 2026-03-14 (Firebase Auth + Stripe subscription)
- **Auth system migration.** Replaced manual API key entry (`ApiKeyGate`) with Firebase Authentication (passwordless email link sign-in). Users receive a magic link by email; on click they are signed in. Firebase ID token sent as `Authorization: Bearer <token>` on all gated API calls.
  - Created `src/contexts/AuthContext.jsx` — Firebase Auth provider. Config read from `window.FIREBASE_CONFIG` (set in `docs/config.js`) with VITE env var fallback for local dev. Exports `useAuth()`, `sendSignInLink()`, `completeSignIn()`, `signOut()`, `getIdToken()`.
  - Created `src/components/SignIn.jsx` — email input form, sends magic link via Firebase `sendSignInLinkToEmail`.
  - Created `src/components/AuthCallback.jsx` — `/auth/callback` route, completes sign-in from email link via `signInWithEmailLink`.
  - Updated `src/App.jsx` — wraps app in `AuthProvider`; added `AuthBridge` that wires `getIdToken` into `restProxy.setAuthProvider()` on mount.
  - Updated `src/services/restProxy.js` — added `setAuthProvider(fn)` and `proxyActionWithAuth()` which injects Bearer token header. Gated functions (`fetchArchiveRange`, `fetchThreadAnalyses`, `fetchNarrativeThread`, `fetchPortalSession`, `fetchUserProfile`) use this path. Public functions unchanged.
- **Subscription system.** Stripe billing integration for member/enterprise tiers.
  - Created `src/components/Pricing.jsx` — pricing page with tier comparison and Stripe checkout links.
  - Created `src/components/Account.jsx` — shows user email, current tier, and Stripe customer portal link.
  - Created `src/components/UpgradeSuccess.jsx` — post-checkout success page.
  - Added `portal_session` action to `newsSensitiveData` — creates Stripe billing portal session for authenticated user.
  - Added `user_profile` action to `newsSensitiveData` — returns `{ tier, subscriptionStatus, email }` from `USERS_TABLE`.
- **Backend: Firebase JWT verification.** `newsSensitiveData` Lambda now verifies Firebase ID tokens via Firebase Admin SDK (`verifyIdToken`). Tier resolved from `USERS_TABLE` (DynamoDB) keyed by Firebase UID. New env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `USERS_DDB_TABLE`, `STRIPE_SECRET_KEY`, `FRONTEND_URL`.
- **WeeklyPage: Auth-gated.** Replaced `ApiKeyGate` with `useAuth()`. Unauthenticated → `WeeklyLockedPreview` (blurred mock content + CTA). Free-tier (401) → upgrade prompt. Member/enterprise → full page.
  - Created `src/components/WeeklyLockedPreview.jsx` — blurred mock cards with gradient overlay and "Get Member $15/mo" + "Sign in" CTAs.
- **Navigation.** Layout shows "Sign in" + "Upgrade" links for unauthenticated users; `user.email` → `/account` for signed-in users. Added `/pricing` to main nav.
- **Custom domain.** Production URL `https://globalperspective.net`. CORS list includes both GitHub Pages and custom domain.
- **Hook signatures changed.** `useWeeklyArchive()` and `useThreadAnalyses(threadIds)` no longer accept `apiKey` — auth handled internally via `AuthContext`. Cache keyed by `user.uid`.
- **New routes:** `/signin`, `/auth/callback`, `/pricing`, `/account`, `/upgrade/success`.

## 2026-03-14 (Thread Intelligence)
- **New Lambda: `newsThreadAnalysis`.** Daily batch Lambda that generates thread-level AI analysis for the top 15 narrative threads with 2+ entries. Reads 30 days of archives, calls xAI Grok to produce: thread title, entry short titles (6-10 word sequential narrative per entry), story arc (evolution), trajectory (prediction), and root cause chain (origins). Writes to `SUMMARIZE_PREDICT_TABLE` with key pattern `PK: THREAD#{threadId}`, `SK: THREAD_ANALYSIS`, 31-day TTL. Staleness check skips threads where entry count hasn't changed.
  - Created `amplify/backend/function/newsThreadAnalysis/src/index.js`
  - Created `amplify/backend/function/newsThreadAnalysis/src/package.json`
  - Created `amplify/backend/function/newsThreadAnalysis/newsThreadAnalysis-cloudformation-template.json`
- **Backend: `thread_analysis` action.** Added `thread_analysis` action to `newsSensitiveData` REST proxy. Tier-gated (member/enterprise). Accepts array of `threadIds` (max 20), returns map of `threadId → analysis`. Added `readThreadAnalyses()` function with parallel DynamoDB reads.
  - Updated `amplify/backend/function/newsSensitiveData/src/index.js`
- **Frontend: Thread Intelligence UI.** Thread-level AI (Story Arc / Trajectory / Root Causes) shown at the top of each thread when analysis data exists. Graceful fallback to current layout when no data.
  - Created `src/components/ThreadIntelligence.jsx` — three toggle buttons reusing existing `ai-toolbar` CSS classes
  - Created `src/components/CompactTimeline.jsx` — compact timeline with AI-generated short titles per entry, expand chevron reveals full `StoryEntryCard` with per-entry AI toolbar
  - Created `src/hooks/useThreadAnalyses.js` — fetches and caches thread analyses (localStorage, 30-min TTL)
  - Added `fetchThreadAnalyses()` to `src/services/restProxy.js`
- **WeeklyPage: Thread Intelligence integration.** StoryCard header uses AI-generated thread title when available. Expanded body shows ThreadIntelligence above MiniMap, CompactTimeline replaces flat entry list. Trending modal also uses ThreadIntelligence + CompactTimeline when analysis exists.
  - Updated `src/components/WeeklyPage.jsx`, `src/components/WeeklyPage.css`
- **WeeklyMap: Thread Intelligence integration.** ThreadDetailView shows AI-generated thread title, ThreadIntelligence above play button, CompactTimeline in sidebar. Independent `useThreadAnalyses` hook for standalone `/weekly-map` route.
  - Updated `src/components/WeeklyMap.jsx`
- **Trending section: Modal overlay.** Replaced inline trending card expansion with popup modal overlay. Fixed event bubbling bug where AI toolbar button clicks closed the expanded card.
  - Removed dead CSS: `.trending-card.selected`, `.trending-detail`
  - Added modal CSS: `.trending-modal-overlay`, `.trending-modal`
- **New CSS.** Added `.thread-intelligence`, `.compact-timeline`, `.compact-timeline-entry`, `.compact-timeline-dot`, `.compact-timeline-header`, `.compact-timeline-expanded` styles to `WeeklyPage.css`.

## 2026-03-14 (doc audit)
- **New `ARCHITECTURE.md`.** Single authoritative reference covering all 4 Lambda functions, DynamoDB schemas, frontend routes/components/hooks, API actions, deployment workflow, and key file locations. Replaces the need to read multiple split docs.
- **Updated `BACKEND_GUIDE.md`.** Fixed all xAI Grok references (replaced Gemini + OpenAI throughout), corrected env vars, added RSS feed ingestion, narrative threading, hallucination filtering, 3 new `newsSensitiveData` actions (`today`, `archive_range`, `narrative_thread`), API key tier system, `newsPostLinkedIn` Lambda documentation, and fixed CORS list.
- **Updated `DEPLOYMENT_NOTES.md`.** Fixed PowerShell copy commands → macOS `rm -rf`/`cp`; fixed OpenAI → xAI Grok reference.
- **Updated `FRONTEND_ARCHITECTURE.md`.** Removed non-existent `Sparkline.jsx`, marked AppSync as unused, corrected backend integration note.
- **Updated `onboard` skill.** Now points to single `ARCHITECTURE.md` instead of 4 separate docs; lists stale old docs to ignore.

## 2026-03-14
- **Weekly Page: Region-colored tags.** Region tags on story cards now display in distinct colors per region — Asia (amber), Europe (blue), Middle East (pink), Africa (green), Americas (purple), Oceania (orange), World (gray) — making geographic context scannable at a glance.
- **Weekly Page: Search bar.** Added a search input to the filter bar. Searches across story titles, entry titles, region names, and source names in real time. Filters both threaded stories and standalone entries within each region group.
- **Weekly Page: Clean card style.** Removed distracting colored left borders, color dots, and colored timeline dots from story cards. Cards now use a uniform neutral style matching the home page. Timeline dots default to gray. Dead code (`threadHue`, `threadColor`) removed from WeeklyPage.jsx.
- **Weekly Map: Fixed play animation.** Play button now correctly starts from the oldest available date (~1 week ago) and progressively reveals newer dates toward the present, showing story evolution over time. Fixed date range filter bug where descending sort order caused empty marker sets.
- **Weekly Map: 8 code quality fixes.** Removed dead `dateRange` filtering logic; auto-stop playback when thread is region-filtered away; added empty-state message for region filter; mobile sidebar overlay with `useIsMobile`; separated markers and lines into distinct arrays (removed `_isLine` pattern); shared `groupMarkersByCountry()` utility for dedup; `escapeHtml()` for XSS prevention in info windows; playback resume after pause.
- **Weekly Map: 6 UX features.** Date range label in header; manual prev/next stepping during playback with pause/resume; zoom-to-thread on thread click; back navigation link to `/weekly`; `MapLegend` component; `StoryPlaybackOverlay` with progress bar and country tracking.
- **Weekly Map: Thread detail sidebar.** Clicking a thread in the sidebar now shows a detail view with all entries grouped by date, AI toolbar (Summarize/Predict/Trace), and play/stop controls — matching the regular map page pattern.
- **Weekly Map: Full-Map link.** Added "Full Map →" link in Weekly Page header linking to `/weekly-map`.
- **Code deduplication.** Extracted 3 shared components used by both WeeklyPage and WeeklyMap:
  - `src/components/ApiKeyGate.jsx` — reusable API key gate with `title`/`description` props
  - `src/components/StoryEntryCard.jsx` — reusable entry card with AI toolbar (Summarize/Predict/Trace Cause)
  - `src/hooks/useIsMobile.js` — responsive breakpoint hook (default 600px)
- **WeeklyMap cleanup.** Removed inline `ApiKeyGate`, `useIsMobile`, `ThreadEntryCard` duplicates from `WeeklyMap.jsx`; replaced with shared imports. Extracted Google Maps styles to `MAP_STYLES` constant. Removed dead `.active` class from thread list items. Removed dead `.wmap-entry-*` CSS from `WeeklyMap.css`; replaced with scoped `.wmap-detail-day .story-entry-card` overrides. Removed dead `.wmap-thread-item.active` CSS.
- **WeeklyMap: 5 UX enhancements.**
  - Marker click → thread selection: clicking a single-thread marker selects it in the sidebar; multi-thread markers show an info window with clickable thread links.
  - Thread search: search input in sidebar (shown when >5 threads) filters by title or region.
  - Article count in playback: story playback overlay now shows "Day X of Y · N articles" per date.
  - URL state deep-linking: `?thread=` and `?region=` query params sync with sidebar selection for shareable links.
  - Mobile backdrop: tapping outside the sidebar panel closes it on mobile.
- **Weekly Page: Trending This Week.** New `TrendingSection` component above the filter bar shows rising/new stories with 2+ articles as horizontally scrollable cards. Includes left/right scroll arrows (hidden on mobile), scroll-snap, and a detail panel below that opens on card click showing full thread entries with MiniMap and AI toolbar. Cards show truncated summary preview; selecting a card expands it with interactive `StoryEntryCard` (Summarize/Predict/Trace Cause toggle buttons). Limits to 10 trending cards.
- **Dead CSS cleanup.** Removed unused `.trending-card-ai`, `.trending-card-ai.prediction`, `.trending-card-ai.trace`, `.trending-card-ai-label` styles from `WeeklyPage.css`.
- Updated `WeeklyPage.jsx`, `WeeklyPage.css`, `WeeklyMap.jsx`, `WeeklyMap.css`.

## 2026-03-09 (commit 5)
- **Backend: Phase 1 Narrative Threading — complete.** Topics now carry a stable `threadId` across days so analysts can trace how a story evolved.
- **newsInvokeGemini:** Added `readPastArchiveTitles(7)` — reads past 7 `archive#YYYY-MM-DD` items at clustering time. Added `NARRATIVE CONTINUITY` block to Grok prompt so it can detect story continuations and emit `continues_topic`. Field captured in normalized output and written to staging.
- **NewsProjectInvokeAgentLambda:** Added `readPastArchiveEntries(7)`, Jaccard similarity (`computeJaccardScore` — 0.5×keyword + 0.3×region + 0.2×category, threshold 0.4), and `assignThreadId()` (checks `continues_topic` → Jaccard → new `thread-{slug}-{hash}`). `threadId` and `search_keywords` now written into every archive entry.
- **newsSensitiveData:** Added `narrative_thread` action — member/enterprise key required. Accepts `threadId`, scans past 7 or 30 days of archives, returns matching entries sorted chronologically.
- Updated `docs/ENTERPRISE_WEEKLY_ANALYSIS.md` — Phase 1 fully marked complete.

## 2026-03-09 (commit 4)
- **Backend Bug Fix: Archive TTL:** `DAILY_ARCHIVE_TTL_DAYS` changed from 7 to 31 in `NewsProjectInvokeAgentLambda/src/index.js`. Enterprise users can now retrieve up to 30 days of archive history as intended by the tier model.
- **Backend Bug Fix: OPENAI_MODEL undefined:** `invokeGrok()` return on line 336 referenced undefined `OPENAI_MODEL` — corrected to `GROK_MODEL`. `modelId` field in cached AI items now correctly records the model name.
- Updated `docs/ENTERPRISE_WEEKLY_ANALYSIS.md` implementation status tracker.

## 2026-03-09 (commit 3)
- **Map: Resizable Side Panel:** The map side panel can now be resized by dragging the left edge. Width is constrained between 280px and 640px and persisted in localStorage across sessions.
- **Map: Archive Cards Fix:** Archive topic cards no longer pre-show AI result cards on load. Summary/Prediction/Trace content is hydrated from pre-baked data on first button click, keeping the card clean by default.
- **Map: Collapsible Legend:** "Topic Categories" legend now collapses to a compact pill (4 color dots + "Legend ▼") by default. Click to expand/collapse, preventing it from blocking map content.
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `WorldMap.css`.

## 2026-03-09 (commit 2)
- **Map: AI Toolbar Redesign:** Refactored `MapSidePanel.jsx` AI buttons to reuse shared `AIComponents.css` glass-pill classes instead of duplicate map-specific styles. Added compact overrides (`.map-ai-toolbar-compact`) in `WorldMap.css`. Sources toggle moved to a footer row alongside Google News link. "Related Countries" promoted into the toolbar as a 4th pill button.
- **Repo: Gitignore Zips:** Added `amplify/**/*.zip` to `.gitignore` to exclude Lambda deploy artifacts.
- **Repo: Added docs and planning files:** Committed `BACKEND_GUIDE.md`, `ENTERPRISE_WEEKLY_ANALYSIS.md` and other architecture/planning docs in `docs/`, marketing and blog content, Claude skills in `.claude/skills/`, `.agents/` context, and new Lambda stubs (`linkedInAutoPost`, `newsPostDevTo`, `newsPostLinkedIn`).
- Updated `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx`, `WorldMap.css`.

## 2026-03-09
- **Map: Related Countries Highlight:** Replaced "Story Flow" feature (which dimmed/zoomed map) with a new "Related Countries" highlight. Clicking ▶ Related Countries on any topic card (including archive) now shows yellow translucent circular markers on affected countries. Markers are pixel-sized (zoom-independent) so they stay consistent at all zoom levels. Feature stays active until user explicitly clicks "Hide Related" or the banner "✕ Clear" — clicking the map background no longer exits the mode.
- **Map: Renamed Story Flow → Related Countries:** Button label changed from "▶ Story Flow" / "Clear Story" to "▶ Related Countries" / "Hide Related". Banner now reads "Related: [topic title]".
- **Map: Archive Topics Get Related Countries Button:** Archive topic cards now also show the "▶ Related Countries" button (previously hidden for archive topics).
- **Map: Archive Button Color:** The Related Countries button on archive cards uses a muted slate color (#94a3b8) instead of bold black, consistent with the lighter archive card styling.
- **Map: Connection Line Click No Longer Forces Panel:** Clicking a connection line between countries no longer forces the side panel to jump to a specific country. Story flow activates without hijacking the panel.
- **Backend: Enterprise Archive Range:** Added `archive_range` endpoint to `newsSensitiveData` Lambda for fetching multi-day topic history. Tier-gated: member keys get 7 days, enterprise keys get 30 days. Today's data served from `latest`, past days from `archive#YYYY-MM-DD` DynamoDB items.
- **Backend: Daily Archive Write:** `NewsProjectInvokeAgentLambda` now writes a second archive item per pipeline run (`archive#YYYY-MM-DD` with 7-day TTL, 10 sources) in addition to the existing `today-archive` (24h TTL, 3 sources). Enables weekly/monthly analysis for enterprise tier.
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `WorldMap.css`, `NewsProjectInvokeAgentLambda/src/index.js`, `newsSensitiveData/src/index.js`.

## 2026-03-07
- **Error Handling UX:** Added ErrorModal system with user-friendly error messages instead of raw console errors. Shows friendly messages for 503/cache miss/network errors.
- **Stale Data Banner:** When backend returns stale 503, topics now display with a visible amber warning banner ("Topics are being refreshed. Showing latest available data.") with a Refresh button, replacing the subtle inline orange text.
- **503 Stale Data Fix:** Updated restProxy.js to return stale topics when backend returns 503 instead of throwing an error, so users can see content while new data generates.
- **AI Error Modal Integration:** AI feature errors (summary/prediction/trace cause) now show in the ErrorModal with friendly messages instead of only appearing in browser console.
- Created `global-perspectives-starter/frontend/src/contexts/ErrorContext.jsx` — global error state management.
- Created `global-perspectives-starter/frontend/src/components/ErrorModal.jsx` — user-friendly error modal.
- Updated `global-perspectives-starter/frontend/src/App.jsx` — wrapped with ErrorProvider.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` — amber stale banner, showError in catch blocks, removed redundant inline error div.
- Updated `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx` — added showError to TopicCard error handlers.
- Updated `global-perspectives-starter/frontend/src/services/restProxy.js` — returns stale data on 503 instead of throwing.

## 2026-03-03
- **Map: Clickable Info Window Topics:** Clicking a country dot on the map now shows individual clickable topic rows (with hover highlight) instead of plain text + a "View details" button. Clicking a topic directly opens the side panel and auto-fetches its AI summary.
- **Map: Clickable Topic Cards:** Clicking anywhere on a topic card in the map side panel now triggers the Summarize action (toggles it open/closed). Buttons, links, and AI result areas still work independently via event filtering.
- **Map: Auto-scroll to Selected Topic:** When a topic is selected (from info window or story flow), the side panel scrolls to that card and auto-loads its summary.
- **Backend: Archive 400KB Fix:** The `today-archive` DynamoDB item was exceeding the 400KB per-item limit after 24h of accumulation. Fixed by capping the archive at 50 entries and trimming AI content fields to 1500 characters each in `NewsProjectInvokeAgentLambda`.
- **Bug Fix: Stale 503 Error:** Traced stale error to `newsInvokeGemini` writing topics to `id=staging` while `newsSensitiveData` proxy was reading from `id=latest` (different default keys). The staging→latest promotion is handled by `NewsProjectInvokeAgentLambda` — confirmed pipeline is healthy and running every 2 hours. Also aligned proxy default key to `staging` as defensive fallback.
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `NewsProjectInvokeAgentLambda/src/index.js`, `newsSensitiveData/src/index.js`.

## 2026-02-28 (2)
- **Map: Archive Topics Overlay:** Archive (past) topics now appear on the world map alongside current topics. Archive-only countries show smaller muted-color dots; archive connections render as dashed grey lines. Helps users see "what happened earlier" vs "what's happening now" at a glance.
- **Map: Archive Sidebar:** The same "Today's Archive" slide-out sidebar from the home page is now available on the map page — with search and category filters.
- **Map: Story Flow Marker Highlight:** When a story is selected, affected country dots now visually pop (larger scale + thick white ring) instead of just staying at full opacity. Unrelated dots fade to 20% opacity. Clearer selected state.
- **Map Side Panel: Archive Section:** When opening a country that has both current and archive topics, the panel shows current topics first, then an "Earlier today" divider, followed by archive topic cards with pre-loaded AI analysis (no extra API call needed).
- Updated `WorldMap.jsx`, `MapSidePanel.jsx`, `WorldMap.css`.

## 2026-02-28
- **World Map Upgrade (Features 1, 2, 7, 9):** Completely rewrote the map page to show meaningful geopolitical connections instead of article counts. Countries are now colored by their dominant news category (conflict, economy, politics, etc.), geodesic spider-web lines connect countries that share topics, clicking a country opens a slide-in side panel with full topic details, and selecting a topic triggers Story Flow mode (dims unrelated lines, auto-zooms to affected countries). The map now reflects how news events link nations rather than raw article volume.
- **AI Analysis in Map Side Panel:** Added Summarize, Predict, and Trace Cause AI buttons to each topic card in the map side panel — same AI features available on the home page, now accessible directly from the map.
- Rewrote `global-perspectives-starter/frontend/src/components/WorldMap.jsx` with new `buildMapData()` data model, Google Maps Polyline spider-web connections, topic-based markers, and Story Flow highlight logic.
- Created `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx` — slide-in panel with topic cards, AI toolbar, sources, and story flow trigger.
- Created `global-perspectives-starter/frontend/src/components/WorldMap.css` — extracted and expanded map styles including side panel, AI toolbar, and mobile bottom-sheet responsive layout.
- Removed map CSS from `global-perspectives-starter/frontend/src/index.css` (moved to WorldMap.css).
- Added `window.GOOGLE_MAPS_API_KEY` to `docs/config.js` (API key no longer hardcoded in source).

## 2026-02-23
- **Archive Sidebar Timestamp:** Updated "Today's Archive" sidebar to show when each topic entered the database with a clearer label. Time display now reads "Showed Xh ago" / "Showed Xm ago" / "Showed just now" instead of a bare compact time, making it explicit that the timestamp reflects when the topic was captured by the pipeline.
- Updated `global-perspectives-starter/frontend/src/components/TodayArchiveSidebar.jsx`.

## 2026-02-06

### LinkedIn Auto-Posting Feature
- **New Lambda Function:** Created `newsPostLinkedIn` Lambda to automatically post new Global Perspectives topics to LinkedIn with AI-generated summaries and chain reaction predictions.
- **Smart Deduplication:** Implemented title fingerprinting (position-independent slugified titles) to detect and skip already-posted topics. Tracks posted topics in DynamoDB with 30-day TTL for automatic cleanup.
- **Rate Limiting:** Configured conservative posting limits (5 posts per run, 100 posts per day) to avoid LinkedIn spam filters. EventBridge schedule triggers every 3 hours (cron: 15 */3 * * ? *).
- **Intelligent Content Formatting:** Posts include category label, full summary, chain reaction prediction, site link, and regional hashtags. Smart truncation at sentence boundaries (3000 char limit). Strips markdown and removes "Watchlist Signals" sections for clean LinkedIn formatting.
- **Post Priority:** Automatically sorts new topics by significance (high → medium → low) and posts highest-priority topics first.
- **LinkedIn API Integration:** Uses LinkedIn Posts API v2 with version 202601. OAuth 2.0 authentication with access token and person ID stored in Lambda environment variables.
- **DynamoDB Table:** Created `NewsProject-linkedin-posts` table with PK key for tracking posted topic fingerprints and 30-day TTL enabled.
- Created `amplify/backend/function/newsPostLinkedIn/src/index.js` with main handler, title fingerprinting, DynamoDB deduplication logic, LinkedIn API posting, markdown stripping, smart truncation, and rate limiting.
- Created `amplify/backend/function/newsPostLinkedIn/src/package.json` with dependencies (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb).
- Created `amplify/backend/function/newsPostLinkedIn/src/event.json` with test event structure.
- Configured environment variables: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID, LINKEDIN_POSTS_TABLE, MAX_POSTS_PER_RUN, MAX_POSTS_PER_DAY, SITE_URL.

### Buy Me a Coffee Support Banner
- **New Feature:** Added donation banner to homepage to help sustain ad-free operation. Banner appears below page header with message "We run ad-free. Help us keep it that way" and yellow "Buy Me a Coffee" button.
- **Non-Intrusive Design:** Subtle light gray background (#fafafa), minimal border, centered layout with max-width 600px for balanced prominence without disrupting content flow.
- **Design Consistency:** Matches existing design system with border-radius 8px, responsive spacing, and inline styling for maintainability.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with support banner component linking to buymeacoffee.com/BenBen990505 (inserted at line 367, above topic list).
- Built and deployed to production: updated `docs/index.html` and `docs/assets/index-DogKfCuV.js`.

## 2026-01-28

### Kickstarter Campaign Banner
- **New Feature:** Added dismissible Kickstarter banner at the top of all pages to promote the mobile app funding campaign.
- **Banner Design:** Green gradient banner with direct messaging ("Support Mobile App on Kickstarter"), "View Campaign" button, and close (✕) button.
- **Persistence:** Banner dismissal is stored in localStorage so users who close it won't see it again.
- **Mobile Responsive:** Banner adjusts layout for smaller screens with stacked content.
- **Placement:** Appears above the navigation header on all pages via Layout component.
- Created `global-perspectives-starter/frontend/src/components/KickstarterBanner.jsx` with dismissible banner logic and Kickstarter link.
- Created `global-perspectives-starter/frontend/src/components/KickstarterBanner.css` with green gradient styling and responsive adjustments.
- Updated `global-perspectives-starter/frontend/src/components/Layout.jsx` to import and render KickstarterBanner at the top of the page.

## 2026-01-27

### Increase Frontend Topic Limit
- **Topic Limit Increase:** Changed frontend to request up to 13 topics from the backend instead of hardcoded 10.
- Updated `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js` to change `getGeminiTopics(10)` to `getGeminiTopics(13)` in both the initial load (line 43) and background polling (line 82).

## 2026-01-25

### Floating Topic Navigation Panel
- **New Feature:** Added floating navigation panel on the right side of the screen (desktop only) that shows all topic titles with region badges. Helps users orient themselves while scrolling and provides quick jump navigation to any topic.
- **Smart Scroll Tracking:** Implemented Intersection Observer API to automatically highlight the currently visible topic as users scroll through the page. Active topic is highlighted with blue accent and bold text.
- **Region Badges:** Each topic displays its region with neutral gray badges (Asia, Europe, Americas, MENA, Global) for easy identification without color distraction.
- **Collapsible Design:** Navigation panel can be collapsed to a compact header by clicking the toggle arrow, preserving screen space when not needed.
- **Smooth Jump Navigation:** Click any topic in the navigation to smoothly scroll to that topic in the main content area.
- **Desktop Only:** Panel automatically hides on screens ≤1200px to preserve mobile/tablet screen space. Mobile users scroll naturally.
- **Ordering Fix:** Navigation panel now displays topics in the exact same order as the main page (grouped by region) instead of original array order. Fixed by iterating through `categorizedTopics` entries to match Home.jsx rendering order.
- Created `global-perspectives-starter/frontend/src/components/TopicNav.jsx` with Intersection Observer scroll tracking, click-to-jump navigation, region badge logic, and collapsible UI state management.
- Created `global-perspectives-starter/frontend/src/components/TopicNav.css` with floating panel styling, scrollbar customization, active state highlighting, and neutral gray badge styling.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` to import TopicNav component, add `id` attributes to topic elements for scroll tracking, and render TopicNav with topics and categorizedTopics props.

## 2026-01-24

### Restore Article Sources Display with Helper Text
- **Sources Feature Restoration:** Re-added the expandable article sources display that was removed on Jan 22. Users can now click "Sources (N)" button to view direct links to actual news articles fetched by Brave Search API, instead of only having a Google News search link.
- **Desktop Layout:** Added "Sources (N)" toggle button next to "View Sources ↗" link on the right side. Button shows article count and chevron (▲/▼) to indicate expand/collapse state. AI button toolbar layout remains unchanged (Summarize, Predict, Trace Cause in horizontal pill-shaped toolbar on left).
- **Mobile Layout:** Added full-width "Sources (N)" toggle button below "View Sources ↗" link. Mobile dropdown "Actions" button layout remains unchanged.
- **Helper Text:** Re-added italic gray helper text below source buttons: "Note: Very recent news may take time to appear in search results"
- **Expandable Sources Card:** When toggled, displays "📰 Article Sources" card with scrollable list (max-height: 300px) of articles showing title (clickable), source name, and age (e.g., "reuters.com • 2 hours ago"). Card includes "Real-time News Sources" footer with close button.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with `sourcesExpanded` state, `toggleSourcesExpanded` function, sources toggle buttons in both desktop (lines 463-506) and mobile (lines 560-606) layouts, and expandable sources card display (lines 609-671).

## 2026-01-22

### Simplify Homepage Layout - Restore Original Clean Design
- **Layout Simplification:** Removed expandable sources list feature and helper text to restore the cleaner, simpler layout from before Jan 20. Both desktop and mobile now show just AI action buttons (Summarize, Predict, Trace Cause) plus a single "View Sources ↗" link that opens Google News search.
- **Desktop Layout:** AI buttons in pill-shaped toolbar on left, "View Sources ↗" link on right, space-between layout. Removed "Sources (N)" expandable button and helper text note.
- **Mobile Layout:** Dropdown "Actions" button containing all three AI actions, plus "View Sources ↗" link below. Maintains separate container from desktop to prevent style conflicts.
- **Code Cleanup:** Removed unused `sourcesExpanded` state, `toggleSourcesExpanded` function, and entire expandable sources display section. Simplified JSX structure while preserving separate desktop/mobile layout containers added on Jan 20.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` to simplify both desktop (lines 424-473) and mobile (lines 475-537) layout containers, removing sources expansion functionality and helper text.

## 2026-01-20

### Separate Desktop/Mobile Layout Implementation
- **Architecture Refactoring:** Implemented completely separate layout containers to eliminate CSS conflicts between desktop and mobile views. Created `.topic-actions-desktop` and `.topic-actions-mobile` containers that are independently controlled via CSS media queries, preventing cross-contamination of styles.
- **Desktop Layout Container:** `.topic-actions-desktop` shows only on screens >768px with horizontal flexbox layout, preserving original desktop button arrangement with "Summarize", "Predict", "Trace Cause" buttons on left and source links on right using `justify-content: space-between`.
- **Mobile Layout Container:** `.topic-actions-mobile` shows only on screens ≤768px with vertical layout, featuring full-width "Actions" dropdown and vertically-stacked source links below. Mobile container completely independent from desktop styles.
- **CSS Media Query Strategy:** Desktop layout: `display: flex` by default, `display: none !important` on mobile. Mobile layout: `display: none` by default, `display: block !important` on mobile. This ensures zero visual interference between layouts.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` by replacing shared container with separate `.topic-actions-desktop` and `.topic-actions-mobile` containers (lines 424-611), each with their own AI toolbar and source links structure.
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with new layout container styles (lines 702-783), replacing previous shared container approach with completely independent desktop/mobile styling systems.

### Previous Changes (Earlier today)
- **Mobile UI Enhancement - Dropdown Actions:** Fixed mobile button UI issues by implementing a responsive dropdown pattern. Desktop maintains original circular buttons ("Summarize", "Predict", "Trace Cause"), while mobile (≤768px) shows a single "Actions" dropdown with all three options. Mobile dropdown features proper touch targets (44px minimum), loading spinners, completion checkmarks (✓), click-outside-to-close, and smooth animations. Eliminates text overflow and distorted circular shapes on iPhone.
- **Mobile Layout Improvements:** Enhanced mobile layout with proper spacing and alignment. Actions dropdown now spans full width with larger padding (16px), source links properly stack below on mobile with improved touch targets. Fixed layout conflicts between toolbar and source links that caused alignment issues.
- **Desktop Layout Restoration:** Fixed desktop layout regression by wrapping layout styles in `@media (min-width: 769px)` query and restoring original inline flexbox styles. Desktop now maintains exact original horizontal layout with buttons on left and source links on right, while mobile keeps vertical stacking layout.
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with mobile dropdown styles (lines 119-226), responsive display logic (lines 574-583), mobile layout improvements (lines 697-733), and desktop-specific layout preservation (lines 220-234).
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with mobile dropdown state management, action handlers, click-outside event listener, and improved container structure.

## 2026-01-09
- **Timeline Visualization Enhancement:** Replaced plain text timeline with vertical timeline visualization featuring black dots, gray connecting lines, date badges, and event cards with hover effects. Event titles are color-coded by stage: blue (starting events), orange (evolving events), red (result events). Uses hybrid keyword + position detection for intelligent color assignment.
- **Timeline Parsing Fix:** Improved date detection to handle bullet points (`- 2020:`), prose format (`In 2020, something happened`), and dates anywhere in line (not just at start). Added fallback to plain markdown rendering if no dates detected. Strips leading prepositions and separators for cleaner titles.
- **Impact Breakdown Visualization:** Replaced vague numeric scores (9/10) with visual bar chart showing real-world impact. Displays three categories (People 👥, Economy 💰, Regional 🌍) with colored bars (red=High, orange=Moderate, blue=Low) and plain-language explanations extracted from AI response. Removes `**` markdown artifacts for clean display. Filters out duplicate Impact Score text from tab content.
- **Stricter Verdict Classification:** Implemented hybrid scoring system to prevent "True Signal" inflation. True Signal requires: (1) Average impact score ≥8, (2) At least 2 categories ≥8, (3) Global keywords in explanations ("global", "war", "pandemic", "supply chain", etc.). Worth Watching requires moderate scores (≥5) or regional keywords ("regional", "tensions", "spillover"). Everything else classified as Noise.
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with timeline styles (lines 319-448) and impact breakdown styles (lines 450-568): impact-breakdown-container, impact-bar-fill with color classes, responsive mobile layout.
- Updated `global-perspectives-starter/frontend/src/components/TraceCauseDisplay.jsx` with parseTimelineEvents() for date extraction, impactBreakdown parsing to extract Human Impact/Economic Reach/Geopolitical Stability scores and explanations, renderImpactBreakdown() to display visual bars, and hybrid verdict calculation logic (lines 168-217).

## 2026-01-08
- **UI Enhancement - Design System:** Added 60+ CSS variables for spacing (8px scale), typography (6 sizes), colors, shadows, and transitions. Replaces hardcoded values with maintainable design tokens across the application. Variables include `--space-xs` through `--space-3xl` (4px-32px), `--font-size-xs` through `--font-size-xl` (11px-16px), `--radius-sm` through `--radius-full`, shadow scales, and transition timings.
- **UI Enhancement - Chain Reaction Flow:** Replaced simple arrow visualization with numbered step cards (① ② ③) featuring violet left borders, hover effects (translateX + shadow), and gradient arrow connectors with downward chevrons. Makes prediction chain steps visually distinct and scannable. Single-step chains display as simplified cards without numbers.
- **UI Enhancement - Mobile Responsiveness:** Added comprehensive media queries for mobile devices (≤768px, ≤480px breakpoints). Tabs now stack vertically on mobile with full-width layout, left border indicators for active state, and 44px minimum touch targets for WCAG 2.1 compliance. Removed inline width/flex styles that blocked CSS media query control.
- Updated `global-perspectives-starter/frontend/src/index.css` with global CSS variables (lines 20-85).
- Updated `global-perspectives-starter/frontend/src/components/AIComponents.css` with accent color variants, chain reaction styles (lines 218-317), and mobile media queries (lines 318-398).
- Updated `global-perspectives-starter/frontend/src/components/PredictionDisplay.jsx` with card-based chain rendering logic (lines 94-130) and removed inline tab styles (lines 183-200).
- Updated `global-perspectives-starter/frontend/src/components/TraceCauseDisplay.jsx` by removing inline tab styles (lines 317-334).

## 2026-01-07
- **Map Country Flags (Complete):** Added country flag emojis to all map UI elements for consistent visual recognition. Flags now appear in: (1) Info window popup when clicking markers, (2) Article list modal when clicking "View all X articles", and (3) Fallback SVG map info panel. All display country flags (🇺🇸, 🇫🇷, 🇯🇵, etc.) with 🌍 globe fallback for unknown countries.
- Updated `global-perspectives-starter/frontend/src/components/WorldMap.jsx` with shared `getFlagEmoji()` utility function and flag display in all three UI contexts.
- **Trace Cause UI Enhancement:** Replaced numeric "Impact: X/10" badge with qualitative Verdict Banner. Now displays AI classification (True Signal 🔴 / Worth Watching 🟠 / Noise 🟢) with 1-sentence explanation above tabs. Provides clearer, more meaningful insights than arbitrary scores.
- Updated `global-perspectives-starter/frontend/src/components/TraceCauseDisplay.jsx` with verdict parsing logic, helper functions, and banner UI component.

## 2025-12-23
- Cache resilience: Serve stale topics with `stale: true` instead of 503 in `amplify/backend/function/newsSensitiveData/src/index.js`.
- Topics hook: Track `isStale`, `updatedAt`, `hasNewData`, store updatedAt in cache, and add background polling in `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js`.
- Home UI: Display freshness timestamp and "New topics available" banner in `global-perspectives-starter/frontend/src/components/Home.jsx`.
- Client: Pass through `stale` from the proxy response in `global-perspectives-starter/frontend/src/utils/graphqlService.js`.
- Docs: Added cache refresh plan in `continue-news.md`.
- Tooling: Bumped Vite to `^7.3.0` and refreshed lockfile in `global-perspectives-starter/frontend/package.json` and `global-perspectives-starter/frontend/package-lock.json`.

## 2025-11-02
- Regional Categorization: Implemented intelligent topic organization by region (Asia, Africa, North America, Europe, Middle East, South America, World). Topics are automatically categorized based on country/region keywords and displayed in separate cards with regional headers and topic counts.
- Increased Topic Limit: Expanded from 7 to 10 topics to provide broader global coverage across all regions.
- Enhanced UI Design: Added regional section headers with visual separators, topic counts, and improved spacing. All existing AI features (summarize, predict) now work within each regional section.
- Updated `global-perspectives-starter/frontend/src/components/Home.jsx` with categorization utility function.
- Modified `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js` to request 10 topics instead of 7.

## 2025-11-01
- Responsive Header: Added dropdown navigation for mobile devices (≤768px). Header height now remains fixed with dropdown expanding below brand text. Includes click-outside functionality and smooth animations. Updated `global-perspectives-starter/frontend/src/components/Layout.jsx` and `global-perspectives-starter/frontend/src/index.css`.

## 2025-10-11
- Sources Link: Use exact homepage title for Google News queries; removed title shortening and keyword augmentation. Updated `global-perspectives-starter/frontend/src/components/Home.jsx`.
- Credentials: Removed OpenAI key from env examples; marked Gemini key optional; updated proxy/docs to treat OpenAI integration as optional.

## 2025-10-09
- Security: Restored direct Amplify AppSync configuration; removed Vite env usage for AppSync.
- Configuration: Added root `.gitignore` to exclude `.env` files; committed sanitized `.env.example` and `frontend/.env.example`.
- Search UX: Shortened topic titles for Google News queries; added location hints; kept 24-hour window.
- Consistency: Unified Home and Map “View sources →” link logic to use the same query builder.
- UI: Removed article list under the map.

## Setup Notes
- AppSync configuration is read from the bundled Amplify config. No `frontend/.env` is required for AppSync.
- Use `.env` at repo root only for backend service keys if needed; do not commit real keys.
