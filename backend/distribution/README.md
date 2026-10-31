# distribution

This group turns the day's analysed news into things readers receive: a daily brief, a weekly brief, a weekly email to
subscribers, a breaking-news alert, and social posts. It serves site visitors, email subscribers and the operator, who
is emailed each breaking alert. It reads what the pipeline group wrote and writes briefs and alert rows that the site serves.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → 5 Facts → 6 Review → 7 Views → 8 Weekly report → **9 Delivery** → 10 Watch
This folder is stage 9: the weekly email, the old weekly brief, breaking alerts and social posts. Timeline: writes no facts or readings; newsPostDevTo and newsWeeklyBrief write the daily_brief and weekly_brief notes (decision 0048, when NOTES_PREFIX is set); the email sender still reads WEEKLY_BRIEF# rows. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsBreakingAlert | Scores stories each cycle, proposes at most one breaking alert, emails the operator when sending is on. | EventBridge `TriggerBreakingAlert`, 04:35, 12:35, 20:35 UTC, ENABLED | NewsCache `latest`; SummarizeAndPredict country, thread and topic rows | GlobalPerspectiveBreakingAlerts (key `alertKey`); Resend email to the operator address | [README](newsBreakingAlert/README.md) |
| newsEmailSender | Sends email by `mode`: weekly brief, breaking alert or country drift note. | EventBridge, input sets the mode: weekly Sun 14:00 UTC ENABLED; breaking every 15 min DISABLED; drift 07:40 UTC DISABLED | GlobalPerspectiveUserPrefs (opt-ins); SummarizeAndPredict `WEEKLY_BRIEF`, `DRIFT#` rows; BreakingAlerts | Marks `emailedAt` on notes and alerts; weekly marker `EMAILLOG#weekly#<weekOf>`; Resend | [README](newsEmailSender/README.md) |
| newsPostDevTo | Builds the daily brief (no longer posts to Dev.to) from today's entries plus thread and country analysis. | Scheduler `InvokeDev`, 23:00 Asia/Tokyo, ENABLED | NewsCache `today-archive`; SummarizeAndPredict `THREAD#`, `COUNTRY#`; DeepSeek | SummarizeAndPredict `DAILY_BRIEF#<date>`; S3 `record/notes/daily_brief/` only when env `NOTES_PREFIX` is set | [README](newsPostDevTo/README.md) |
| newsPostLinkedin (folder newsPostLinkedIn) | Posts new topics to LinkedIn and Bluesky with a generated map image. | Scheduler `InvokeLinkedIn`, minute 20 every 3 hours, Asia/Tokyo, ENABLED | NewsCache `latest`; SummarizeAndPredict `TOPIC#` summary and prediction; posted-log table | `NewsProject-linkedin-posts` (`POSTED#<platform>#<fingerprint>`); LinkedIn and Bluesky APIs | [README](newsPostLinkedIn/README.md) |
| newsWeeklyBrief | Writes the weekly signals brief from seven days of archives; sends no email. | EventBridge `TriggerWeeklyBrief`, Sun 06:00 UTC, ENABLED | NewsCache `today-archive`, `archive#<date>`; SummarizeAndPredict thread and country rows; DeepSeek | SummarizeAndPredict `WEEKLY_BRIEF#<weekKey>`, status published; S3 `record/notes/weekly_brief/` only when env `NOTES_PREFIX` is set | [README](newsWeeklyBrief/README.md) |

## Pipeline

1. The pipeline group fills NewsCache (`latest`, `today-archive`) and the thread and country analysis rows.
2. Three times a day newsBreakingAlert scores stories and writes a `proposed` alert row. Its live `DRY_RUN` is `false`, so when a story clears the bar it emails the operator (not subscribers; the email says it is not public) and marks the alert `sent`.
3. A `sent` alert is NOT public: it reaches the site bell and strip (newsRecommend `list_alerts`, see the read-api group) only after the operator runs `node backend/distribution/cli/breaking/review.js` and confirms it. Subscriber breaking and drift emails are DISABLED, so they send nothing.
4. At 23:00 Tokyo time newsPostDevTo writes the daily brief. The site reads it through `daily_brief` on the `/briefings` page (`/daily` redirects there).
5. Every three hours newsPostLinkedin posts new topics to LinkedIn and Bluesky; a platform posts only when its credentials are set.
6. Sunday 06:00 UTC newsWeeklyBrief writes and publishes the week's brief. The site serves it through `weekly_brief` on `/briefings`.
7. Sunday 14:00 UTC newsEmailSender (weekly mode) emails the latest published brief to `digestOptIn` subscribers, once per `weekOf`. Its live `EMAIL_SEND_DRY_RUN` is `false`, so this is a real send; the schedule is ENABLED.

## Briefs and the record (decision 0048)

The two brief writers also copy each brief into the record as a `daily_brief` / `weekly_brief` note (`backend/shared/src/briefNotes.js`), from which `newsStoryRecord` builds `record/views/briefs/` and `index/briefs.json`. The copy is gated by env `NOTES_PREFIX`: unset writes nothing, and the DynamoDB row stays the primary copy. Live state is in the two Lambdas' env (`aws lambda get-function-configuration`), and what waits on the operator is in `project-docs/START_HERE.md`; the notes already in the record were made by `backend/record/cli/backfill-brief-notes.mjs`. The `DAILY_BRIEF#` and `WEEKLY_BRIEF#` rows are still read by the read proxy, the Cloudflare Worker pre-render and newsEmailSender (weekly mode), so they stay until those read the record.

## Shared code

- newsBreakingAlert: `links`, `placeFilter`. newsEmailSender: `links`. newsPostLinkedin: `links`.
- newsPostDevTo and newsWeeklyBrief: `dayZero`, `llm`, `placeFilter`, `resolveIso3`, `briefNotes` (with `notes`, `briefs`, `s3json`).
- Each reaches them through its `src/_shared` link to `backend/shared/src`. Details: [shared README](../shared/README.md).
- Operator scripts live in [cli](cli/README.md).

## Known limits

- Subscriber breaking emails only include alerts a human set to `confirmed`.
- The live newsPostLinkedin env carries Mastodon, Telegram, Farcaster and Nostr settings, but the code posts only to LinkedIn and Bluesky.
- `newsPostDevTo` keeps dead Dev.to and OpenRouter code that the handler never calls.

## How to check it

```
aws events list-rules --region ap-northeast-1 --query 'Rules[?contains(Name,`Breaking`)||contains(Name,`Email`)||contains(Name,`WeeklyBrief`)].[Name,State]' --output text
aws scheduler list-schedules --region ap-northeast-1 --query 'Schedules[].[Name,State]' --output text
aws events list-targets-by-rule --rule TriggerWeeklyEmailSend --region ap-northeast-1 --query 'Targets[].[Arn,Input]' --output text
aws lambda get-function-configuration --function-name newsPostDevTo --region ap-northeast-1 --query 'Environment.Variables.NOTES_PREFIX'
aws dynamodb describe-table --table-name GlobalPerspectiveBreakingAlerts --region ap-northeast-1 --query 'Table.[TableStatus,ItemCount]'
```
