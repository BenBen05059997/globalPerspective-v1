# Lambda + AppSync Proxy Overview

## Purpose
- Provide a safe public entry point for a static website (e.g., GitHub Pages) to call sensitive operations without exposing secrets.
- Keep all private keys in AWS (Lambda env vars or AWS Secrets Manager) and use AppSync with API Key for browser access.

## Components
- `newsSensitiveData` (Lambda): A proxy that performs sensitive operations using server-side secrets.
  - Actions supported: `appsync` (GraphQL proxy), `geocode` (Google Geocoding), `openai` (optional), `newsdata` (deprecated/removed).
  - Handles CORS and timeouts; validates responses.
- AppSync GraphQL API: Public endpoint with API Key used by the browser.
  - Schema includes `proxySensitive(action: String!, payload: AWSJSON): AWSJSON`.
  - Resolver maps `proxySensitive` to the Lambda and passes arguments as an HTTP-style event the Lambda already understands.

## Lambda Behavior
- Expects an event with `httpMethod`, optional `headers.origin`, and a JSON `body` containing `{ action, payload }`.
- Reads secrets from environment variables (e.g., `GRAPHQL_ENDPOINT`, `GRAPHQL_API_KEY`, `GOOGLE_GEOCODING_KEY`).
- Implements CORS:
  - Allowed origins list in code (GitHub Pages domains).
  - Replies to `OPTIONS` preflight and sets `Access-Control-Allow-Origin`.
- Example geocode branch:
  - `GET https://maps.googleapis.com/maps/api/geocode/json?address=<...>&key=<GOOGLE_GEOCODING_KEY>`

## AppSync Schema (updated)
```
type GeminiTopic {
  title: String!
  category: String!
  search_keywords: [String!]!
  regions: [String!]!
}

type GeminiTopicsCache {
  id: ID!
  topics: [GeminiTopic]!
  model: String
  limit: Int
  updatedAt: AWSDateTime
}

type GeminiTopicsResult {
  topics: [GeminiTopic!]!
  ai_powered: Boolean!
  model: String
  limit: Int
}

type Topic {
  title: String
  category: String
  search_keywords: [String]
  regions: [String]
}

type Mutation {
  invokeLLM(
    prompt: String!,
    max_tokens: Int,
    temperature: Float,
    url: String
  ): AWSJSON
}

type Query {
  _health: String
  getGeminiTopics(limit: Int, model: String): GeminiTopicsResult!
  proxySensitive(action: String!, payload: AWSJSON): AWSJSON
}

schema {
  query: Query
  mutation: Mutation
}
```

## Resolver Mapping (Lambda data source)
- Request (VTL) — parse `AWSJSON` string into an object for Lambda:
```
{
  "version": "2017-02-28",
  "operation": "Invoke",
  "payload": {
    "httpMethod": "POST",
    "headers": {
      "origin": "$context.request.headers.origin"
    },
    "body": $util.toJson({
      "action": $ctx.args.action,
      "payload": $util.parseJson($ctx.args.payload)
    })
  }
}
```
- Response (VTL):
```
#if($ctx.error)
  $util.error($ctx.error.message, $ctx.error.type)
#end
$util.parseJson($ctx.result.body)
```

## Testing
- AppSync Console → Queries:
  - Query:
    ```
    query GeocodeProxy($payload: AWSJSON!) {
      proxySensitive(action: "geocode", payload: $payload)
    }
    ```
  - Variables:
    ```
    { "payload": "{\"address\":\"Kyiv, Ukraine\"}" }
    ```
  - Expect: `{ success: true, data: { ... geocoding results ... } }`.

- Curl (replace endpoint and API key):
  ```
  curl -X POST 'https://<GRAPHQL_ENDPOINT>' \
    -H 'Content-Type: application/json' \
    -H 'x-api-key: <API_KEY>' \
    -d '{"query":"query($payload: AWSJSON!){ proxySensitive(action:\"geocode\", payload:$payload) }","variables":{"payload":"{\"address\":\"Kyiv, Ukraine\"}"}}'
  ```

- Direct Lambda (no public endpoint):
  ```
  aws lambda invoke --function-name <newsSensitiveData> \
    --payload '{"action":"geocode","payload":{"address":"Kyiv, Ukraine"}}' \
    --cli-binary-format raw-in-base64-out response.json && cat response.json
  ```

## Security and CORS
- No secrets in the frontend; all keys remain in Lambda or Secrets Manager.
- Ensure AppSync API Key is restricted and rotated regularly.
- If you add API Gateway later, match CORS origins with the Lambda allowed origins.
- Validate inputs and apply rate limits (WAF/AppSync throttling) to prevent abuse.

## Deployment Options
- Preferred: AppSync-only public entry (API Key) → Lambda data source.
- Alternative: API Gateway `POST /proxy` → Lambda with CORS enabled for GitHub Pages.

## Notes
- OpenAI is optional; remove or ignore the `openai` action if not used.
- External News APIs (NewsAPI/NewsData) are deprecated; use Gemini/AppSync flows.
- For typed payloads, you can replace `AWSJSON` with a GraphQL `input` type to pass object literals directly.