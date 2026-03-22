# Frontend Architecture Documentation

## Overview

This is a modern React application focused on AI-powered global news aggregation with sophisticated caching, geographic visualization, and premium UI design. The application provides AI-generated insights (summaries, predictions, root cause analysis) on global news topics, organized geographically and visualized on an interactive map.

## Technology Stack

- **Framework:** React 19.1.1
- **Build Tool:** Vite 7.3.0
- **Routing:** React Router DOM v6.30.1
- **Backend Integration:** AWS API Gateway REST + Lambda (AppSync/GraphQL files exist but are unused)
- **Mapping:** Google Maps API (via @googlemaps/react-wrapper)
- **State Management:** React hooks (useState, useEffect)
- **Styling:** Custom CSS with CSS variables

## Project Structure

```
frontend/
├── src/
│   ├── components/              # React components
│   │   ├── Layout.jsx           # Navigation shell (auth-aware: sign in / user email)
│   │   ├── Home.jsx             # Main topics page
│   │   ├── WorldMap.jsx         # Interactive map (daily)
│   │   ├── MapSidePanel.jsx     # Map side panel with topic cards
│   │   ├── TodayArchiveSidebar.jsx # Sidebar showing today's archived topics
│   │   ├── ArchiveTopicModal.jsx # Modal for archived topic detail + AI outputs
│   │   ├── ArticleCard.jsx      # Individual article card with summary/prediction
│   │   ├── TopicNav.jsx         # Horizontal topic navigation carousel
│   │   ├── CountryGrouping.jsx  # Groups articles by country for geographic display
│   │   ├── PerspectiveComparison.jsx # Side-by-side article comparison by region
│   │   ├── LoadingStates.jsx    # Skeleton loaders for cards and content
│   │   ├── KickstarterBanner.jsx # Fundraising/promo banner
│   │   ├── WeeklyPage.jsx       # Weekly analysis page (list + embedded map)
│   │   ├── WeeklyMap.jsx        # Full-page weekly map with playback
│   │   ├── StoryEntryCard.jsx   # Shared entry card with AI toolbar toggle
│   │   ├── ThreadPage.jsx       # Single thread deep-dive with AI intelligence
│   │   ├── ThreadIntelligence.jsx # Thread-level AI toggle (Story Arc/Trajectory/Root Causes)
│   │   ├── CompactTimeline.jsx  # Compact timeline with short titles + expand
│   │   ├── TrendBadge.jsx       # Rising/Stable/Fading/New trend pill
│   │   ├── MiniMap.jsx          # Small SVG map showing story footprint
│   │   ├── CountryListPage.jsx  # Country index: overview map, risk-sorted cards, search, sort, filters
│   │   ├── CountryPage.jsx      # Structured briefing: BLUF, key developments, timeline, sidebar nav
│   │   ├── CountryOverviewMap.jsx # Risk-colored dot map for country list (no lines, hover tooltips)
│   │   ├── BackgroundTimeline.jsx # Vertical day-grouped timeline with category dots and article linking
│   │   ├── SideNav.jsx          # Reusable floating sidebar nav with scroll-spy (desktop only, right side)
│   │   ├── SectionNav.jsx       # Sticky horizontal pill bar with scroll-spy (mobile fallback)
│   │   ├── ApiKeyGate.jsx       # Reusable auth prompt (legacy — being replaced by Firebase auth)
│   │   ├── ErrorModal.jsx       # User-friendly error modal
│   │   ├── SignIn.jsx           # Email magic link sign-in form
│   │   ├── AuthCallback.jsx     # Completes Firebase email link auth
│   │   ├── Pricing.jsx          # Tier comparison + Paddle checkout
│   │   ├── Account.jsx          # User profile, tier, Paddle customer portal
│   │   ├── UpgradeSuccess.jsx   # Post-checkout success page
│   │   ├── WhitepaperPage.jsx   # Full white paper as styled React page (/whitepaper, public)
│   │   ├── TrialBanner.jsx      # Trial countdown banner for trial-tier users
│   │   ├── SummaryDisplay.jsx   # Renders AI summary content
│   │   ├── PredictionDisplay.jsx # Renders AI prediction content
│   │   ├── TraceCauseDisplay.jsx # Renders AI trace cause content
│   │   ├── PrivacyTerms.jsx     # Privacy policy & terms
│   │   ├── AboutContact.jsx     # About page
│   │   ├── Contact.jsx          # Contact form
│   │   └── Disclosures.jsx      # Data source disclosures
│   ├── hooks/                   # Custom React hooks
│   │   ├── useGeminiTopics.js        # Daily topic fetching (LocalStorage 1hr TTL)
│   │   ├── useArticles.js            # Article fetching for Home/Map via search API
│   │   ├── useTodayArchive.js        # Today's topic archive (`today` action)
│   │   ├── useWeeklyArchive.js       # Weekly archive, auth-gated via AuthContext, 30min cache
│   │   ├── useThreadAnalyses.js      # Thread-level AI analyses, auth-gated, 30min cache
│   │   ├── useCountryIntelligence.js # Country-level AI intelligence, auth-gated, 30min cache
│   │   ├── useIsMobile.js            # Responsive breakpoint hook (default 600px)
│   │   ├── useSummary.js             # Fetch cached summary by topicId
│   │   ├── usePrediction.js          # Fetch cached prediction by topicId
│   │   ├── useTraceCause.js          # Fetch cached trace cause by topicId
│   │   └── useUserProfile.js         # Fetch user tier/trial status, auth-gated via AuthContext
│   ├── services/                # API integration layers
│   │   ├── restProxy.js         # REST API proxy (auth-aware, JWT injection)
│   │   └── appsyncProxy.js      # GraphQL proxy (unused — all traffic via restProxy)
│   ├── utils/                   # Utility functions
│   │   ├── countryMapping.js    # Country name ↔ ISO code, region assignment
│   │   ├── dateUtils.js         # Date formatting helpers
│   │   ├── mapConstants.js      # COUNTRY_COORDINATES, CONTINENT_PATHS
│   │   ├── geocoding.js         # Geocoding helpers
│   │   ├── graphqlService.js    # GraphQL wrapper (unused)
│   │   └── api.js               # Generic API utility (deprecated)
│   ├── contexts/
│   │   ├── AuthContext.jsx      # Firebase Auth provider + useAuth() hook
│   │   └── ErrorContext.jsx     # Global error state
│   ├── main.jsx                 # Application entry point
│   ├── App.jsx                  # Root component with routing (17 routes)
│   ├── bootstrapProxy.js        # REST API bootstrap/config loader
│   └── index.css                # Global styles
├── public/                      # Static assets
│   └── config.js               # Runtime config (SENSITIVE_PROXY_ENDPOINT, FIREBASE_CONFIG, GOOGLE_MAPS_API_KEY)
├── index.html                   # HTML template
└── vite.config.js               # Vite configuration
```

