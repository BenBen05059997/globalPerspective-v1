# newsBreakingAlert

Each pipeline cycle: groups the latest topics into stories by `threadId`, scores each deterministically
(`src/significance.js`: sources, topic count, region risk, velocity; continuations
face a raised bar), picks at most ONE un-deduped story above the threshold, renders an email
(`src/render.js`) and writes a `status: 'proposed'` row. With `DRY_RUN` off and `RESEND_API_KEY` set it
emails `ALERT_EMAIL_TO` (operator, not subscribers) and marks the row `sent`. The email is flagged NOT PUBLIC until confirmed and names the confirm command (`node backend/distribution/cli/breaking/review.js`). `sent` is not public: readers see an alert only once the operator sets it `confirmed`. LLM verify is a stub (`pending`).

## Deployment
- Deployed name `newsBreakingAlert` · runtime `nodejs22.x` · group `distribution` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerBreakingAlert` `cron(35 4/8 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsBreakingAlert diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB read: `TOPICS_DDB_TABLE` (`id: 'latest'`); `SUMMARIZE_PREDICT_TABLE` `COUNTRY#<r>`/`COUNTRY_INTELLIGENCE`, `THREAD#<id>`/`THREAD_ANALYSIS`, `TOPIC#<id>`/`SUMMARY|PREDICTION|TRACE_CAUSE`.
- DynamoDB write: `BREAKING_ALERTS_TABLE` (default `GlobalPerspectiveBreakingAlerts`), key `alertKey` = threadId; doubles as dedupe row (`DEDUPE_DAYS` 5, `ttl` `DEDUPE_TTL_DAYS` 14).
- External: Resend `api.resend.com` (`src/sendEmail.js`), only when `DRY_RUN === 'false'`. Story links come from `src/_shared/links.js` (`storyHref` + `absoluteUrl`; env `SITE_URL` only overrides the origin), and only when the story has a real thread arc.
- env `RECORD_READS` = `ddb` (default, unset = this) | `record` | `compare` (decision 0054). `record` reads the topic pool (`latest`), `THREAD_ANALYSIS` and `COUNTRY_INTELLIGENCE` from the record's views and DynamoDB when a view cannot answer (a region spelled differently from the stored briefing, such as `USA`, has no record row, as it had none in DynamoDB); `compare` logs and decides from DynamoDB. `TOPIC#` rows (summary, prediction, cause) and the alerts table stay in DynamoDB. Needs `s3:GetObject` on `record/views/*` (role `newsBreakingAlert-role`).

## Gotchas
- `DRY_RUN` defaults ON: anything other than the string `false` sends nothing.
- Live it emails the operator when `DRY_RUN` is off, but the alert stays hidden from readers until `backend/distribution/cli/breaking/review.js` sets it `confirmed`.
- `placeFilter` (`usableCountryRecord`) comes from `backend/shared/src` through the `src/_shared` symlink.
- Tune via `SIGNIFICANCE_THRESHOLD` (code default 2.0). `node index.js` runs a local pass against prod tables (writes the proposal row).
- Subscriber breaking sends live in `newsEmailSender` (its breaking rule is DISABLED).

## Tests
- `cd backend/distribution/newsBreakingAlert/src && npm test` (node --test ../test/*.test.js + `node test-significance.mjs`).
