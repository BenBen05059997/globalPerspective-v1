# Security & Deployment Notes

This app is hosted on GitHub Pages and calls the `newsSensitiveData` Lambda via API Gateway. Keep these items in mind when updating infrastructure or pushing new builds.

## CORS on `newsSensitiveData`
- The Lambda hard-codes an `allowedOrigins` list. Make sure it only includes trusted domains:
  ```js
  const allowedOrigins = [
    'https://BenBen05059997.github.io',
    'https://BenBen05059997.github.io/GlobalPerspective',
    'http://localhost:5173',             // Optional dev origin
  ];
  ```
- If you serve from a new domain, add it explicitly before deploying. Avoid using `*` or other broad wildcards.
- After editing, redeploy the function so API Gateway returns the updated `Access-Control-Allow-Origin` header.

## GitHub Pages Runtime Config
- The static build requires `config.js` with `window.SENSITIVE_PROXY_ENDPOINT`. Because that URL is public in the deployed bundle, treat the Lambda as an exposed endpoint:
  - enforce CORS (above),
  - throttle or rate-limit traffic in API Gateway/Lambda,
  - keep backend secrets (Gemini keys, etc.) only in Lambda env vars.
- When cloning locally, copy `public/config.example.js` to `public/config.js` and paste the real URL before running `npm run dev` or `npm run build`.
- For GitHub Pages deploys: run `npm run build`, then upload the `dist/` contents (which include the real `config.js`). Rotate the endpoint URL if you ever suspect abuse.

## General Hygiene
- Do not commit `.env` or other credential files; `.env.example` is safe to share.
- Keep `node_modules/` and build artifacts out of source control unless explicitly required.
- When removing old plan documents, make sure they are truly obsolete so future contributors are not missing context.
