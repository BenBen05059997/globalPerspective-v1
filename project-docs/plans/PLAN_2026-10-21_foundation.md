# Foundation: facts are the system of record

Status: active (2026-10-22): step 1 live and scheduled; step 2 building in lanes J (views builder) and K (board reads views)

## Purpose
Make `record/facts/` the one place world data is true, and everything readers see a view rebuilt from it. Today the
same data sits in up to four stores, IDs change between runs, and 28 of the last 60 archive days are missing.
This plan is the order of work and the checklist; the stocktake (dated 2026-10-21) is [FOUNDATION.md](../architecture/FOUNDATION.md).

## The design (operator, 2026-10-21; decision 0035, not re-decided here)
- Rule: world data lives in `record/facts/` (S3, append-only); user data in DynamoDB; readers see static JSON views through the Worker. Rebuild test: delete every view and every world table row, and the site rebuilds from `record/facts/` + `record/readings/`. The DynamoDB world rows (`archive#`, `THREAD#`, `DRIFT#`, ...) become a working cache until nothing reads them.
- Five stages: Ingest (several times a day), Commit (forecasts, daily), Review (weekly), Build (after each ingest and review, no model), Serve. Watch is a rule: every run writes a Run object; a missing or empty Run is the alarm. The ten stages stay as the detailed mapping: `architecture/ARCHITECTURE_TIMELINE.md` §1b, §8.
- IDs by content: entry `sha1(canonical url)`, source `sha1(domain)`, actor `name:<normalized>`, story keeps `threadId` plus a merge record; `schemaVersion` on every object.
- Kept from the earlier record plan (no human gate, 2026-10-20): verdicts, branch status, chapters and links are written by Lambdas; a wrong result is an algorithm bug, fixed and appended as a correction (decision 0034). Own folders `backend/record/`, `backend/weekly/`, `backend/board/`. The record is append-only; deletion does not exist, items are greyed. Publish-unless-vetoed for the weekly (a veto writes `status:'held'`; enabling the sender on the new path is a user-facing send and needs a fresh yes).

## Checklist by step
Rule: only the coordinator ticks a box, after reviewing the evidence. Status: ☐ not started, ◐ partial, ☑ done.
Each step gets a written decision before code. The coordinator never builds; lanes and agents do.

### Step 0. Diagnose the missing archive days (read-only, first)
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Why `archive#DATE` is missing for 28 of the last 60 days (Aug 23-Sep 2, Sep 14-29, Oct 14) | agent | no | ☑ | Step 0 finding below; coordinator re-checked CloudWatch: newsInvokeGemini-dev daily avg Duration 39-69 s → 5 s on 08-23, 25 s → 3 s on 09-14, 6 runs/day, Errors 0 |
| Written finding: cause, whether the days can be recovered, how step 1 makes gaps visible | agent | no | ☑ | Step 0 finding below; requirements copied into decision 0036 §5 |
| Oct 20 archive holds 14 entries (outage); note the thin day | agent | no | ☑ | 14 entries confirmed (10-19: 29, 10-10: 50); all three 10-20 model runs fast-failed ~3 s |

### Step 0 finding (2026-10-21)

