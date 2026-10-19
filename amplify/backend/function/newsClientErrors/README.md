# newsClientErrors

Passive client-error sink. A public, unauthenticated Function URL receives uncaught frontend errors
(POST JSON `message`, `stack`, `url`, `userAgent`, `kind`) and aggregates them into one counter row
per day + error fingerprint (sha1 of message + first stack frame, line:col and digits normalized).
Kept off the content proxy on purpose (bursty, untrusted traffic). Read rows back with
`node scripts/errors.mjs`.

## Deployment
- Deployed name `newsClientErrors` · runtime `nodejs24.x` · group `read-api` (scripts/functions.json)
- Trigger: Function URL (POST; OPTIONS answered 200); no schedule.
- Deploy: `scripts/lambda.sh newsClientErrors diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB: `CLIENT_ERRORS_TABLE`, key `errKey` = `<YYYY-MM-DD>#<hash16>`; `ADD count`, first/last seen, sample stack/url/UA, `ttl` = now + `ERROR_TTL_DAYS` (default 30).
- No S3, no external APIs.

## Gotchas
- CORS: code does NOT emit `Access-Control-Allow-Origin`, so its Function-URL CORS config must be populated.
- Abuse bounds: body > 16 KB -> 413; per-field caps (message 2000, stack 8000, url 1000, UA 500); missing `message` -> 400.
- Missing `CLIENT_ERRORS_TABLE` env -> 500 on every request.

## Tests
- None.

Last verified: 2026-10-19
