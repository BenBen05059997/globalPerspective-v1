# 0053. The country and story history readers read the record's notes, not SummarizeAndPredict

Status: accepted (operator, 2026-10-31: step 5 build B4a); follows 0003, 0035, 0042, 0047, 0048, 0050; built and proven read-only, not deployed
Date: 2026-10-31

## Context
STEP5_AUDIT.md sections 3, 4D, 4E and 6 (steps 1, 3, 5, 6) list what still reads the country and story history families of `SummarizeAndPredict`:
`COUNTRY#` `COUNTRY_INTELLIGENCE`, `HISTORY#`, `DRIFT#` / `DRIFTLOG#`, `FACTS#`, and for stories `THREAD_ANALYSIS`, `THREAD_HISTORY#`, thread `DRIFT#`.
The notes (0042) hold the same content in S3 (`country` 1,560 lines, `drift` 327, `story_analysis` 134), but every reader still asked DynamoDB: the read API
(`country_history`, `corrections_feed`, `thread_analysis`, `country_intelligence`, `country_facts`, `country_preview`, `thread_preview`) and seven Lambdas.
Two things were found in the code and live data while checking what a reader needs (2026-10-31):
- **TTL is off on `SummarizeAndPredict`** (`describe-time-to-live`: DISABLED). The "60-day" `DRIFT#` rows never expire: all 248 country and 121 thread `DRIFT#`
  rows exist, so `corrections_feed` (a Scan of `DRIFT#`) serves 369 notes dating from June, not a 60-day window. A notes reader must not add a window.
- 26 country `DRIFT#` rows (Japan 6, United States 7, Ukraine 6, Russia 4, DR Congo 2, France 1; 23 June to 5 July) have no `DRIFTLOG#` twin: they were written before the archive
  existed, and the drift backfill read `DRIFTLOG#` only. No thread drift row lacks a note (121 of 121). The audit's "about 22" thread rows was an older count.
- `THREAD_HISTORY#` (338 rows, 153 stories, 80 days) is written by `newsThreadAnalysis` in the same call as `THREAD_ANALYSIS`, from the same values (title,
  trajectory, score, dimensions, lead, entry count). Every `story_analysis` note carries those fields and is dated, so from now on the notes ARE the history.
  Only the 179 rows of days before the analysis notes began (159 of 338 are covered by an analysis note of that day) are missing.
- `FACTS#` (40 rows, weekly) has no note at all.

## Decision
### 1. One reader module, one flag
`backend/shared/src/noteReads.js` rebuilds each row exactly as DynamoDB held it (same field names, minus `PK`/`SK`/`ttl`) from the notes:
`countryIntelligence`, `countryHistory` (the last run of each day, newest first, 90), `countryDrift` (one per `asOf`, newest first), `storyDrift`,
`storyAnalysis`, `threadHistory`, `countryFacts`, `driftFeed`. `makeNoteReader` loads a subtype's days from its manifest and keeps them `ttlMs` (read API 300 s,
Lambdas 60 s and dropped at the start of each invocation, so a run never reads older notes than its own previous run wrote). Gating never lives in it.

`NOTES_READS` on each reader:

| value | answers from | also |
|---|---|---|
| `ddb` (default, unset) | DynamoDB | nothing; no S3 client is built |
| `compare` | DynamoDB | reads the notes too and logs `[notes-compare] <read> <args>: same` or the first differing path; a failed notes read is logged, never fatal |
| `notes` | the record's notes | DynamoDB is not read |

Order of use: `compare` for a day or two, read the logs, then `notes`, then (separate step, 5) stop the DynamoDB writes.

### 2. The read API keeps its shapes and its gate
`newsSensitiveData/src/records.js` is the one source of `thread_analysis`, `country_intelligence`, `country_facts`, `country_history`, `corrections_feed`,
`country_preview` and `thread_preview`; it returns the full, ungated rows and `index.js` applies `capForTier` / the 5-note teaser **after** reading, in the Lambda,
whichever the source. Drift depth is therefore never in a view (the `countries/<ISO3>` views still carry only the newest note). `resolveTier` is untouched
(no or invalid token, any error: `free`, still 200). Response bodies are unchanged; notes mode adds nothing to them.

### 3. Two new note subtypes
- `country_facts` (subject kind `country`, ISO3; `model` null because Wikidata and ACLED wrote it, not a model; `at` = `lastUpdatedAt`; payload = the stored item). Writer:
  `newsCountryFactsUpdater` (`src/recordNotes.js`, after its Put, env `NOTES_PREFIX`, unset = no note, best-effort), backfill `backend/record/cli/backfill-country-facts-notes.mjs` (40 rows).