## Application Routes

The application uses React Router with dynamic basename resolution for GitHub Pages deployment.

Routes marked **[Gate]** show a "Under Construction" page in production unless `?preview=1` is in the URL (persists via sessionStorage) or the app is running on localhost.

| Path | Component | Gate |
|------|-----------|------|
| `/` | Home | Public |
| `/map` | WorldMap | Public |
| `/about` | AboutContact | Public |
| `/contact` | Contact | Public |
| `/privacy` | PrivacyTerms | Public |
| `/disclosures` | Disclosures | Public |
| `/weekly` | WeeklyPage | Gate |
| `/weekly/thread/:threadId` | ThreadPage | Gate |
| `/weekly/countries` | CountryListPage | Gate |
| `/weekly/country/:countryName` | CountryPage | Gate |
| `/weekly-map` | WeeklyMap | Gate |
| `/signin` | SignIn | Gate |
| `/auth/callback` | AuthCallback | Gate |
| `/pricing` | Pricing | Public |
| `/account` | Account | Gate |
| `/upgrade/success` | UpgradeSuccess | Gate |
| `/whitepaper` | WhitepaperPage | Public |

## Core Features

### 1. Daily Global Topics
- AI-curated news topics from multiple sources
- Organized by geographic region (Asia, Africa, North America, Europe, Middle East, South America, World)
- Auto-refresh with staleness detection
- Background polling every 10 minutes

### 2. AI Analysis Features
Each topic provides three AI-powered analysis options:

- **Summarize:** AI-generated key takeaways in bullet-point format
- **Predict:** Future impact predictions and implications
- **Trace Cause:** Root cause analysis of the topic

### 3. Interactive World Map
- Geographic visualization of geopolitical news connections
- Color-coded markers by dominant topic category (conflict, economy, politics, technology, health, disaster)
- Geodesic polylines connecting countries that share a topic (spider-web of news links)
- Archive-only countries shown as smaller muted dots; archive connections as dashed lines
- Slide-in side panel per country with current + archive topic cards, AI toolbar (Summarize/Predict/Trace Cause)
- **Related Countries:** Clicking "▶ Related Countries" on any topic highlights affected countries with yellow translucent pixel-scale circle markers (zoom-independent). Active until user clicks "Hide Related" or the banner clear button.
- Fallback SVG map when Google Maps API is unavailable

### 4. Weekly Narrative Analysis (Member/Enterprise)

Multi-day story tracking that groups topics by narrative thread (`threadId`), showing how stories evolve across days and geographies. Gated behind Firebase Auth + tier check (member = 7 days, enterprise = 30 days). Routes are additionally protected by a `<Gate>` component that shows "Under Construction" in production unless `?preview=1` is in the URL.

#### WeeklyPage (`/weekly`)

Main weekly view with two modes: **List** and **Map** (embedded WeeklyMap).

**Data Flow:**
```
1. User signs in via Firebase magic link
   ↓
2. useWeeklyArchive() fetches archive_range (7 or 30 days) with Firebase JWT
   ↓
3. groupByThread() clusters entries by threadId
   ↓
4. Stories displayed in region-grouped, expandable cards with timeline
```

**Sub-components inside WeeklyPage:**

- **TrendingSection** — Horizontal scrollable cards of rising/new stories (2+ articles). Cards show trend badge, article count, region tags, and truncated AI summary. Clicking a card opens a **modal overlay** with full thread detail (MiniMap, all entries by date, StoryEntryCard with Summarize/Predict/Trace Cause toggle). Limited to 10 cards. Left/right scroll arrows with scroll-snap.

- **StoryCard** — Expandable card per narrative thread. Header shows title, trend badge, region tags, day count, article count. Body shows date range, source list, MiniMap, and timeline of StoryEntryCards.

- **RegionSection** — Collapsible section per geographic region (Asia, Europe, etc.), sorted by total article count (most first, World last). Shows first 3 stories with "Show N more" button.

- **StandaloneSection** — Collapsible list of one-off topics with no narrative thread.

- **FilterBar** — Search (title/region/source), region dropdown, time range toggle (3d/7d/all), sort selector (most articles/most recent/rising first).

**Region Color Scheme:**
| Region | Background | Border | Text |
|--------|-----------|--------|------|
| Asia | #fef3c7 | #fbbf24 | #92400e |
| Europe | #dbeafe | #60a5fa | #1e40af |
| Middle East | #fce7f3 | #f472b6 | #9d174d |
| Africa | #d1fae5 | #34d399 | #065f46 |
| Americas | #ede9fe | #a78bfa | #5b21b6 |
| Oceania | #ffedd5 | #fb923c | #9a3412 |
| World | #f3f4f6 | #d1d5db | #6b7280 |

#### WeeklyMap (`/weekly-map`)

Full-page Google Maps visualization of weekly story evolution with date-based playback.

**Features:**
- **Thread-colored markers** — Each narrative thread gets a unique hue. Markers sized by article count on that date.
- **Geodesic polylines** — Connect same-thread markers across countries showing geographic spread.
- **Date playback** — "Play" button auto-advances through dates oldest→newest. Progress bar and "Day X of Y · N articles" display. Manual prev/next stepping with pause/resume.
- **Thread sidebar** — Left panel listing all threads with search (when >5 threads). Click a thread to zoom the map to its affected countries and show detail view with entries + AI toolbar.
- **Marker → thread selection** — Clicking a single-thread marker selects that thread in the sidebar. Multi-thread markers show an info window with clickable thread links.
- **URL deep-linking** — `?thread=<threadId>&region=<regionName>` query params sync with sidebar for shareable links.
- **Mobile backdrop** — Tapping outside the sidebar closes it on mobile.
- **Map legend** — Category color legend (conflict, economy, politics, etc.).

