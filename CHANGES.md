# Global Perspectives — Change Log

## 2026-03-04

### Multi-Language Frontend Completion & Error Modal System
- **Frontend - Complete Multi-Language Implementation:** Extended multi-language support (EN/JA/ZH) to all pages and components across the entire site. Previously only Home page had language support; now all static pages (About, Contact, Privacy, Disclosures) and dynamic components (Map side panel, navigation, footer, archive sidebar) display content in the selected language.
- **Frontend - Static Pages Translation:** Created `CONTENT` objects within each static page component containing full EN/JA/ZH translations. Modified `AboutContact.jsx`, `Contact.jsx`, `PrivacyTerms.jsx`, and `Disclosures.jsx` to use `useLang()` hook and dynamically render content based on selected language. Fixed syntax errors in Chinese strings by using single quotes to wrap strings containing internal double quotes.
- **Frontend - Navigation & Footer:** Updated `Layout.jsx` to translate all navigation links (Home, Map, About, Contact, Privacy, Disclosures) and footer text using `t()` function from i18n. Navigation and footer now respond to language toggle.
- **Frontend - Map Components:** Modified `MapSidePanel.jsx` to pass `lang` parameter to all API calls (`getTopicSummary`, `getTopicPrediction`, `getTopicTraceCause`) and display localized topic titles using `getLocalizedTitle()`. Archive AI content selection based on language (`ai_ja`, `ai_zh`, or fallback to `ai`).
- **Frontend - Archive & Display Components:** Updated `TodayArchiveSidebar.jsx`, `TopicNav.jsx`, `ArchiveTopicModal.jsx`, `SummaryDisplay.jsx`, `PredictionDisplay.jsx`, and `TraceCauseDisplay.jsx` to use localized titles and category names. All UI strings (buttons, headers, labels) now use `t()` or `tCategory()` for translation.
- **Frontend - i18n Expansion:** Added comprehensive UI strings to `i18n.js` covering navigation (navHome, navMap, etc.), footer (footerTagline, footerPrivacy), map UI (alsoAffects, storyFlow, clearStory, hideSources, etc.), and updated subtitle to emphasize global impact ("that have impact around the world" instead of "from around the world"). Changed all Chinese "话题" (topics) to "新闻" (news) for accuracy.
- **Frontend - Error Modal System:** Created global error handling system to display user-friendly, translated error messages instead of raw API errors. Created `ErrorContext.jsx` providing `showError(message, title)` and `clearError()` functions via React Context. Created `ErrorModal.jsx` component with EN/JA/ZH error messages for common errors (503 service unavailable, cache miss, network errors). Modal supports keyboard (Escape) and click-outside-to-close interactions.
- **Frontend - Error Integration:** Modified `App.jsx` to wrap entire application with `<ErrorProvider>` and include `<ErrorModal />` component. Updated `Home.jsx` and `MapSidePanel.jsx` to use `showError()` from ErrorContext in catch blocks instead of setting local error state. After retry exhaustion, errors now display in modal with friendly messages like "Service temporarily unavailable. Please try again in a moment." instead of raw error strings.
- **Frontend - API Service Updates:** Modified `restProxy.js` to accept and pass `lang` parameter to backend for content fetching. Updated `graphqlService.js` to pass `lang` through to REST proxy calls for summaries, predictions, and trace cause analysis.
- **Language Persistence:** Language preference persists across page navigation and browser sessions via localStorage (`gp_lang` key). Language toggle in navbar shows active state with white text on black background.
- **Modified Files:**
  - `global-perspectives-starter/frontend/src/App.jsx` - Wrapped with ErrorProvider, added ErrorModal
  - `global-perspectives-starter/frontend/src/contexts/ErrorContext.jsx` - New file: Global error state management
  - `global-perspectives-starter/frontend/src/components/ErrorModal.jsx` - New file: Translated error modal (EN/JA/ZH)
  - `global-perspectives-starter/frontend/src/components/Home.jsx` - Error handling via showError(), lang param for API calls
  - `global-perspectives-starter/frontend/src/components/MapSidePanel.jsx` - Error handling via showError(), lang param, localized titles
  - `global-perspectives-starter/frontend/src/components/Layout.jsx` - Translated navigation and footer
  - `global-perspectives-starter/frontend/src/components/AboutContact.jsx` - Full EN/JA/ZH content object
  - `global-perspectives-starter/frontend/src/components/Contact.jsx` - Full EN/JA/ZH content object
  - `global-perspectives-starter/frontend/src/components/PrivacyTerms.jsx` - Full EN/JA/ZH content object
  - `global-perspectives-starter/frontend/src/components/Disclosures.jsx` - Full EN/JA/ZH content object
  - `global-perspectives-starter/frontend/src/components/TodayArchiveSidebar.jsx` - Localized titles and UI strings
  - `global-perspectives-starter/frontend/src/components/TopicNav.jsx` - Localized titles
  - `global-perspectives-starter/frontend/src/components/ArchiveTopicModal.jsx` - Localized AI content selection
  - `global-perspectives-starter/frontend/src/utils/i18n.js` - Expanded UI strings (nav, footer, map, subtitle change, Chinese terminology update)
  - `global-perspectives-starter/frontend/src/services/restProxy.js` - Added lang parameter support
  - `global-perspectives-starter/frontend/src/utils/graphqlService.js` - Pass lang parameter through
