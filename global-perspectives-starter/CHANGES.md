# Global Perspectives — Change Log

## 2026-02-12
- Backend: Upgraded model from `grok-4-fast` to `grok-4-1-fast-non-reasoning` across newsInvokeGemini and NewsProjectInvokeAgentLambda
- Backend: Added soft dedup for news topics — tracks seen topics for 24h, prioritizes new events over repeats
- Backend: Added source exclusivity rule — each article URL assigned to exactly one topic
- Backend: Added `buildAndWriteArchive()` in NewsProjectInvokeAgentLambda — saves all topics with embedded AI content to `today-archive` DynamoDB item before pruning
- Backend: Added `today` action in newsSensitiveData to serve archive data to frontend
- Frontend: Added Today's Archive left sidebar showing all topics from past 24h grouped by category
- Frontend: Added archive modal with tabs (Summary / Prediction / Trace Cause) for viewing past AI analysis
- Frontend: Added `useTodayArchive` hook with 10-min localStorage cache
- Frontend: Archive sidebar hidden on screens < 1200px, narrower on < 1600px

## 2026-01-14
- Backend: Switched from Gemini/OpenAI to **Grok 4 Fast** (xAI) for all AI operations
- Backend: Updated `newsInvokeGemini` Lambda to use Grok API (OpenAI-compatible endpoint)
- Backend: Updated `NewsProjectInvokeAgentLambda` to use Grok API for summaries, predictions, and trace cause
- Backend: Changed environment variables from `GOOGLE_GEMINI_API_KEY`/`OPENAI_API_KEY` to `XAI_API_KEY`
- Backend: Set base URL to `https://api.x.ai/v1` for Grok API compatibility
- Backend: Added regional diversity requirement to prevent US news dominance (must cover 6+ regions)
- Backend: Increased temperature from 0.3 to 0.5 for more diverse topic selection
- Performance: Grok 4 Fast provides better news judgment at $0.20/$0.50 per 1M tokens
- Quality: Improved topic selection to prioritize high-impact global news over local stories

## 2026-01-11
- Backend: Fix Brave Search rate limiting (HTTP 429) by adding 2000ms delay between regional queries
- Backend: Stricter Gemini prompt to prevent AI hallucination of non-existent news sources
- Backend: Source validation filter to remove fabricated URLs not in original Brave results
- Backend: Block archive domains (archive.is, archive.ph, web.archive.org) from sources
- Backend: Filter out articles older than 48 hours to ensure recent news only
- Frontend: Redesigned sources display to match Summary/Prediction pattern (consistent UI)
- Frontend: Sources expand in ai-result-card below button row (no layout shift)
- Frontend: Added helper text about real-time indexing delays
- Frontend: Click header or X icon to collapse sources
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
