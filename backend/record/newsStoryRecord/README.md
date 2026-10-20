# newsStoryRecord

Writes the append-only event timeline first, then rebuilds dated story views, the index and corrections from it. Inputs come only through shared `world/`. Duplicate candidates are reported with evidence; no merge or split is performed.

## Deployment

- **Not created.** Planned group `record`, entry point `runtime.handler`, Node.js 22. The coordinator registers, provisions and deploys it.
- Schedule **05:45Z**, `cron(45 5 * * ? *)`, after drift notes. Configure a single writer with no overlapping executions.
- Runtime defaults to shadow output: `{"date":"2026-10-20","shadow":true,"noLlm":true}`. Local runs never invoke this AWS writer.
- Environment: `AWS_REGION`, `WORLD_BUCKET`, `TOPICS_DDB_TABLE` (NewsCache), `SUMMARIZE_PREDICT_TABLE` (SummarizeAndPredict), `PREDICTION_LOG_TABLE` (GlobalPerspectivePredictionLog), `RECORD_LLM_MODEL` (required for cloud LLM runs). Provider settings and credentials belong to shared `llm.js`; no local model credentials or calls.
- The runtime supplies AWS SDK v3. The committed `src/_shared` symlink supplies shared code.

## Reads and timeline

`src/store.js` is a facade over `world/`: a 30-day archive range; thread analyses and histories as of the run date; drift notes since the preceding run (inclusive for retries); PRED scenarios for archive topic ids and the thread pointer; Q verdict revisions; dated web with an as-of latest fallback. Independent thread reads run four at a time. There are no table scans. `world/` owns raw parsing, birth, forks, countries, outlet domains, coverage and numeric verdict revision order. Object-valued analysis actors contribute only their names.

Bootstrap birth is the canonical reader's earliest entry inside the bounded window, with `birthEvidence.windowLimited` and `missingBefore` exposed. Once the `story_born` event exists, its birth is retained even if earlier entries arrive later. History outside retained inputs cannot be recovered. One fork per PRED snapshot and positional scenario/trigger identities follow `world/`; probabilities are **percent**, with missing trigger probability left null.

Timeline objects live at `record/timeline/YYYY-MM-DD.jsonl`, partitioned by the UTC day of `at`; `record/timeline/index.json` is the day manifest. The writer registers days before appending, so a crash cannot orphan a durable event. Shared `s3json.getLines/appendLines` owns JSONL encoding, eventId deduplication, ETag/If-Match retries and preservation of an existing event's payload. No S3 listing is performed.

Kinds written: `entry`, `story_born`, `read_changed`, `forecast_drawn`, `verdict`, `link_confirmed`, `chapter`, `branch_status`, `line`, `correction`, `coverage`. Country and situation events are outside this step. `eventId = sha1(kind + sourceKey)`. Raw sourceKey/sourceRow come from `world/`; entry identity includes archive/generation/topic, not topicId alone. Mutable THREAD_ANALYSIS and web rows add their generated timestamp to the event identity. Derived judgments point at the underlying entry, drift, forecast or corrected event's raw source row. Coverage points at the writer's manifest. Outlet source names remain the canonical domain; no publisher names are invented.

`entry.at` is `archivedAt` (collection time, **not publication time**). An absent timestamp uses its archive day at midnight and the original null remains in the entry payload. Forecast/history timestamps use their generated date where available, otherwise the source-key day. Judgments use the injected run clock on that date; historical local runs use the end of that UTC day. Top-level labels are fact/judgment; numeric model confidence stays in payload rather than inventing confidence tiers.

Capture before expiry: `entry`/`story_born` inputs expire after archive TTL (90 days; today-archive 24 hours); `read_changed` history/DRIFT inputs after 60 days and analysis after 90 days. DRIFTLOG is permanent. A missed retained window is a coverage gap, not evidence that nothing happened. Forecast/verdict events keep the complete normalized payload needed by the view, even if upstream rows later disappear.

## Views and failure behavior

Story files are `record/stories/<id>/YYYY-MM-DD.json` (create-only), then `latest.json`; the board reads `record/index.json`. Corrections have a dated create-only view and `record/corrections/index.json`. Every path, including timeline/manifest/corrections, moves under `record/shadow/` with the shadow option. No `record/pairs/` writes.

