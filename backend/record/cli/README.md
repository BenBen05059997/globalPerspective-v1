# record/cli

Operator tools for the record. They run from a laptop; they are not deployed as Lambdas. Timeline: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

## capture-entry-notes.mjs

Copies the agent's per-entry notes (`SummarizeAndPredict` `TOPIC#` items `SUMMARY`, `PREDICTION`, `TRACE_CAUSE`) into
`record/notes/entry/YYYY-MM-DD.jsonl` (decision 0042) through shared `notes.js`, so these notes are the reference shape every
note writer follows. Each note's subject is its entry fact's `eventId`, computed with the shared `entryIdentity` from the
topic's sources in NewsCache `latest`; a note whose `eventId` is not an entry fact within 100 days is reported as `unmatched` and
not written (an article seen again keeps the eventId of its first day). The agent keeps only the current generation (older
items are pruned and carry a `ttl`), so a run copies what exists now; a re-run appends nothing (same `noteId`).

```sh
RECORD_SDK_DIR=<dir with @aws-sdk/client-s3, client-dynamodb, lib-dynamodb> node backend/record/cli/capture-entry-notes.mjs [--dry] [--live]
```
Default writes under `record/shadow/`; `--live` writes `record/`. Test: `node --test backend/record/cli/capture-entry-notes.test.mjs`.
First live run 2026-10-31: 33 notes (13 summaries, 13 causes, 7 forecasts) for 2026-10-30, all matched.

## backfill-entry-notes.mjs

