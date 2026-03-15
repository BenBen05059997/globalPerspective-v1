# Global Perspectives — Change Log

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