**Cause (all 3 gaps, same signature; the cause of the failure itself is unverified).** The schedules never stopped: `InvokeGoogleGemini` and `InvokeNewsAgent` are ENABLED, last modified 2026-09-29 11:40 JST (thinned from 6 to 3 runs a day, commit 5d233f8e). CloudWatch `Invocations` show 6/day (3/day from 09-30) on every gap day and `Errors` = 0. But `Duration` collapses on exactly the gap days:
- `newsInvokeGemini-dev` max 4 s (normal 28-60 s) and `NewsProjectInvokeAgentLambda-dev` max 2-3 s (normal 75-110 s) on 08-23..09-02, 09-14..09-29, 10-14. Boundaries are sharp: 08-22 125 s, 08-23 3 s; 09-02 2 s, 09-03 83 s; 09-13 88 s, 09-14 3 s; 09-29 3 s, 09-30 69 s; 10-13 28 s, 10-14 2 s, 10-15 111 s.
- Code path: on a scheduled event gemini catches every failure and returns `{status:'error'}` instead of throwing (`newsInvokeGemini/src/index.js:505-506, 677-678, 847-850`), so Lambda reports success and the Errors metric stays 0. No staging is written, so the agent logs "Skipping run: staging ... already processed" (`NewsProjectInvokeAgentLambda/src/index.js:140`) and returns in 2 s. `buildAndWriteArchive` runs only after `swapped` (index.js:256-258), so no `today-archive` / `archive#DATE` write happens (and `latest` is not refreshed).
- Not a TTL or delete problem: table TTL is DISABLED; surviving rows carry 90-day `ttl` values; no code path deletes `archive#`. Not a deploy regression (gap days predate the 2026-10-19/20 deploys; gap ends 09-29/09-30 coincident with the schedule change, but the 09-14 start has no matching change; coincidence, cause unknown).
- Same fast-fail signature on 10-20 (gemini 3.2 s at 04Z, 12Z and 20Z), which is the known DeepSeek 402 outage.
- **Unverified:** the actual error text for Aug 23-Sep 2 and Sep 14-29 (probably a provider/key/credit failure like the 402, but not proven). Both log groups have 7-day retention, so no log line for any gap day (and likely not 10-14) can be read.
- Root-cause class: **outage / upstream failure swallowed (code skip on error, reported as success)**. Not "schedule disabled".

**Oct 20 thin day (verified).** `archive#2026-10-20` has 14 entries (10-19: 29, 10-10: 50). All three Oct 20 gemini runs took ~3 s (fast-fail), so the 14 came from the one partial agent run (updatedAt 12:26Z; agent max 29 s). It coincides with the 402 outage (known from 03:50Z). Oct 19 at 29 is also below the 35-50 norm (cause not examined).

**Recoverability.**
- 08-23..09-02: not recoverable. S3 `corpus/` starts 2026-09-08 and holds map headlines (GDELT/GDACS), not editorial entries; `stories/` expires at 45 days; `web/` has only 10-19..10-21; `world/` snapshots are hourly map state, not entries. No pipeline output existed on those days (gemini never produced staging), so no store holds them.
- 09-14..09-29: not recoverable as editorial entries, for the same reason (no topics were generated). `corpus/` has map headlines for these days only; usable at most for a map-level facts file, not for archive entries.
- 10-14: not recoverable (no topics generated; record timeline mirrors the gap).
- Earlier gaps (04-29..05-15, 07-12..07-25) from FOUNDATION.md G: same class, not re-checked.
- Unverified: `THREAD#<id>` rows with per-day entries, DRIFT rows and `PRED#` rows were not read (get-item needs known keys, no Scan). They can only reference stories that existed, and no story was generated on the gap days.
- `today-archive` is not a fallback: 24 h TTL, overwritten by each run, holds only the current UTC day.

**Requirements for step 1 (a missing day must be visible the same day).**
1. A Run object for every facts-writer run, written on failure and on skip too (`inputs.archiveDay`/`todayArchive` = present|missing|thin, `status`, reason); a day with no Run, or a Run stuck at `started`, is the alarm (matches decision 0036).
2. A same-day alarm on "no `record/facts/DATE.jsonl` (or Run with count 0) by a fixed HH:MMZ", plus an alarm on upstream fast-fail: gemini/agent returning `{status:'error'}` must throw or emit a metric (today `Errors` is 0 on every gap day, so Lambda-error alarms are blind).
3. The facts writer reads `today-archive` as well as `archive#DATE` (and `latest`) so a missing daily row does not lose the day; thin days (entry count below a floor, e.g. 20) get `thin:<count>` in the Run. Also raise log retention on the pipeline log groups above 7 days so the next failure can be diagnosed.

