# Data Strategy: S3 for the world, DynamoDB for the user

Binding rule (decision [0003](../decisions/0003-storage-s3-world-dynamodb-user.md)); applies to every new subsystem and to existing tables incrementally (§6). Live inventories come from AWS (`aws s3 ls`, `aws dynamodb list-tables`, `aws events list-rules`, `aws lambda list-functions`, `aws iam get-role-policy`) and `scripts/functions.json`; this file holds the rules and the ownership map.

## 1. The principle

> **S3 for the world. DynamoDB for the user.**
> Anything the pipeline computes *about the world* is a versioned JSON object in S3. Anything a *person* owns, pays for, or configures is a DynamoDB row.

The sorting test for any datum: "If this user deleted their account, would the data disappear?" No: S3. Yes: DynamoDB.

Why: the pipeline Lambdas batch-produce immutable snapshots (hourly, 8-hourly, daily) that the frontend reads and never edits. That is an object-store workload. Forcing it into DynamoDB gave many tables, hand-built indexes to answer "give me recent", TTLs that delete history we want, 400 KB item caps, and a proxy Lambda in the read path. S3 makes the read path a CDN fetch and makes history, replay and diffing properties of the store.

## 2. What lives where

| Store | Holds | Examples |
|---|---|---|
| **S3** (`globalperspective-world-<account>`, private) | everything computed about the world; append-only corpora and the record; versioned snapshots; audit and event logs | corpus, stories, situations, `world/latest.json`, `record/`, the track-record snapshot, GDACS and GDELT mirrors, signals |
| **DynamoDB**, target: the five user tables | per-user, mutable, concurrent, transactional | `GlobalPerspectiveUserTable` (tier, Polar ids), `GlobalPerspectiveSavedItems`, `GlobalPerspectiveUserPrefs`, `GlobalPerspectiveApiKeys`, `GlobalPerspectiveShares` |

Board data (no new table): a member's boards are `GlobalPerspectiveSavedItems` items with `savedKey` `board#<boardId>` (shape: `backend/board/schema/board.schema.json`), and follows of stories and actors are `followedThreads` / `followedActors` in `GlobalPerspectiveUserPrefs`. Sole writer of both: `newsBoard`. `newsSavedItems` hides `board#` items from the saved list.

`GlobalPerspectiveShares` is the one approved exception to "nothing new in DynamoDB" (operator, 2026-09-30): user-owned share links, partition key `id` (a 22-character public id), a keys-only index `uid-createdAt-index` for the owner's list and account deletion, on-demand billing, deletion protection, no TTL, sole writer `newsSharedAnalysis`. A new table needs an exception recorded here.

Live there are 12 Global Perspectives tables: the five above plus seven world tables not yet migrated (§6): `NewsCache` (topics), `SummarizeAndPredict`, `GlobalPerspectivePredictionLog`, `GlobalPerspectiveBreakingAlerts`, `GlobalPerspectiveMarkets`, `GlobalPerspectiveClientErrors`, `NewsProject-linkedin-posts`. (`PPA*`, `ppa-*` and Polybot tables belong to other projects in the account.)

## 3. Rules that keep S3-as-truth safe

1. **One writer per prefix.** Every prefix has exactly one Lambda that writes it; others only read. Contention is a design bug, not an operational one (ownership table: §4).
2. **Openers append events; folders own state.** Sources of facts write to an `inbox/`; a single folder Lambda reads the inbox and is the only writer of `state/`. Live, the only opener of the map is GDACS (one overwritten `situations/inbox/gdacs-latest.json`); news situations come from `stories/index.json`. The record uses the same rule for its inboxes (`record/inbox/<kind>/`).
3. **Never `ListObjects` on a hot path.** Every collection maintains an `index.json` or manifest written by its owner. Listing is for operations and replay only.
4. **Snapshots are immutable; `latest` is a pointer.** Writers put `…/YYYY/MM/DD/HHMM.json` then overwrite `…/latest.json`. History is never rewritten.
5. **Freshness is data, not inference.** Bundles carry `generated_at`, `next_expected_at`, per-source stamps and a `stale` flag computed by the writer. The frontend displays staleness; it does not compute it.
6. **The bucket stays private.** The browser reads through the Cloudflare Worker (SigV4 to S3, edge cache). No public-read ACLs. A member-gated bundle is a second object the Worker serves only with a valid Firebase JWT (the check is a stub that refuses today, so `*.member.*` keys return 401).
7. **Lifecycle replaces TTL.** Rules by prefix (below); `latest` objects never expire.
8. **Conditional writes where a read-modify-write is unavoidable:** `If-Match` (ETag) on PUT, retry once, log the conflict. Prefer redesigning to one writer. Record files use put-once (`If-None-Match: *`).
9. **Small objects, many keys is fine; big objects are not.** Cap a bundle at about 300 KB gzipped; move detail to per-item objects fetched on demand.
10. **Local dev runs on fixtures.** Because the contract is JSON, `npm run dev` points at `fixtures/world.json`; no AWS is needed for frontend work.

