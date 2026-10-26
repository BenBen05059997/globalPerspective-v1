# Data Strategy — S3 for the world, DynamoDB for the user

**Status:** binding rule (decisions/0003, adopted 2026-09-08); applies to every new subsystem, to existing tables incrementally (§6).
Last verified: 2026-10-19 (tables, prefixes, lifecycle rules and schedules read from live AWS; writers from the repo source); the `record/` rows, the PredictionLog row in §6 and the IAM paragraph re-checked 2026-10-23.
Live inventories come from AWS (`aws s3 ls`, `aws events list-rules`, `aws lambda list-functions`) and `scripts/functions.json`.

## 1. The principle

> **S3 for the world. DynamoDB for the user.**
> Anything the pipeline computes *about the world* is a versioned JSON object in S3. Anything a *person* owns, pays for, or configures is a DynamoDB row.

The sorting test for any datum: **"If this user deleted their account, would the data disappear?"** No → S3. Yes → DynamoDB.

Why: ~39 Lambdas batch-produce **immutable snapshots** (hourly / 8h / daily) that the frontend **reads and never edits**. That is an object-store workload. Forcing it into DynamoDB gave us 16+ tables, hand-built GSIs to answer "give me recent," TTLs that delete history we want, 400KB item caps (the `captureIngestion` truncation), and a proxy Lambda in the read path whose cold-start bursts needed a client concurrency limiter. S3 makes the read path a CDN fetch and makes history, replay, diffing and analytics properties of the store rather than features to build.

## 2. What lives where

| Store | Holds | Examples |
|---|---|---|
| **S3** (`globalperspective-world-<account>`, private) | everything computed about the world; append-only corpora; versioned snapshots; audit/event logs | corpus, stories, situations, `world/latest.json`, the track-record snapshot, markets snapshots, GDACS/GDELT mirrors, impact audit, client-error logs, signals |
| **DynamoDB** — target: the 5 user tables | per-user, mutable, concurrent, transactional | `GlobalPerspectiveUserTable` (tier, credits, Polar ids), `GlobalPerspectiveSavedItems`, `GlobalPerspectiveUserPrefs`, `GlobalPerspectiveApiKeys`, `GlobalPerspectiveShares` |

**Board data (2026-10-20, no new table):** the member's boards live in `GlobalPerspectiveSavedItems` as items with
`savedKey` `board#<boardId>` (shape: `backend/board/schema/board.schema.json`), and the follows of stories and actors in
`GlobalPerspectiveUserPrefs` (`followedThreads`, `followedActors`). Sole writer of both: `newsBoard`. Both pass the sorting
test (deleted with the account). `newsSavedItems` hides `board#` items from the saved list.

Nothing else new goes in DynamoDB; a new table needs an explicit exception recorded here. Live today there are **12**
Global Perspective tables: the 5 above plus 7 world tables not yet migrated (§6) — `NewsCache` (topics),
`SummarizeAndPredict`, `GlobalPerspectivePredictionLog`, `GlobalPerspectiveBreakingAlerts`,
`GlobalPerspectiveMarkets`, `GlobalPerspectiveClientErrors`, `NewsProject-linkedin-posts`.

**Exception (2026-09-30, operator-approved, Batch 4 Y1): `GlobalPerspectiveShares`.**
- User-owned Studio share links: PK `id` (a 22-character public id), KEYS_ONLY GSI `uid-createdAt-index` for the owner's list and account deletion.
- It passes the sorting test: it is deleted with the account (`scripts/share-admin.mjs`).
- A new table because no existing table can be read by a public id while still being found by owner.
- On-demand, deletion protection on, no TTL (a share lives until its owner deletes it).
- Sole writer: `newsSharedAnalysis`.

## 3. Rules that keep S3-as-truth safe

