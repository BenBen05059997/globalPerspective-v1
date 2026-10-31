# 0054. The Worker, the rss feed, the posting and alert Lambdas and the weekly email read the record, behind a flag

Status: accepted (operator, 2026-10-31); follows 0035, 0037, 0048, 0050, 0051; step 5 build B4b (STEP5_AUDIT 4A, 4F, 6 steps 9-11, 7, 8). Built and measured read-only; nothing deployed, uploaded or set
Date: 2026-10-31

## Context
After 0048 (briefs), 0050 (views after every ingest) and 0051 (entries inbox, `index/today.json`) the record answers what these readers asked DynamoDB: the Worker's bot
pre-render (`topics`, `daily_brief`, `latest_daily_brief`, `weekly_brief`, `thread_preview`, `country_preview`), the `rss` action (NewsCache `today-archive`, then `latest`), the
posting and alert Lambdas (`newsPostDevTo`, `newsPostLinkedin`, `newsBreakingAlert`, `newsRecommend`) and the board's server side (`newsBoard` presets and connect through the shared
world readers), and the weekly email (`WEEKLY_BRIEF#`). Until they stop reading NewsCache `latest` / `today-archive` / `archive#` and `DAILY_BRIEF#` / `WEEKLY_BRIEF#`, those rows cannot go.
Several of these post externally or send mail, so each switch has to be provably the same and reversible.

## Decision
- **One flag, one reader.** `RECORD_READS` = `ddb` (default; unset or a typo is `ddb`) | `record` | `compare`, read by shared `backend/shared/src/recordReads.js`.
  `ddb`: nothing changes. `record`: the view answers, and when it cannot (no view yet, a manifest older than 9 h, a failed read) the DynamoDB row is read and the fallback is logged, so a
  missing view is never "no data" to a Lambda that posts or alerts; the fallbacks go when the tables go. `compare`: both are read, the DynamoDB answer is used, and each read logs
  `[record-reads] <label>: equal` or `DIFFER n [{path, a, b}]` (a = DynamoDB, b = record). Per Lambda, so each is switched on its own.
