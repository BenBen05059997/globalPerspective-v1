# newsStoryRecord

Builds a dated story account from retained archives, thread analyses and drift notes, prediction forks, resolver verdicts and confirmed web links. LLM dependencies are injectable; local runs use no LLM. Duplicate candidates are proposals only, with actors, place and shared outlet headline evidence. The 48-hour window uses the injected run time for the run date; historical dates use the end of that UTC day.

## Deployment

- **Not created.** Planned group `record`; deployment entry point `runtime.handler` (`src/runtime.js`), Node.js 20 or newer. Coordinator registers it and selects the model.
- Planned schedule **05:45Z**, `cron(45 5 * * ? *)`, after drift notes. The pipeline document takes precedence over the plan's older 05:30 row.
- Runtime defaults to shadow output. Event: `{"date":"2026-10-20","shadow":true,"noLlm":true}`. Never deploy or invoke locally against a real S3 writer.
- Environment: `AWS_REGION`, `WORLD_BUCKET`, `TOPICS_DDB_TABLE` (NewsCache), `SUMMARIZE_PREDICT_TABLE`, `PREDICTION_LOG_TABLE` (GlobalPerspectivePredictionLog), `RECORD_LLM_MODEL` (required for LLM runs). Cloud-only LLM credentials/provider settings are handled by shared `llm.js`; no local keys.
- AWS SDK v3 modules use the Lambda runtime's versions. Shared modules come through the committed `src/_shared` symlink, staged by the coordinator's existing package tooling.

## Reads / writes

Read-only `store.load(date)` returns entries, as-of analyses, drift notes, prediction rows, verdicts, confirmed links and explicit coverage with per-source as-of stamps. Both runtime and local CLI paginate reads with Limit 100; independent reads overlap and thread queries are bounded to four at once. The current loader scans all retained archive rows on each run to find the earliest available birth; this is not proof of the first-ever entry if history was deleted. Only stories with entries in the last 30 days enter the index. The index marks a missing run-date archive as stale. Future analysis rows never leak into historical replays; historical scalar rows may lack actors, which come from archives instead.

The ten pipeline steps live in `src/index.js`: birth; duplicate report; events; drift-gated chapter (last chapter strictly older than seven days); immutable PRED forks with one branch per trigger and a scenario identifier; evidence-checked trigger statuses; corrections; read-only verdict mirror (numeric VERDICT revision order); weekly versioned line; immutable snapshot then latest/index. Bootstrap/recovery also fills missing past events. Day-zero entries use shared `dayZero.js`.

All writes go through shared `s3json.js`. Snapshot conflicts reload the winner. Calculation or snapshot failure occurs before any latest pointers move; pointer writes themselves are not an atomic multi-object transaction. A pointer-write failure may leave some pointers updated, repaired on retry. Backdated runs refuse to rewind latest/index. There is one writer and no concurrent schedule execution should be configured. Corrections carry source and prior dates and are recovered from snapshots on retry.

Prefixes: `record/stories/<id>/YYYY-MM-DD.json` then `latest.json`; `record/index.json`; `record/corrections/YYYY-MM-DD.json` and `corrections/index.json`. Shadow adds `shadow/` immediately below `record/`, including every pointer and correction.

## Models and cost control

Prompts live in `src/prompts.js`. Probability never enters a prompt. Chapter prompts exclude earlier chapter text. Fire requires a supplied citation from the named source or two distinct cited outlets. Dead requires a sibling fire or cited impossibility; an overdue date alone sets late. Dead branches with new entries are checked for resurrection and append a correction. No new entries means no trigger call. Late branches remain eligible for evidence checks. The record retains dated status and verdict histories.

Line calls occur at birth and at most weekly. The pipeline cost paragraph mentions only chapter/trigger calls despite requiring a line LLM in step 9: reports expose all three counts separately. Call estimates reflect the no-LLM state: missing lines remain pending, and no model outcomes have closed branches; later-day counts are therefore conservative. No dollar estimate is asserted without an operator-selected model and measured token usage. `llmCalls` counts planned calls even in `--no-llm`; `skipped` explicitly records `not run: no llm`. Empty line text is honest missing judgment, not generated prose. Without an LLM, only deterministic date statuses are computed; fire/dead/chapter/line judgments are absent.

## Least-privilege IAM requested

- DynamoDB `GetItem`, `Query`, `Scan` on **NewsCache**, **SummarizeAndPredict**, **GlobalPerspectivePredictionLog** only. No writes.
- S3 `GetObject` on `web/*` and own `record/stories/*`, `record/index.json`, `record/corrections/*` (including corresponding shadow paths). Existing records must be read for append-only updates.
- S3 `PutObject` only on the same owned record prefixes, never `record/pairs/*` or other world data. For the dry-run week scope writes to `record/shadow/*` only.
- Missing-object reads need a narrowly scoped `ListBucket` permission for those read prefixes so absence is 404 rather than 403. No listing is performed by this code.
- Standard Lambda logging. No local credential changes or AWS resource creation.

## Local dry run

```sh
node backend/record/newsStoryRecord/dryrun.mjs --date 2026-10-19 --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/ --no-llm
node backend/record/newsStoryRecord/dryrun.mjs --date 2026-10-20 --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/ --no-llm
```

Use a clean output directory and ascending dates: it is the local S3 state for consecutive days. The adapter allows only DynamoDB get/query/scan and S3 get-object. Set local-only `RECORD_AWS_MODULES` to an existing `node_modules` containing `@aws-sdk/client-dynamodb` to reuse pooled SDK reads; the CLI remains the default and handles S3 reads. No dependencies are installed. All would-be puts go to local files through the real shared S3 helper; no LLM code is imported. Failed AWS reads abort rather than fabricate coverage. Date-specific web snapshots are preferred, then as-of latest; future latest is excluded. Outputs: `record/shadow/*`, the retained read input `input-YYYY-MM-DD.json`, and `report-YYYY-MM-DD.json` (threads, births initialized (plus births on the run date), duplicate evidence, forks, branches, late, mirrored verdicts, raw and gzip index KB, coverage, planned call counts). Local reruns reuse snapshots, so work counters may be zero on retry.

## Tests

```sh
node --test backend/record/newsStoryRecord/test/*.test.js
node scripts/check-shared-sync.mjs
node quality/check_docs.mjs
```

Schema tests borrow the frontend's existing Ajv. In an isolated worktree set `FRONTEND_NODE_MODULES=/absolute/main-checkout/global-perspectives-starter/frontend/node_modules` if dependencies are only installed there. No installation is needed. Fake-store, fake-S3 and fake-LLM tests make no network calls.

Last verified: 2026-10-20