- `story_history` (subject kind `story`; `payload.from = 'history'`, model null): copies of `THREAD_HISTORY#` rows, **backfill only** (`backfill-story-history-notes.mjs`, 338 rows).
  No writer: `newsThreadAnalysis` writes nothing new, because its `story_analysis` note already carries the day's scalars. A separate subtype (not `story_analysis`
  copies) because `views.js` takes the newest `story_analysis` note as a story's analysis and a copy written moments after the real one would win. `threadHistory` takes the analysis
  note for a day that has one and the copy for older days.
- The 26 drift rows: `backfill-drift-notes.mjs` now also reads `DRIFT#` (a pair of one run is one `noteId`, so nothing doubles).
- `backend/shared/src/notes.js` (`countryFactsNote`, `storyHistoryNote`), `note.schema.json` and two examples cover both; `compare-reads.mjs` below proves the projection before anything is written.

### 4. Lambda readers
Switched behind the same flag (default `ddb`, so a deploy changes nothing until the env is set):

| Lambda | reads (file:line before the change) | now |
|---|---|---|
| `newsDriftCorrector` | `readHistory` index.js:46 (country `HISTORY#`), `alreadyNoted` :83, `readThreadHistory` :185 (`THREAD_HISTORY#`), `threadAlreadyNoted` :215 | notes `country`, `drift`, `story_analysis` + `story_history` |
| `newsCountryIntelligence` | `loadThreadAnalyses` :202, `readExisting` :290, `buildDriftBlock` :305, `loadAndMergeDDBFacts` :332 | notes `story_analysis`, `country`, `drift`, `country_facts` |
| `newsSystemsAnalysis` | `loadThreadAnalyses` :183 | notes `story_analysis` |
| `newsPostDevTo` | `loadThreadAnalyses` :40, `loadCountryIntelligence` :55 | `rowReaders` (notes `story_analysis`, `country`) |
| `newsWeeklyBrief` | :58 thread, :65 country (a failed read still fails the run) | `rowReaders` |
| `newsBreakingAlert` | :114 country, :148 and :284 thread (`TOPIC#` reads stay) | `rowReaders` (a read that fails is `null`, as `getRecord` did) |

Not switched (listed, with the reason):
- `newsBoard` `connect.js:40,55,58`, `presets.js:23` through `shared/src/world/readers.js:148,175,181,193-214` (`analyses`, `threadHistory`, `countryHistory`, `driftNotes`): provenance-heavy
  rows and B4b's lane. Needs a notes variant of the world readers.
- `newsEmailSender` index.js:207-236 (country `DRIFT#` plus the `emailedAt` sent flag; rule DISABLED): the flag lives on the DynamoDB row. B4b.
- `NewsProjectInvokeAgentLambda` index.js:43-44, :176, :919 (`FACTS#` leadership for the premise block and the G5 gate) and `THREAD#` `TOPICS` pointers :612-633: the ingest path, B3's file.
  `country_facts` notes make a later switch possible (same `NR.countryFacts`).