### Step 1. Ingest writes facts alongside today's rows
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Decision written (facts format, content IDs, schemaVersion, Run object) | coordinator | no | ☑ | decision 0036 (2026-10-21) |
| Facts writer: `record/facts/`, entry ID `sha1(canonical url)`, `schemaVersion`, no model steps | lane (record) | no | ☑ | lane I merged (8098c5d3..d2492a6a): facts only, `record/facts/`, content IDs, schemaVersion; dry run 09-06..10-20: 929 entry, 401 story_born, 994 forecast_drawn, 17 missing days; deployed 2026-10-21 CodeSha256 tAf4hSEa... |
| Remove the per-day model steps (650-1,560 calls a run if `RECORD_LLM_MODEL` and a schedule were set) | lane (record) | no | ☑ | 8098c5d3: prompts.js and the chapter/trigger/line steps deleted; no model module imported (reviewer grep) |
| Run object per run; empty or missing Run alarms | lane (record) | alarm topic: yes | ◐ | 357fd2e7: Run written at start and end, `strict` run throws on a missing day; alarms not built |
| Shared world reader `backend/shared/src/world/` | coordinator | no | ◐ | a925f149, 41b71786, 1d5a76b7; weekly `pull.mjs` not written, other Lambdas still parse raw tables |
| Backfill from existing `archive#` rows (Sept 6 onward) | lane (record) | no | ☑ | e191f1c1; live run 2026-10-22 over 09-06..10-22: 47 Runs (28 ok, 19 failed: archive missing), 929 entry, 401 story_born, 994 forecast_drawn, 0 duplicate eventIds; matches DRYRUN.md |
| Schedule on the facts writer | coordinator | IAM and schedule: yes | ☑ | operator yes 2026-10-22, straight to live (shadow run had proven the path): EventBridge rule `TriggerStoryRecord` cron(45 23 * * ? *), payload `{"shadow":false}`; first run 2026-10-22 23:45Z |
| `newsInvokeGemini-dev`: a failed model call must fail the run (today it returns `{status:'error'}` and the day is marked processed; cause of the 28 lost days) | lane (pipeline) | no | ☑ | 50f9c645 merged; live alarm `lambda-errors-newsInvokeGemini-dev` now fires on a failed run; deployed 2026-10-21 CodeSha256 tXJSYjtU... |
| `NewsProjectInvokeAgentLambda`: a stale-run skip (`staging-already-processed`, index.js:139) must count as a failed day, not success | lane (pipeline) | no | ☑ | e22e7516 merged: staging generated before the current 04:15/12:15/20:15 slot throws `stale-processed-staging`; deployed 2026-10-21 CodeSha256 LH7/a6s6... |
| `NewsProjectInvokeAgentLambda` tests: 2 of 83 fail on main ("zero generated" harness tests 61, 63), unrelated to the fixes above | lane (pipeline) | no | ☐ | seen 2026-10-21 on main and lane/agent-stale; not investigated |
| Stale-run guard, same-run joins, failed-run marker in the agent Lambda | lane (pipeline) | no | ☑ | merge 5df2a670, deployed `NewsProjectInvokeAgentLambda-dev` CodeSha256 roXZtju... |
| Same-day duplicate and over-join fixes proven over a clean week | lane (pipeline) | no | ◐ | b198ff92, b8858db6 deployed 2026-10-19; only two runs before the outage; unproven |
| Alarm on `LLM 402`; one alert topic | lane (pipeline) | yes | ☐ | alarm absent; two topics exist; DeepSeek balance is an operator top-up |
| Duplicate-story alias record (survivor + merge record, never edited) | lane (record) | no | ☐ | 18 known same-day duplicates still split in every store; Canadian base fire pair open |

### Step 2. Board and story page read views
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Decision written (view paths, `index/active`, `links/{id}`, daily counts) | coordinator | no | ☑ | decision 0037 (2026-10-21) |
| Views builder from facts (no model) | lane (record) | no | ☐ | `timeline.js rebuildStory` mixes judgments in |
| `newsBoard` reads the new view paths | lane (board) | no | ◐ | `newsBoard` deployed, reads `record/index.json` and `record/stories/*`; its role has nothing under those, so record panels return "no record" |
| `newsBoard` IAM on the new paths | coordinator | IAM: yes | ☐ | `newsBoard-role` reads the old two paths only |
| Worker `DATA_ALLOWED` allowlist gains `record/` (and `weekly/`) | coordinator | Worker upload and reader IAM: yes | ☐ | worker.mjs line 13 allows `world/`, `situations/state/`, `stories/state/` only |
| Board UI with the unsettled zone, released | lane (board) | frontend release: yes | ☐ | slice 2 merged, UI not released; `StoryTree.jsx` has no unsettled state |
| Story page reads views | lane (frontend) | frontend release: yes | ☐ | not started |

