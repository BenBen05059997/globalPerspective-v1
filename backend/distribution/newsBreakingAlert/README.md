# newsBreakingAlert

Each pipeline cycle: groups the latest topics into stories by `threadId`, scores each deterministically
(`src/significance.js`: sources, topic count, region risk, economic magnitude, velocity; continuations
face a raised bar), picks at most ONE un-deduped story above the threshold, renders an email
(`src/render.js`) and writes a `status: 'proposed'` row. With `DRY_RUN` off and `RESEND_API_KEY` set it
emails `ALERT_EMAIL_TO` (operator, not subscribers) and marks the row sent. LLM verify is a stub (`pending`).

## Deployment
- Deployed name `newsBreakingAlert` · runtime `nodejs22.x` · group `distribution` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerBreakingAlert` `cron(35 4/8 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsBreakingAlert diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB read: `TOPICS_DDB_TABLE` (`id: 'latest'`); `SUMMARIZE_PREDICT_TABLE` `COUNTRY#<r>`/`COUNTRY_INTELLIGENCE`, `ECON#THREAD#<id>`/`ECONOMIC_IMPACT`, `THREAD#<id>`/`THREAD_ANALYSIS`, `TOPIC#<id>`/`SUMMARY|PREDICTION|TRACE_CAUSE`.
- DynamoDB write: `BREAKING_ALERTS_TABLE` (default `GlobalPerspectiveBreakingAlerts`), key `alertKey` = threadId; doubles as dedupe row (`DEDUPE_DAYS` 5, `ttl` `DEDUPE_TTL_DAYS` 14).
- External: Resend `api.resend.com` (`src/sendEmail.js`), only when `DRY_RUN === 'false'`. Links use `SITE_URL`.

## Gotchas
- `DRY_RUN` defaults ON: anything other than the string `false` sends nothing.
- The header comment says it never auto-sends and waits for human confirm (`backend/distribution/cli/breaking/review.js`); the code auto-sends to the operator when `DRY_RUN` is off.
- Tune via `SIGNIFICANCE_THRESHOLD` (code default 2.0). `node index.js` runs a local pass against prod tables (writes the proposal row).
- Subscriber breaking sends live in `newsEmailSender` (its breaking rule is DISABLED).

## Tests
- `cd backend/distribution/newsBreakingAlert/src && npm test` (node --test ../test/*.test.js + `node test-significance.mjs`): all pass (50/50 in test-significance).

Last verified: 2026-10-19