**Key State:**
```javascript
highlightThread     // Selected threadId (synced to URL ?thread=)
mapRegion           // Selected region filter (synced to URL ?region=)
panelOpen           // Sidebar visibility
storyPlay           // Active playback { threadId, currentDate, dates[] }
search              // Thread search query
```

**Shared components used:** `ApiKeyGate`, `StoryEntryCard`, `ThreadIntelligence`, `CompactTimeline`, `useIsMobile`, `useWeeklyArchive`, `useThreadAnalyses`.

#### Shared Components

**ApiKeyGate.jsx** — Reusable API key prompt. Props: `onSubmit`, `title`, `description`, `error`. Used by WeeklyPage and WeeklyMap.

**StoryEntryCard.jsx** — Entry card with title, sources, and AI toolbar toggle (Summarize/Predict/Trace Cause buttons). Props: `entry`, `compact`. Used in WeeklyPage (story cards, trending modal), WeeklyMap (sidebar detail), and MiniMap click-through.

**TrendBadge.jsx** — Colored pill showing trend direction. Compares article count in recent half vs older half: ratio > 1.3 → Rising (green), < 0.7 → Fading (orange), single day → New (blue), else → Stable (gray). Exports `getTrend()` utility.

**MiniMap.jsx** — Small SVG Equirectangular map (~300×150px) showing colored dots on affected countries. Uses `mapConstants.js` for coordinates and `countryMapping.js` for region→country resolution.

#### Thread Intelligence Components

**ThreadIntelligence.jsx** — Thread-level AI analysis toggle. Shows three buttons (Story Arc / Trajectory / Root Causes) that expand to show AI-generated narrative content. Returns null when no analysis data exists (graceful fallback). Reuses existing `ai-toolbar` and `ai-btn-summary`/`ai-btn-prediction`/`ai-btn-trace` CSS classes.

Props: `{ analysis }` where analysis is `{ storyArc, trajectory, rootCauseChain, threadTitle, entryShortTitles[], ... }` or null/undefined.

**CompactTimeline.jsx** — Compact timeline view of thread entries. Each row shows date + AI-generated short title (6-10 words) + source count + expand chevron. Clicking expands to reveal full `StoryEntryCard` with per-entry AI toolbar. Only one entry expanded at a time. Falls back to `entry.title` when no AI short title exists.

Props: `{ entries[], entryShortTitles[] }` where `entryShortTitles` is `[{ topicId, shortTitle }]`.

**Integration pattern:** When `threadAnalyses[threadId]` exists, StoryCard/TrendingModal/ThreadDetailView show:
```
[Thread title from analysis]
├── ThreadIntelligence (Story Arc / Trajectory / Root Causes)
├── MiniMap
└── CompactTimeline (short titles, expand → full StoryEntryCard)
```
When no analysis exists, the current layout renders unchanged (flat entry list).

## Authentication & Subscription

### Firebase Authentication

Passwordless email link sign-in. No passwords stored.

**Flow:**
```
1. User enters email on /signin
   ↓
2. Firebase sends magic link to email
   ↓
3. User clicks link → lands on /auth/callback
   ↓
4. AuthCallback calls completeSignIn(window.location.href)
   ↓
5. Firebase verifies link, issues ID token
   ↓
6. user object available in AuthContext throughout the app
```

**Config:** `window.FIREBASE_CONFIG` object in `docs/config.js` (set at runtime, never rebuilds). Falls back to `VITE_FIREBASE_*` env vars for local dev.

**`AuthContext` exports:**
```javascript
const {
  user,            // Firebase user object (null if not signed in)
  loading,         // Boolean — true during initial auth state check
  sendSignInLink,  // async (email) => void — sends magic link
  completeSignIn,  // async (emailLink) => user — completes sign-in from URL
  signOut,         // async () => void — clears session + localStorage caches
  getIdToken,      // async () => string|null — Firebase ID token for API calls
} = useAuth()
```

**`AuthBridge` (in App.jsx):** On mount, calls `setAuthProvider(getIdToken)` to wire Firebase tokens into `restProxy.proxyActionWithAuth()`. After this, all gated API calls automatically include `Authorization: Bearer <token>`.

