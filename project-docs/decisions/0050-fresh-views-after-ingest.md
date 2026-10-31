# 0050. The views are rebuilt after every ingest and brief, with today's entries as provisional entries; pages stop asking for "the newest days"

Status: accepted (operator, 2026-10-31); follows 0035, 0037, 0042, 0046, 0048; amends the "newest days" rules of 0046 and the freshness guards of 0048
Date: 2026-10-31

## Context
The views rebuild once a day (rule `TriggerStoryRecord`, 23:45 UTC), ingest runs three times a day (04:15, 12:15, 20:15 UTC) and the daily brief at 14:00 UTC.
So for up to 24 hours the record does not know today, and the pages carried structural calls to the DynamoDB-backed actions only to cover that gap:
`loadArchiveDayMap` asked `archive_range` for the newest recorded day and after (0046), the story timeline asked `narrative_thread` for the days after
`factsThrough`, and `useDailyBrief` / `useWeeklyBrief` asked `daily_brief` / `weekly_brief` for a brief the last build could not hold (0048).

The obvious fix, a midday run that appends today's entry facts, is wrong. Facts are append-only and deduped by `eventId`, and the agent rewrites today's archive during
the day (`NewsProjectInvokeAgentLambda` `buildAndWriteArchive`): the entries of a topic seen again are replaced (`existingEntries.filter(!newTopicIds.has(topicId))` for
`today-archive`, the same for `archive#DATE`), with the thread id that run assigned and no assignment line written. An entry's `eventId` is the sha1 of its smallest
canonical source url, so a replacement with other sources is a different entry. A fact appended at 04:30 would stay in the record after the 12:15 run had replaced the
entry and moved it to another thread: an interim thread frozen forever. (Verified in the code 2026-10-31; the nightly run reads the same rows only once the day is over.)

## Decision
- **A refresh, not a run.** `newsStoryRecord` takes a new event `{"refresh":true,"shadow":false}`. It appends no fact, writes no Run object and no `run` fact,
  and touches no facts manifest. It reads the facts, notes and readings as the nightly build does, plus the entries of the current UTC day as the nightly run would
  read them (`world.archiveDay` with the day-zero rule: the `archive#DATE` row plus the `today-archive` entries archived that day), turns each into an `entry`
  fact marked `provisional: true` (`provisionalEntryFact`, the same `entryFact` the nightly run uses) and rebuilds every view. A provisional fact lives in memory only.
- **Views stay a pure function** of (facts, notes, readings, provisional entries): `buildViews(facts, {..., provisional})`. A provisional entry whose `eventId` is
  already a fact is dropped, so a refresh after the nightly run (or after a manual run) changes nothing. Provisional entries are placed like any entry (no assignment: their
  archive thread). They count in `counts/DATE`, `index/weekly.json`, `index/active.json` rows and `links/`.
- **Marks.** A story entry row carries `provisional: true`. `builtFrom` of every view and the manifest carry `provisionalThrough` (the newest day among the provisional
  entries) only when there are some; the manifest also carries `provisionalEntries`. `factsThrough` is the newest day of the real facts only, so it still says what the
  record has frozen. A build with no provisional entry is byte-identical to the old build (the golden tests did not change).
- **The nightly run replaces them.** It appends facts, then publishes without provisional entries. An entry the agent replaced during the day was never a fact, so nothing
  stays behind: the views of the next refresh or the nightly run no longer list it. (A story view written for an interim thread id that never got a fact is not rewritten,
  because views are never deleted; it leaves `index/active.json` and `index/all.json` at the next build and is reachable only by its id. Threads are assigned within
  the day to join an earlier generation of the same day, so this is rare.)
- **Schedules** (to be created by the coordinator; nothing is created by this change): a refresh 10 minutes after each ingest run (04:35, 12:35, 20:35 UTC), 15 minutes after
  the daily brief (14:15 UTC) and after the Sunday weekly brief (06:15 UTC), and one after the 04:40 daily analysis and the 05:00 story web (05:20 UTC) so the new
  analyses and links reach the views at once. The longest gap is 7.25 h (05:20 to 12:35); without the 05:20 and Sunday refreshes it is 8 h (04:35 to 12:35). The agent run takes about 45 s, so 10 minutes is a margin.