### Step 3. Review Lambda `newsRecordReview` (weekly)
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Decision written (reading object: cites, covers, supersedes, run, model, promptVersion) | coordinator | no | ☐ | object model in TIMELINE §4 |
| Golden-week fixture `record/fixtures/golden-week/` | lane (record) | no | ☐ | not built |
| `newsRecordReview`: chapters, lines, branch status, typed links, merges; one call per active story; daily analysis and drift notes folded in | lane (record) | IAM, schedule, model key: yes | ☐ | not started |
| Weekly report reads its readings (`pull.mjs`) | lane (weekly) | email send: yes | ◐ | `backend/weekly` has sections and schema; no pull, no readings input |
| Resolver verdicts (Commit stage) | lane (predictions) | no | ☑ | e2132a75, deployed CodeSha256 Z9D6hUJD...; decision 0034; 0 verdicts so far, first expected FEMA re-draft 2026-10-24 |
| `newsSystemsAnalysis` link-confirmation field (typed links) | lane (pipeline) | no | ☐ | not started |
| Retire `newsWeeklyBrief` after the first weekly from the new path sends | coordinator | yes | ☐ | still Sun 06:00Z |

### Step 4. Retire duplicates and per-Lambda parsers
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Move each remaining raw-row parser to `world/` or to a view (FOUNDATION.md D), one at a time | lane | no | ☐ | no reader in `world/` for TOPIC#, FACTS#, COUNTRY_INTELLIGENCE, DAILY_BRIEF#, WEEKLY_BRIEF#, `THREAD#/WEB` |
| Delete each store in the retire list below once nothing reads it | coordinator | yes, each | ☐ | see table |
| Decisions 0010 and 0011 marked superseded | coordinator | no | ☑ | ADR 0035; README index updated |

### Step 5. Remove the world DynamoDB rows
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Rebuild test passes (delete all views and world rows in a copy; site rebuilds from facts + readings) | coordinator | no | ☐ | not run |
| Remove `archive#`, `THREAD#`, `DRIFT#`, ... rows | coordinator | yes (destructive) | ☐ | not started |

## Retire list
Each item needs a separate operator yes before deletion. Sizes and readers are from `architecture/FOUNDATION.md`; "reads it today" not re-verified unless stated.
| Item | Size / evidence | Reads it today? | Operator yes |
|---|---|---|---|
| `DRIFTLOG#` rows | permanent copy of `DRIFT#`, written field for field (index.js 121-122) | `world/` driftNotes, `newsSensitiveData` member history | pending |
| `situations/history` | mirror of `world/` snapshots, 2,081 objects | not verified | pending |
| `WEB#INDEX/LATEST` | same content as S3 `web/latest.json` | world `webIndex`, `newsSensitiveData`, `newsWeeklyBrief` | pending |
| `tags/backfill` | writer not in repo, nothing reads it | none known | pending |
| `world/shadow` | `DRY_RUN=false`, not written | none known | pending |
| `signals/snapshots` | 1.03 GB, build disabled (decision 0032) | none | pending |
| The 8 Scans in `newsSensitiveData` | replaced by views | itself | pending |
| Decisions 0010 and 0011 (Studio half) | lean on the retired Studio (0033) | n/a: marked superseded in ADR 0035 | not a deletion |