### Tier System

Tiers are stored in DynamoDB (`USERS_TABLE`) keyed by Firebase UID and managed via Stripe webhooks. The frontend never manages tier state directly — it infers from API responses.

| Tier | Access | Days of archive |
|------|--------|----------------|
| free | Public topics + map only | — |
| member | Weekly analysis | 7 days |
| enterprise | Weekly analysis + Thread Intelligence | 30 days |

**Tier detection (frontend):** `useWeeklyArchive` infers tier from the number of days returned (≤7 = member, >7 = enterprise). Explicit tier shown via `user_profile` action on `/account`.

**Stripe:** `/pricing` links to Stripe Checkout. `/account` links to Stripe Customer Portal (via `fetchPortalSession`). `/upgrade/success` is the post-checkout redirect.

### Gated vs Public API calls

| Function | Auth required | Notes |
|----------|--------------|-------|
| `fetchTopicsCache` | No | Public |
| `fetchSummaryCache` / `fetchPredictionCache` / `fetchTraceCauseCache` | No | Public |
| `geocodeProxy` | No | Public |
| `fetchTodayArchive` | No | Public |
| `fetchArchiveRange` | Yes | Member/enterprise |
| `fetchThreadAnalyses` | Yes | Member/enterprise |
| `fetchNarrativeThread` | Yes | Member/enterprise |
| `fetchUserProfile` | Yes | Any signed-in user |
| `fetchPortalSession` | Yes | Any signed-in user |

## Architecture Layers

### Layer 1: REST Proxy Service (`services/restProxy.js`)

Direct interface to AWS Lambda functions. Handles all sensitive API key access.

```javascript
// Main methods
fetchTopicsCache()              // Get daily topics from DynamoDB
fetchSummaryCache(topicId)      // Get cached summary
fetchPredictionCache(topicId)   // Get cached prediction
fetchTraceCauseCache(topicId)   // Get cached trace cause
geocodeProxy(address)           // Geocoding service
```

**Configuration:**
- Endpoint: `window.SENSITIVE_PROXY_ENDPOINT`
- Set via `public/config.js` at runtime
- Points to API Gateway → Lambda (`newsSensitiveData`)

### Layer 2: AppSync Proxy Service (`services/appsyncProxy.js`)

Alternative GraphQL interface — **currently unused**. All production traffic goes through the REST proxy.

```javascript
proxySensitive(action, payload)  // Generic proxy method
```

### Layer 3: GraphQL Service (`utils/graphqlService.js`)

Business logic abstraction layer. Provides clean API with:
- Topic ID resolution and normalization
- Content trimming and formatting
- Error handling
- Retry logic

```javascript
// Main API
getGeminiTopics(limit)          // Fetch topics with limit
getTopicSummary(topicId)        // Get summary
getTopicPrediction(topicId)     // Get prediction
getTopicTraceCause(topicId)     // Get trace cause
```

## Data Flow

### Topic Loading Flow

```
1. Home.jsx mounts
   ↓
2. useGeminiTopics() hook initializes
   ↓
3. Check LocalStorage cache
   ├─ If fresh (< 1 hour) → Display cached topics
   └─ If stale/missing → Fetch from API
      ↓
4. graphqlService.getGeminiTopics(10)
   ↓
5. restProxy.fetchTopicsCache()
   ↓
6. Lambda queries DynamoDB cache
   ↓
7. Topics stored in LocalStorage + component state
   ↓
8. Background polling checks every 10 minutes
```

### AI Analysis Flow (Summary/Prediction/TraceCause)

```
1. User clicks "Summarize" button
   ↓
2. handleGenerateSummary(topic, index) called
   ↓
3. Check if summary already exists in state
   ├─ If exists → Just expand collapsed view
   └─ If not exists → Fetch from API
      ↓
4. graphqlService.getTopicSummary(topicId)
   ↓
5. restProxy.fetchSummaryCache(topicId)
   ↓
6. Lambda queries DynamoDB cache
   ├─ Cache hit → Return content
   └─ Cache miss → Error with retry logic
      ↓
7. Retry up to 6 times with 10-second delays
   ↓
8. Display in SummaryDisplay component
```

## State Management

