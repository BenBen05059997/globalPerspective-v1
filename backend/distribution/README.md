# distribution

This group turns the day's analysed news into things readers receive: a daily brief, a weekly brief, a weekly email to
subscribers, a breaking-news alert, and social posts. It serves site visitors, email subscribers and the operator, who
is emailed each breaking alert. It reads what the pipeline group wrote and writes briefs and alert rows that the site serves.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → 5 Timeline → 6 Views → **7 Delivery** → 8 Watch
This folder is stage 7: the weekly email, the old weekly brief, breaking alerts and social posts. Timeline: writes no events; consumers moving to the Week, Today and Story views. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Architecture

| Lambda | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsBreakingAlert | Scores stories each cycle, proposes at most one breaking alert, emails the operator when sending is on. | EventBridge `TriggerBreakingAlert`, 04:35, 12:35, 20:35 UTC, ENABLED | NewsCache `latest`; SummarizeAndPredict country, economic, thread and topic rows | GlobalPerspectiveBreakingAlerts (key `alertKey`); Resend email to the operator address | [README](newsBreakingAlert/README.md) |
| newsEmailSender | Sends email by `mode`: weekly brief, breaking alert or country drift note. | EventBridge, input sets the mode: weekly Sun 14:00 UTC ENABLED; breaking every 15 min DISABLED; drift 07:40 UTC DISABLED | GlobalPerspectiveUserPrefs (opt-ins); SummarizeAndPredict `WEEKLY_BRIEF`, `DRIFT#` rows; BreakingAlerts | Marks `emailedAt` on notes and alerts; weekly marker `EMAILLOG#weekly#<weekOf>`; Resend | [README](newsEmailSender/README.md) |
| newsPostDevTo | Builds the daily brief (no longer posts to Dev.to) from today's entries plus thread and country analysis. | Scheduler `InvokeDev`, 23:00 Asia/Tokyo, ENABLED | NewsCache `today-archive`; SummarizeAndPredict `THREAD#`, `COUNTRY#`; DeepSeek | SummarizeAndPredict `DAILY_BRIEF#<date>` | [README](newsPostDevTo/README.md) |
| newsPostLinkedin (folder newsPostLinkedIn) | Posts new topics to LinkedIn and Bluesky with a generated map image. | Scheduler `InvokeLinkedIn`, minute 20 every 3 hours, Asia/Tokyo, ENABLED | NewsCache `latest`; SummarizeAndPredict `TOPIC#` summary and prediction; posted-log table | `NewsProject-linkedin-posts` (`POSTED#<platform>#<fingerprint>`); LinkedIn and Bluesky APIs | [README](newsPostLinkedIn/README.md) |
| newsWeeklyBrief | Writes the weekly signals brief from seven days of archives; sends no email. | EventBridge `TriggerWeeklyBrief`, Sun 06:00 UTC, ENABLED | NewsCache `today-archive`, `archive#<date>`; SummarizeAndPredict thread, economic, country rows; DeepSeek | SummarizeAndPredict `WEEKLY_BRIEF#<weekKey>`, status published | [README](newsWeeklyBrief/README.md) |

## Pipeline

1. The pipeline group fills NewsCache (`latest`, `today-archive`) and the thread and country analysis rows.
2. Three times a day newsBreakingAlert scores stories and writes a `proposed` alert row. Its live `DRY_RUN` is `false`, so it emails the operator address (not subscribers) when a story clears the bar.
3. With `DRY_RUN=false` (live) newsBreakingAlert emails the operator (the email says it is not public) and marks the alert `sent`. A `sent` alert is NOT public: it reaches the site bell and strip (newsRecommend `list_alerts`, see the read-api group) only after the operator runs `node backend/distribution/cli/breaking/review.js` and confirms it. Subscriber breaking and drift emails are DISABLED, so they send nothing.
4. At 23:00 Tokyo time newsPostDevTo writes the daily brief. The site reads it through `daily_brief` on the `/briefings` page (`/daily` redirects there).
5. Every three hours newsPostLinkedin posts new topics to LinkedIn and Bluesky; a platform posts only when its credentials are set.
6. Sunday 06:00 UTC newsWeeklyBrief writes and publishes the week's brief. The site serves it through `weekly_brief` on `/briefings`.
7. Sunday 14:00 UTC newsEmailSender (weekly mode) emails the latest published brief to `digestOptIn` subscribers, once per `weekOf`. Its live `EMAIL_SEND_DRY_RUN` is `false`, so this is a real send; the schedule is ENABLED.

## Shared code

- newsBreakingAlert: `links`, `placeFilter`. newsEmailSender: `links`. newsPostLinkedin: `links`.
- newsPostDevTo and newsWeeklyBrief: `dayZero`, `llm`, `placeFilter`, `resolveIso3`.
- Each reaches them through its `src/_shared` link to `backend/shared/src`. Details: [shared README](../shared/README.md).
- Operator scripts live in [cli](cli/README.md).

## Known limits

- The `newsBreakingAlert` header says it never auto-sends. The code does send to the operator when `DRY_RUN` is `false`, which it is live.
- Subscriber breaking emails only include alerts a human set to `confirmed`.
- The live newsPostLinkedin env carries Mastodon, Telegram, Farcaster and Nostr settings, but the code posts only to LinkedIn and Bluesky.
- `newsPostDevTo` keeps dead Dev.to and OpenRouter code that the handler never calls.

## How to check it

```
aws events list-rules --region ap-northeast-1 --query 'Rules[?contains(Name,`Breaking`)||contains(Name,`Email`)||contains(Name,`WeeklyBrief`)].[Name,State]' --output text
aws scheduler list-schedules --region ap-northeast-1 --query 'Schedules[].[Name,State]' --output text
aws events list-targets-by-rule --rule TriggerWeeklyEmailSend --region ap-northeast-1 --query 'Targets[].[Arn,Input]' --output text
aws dynamodb describe-table --table-name GlobalPerspectiveBreakingAlerts --region ap-northeast-1 --query 'Table.[TableStatus,ItemCount]'
```

Last verified: 2026-10-20 against code @14dd450d and live AWS.
