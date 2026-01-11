# Global Perspectives — Change Log

## 2026-01-11
- Backend: Fix Brave Search rate limiting (HTTP 429) by adding 2000ms delay between regional queries
- Backend: Stricter Gemini prompt to prevent AI hallucination of non-existent news sources
- Backend: Source validation filter to remove fabricated URLs not in original Brave results
- Frontend: Added collapsible "Sources" section showing actual Brave articles with links
- Frontend: Renamed "View Sources" to "Search Google News" to clarify it's a fallback search
- Data Quality: All 10 regional Brave queries now succeed, providing better global news coverage

## 2026-01-09
- Backend: Added `generatedDate` and `generatedYear` fields to topic generation pipeline
- AI Prompts: Updated all AI prompts (summary, prediction, trace_cause) to include current date context
- Frontend: Display "Topics from [date]" instead of just relative time
- Fix: AI predictions now reference correct year (2026) instead of outdated 2024 references
- Data Flow: Centralized date at generation source (newsInvokeGemini) flows through entire pipeline

## 2025-10-09
- Security: Restored direct Amplify AppSync configuration; removed Vite env usage for AppSync.
- Configuration: Added root `.gitignore` to exclude `.env` files; committed sanitized `.env.example` and `frontend/.env.example`.
- Search UX: Shortened topic titles for Google News queries; added location hints; kept 24-hour window.
- Consistency: Unified Home and Map “View sources →” link logic to use the same query builder.
- UI: Removed article list under the map.

## Setup Notes
- AppSync configuration is read from the bundled Amplify config. No `frontend/.env` is required for AppSync.
- Use `.env` at repo root only for backend service keys if needed; do not commit real keys.