Raw facts are durable before model work. A model error or malformed judgment is isolated to that story, reported in `failures`, and does not stop other stories. Its prior successful view stays published; a first-ever failed story has no published view. Index coverage is stale when any story fails. A successful story gets a `coverage` completion event with the exact per-day prefix counts used by its `timelineCursor`; dated snapshots rebuild identically after late events are appended to older daily files. Deleting all views and rerunning reconstructs them without model calls. Once a date completes, reruns do not generate new judgments for it. New evidence is captured on the next run.

Storage, cursor or projection errors abort before latest pointers move. A dated-view conflict is accepted only if the winner equals its timeline projection; a divergent winner is an error. Latest/index publication is not an atomic multi-object transaction; a failed pointer write is repaired on retry. Backdated runs refuse to rewind an existing newer index. The append-only timeline is authoritative throughout. If recovery adds a correction after its day's view was already created, that immutable view stays intact, `correctionsSnapshotLag` is reported, and the rebuilt corrections index includes the correction.

## Models and cost control

Prompts are in `src/prompts.js`, blind to probability. Chapters use drift notes and current entries with no earlier chapter text, and only when the last chapter is strictly older than seven days. The corrector's persisted drift notes represent its moved gate; interpreting expected-path prose remains a limitation until structured kinds exist upstream.

Fired requires a supplied citation from the named source or two independent outlets. Dead requires a competing scenario's fired branch or cited impossibility; due date alone sets late. Dead branches with new entries may resurrect and append a correction pointing to the old event. Branches without new entries make no trigger call. Line calls occur at birth and weekly; earlier text stays in versions and a contradiction requires later citations.

`llmCalls` reports planned chapter/trigger/line calls; `skipped` says `not run: no llm`. No-LLM runs leave prose judgments absent and lines empty. Estimates from this state are conservative: lines remain pending and no model outcomes have closed branches. They are not a steady-state daily cost estimate. Dollar cost requires the coordinator's model choice and measured usage. See [DRYRUN.md](DRYRUN.md) for measured counts and coverage.

## Least-privilege IAM requested

- DynamoDB `GetItem`, `BatchGetItem`, `Query` on NewsCache, SummarizeAndPredict and GlobalPerspectivePredictionLog. No table writes or scans are needed by this loader.
- S3 `GetObject` on `web/*` and own `record/*` state; `PutObject` only on `record/timeline/*`, `record/stories/*`, `record/index.json`, `record/corrections/*` (including shadow equivalents), never pairs or any other world prefix. For the shadow week, scope puts to `record/shadow/*`.
- Narrow `ListBucket` conditions on read prefixes allow missing objects to return 404 instead of 403; code does not list.
- Standard Lambda logs. Coordinator owns registration, IAM, schedule and deployment; this lane creates no AWS resources.

## Local dry run

```sh
node backend/record/newsStoryRecord/dryrun.mjs --date 2026-10-19 --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/ --no-llm
node backend/record/newsStoryRecord/dryrun.mjs --date 2026-10-20 --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/ --no-llm
```

Use ascending dates and a clean local state directory. The adapter permits only read-only DynamoDB get/query and S3 get-object calls; all would-be S3 writes go to local files through the real shared helper with local ETags. Set `RECORD_AWS_MODULES` to an existing node_modules containing `@aws-sdk/client-dynamodb` to reuse pooled SDK reads; CLI reads remain the fallback. No dependency installation, local key lookup, LLM call or AWS mutation is performed. Failed reads propagate. Outputs include input/report JSON for each date and the would-be `record/shadow/*` objects. Earlier local-parser baseline artifacts are quarantined separately and are not the final record.

## Tests

```sh
node --test backend/record/newsStoryRecord/test/*.test.js
node scripts/check-shared-sync.mjs
node quality/check_docs.mjs
```

Tests use fake stores, real canonical readers, fake ETag-aware S3 and fake LLM responses. Schema validation borrows existing frontend Ajv; set `FRONTEND_NODE_MODULES` to the main checkout's installed frontend/node_modules in an isolated worktree. Shared JSONL/world tests cover conditional-append races and canonical parsing. Actual dry-run story/index files are all schema-checked and rebuilt from timeline before DONE.

See [ARCHITECTURE_TIMELINE.md](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

Last verified: 2026-10-21 (offline tests and local read-only artifacts; not deployed)