The application uses React's built-in state management:

### Home.jsx State Structure

```javascript
const [topics, setTopics] = useState([])
const [summaries, setSummaries] = useState({})       // Map: topicId -> content
const [predictions, setPredictions] = useState({})   // Map: topicId -> content
const [traceCauses, setTraceCauses] = useState({})   // Map: topicId -> content
const [loadingSummary, setLoadingSummary] = useState({})  // Map: index -> boolean
const [collapsedSummary, setCollapsedSummary] = useState({})
// Similar loading/error/collapsed states for predictions and traceCauses
```

### Caching Strategy

**LocalStorage Caching:**
- Key: `gemini_topics_cache_v2`
- TTL: 1 hour
- Stores: topics array + timestamp
- Purpose: Reduce API calls, improve load time

**DynamoDB Backend Caching:**
- Topics refreshed daily
- AI content pre-generated and cached
- Accessed via REST proxy

## Custom Hooks

### `useGeminiTopics()`

Manages topic fetching with caching and staleness detection.

```javascript
const {
  topics,        // Array of topic objects
  loading,       // Boolean loading state
  error,         // Error string or null
  refetch,       // Function to force refresh
  isStale,       // Boolean: data older than 1 hour
  updatedAt,     // ISO timestamp of last update
  hasNewData     // Boolean: new data available
} = useGeminiTopics()
```

**Features:**
- LocalStorage caching with 1-hour TTL
- Background polling every 10 minutes
- Stale data detection
- New data notifications

### `useWeeklyArchive()`

Fetches multi-day archive data for the Weekly Analysis pages. Uses `AuthContext` — no API key parameter.

```javascript
const {
  dayMap,        // Object: { 'YYYY-MM-DD': { entries: [...] } }
  sortedDates,   // Array of date strings, newest first
  loading,       // Boolean
  error,         // Error string or null
  tier           // 'member' | 'enterprise' (inferred from day count returned)
} = useWeeklyArchive()
```

**Features:**
- Calls `restProxy.fetchArchiveRange(days)` with Firebase JWT auth via AuthContext
- 30-minute LocalStorage caching, key includes `user.uid` to isolate per-user
- Tier auto-detection: ≤7 days returned → member, >7 → enterprise
- Each entry carries `threadId`, `title`, `regions[]`, `sources[]`, `ai { summary, prediction, trace_cause }`

### `useThreadAnalyses(threadIds)`

Fetches thread-level AI analysis. Uses `AuthContext` — no API key parameter.

```javascript
const {
  analyses,      // Object: { [threadId]: analysis } — empty {} if no data or error
  loading,       // Boolean
} = useThreadAnalyses(threadIds)
```

**Features:**
- Calls `restProxy.fetchThreadAnalyses(threadIds)` with Firebase JWT auth
- 30-minute LocalStorage caching, keyed by user.uid + sorted threadIds
- Graceful error handling: catches failures and returns empty `{}` — no broken UI
- Only fetches when `threadIds.length > 0` and user is signed in

### `useCountryIntelligence(countryNames)`

Fetches country-level AI intelligence. Uses `AuthContext`.

```javascript
const {
  intelligence,  // Object: { [countryName]: intelligenceObj } — empty {} if no data
  loading,       // Boolean
} = useCountryIntelligence(countryNames)
```

**Features:**
- Calls `restProxy.fetchCountryIntelligence(countryNames)` with Firebase JWT auth
- 30-minute LocalStorage caching, keyed by user.uid + sorted countryNames
- Graceful fallback when `newsCountryIntelligence` Lambda hasn't run yet

**Analysis object shape (per thread):**
```javascript
{
  threadTitle: "Chile's Political Shift Under Kast",
  entryShortTitles: [
    { topicId: 'id1', shortTitle: 'Kast inaugurated as Chile president' },
    { topicId: 'id2', shortTitle: 'Santiago protests erupt over reforms' }
  ],
  storyArc: "...",          // 2-3 paragraphs — how the story evolved
  trajectory: "...",        // 1-2 paragraphs — where it's heading
  rootCauseChain: "...",    // 1-2 paragraphs — tracing origins
  entryCount: 5,
  generatedAt: "2026-03-14T...",
  model: "grok-4-1-fast-non-reasoning"
}
```

