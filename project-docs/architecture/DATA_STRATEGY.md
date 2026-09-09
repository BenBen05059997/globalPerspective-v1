# Data Strategy — S3 for the world, DynamoDB for the user

**Status:** ADOPTED 2026-09-08 (decided during the map-as-home programme; applies to all new subsystems immediately, to existing tables incrementally — see §6).
**Authority:** this doc + `ARCHITECTURE.md`. Where an older doc assumes "everything is a DynamoDB table," this supersedes it.

## 1. The principle

> **S3 for the world. DynamoDB for the user.**
> Anything the pipeline computes *about the world* is a versioned JSON object in S3. Anything a *person* owns, pays for, or configures is a DynamoDB row.

The sorting test for any datum: **"If this user deleted their account, would the data disappear?"** No → S3. Yes → DynamoDB.

Why: ~33 Lambdas batch-produce **immutable snapshots** (hourly / 4h / daily) that the frontend **reads and never edits**. That is an object-store workload. Forcing it into DynamoDB gave us 16+ tables, hand-built GSIs to answer "give me recent," TTLs that delete history we want, 400KB item caps (the `captureIngestion` truncation), and a proxy Lambda in the read path whose cold-start bursts needed a client concurrency limiter. S3 makes the read path a CDN fetch and makes history, replay, diffing and analytics properties of the store rather than features to build.

## 2. What lives where

| Store | Holds | Examples |
|---|---|---|
| **S3** (`globalperspective-world-<account>`, private) | everything computed about the world; append-only corpora; versioned snapshots; audit/event logs | corpus, stories, situations, `world/latest.json`, prediction log, markets snapshots, GDACS/GDELT mirrors, impact audit, client-error logs, signals |
| **DynamoDB** (4 tables) | per-user, mutable, concurrent, transactional | `Users` (tier, credits, Polar ids), `SavedItems`, `UserPrefs`, `ApiKeys` |

Nothing else goes in DynamoDB. A new table needs an explicit exception recorded here.

## 3. Rules that keep S3-as-truth safe

1. **One writer per prefix.** Every prefix has exactly one Lambda that writes it. Others only read. Contention is a design bug, not an operational one. (Ownership table: §4.)
2. **Openers append events; folders own state.** Sources of facts (GDACS, breaking-alert, GDELT) write to an `inbox/`; a single *folder* Lambda reads the inbox and is the only writer of `state/`. This is event sourcing: every state change has a cause on disk and can be replayed.
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
| `situations/inbox/gdacs-latest.json` (stable pointer, overwritten) | `newsGdacsIngest` — full-snapshot source | 20 min | tracker (read every sweep) |
| `situations/inbox/<ts>-<source>-<id>.json` (append) | per-event openers (`newsBreakingAlert`, later GDELT) | 4h | tracker (read + move to `processed/`) |
| `situations/state/<id>.json`, `situations/index.json` | `newsSituationTracker` | 10-min sweep | map, thread/country pages |
| `situations/archive/<id>.json` | `newsSituationTracker` | on close+age-out | audit / life-story record (IA 30d) |
| `situations/history/YYYY/MM/DD/HH/HHMM.json` | `newsSituationTracker` | each sweep | scrubber, `scripts/situations-log.mjs` |
| `world/latest.json`, `world/YYYY/MM/DD/HHMM.json` | `newsSituationTracker` (assembles at end of sweep) | each sweep | **frontend** (via Worker) |
| `world/latest.member.json` | `newsSituationTracker` | each sweep | frontend, JWT-gated at the Worker |
| `world/shadow/…` | tracker in `DRY_RUN` | each sweep | humans, tuning |
| `fixtures/` | humans | — | local dev, Worker smoke |
| `signals/latest.json`, `signals/snapshots/YYYY-MM-DD.json` (S8·T1, DONE 2026-09-09) | `newsSignals` | daily build (cron-only) | `newsSignals` SERVE only — **never** the Worker (paid, key-gated product) |
| `corpus/gdacs/latest.json` (S8·T2, DONE 2026-09-09) | `newsGdacsIngest` | each 20-min run | `newsImpactAudit` |
| `corpus/gdelt/<day>.json` (S8·T2, DONE 2026-09-09) | `newsGdeltConflict` | each run (overwrite per day) | `newsImpactAudit` |
| `audit/impact/<date>.json`, `audit/impact/latest.json` (S8·T2, DONE 2026-09-09) | `newsImpactAudit` | daily | audit trail / operator |