- **Staleness rule** (frontend, `shared/api/viewsFresh.js`): the views are fresh when `manifest.json` `builtAt` is at most 9 hours old. One manifest read is shared by
  every caller for 5 minutes. Missing, unreadable or older: the page asks the action as before, and the reason is reported (`record-views-stale`, `record-manifest`).
- **Pages**, while the views are fresh:
  - `loadArchiveDayMap` answers from `index/weekly.json` alone, today included (no `archive_range` call). The index-missing fallback (all 30 days from the action) stays.
  - `useNarrativeThread` answers from the story view alone (no `narrative_thread` call) when the story has a view with entries. A story with no view still asks the action.
    When it asks, `combineTimeline` adds the archive's entries after the later of `factsThrough` and `provisionalThrough`, so a provisional entry is not listed twice.
  - `useDailyBrief` (latest) serves the record's newest brief without asking the action for today's; `useWeeklyBrief` (latest) the record's newest weekly;
    `useDailyEditionsIndex` takes today from the record's index. `weekAgeDays` and the one-week rule are gone.

## Consequences
- Pages see an ingest within about 10 minutes plus the Worker's edge cache (`/data/*`: `s-maxage=300`, `stale-while-revalidate=600`), so within roughly 15 to 25
  minutes of the agent run, instead of the next day.
- A brief shows up to 15 minutes after it is written (14:15 refresh), where the guard showed it at once. Accepted: the guard cost an action call per page load for the
  other 23.75 hours, answering "no brief" nearly all of them.
- Forecasts (`forecast_drawn`), verdicts, articles and the story web notes are not provisional: they appear when their own facts or notes land (nightly), or, for notes,
  at the next refresh. Only entries are provisional.
- Each refresh rewrites every view (about 1,470 objects, 15 MB; the nightly run does the same). Measured 2026-10-31: 0.5 s of local compute; the live nightly run takes
  13.7 to 17 s with 390 MB. `newsStoryRecord` has reserved concurrency 1, so a refresh and the 23:45 run never overlap (the second is throttled; schedule none within
  five minutes of 23:45).