### `useIsMobile(breakpoint)`

Responsive breakpoint hook. Default breakpoint: 600px. Returns `true` when viewport width ≤ breakpoint.

### `useSummary()` / `usePrediction()` / `useTraceCause()`

Custom hooks for AI-generated content (currently not actively used in favor of direct state management in Home.jsx).

## Key Components

### Layout.jsx

Application shell providing consistent navigation and footer.

**Features:**
- Responsive navigation bar
- Mobile hamburger menu
- Footer with links to static pages
- Container wrapper for all pages

### Home.jsx

Main feature component displaying topics and AI analysis.

**Key Functionality:**
- Displays topics organized by region
- Three AI analysis buttons per topic
- Retry logic with exponential backoff (6 retries, 10-second delays)
- Auto-scrolling to active content
- Topic staleness indicators
- Manual refresh button

**State Management:**
- Manages summaries, predictions, and traceCauses in separate state objects
- Loading states per feature per topic
- Collapsed/expanded states for each analysis

### WorldMap.jsx

Interactive geographic visualization of global news connections.

**Features:**
- Google Maps integration with category-colored circle markers per country
- Geodesic polyline connections between countries sharing a topic
- Archive overlay: muted markers + dashed lines for earlier-today topics
- Slide-in `MapSidePanel` with full topic cards and AI toolbar per country
- `TodayArchiveSidebar` accessible from the map page
- **Related Countries mode:** yellow pixel-scale circle markers on affected countries (zoom-independent via `google.maps.Marker` with `SymbolPath.CIRCLE`). Stored in `highlightCirclesRef`. Clears on "Hide Related" or banner clear; background map clicks do not exit the mode.
- SVG fallback map when Google Maps API is unavailable

**Key State:**
- `selectedTopic` — active Related Countries topic (null = off)
- `panelOpen` / `panelCountry` — side panel visibility and selected country
- `markersRef` / `polylinesRef` / `archiveMarkersRef` / `archivePolylinesRef` / `highlightCirclesRef` — imperative Google Maps object refs

### Display Components

**SummaryDisplay.jsx / PredictionDisplay.jsx / TraceCauseDisplay.jsx**

Consistent UI for AI-generated content.

**Shared Features:**
- Clean, premium design
- Bullet-point or paragraph formatting
- Collapsible interface
- Loading spinners
- Error states with retry buttons

## Geographic System

### Country Mapping (`utils/countryMapping.js`)

Comprehensive country data utility:

```javascript
// Maps 195 countries + alternates to ISO codes
regionToCountryCode(regionName)

// Infers country from news source domain
sourceToCountryCode(url)

// Returns all country codes from a topic's regions array
getTopicCountryCodes(topic)

// Returns geographic region (Asia, Europe, etc.) for a topic
getTopicRegion(topic)
```

**Capabilities:**
- Handles possessives ("China's" → "China")
- Alternate country names
- Common misspellings
- Territory mappings

### Region Organization

Topics are categorized into 7 regions based on keyword matching:

1. Asia
2. Africa
3. North America
4. Europe
5. Middle East
6. South America
7. World (catch-all)

## Styling Architecture

### Design System

**Theme:** Black and white minimalist

**Color Palette:**
```css
--bg-primary: #ffffff
--bg-secondary: #f8f8f8
--bg-tertiary: #e8e8e8
--text-primary: #000000
--text-secondary: #333333
--text-muted: #666666
--border-color: #cccccc
--accent-color: #0066cc
--error-color: #d32f2f
--success-color: #2e7d32
```

**Key CSS Files:**
- `index.css` - Global styles, CSS variables
- `Layout.css` - Navigation and footer
- `Home.css` - Main page layout
- `AIComponents.css` - Premium AI feature styling (shared by Home, Weekly, Map)
- `WorldMap.css` - Daily map component styles
- `WeeklyPage.css` - Weekly analysis page (story cards, trending section, modal, filters)
- `WeeklyMap.css` - Weekly map (sidebar, playback overlay, legend, date controls)

**Design Features:**
- Responsive grid system
- Card-based layouts
- Premium AI component styling
- Loading animations (spin, pulse, shimmer)
- Smooth transitions and hover effects
- Mobile-first responsive design
- Touch-optimized buttons (44px minimum)