1. **One writer per prefix.** Every prefix has exactly one Lambda that writes it. Others only read. Contention is a design bug, not an operational one. (Ownership table: §4.)
2. **Openers append events; folders own state.** Sources of facts write to an `inbox/`; a single *folder* Lambda reads the inbox and is the only writer of `state/`. Live, the only opener is GDACS (one overwritten `situations/inbox/gdacs-latest.json`); news situations come from `stories/index.json`. The per-event append inbox (`<ts>-<source>-<id>.json` from breaking-alert/GDELT) was never built.
3. **Never `ListObjects` on a hot path.** Every collection maintains an `index.json` written by its owner. Listing is for ops/replay only.
4. **Snapshots are immutable; `latest` is a pointer.** Writers put `…/YYYY/MM/DD/HHMM.json` then overwrite `…/latest.json`. History is never rewritten.
5. **Freshness is data, not inference.** Bundles carry `generated_at`, `next_expected_at`, per-source stamps and a `stale` flag computed by the writer. The frontend *displays* staleness; it does not compute it.
6. **Bucket stays private.** The browser reads through the Cloudflare Worker (SigV4 to S3, edge cache). No public-read ACLs. Member-gated depth = a second bundle the Worker serves only with a valid Firebase JWT.
7. **Lifecycle replaces TTL.** Rules by prefix: corpus/history → Infrequent Access at 30d, expire ~1y (corpus) / never (prediction log); `latest` objects never expire.
8. **Conditional writes where a read-modify-write is unavoidable.** Use `If-Match` (ETag) on PUT; retry once; log the conflict. Prefer redesigning to one-writer instead.
9. **Small objects, many keys is fine; big objects are not.** Cap a bundle at ~300KB gzipped; move detail to per-item objects fetched on demand.
10. **Local dev runs on fixtures.** Because the contract is JSON, `npm run dev` points at `fixtures/world.json` — no AWS needed for frontend work.

## 4. Prefix ownership (v1 — the map-as-home subsystem)