- `newsSignals` index.js:163 (parked, decision 0032), `newsSharedAnalysis` `analysisContext` (reads through the read API's `thread_analysis`, so it follows the flag).
- The writers' own puts (`newsThreadAnalysis` :261/:267, `newsDriftCorrector` :141-142, `newsCountryIntelligence` :538/:546, `newsCountryFactsUpdater` :289) stay until the readers run on `notes`.

### 5. Frontend
No change. `useCountryHistory`, `useDeskChanges`, `useCorrectionsFeed`, `useCountryFacts`, the map's thread panel, `usePinInfo` and the analysis-studio fetchers call the actions, which are now
record-backed when the flag says so. The remaining fallbacks to the actions (`useCountryIntelligence` :22-27/:98, `useCountryRiskLayer` :101, `storyAnalysis.js` :14-15, light `useThreadAnalyses`)
answer from the record when the action does, so they need not be removed to delete the DynamoDB families; removing them would leave a page empty whenever a view is missing for no gain.
`country_history` stays the only source of risk snapshots and the member gate for the country page.

## Proof (read only, 2026-10-31, live data; `backend/record/cli/compare-reads.mjs`)
| check | result |
|---|---|
| `country_history` 10 countries (France, Japan, Russia, United States, China, Ukraine, Germany, Iran, DR Congo, Israel): snapshots (19 to 90 rows each) | 10 of 10 equal |
| `country_history` full drift chain, signed-out shape (1 note, honest total, gated) and member shape (all notes) | 10 of 10 equal each (chains of 10 to 34 notes) |
| `corrections_feed`: total (248 country + 121 thread = 369), every row, signed-out (newest 5, total) and member (newest 40) | equal; no row only on one side |
| `thread_analysis` 20 stories (analysis plus latest drift note), `thread_preview` 5 | 20 of 20, 5 of 5 |
| `country_intelligence`, `country_preview` 10 each | 10 of 10 each |
| `country_facts` 40 countries (public shape) and 10 raw rows, from the notes the backfill would write | 40 of 40, 10 of 10 |
| thread history, 20 stories (of 153), from analysis notes plus the 338 would-be copies | 20 of 20 |
| coverage before backfill | country drift: 26 of 248 dates have no note; thread drift 0 of 121; thread history 179 of 338 rows need a copy |

One deliberate difference: after the drift backfill the notes also hold the 26 `DRIFT#`-only rows older than the newest ten, which `country_history` never read (it took the
newest 10 `DRIFT#` and 90 `DRIFTLOG#`). A member sees up to 7 more old notes for a country (of the ten sampled: France 1, Japan 6, Russia 4, United States 7, Ukraine 6, DR Congo 1; China, Germany, Iran, Israel none);
signed-out callers still see one note, and every note the action served is identical. An analysis whose note says no countries has no `iso3` field (DynamoDB had it absent on
rows written before `iso3` was kept; the page treats both as empty).

Unit tests: shared `noteReads.test.js`, read API `notesReads.test.js` (all seven actions in `notes` vs `ddb`, compare logging, no S3 client in `ddb`), a `notesReads.test.js` in each of newsDriftCorrector,
newsCountryIntelligence and newsSystemsAnalysis, `recordNotes.test.js` for the facts writer, CLI tests for the three backfills.

## Steps, in order (each is the coordinator's; nothing here was run)
1. IAM (operator yes). Read: `newsprojectLambdaRolefcb19312-dev` (read API and `newsEmailSender`) gets an inline `notesRead`: `s3:GetObject` on `record/notes/{country,drift,story_analysis,story_history,country_facts}/*`
   and an unconditional `s3:ListBucket` on the bucket (a prefix condition would turn a missing manifest into 403). `newsCountryIntelligence-role-xqboqh2y` (drift corrector, country intelligence, systems analysis)
   already has Get/Put on `drift/*` and `country/*`; add `s3:GetObject` on `story_analysis/*`, `story_history/*`, `country_facts/*`. `newsPostDevTo-role-uek0owwd`, `newsWeeklyBrief-role`, `newsBreakingAlert-role`:
   `s3:GetObject` on `country/*` and `story_analysis/*` plus the `ListBucket`. Write: `newsCountryFactsUpdater` role `service-role/newsCountryFactsUpdater-role-q9031kon` gets `countryFactsNotesWriter`:
   Get/Put on `record/notes/country_facts/*` and `record/shadow/notes/country_facts/*` plus `ListBucket`. Repeat the `record/shadow/` prefixes for any reader pointed at a trial prefix.
2. Backfills (dry run done: facts 40, story history 338 across 153 stories and 80 days, country drift 248 incl. the 26, story drift 121): `backfill-drift-notes.mjs`, `backfill-country-facts-notes.mjs`, `backfill-story-history-notes.mjs`
   without `--live` first (writes `record/shadow/`), then `--live`. Re-run `compare-reads.mjs`.
3. Deploy (diff first; each deployed zip also differs from the repo in shared files, `notes.js`, `world/readers.js` and, for `newsCountryIntelligence`, `country_facts.json`, so read the diff, do not assume it is only this change):
   `newsCountryFactsUpdater`, `newsSensitiveData-dev`, `newsDriftCorrector`, `newsCountryIntelligence`, `newsSystemsAnalysis`, `newsPostDevTo`, `newsWeeklyBrief`, `newsBreakingAlert`.
   With `NOTES_READS` unset all of them behave as before.
4. Env (fetch, merge, write the full map): `NOTES_PREFIX=record/shadow/` then `record/` on `newsCountryFactsUpdater`; the next Monday 05:00 JST run writes the first facts note.
5. `NOTES_READS=compare` on the read API; watch CloudWatch for `[notes-compare]` lines with a difference (a day); then `notes`. The Lambdas the same way, writers last (drift corrector, country intelligence).
6. Only then step 5 of the audit: stop the DynamoDB writes and delete the families (export first, one yes each).

## Consequences
- The country and story history families have no reader left that needs DynamoDB except the ones listed under "Not switched". Deleting `DRIFTLOG#` needs no further reader change; `HISTORY#`, `THREAD_HISTORY#`,
  `THREAD_ANALYSIS` and `COUNTRY_INTELLIGENCE` need the `newsBoard` world readers and the writers' own reads; `FACTS#` needs the agent.
- A cold read API container reads up to 119 country files, 64 drift files and 111 analysis files (about 5 MB) before answering, once per five minutes per container; the manifests keep it bounded. If the
  action gets slow, the answer is a per-country or per-day index view, not a shorter cache.
- The notes are an append-only history: `country_history` snapshots now never age out (DynamoDB held 90 rows per country only because of the Query limit; TTL was never on).

## Rejected
- Replaying `THREAD_HISTORY#` rows as `story_analysis` copies: would shadow the real analysis in the story views.
- A 60-day window on the corrections ledger: the old action had none (TTL off), the audit's "60-day" was a code comment.
- Reading the notes in the Lambda without a flag: the families cannot be deleted before the notes are proven on the live path, and `compare` is the proof.
