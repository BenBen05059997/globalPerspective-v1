# Drift alert email (newsEmailSender, mode drift_alert) — parked until the first follower

Last verified: 2026-10-19 (rule, target, input and `EMAIL_SEND_DRY_RUN` read from live AWS; behaviour read from the repo source — a deployed zip can differ: `bash scripts/lambda.sh newsEmailSender diff`).

## Trigger
EventBridge rule `TriggerDriftEmailSend`, `cron(40 7 * * ? *)` UTC, input `{"mode":"drift_alert"}` — **DISABLED** on purpose while
no member follows a country. It runs after `TriggerDriftCorrector` (`cron(30 5 * * ? *)`), which writes the day's notes; keep that order.
Live env `EMAIL_SEND_DRY_RUN=false` (real sends; shared with the weekly mode). The breaking-email rule `TriggerBreakingEmailSend` is also DISABLED.
Repo source: `backend/distribution/newsEmailSender/src/` (`runDrift`, ~line 246; `renderDriftEmail.js`).

## What it means
`runDrift` scans `SUMMARY_TABLE` for country drift notes (`COUNTRY#…` / `DRIFT#…`) without `emailedAt` and newer than the cutoff,
groups them by country, and emails each country's notes to `GlobalPerspectiveUserPrefs` rows with `driftOptIn=true`, an `email`
and that country in `followedCountries`. `TEST_RECIPIENT`, if set, replaces the audience (send-to-self). A real send (`sent>0`)
stamps each note `emailedAt`, so a note is emailed once only.

## Check (no side effects)
- Rule state: `aws events describe-rule --name TriggerDriftEmailSend --region ap-northeast-1`
- Hermetic tests: `cd backend/distribution/newsEmailSender/src && node test-sender.js`
- Live dry pass: with no followers every country resolves 0 recipients, `sent:0`, and nothing is stamped:
  `aws lambda invoke --function-name newsEmailSender --cli-binary-format raw-in-base64-out --payload '{"mode":"drift_alert"}' --region ap-northeast-1 "$TMPDIR/drift-out.json"`.
  Expect `ok:true, mode:'drift_alert', subscribers:0, sent:0` (`countries:0` is also a pass: no fresh drift).
- After enabling: `aws logs tail /aws/lambda/newsEmailSender --since 1d --region ap-northeast-1 --filter-pattern '"[email:drift]"'`

## Fix — turning it on (each step needs a fresh operator yes: real mail, env change, rule enable)
1. Send-to-self: fetch the env (`aws lambda get-function-configuration --function-name newsEmailSender`), add
   `TEST_RECIPIENT=<operator email>` to the full map, write it back from a temp file, invoke as above, check the email
   (subject, country, notes, links, footer), then remove `TEST_RECIPIENT` the same way at once. Tested notes are burned
   (`emailedAt`); do not do this on a day a real follower waits for that note.
2. Real path: a member follows a country with a fresh "What changed" note, invoke without `TEST_RECIPIENT`, confirm the
   email and the unsubscribe round-trip (`newsRecommend`, kind `drift`).
3. `aws events enable-rule --name TriggerDriftEmailSend`, then `describe-rule` → `ENABLED`; check the next 07:40 run's log.
Rollback at any point: `aws events disable-rule --name TriggerDriftEmailSend`.
Never use `EMAIL_SEND_DRY_RUN` as a test lever: it silences the live weekly email.

## Escalate
- Enabling user-facing sends is the operator's decision (CLAUDE.md, Authorization). Each AWS mutation is a bare single command.
- After enabling, update this runbook, `project-docs/reference/` (re-run `node scripts/gen-reference.mjs`) and ARCHITECTURE's email section.