## Error Handling

### Retry Logic

All AI analysis requests implement exponential retry:

```javascript
// Configuration
MAX_RETRIES = 6
RETRY_DELAY = 10000  // 10 seconds

// Flow
1. Initial request fails (cache miss)
2. Display error with retry button
3. Auto-retry up to 6 times
4. Show user-friendly error messages
5. Allow manual retry at any time
```

### Error States

- **Network errors:** Connectivity issues
- **Cache misses:** Content not yet generated
- **API errors:** Lambda/DynamoDB issues
- **Geocoding failures:** Location not found

Each error type has specific user messaging and retry strategies.

## Performance Optimizations

1. **LocalStorage Caching**
   - Reduces API calls
   - 1-hour TTL balances freshness and performance
   - Cached topics load instantly

2. **Background Polling**
   - Non-blocking updates every 10 minutes
   - User sees stale data indicator
   - Manual refresh option available

3. **Lazy Loading**
   - AI content loaded on-demand
   - Only requested analyses are fetched
   - Reduces initial page load

4. **React.useMemo**
   - Memoizes expensive computations
   - Geographic categorization
   - Topic ID generation

5. **Debounced API Calls**
   - Prevents duplicate requests
   - Improves UX during rapid interactions

## Architecture Patterns

### 1. Proxy Pattern
All sensitive API keys hidden behind Lambda proxies. Frontend never exposes credentials.

### 2. Service Layer Pattern
`graphqlService.js` abstracts API complexity. Business logic separated from UI components.

### 3. Custom Hooks Pattern
Reusable stateful logic with clean component interfaces.

### 4. Compound Component Pattern
Display components share common interface and props API.

### 5. Container/Presenter Pattern
Smart components (Home.jsx) manage state, dumb components (Display components) render UI.

## Security Considerations

1. **No API Keys in Frontend**
   - All sensitive keys in Lambda environment variables
   - Frontend only knows API Gateway endpoints

2. **CORS Configuration**
   - API Gateway configured for specific origins
   - No wildcard CORS policies

3. **Content Security**
   - No inline scripts in production
   - CSP headers via hosting configuration

4. **Input Validation**
   - User input sanitized before display
   - React's built-in XSS protection

## Development Workflow

### Local Development

```bash
cd frontend
npm install
npm run dev
```

**Configuration:**
1. Copy `public/config.example.js` to `public/config.js`
2. Set `window.SENSITIVE_PROXY_ENDPOINT` to deployed Lambda URL
3. Access app at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output: `dist/` directory with optimized static files

### Deployment

The app is deployed to GitHub Pages:
1. Build creates static files
2. `config.js` loaded at runtime
3. Dynamic basename resolution handles path routing

## Future Enhancements

Potential areas for improvement:

1. **Global State Management**
   - Consider Redux or Zustand for complex state
   - Reduce props drilling

2. **Code Splitting**
   - Lazy load routes
   - Reduce initial bundle size

3. **Progressive Web App**
   - Service workers for offline support
   - Push notifications for new topics

4. **Real-time Updates**
   - WebSocket connection for live updates
   - Remove polling dependency

5. **Accessibility**
   - ARIA labels
   - Keyboard navigation
   - Screen reader optimization

6. **Testing**
   - Unit tests for utilities
   - Integration tests for components
   - E2E tests for critical flows

## Troubleshooting

### Common Issues

**Topics not loading:**
- Check `window.SENSITIVE_PROXY_ENDPOINT` is set
- Verify Lambda is deployed and accessible
- Check browser console for CORS errors

**AI analysis fails:**
- Cache miss expected on first request
- Wait for retry logic to complete
- Check DynamoDB has cached content

**Map not displaying:**
- Verify Google Maps API key is valid
- Check browser console for API errors
- SVG fallback should display if API fails

**Stale data indicator:**
- Topics older than 1 hour trigger indicator
- Click refresh button to force update
- Background polling will update automatically

## Additional Resources

- **Vite Documentation:** https://vitejs.dev
- **React Router:** https://reactrouter.com
- **AWS Amplify:** https://docs.amplify.aws
- **Google Maps API:** https://developers.google.com/maps
