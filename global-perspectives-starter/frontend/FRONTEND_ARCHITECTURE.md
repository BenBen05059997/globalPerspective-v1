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
│   │   ├── Layout.jsx           # Navigation shell
│   │   ├── Home.jsx             # Main topics page
│   │   ├── WorldMap.jsx         # Interactive map (daily)
│   │   ├── MapSidePanel.jsx     # Map side panel with topic cards
│   │   ├── WeeklyPage.jsx       # Weekly analysis page (list + embedded map)
│   │   ├── WeeklyMap.jsx        # Full-page weekly map with playback
│   │   ├── ApiKeyGate.jsx       # Shared API key prompt (reused by Weekly pages)
│   │   ├── StoryEntryCard.jsx   # Shared entry card with AI toolbar toggle
│   │   ├── TrendBadge.jsx       # Rising/Stable/Fading/New trend pill
│   │   ├── MiniMap.jsx          # Small SVG map showing story footprint
│   │   ├── ErrorModal.jsx       # User-friendly error modal
│   │   ├── SummaryDisplay.jsx
│   │   ├── PredictionDisplay.jsx
│   │   ├── TraceCauseDisplay.jsx
│   │   └── ...
│   ├── hooks/                   # Custom React hooks
│   │   ├── useGeminiTopics.js   # Daily topic fetching
│   │   ├── useWeeklyArchive.js  # Weekly archive fetching (7-30 day range)
│   │   ├── useIsMobile.js       # Responsive breakpoint hook
│   │   ├── useSummary.js
│   │   ├── usePrediction.js
│   │   └── useTraceCause.js
│   ├── services/                # API integration layers
│   │   ├── restProxy.js         # REST API proxy
│   │   └── appsyncProxy.js      # GraphQL proxy (alternative)
│   ├── utils/                   # Utility functions
│   │   ├── graphqlService.js    # API abstraction
│   │   ├── countryMapping.js    # Geographic utilities
│   │   ├── dateUtils.js         # Date formatting helpers
│   │   ├── mapConstants.js      # Shared country coordinates
│   │   └── geocoding.js
│   ├── contexts/
│   │   └── ErrorContext.jsx     # Global error state
│   ├── main.jsx                 # Application entry point
│   ├── App.jsx                  # Root component with routing
│   ├── bootstrapProxy.js        # REST API configuration
│   └── index.css                # Global styles
├── public/                      # Static assets
│   └── config.js               # Runtime configuration
├── index.html                   # HTML template
└── vite.config.js               # Vite configuration
```

## Application Routes

The application uses React Router with dynamic basename resolution for GitHub Pages deployment:

- `/` - Home (main news topics page)
- `/map` - WorldMap (interactive daily visualization)
- `/weekly` - WeeklyPage (narrative analysis with list/map toggle, requires API key)
- `/weekly-map` - WeeklyMap (full-page weekly map with date playback, requires API key)
- `/privacy` - Privacy terms
- `/about` - About page
- `/contact` - Contact page
- `/disclosures` - Disclosures page

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

Multi-day story tracking that groups topics by narrative thread (`threadId`), showing how stories evolve across days and geographies. Gated behind API key (member = 7 days, enterprise = 30 days).

#### WeeklyPage (`/weekly`)

Main weekly view with two modes: **List** and **Map** (embedded WeeklyMap).

**Data Flow:**
```
1. User enters API key → stored in localStorage('gp_api_key')
   ↓
2. useWeeklyArchive(apiKey) fetches archive_range (7 or 30 days)
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

**Shared components used:** `ApiKeyGate`, `StoryEntryCard`, `useIsMobile`, `useWeeklyArchive`.

#### Shared Components

**ApiKeyGate.jsx** — Reusable API key prompt. Props: `onSubmit`, `title`, `description`, `error`. Used by WeeklyPage and WeeklyMap.

**StoryEntryCard.jsx** — Entry card with title, sources, and AI toolbar toggle (Summarize/Predict/Trace Cause buttons). Props: `entry`, `compact`. Used in WeeklyPage (story cards, trending modal), WeeklyMap (sidebar detail), and MiniMap click-through.

**TrendBadge.jsx** — Colored pill showing trend direction. Compares article count in recent half vs older half: ratio > 1.3 → Rising (green), < 0.7 → Fading (orange), single day → New (blue), else → Stable (gray). Exports `getTrend()` utility.

**MiniMap.jsx** — Small SVG Equirectangular map (~300×150px) showing colored dots on affected countries. Uses `mapConstants.js` for coordinates and `countryMapping.js` for region→country resolution.

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

### `useWeeklyArchive(apiKey)`

Fetches multi-day archive data for the Weekly Analysis pages.

```javascript
const {
  dayMap,        // Object: { 'YYYY-MM-DD': { entries: [...] } }
  sortedDates,   // Array of date strings, newest first
  loading,       // Boolean
  error,         // Error string or null
  tier           // 'member' | 'enterprise' (inferred from day count returned)
} = useWeeklyArchive(apiKey)
```

**Features:**
- Calls `restProxy.fetchArchiveRange(apiKey)` for 30-day range
- 30-minute LocalStorage caching (key: `gp_weekly_archive_v1`)
- Tier auto-detection: ≤7 days returned → member, >7 → enterprise
- Each entry carries `threadId`, `title`, `regions[]`, `sources[]`, `ai { summary, prediction, trace_cause }`

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
