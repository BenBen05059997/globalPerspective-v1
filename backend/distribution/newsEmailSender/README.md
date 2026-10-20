# newsEmailSender

One email sender dispatched by `event.mode`: `weekly` (published S3 `weekly/latest.json` to `digestOptIn`
subscribers, once per `weekEnding`, retaining the `EMAILLOG#weekly#<week>` marker), `breaking` (fresh `status: confirmed` alerts to `breakingOptIn`
subscribers), `drift_alert` (fresh country `DRIFT#` notes to `driftOptIn` members who follow that
country). Sends via Resend with a List-Unsubscribe link served by newsRecommend.

## Deployment
- Deployed name `newsEmailSender` · runtime `nodejs20.x` · group `distribution` (scripts/functions.json)
- Triggers (EventBridge, UTC): `TriggerWeeklyEmailSend` `cron(0 14 ? * SUN *)` `{"mode":"weekly"}` ENABLED; `TriggerBreakingEmailSend` `rate(15 minutes)` `{"mode":"breaking"}` DISABLED; `TriggerDriftEmailSend` `cron(40 7 * * ? *)` `{"mode":"drift_alert"}` DISABLED.
- Deploy: `scripts/lambda.sh newsEmailSender diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `USER_PREFS_TABLE` (default `GlobalPerspectiveUserPrefs`): scan opt-in flags, `email`, `unsubToken`, `followedCountries`.
- S3 `WORLD_BUCKET` (default `globalperspective-world-280362093938`): reads `weekly/latest.json` through `_shared/s3json.js`; skips and logs missing, held, nonpublished and wrong-Sunday snapshots. Read errors fail visibly, without a DynamoDB fallback.
- DynamoDB `SUMMARIZE_PREDICT_TABLE` (default `SummarizeAndPredict`): `COUNTRY#`/`DRIFT#` notes (sets `emailedAt`); weekly marker `EMAILLOG#weekly#<weekOf>`/`EMAIL_LOG`.
- DynamoDB `BREAKING_ALERTS_TABLE` (default `GlobalPerspectiveBreakingAlerts`): confirmed, not-yet-emailed rows newer than `BREAKING_FRESH_HOURS` (48); sets `emailedAt`.
- External: Resend `api.resend.com` (`RESEND_API_KEY`, `EMAIL_FROM`); site links come from `src/_shared/links.js` (weekly brief: `briefingHref`; drift: `countryHref`, no link when the name is not a country), env `SITE_URL` only overrides the origin; `UNSUB_BASE_URL` (newsRecommend Function URL).

## Gotchas
- `EMAIL_SEND_DRY_RUN` defaults ON: anything other than `false` logs recipients and sends nothing.
- `TEST_RECIPIENT` overrides the whole audience with one address.
- Enabling the breaking or drift rules is a user-facing send: needs a fresh operator yes (CLAUDE.md).
- Breaking mode only sends rows a human set to `confirmed` (newsBreakingAlert writes `proposed`).
- `*Verified` fields: missing counts as OK, only `false` blocks. Scans page through all results (cap 50 pages).
- `DRIFT#` prefix match excludes the permanent `DRIFTLOG#` archive; `DRIFT_FRESH_HOURS` default 36.

## Tests
- `cd backend/distribution/newsEmailSender/src && node test-sender.js` (hermetic, stubs AWS + fetch): 58 pass.

- `node --test backend/distribution/newsEmailSender/src/test-weekly-render.js`: renders the committed W2 dry-run fixture to HTML and text, checks a structure snapshot, escaping, labels and empty sections.

## Weekly v2 rendering and packaging

`src/_weekly` is a committed relative symlink to `backend/weekly/runtime/`. The renderer imports its section model;
no content rules are copied into the sender. The top-level weekly sections.js is a compatibility symlink to the same runtime file; tests and fixtures are outside the shipped directory. It uses a light 600 px presentation table, the canonical
section order and required-empty wording, FACT / JUDGMENT labels, confidence words or logged probability,
numerical risk plus tier, source citations and the existing shared link builders. Optional empty sections
are skipped as specified by the section model. Email word budgets omit complete story groups and retain
complete fact/judgment blocks; the stored JSON is never shortened. Unsubscribe links carry the existing
unsubscribe token; story/weekly links never carry a sign-in token. `force:true` cannot bypass a sent marker or the current-Sunday gate.

Before a coordinator deploys, grant the sender s3:GetObject on weekly/* and verify `_weekly/sections.js`
is in the staged zip as a real file. scripts/lambda.sh uses rsync -aL and already follows this second
symlink. This lane does not edit IAM, packaging scripts, schedules, or deploy/send anything.

Last verified locally: 2026-10-20 (hermetic tests; no live send)

## Weekly delivery failures and retries

Weekly S3, rendering, delivery and marker-write errors reject the invocation and emit
`[pipeline-status]` with `stage7` and `failed`, so native Lambda Errors can alert.
Missing/stale/held editions and empty audiences remain successful skips. A partial
delivery never writes the completed edition marker. Each successful recipient gets
a strongly read `EMAILLOG#weekly#<week>#recipient#<sha256(normalized email)>` receipt
with the existing EMAIL_LOG shape and 180-day TTL. A retry skips those receipts and
attempts the remaining recipients before writing the existing edition marker. Dry-run
never writes either marker.

Run one weekly invocation at a time. These receipts cover recorded successes, not a
provider-accepted delivery followed by a process crash or failed receipt write; that
ambiguous boundary can repeat mail and needs operator reconciliation before retry.
Breaking/drift delivery behavior remains outside this weekly-mode change.
