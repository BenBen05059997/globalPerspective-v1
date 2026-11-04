# record/cli

Operator tools for the record. They run from a laptop; they are not deployed as Lambdas. Timeline: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

`sdk.mjs` loads the AWS SDK for the record CLIs from the working directory or `RECORD_SDK_DIR` (`RECOVER_SDK_DIR` still works). Every tool here is idempotent (same ids, so a re-run appends nothing) and writes under `record/shadow/` or only prints unless told otherwise (`--live`, `--write` or `--prefix`; each section says which), so a rehearsal never touches the live record. Tests sit beside the scripts (`node --test backend/record/cli/<name>.test.mjs`).

## Finished one-shot backfills

All of these have been run live: the record's facts now start 2026-03-07 and every notes subtype has been backfilled. The scripts stay for now (the operator decides on deleting them); read the script header for flags.

| Script | What it did | Decision (date) | Status |
|---|---|---|---|
| `capture-entry-notes.mjs` | Copied the agent's per-entry notes (`TOPIC#` summary, prediction, cause) into `record/notes/entry/` | 0042 (2026-10-31) | done |
| `backfill-entry-notes.mjs` | Turned each `archive#DAY` entry's stored texts into archive-copy entry notes (`model` null) | 0042 (2026-10-31) | done |
| `backfill-country-notes.mjs` | Copied `COUNTRY_INTELLIGENCE` items and `HISTORY#` rows into `country` notes | 0042 (2026-10-31) | done |
| `backfill-country-facts-notes.mjs` | Copied the 40 `FACTS#` items into `country_facts` notes | 0053 (2026-10-31) | done |
| `backfill-story-history-notes.mjs` | Copied `THREAD_HISTORY#` rows into `story_history` notes | 0053 (2026-10-31) | done |
| `compare-reads.mjs` | Read-only check that the read API's country and story rows equal the same rows rebuilt from notes | 0053 (2026-10-31) | done |
| `backfill-brief-notes.mjs` | Copied `DAILY_BRIEF#` and `WEEKLY_BRIEF#` rows into `daily_brief` / `weekly_brief` notes | 0048 (2026-10-31) | done |
| `backfill-link-notes.mjs` | Turned the country webs' causal edges and the S3 web history into `link` and `web` notes | 0042 (2026-10-31) | done |
| `backfill-story-analysis-notes.mjs` | Turned each `THREAD_ANALYSIS` item into a `story_analysis` note | 0042 (2026-10-31) | done |
| `backfill-drift-notes.mjs` | Turned `COUNTRY#` `DRIFTLOG#` / `DRIFT#` items into country `drift` notes | 0042 (2026-10-31) | done |
| `backfill-story-drift-notes.mjs` | Turned story `DRIFT#` items into story `drift` notes | 0042 (2026-10-31) | done |
| `backfill-question-draws.mjs` | Turned `SEED#` commits and `SAMPLE#` draws into the draws inbox lines | 0043 (2026-10-31) | done |
| `backfill-forecasts.mjs` | Appended the `forecast_drawn` facts the facts run missed (rows whose topic was not among the day's entries) | 0047 (2026-10-31) | done |
| `backfill-history.mjs` | Replayed the archive days 2026-03-07..09-05 through `newsStoryRecord`, placed the pre-record `PRED#` rows, kept unplaceable ones whole in `record/legacy/predictions/` | 0047 (2026-10-31, run live 07:25 UTC, 0 diffs) | done |
| `check-history.mjs` | Printed the measurements of the history copy from local files | 0047 (2026-10-31) | done |
| `benchmark-assignments.mjs` | Turned the gap benchmark's T1 continuations into assignment inbox lines (reason "gap benchmark 2026-10-24") | 0040 (2026-10-24) | done |

`backfill-history.mjs` is still the dry-run harness for `newsStoryRecord` over any range of archive days (`--out`, `--seed`, `--ddb-cache`; see the newsStoryRecord README). The history copy and the note backfills use `RECORD_SDK_DIR=<sdk dir> node backend/record/cli/<script>.mjs [--dry] [--live]`.

## Tools still in use

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

## reconcile-actors.mjs
Operator script, no model: reads actor ids from the live `views/index/active.json` (`--live`, read-only) or a local file (`--input`), asks Wikidata (`wbsearchentities` and, for offices, one SPARQL query; 1 request/second in total) for the top N (`--top`) or all (`--all`), and keeps a hit only when its description names an allowed class (person, office, government, ministry, armed forces, police, central bank, court, parliament, party, company, NGO, international organisation, armed group, country/region).

Match tiers (`confidence`/`via`): `exact` (top hit's label equals the name, accents folded), `alias` (matched alias equals the name), `near` (spelling variant: label or alias within 2 edits, same word set after folding word order, "of/the", demonyms and "military" = armed forces, or the same surname with a first name within 2 edits or an initial; any of the top 3 hits, but a lower hit sharing the exact name is a namesake and never counts; legal suffixes such as AG/Inc are ignored). A hit with no usable description is judged by its label ("Armed Forces of X"). A "<demonym> <org>" name also searches its entity title ("Government of South Korea").

Offices: when the hit looks like a position, the script probes it (instance of position or public office, not a human) and reads the holders (office P1308, or a person's P39) with P580/P582. The holders overlapping the actor's first to last appearance in the index are the answer: one holder gives a proposal for the person with `title` = the office name and `via: office->holder`; several give one proposal each with `period` and `ambiguous_period: true`; none gives the position item itself flagged `position_item`.

Dry run by default; `--write --out DIR` writes `aliases.candidate.json` (the alias-file schema; variants resolving to one id pool under the commonest name; generic and unresolved names included; `ambiguous` listed apart because one canonical takes one id), `review.md` (ready / check / unresolved / generic, one line per entry), plus `aliases.proposals.json`, `generic.candidates.json`, `unresolved.json`, `summary.json`. `--cache FILE` keeps Wikidata answers so a rerun costs no requests. It never writes `record/operator/aliases.json`; the operator copies accepted entries. Tests: `node --test cli/test/*.test.mjs` (no network).

Choices: ready = exact, alias, or an office with exactly one holder; check = near, ambiguous_period, position items. Only the operator promotes a candidate; wrong confident hits are caught in review, not by tightening the rule further.

## build-entries-inbox.mjs

Builds the entries inbox (decision 0051) for the last N days from the NewsCache `archive#DAY` rows into **local files** and proves that the facts built from them are byte-identical to the facts built from the archive. DynamoDB is only read (`GetItem`, as the nightly run does); nothing is written to AWS.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/build-entries-inbox.mjs [--days 30] [--to YYYY-MM-DD] [--out DIR]
```
Writes `<out>/record/inbox/entries/DAY.jsonl` (one batch per run, in the row's order, so the replay is the row), reads them back through `newsStoryRecord`'s own reader (`ENTRIES_SOURCE=inbox`) and prints the inbox path and the proof: days and entries compared, entry facts compared (whole JSON, `sourceKey`, `sourceRow` and position included), story births, thread of each topic, the provisional facts a refresh builds for the last day, and any difference (exit code 2). The only tolerated difference, named in the output, is a `today-archive` entry the day row lacks on the last day (day-zero rule). The output directory is also the 30-day start for the live inbox: upload it to `record/shadow/inbox/entries/` then `record/inbox/entries/` (coordinator). Test: `node --test backend/record/cli/build-entries-inbox.test.mjs`.

## compare-record-reads.mjs

Equality of the record readers with the DynamoDB rows they replace (decision 0054), on live data, read only (GetItem, BatchGetItem, GetObject and one GET of the public `/rss`; nothing is written or sent). Sections: `today` (NewsCache `latest` and `today-archive` against `index/today.json`; simulated from the live archive rows when the view does not exist yet), `analyses` (every `THREAD_ANALYSIS` row against its story view), `countries` (every `COUNTRY_INTELLIGENCE` row), `weekly` (every published `WEEKLY_BRIEF#` row against its view, and the weekly email rendered from both), `rss` (the feed from DynamoDB, from the record, and as served).

```sh
RECORD_SDK_DIR=<sdk dir> NODE_PATH=<sdk dir>/node_modules node backend/record/cli/compare-record-reads.mjs [--only today,analyses,countries,weekly,rss] [--rss-url URL]
```
Test: `node --test backend/record/cli/compare-record-reads.test.mjs`.

## build-forecasts-inbox.mjs

Builds the forecasts inbox (decision 0052) for the last N days from the PredictionLog `PRED#` rows into **local files**, and proves that the `forecast_drawn` facts built from the inbox are byte-identical to the facts built from the log. Read only: one Scan of the window's `PRED#` rows and GetItem on the archive rows (the day's entries are the context `forecastFact` takes); the inbox is written under `--out`.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/build-forecasts-inbox.mjs [--days 30] [--to YYYY-MM-DD] [--out DIR]
```
Writes `<out>/record/inbox/forecasts/DAY.jsonl` (a `drawn` line for each row, the thread it was drawn under; a row the reconcile moved also gets a later `thread` line, so the last-wins replay is exercised), reads them back through `newsStoryRecord`'s own reader (`FORECASTS_SOURCE=inbox`) and prints the files and lines, the rows moved by the reconcile, orphan thread lines, the snapshots that differ (whole JSON, provenance included), the fact builds compared for each day of the window (with that day's archive entries) and their bytes, and the real nightly path for the last day (`store.load` in both modes). Exit code 2 on any difference. 2026-10-31: 669 rows, 23 files, 0 differences, 20,070 fact builds and 78,262,264 bytes identical. The output is the 30-day start for the live inbox: upload `record/inbox/forecasts/` to `record/shadow/inbox/forecasts/` then `record/inbox/forecasts/` (coordinator); only days before the agent's first line, then once more for the switch-on day after it has ended (decision 0052 hand-off). Test: `node --test backend/record/cli/build-forecasts-inbox.test.mjs`.

## check-eligible.mjs

Checks that the resolver finds the same questions in the record as in the PredictionLog (decision 0052, `QUESTIONS_SOURCE`). Read only: one Scan of the `PRED#` rows with `questionSchema`, GetItem on `SAMPLE#<week>/DRAW` (never a seed row), and the facts and Runs from S3 or from a local copy.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/check-eligible.mjs [--days 120] [--facts-dir DIR]
```
`--facts-dir` reads `DIR/record/facts/DAY.jsonl` and `DIR/record/runs/DAY.json` (a copy of the bucket) instead of S3. Prints, from the resolver's own code and the shared pool rules: the watch's question list from the log against the facts' (qids on one side only, fields that differ); for every committed week the eligible set from both; for every drawn week the stored `pool` and `eligible` against the pool rebuilt from the facts, and whether the draw is reproduced (under the current 7-90 lead window or the 7-84 one before 0045; `picksReproducedIgnoringClusterKeys` when only a story key changed after the draw); and the facts Run of each day of the week. Today's forecasts are left out of both sides (the record lags the log until the 23:45 UTC run). Exit code 2 on any difference. 2026-10-31: 5,276 questions on both sides, eligible sets of W41-W46 equal, W42 and W43 pools equal the stored ones, W41 reproduced but for one cluster key. Test: `node --test backend/record/cli/check-eligible.test.mjs`.

## hold-weekly-brief.mjs

Holds a weekly brief back from the web path, or publishes it again. Setting `status: draft` on the DynamoDB row `WEEKLY_BRIEF#<weekOf>` holds back only the `weekly_brief` action and the email; the record's views are built from append-only `weekly_brief` notes, so they keep serving the brief. This appends a later `weekly_brief` note for the week: the newest note's content with `status: draft` (or `published` with `--publish`) and an `at` after it, through shared `notes.js` (`buildNote`, `makeNoteWriter`; the same writer `briefNotes.writeBriefNote` uses). `newsStoryRecord` (`briefViews.js`) takes the newest note by `at`, so on its next rebuild a held week leaves `index/briefs.json` and `briefs/weekly/<weekOf>.json` becomes a tombstone `{held: true, brief: null}` (view files are never deleted, so a plain drop would leave the old published file served to a direct read and to the Worker pre-render; the tombstone needs the `newsStoryRecord` that writes it deployed). A later `--publish` note brings the week back. If the newest note already has that status nothing is written.

```sh
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/hold-weekly-brief.mjs --week 2026-10-25                     # dry run: prints the draft note
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/hold-weekly-brief.mjs --week 2026-10-25 --row --write       # hold: note + DynamoDB row status draft
RECORD_SDK_DIR=<sdk dir> node backend/record/cli/hold-weekly-brief.mjs --week 2026-10-25 --publish --row --write   # publish again
```
`--week` is the brief's `weekOf`. Dry run by default (reads S3, writes nothing; `--row` is only printed). `--write` appends the note; `--row` also sets the row's `status` (conditional on the row existing). `--prefix` (default `record/`) and `--bucket` as the other CLIs. Test: `node --test backend/record/cli/hold-weekly-brief.test.mjs`.