## Open questions
- Does the daily story analysis and drift note fold into the weekly Review cleanly, or does the board need a daily note kept as cited input (revisit after two weekly runs)?
- Which model runs the Review: `deepseek-v4-pro` as the resolver, or the headless run's model? Cost per run to be measured on the golden week.
- Does the prediction log (DATA_STRATEGY §6) migrate to `record/` in step 1 or later?
- One ingest or two (`architecture/ARCHITECTURE_INGEST_DESIGN.md`): the hourly map ingest versus the 3x/day selector. Still proposed. The map has weak thread links (17 of 3,436 map stories) and fragmented ids (Russia-Ukraine as 7 pins).
- The `ae75a8`, `287240`, `4e946d`, `68e0fb` threads are over-joined (mixed entries): split before they become facts?
- Storage review result stands: keep DynamoDB for users, consolidate the 5 user tables. Unverified: Tokyo prices, S3 compare-and-swap.
- `stories/state/` holds 3,436 objects never pruned; 13 of ~25 feeds are fetched by both pipelines.

## Risks
- Deployed Lambda zips can differ from the repo; diff before any deploy.
- DeepSeek 402 stops every LLM Lambda. `newsInvokeGemini` and the agent now fail the run (50f9c645, e22e7516); other stages may still swallow it, unchecked.

## Log
- 2026-10-21: lane I built the facts writer on `lane/facts` (not merged, not deployed; boxes above untouched). `newsStoryRecord` 0.2.0 appends `entry`, `story_born`, `forecast_drawn`, `verdict` facts (and has builders for `correction`, `story_merged`, which no input feeds yet) to `record/facts/YYYY-MM-DD.jsonl` (shadow: `record/shadow/facts/`), writes a Run per day (`record/runs/`) and a conditional `record/facts/manifest.json`; the model steps, prompts, `coverage` events and the timeline, stories and index products are gone. Entry IDs are `sha1('entry' + smallest canonical url)`. A day with no archive row ends its Run `failed` with `inputs.archiveDay:"missing"`, and a daily run throws so the schedule shows an Error. Backfill is `event.backfill = {from, to}`, oldest first. Choices to confirm: a verdict is read only for sampled questions whose forecast is in the last 60 days of facts; `net.au` added to the two-level suffix list; `summary` on entry facts is null (the archive row holds none). Needs from the coordinator: IAM `PutObject` on the facts/runs/manifest keys, the schedule, the alarms, an s3json ETag helper (lane mailbox).
- 2026-10-21: operator approved the design (facts as system of record, five stages, content IDs, retire list, migration order). Written as ADR 0035 and this plan; replaces `PLAN_2026-10-20_record_backend.md`.
- 2026-10-21: two clocks adopted earlier the same day (facts daily, readings weekly); see TIMELINE §1c.
- 2026-10-20: step "resolver writes verdicts itself" done and deployed (decision 0034). Stale-run guard deployed (5df2a670). One world reader merged (a925f149).
- 2026-10-20: DeepSeek 402 outage from about 03:50Z, caused the missing `archive#2026-10-14` and thin 10-13 and 10-20.
- 2026-10-22: lane I closed; worktrees for lanes I, C, H, gemini-fail, agent-stale removed. Docs checked against code: newsStoryRecord README deployment note and two risks corrected.
- 2026-10-22: operator yes; `newsStoryRecord-role` statement `RecordWrites` adds PutObject `record/facts/*`, `record/runs/*` (DynamoDB stays read-only). Live backfill 09-06..10-22 with `strict:false`. A day's archive facts are filed under their publish date (Oct 20 archive lands in 10-19), so a day's Run counts the facts dated that day.
- 2026-10-22: schedule `TriggerStoryRecord` created (EventBridge rule, not Scheduler: the existing Scheduler roles may only invoke the agent, and a new role is an IAM change). Alarms parked by the operator. Docs consolidated: ARCHITECTURE_TIMELINE.md is the single record doc (0d850be5).
- 2026-10-22: operator go for all of step 2. Lanes J (`lane/views`, backend/record views builder) and K (`lane/board3`, newsBoard + board UI + Worker allowlist line) opened in parallel on Sonnet; briefs in the mailbox prompts. IAM, Worker upload, deploys and the frontend release stay with the coordinator.
