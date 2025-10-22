# Credentials Handling and Lambda Proxy via AppSync

## Goals
- Keep all private keys (Gemini, NewsAPI, NewsData, etc.) off the frontend.
- Use AppSync with `API_KEY` for public, read-only operations.
- Route sensitive calls through AWS Lambda via AppSync resolvers.
- Centralize secrets in AWS (Lambda env vars or AWS Secrets Manager).

## Architecture Overview
- Frontend (Vite/React) talks only to AppSync GraphQL using `API_KEY`.
- AppSync invokes Lambda functions for any operation requiring private keys.
- Lambda calls third-party APIs using secrets stored in env or Secrets Manager.
- Responses are returned to the client through AppSync.

## Public Entry Points (No Frontend Code Changes)
- Option A — AppSync Resolver (recommended):
  - Add a Lambda data source and a resolver field (e.g., `query Proxy(action: String!, payload: AWSJSON): AWSJSON`).
  - Frontend calls AppSync only; AppSync routes sensitive requests to Lambda.
- Option B — API Gateway HTTP API:
  - Create `POST /proxy` → integrate with `newsSensitiveData` Lambda.
  - Enable CORS for your GitHub Pages origin; Lambda already handles `OPTIONS` and sets CORS headers.
  - Frontend uses `fetch('https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/proxy', {...})`.

## Frontend (Public API Key)
- Use Vite envs for non-secret values and AppSync API key.
- Ensure GraphQL client forces API key mode and avoids IAM.

### Files to Modify (Frontend)
- `global-perspectives-starter/frontend/.env`
  - Add:
    - `VITE_APPSYNC_GRAPHQL_ENDPOINT=<your AppSync endpoint>`
    - `VITE_APPSYNC_REGION=<region>`
    - `VITE_APPSYNC_AUTH_TYPE=API_KEY`
    - `VITE_APPSYNC_API_KEY=<api key>`
    - Optional: `VITE_GOOGLE_MAPS_API_KEY=<maps key>`
- `global-perspectives-starter/frontend/src/utils/graphqlService.js`
  - Confirm Amplify uses env vars and set `authMode: 'apiKey'` in `client.graphql(...)` calls.
- `global-perspectives-starter/frontend/src/hooks/useGeminiTopics.js`
  - Fetch `7` topics: `graphqlService.getGeminiTopics(7)`.
- `global-perspectives-starter/frontend/src/components/WorldMap.jsx`
  - No secrets; ensure it relies on topics fetched through AppSync.

## Backend (Private Keys via Lambda Proxy)
- Add/extend Lambda functions to call third-party APIs.
- Store secrets in Lambda env or AWS Secrets Manager.
- Wire AppSync resolvers to these functions.

### Files to Modify (Amplify/AppSync/Lambda)
- `amplify/backend/api/newsproject/schema.graphql`
  - Add queries/mutations that require proxying, e.g.:
    - `getGeminiTopics(limit: Int, model: String): AWSJSON`
    - `searchNews(query: String, limit: Int): AWSJSON`
  - Keep existing `invokeLLM` for LLM/summary use.
- `amplify/backend/api/newsproject/resolvers/`
  - Create/modify VTL or pipeline resolvers that target Lambda data sources.
- `amplify/backend/api/newsproject/cli-inputs.json` and `parameters.json`
  - Ensure default auth is `API_KEY`, set key expiry/rotation policies.
  - Register Lambda data sources if not present.
- `amplify/backend/function/newsInvokeGemini/src/index.*`
  - Implement Gemini proxy (reads model, limit; uses secret key).
- `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.*`
  - Implement LLM invocation and any summarization/prediction logic.
- Optional: Secrets Manager integration
  - Lambda reads secrets from AWS Secrets Manager instead of env vars.
  - Add IAM permissions in `custom-policies.json` for secret access.

## Implementation Steps
1. Frontend
   - Create `.env` in `global-perspectives-starter/frontend` with `VITE_APPSYNC_*`.
   - Restart dev server; verify GraphQL requests include `x-api-key`.
   - Confirm `useGeminiTopics` returns `7` topics.
2. AppSync Schema
   - Extend `schema.graphql` with `getGeminiTopics` and any news proxy queries.
   - Run `amplify push` to update API.
3. Lambda Functions
   - Implement proxy logic in `newsInvokeGemini` to call Gemini/News APIs.
   - Read secrets from env or Secrets Manager.
   - Validate input and apply limits.
4. Resolvers
   - Map queries to Lambda data sources (request/response mapping).
   - Test via AppSync console.
5. Security & Ops
   - Use WAF rate limits on AppSync.
   - Rotate AppSync API key regularly; set expiration.
   - Monitor usage (CloudWatch logs, AppSync metrics).

## Security Considerations
- Do not place private keys in frontend `.env`.
- Prefer AWS Secrets Manager for rotation and auditing.
- Lock down Lambda IAM to minimum required APIs/resources.
- Validate and sanitize inputs in Lambda to prevent abuse.

## Rollout Checklist
- Frontend `.env` set and dev server restarted.
- GraphQL client uses `authMode: 'apiKey'` explicitly.
- AppSync schema includes proxy queries.
- Lambda functions deployed with secrets configured.
- Resolvers mapped and tested end-to-end.
- If using API Gateway: HTTP API created, `POST /proxy` route configured, CORS enabled, curl test passes.
- WAF/rate limits enabled; monitoring in place.

## Future Enhancements
- Move to Cognito User Pools for authenticated features.
- Add caching (e.g., DynamoDB + TTL) in Lambda for popular queries.
- Introduce per-IP throttling and anomaly detection.