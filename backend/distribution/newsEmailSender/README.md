# newsEmailSender

One email sender dispatched by `event.mode`: `weekly` (latest published `WEEKLY_BRIEF` to `digestOptIn`
subscribers, once per `weekOf`), `breaking` (fresh `status: confirmed` alerts to `breakingOptIn`
subscribers), `drift_alert` (fresh country `DRIFT#` notes to `driftOptIn` members who follow that
country). Sends via Resend with a List-Unsubscribe link served by newsRecommend.

## Deployment
- Deployed name `newsEmailSender` · runtime `nodejs22.x` · group `distribution` (scripts/functions.json)
- Triggers (EventBridge, UTC): `TriggerWeeklyEmailSend` `cron(0 14 ? * SUN *)` `{"mode":"weekly"}` ENABLED; `TriggerBreakingEmailSend` `rate(15 minutes)` `{"mode":"breaking"}` DISABLED; `TriggerDriftEmailSend` `cron(40 7 * * ? *)` `{"mode":"drift_alert"}` DISABLED.
- Deploy: `scripts/lambda.sh newsEmailSender diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `USER_PREFS_TABLE` (default `GlobalPerspectiveUserPrefs`): scan opt-in flags, `email`, `unsubToken`, `followedCountries`.
- DynamoDB `SUMMARIZE_PREDICT_TABLE` (default `SummarizeAndPredict`): scan `SK = WEEKLY_BRIEF`; `COUNTRY#`/`DRIFT#` notes (sets `emailedAt`); weekly marker `EMAILLOG#weekly#<weekOf>`/`EMAIL_LOG`.
- DynamoDB `BREAKING_ALERTS_TABLE` (default `GlobalPerspectiveBreakingAlerts`): confirmed, not-yet-emailed rows newer than `BREAKING_FRESH_HOURS` (48); sets `emailedAt`.
- External: Resend `api.resend.com` (`RESEND_API_KEY`, `EMAIL_FROM`); site links come from `src/_shared/links.js` (weekly brief: `briefingHref`; drift: `countryHref`, no link when the name is not a country), env `SITE_URL` only overrides the origin; `UNSUB_BASE_URL` (newsRecommend Function URL).
- env `RECORD_READS` = `ddb` (default, unset = this) | `record` | `compare` (decision 0054). Only the weekly email's brief content moves: `record` reads the newest published `briefs/weekly/<weekOf>.json` (listed by `index/briefs.json`) when it is under 6 days old and the views are under 9 h old, else the `WEEKLY_BRIEF#` scan; the rendered email is identical (`backend/record/cli/compare-record-reads.mjs --only weekly` renders all 13 published weeks from the row and from the view). The sent marker `EMAILLOG#weekly#<weekOf>` and the recipients (`GlobalPerspectiveUserPrefs`) stay in DynamoDB. The drift email (rule DISABLED) still scans `COUNTRY#`/`DRIFT#` and stamps `emailedAt` on the row: moving it needs a drift reader on the notes and its sent marker in an operational store (decision 0054). Needs `s3:GetObject` on `record/views/*` (shared role `newsprojectLambdaRolefcb19312-dev`).

## Gotchas
- `EMAIL_SEND_DRY_RUN` defaults ON: anything other than `false` logs recipients and sends nothing.
- `TEST_RECIPIENT` overrides the whole audience with one address.
- Enabling the breaking or drift rules is a user-facing send: needs a fresh operator yes (CLAUDE.md).
- Breaking mode only sends rows a human set to `confirmed` (newsBreakingAlert writes `proposed`).
- `*Verified` fields: missing counts as OK, only `false` blocks. Scans page through all results (cap 50 pages).
- `DRIFT#` prefix match excludes the permanent `DRIFTLOG#` archive; `DRIFT_FRESH_HOURS` default 36.

## Tests
- `cd backend/distribution/newsEmailSender/src && node test-sender.js` (hermetic, stubs AWS + fetch).
