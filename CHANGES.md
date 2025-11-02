# Global Perspectives — Change Log

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