- **Status:** Full-stack multi-language implementation complete. Frontend now fully translated across all pages and components. Error handling upgraded with user-friendly modal system. Backend was deployed previously (2026-02-12). Frontend deployment in progress.

## 2026-02-12

### Multi-Language Support (Japanese + Chinese)
- **Architecture:** Implemented Option C multi-language strategy where a single Grok API call returns all 3 languages (EN/JA/ZH) in structured JSON format. This maintains the same API call count (~39/hour) while generating content in 3 languages simultaneously, avoiding 3x cost inflation of per-language API calls.
- **Backend - NewsProjectInvokeAgentLambda:** Modified AI content generation to output multilingual JSON. Added `wrapMultilingual()` function to append JSON output requirements to all prompts (summary, prediction, trace cause). Increased `DEFAULT_MAX_TOKENS` from 600 to 1800 to accommodate 3 languages. Added `parseMultilingualContent()` to parse JSON response into `{en, ja, zh}` objects with graceful fallback to English-only if JSON parsing fails. Replaced `writeCache()` with `writeCacheMultilingual()` that writes 3 DynamoDB items per content type using language-specific sort keys (SK: `SUMMARY`, `SUMMARY_JA`, `SUMMARY_ZH`). Modified `buildAndWriteArchive()` to fetch all 9 items (3 languages × 3 content types) and store as `ai`, `ai_ja`, `ai_zh` objects in archive entries. Added `response_format: { type: 'json_object' }` to `invokeGrok()` to enforce structured output.
- **Backend - newsInvokeGemini:** Added batch title translation after topic generation. Makes 1 additional Grok API call to translate all ~13 topic titles to Japanese and Chinese simultaneously using structured JSON output. Merges `title_ja` and `title_zh` fields into each topic object. Wrapped in try-catch for graceful degradation - if translation fails, topics keep English titles without breaking the pipeline.
- **Backend - newsSensitiveData:** Modified REST proxy to accept `lang` parameter from frontend. Extracts `lang` from request payload (defaults to 'en'), computes language suffix ('_JA' for Japanese, '_ZH' for Chinese, '' for English), and appends suffix to DynamoDB sort key for content lookups. Updated `readSummaryPredictionCache()` function signature to accept lang parameter. Topics and archive endpoints unchanged - they return full objects with all language fields.
- **Frontend - Language Infrastructure:** Created `src/contexts/LanguageContext.jsx` with React Context API providing global language state (`lang`) and setter (`setLang`). State persisted in localStorage (`gp_lang` key) and defaults to English. Created `src/utils/i18n.js` with UI_STRINGS dictionary mapping all UI text to EN/JA/ZH translations. Exported `t(key, lang)` function for button labels/headers, `tCategory(name, lang)` for category names, and `getLocalizedTitle(topic, lang)` helper to extract correct title field from topic objects.
- **Frontend - Layout Integration:** Modified `App.jsx` to wrap entire application with `<LanguageProvider>`. Updated `Layout.jsx` to add language toggle in navbar with 3 buttons (EN / 日本語 / 中文) using `useLang()` hook. Active language highlighted with white text on black background. Toggle persists across page navigation and browser sessions via localStorage.
- **Frontend - Styling:** Added `.lang-toggle` and `.lang-btn` CSS classes to `index.css` with button styling, hover effects, and active state styling. Language buttons display inline with 4px gap, minimal padding (2px 8px), and smooth transitions.
- **DynamoDB Key Strategy:** English content uses original sort keys (`SUMMARY`, `PREDICTION`, `TRACE_CAUSE`) for full backward compatibility with existing cache. Japanese and Chinese content stored with language suffixes (`_JA`, `_ZH`). Archive entries include all 3 language objects as separate fields.
- **Graceful Degradation:** System never breaks if translation fails. JSON parsing failure falls back to English-only content. Missing language keys in response are skipped (no write to DynamoDB). Title translation wrapped in try-catch - failure keeps English titles. Frontend requests for non-existent translations return cache miss - user can retry or switch to English.
- **Modified Files:**
  - `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` - Multilingual prompt wrapping, JSON parsing, 3-item writes, archive handling
  - `amplify/backend/function/newsInvokeGemini/src/index.js` - Batch title translation via Grok JSON output
  - `amplify/backend/function/newsSensitiveData/src/index.js` - Language parameter handling, SK suffix logic
  - `global-perspectives-starter/frontend/src/contexts/LanguageContext.jsx` - New file: React Context for language state
  - `global-perspectives-starter/frontend/src/utils/i18n.js` - New file: UI translations and helpers (EN/JA/ZH)
  - `global-perspectives-starter/frontend/src/App.jsx` - Wrapped with LanguageProvider
  - `global-perspectives-starter/frontend/src/components/Layout.jsx` - Language toggle navbar buttons
  - `global-perspectives-starter/frontend/src/index.css` - Language toggle button styles
- **Status:** Backend implementation complete (NOT deployed to production yet per user request). Frontend language infrastructure complete (LanguageContext, i18n, toggle, CSS). Remaining work: Update frontend components (restProxy, graphqlService, Home.jsx, display components) to actually fetch and display content in selected language.

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