For every day the record has facts for, turns each NewsCache `archive#DAY` entry's stored `ai` texts (summary, forecast, cause,
cut at 1,500 characters by the agent) into archive-copy entry notes through shared `notes.js` `archiveEntryNotes`: format
`text`, `model` null (the archive did not keep it), `at` the archive time, `payload.from: "archive"`. Views prefer an exact note
over a copy. Unmatched subjects are reported and not written; a re-run appends nothing.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-entry-notes.mjs [--dry] [--live] [--from DAY] [--to DAY]
```
First live run 2026-10-31: 3,713 notes from 1,325 archived entries over 35 days (126 unmatched, mostly 2026-09-05, the record's
first day). Test: `node --test backend/record/cli/backfill-entry-notes.test.mjs`.

## backfill-country-notes.mjs

Copies every current `SummarizeAndPredict` `COUNTRY#<c>` / `COUNTRY_INTELLIGENCE` item into a full `country` note (its own `generatedAt`
and `model`; subject the ISO3 from the shared `resolveIso3`, a name with none is reported and skipped), and every `HISTORY#<date>` row
into a reduced history copy (`payload.from: "history"`, `model` null: the row did not record it) through shared `notes.js`. A
`HISTORY#` row written by the same run as a briefing item (same `generatedAt`) is that briefing's subset and is not planned. Views prefer
an exact note over a copy. A re-run appends nothing (same `noteId`).

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-country-notes.mjs [--dry] [--live] [--no-history]
```
Default writes under `record/shadow/`; `--live` writes `record/`. Test: `node --test backend/record/cli/backfill-country-notes.test.mjs`.

## backfill-brief-notes.mjs

Copies every `SummarizeAndPredict` `DAILY_BRIEF#<date>` / `DAILY_BRIEF` row into a `daily_brief` note and every `WEEKLY_BRIEF#<weekOf>` /
`WEEKLY_BRIEF` row into a `weekly_brief` note (decision 0048) through the builders the writers use (`dailyBriefNote`, `weeklyBriefNote` in
shared `notes.js`). Subject `daily:<date>` / `weekly:<weekOf>`, `at` the row's own `generatedAt`, `model` the row's, payload the stored row
minus `PK`, `SK`, `ttl`, `generatedAt` and `model` (drafts included; the views serve published weeklies only). The note a writer makes for a
row has the same `noteId`, so a row the writers also wrote, or a re-run, appends nothing. A row the builder refuses is reported and skipped.
Dry run on 2026-10-31: 137 daily and 15 weekly rows (13 published) become 152 notes, none skipped, all valid against the schema.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-brief-notes.mjs [--dry] [--live]
```
Default writes under `record/shadow/`; `--live` writes `record/`. Test: `node --test backend/record/cli/backfill-brief-notes.test.mjs`.

## backfill-link-notes.mjs

Turns the causal edges of the country webs into `link` notes through the same planner `newsSystemsAnalysis` uses (`recordNotes.js`
`planLinkNotes`). Sources (read-only): the current `SYSTEMS#` / `SYSTEMS_ANALYSIS` rows (the webs `WEB#INDEX/LATEST` is built from; they carry
the model) and the dated S3 web history `web/YYYY/MM/DD.json` (`webs`): a web there that is not also a current row has no recorded model, so its
notes are copies (`model` null, `payload.source: "web-history"`). Cites are the eventIds of the cited entries found in the NewsCache archive
rows of the cited days. Region rows (Europe, Asia ...) have no ISO3 and are reported and skipped; a web holding both directions of a pair
keeps the stronger edge as the note and the other as `payload.reverse`. `WEB#INDEX/LATEST` is read only to print its link count beside the planned notes. Each web (current and history, edges or not) is also written as one `web` note (nodes and shared-actor backbone; `planWebNotes`), written before the links. A re-run appends nothing.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-link-notes.mjs [--dry] [--live] [--no-history]
```
Default writes under `record/shadow/`; `--live` writes `record/`. Test: `node --test backend/record/cli/backfill-link-notes.test.mjs`.

## backfill-question-draws.mjs

Turns the PredictionLog `SEED#<week>/COMMIT` rows into `commit` lines and the `SAMPLE#<week>/DRAW` rows (with the `SEED#<week>/REVEAL` seed) into `draw` lines of the draws inbox (decision 0043), built with the resolver's own `inbox.js` `commitLine` / `drawLine`, so newsStoryRecord makes `question_commit` / `question_draw` facts from them. PredictionLog is read only; the seed `SECRET` is never read out and the draw's `pool` is not copied. A week with a `DRAW` but no `REVEAL` is written with `seedHex: null`. A re-run appends nothing (`sourceKey` `backfill:draws/...`).

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-question-draws.mjs [--dry] [--live]
```
Default writes `record/shadow/inbox/draws/`; `--live` writes `record/inbox/draws/`. Test: `node --test backend/record/cli/backfill-question-draws.test.mjs`.
First shadow run 2026-10-31: 6 commits, 3 draws (W41-W43), 9 lines on 5 days, 0 skipped.

`sdk.mjs` loads the AWS SDK for the record CLIs from the working directory or `RECORD_SDK_DIR` (`RECOVER_SDK_DIR` still works).

## backfill-story-analysis-notes.mjs

Turns every current `SummarizeAndPredict` item `PK THREAD#<id>`, `SK THREAD_ANALYSIS` (scan) into one `story_analysis` note through
shared `notes.js` `storyAnalysisNote`: `at` the item's `generatedAt`, `model` the stored model, payload the stored analysis. `cites`
= eventIds of the thread's archive entries it was built from (the stored `entryTopicIds`), found by reading NewsCache
`archive#DAY` for every day in `record/facts/manifest.json`; an item without `entryTopicIds` gets no cites. A thread with no story
in `record/views/index/all.json` is reported as unmatched and not written (the 202 of 326 are threads from before the record's
first day, 2026-09-05); a re-run appends nothing.

