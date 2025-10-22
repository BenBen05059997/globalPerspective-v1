> **Status (Archived):** Frontend reads now go through the newsSensitiveData REST proxy (topics/summary/prediction); AppSync notes remain for history.

# Gemini Topics via AppSync – Integration Notes and Routing Diagnosis

## Overview
- We switched to a Node.js Lambda that calls Google Gemini and returns `{ topics, ai_powered, model, limit }`.
- We added an AppSync `Query.getGeminiTopics(limit, model)` resolver that invokes the Lambda and returns the JSON body.
- The frontend now has a GraphQL helper and hook (`graphqlService.getGeminiTopics()` and `useGeminiTopics`) that render topics on `/topics-test`.

## Current Data Flows
- Frontend GraphQL flow:
  - `frontend/src/utils/graphqlService.js` configures Amplify, defines `GET_GEMINI_TOPICS_QUERY`, and exposes `getGeminiTopics()`.
  - `frontend/src/hooks/useGeminiTopics.js` calls `graphqlService.getGeminiTopics()`.
  - `frontend/src/components/GeminiTopicsTest.jsx` displays topics.
- Frontend REST flow (legacy):
  - `frontend/src/utils/api.js` uses `API_BASE_URL = 'http://localhost:8000'` and defines endpoints (`/api/headlines`, `/api/search`, `/api/topics/gemini`).
  - `frontend/src/hooks/useArticles.js` imports `getTodaysHeadlines()` from `utils/api.js` and calls `http://localhost:8000/api/headlines`.
  - `frontend/src/components/Search.jsx` calls `searchNews()` / `searchNewsAI()` from `utils/api.js` which also hit `localhost:8000`.

## Mismatch Diagnosis (Why "Failed to fetch")
- The errors:
  - `API Request failed: TypeError: Failed to fetch`
  - `❌ useArticles: Error fetching headlines: TypeError: Failed to fetch`
- Root cause:
  - The frontend still attempts to call a local backend (`http://localhost:8000`) via `utils/api.js`.
  - No local server is running on port 8000, so browser fetch fails at the network layer (hence “Failed to fetch”).
- Where this happens:
  - `frontend/src/hooks/useArticles.js` → `getTodaysHeadlines('en')` → `utils/api.js` → `http://localhost:8000/api/headlines`.
  - `frontend/src/components/Search.jsx` → `searchNews`/`searchNewsAI` → `utils/api.js` → `http://localhost:8000/api/...`.
- What already works:
  - `frontend/src/hooks/useGeminiTopics.js` now uses AppSync (`graphqlService`) and does NOT rely on `localhost:8000`.
  - The `/topics-test` page should load Gemini topics directly from AppSync.

## Options to Fix
1) Use AppSync everywhere (recommended):
   - Refactor `utils/api.js` consumers (`useArticles`, `Search.jsx`) to call AppSync queries/mutations or a Lambda/AppSync-driven data source.
   - Benefit: Removes dependency on a local backend and aligns all data fetching with AppSync.

2) Run the local backend (if you want to keep REST):
   - Start the FastAPI server that serves `/api/headlines` and `/api/search` (located under `global-perspectives-starter/backend/api.py`).
   - Keep `API_BASE_URL = 'http://localhost:8000'` and ensure CORS is enabled (already present in `api.py`).

## What’s Implemented
- Node.js Lambda handler (Gemini): Returns topics as JSON; supports `limit` and `model` via query string.
- AppSync schema/resolver:
  - Query: `getGeminiTopics(limit: Int = 5, model: String = "gemini-2.5-flash") : GeminiTopicsResult!`.
  - Request mapping uses `toJson` for valid serialization; response parses `ctx.result.body`.
- Frontend updates:
  - `graphqlService.js`: Added `GET_GEMINI_TOPICS_QUERY` and `getGeminiTopics()`.
  - `useGeminiTopics.js`: Switched to GraphQL helper.
  - Dev server runs at `http://localhost:5173/`; topics page route: `/topics-test`.