IAM: one inline policy per Lambda, `s3:PutObject` scoped to its own prefix(es) only; readers get `s3:GetObject` on what they read (+ a `ListBucket` scoped to their read prefixes so a missing object returns 404, not 403). The Worker's credentials are read-only on `world/*`, `situations/state/*`, `stories/state/*`.

Lifecycle additions: `signals/snapshots/` → Glacier IR 30d, expire 365d (S8·T1; `signals/latest.json` never expires); `audit/impact/` → expire 400d (S8·T2); `corpus/*` covered by the existing `corpus-history-IA-then-expire` rule.

## 5. The frontend contract — `world/latest.json`

```json
{
  "schema": 1,
  "generated_at": "2026-09-08T14:20:00Z",
  "next_expected_at": "2026-09-08T14:30:00Z",
  "sources": { "gdacs": "…", "ingest": "…", "topics": "…", "markets": "…" },
  "stale": false,
  "situations": [
    { "id": "gdacs#FL#1104081", "verb_label": "China — flood", "axis": "humanitarian",
      "tier": "elevated", "state": "emerging", "escalating": false,
      "centroid": { "lat": 28, "lon": 116 }, "iso3_affected": ["CHN"], "spread_arcs": [],
      "opened_at": "…", "last_change_at": "…", "what_changed": "…", "threadId": null }
  ],
  "lede": "…",
  "systemic": [ { "label": "Brent $91 ▲4%", "href": "/economy" } ],
  "ranked": [ { "id": "…", "title": "…", "tier": "…", "href": "…" } ]
}
```

- The page shows the **oldest** `sources.*` stamp as its freshness line. `stale:true` → whole-map grey-out + banner.
- Tiers are canonical `low | moderate | elevated | high` (`utils/riskTiers.js`). There is no `critical`; the map renders "critical" as `tier:high && escalating:true`.
- Per-situation detail (history, evidence, spillover) is in `situations/state/<key>.json`, fetched on click — where `<key>` is the situationId made URL/S3-safe (`gdacs#FL#1104081` → `gdacs_FL_1104081`; `#` is unsafe in keys/paths). Both the tracker (writer) and `worldData.js` (reader) apply the same sanitization.
- The Worker returns `Access-Control-Allow-Origin` on **every** `/data/*` response including 404/401, so a missing object reads as a clean 404 client-side, not a CORS failure.
- The scrubber fetches `world/YYYY/MM/DD/HHMM.json`.
- **`signals/` is excluded from the Worker whitelist (`DATA_ALLOWED`)** — it is the paid, key-gated Signal-API product and stays behind the `newsSignals` Function URL only; it is never reachable via `/data/*`.

## 6. Migration of existing tables (incremental, never big-bang)

