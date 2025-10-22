# Lambda Proxy Plan and Secrets Handling

This document captures the minimal Lambda proxy we’ll use for a public frontend (e.g., GitHub Pages) and the sensitive files/secrets to manage in this repo. No key changes required; secrets stay server-side.

## Overview

- Public sites cannot keep secrets in the frontend; anything shipped to the browser is visible.
- The frontend calls a backend or serverless function (Lambda) that holds secrets and proxies requests to external services.

## Lambda Proxy (Node.js 20)

- Purpose: act as a single endpoint for AppSync, OpenAI, NewsData, and Google Geocoding.
- Pattern: `POST /proxy` with `{ action, payload }` and strict CORS.
- Runtime: `nodejs20.x`.

Example `index.js` handler:

```js
export const handler = async (event) => {
  const allowedOrigins = [
    "https://<your-username>.github.io",
    "https://<your-username>.github.io/<your-repo>",
  ];
  const origin = event.headers?.origin || "";
  const corsOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  // Preflight
  if (
    event.requestContext?.http?.method === "OPTIONS" ||
    event.httpMethod === "OPTIONS"
  ) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: "",
    };
  }

  const body =
    typeof event.body === "string"
      ? JSON.parse(event.body || "{}")
      : event.body || {};
  const action = body?.action;
  const payload = body?.payload || {};
  const timeoutMs = Number(process.env.TIMEOUT_MS || 10000);

  const headers = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Content-Type": "application/json",
  };

  const timeout = (ms) =>
    new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), ms));
  const fetchJson = async (url, options) => {
    const res = await Promise.race([fetch(url, options), timeout(timeoutMs)]);
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) throw new Error(JSON.stringify({ status: res.status, data }));
    return data;
  };

  try {
    if (action === "appsync") {
      const endpoint = process.env.GRAPHQL_ENDPOINT;
      const apiKey = process.env.GRAPHQL_API_KEY;
      const { query, variables } = payload || {};
      const data = await fetchJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ query, variables }),
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data }),
      };
    }

    if (action === "openai") {
      const key = process.env.OPENAI_API_KEY;
      const { model, messages, temperature, max_tokens } = payload || {};
      const data = await fetchJson(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens }),
        }
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data }),
      };
    }

    if (action === "newsdata") {
      const key = process.env.NEWSDATA_API_KEY;
      const { q, country, language, page } = payload || {};
      const params = new URLSearchParams({ apiKey: key });
      if (q) params.append("q", q);
      if (country) params.append("country", country);
      if (language) params.append("language", language);
      if (page) params.append("page", String(page));
      const data = await fetchJson(
        `https://newsdata.io/api/1/news?${params.toString()}`,
        { method: "GET" }
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data }),
      };
    }

    if (action === "geocode") {
      const key = process.env.GOOGLE_GEOCODING_KEY;
      const { address } = payload || {};
      const params = new URLSearchParams({ address, key });
      const data = await fetchJson(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
        { method: "GET" }
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: "Unknown action" }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        success: false,
        error: String(err.message || err),
      }),
    };
  }
};
```

### Environment Variables (in Lambda)

- `GRAPHQL_ENDPOINT`
- `GRAPHQL_API_KEY`
- `GOOGLE_GEOCODING_KEY`
- `TIMEOUT_MS` (optional)

Note: OpenAI integration is optional. If you are not using OpenAI,
do not set any OpenAI-related keys and avoid the `action: "openai"` path.

### CORS and API Gateway

- Route: `POST /proxy` → Lambda.
- CORS: allow `https://<your-username>.github.io` and `https://<your-username>.github.io/<your-repo>`.
- Handle `OPTIONS` preflight in Lambda and enable CORS in API Gateway.

### Frontend Call Examples

AppSync through proxy:

```js
fetch("https://<api-gw-domain>/proxy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "appsync",
    payload: {
      query: `query ListTopics { listTopics(limit: 7) { items { title regions } } }`,
      variables: {},
    },
  }),
}).then((r) => r.json());
```

Geocoding through proxy:

```js
fetch("https://<api-gw-domain>/proxy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "geocode",
    payload: { address: "Kyiv, Ukraine" },
  }),
}).then((r) => r.json());
```

### Deployment Tips

- Runtime: `nodejs20.x`.
- Configure env vars in Lambda UI (do not hardcode keys).
- Add throttling/usage plan; consider WAF or rate limits if public.
- Log requests and monitor; set alerts on key usage (Google, AppSync, etc.).

## Sensitive Files in This Repo

Treat these as sensitive if the repo is public. Do not commit real keys.

- `global-perspectives-starter/.env`
  - Contains `GOOGLE_GEOCODING_KEY` (local dev only; `.gitignore` excludes it).
- `global-perspectives-starter/frontend/src/utils/graphqlService.js`
  - Hardcoded AppSync endpoint/region and API key (public if committed).
- `global-perspectives-starter/backend/services/lambda_service.py`
  - Fallback hardcoded `GRAPHQL_API_KEY` if env var missing.
- `amplify/backend/amplify-meta.json`, `amplify/#current-cloud-backend/amplify-meta.json`
  - Include `GraphQLAPIKeyOutput` (should not be in a public repo).
- Generated configs (excluded by `.gitignore` but watch if paths change):
  - `src/aws-exports.js`, `src/amplifyconfiguration.json`.

## Pre-Push Checklist

- Ensure `.env` files are untracked; only keep `.env.example` with placeholders.
- Run a scanner (e.g., `gitleaks detect`) to catch accidental keys.
- If publishing publicly:
  - Remove/avoid committing Amplify meta/current-cloud-backend files with keys.
  - Keep non-Google secrets strictly server-side (Lambda or backend).
- For Google keys used client-side:
  - Restrict by HTTP referrer to your Pages URLs.
  - Restrict by API scope (Maps JavaScript API, Geocoding if needed).
  - Set quotas and alerts.

## Notes

- No key changes required in this plan.
- Public frontend calls the Lambda proxy; Lambda uses env vars to access external services.
