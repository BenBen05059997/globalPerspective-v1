# Deprecation & Removal Plan: NewsAPI and NewsData

This document outlines the plan to remove external News APIs (NewsAPI.org and NewsData.io) from the project to avoid confusion and ensure a Gemini-only news pipeline.

## Why
- The project’s current direction uses Gemini via AppSync/Lambda for topic discovery and AI processing.
- Legacy references to NewsAPI/NewsData can mislead contributors and complicate credentials management.

## Scope
We will remove or stub any code paths that directly call NewsAPI.org or NewsData.io, and update supporting Lambda actions.

Impacted areas:
- `amplify/backend/function/newsSensitiveData/src/index.js` (removes `action === 'newsdata'` branch)
- `global-perspectives-starter/backend/tools/newsapi.py` (stop external calls; return mock data)
- `global-perspectives-starter/backend/services/newsdata_service.py` (stop external calls; return mock data)
- Documentation references (to be updated in a follow-up): README, development/completion reports, credentials docs.

## Strategy
1. Enforce Gemini-only pipeline: remove external API calls and all mock datasets.
2. Preserve function signatures until callers are migrated; functions will raise explicit errors if used.
3. Remove the `newsdata` Lambda action to prevent any accidental usage.
4. Leave Amplify/AppSync/Gemini paths untouched; ensure all news fetching flows use these paths.

## Changes (this PR)
- Lambda `newsSensitiveData`: removed `action === 'newsdata'` external API branch.
- `backend/tools/newsapi.py`: removed all external and mock data usage; functions now raise errors directing callers to Gemini.
- `backend/services/newsdata_service.py`: removed all external and mock data usage; functions now raise errors directing callers to Gemini.
- Deleted `global-perspectives-starter/backend/data/mock_conflict_news.json` and references.
 - Removed test-only mock publisher entry `MockSource` from `backend/data/publishers.json` and Python fallback.

## Follow-up tasks (docs/config)
- Update docs to clearly state Gemini-only pipeline, with no mock data:
  - `global-perspectives-starter/README.md`
  - `DEVELOPMENT_PLAN.md`, `STAGE_1_2_COMPLETION_REPORT.md`, `BUG_FIXES_AND_SOLUTIONS.md`
  - `CREDENTIALS_HANDLING_AND_PROXY_PLAN.md`, `LAMBDA_PROXY_AND_SECRETS.md`
- Remove `.env` references to `NEWSAPI_KEY` and `NEWSDATA_API_KEY` or flag them as deprecated.
- Optional: move legacy docs into `legacy/` folder for archival.

## Risk & Rollback
- Risk: Any code paths still calling deprecated functions will now get explicit errors; ensure callers use Gemini/AppSync services.
- Rollback: Revert this commit to restore previous behavior; reintroduce the Lambda `newsdata` action and prior service implementations if needed.

## Validation Checklist
- Frontend and backend fetch news exclusively via Gemini/AppSync/Lambda.
- No network calls to `newsapi.org` or `newsdata.io` are made.
- No code paths load or return mock datasets.
 - No residual mock identifiers (e.g., `MockSource`) remain in data or fallbacks.
- Lambda `newsSensitiveData` supports `appsync`, `openai`, and `geocode` actions only.

## Notes
- This change reduces credentials footprint and aligns the codebase with the AI-first approach.
- If you need real article ingestion later, integrate a Gemini-driven discovery + extraction flow rather than traditional feed APIs.