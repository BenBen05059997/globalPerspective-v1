# distribution/cli

Operator scripts for the distribution group. They are not deployed. They shell out to the AWS CLI (the first two
breaking scripts also call Resend) and run from the repo root with the operator's own AWS credentials.

## breaking/

- `review.js`: walks `proposed` and `sent` (emailed to the operator, not yet confirmed) rows in `GlobalPerspectiveBreakingAlerts`, lets the operator add an editor note, then confirm or reject each. `--list` only lists them. Run it after the operator email arrives; only `confirmed` rows reach the site bell, the strip and subscriber breaking emails. Rows with `confirmedAt` set are skipped (scan filter `attribute_not_exists(confirmedAt)`): the rule is "already confirmed once", not `status = 'sent'` or `sent = true`, because newsBreakingAlert's `markSent` writes both on a new proposal it emailed to the operator, and that row must still be offered. The filter only catches legacy rows an older `send.js` demoted from `confirmed` to `sent`.
- `send.js <alertKey> [recipient] [from]`: sends one stored alert draft through Resend to one address and records `sent = true` and `sentAt` on the row. It never changes `status`, so a confirmed alert stays public (readers show `confirmed` only). It does not set `emailedAt` / `emailedCount`, which belong to newsEmailSender's subscriber path. It refuses unless the row is `confirmed`, and refuses a row with `sent = true` (`--force` overrides either, e.g. to send a `proposed` row). Needs `RESEND_API_KEY` in the environment. Run it for a "just me first" end-to-end check.
- `send-test.js [recipient] [from]`: renders a made-up sample alert with the Lambda's own renderer and sends it through Resend. Run it to see the email design in a real inbox. Needs `RESEND_API_KEY`.

## weekly/

- `review.js`: walks `draft` weekly briefs in SummarizeAndPredict and publishes or rejects each. `--list` only lists them. newsWeeklyBrief now writes `published` directly, so this finds a brief only if one was set back to `draft`, the way to hold a bad brief back.

## Tests

`node --test "backend/distribution/cli/test/*.test.js"` from the repo root. Offline: each CLI runs as a child process against a fake `aws` first on PATH (`test/fakeAws.js`) and, for `send.js`, a preloaded fake `fetch` (`test/fakeFetch.js`); stdin answers are fed one per prompt. Covers `breaking/review.js` (what is listed, confirm / note / reject writes, nothing written without an explicit answer, agreement with newsRecommend `list_alerts` / `get_alert`) and `breaking/send.js`. `send-test.js` and `weekly/` have no tests.
