# newsStoryRecord

Appends the daily facts (no model) to `record/facts/YYYY-MM-DD.jsonl`, then rebuilds the facts-only views (active index, links, daily counts) from them. Inputs come only through shared `world/`. Duplicate candidates are reported with evidence; no merge or split is performed. Chapters, branch status and lines are readings written weekly by the planned `newsRecordReview`, not here. Design: [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md) (§1c two clocks, §6 writers).

2026-10-21: Code still carries the per-day model steps (chapter, trigger and line calls, `llmCalls`, `RECORD_LLM_MODEL`); they are superseded and their removal is step 1 of §8 in ARCHITECTURE_TIMELINE.md. Text below describes the target, facts only.

## Deployment

- Deployed in shadow only, no schedule yet. Planned group `record`, entry point `runtime.handler`, Node.js 22. The coordinator registers, provisions and deploys it.
- Planned schedule **05:45Z**, `cron(45 5 * * ? *)`, after drift notes. The daily run uses no model. Configure a single writer with no overlapping executions.
- Runtime defaults to shadow output: `{"date":"2026-10-20","shadow":true,"noLlm":true}`. Local runs never invoke this AWS writer.
- Environment: `AWS_REGION`, `WORLD_BUCKET`, `TOPICS_DDB_TABLE` (NewsCache), `SUMMARIZE_PREDICT_TABLE` (SummarizeAndPredict), `PREDICTION_LOG_TABLE` (GlobalPerspectivePredictionLog). No local model credentials or calls.
- The runtime supplies AWS SDK v3. The committed `src/_shared` symlink supplies shared code.

## Reads and facts

`src/store.js` is a facade over `world/`: a 30-day archive range; thread analyses and histories as of the run date; drift notes since the preceding run (inclusive for retries); PRED scenarios for archive topic ids and the thread pointer; Q verdict revisions; dated web with an as-of latest fallback. Independent thread reads run four at a time. There are no table scans. `world/` owns raw parsing, birth, forks, countries, outlet domains, coverage and numeric verdict revision order. Object-valued analysis actors contribute only their names.

Bootstrap birth is the canonical reader's earliest entry inside the bounded window, with `birthEvidence.windowLimited` and `missingBefore` exposed. Once the `story_born` fact exists, its birth is retained even if earlier entries arrive later. History outside retained inputs cannot be recovered. One fork per PRED snapshot and positional scenario/trigger identities follow `world/`; probabilities are **percent**, with missing trigger probability left null.

Fact objects live at `record/facts/YYYY-MM-DD.jsonl`, partitioned by the UTC day of `at`; the day manifest registers days before appending, so a crash cannot orphan a durable fact. Shared `s3json.getLines/appendLines` owns JSONL encoding, eventId deduplication, ETag/If-Match retries and preservation of an existing fact's payload. No S3 listing is performed.

Fact kinds: `entry`, `story_born`, `read_changed`, `forecast_drawn`, `verdict`, `link_confirmed`, `correction`, `coverage` (current code also writes `chapter`, `branch_status`, `line`; these move to readings). Country and situation facts are outside this step. `eventId = sha1(kind + sourceKey)`. Raw sourceKey/sourceRow come from `world/`; entry identity includes archive/generation/topic, not topicId alone. Mutable THREAD_ANALYSIS and web rows add their generated timestamp to the identity. Outlet source names remain the canonical domain; no publisher names are invented.

`entry.at` is `archivedAt` (collection time, **not publication time**). An absent timestamp uses its archive day at midnight and the original null remains in the payload. Forecast/history timestamps use their generated date where available, otherwise the source-key day.

Capture before expiry: `entry`/`story_born` inputs expire after archive TTL (90 days; today-archive 24 hours); `read_changed` history/DRIFT inputs after 60 days and analysis after 90 days. DRIFTLOG is permanent. A missed retained window is a coverage gap, not evidence that nothing happened. Forecast and verdict facts keep the complete normalized payload, even if upstream rows later disappear.

Rule carried into the review: "fired" needs a cited entry from the resolution source or two distinct outlets.

## Views and failure behavior

Facts-only views are rebuilt from the facts: `record/views/index/active.json`, `index/all.json`, `links/{threadId}.json` and daily counts. Every path moves under `record/shadow/` with the shadow option. The story views (chapters, lines) are rebuilt by `newsRecordReview` after each weekly run.

Raw facts are durable before any view work. Storage, cursor or view errors abort before latest pointers move; publication is not an atomic multi-object transaction and a failed pointer write is repaired on retry. Backdated runs refuse to rewind an existing newer index. Deleting all views and rerunning reconstructs them from the facts without model calls. The append-only facts are authoritative throughout.

## Least-privilege IAM requested

- DynamoDB `GetItem`, `BatchGetItem`, `Query` on NewsCache, SummarizeAndPredict and GlobalPerspectivePredictionLog. No table writes or scans.
- S3 `GetObject` on `web/*` and own `record/*` state; `PutObject` only on `record/facts/*`, `record/views/*`, `record/runs/*` (including shadow equivalents), never any other world prefix. `record/readings/*` and `record/fixtures/*` belong to the review. For the shadow week, scope puts to `record/shadow/*`.
- Narrow `ListBucket` conditions on read prefixes allow missing objects to return 404 instead of 403; code does not list.
- Standard Lambda logs. Coordinator owns registration, IAM, schedule and deployment.

## Local dry run

```sh
node backend/record/newsStoryRecord/dryrun.mjs --date 2026-10-19 --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/ --no-llm
node backend/record/newsStoryRecord/dryrun.mjs --date 2026-10-20 --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/ --no-llm
```

Use ascending dates and a clean local state directory. The adapter permits only read-only DynamoDB get/query and S3 get-object calls; would-be S3 writes go to local files through the real shared helper with local ETags. Set `RECORD_AWS_MODULES` to reuse pooled SDK reads. No dependency installation, LLM call or AWS mutation is performed. See [DRYRUN.md](DRYRUN.md) for measured counts and coverage.

## Tests

```sh
node --test backend/record/newsStoryRecord/test/*.test.js
node scripts/check-shared-sync.mjs
node quality/check_docs.mjs
```

Tests use fake stores, real canonical readers and fake ETag-aware S3. Set `FRONTEND_NODE_MODULES` to the main checkout's installed frontend/node_modules in an isolated worktree for schema validation.

Last verified: 2026-10-21 (offline tests and local read-only artifacts; deployed shadow-only)
