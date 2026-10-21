# world/ — the one reader of the world's raw tables

**Only this folder parses the raw rows.** `archive#` days, `THREAD_ANALYSIS`, `THREAD_HISTORY#`, `COUNTRY# HISTORY#`,
`DRIFT#`/`DRIFTLOG#`, `PRED#` scenarios, `Q#` verdicts and `SAMPLED` questions, `WEB#INDEX`, `web/latest.json` and `web/YYYY/MM/DD.json` and the `latest` topic pool are read
and normalised here, once. The derivations everyone needs (story birth, branches from scenarios, coverage and missing
days (which days have archive data; not the Run object's coverage), risk tier from score, outlets) live here too, so two consumers can never print two different numbers. The rule
(operator, 2026-10-20) is `project-docs/architecture/ARCHITECTURE_RECORD.md` §0c; storage rules are
`project-docs/rules/DATA_STRATEGY.md` §3. Raw tables are written by the existing pipeline and are not changed by this
folder. Read-only: nothing here writes.

Glossary (ARCHITECTURE_RECORD §0b): **topic** = one item the selector picks in a run; **thread / story** = the editorial
story arc (`thread-<slug>-<hash>`); **cluster** = the map pipeline's internal headline group (not a story); **situation**
= a map pin; **record** = the dated account of one story (`record/stories/<threadId>`, written only by `newsStoryRecord`).

## Files
| File | Holds |
|---|---|
| `client.js` | the injected-client contract, `makeDynamoClient`, `makeS3Client`, `makeClient`. No AWS SDK import, no aws CLI anywhere |
| `readers.js` | one function per row type (below) and `resolveTables` |
| `derive.js` | pure derivations: `outletsOf`, `entriesByThread`, `birthByThread`, `branchesFromScenarios`, `coverage`, `analysisAsOf` |
| `tier.js` | `tierFromScore`, `TIER_BANDS` |
| `dates.js` | `day`, `isDay`, `addDays`, `eachDay` (UTC days) |
| `index.js` | re-exports all of the above: `require('./_shared/world')` |

## The client (injected)
```
client.getItem(table, key)            -> item | null          key = {PK,SK} or {id}
client.query(table, pk, skPrefix?)    -> item[]               paginates; prefix optional
client.batchGet(table, keys)          -> item[]               chunks by 100, retries unprocessed keys
client.scan(table, {expression, values, names?, maxItems?}) -> item[]   RARELY; only `scenarios({from,to})` and `sampledQuestions()` without qids
client.getS3Json(key)                 -> object | null        null only for a missing key
```
In a Lambda: `makeClient(makeDynamoClient({client: DynamoDBDocumentClient.from(new DynamoDBClient({})), GetCommand,
QueryCommand, BatchGetCommand, ScanCommand}), makeS3Client({client: new S3Client({}), GetObjectCommand, bucket}))`. In a
local script, the same with your credentials; in a test, a fake object with the five methods. A client may omit what its
caller never reads (newsBoard's store has no `scan`/`getS3Json`); a reader that needs a missing method throws
`world: the client has no <method>()`. A read error is never turned into "no data": it propagates.

Every reader takes a trailing `opts`: `{env, tables, nowMs, ...}`. Tables resolve as live defaults (`NewsCache`,
`SummarizeAndPredict`, `GlobalPerspectivePredictionLog`), then `env` (`TOPICS_DDB_TABLE`, `SUMMARIZE_PREDICT_TABLE`,
`PREDICTION_LOG_TABLE`), then `opts.tables` `{cache, world, predictions}`. Bucket and region belong to the client.

## Row types read
All fields below are what the reader returns; every list defaults to `[]`, every absent scalar to `null`. Shapes were
checked against live rows on 2026-10-20 (archive, today-archive, latest, THREAD_ANALYSIS, THREAD_HISTORY, TOPICS,
DRIFT/DRIFTLOG, COUNTRY HISTORY/DRIFT, PRED, Q#/SAMPLED, WEB#INDEX, `web/latest.json`). No `VERDICT` row existed live yet;
that shape is from `newsPredictionResolver`.

| Reader | Store and key | Returns | Writer |
|---|---|---|---|
| `archiveDay(client, date, {nowMs?, withAi?})` | NewsCache `id = archive#<date>` (90 d TTL; plus `today-archive` for the current UTC day when `nowMs` is given) | `{date, updatedAt, source:'archive'\|'today-archive', entries:[{date, archive, topicId, threadId, title, category, regions[], iso3[], actors[], eventType, archivedAt, generationId, continuesTopic, sources:[{source,title,url,tier,outletCountry,outletType,snippet}], ai? (withAi)}]}` or `null` (no row) | `NewsProjectInvokeAgentLambda` (`buildArchiveEntry`) |
| `archiveRange(client, from, to, opts)` | same, one `getItem` per day, 4 at a time | `{from, to, days:[archiveDay…] (present days, ascending), missingDays:[date]}` | same |
| `threadAnalysis(client, threadIds, {nowMs?})` | SummarizeAndPredict `THREAD#<id>` / `THREAD_ANALYSIS`, one `batchGet` | `{[threadId]: {threadId, title, riskScore, tier, lead, trajectory, iso3[], dimensions, keyActors:[{name,role,mentionCount}], entryCount, entryTopicIds[], generatedAt, asOfDay, ttl}}`; threads without a row are absent; with `nowMs`, rows past their TTL are dropped | `newsThreadAnalysis` |
| `threadHistory(client, threadId, from?, to?)` | `THREAD#<id>` / `THREAD_HISTORY#<date>` | ascending `[{date, score, tier, trajectory, title, lead, dimensions, generatedAt}]` | `newsThreadAnalysis` |
| `countryHistory(client, country, from?, to?)` | `COUNTRY#<name>` / `HISTORY#<date>` (name as stored, e.g. `France`) | ascending `[{date, score, tier, level, trajectory, headline, generatedAt}]` | `newsCountryIntelligence` |
| `driftNotes(client, {threadId}\|{country}, from?, to?)` | `THREAD#<id>` or `COUNTRY#<name>` / `DRIFT#<date>` and `DRIFTLOG#<date>` | ascending `[{subject:{kind,id}, date, asOf, since, source:'DRIFTLOG'\|'DRIFT', whyChanged, noSingleDriver, changeScore:{from,to,delta}, changeLevel, changeDimensions, prior, current, triggerEvent:{date,topicId,title}\|null, directionFlag, generatedAt}]` | `newsDriftCorrector` |
| `scenarios(client, {topicIds}\|{threadId, topicIds?}\|{from,to}, …)` | GlobalPerspectivePredictionLog `PRED#<topicId>` / `<date>`; `{threadId}` first reads `THREAD#<id>`/`TOPICS`; `{from,to}` is the one bounded scan | ascending `[{pk, topicId, date, threadId, title, generatedAt, model, questionSchema, scenarios:[{index, label, probability (percent), probabilityRange, horizon, rationale, scoreable, triggers:[{id, trigger, due, p (percent), resolutionSource, question, qid, status}]}]}]` | `NewsProjectInvokeAgentLambda` |
| `verdicts(client, qids, {asOf?})` | GlobalPerspectivePredictionLog `Q#<qid>` / `VERDICT`, `VERDICT#<n>` | `{[qid]: {qid, n, sk, verdict, decidedAt, decidedBy, reason, voidReason, evidence, all:[every verdict, ascending n]}}`; the highest `n` wins; questions with no verdict are absent | `newsPredictionResolver` |
| `sampledQuestions(client, {from?, to?, qids?, threadId?})` | GlobalPerspectivePredictionLog `Q#<qid>` / `SAMPLED`; `{qids}` is one `batchGet`; without `qids` it is **one more bounded scan** (`begins_with(PK,'Q#') AND SK = 'SAMPLED'`, no index exists, needs `client.scan`) | ascending by deadline `[{qid, threadId (clusterKey when it starts with 'thread-', else null), clusterKey, question, deadline (YYYY-MM-DD), issuedAt, resolutionSource, triggerId, pred:{PK,SK} (the PRED# row it was drawn from)}]`; `{from,to}` = deadline window inclusive, `{threadId}` = clusterKey match. **Never a probability** (the questions are blind) | `newsPredictionResolver` |
| `webIndex(client)` | SummarizeAndPredict `WEB#INDEX` / `LATEST` | `{generatedAt, links:[{from,to,confidence,lagDays,mechanism,cited[],country,generatedAt, confirmed?,confirmedBy?,strength?,since?,evidence?}], shared:[{a,b,actors[],weight,country,generatedAt}], threads:{[id]:{state,title,entries,places:[{name,n}],analysedIn[]}}}` | `newsSystemsAnalysis` |
| `webLatest(client)` | S3 `web/latest.json` | `{runId, generatedAt, index:{…the webIndex shape…}}` or `null` | `newsSystemsAnalysis` |
| `webAt(client, 'YYYY-MM-DD', {fallback:'none'\|'latest'})` | S3 `web/YYYY/MM/DD.json` | same shape as `webLatest` plus `key` (the S3 key actually read) and `fellBackTo` (`null`, or `'web/latest.json'`); `null` when the day is missing and `fallback` is `'none'` (default); with `'latest'` it reads `web/latest.json` and marks `fellBackTo` | `newsSystemsAnalysis` |
| `latestTopics(client)` | NewsCache `id = latest` | `[{topicId, threadId, title, category, actors[], iso3[], regions[], sources[]}]` (the current pool, no history) | `NewsProjectInvokeAgentLambda` (`ACTIVE_ITEM_ID`) |

## Provenance
Every object a reader returns (archive entries, analyses, history points, drift notes, scenario snapshots and scenarios,
verdict rows, web links and shared pairs, latest topics) carries `sourceRow = {store, key, index?}` (the exact raw row)
and `sourceKey` (a stable string; the timeline hashes `kind + sourceKey` into `eventId`). `store` is the table name
(`NewsCache`, `SummarizeAndPredict`, `GlobalPerspectivePredictionLog`) or `S3`; `key` is the exact DynamoDB key (`{id}` or
`{PK,SK}`) or the S3 key string. `index` is the position inside the raw row's array **before any filtering**, so a
dropped entry never shifts the next one's index.

| Object | `sourceRow` | `sourceKey` |
|---|---|---|
| archive entry | `{NewsCache, {id:'archive#<date>'}, index}` or, for an entry merged in from the current day, `{NewsCache, {id:'today-archive'}, index}` (the two stay distinct; `index` is its place in that row's `entries`) | `<archiveKey>\|<generationId>\|<topicId>`, `archiveKey` = `archive#<date>` or `today-archive`; `archivedAt` replaces a missing `generationId`; both missing leaves it empty. `topicId` alone is not enough (`title-<rank>` changes between runs) |
| thread analysis | `{SummarizeAndPredict, {PK:'THREAD#<id>', SK:'THREAD_ANALYSIS'}}` | `THREAD#<id>\|THREAD_ANALYSIS` |
| thread / country history point | `{SummarizeAndPredict, {PK, SK:'THREAD_HISTORY#<d>' \| 'HISTORY#<d>'}}` | `<PK>\|<SK>` |
| drift note | the row the note was taken from (`DRIFTLOG#` preferred); `sourceRows` lists the key of every row merged into it (`DRIFT#` and `DRIFTLOG#` when both exist, one otherwise) | `<PK>\|DRIFT#<date>` (the note, not the row: the same whether or not the log row exists) |
| PRED# snapshot | `{GlobalPerspectivePredictionLog, {PK:'PRED#<topicId>', SK:'<date>'}}` | `<PK>\|<SK>` |
| scenario | the snapshot's key with `index` = scenario index | `<PK>\|<SK>\|<scenario index>` |
| verdict row (the winner and each in `all`) | `{GlobalPerspectivePredictionLog, {PK:'Q#<qid>', SK:'VERDICT' \| 'VERDICT#<n>'}}` | `<PK>\|<SK>` |
| sampled question | `{GlobalPerspectivePredictionLog, {PK:'Q#<qid>', SK:'SAMPLED'}}` | `Q#<qid>\|SAMPLED` |
| web link | `webAt`: `{S3, 'web/YYYY/MM/DD.json' (or 'web/latest.json' after a fallback: always the key really read), index}`; `webLatest`: `{S3, 'web/latest.json', index}`; `webIndex`: `{SummarizeAndPredict, {PK:'WEB#INDEX', SK:'LATEST'}, index}`; `index` = place in the raw `links` | `web\|<from>\|<to>` (same from either source) |
| web shared pair | same, `index` in the raw `shared` | `web-shared\|<a>\|<b>` |
| latest topic | `{NewsCache, {id:'latest'}, index}` | `latest\|<topicId>` |

`branchesFromScenarios` output is derived and carries no provenance of its own; read it from the snapshot and scenario it came from.

## Derivations (exact rules)
- **`outletsOf(entries)`**: sorted distinct `sources[].source`, trimmed, lower-cased, leading `www.` removed, empty names ignored. Works on archive entries and on topics.
- **`entriesByThread(range)`**: `{threadId: entries ascending by date then topicId}`; entries without a `threadId` are skipped.
- **`birthByThread(range, {from?, missingDays?})`** -> `{[threadId]: {threadId, born, bornAt, bornAtApprox, firstTopicId, entryCount, windowLimited, missingBefore}}`.
  `born` = the earliest archive date the thread has an entry on. `bornAt` = the earliest `archivedAt` among its entries **on that date** (the pipeline stamps `archivedAt` at its last write of the day, so this is an upper bound for first appearance); `${born}T00:00:00Z` with `bornAtApprox: true` when none has one. `windowLimited` = **no present day before `born` exists inside the window** (born is the window's first day, or every earlier day in it is missing): the story may be older than we can see. `missingBefore` = missing days inside the window before `born`.
- **`branchesFromScenarios(snapshots)`**: one fork per PRED# snapshot, `forkId = '<PRED#topicId>/<date>'`, `drawnAt = date`, `atEvent = topicId`; one branch per trigger, `branchId = '<forkId>/<trigger id>'` (`<scenario>-<trigger>` index when the row has no id), `text` = scenario label (else the trigger text), `p` = the **trigger's** probability in percent (null when the trigger has none: only question triggers carry `p`), `scenarioP` = the scenario's probability in percent, `trigger`, `resolutionSource` (`''` when absent), `due`, `question`, `qid`. Sorted by `drawnAt`, then `forkId`. Branch status (fired/hold/dead/late) is the record's judgment and is not derived here.
- **`coverage(range, {since?, births?, analyses?})`** -> `{from, to, since, expectedDays, daysWithData, missingDays (from since on), windowMissingDays (whole window), entries, stories (distinct threadIds), outlets (distinct count), analysedNew:{analysed,total}\|null}`. A missing day is a day with no `archive#` row; a row with no entries is a present day. `analysedNew` counts stories born on or after `since`; "analysed" = `analyses[threadId]` is truthy (resolve it with `analysisAsOf` first).
- **`analysisAsOf(analysis, history, asOf)`**: the thread's `THREAD_ANALYSIS` when generated on or before `asOf` (any when `asOf` is omitted), else the last `THREAD_HISTORY` point on or before it, else null. An undated analysis cannot be placed in time and falls through to history. A current analysis never leaks backward into a historical replay.
- **`tierFromScore(score)`**: `>=75` high, `>=50` elevated, `>=25` moderate, else low; null / '' / non-numeric -> null; numeric strings are coerced. The bands are `riskDimensions.js`'s (reused, not copied) and equal the frontend `shared/lib/riskTiers.js` (a test compares them at every integer; no `check-shared-sync` guard compares the two files yet, a later item).

## Decisions (where the three old parsers disagreed)
1. **Birth**: by archive **date**, with `bornAt` from `archivedAt` of that date's entries (record: min `archivedAt` of all entries, `T00:00:00Z` fallback; weekly: date only; the board: none). Same `born` in all three; `windowLimited` is new in this shape (weekly flagged only `born == first day`; record had no flag).
2. **Outlet**: the host string in `sources[].source`, lower-cased, `www.` stripped (weekly/board: raw string; record: objects). The record's alias table (`apnews.com` = `ap`, `bbc.co.uk` = `bbc`) is the record's *judgment* about independent sources and stays in `newsStoryRecord`.
3. **Tier bands**: one definition, 25/50/75 (record and the board had none; weekly used `riskDimensions`; the frontend has its own copy of the same bands). Tier is always computed from the score; a stored `riskLevel` word is returned as `level`, never trusted as the tier.
4. **Probability**: `p` is the trigger's own value in **percent (0..100)** or null; the scenario's is `scenarioP` in percent. The weekly's `trigger.p ?? scenario.probability` mixed percent and a 0..1 fraction; the record used `t.p ?? null`.
5. **Which PRED# rows belong to a thread**: a row belongs when its `threadId` equals the thread's, or when it has no `threadId` and its topic is one of the thread's topics (`TOPICS` pointer plus any `topicIds` passed, e.g. the thread's archive topics); a row naming another thread is dropped. (Record: `threadId ===` only, so older rows were lost; weekly: topicId in the thread's archive entries, or `threadId`, or `clusterKey`.) The `TOPICS` pointer alone is not enough live (it often holds only the current topic), so pass the archive's topic ids.
6. **Drift date and duplicates**: the date is the one in the sort key; `DRIFT#` and `DRIFTLOG#` of one date are one note, `DRIFTLOG#` preferred (permanent). (Weekly: `asOf` first and both rows kept; record: `DRIFT#` first, one date only.)
7. **Analysis as of a day**: the analysis if generated by that day, else the last history point (record and weekly agree; now one function). TTL-expired analysis rows are dropped only when `nowMs` is given (the board needs it; as-of replays must not).
8. **History points**: a point needs a date and a finite score; others are dropped (board did; weekly kept scoreless points).
9. **Verdicts**: highest `VERDICT#n` wins, `VERDICT` is 1, matching `questionBoard.js` and the resolver; an optional `asOf` ignores later decisions (record's `decidedAt <= date`).
10. **Missing day**: no `archive#` row. The record counted 30 days, the weekly 7 of a 37-day pull; `coverage` reports both (`missingDays` from `since`, `windowMissingDays`).
11. **Today**: with `nowMs`, `today-archive` entries archived today (dayZero rule) are added to the current day if its row lacks them (record's behaviour); without `nowMs` only the day row is read (weekly/board).
12. **Web links**: keep the live names `from`/`to`/`confidence` (record renamed to `a`/`b`/`strength`); a link that only has `a`/`b` is accepted and returned as `from`/`to`.

## Who imports it
`newsStoryRecord` (the record's reads), the weekly pull (`backend/weekly/pull.mjs`, `selection.mjs`), `newsBoard`
(`src/world.js`, live), later `newsConnect`. Each Lambda reaches it as `require('./_shared/world')` through its committed
`src/_shared -> ../../../shared/src` symlink (`scripts/lambda.sh` ships it as real files). The weekly runs from the repo
and requires it with a relative path. Once the record is live, the weekly and the board read `record/*` and use this
reader only for what the record does not hold (ARCHITECTURE_RECORD §0c).

## Test
`cd backend/shared && node --test test/world.*.test.js` (fixtures in `test/world.fake.js` are shaped like the live rows).
newsBoard: `cd backend/board/newsBoard/src && npm test`.

Last verified: 2026-10-20 (sampledQuestions, webAt added)
