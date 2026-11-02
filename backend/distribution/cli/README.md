# distribution/cli

Operator scripts for the distribution group. They are not deployed. They shell out to the AWS CLI (the first two
breaking scripts also call Resend) and run from the repo root with the operator's own AWS credentials.

## breaking/

- `review.js`: walks `proposed` and `sent` (emailed, not yet confirmed) rows in `GlobalPerspectiveBreakingAlerts`, lets the operator add an editor note, then confirm or reject each. `--list` only lists them. Run it after the operator email arrives; only `confirmed` rows reach the site bell, the strip and subscriber breaking emails.
- `send.js <alertKey> [recipient] [from]`: sends one stored alert draft through Resend to one address and marks it sent. It refuses unless the row is `confirmed`; `--force` allows a `proposed` row. Needs `RESEND_API_KEY` in the environment. Run it for a "just me first" end-to-end check.
- `send-test.js [recipient] [from]`: renders a made-up sample alert with the Lambda's own renderer and sends it through Resend. Run it to see the email design in a real inbox. Needs `RESEND_API_KEY`.

## weekly/

- `review.js`: walks `draft` weekly briefs in SummarizeAndPredict and publishes or rejects each. `--list` only lists them. newsWeeklyBrief now writes `published` directly, so this finds a brief only if one was set back to `draft`, the way to hold a bad brief back.

## Tests

`node --test "backend/distribution/cli/test/*.test.js"` from the repo root. Offline: each CLI runs as a child process against a fake `aws` first on PATH (`test/fakeAws.js`) and, for `send.js`, a preloaded fake `fetch` (`test/fakeFetch.js`); stdin answers are fed one per prompt. Covers `breaking/review.js` (what is listed, confirm / note / reject writes, nothing written without an explicit answer, agreement with newsRecommend `list_alerts` / `get_alert`) and `breaking/send.js`. `send-test.js` and `weekly/` have no tests.
