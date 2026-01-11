# Global Perspectives — Change Log

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