## Next Steps (pick one)
- Refactor `useArticles` and search to AppSync, or run the FastAPI server at `localhost:8000`.
- Confirm AppSync auth and endpoint configs in `graphqlService.js` reflect your active environment (API key expiry, region).

## Troubleshooting Tips
- If GraphQL calls fail: verify API key validity, AppSync resolver permissions to invoke Lambda, and Lambda env var `GOOGLE_GEMINI_API_KEY`.
- If REST calls fail: ensure the local backend is running and reachable at `http://localhost:8000` with CORS allowing `http://localhost:5173`.

## Error Details (documented)
- Error message: `TypeError: Failed to fetch`
- Context: Occurs when components/hooks call `utils/api.js` endpoints targeting `http://localhost:8000` (e.g., `/api/headlines`, `/api/search`).
- Network behavior: Browser cannot reach `localhost:8000` because no server is running, so the fetch rejects before any HTTP status is available.
- Code path examples:
  - `useArticles.js` → `getTodaysHeadlines('en')` → `utils/api.js` → `http://localhost:8000/api/headlines`
  - `Search.jsx` → `searchNews`/`searchNewsAI` → `utils/api.js` → `http://localhost:8000/api/search`
- Resolution chosen: Move all data flows to AppSync (`graphqlService.getGeminiTopics`) and stop using REST endpoints.

---

## Update — 2025-10-06: Frontend Refactor and Routing

### Summary of Changes
- Removed the temporary Topics test page (`/topics-test`) and its component `GeminiTopicsTest.jsx`.
- Home (`/`) now renders Gemini topics directly via `useGeminiTopics` (AppSync → Lambda → Gemini).
- WorldMap now sources data from `useGeminiTopics` and converts topics into an article-like shape for existing country grouping and marker sizing.
- Eliminated `useArticles` usage from the Map page; no calls to `http://localhost:8000/api/headlines` from `WorldMap.jsx` anymore.
- Navigation updated: “Topics” link removed from the layout.

### Current Frontend Data Flows
- AppSync-backed topics:
  - `frontend/src/utils/graphqlService.js` → `getGeminiTopics()`
  - `frontend/src/hooks/useGeminiTopics.js`
  - `frontend/src/pages/Home.jsx` (topics list)
  - `frontend/src/components/WorldMap.jsx` (topics-derived map)
- Legacy REST:
  - `frontend/src/utils/api.js` still defines localhost endpoints.
  - `frontend/src/components/Search.jsx` may still call REST; Map no longer does.

### Troubleshooting (GraphQL)
- Observed `net::ERR_ABORTED` against the AppSync GraphQL endpoint during preview.
- Verify in `graphqlService.js`:
  - `aws_appsync_graphqlEndpoint` is correct for the environment.
  - `aws_appsync_region` matches the deployed API.
  - `aws_appsync_apiKey` is valid and not expired.
  - If using IAM or Cognito auth, ensure Amplify configuration aligns.

### Migration Notes
- The Map’s geocoding/grouping logic remains intact by mapping topics to a minimal article shape (title, url, locations/country).
- If you intend to fully retire REST, plan to:
  - Replace `Search.jsx` flows with AppSync-backed search or Lambda resolver.
  - Remove `utils/api.js` and `useArticles.js` once all consumers are migrated.

---

## Update — 2025-10-07: Hourly Refresh via EventBridge + DynamoDB Cache

### Overview
- Implemented an hourly backend refresh that generates Gemini topics and caches them in DynamoDB.
- Frontend reads topics via AppSync; `useGeminiTopics` now also has a 1-hour `localStorage` cache to reduce network calls.

### AWS Services
- EventBridge: Scheduled rule triggers the Lambda hourly (`rate(1 hour)` or `cron(0 * * * ? *)`).
- Lambda (`newsInvokeGemini`): Generates topics and writes to DynamoDB when triggered by schedule; continues to serve API invocations.
- DynamoDB: Single-item cache table storing the latest topics.
- AppSync: Resolver reads topics from DynamoDB instead of invoking Gemini on every request.

