# 0035. Facts are the system of record

Status: accepted (supersedes 0010 and 0011, which lean on the retired Studio; 0034 stands)
Date: 2026-10-21

## Context
The stocktake in `architecture/FOUNDATION.md` (2026-10-21, read-only, code and live AWS) found:
- 28 of the last 60 days have no `archive#DATE` row (Aug 23-Sep 2, Sep 14-29, Oct 14). No other copy of the editorial days is known.
- The entry ID `topicId` is `<title>-<rank>` and changes between runs; the map's `storyId` is a second story ID; a story has no merge record, so 18 known duplicates stay split in every store.
- Four stores hold the same data: `DRIFT#` and `DRIFTLOG#`, `WEB#INDEX` and S3 `web/`, `situations/history` and `world/` snapshots, entry text in `archive#`, `TOPIC#` and the record timeline.
- One shared reader (`backend/shared/src/world/`) exists, and 2 of 41 Lambdas use it; the rest parse raw rows themselves.
- About half the stores are only described in docs, with no record of why they exist (decision-coverage audit, FOUNDATION.md H).
Table TTL is disabled, so history is not deleted today, but nothing says the DynamoDB world rows are the truth.

## Decision
We will treat facts as the system of record.
- **Rule.** World data lives in `record/facts/` (S3, append-only). User data (boards, pins, prefs) stays in DynamoDB. Everything readers see is a view rebuilt from facts and readings and served as static JSON through the Worker.
- **Rebuild test.** Delete every view and every world table row; the site rebuilds from `record/facts/` and `record/readings/`.
- **Five stages.** Ingest (feeds, entries with content IDs, story assignment, append facts; several times a day; the selector is the only model). Commit (forecasts: forks, branches, due dates; resolver verdicts; daily, because a forecast is a dated commitment). Review (chapters, lines, branch status, typed links, merges; weekly; one call per active story; the daily story analysis and drift notes fold into it). Build (views from facts and readings after each ingest and review; no model). Serve (the Worker serves views; one Lambda for user data). The ten stages stay as the detailed mapping in `ARCHITECTURE_TIMELINE.md` §1b and `pipeline.json`.
- **Watch is a rule, not a stage.** Every run writes a Run object; a missing or empty Run is the alarm.
- **IDs by content.** Entry `sha1(canonical url)`. Story keeps `threadId` plus a merge record (a duplicate points at the survivor; records are never edited). Source `sha1(domain)`. Actor `name:<normalized>` until it needs more. `schemaVersion` on every object. Deferred until the news needs them: an actor table, source types, date precision, the question/outcome branch shape.

## Consequences
- The DynamoDB world rows (`archive#`, `THREAD#`, `DRIFT#`, ...) are demoted from truth to a working cache and are removed once nothing reads them.
- Retire list, each needing a separate operator yes: `DRIFTLOG#`, `situations/history`, `WEB#INDEX`, `tags/backfill`, `world/shadow`, `signals/snapshots` (1.03 GB, build disabled), the 8 Scans in `newsSensitiveData`. Pending; listed in the plan.
- Migration is one writer at a time, each step with a written decision before code: 0 diagnose the missing archive days; 1 Ingest writes facts alongside today's rows; 2 board and story page read views, Worker allowlist gains `record/`, `newsBoard` IAM moves; 3 `newsRecordReview` weekly, golden-week fixture first; 4 retire duplicates and per-Lambda parsers; 5 remove the world rows once the rebuild test passes. Checklist: `plans/PLAN_2026-10-21_foundation.md`.
- Stays: DynamoDB for user data (decision 0003); forecasts stay daily; the resolver writes verdicts itself (0034); the no-human-gate rule.
- `ARCHITECTURE_RECORD.md` §3 (the `record/index.json` layout) is replaced by a pointer to `ARCHITECTURE_TIMELINE.md` §5.
- Decisions 0010 (deep analysis in the Studio) and 0011 (Studio stays a page) are marked superseded; the Studio was retired in 0033. Their other parts (the country card split, the lean sampled track record) are carried by 0034 and the code.
