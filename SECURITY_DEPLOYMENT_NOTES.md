# Security & Deployment Notes

**Last verified:** 2026-03-20

This app is hosted on GitHub Pages (custom domain: globalperspective.net) and calls the `newsSensitiveData` Lambda via API Gateway. Keep these items in mind when updating infrastructure or pushing new builds.

---

## CORS on `newsSensitiveData`

The Lambda hard-codes an `allowedOrigins` list. Current allowed origins:

```js
const allowedOrigins = [
  'https://benben05059997.github.io',
  'https://benben05059997.github.io/GlobalPerspective',
  'https://globalperspective.net',
  'https://www.globalperspective.net',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
```

- If you serve from a new domain, add it explicitly before deploying. Avoid `*` wildcards.
- After editing, redeploy the Lambda so API Gateway returns the updated `Access-Control-Allow-Origin` header.
- The Lambda also allows `Authorization`, `x-api-key` headers (needed for auth and legacy API key fallback).

---

## Auth Security

All gated API actions (`archive_range`, `narrative_thread`, `thread_analysis`, `country_intelligence`, `user_profile`, `portal_session`) require a **Firebase ID token** in the `Authorization: Bearer <token>` header.

- Tokens are verified server-side via Firebase Admin SDK (`verifyIdToken`)
- Tokens expire after **1 hour** — Firebase JS SDK auto-refreshes them
- The user's tier (`free` / `member` / `enterprise`) is read from DynamoDB `USERS_TABLE` keyed by Firebase UID
- Never trust client-supplied tier information — always resolve from DDB

**Stripe webhook security:** `newsStripeWebhook` verifies the Stripe webhook signature using `STRIPE_WEBHOOK_SECRET` before processing any event. Never skip signature verification.

---

## GitHub Pages Runtime Config

The `docs/config.js` file sets runtime configuration injected into `window`:

```js
window.SENSITIVE_PROXY_ENDPOINT = 'https://...execute-api.../proxy';
window.FIREBASE_CONFIG = { apiKey: '...', authDomain: '...', ... };
window.GOOGLE_MAPS_API_KEY = '...';
```

**Never overwrite `docs/config.js` during deployment** — it is not bundled into the Vite build. The deployment workflow copies `dist/assets/` and `dist/index.html` only.

Because the API Gateway endpoint is visible in `docs/config.js`:
- Enforce CORS (above) to limit who can call the endpoint
- Rate-limit or throttle traffic in API Gateway if needed
- Keep all actual secrets (xAI API key, Stripe keys, Firebase Admin credentials) only in Lambda environment variables — never in `config.js`

---

## Secrets in Lambda Environment Variables

Never commit secrets to the repository. All sensitive values live in Lambda environment variables set via AWS Console:

| Lambda | Key env vars |
|--------|-------------|
| newsInvokeGemini | `XAI_API_KEY`, `BRAVE_SEARCH_API_KEY` |
| NewsProjectInvokeAgentLambda | `XAI_API_KEY` |
| newsThreadAnalysis | `XAI_API_KEY`, `BRAVE_SEARCH_API_KEY` |
| newsCountryIntelligence | `XAI_API_KEY`, `BRAVE_SEARCH_API_KEY` |
| newsSensitiveData | `MAPBOX_GEOCODING_KEY`, Firebase Admin credentials, `STRIPE_SECRET_KEY` |
| newsStripeWebhook | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| newsPostLinkedIn | All social media tokens |
| newsPostDevTo | `DEVTO_API_KEY`, `OPENROUTER_API_KEY` |

---

## General Hygiene

- Do not commit `.env` or credential files; `.env.example` is safe.
- Keep `node_modules/` and build artifacts out of source control.
- The Firebase service account key (`globalperpectives-firebase-adminsdk-*.json`) must never be committed — use it only to set Lambda environment variables.
- Rotate API keys if you suspect abuse or accidental exposure.
- When removing old planning documents, confirm they are truly obsolete so future contributors don't miss context.