**Order revised 2026-09-09** after two independent verifications (code-reader grep/audit + a 7-day CloudWatch metrics pull, GlobalPerspective tables only) re-ordered S8. Full evidence table, the corrections it forced, and the T1 design are in `MAP_HOME_SITUATION_PLAN.md` §11.1 (S8 sub-plan) and the ledger. Headline numbers (reads/day, writes/day): `SummarizeAndPredict` 13,342 / 2,007 · `PredictionLog` 12,503 / 388 (**2nd-hottest**, driven almost entirely by `/track-record`'s full 5,478-item Scan per page load via the proxy — this table was previously assumed lightest-touch, which was wrong) · `NewsCache` 8,543 / 2,305 · `BreakingAlerts` 6,907 / 70 (user-facing via `newsRecommend` `list_alerts`/`get_alert`, a direct-call Lambda, **not** the proxy) · `IngestCapture` 388 / 344 · `GdacsEvents` 92 / 1,100 · `GdeltConflict` 10 / 39 · `Markets` 12 / 232 · `ClientErrors` 14 / ~ · `Signals` 0 / 23,390 (**write-only** — 0 reads/day over a 14-day check; `newsSignals` is invoked 1/day, cron only, zero HTTP) · `ImpactAudit` 0 / 3 · `ApiKeys` 0 / 0 (0 items, 0 keys ever minted). Cost honesty: Signals' ~23K/day on-demand writes cost **≈$1/month** — migrating it first wins consistency (one fewer world table, strategy conformance), not cost. Flipping a proxy action (`newsSensitiveData`) from DDB→S3 is backend-only and needs no frontend deploy — the real gate on S8·T3–T6 is **risk** (the proxy is the live site's spine), needing explicit operator OK per edit, not a blanket approval.

| Table | Verdict | When |
|---|---|---|
| `Users`, `SavedItems`, `UserPrefs`, `ApiKeys` | **stay DynamoDB** (`ApiKeys`: 0 items, 0 keys ever minted) | — |
| `GlobalPerspectiveSituations` (created 2026-09-08, P1·T1) | **drop** before anything reads it; replaced by `situations/` prefix | Stage S1 |
| `Signals` | → `signals/latest.json` + `signals/snapshots/`; Function URL serves from S3; **NEVER exposed via Worker `/data/*`** | **S8·T1 — approved 2026-09-09, not started** (gate: none, 0 consumers) |
| ~~`GdacsEvents`, `GdeltConflict`, `ImpactAudit`~~ | **DONE 2026-09-09** → `corpus/gdacs/latest.json`, `corpus/gdelt/<day>.json`, `audit/impact/`; `newsImpactAudit` reads corpus + writes verdict to S3; all three tables dropped | S8·T2a ✅ |
| `IngestCapture` | → `audit/ingest-capture/`; **deferred** (writer is `newsInvokeGemini`, the live content pipeline — held out of T2a) | S8·T2b |
| `GlobalPerspectivePredictionLog` ("immutable forecast record") | → `predictions/` in S3; calibration via Athena; flips proxy `prediction_track_record`/`prediction_snapshot` + `newsSignals` `/v1/track-record` | S8·T3 (gate: operator OK to edit `newsSensitiveData`) |
| `Markets` | → `markets/YYYY/MM/DD/HH.json` snapshots | S8·T4 (same proxy gate) |
| `ClientErrors` | → append-only `logs/errors/YYYY/MM/DD.jsonl`; digest reads files | S8·T4 |
| `BreakingAlerts` | content, but `review.js` mutates → move after review flow becomes inbox events; folds into stage S3·T2 | S8·T5, later |
| `NewsCache` (topics), `SummarizeAndPredict` | dual-write snapshots → flip readers one action at a time → retire | S8·T6, last (after S6) |

Rule for every drop: **"nothing reads the table"** (grep + CloudWatch) before `delete-table`.

## 7. Consequences to remember

- `newsSensitiveData` (the read proxy) shrinks over time to **user actions only** (saved items, prefs, billing, analyze). Content reads become CDN fetches.
- The client concurrency limiter (`restProxy.js`, cap 4) becomes unnecessary for content — keep it for user actions.
- `composeTopicsLede` and the ranked list move from browser to the tracker (computed once per sweep, not per visitor).
- Bot pre-render (Cloudflare Worker) for `/` reads `world/latest.json` — no Lambda in the crawler path.
- First S3 in the stack: record bucket, prefixes, and per-role IAM in `ARCHITECTURE.md` when built.

## 8. Not chosen (and why)

- **S3 for everything, including users/billing** — possible with `If-Match`, but it reimplements what DynamoDB gives natively for a ledger that must never race. Rejected.
- **CloudFront + OAC** in front of the bucket — cleaner AWS-natively, but the site already sits behind Cloudflare; two CDNs is two cache layers to reason about. The Worker-as-origin is one hop. Revisit only if the Worker becomes a bottleneck.
- **Cloudflare R2 instead of S3** — zero egress, edge-native; but the producers are AWS Lambdas, so writes would cross clouds. Not now.
- **Public-read `public/` prefix** — simplest, but leaks the bucket name and forgoes gating at the edge. Worker proxy chosen instead.