History: only the current analysis is stored (one item per thread, overwritten on each run). `THREAD_HISTORY#<date>` rows (about
330, 60-day TTL) hold scalars and the trajectory text only (no storyArc, watch questions, actors or model), so they cannot
make a valid `story_analysis` note and are not backfilled. Older analyses carry `groundingSources`/`searchResultsCount` (search-grounded
era); the schema allows them.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-story-analysis-notes.mjs [--dry] [--live]
```
Test: `node --test backend/record/cli/backfill-story-analysis-notes.test.mjs`.

## backfill-drift-notes.mjs

Turns every `COUNTRY#<name>` / `DRIFTLOG#<date>` item (the permanent drift archive; `DRIFT#` is the same item with a 60-day TTL) into
one `drift` note through `driftNote`, ISO3 from `resolveIso3` (unresolved: reported, skipped). The items store no model, so the notes
are archive copies like the entry copies: `model` null and `payload.from: "archive"` (the schema's drift payload allows `from`).
The Lambda's configured model (`GROK_MODEL`, now `deepseek-flash`) is not used: it is what writes today, not necessarily what wrote
a note months ago, and a made-up attribution would be worse than none. Currently 222 items, all resolved; the oldest lack `currentRiskScore`
(optional in the schema).

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-drift-notes.mjs [--dry] [--live]
```
Test: `node --test backend/record/cli/backfill-drift-notes.test.mjs`.

## backfill-story-drift-notes.mjs

Turns every `THREAD#<threadId>` / `DRIFT#<date>` item (the story's "what changed" row from `newsDriftCorrector`; 60-day TTL, so only
the recent weeks exist) into one `drift` note about the story through `storyDriftNote` (subject kind `story`, same `notes/drift/` files
as the country notes). Archive copies like the country ones: `model` null, `payload.from: "archive"`. A story missing from
`record/views/index/all.json` is reported as `unmatched` and not written. The story view's `analysis.driftNote` is the latest of these.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-story-drift-notes.mjs [--dry] [--live]
```
Test: `node --test backend/record/cli/backfill-story-drift-notes.test.mjs`.

## recover-day.mjs

Rebuilds a missed day's raw articles from public records, with no model (decision 0040 rule 2, [0040](../../../project-docs/decisions/0040-raw-before-model.md)). It writes the same inbox lines the selector writes (`record/inbox/articles/DAY.jsonl`, `rawId = sha1(canonical url)`), plus `recoveredAt` and `recoveredFrom`.

Sources, in dedupe priority order:
1. Wayback (`recoveredFrom:"wayback-rss"`): the Internet Archive CDX list of the day's snapshots of each of our feed URLs, each snapshot parsed with the selector's own parser (`backend/shared/src/rss.js`). Real `publishedAt`; only items published on the day are kept. Holes are expected.
2. GDELT GKG raw files (`recoveredFrom:"gdelt-gkg"`, `feed:"gdelt-gkg"`), the primary GDELT source and on by default. GDELT publishes a GKG 2.1 file every 15 minutes as a static download, `https://data.gdeltproject.org/gdeltv2/YYYYMMDDHHMMSS.gkg.csv.zip` (HHMMSS on the quarter hour, 96 per day, ~2-5 MB zipped). Static files have no rate limit, so a day takes about 20 seconds (4 downloads at a time, 5xx and network errors retried; a 404 is a missing quarter, recorded in the manifest, not fatal). The zip is read in memory with `node:zlib` (no dependency). The files are tab-separated without a header; fields used (0-based): 1 `V2.1DATE` (when GDELT saw the article), 3 `V2SOURCECOMMONNAME` (the domain), 4 `V2DOCUMENTIDENTIFIER` (the URL), 26 `V2EXTRASXML` (`<PAGE_TITLE>`, entity-decoded). A row is kept when its domain is a feed domain (exact or subdomain; `bbc.co.uk` counts for BBC), its V2.1DATE is on the requested UTC day and it has a PAGE_TITLE. Nothing else is filtered (raw means raw). `publishedAt` is V2.1DATE, so `precision:"day"` here means "when GDELT saw it, not when the outlet published it" (the day is right, the time of day is not the article's); `snippet:null`, `lang:null`.
3. GDELT DOC 2.0 article list, opt-in with `--gdelt-doc` (`recoveredFrom:"gdelt-doc"`, `feed:"gdelt-doc"`): one query per feed domain per day (`domainis:<domain> sourcelang:english`, plus `bbc.co.uk` for BBC), `mode=artlist`, up to 250 records, a window that hits 250 is halved (down to 15 minutes). Same `seendate` / `precision:"day"` semantics. The API throttles hard (429 for hours), which is why GKG replaced it as the default; the code and its throttle handling are kept.

The domain list is read from the selector's `RSS_FEEDS`, so a new feed is picked up automatically. Lines are deduped by `rawId` across the sources and against the day's existing inbox file (`--merge`); the existing lines are never rewritten.

```
node backend/record/cli/recover-day.mjs --day 2026-09-20 [--to 2026-09-29] --out ./recovery-out      # dry run, local files only
node backend/record/cli/recover-day.mjs --day 2026-09-20 --out ./o --merge --bucket <world bucket>   # also reads the existing inbox for dedupe
node backend/record/cli/recover-day.mjs --day 2026-09-20 --bucket <world bucket> --write [--shadow]  # read-merge-write to S3
```