- The Lambda needs nothing new (DynamoDB reads of `NewsCache` and `PutObject` on `record/views/*` are the nightly run's).
- The `archive_range` and `narrative_thread` actions stay: they are the fallback, the countries list's reader (0046) and the Studio's. The `daily_brief` / `weekly_brief`
  actions stay for dates the record lacks.

## Measured (live data, read only, 2026-10-31 07:30 UTC)
Built locally against a copy of `record/` (facts, notes, readings, operator, views) and the live `today-archive` and `archive#2026-10-31` items. To get provisional entries
the copy had today's six archive entries removed from its facts (the state before a nightly run).
- Today's archive: 6 entries; 5 became provisional (the sixth is already a fact: the daily row and `today-archive` differ in source lists, and the entry id follows the daily row).
- `index/weekly.json` today: 6 entries, the same threads and titles as the live `archive_range` (days=1), topic ids equal (6 of 6).
- `narrative_thread` against the story views for the 6 threads that have an entry today: every entry the action lists is in the view (6 of 6 threads), 5 of them provisional.
- Sizes: `index/weekly.json` 501,654 bytes, `index/active.json` 241,765, `index/all.json` 244,616, manifest 237; 1,470 objects, 15.1 MB written.
- Time: 526 ms local (read, build, write to disk); the live nightly run is 13.7 to 17.1 s (CloudWatch REPORT lines of 2026-10-30/31).
- A refresh rewrites every story and links file (their `builtFrom` gains `provisionalThrough`); the briefs differed from the last live build only because brief notes were backfilled after it.

## Hand-off: deploy order and schedule commands (the coordinator runs them; nothing here was created)
Order: (1) `scripts/lambda.sh newsStoryRecord diff`, then `deploy`; (2) one manual refresh, `aws lambda invoke --function-name newsStoryRecord --cli-binary-format raw-in-base64-out
--payload '{"refresh":true,"shadow":false}' out.json`, and check `record/views/manifest.json` (`builtAt`, `provisionalThrough`, `provisionalEntries`); (3) the rules below;
(4) watch two cycles; (5) the frontend (candidate first). The frontend is safe at any point: before the rules exist the manifest is stale for most of the day and the pages
keep asking the actions, with the reason reported.

Three rules, each with its own invoke permission (as `TriggerStoryRecord` has), region `ap-northeast-1`, account `280362093938`:
```
aws events put-rule --name TriggerStoryRecordRefresh --schedule-expression 'cron(35 4,12,20 * * ? *)' --description 'newsStoryRecord refresh: views with the ingest just made (decision 0050)'
aws events put-rule --name TriggerStoryRecordRefreshBrief --schedule-expression 'cron(15 14 * * ? *)' --description 'newsStoryRecord refresh: views with the daily brief of 14:00Z (decision 0050)'
aws events put-rule --name TriggerStoryRecordRefreshAnalysis --schedule-expression 'cron(20 5 * * ? *)' --description 'newsStoryRecord refresh: views with the 04:40 analyses and the 05:00 story web (decision 0050)'
aws events put-rule --name TriggerStoryRecordRefreshWeekly --schedule-expression 'cron(15 6 ? * SUN *)' --description 'newsStoryRecord refresh: views with the Sunday weekly brief of 06:00Z (decision 0050)'
aws lambda add-permission --function-name newsStoryRecord --statement-id TriggerStoryRecordRefresh --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn arn:aws:events:ap-northeast-1:280362093938:rule/TriggerStoryRecordRefresh
aws lambda add-permission --function-name newsStoryRecord --statement-id TriggerStoryRecordRefreshBrief --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn arn:aws:events:ap-northeast-1:280362093938:rule/TriggerStoryRecordRefreshBrief
aws lambda add-permission --function-name newsStoryRecord --statement-id TriggerStoryRecordRefreshAnalysis --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn arn:aws:events:ap-northeast-1:280362093938:rule/TriggerStoryRecordRefreshAnalysis
aws lambda add-permission --function-name newsStoryRecord --statement-id TriggerStoryRecordRefreshWeekly --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn arn:aws:events:ap-northeast-1:280362093938:rule/TriggerStoryRecordRefreshWeekly
aws events put-targets --rule TriggerStoryRecordRefresh --targets 'Id=newsStoryRecord,Arn=arn:aws:lambda:ap-northeast-1:280362093938:function:newsStoryRecord,Input={"refresh":true,"shadow":false}'
aws events put-targets --rule TriggerStoryRecordRefreshBrief --targets 'Id=newsStoryRecord,Arn=arn:aws:lambda:ap-northeast-1:280362093938:function:newsStoryRecord,Input={"refresh":true,"shadow":false}'
aws events put-targets --rule TriggerStoryRecordRefreshAnalysis --targets 'Id=newsStoryRecord,Arn=arn:aws:lambda:ap-northeast-1:280362093938:function:newsStoryRecord,Input={"refresh":true,"shadow":false}'
aws events put-targets --rule TriggerStoryRecordRefreshWeekly --targets 'Id=newsStoryRecord,Arn=arn:aws:lambda:ap-northeast-1:280362093938:function:newsStoryRecord,Input={"refresh":true,"shadow":false}'
```
The `Input=` shorthand may need the JSON escaped for the shell; if the CLI complains, pass `--targets file://t.json` with `[{"Id":"newsStoryRecord","Arn":"...","Input":"{\"refresh\":true,\"shadow\":false}"}]`
(the existing target of `TriggerStoryRecord` has `Input` `{"shadow":false}` and the same `Id`). The refresh at 04:35, 12:35 and 20:35 is the one that matters; the analysis (05:20) and weekly (06:15 Sunday)
rules are optional and can be left out without breaking the 9-hour rule (the longest gap without them is 8 h, 04:35 to 12:35). Roll back by `aws events disable-rule --name <rule>` (the pages fall back to the actions within 9 hours).