| Prefix | Sole writer | Cadence | Readers |
|---|---|---|---|
| `corpus/YYYY/MM/DD/HH.jsonl` | `newsSituationIngest` | hourly | audit, replay, reclassify |
| `stories/state/<storyId>.json`, `stories/index.json` | `newsSituationIngest` | hourly | tracker, map detail |
| `stories/classify-cache.json` (classification memory, url+title → result incl. optional `snippet` since 10-17, 48h; 2026-10-05) | `newsSituationIngest` | hourly (overwrite) | `newsSituationIngest` only |
| `situations/inbox/gdacs-latest.json` (stable pointer, overwritten) | `newsGdacsIngest` — full-snapshot source | 20 min | tracker (read every sweep) |
| `situations/state/<id>.json`, `situations/index.json` | `newsSituationTracker` | 30-min sweep | map, thread/country pages |
| `situations/archive/<id>.json` | `newsSituationTracker` | on close+age-out | audit / life-story record (IA 30d) |
| `situations/history/YYYY/MM/DD/HH/HHMM.json` | `newsSituationTracker` | each sweep | scrubber, `scripts/situations-log.mjs` |
| `world/latest.json`, `world/YYYY/MM/DD/HHMM.json` | `newsSituationTracker` (assembles at end of sweep) | each sweep | **frontend** (via Worker) |
| `world/latest.member.json` | `newsSituationTracker` | each sweep | frontend, JWT-gated at the Worker |
| `web/latest.json`, `web/YYYY/MM/DD.json` (story web snapshot: index + per-story records + per-country webs; history starts 2026-10-20) | `newsSystemsAnalysis` | daily 05:00Z | none yet (Studio country sheet, planned) |
| `world/shadow/…`, `shadow/situations/…` | tracker in `DRY_RUN` (live `DRY_RUN=false`, so not written today) | each sweep | humans, tuning, `scripts/situations-log.mjs --shadow` |
| `threads/story-map.json` (storyId ↔ threadId) | `NewsProjectInvokeAgentLambda` (matcher) | each story run (8h) | `newsSituationTracker` (stamps `threadId`) |
| `tags/backfill/2026-09-11.json` | one-off matcher backfill; writer not in the repo | — | none |
| `fixtures/` | humans | — | local dev, Worker smoke |
| `signals/latest.json`, `signals/snapshots/YYYY-MM-DD.json` | `newsSignals` | daily build (cron-only; parked, decisions/0032) | `newsSignals` SERVE only — **never** the Worker (paid, key-gated product) |
| `corpus/gdacs/latest.json` | `newsGdacsIngest` | each 20-min run | `newsImpactAudit` |
| `corpus/gdelt/<day>.json` | `newsGdeltConflict` | each run (overwrite per day) | `newsImpactAudit` |
| `audit/impact/<date>.json`, `audit/impact/latest.json` | `newsImpactAudit` | daily — parked (schedule DISABLED, decisions/0015) | audit trail / operator |
| `audit/ingest-capture/latest.json` | `newsInvokeGemini` | each generation (3×/day) | `newsImpactAudit` (parked), `newsSelectionShadow` |
| `audit/selection-shadow/YYYY-MM-DD/HHMM.json` + `latest.json` (P7c shadow week; live 2026-10-18) | `newsSelectionShadow` | 3×/day, 5 min after selection | operator review only |
| `predictions/track_record.json` (`questions` block added 2026-09-30) | `newsPredictionsSnapshot` | `rate(30 min)` | `newsSensitiveData` proxy (`prediction_track_record`) — precomputed aggregate; PredictionLog DDB stays as the mutable store |
| `record/facts/YYYY-MM-DD.jsonl`, `record/facts/manifest.json` | `newsStoryRecord` | daily (rule `TriggerStoryRecord` cron(45 23 * * ? *), payload `{"shadow":false}`), append-only, no model | `newsRecordReview`, view rebuilds, `newsPredictionResolver` (watch and evidence) |
| `record/runs/YYYY-MM-DD.json` | `newsStoryRecord` (the daily Run) | daily, the one mutable object | `newsPredictionResolver` (coverage guard, role grant pending), monitoring (no alarm built), operator |
| `record/inbox/articles/YYYY-MM-DD.jsonl` (decision 0040) | selector `newsInvokeGemini` (raw capture before the model call) and the recovery script | each generation, append-only | `newsStoryRecord` (converts to `article` facts) |
| `record/inbox/verdicts/YYYY-MM-DD.jsonl` (shadow `record/shadow/inbox/verdicts/`; 0038 amendment) | `newsPredictionResolver` | on each decision, append-only, kept (replay input) | `newsStoryRecord` (run day + 6 days before; `{inboxFrom}` backfills) |
| `record/inbox/merges/YYYY-MM-DD.jsonl` | `newsRecordReview`; operator lines on demand | weekly | `newsStoryRecord` (turns lines into `story_merged` facts) |
| `record/inbox/splits/YYYY-MM-DD.jsonl` | operator only | on demand | `newsStoryRecord` (turns lines into `story_split` facts) |
| `record/inbox/assignments/YYYY-MM-DD.jsonl` (decision 0040) | operator, applying approved review proposals or benchmark placements (`entryId` may be an `article` fact id) | on demand | `newsStoryRecord` (converts to `assignment` facts; ingest assignments are derived from entries, not inboxed) |
| `record/operator/aliases.json` (the who's who file) | operator only | on demand | `newsStoryRecord` view builds, `newsRecordReview` |
| `record/readings/YYYY-Www.jsonl` | `newsRecordReview` | weekly Monday 01:00 UTC, append-only, model | view rebuilds, weekly report |
| `record/runs/review-YYYY-Www.json` | `newsRecordReview` | weekly, the review Run | monitoring (alarm signal), operator |
| `record/views/…` (stories, index/active, index/all, links, counts, manifest) | `newsStoryRecord` only | after each daily append, full rebuild, manifest last | `newsBoard`, the Worker (`/data/record/views/`), pages, weekly |
| `record/fixtures/golden-week/` | written by hand, frozen (in the repo under `backend/record/newsRecordReview/fixtures/`) | n/a | `newsRecordReview` re-runs and diffs |
| `record/shadow/…` | `newsStoryRecord`, the selector and the resolver on a manual `shadow:true` invoke; also holds the retired old dry-run output (`index.json`, `stories/`, `timeline/`, `corrections/`) | manual only, no schedule | humans, tuning |

IAM: one inline policy per Lambda, `s3:PutObject` scoped to its own prefix(es) only; readers get `s3:GetObject` on what they read (+ a `ListBucket` scoped to their read prefixes so a missing object returns 404, not 403). The Worker's credentials (user `gp-worker-s3-reader`) are read-only on `world/*`, `situations/state/*`, `stories/state/*` and `record/views/*`, never facts, runs, inboxes or readings. `newsStoryRecord-role` reads `web/*` and `record/*` and writes `record/shadow/*`, `record/facts/*`, `record/runs/*` and `record/views/*`; the selector's role writes `record/inbox/articles/*` (and its shadow); `newsPredictionResolver-role` reads `record/facts/*` and writes `record/inbox/verdicts/*` (and its shadow), with the `record/runs/*` read still to be granted; `newsBoard-role` reads three `record/views/` keys (`index/active.json`, `index/all.json`, `links/*`). `newsRecordReview` has no role yet.

Lifecycle additions: `signals/snapshots/` → Glacier IR 30d, expire 365d (`signals/latest.json` never expires); `audit/impact/` → expire 400d; `corpus/*` covered by `corpus-history-IA-then-expire`. Live rules also cover `situations/history/`, `situations/archive/`, `situations/inbox/processed/`, `world/` and `stories/`.

## 5. The frontend contract — `world/latest.json`

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

- The page shows the **oldest** `sources.*` stamp as its freshness line. `stale:true` → whole-map grey-out + banner.
- Tiers are canonical `low | moderate | elevated | high` (`src/shared/lib/riskTiers.js`). There is no `critical`; the map renders "critical" as `tier:high && escalating:true`.
- Per-situation detail (history, evidence, spillover) is in `situations/state/<key>.json`, fetched on click — where `<key>` is the situationId made URL/S3-safe (`gdacs#FL#1104081` → `gdacs_FL_1104081`; `#` is unsafe in keys/paths). Both the tracker (writer) and `worldData.js` (reader) apply the same sanitization.
- The Worker returns `Access-Control-Allow-Origin` on **every** `/data/*` response including 404/401, so a missing object reads as a clean 404 client-side, not a CORS failure.
- The scrubber fetches `world/YYYY/MM/DD/HHMM.json`.
- `state` is one of `emerging | escalating | peak | cooling | closed`; `systemic` is empty while the economy is parked (decisions/0009).
- **`signals/` is excluded from the Worker whitelist (`DATA_ALLOWED`)** — it is the paid, key-gated Signal-API product and stays behind the `newsSignals` Function URL only; it is never reachable via `/data/*`.

## 6. Migration of existing tables (incremental, never big-bang)

Measured 2026-09-09 (7-day CloudWatch, reads/writes per day): `SummarizeAndPredict` 13,342 / 2,007 · `PredictionLog` 12,503 / 388 · `NewsCache` 8,543 / 2,305 · `BreakingAlerts` 6,907 / 70 · `Markets` 12 / 232 · `ClientErrors` 14 / ~. Flipping a proxy (`newsSensitiveData`) action from DynamoDB to S3 is backend-only but the proxy is the live site's spine, so each edit needs an explicit operator OK.

| Table | Status (2026-10-19) |
|---|---|
| `UserTable`, `SavedItems`, `UserPrefs`, `ApiKeys`, `Shares` | stay DynamoDB |
| `GlobalPerspectiveSituations`, `Signals`, `GdacsEvents`, `GdeltConflict`, `ImpactAudit`, `IngestCapture` | done — moved to S3 (§4), tables dropped |
| `GlobalPerspectivePredictionLog` | stays DynamoDB: the per-record store (the resolver appends write-once `Q#` rows; a correction appends `VERDICT#<n>`). Only the `/track-record` aggregate moved to `predictions/track_record.json` (`newsPredictionsSnapshot`, 30 min) |
| `GlobalPerspectiveMarkets` | not started (target `markets/YYYY/MM/DD/HH.json`); economy parked, `newsMarketsData` still writes hourly |
| `GlobalPerspectiveClientErrors` | not started (target append-only `logs/errors/YYYY/MM/DD.jsonl`) |
| `GlobalPerspectiveBreakingAlerts` | not started; `review.js` mutates rows, so it waits for an inbox-event review flow |
| `NewsCache` (topics), `SummarizeAndPredict` | not started; last (dual-write snapshots, flip readers one action at a time, retire). `WEB#INDEX` now also snapshotted daily to `web/` since 2026-10-20 |
| `NewsProject-linkedin-posts` | not planned (posting log for `newsPostLinkedIn`) |

Rule for every drop: **"nothing reads the table"** (grep + CloudWatch) before `delete-table`.

## 7. Consequences to remember

- `newsSensitiveData` (the read proxy) still serves most content reads; it shrinks to user actions only as tables in §6 move.
- The client concurrency limiter (`shared/api/restProxy.js`, cap 4) stays while content goes through the proxy.
- The tracker computes the map's `lede` and `ranked` once per sweep; `/today` still composes its own lede in the browser (`features/home/lib/composeTopicsLede.js`).
- The bucket, prefixes and per-role IAM are recorded in `ARCHITECTURE.md` and `aws s3 ls`.

## 8. Not chosen (and why)

- **S3 for everything, including users/billing** — possible with `If-Match`, but it reimplements what DynamoDB gives natively for a ledger that must never race. Rejected.
- **CloudFront + OAC** in front of the bucket — cleaner AWS-natively, but the site already sits behind Cloudflare; two CDNs is two cache layers to reason about. The Worker-as-origin is one hop. Revisit only if the Worker becomes a bottleneck.
- **Cloudflare R2 instead of S3** — zero egress, edge-native; but the producers are AWS Lambdas, so writes would cross clouds. Not now.
- **Public-read `public/` prefix** — simplest, but leaks the bucket name and forgoes gating at the edge. Worker proxy chosen instead.