Other flags: `--no-gdelt` (skips GKG and DOC), `--no-gkg`, `--gdelt-doc` (add the DOC API), `--no-wayback`, `--gdelt-only` (alias of `--no-wayback`: re-run the GDELT half of a day whose Wayback half is already in), `--no-split`, `--domains a.com,b.com`, `--gdelt-delay-ms` (default 10000). Output per day: `DAY.jsonl` and `recovery-manifest-DAY.json` (`day`, `fetchedAt`, `counts` per source and outlet, `gkg`, `gdelt` (the DOC block), `sources` per domain and feed, `failures`). The GKG block is `"gkg": { "status": "ok|partial|failed|skipped", "filesOk", "filesMissing", "filesFailed", "rows", "rowsOurs" }` (`partial`: some quarter missing or failed; `failed`: no file read). The console prints counts per source and per outlet.

GKG has no rate limit. DOC rate limits (only with `--gdelt-doc`): GDELT answers 429 ("limit requests to one every 5 seconds") when requests come too fast and keeps answering it for many minutes, even at wide spacing. The script waits `--gdelt-delay-ms` (10 s) between GDELT calls. On 429 it backs off 60 s, 120 s, ... capped at 10 min, up to 6 retries (5xx and network errors: 5 s doubling, cap 60 s). After 3 consecutive 429s it sleeps a 10 min cool-down instead of burning retries. Domains that still failed are re-run once after 60 s. Wayback is spaced 1 s.

A throttled GDELT is never reported as an empty day. Per domain the status is `ok` (articles), `zero` (every window answered a parsed JSON body with no articles) or `failed` (a window failed after all retries, or failed once and then answered 0 on the retry pass; that 0 is not trusted). Each failed window is in the manifest `failures` as `{source, domain, window, error}`. The manifest carries

```
"gdelt": { "status": "ok|partial|throttled|failed|skipped", "domainsOk": 0, "domainsZero": 0, "domainsFailed": 0 }
```

`partial`: some domains failed; `throttled`: no domain returned a body and every failure is a 429/limit message; `failed`: no domain returned a body for another reason; `skipped`: `--no-gdelt`. The console prints the same line.

Exit codes: 0 done (including `partial`: read `failures`); 1 usage or fatal error; 2 GKG `failed` (no file read) or, with `--gdelt-doc`, DOC `throttled`/`failed` (the run stops after that day, so a driving script can stop). Wayback lines found before that are still written (the inbox append is idempotent).

Re-run recipe (DOC only; GKG just re-runs): run one day, then wait. If GDELT comes back `throttled`/`partial`, wait 15+ minutes (check with one `curl` that the 429 is gone) and run `recover-day.mjs --day DAY --gdelt-only --write`; ids already in the inbox are skipped. One day takes about 1.5 hours when GDELT is throttling, so run days one at a time in the background.

Write path (`--write`): uses `backend/shared/src/s3json.js` `appendLines` (conditional put, retry on 412; ids already stored are skipped), bucket from `--bucket` or `WORLD_BUCKET`, shadow prefix `record/shadow/inbox/articles/`. It needs `@aws-sdk/client-s3`, which the repo does not install: `npm i --no-save @aws-sdk/client-s3` in a scratch directory and set `RECOVER_SDK_DIR` to it. The writer's IAM is the operator's; the coordinator runs `--write`, a lane never does.

### Deadline

GDELT DOC reaches back three months only; the GKG files go back much further (checked for 2026-09-14, 09-20, 10-14, 10-22). Wayback has no window.

### How the coordinator runs it

1. Dry run a gap day, read the manifest counts, check `failures`.
2. `--write --shadow` once, then without `--shadow`.
3. Invoke `newsStoryRecord` with `{"recovery":true,"date":"DAY"}`. It turns the inbox into `article` facts and writes the Run with `notes:"recovery"`. A recovered day has no archive, so the Run is `status:"ok"` with `inputs.archiveDay:"missing"` and `inputs.recovered:true` and no `inputs` failure, and the invoke returns instead of throwing; a failed article append or a view failure still shows as `failed`/`partial`.

Recovered days never draw forecasts: `newsStoryRecord` refuses `forecast_drawn` on a recovered day, and runs without `recovery:true` are not meant for gap days. Recovered days are unscored and labelled "recovered from public records" (0040 recovery rules).

## recover.test.mjs

Offline tests (URL building, GKG zip fixtures built in the test, GDELT JSON and CDX fixtures in `fixtures/`, line shape, dedupe, window split, fake-fetch walk, throttle classification, cool-down, exit code 2): `node --test backend/record/cli/recover.test.mjs`. The shared parser has its own test in `backend/shared/test/rss.test.js`.