## 4. Prefix ownership

| Prefix | Sole writer | Cadence | Readers |
|---|---|---|---|
| `corpus/YYYY/MM/DD/HH.jsonl` | `newsSituationIngest` | hourly | audit, replay |
| `stories/state/<storyId>.json`, `stories/index.json` (cluster state; `storyId` is the legacy cluster name) | `newsSituationIngest` | hourly | tracker, map detail, the agent's thread matcher |
| `stories/classify-cache.json` | `newsSituationIngest` | hourly (overwrite) | `newsSituationIngest` only |
| `situations/inbox/gdacs-latest.json` | `newsGdacsIngest` | 20 min | tracker |
| `situations/state/<id>.json`, `situations/index.json` | `newsSituationTracker` | 30-min sweep | map, thread and country pages |
| `situations/archive/<id>.json` | `newsSituationTracker` | on close and age-out | audit |
| `situations/history/YYYY/MM/DD/HH/HHMM.json` | `newsSituationTracker` | each sweep | scrubber, `scripts/situations-log.mjs` |
| `world/latest.json`, `world/YYYY/MM/DD/HHMM.json`, `world/latest.member.json` | `newsSituationTracker` (assembles at the end of a sweep) | each sweep | frontend via the Worker (member file JWT-gated) |
| `world/shadow/…`, `shadow/situations/…` | tracker in `DRY_RUN` (live `DRY_RUN=false`, so not written today) | | humans, tuning |
| `web/latest.json`, `web/YYYY/MM/DD.json` (story web snapshot) | `newsSystemsAnalysis` | daily 05:00 UTC | `newsStoryRecord` (world reader) |
| `threads/story-map.json` (storyId and threadId pairs) | `NewsProjectInvokeAgentLambda` | each story run | `newsSituationTracker` |
| `tags/backfill/2026-09-11.json` | one-off backfill, writer not in the repo | | none |
| `fixtures/` | humans | | local dev, Worker smoke |
| `signals/latest.json`, `signals/snapshots/` | `newsSignals` (cron disabled; parked, decision 0032) | | `newsSignals` only; never the Worker |
| `corpus/gdacs/latest.json` | `newsGdacsIngest` | each run | `newsImpactAudit` (parked) |
| `corpus/gdelt/<day>.json` | `newsGdeltConflict` | each run | `newsImpactAudit` (parked) |
| `audit/impact/…` | `newsImpactAudit` | parked (rule DISABLED, decision 0015) | operator |
| `audit/ingest-capture/latest.json` | `newsInvokeGemini` | each generation | `newsSelectionShadow`, `newsImpactAudit` |
| `audit/selection-shadow/YYYY-MM-DD/HHMM.json`, `latest.json` | `newsSelectionShadow` | 3x/day | operator review only |
| `predictions/track_record.json` | `newsPredictionsSnapshot` | 30 min | the proxy action `prediction_track_record` |
| `monitoring/freshness/state.json` (alert dedupe marker) | `newsFreshnessMonitor` | each run | `newsFreshnessMonitor` |
| `record/facts/YYYY-MM-DD.jsonl`, `record/facts/manifest.json` | `newsStoryRecord` | daily (rule `TriggerStoryRecord`, 23:45 UTC, `{"shadow":false}`), append-only, no model | `newsRecordReview`, view rebuilds, `newsPredictionResolver` |
| `record/runs/YYYY-MM-DD.json` | `newsStoryRecord` | daily, the one mutable object | `newsPredictionResolver` (coverage guard), operator |
| `record/inbox/articles/YYYY-MM-DD.jsonl` | the selector `newsInvokeGemini` (before its model call) and the recovery script | each generation | `newsStoryRecord` |
| `record/inbox/verdicts/YYYY-MM-DD.jsonl` | `newsPredictionResolver` | on each decision | `newsStoryRecord` (run day and six before) |
| `record/inbox/draws/YYYY-MM-DD.jsonl` | `newsPredictionResolver` | on each weekly commit and draw | `newsStoryRecord` (run day and six before) |
| `record/inbox/merges/YYYY-MM-DD.jsonl` | `newsRecordReview`; operator lines on demand | weekly | `newsStoryRecord` |
| `record/inbox/splits/YYYY-MM-DD.jsonl` | operator only | on demand | `newsStoryRecord` |
| `record/inbox/assignments/YYYY-MM-DD.jsonl` | operator, applying approved review proposals or benchmark placements | on demand | `newsStoryRecord` |
| `record/operator/aliases.json` (the who's who file) | operator only | on demand | `newsStoryRecord`, `newsRecordReview` |
| `record/notes/entry/YYYY-MM-DD.jsonl`, `record/notes/entry/manifest.json` | `NewsProjectInvokeAgentLambda` after its daily archive (env `NOTES_PREFIX`; `record/shadow/` until switched), and `backend/record/cli/capture-entry-notes.mjs` (one-off capture) | each agent run (04:25, 12:25, 20:25 UTC), append-only, model text, deduped by `noteId` | view rebuilds (next) |
| `record/readings/YYYY-Www.jsonl` | `newsRecordReview` | weekly, Monday 01:00 UTC, append-only, model | view rebuilds |
| `record/runs/review-YYYY-Www.json` | `newsRecordReview` | weekly, the review Run | operator |
| `record/views/…` (stories, index/active, index/all, links, counts, countries, manifest) | `newsStoryRecord` only | full rebuild after each daily append, manifest last | `newsBoard`, the Worker (`/data/record/views/`) |
| `record/shadow/…` | `newsStoryRecord`, the selector, the resolver and the review on a manual `shadow:true` invoke; also the retired old dry-run output | manual only | humans, tuning |
| `weekly/YYYY-MM-DD.json`, `weekly/latest.json` | the weekly run (planned; no objects yet) | weekly | email, weekly page |

The record's design, kinds and views: `ARCHITECTURE_TIMELINE.md`. Daily model notes move into the record as `record/notes/<subtype>/YYYY-MM-DD.jsonl`, one writer per subtype, schema `backend/record/schema/note.schema.json`, built and written only through shared `notes.js` (decision 0042). Entry notes are written; story analysis, drift, country, link and brief notes follow.

IAM: one inline policy set per Lambda, `s3:PutObject` scoped to its own prefix(es); readers get `s3:GetObject` on what they read, plus a `ListBucket` so a missing object returns 404, not 403. The Worker's credentials (user `gp-worker-s3-reader`) are read-only on `world/*`, `situations/state/*`, `stories/state/*` and `record/views/*`, never facts, runs, inboxes or readings. Record roles: `newsStoryRecord-role` reads `web/*` and `record/*` and writes `record/shadow/*`, `facts/*`, `runs/*`, `views/*`; the selector's role writes `record/inbox/articles/*`; `newsPredictionResolver-role` reads `record/facts/*` and `record/runs/*` and reads and writes `record/inbox/verdicts/*` (and its shadow); `newsRecordReview-role` reads `record/*` and writes `record/readings/*`, `record/runs/review-*`, `record/inbox/merges/*` (and their shadow copies); `newsBoard-role` reads `record/views/index/active.json`, `index/all.json` and `links/*`; `newsFreshnessMonitor-role` reads and writes the one key `monitoring/freshness/state.json`.

Lifecycle (read `aws s3api get-bucket-lifecycle-configuration`): `corpus/` and `world/` expire at 400 days; `stories/` at 45 days; `signals/snapshots/` goes to Glacier IR at 30 days and expires at 365; `audit/impact/` expires at 400 days; `situations/inbox/processed/` at 30 days; `situations/history/` and `situations/archive/` move to Infrequent Access; incomplete multipart uploads abort. `record/` has no expiry. Never apply a rule to `record/`, and fetch and merge the configuration rather than appending blindly.

## 5. The frontend contract: `world/latest.json`

```json
{
  "schema": 1,
  "generated_at": "2026-09-08T14:20:00Z",
  "next_expected_at": "2026-09-08T14:30:00Z",
  "sources": { "gdacs": "…", "news": "…" },
  "stale": false,
  "situations": [
    { "id": "gdacs#FL#1104081", "verb_label": "China — flood", "axis": "humanitarian",
      "tier": "elevated", "state": "emerging", "escalating": false,
      "centroid": { "lat": 28, "lon": 116 }, "iso3_affected": ["CHN"], "spread_arcs": [],
      "affected_names": ["China"], "source": "gdacs", "tier_changed_at": "…",
      "opened_at": "…", "last_change_at": "…", "what_changed": "…", "threadId": null }
  ],
  "lede": "…",
  "systemic": [],
  "ranked": [ { "id": "…", "title": "…", "tier": "…", "axis": "…", "escalating": false, "href": "…" } ],
  "_counts": { "open": 44, "total": 56 }
}
```

- The page shows the oldest `sources.*` stamp as its freshness line. `stale:true` greys the whole map and shows a banner.
- Tiers are `low | moderate | elevated | high` (`src/shared/lib/riskTiers.js`). There is no `critical`; the map renders "critical" as `tier:high && escalating:true`.
- Per-situation detail is in `situations/state/<key>.json`, fetched on click, where `<key>` is the situation id made URL- and S3-safe (`gdacs#FL#1104081` becomes `gdacs_FL_1104081`). The tracker (writer) and `worldData.js` (reader) apply the same sanitization.
- The Worker returns `Access-Control-Allow-Origin` on every `/data/*` response including 404 and 401, so a missing object reads as a clean 404 client-side, not a CORS failure.
- The scrubber fetches `world/YYYY/MM/DD/HHMM.json`. `state` is one of `emerging | escalating | peak | cooling | closed`. `systemic` is empty while the economy is parked (decision 0009).
- `signals/` is excluded from the Worker allow-list (`DATA_ALLOWED`): it is the key-gated Signals product and stays behind the `newsSignals` Function URL.

## 6. Migration of existing tables (incremental, never big-bang)

Flipping a proxy (`newsSensitiveData`) action from DynamoDB to S3 is backend-only, but the proxy is the live site's spine, so each edit needs an explicit operator OK. The foundation plan (decision 0035) now moves world data to the record first: pages other than the board read DynamoDB through the proxy until their reading exists as a view (`ARCHITECTURE_TIMELINE.md` §7).

| Table | Status |
|---|---|
| `UserTable`, `SavedItems`, `UserPrefs`, `ApiKeys`, `Shares` | stay DynamoDB |
| `GlobalPerspectiveSituations`, `Signals`, `GdacsEvents`, `GdeltConflict`, `ImpactAudit`, `IngestCapture` | done: moved to S3 (§4), tables dropped |
| `GlobalPerspectivePredictionLog` | stays DynamoDB as the per-record store (the resolver appends write-once `Q#` rows; a correction appends `VERDICT#<n>`); `/track-record` reads the `predictions/track_record.json` aggregate |
| `GlobalPerspectiveMarkets` | not started (target `markets/YYYY/MM/DD/HH.json`); economy parked, `newsMarketsData` still writes hourly |
| `GlobalPerspectiveClientErrors` | not started (target append-only `logs/errors/YYYY/MM/DD.jsonl`) |
| `GlobalPerspectiveBreakingAlerts` | not started; `review.js` mutates rows, so it waits for an inbox-event review flow |
| `NewsCache`, `SummarizeAndPredict` | last: their world data moves into the record (facts and notes), then readers flip one action at a time, then the rows retire |
| `NewsProject-linkedin-posts` | not planned (posting log for `newsPostLinkedIn`) |

Rule for every drop: nothing reads the table (grep and CloudWatch) before `delete-table`, and deletion needs an operator yes.

## 7. Consequences to remember

- `newsSensitiveData` (the read proxy) still serves most content reads; it shrinks to user actions as §6 completes.
- The client concurrency limiter (`shared/api/restProxy.js`, cap 4) stays while content goes through the proxy.
- The tracker computes the map's `lede` and `ranked` once per sweep; `/today` composes its own lede in the browser (`features/home/lib/composeTopicsLede.js`).
- The bucket, prefixes and per-role IAM are read from AWS; this file records the intent.

## 8. Not chosen (and why)

- **S3 for everything, including users and billing:** possible with `If-Match`, but it reimplements what DynamoDB gives natively for a ledger that must never race. Rejected.
- **CloudFront with OAC in front of the bucket:** cleaner AWS-natively, but the site already sits behind Cloudflare; two CDNs is two cache layers to reason about. The Worker as origin is one hop. Revisit only if the Worker becomes a bottleneck.
- **Cloudflare R2 instead of S3:** zero egress and edge-native, but the producers are AWS Lambdas, so writes would cross clouds. Not now.
- **A public-read `public/` prefix:** simplest, but leaks the bucket name and forgoes gating at the edge. The Worker proxy was chosen instead.
