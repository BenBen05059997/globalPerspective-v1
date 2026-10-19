# newsRecommend

Content-based recommendations (no ML) plus notification preferences. Default action ranks the `latest` topic pool: personalized from the user's saved items when a valid Firebase JWT is sent, else "Trending" (popularity x recency); scorer is `scoring.js`. Other actions: `get_prefs`/`set_prefs` (JWT; email opt-ins, default off), `follow_country`/`unfollow_country` (JWT + member tier, fail-closed), public `list_alerts` (bell feed; each alert's `url` is its story page when it has a thread arc, else the map) and `get_alert` (single alert; `threadUrl` only with an arc), and public token-auth `unsubscribe` (GET or RFC 8058 POST, returns HTML). Direct invoke `{ uid?, limit? }` returns recommendations without HTTP.

## Deployment
- Deployed name `newsRecommend` · runtime `nodejs20.x` · group `read-api` (scripts/functions.json)
- Trigger: Function URL (frontend via `shared/api/restProxy.js`; newsEmailSender uses it as `UNSUB_BASE_URL`); no schedule
- Deploy: `scripts/lambda.sh newsRecommend diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `id = latest`
- DynamoDB `SAVED_ITEMS_TABLE`: Query by `uid`
- DynamoDB `USER_PREFS_TABLE` (key `uid`): caches `interestProfile`; reads/writes prefs, `followedCountries` (String Set, atomic ADD/DELETE), consent and `unsubToken`
- DynamoDB `BREAKING_ALERTS_TABLE` (default `GlobalPerspectiveBreakingAlerts`): Scan for status `confirmed`/`sent`; GetItem by `alertKey`
- DynamoDB `USERS_DDB_TABLE` (default `GlobalPerspectiveUserTable`): reads `tier` (written by newsPolarBilling)
- External APIs: Google securetoken x509 certs (JWT verify, `FIREBASE_PROJECT_ID`)

## Gotchas
- CORS: code does not emit `Access-Control-Allow-Origin`, so the Function-URL CORS config must stay populated.
- Profile caching is fire-and-forget; a failure only logs.
- `list_alerts` returns `[]` when the alerts table is absent or empty.
- Site addresses (story, map) come from `src/_shared/links.js` (symlink to `backend/shared/src`, zipped as real files); env `SITE_URL` only overrides the origin.
- Following a country also opts the user into drift email and stamps consent + unsubscribe token.

## Tests
- `cd backend/read-api/newsRecommend/src && npm test` (`node test-scoring.mjs`, offline): 14 passed 2026-10-19.

Last verified: 2026-10-19