- **Row-shaped readers.** Each reader answers in the shape of the row it replaces, so the Lambda's own code changes only the call that fetched the row: `latestItem()` (NewsCache `latest`),
  `todayArchiveItem()` (`today-archive`, three sources per entry), `threadAnalysisRow(id)` (THREAD_ANALYSIS, from the story view's `analysis`), `countryIntelligenceRow(name)`
  (COUNTRY_INTELLIGENCE, from the country view's `intelligence`), `latestWeeklyBrief()` (the newest published WEEKLY_BRIEF). A country row exists only under the name it is stored under
  (`COUNTRY#USA` has no row in DynamoDB when the briefing is stored as United States, so it has none here: no alert risk appears that DynamoDB did not give). `ttl` is derived
  (`generatedAt` + 90 d, which is what `newsThreadAnalysis` writes), because a note carries none.
- **Fresh only.** Every read but a dated brief requires `manifest.builtAt` under 9 h old (0050's rule); the Worker applies it too.
- **The inbox keeps a topic's sources past ten.** The daily row caps an entry at 10 sources; the topic in `latest` can hold more, and the breaking-alert score and the feed count them.
  `inboxLines` now stores them as `latest.sources` when the topic has more than the entry (nothing is duplicated otherwise); the mapper puts them back. Found by this lane's first
  measurement (one live topic: 12 sources in `latest`, 10 in the view); needs the agent redeployed (below). The page mappers ignore the field.
- **Worker** (`cloudflare/front-worker/production/worker.mjs`, tests offline against the baseline): the pre-render reads the record's view files through its own SigV4 path
  (`record/views/...`), and the action only when no view answers: `/today` `index/today.json`; dailies `briefs/daily/<date>.json` (newest through `index/briefs.json`); weeklies
  `briefs/weekly/<weekOf>.json` (published only); a story `stories/<id>.json` `analysis` (an alias or no analysis asks `thread_preview`); a country `index/countries.json` to find the ISO3 from the
  name, then `countries/<ISO3>.json`. No flag: it is the bot pre-render, cached 30 min, and every miss is the old call. `/rss` still proxies the action, which now reads the record.
- **`rss`**: `generateRssFeed` builds the XML from the item getters of either source; `record` returns the record's feed only when it holds entries, else DynamoDB's. Output format untouched.
- **Posting and alert Lambdas.** `newsPostDevTo`: the day's entries (`today-archive`), `THREAD_ANALYSIS` per thread, `COUNTRY_INTELLIGENCE` per country (the brief's inputs; the Dev.to
  post path was removed 2026-05-18, it only generates the daily brief). `newsPostLinkedin`: `latest`. `newsBreakingAlert`: `latest`, `THREAD_ANALYSIS`, `COUNTRY_INTELLIGENCE`.
  `newsRecommend`: `latest`. Not moved, listed: the `TOPIC#` rows (`SUMMARY`/`PREDICTION`/`TRACE_CAUSE`: LinkedIn's post text and the alert's story body), the dedupe and alert tables.
- **`newsBoard`** (presets, connect): the topic pool and the analyses go through the same normalisers as DynamoDB's rows (`world.latestTopicsOfItem`, `world.threadAnalysisOfRows`). **Not equal on live
  data, so keep it on `ddb`** (below).
- **Weekly email.** Only the brief content moves: `record` reads the newest published `briefs/weekly/<weekOf>.json` when that week is under 6 days old (the weekly view is built at 06:15 UTC
  Sunday, the send is 14:00, so an older newest week means the new brief missed the build and DynamoDB decides, with the marker, as before). `EMAILLOG#weekly#<weekOf>` (sent marker), the
  recipients and the unsubscribe tokens stay in DynamoDB (operator scope); `deliver`, the dry-run default and `force` are unchanged.
- **Drift email (rule DISABLED), listed only (B4a owns the drift readers).** `runDrift` scans `COUNTRY#`/`DRIFT#` rows with `attribute_not_exists(emailedAt)` newer than 36 h, groups them by country, and
  after a real send writes `emailedAt`/`emailedCount` on each row (`markDriftEmailed`). Moving it needs (1) a reader of the country drift notes (`record/notes/drift`, the newest notes per
  country inside 36 h), (2) the sent flag moved off the world row to an operational marker keyed by `noteId` (a DynamoDB `EMAILLOG#drift#<noteId>` item like the weekly one, or an S3 marker), because a note is append-only
  and the row goes with step 5, and (3) the follow lists, which are already in `GlobalPerspectiveUserPrefs`. Until then the DRIFT# rows cannot be deleted while the rule could be enabled.

## Equality, measured read-only on live data (2026-10-31 12:30 UTC; `backend/record/cli/compare-record-reads.mjs`, plus a read-only load of the real Lambda modules in each mode)
- **today** (the agent's inbox is on and `index/today.json` is live): `latest` 7 topics each side, equal field for field except `activatedAt` (not in the view, no reader uses it) and two sources
  past ten on one topic (the fix above, to be re-measured after the agent redeploy); `today-archive` 28 entries each side, equal except `ttl` and each entry's `archivedAt`, which the
  daily row stamps 60 to 160 ms after the `today-archive` item (compared to the second in `compare`).
- **rss**: the feed from the record, from DynamoDB and the public `/rss` as served are the same bytes (26 items, 31,923 bytes).
- **THREAD_ANALYSIS**: 326 of 326 rows with a story-view analysis compared; every field equal except `ttl` (derived; no row differs in alive-or-expired) and `iso3` order: 316 identical, 10 the same
  set in another order (the note stores `iso3` sorted; `newsThreadAnalysis` stores most-mentioned first), 0 different sets. 0 rows missing on either side.
- **COUNTRY_INTELLIGENCE**: 48 of 48 equal except `ttl`.
- **Lambda readers, real modules on live data, `ddb` against `record`**: `newsBreakingAlert` 7 stories: region risk equal 7 of 7, thread analysis (`entryCount`, title) equal 7 of 7, topic pool equal except the two
  sources above; `newsPostDevTo` 13 entries equal, 4 of 4 thread analyses and 11 of 11 country briefings equal; `newsPostLinkedin` and `newsRecommend` pools equal except the same two sources.
- **Weekly email**: 13 published weeks: the view's brief equals the row (the view adds `iso3` to signals and stories, 0048; the email does not read it), and the rendered subject, text and html are
  identical for all 13 (the newest, 2026-10-25, is 11,511 bytes of html), also in `newsEmailSender/test/recordReads.test.js` on the checked-in live rows. Latest published week: 2026-10-25 both ways.
- **Not equal: `newsBoard` presets.** `iso3` order picks a story's region (`threadIso3` takes the first code that has a region), and 10 of 326 analyses changed order: presets computed from the
  record are 8, from DynamoDB 7 (two Ebola stories move from the Africa preset to a Europe one: `["COD","NGA","CHE"]` against sorted `["CHE","COD","NGA"]`). Fix, if the order matters: keep the
  ordered list in the `story_analysis` note payload (new notes; the 330 backfilled have only the sorted one, so also a re-derivation from the story's entries), or accept sorted order. Operator
  call; until then `newsBoard` stays on `ddb`.

## Consequences
- With every flag on `record` and the views fresh, none of these readers reads NewsCache `latest`, `today-archive`, `archive#`, `THREAD_ANALYSIS`, `COUNTRY_INTELLIGENCE`, `WEEKLY_BRIEF#` or `DAILY_BRIEF#`
  (the fallbacks still can). A stalled build (manifest over 9 h) reads DynamoDB again, so nothing posts or alerts from nothing.
- Cost: `record` adds one manifest read and one view read per call (a Lambda memoises both for 60 s); a story or country read is one view of roughly 10 to 200 KB.
- **Still reading the NewsCache `latest` / `today-archive` / `archive#` rows** after this lane: the writers' own merges (`NewsProjectInvokeAgentLambda`, `newsInvokeGemini`), `newsStoryRecord` until
  `ENTRIES_SOURCE=inbox`, `newsThreadAnalysis`, `newsSystemsAnalysis`, `newsCountryIntelligence`, `newsDriftCorrector`, `newsWeeklyBrief` (archive range), the read API actions `topics`, `today`,
  `summary`, `prediction`, `trace_cause` (the frontend's fallback), `narrative_thread`, `archive_range`, the CLI and quality scripts, and every consumer in `ddb` or a fallback.
  **Still reading `DAILY_BRIEF#` / `WEEKLY_BRIEF#`:** the read API actions `daily_brief`, `latest_daily_brief`, `weekly_brief` (the pages' and the Worker's fallback), the email's fallback scan
  (kept so a missed build cannot skip a send), `distribution/cli/weekly/review.js`, and the writers' own puts. Still reading `THREAD_ANALYSIS` / `COUNTRY_INTELLIGENCE`: the analysis Lambdas
  themselves, `newsWeeklyBrief`, `newsDriftCorrector`, the read API's `thread_analysis`, `country_intelligence`, `thread_preview`, `country_preview` (B4a), and `TOPIC#` rows.

## Hand-off (the coordinator; nothing here was deployed, uploaded or set). Each Lambda runs with the default `ddb` until its flag is set, so steps 3 to 5 change nothing by themselves
1. `scripts/lambda.sh NewsProjectInvokeAgentLambda-dev diff`, deploy (the inbox now keeps `latest.sources`; the repo is ahead of the deployed `_shared/notes.js` as STEP5_AUDIT 5 says: that deploy brings both). After the next ingest run `compare-record-reads.mjs --only today` and expect no `sources` difference.
2. IAM (operator yes), `s3:GetObject` on `arn:aws:s3:::globalperspective-world-280362093938/record/views/*`: add to `newsprojectLambdaRolefcb19312-dev` (read API `rss`, `newsEmailSender`; the role also serves other Lambdas), `newsPostDevTo-role-uek0owwd`, `newsPostLinkedin-role-20u9u4ef`,
   `newsBreakingAlert-role`, `newsRecommend-role`. `newsBoard-role` already has `index/active.json`, `index/all.json`, `links/*`: add `manifest.json`, `index/today.json`, `stories/*` only if the order question is settled. No `ListBucket` is needed: a missing view answers 403, which reads as a failed read and falls back.
3. Diff and deploy, one at a time: `newsSensitiveData-dev`, `newsEmailSender`, `newsPostDevTo`, `newsPostLinkedin`, `newsBreakingAlert`, `newsRecommend`, `newsBoard`. Worker: record the deployed version, upload code-only (operator yes); rollback = that version.
4. Env, per Lambda (fetch, merge, write the full map): `RECORD_READS=compare`. Read the `[record-reads]` lines for a day (three ingest cycles, the 14:00 UTC brief) and, for the email, one Sunday 14:00 UTC run: expect `equal` (or `DIFFER` only on `iso3` order, which `compare` ignores except for the board). Order: `newsSensitiveData-dev` (read-only, cached), `newsRecommend`, `newsPostDevTo`, `newsBreakingAlert`, `newsPostLinkedin`, `newsEmailSender`.
5. Then `RECORD_READS=record` in the same order. Rollback for any of them is deleting the variable. Leave `newsBoard` on `ddb`.
6. Step 5 then needs: the remaining list above, the drift email move, and the deletes (a fresh yes each).

Amendment (coordinator, 2026-10-31, at the merge with 0053): one reader per family. `THREAD_ANALYSIS` and `COUNTRY_INTELLIGENCE` in newsPostDevTo and newsBreakingAlert follow `NOTES_READS` (0053, the notes); `RECORD_READS` there covers only NewsCache (`latest`, `today-archive`). The 0054 view readers for those two families were removed from both Lambdas.