## benchmark-assignments.mjs

Turns the gap benchmark's T1 continuations (`out/T1-s*.json`: "this recovered article continues that story") into assignment inbox lines. Local files only, no S3. The article's benchmark id (first 12 chars of `rawId`) is mapped to its `article` fact eventId by reading local copies of the recovered `record/inbox/articles/DAY.jsonl` lines and running `inboxArticleFact` from `newsStoryRecord/src/facts.js`; the target story is the T1 story, or its survivor when `--merges` (JSONL `{from, into}`) says it was merged away. Output lines `{entryId, threadId, by:'operator', at, reason}` (reason = the reader's `why` + " (gap benchmark 2026-10-24)") go to `record/inbox/assignments/DAY.jsonl`, where `entryId` is the article fact's eventId. An article cited by two stories is placed on the first; the other is listed as a conflict. Unmapped ids (no recovered inbox line) are listed and skipped.

```
node backend/record/cli/benchmark-assignments.mjs --t1 'gap-benchmark/out/T1-s*.json' --inbox-dir ./inbox-articles --merges merges.jsonl --at 2026-10-24T12:00:00.000Z --out assignments.jsonl
```

## reconcile-actors.mjs
Operator script, no model: reads actor ids from the live `views/index/active.json` (`--live`, read-only) or a local file (`--input`), asks Wikidata (`wbsearchentities` and, for offices, one SPARQL query; 1 request/second in total) for the top N (`--top`) or all (`--all`), and keeps a hit only when its description names an allowed class (person, office, government, ministry, armed forces, police, central bank, court, parliament, party, company, NGO, international organisation, armed group, country/region).

Match tiers (`confidence`/`via`): `exact` (top hit's label equals the name, accents folded), `alias` (matched alias equals the name), `near` (spelling variant: label or alias within 2 edits, same word set after folding word order, "of/the", demonyms and "military" = armed forces, or the same surname with a first name within 2 edits or an initial; any of the top 3 hits, but a lower hit sharing the exact name is a namesake and never counts; legal suffixes such as AG/Inc are ignored). A hit with no usable description is judged by its label ("Armed Forces of X"). A "<demonym> <org>" name also searches its entity title ("Government of South Korea").

Offices: when the hit looks like a position, the script probes it (instance of position or public office, not a human) and reads the holders (office P1308, or a person's P39) with P580/P582. The holders overlapping the actor's first to last appearance in the index are the answer: one holder gives a proposal for the person with `title` = the office name and `via: office->holder`; several give one proposal each with `period` and `ambiguous_period: true`; none gives the position item itself flagged `position_item`.

Dry run by default; `--write --out DIR` writes `aliases.candidate.json` (the alias-file schema; variants resolving to one id pool under the commonest name; generic and unresolved names included; `ambiguous` listed apart because one canonical takes one id), `review.md` (ready / check / unresolved / generic, one line per entry), plus `aliases.proposals.json`, `generic.candidates.json`, `unresolved.json`, `summary.json`. `--cache FILE` keeps Wikidata answers so a rerun costs no requests. It never writes `record/operator/aliases.json`; the operator copies accepted entries. Tests: `node --test cli/test/*.test.mjs` (no network).

Choices: ready = exact, alias, or an office with exactly one holder; check = near, ambiguous_period, position items. Only the operator promotes a candidate; wrong confident hits are caught in review, not by tightening the rule further.

## backfill-forecasts.mjs

Appends the `forecast_drawn` facts the facts run missed: a PredictionLog `PRED#` row whose topic was not among its day's archive
entries (the run used to find rows only through the day's entry topics). Reads every `PRED#` row from the record's first day to
today (a Scan, run as the operator) and every stored fact; a row with no fact becomes one through `forecastFact` (same eventId as
the facts run). threadId: the row's own, else the latest `entry` fact of the topic; a row with neither is reported `unresolved` and
not written. **Dry run by default**; `--write` adds the days to the manifest and appends to `record/facts/DAY.jsonl` (`--prefix` for a shadow
copy). A re-run appends nothing. The views pick the facts up on the next facts run.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/backfill-forecasts.mjs [--write] [--prefix record/]
```
Test: `node --test backend/record/cli/backfill-forecasts.test.mjs`.