### DynamoDB Table (minimal schema)
- Partition key: `id` (string). Use fixed value `latest` for the cache item.
- Item fields:
  - `id`: "latest"
  - `topics`: array of topic objects `{ title, category?, description?, regions?, search_keywords? }`
  - `model`: Gemini model used (e.g., `gemini-2.5-flash`)
  - `limit`: number of topics
  - `updatedAt`: ISO timestamp
  - Optional: `ttl` (Unix epoch seconds) for auto-expiry

### Lambda Handler Changes (newsInvokeGemini)
- Detect EventBridge schedule events and, on scheduled runs, write `{ id: "latest", topics, model, limit, updatedAt }` to DynamoDB.
- Continue to support API invocations returning a JSON response.
- Environment vars:
  - `GOOGLE_GEMINI_API_KEY` (required)
  - `TOPICS_DDB_TABLE` (optional to enable cache writes)
  - `TOPICS_CACHE_ITEM_ID` (default `latest`)
  - `TOPICS_LIMIT` (default `5`)
- IAM: Allow `dynamodb:PutItem` on the `TOPICS_DDB_TABLE`.

### AppSync Resolver (Query.getGeminiTopics)
- Request mapping: `GetItem` on the DynamoDB table with `id = $util.defaultIfNull($ctx.args.id, "latest")` (or fixed `latest`).
- Response mapping: Return `{ topics, ai_powered: true, model, limit }` from the item, with sensible defaults when missing.

### Frontend Updates
- `graphqlService.getGeminiTopics()` remains the entry point; no client-side changes required for the hourly backend refresh.
- `useGeminiTopics`: Added a 1-hour local cache in `localStorage` (key `gemini_topics_cache_v1`).

### Testing & Verification
- Lambda Console:
  - Test API event → returns JSON payload with topics.
  - Test schedule event → writes `id = latest` item to DynamoDB.
- DynamoDB Console: Confirm `latest` item fields (`topics`, `updatedAt`, `model`, `limit`).
- AppSync: Execute `GetGeminiTopics` → returns cached topics from DynamoDB.
- Frontend: Home and Map render topics without excessive refresh.

### Notes
- Keep item size < 400 KB to avoid DynamoDB limits; store only essential fields.
 - All times are UTC for the EventBridge schedule.

---

## Update — 2025-10-08: Summary & Prediction via AppSync (Normalization + URL Support)

### What Changed
- Frontend `frontend/src/utils/graphqlService.js` now normalizes Lambda/AppSync responses:
  - Unwraps Lambda proxy objects `{ statusCode, headers, body }` and parses JSON `body` safely.
  - Reads `model_response` from the returned payload for both summary and predictions.
  - `generateSummary(title, description)` returns a plain string for React rendering.
  - `generatePredictions(article)` returns a structured object `{ impact_analysis, confidence_score, timeline, categories }`.

### AppSync Mutation
- Mutation: `invokeLLM(prompt: String!, max_tokens: Int, temperature: Float)`.
- Resolver returns the raw Lambda result; frontend unpacks and prefers `model_response`.

### Lambda URL Input (Optional)
- Bedrock proxy Lambda (`gpBedrockProxy`) supports a `url` input to fetch article content and include it in the prompt.
- Expected Lambda result shape:
  - Lambda proxy → `statusCode: 200`, `body: { model_response: string | object, meta: { model, tokens, temperature } }`.
- To pass `url` end-to-end:
  - Add `url` to the AppSync mutation input and mapping template.
  - Forward `url` from the frontend when available.

### Testing
- Lambda Console: provide test events with `prompt` or `prompt + url`; confirm `model_response`.
- AppSync Console: run `mutation InvokeLLM` and verify the returned payload includes `model_response`.
- Frontend: Home predictions and summaries render text from `model_response` (no raw objects).

### Deprecation Note
- Avoid legacy REST (`utils/api.js`) for AI flows; summarize/predict paths are now AppSync-first.