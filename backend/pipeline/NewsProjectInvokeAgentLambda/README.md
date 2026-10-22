# NewsProjectInvokeAgentLambda

Per-cycle story generator. Loads the `staging` topics, generates (or reuses) a summary, trace-cause and
grounded forecast draw per topic (`action` summary|prediction|trace_cause|both, default both), assigns
threadIds against 7 days of archive, builds the story-to-thread map, swaps `staging` to `latest`, writes
the archive rows, prunes old-generation cache rows, and marks `staging` processed (`agentProcessedAt`).
Forecasts get FACTS# leaders and an arc digest as grounding (no live web search). Payload options: `topicId`, `readOnly`, `force` (ignore processed/cache guard; freshness still enforced), `dryRun` (plan only).

## Deployment
- Deployed name `NewsProjectInvokeAgentLambda-dev` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge Scheduler `InvokeNewsAgent` `cron(25 4/8 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh NewsProjectInvokeAgentLambda diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: `staging` (read, set `agentProcessedAt`), `latest` (write), `today-archive` + `archive#YYYY-MM-DD` (read/write).
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: `TOPIC#<id>` / `SUMMARY|PREDICTION|TRACE_CAUSE` (TTL 259200 s; each row carries `threadId`); writes the thread → topic pointer `THREAD#<threadId>` / `TOPICS` (`topicId` = current, `topicIds` string set = every topicId the thread has had, so PRED# rows are reachable by thread); reads `FACTS#<country>`/`COUNTRY_FACTS`; scans and batch-deletes old-generation rows when `CACHE_CLEANUP_ENABLED` (default true).
- DynamoDB `PREDICTION_LOG_TABLE` (default `GlobalPerspectivePredictionLog`): `PRED#<topicId>` / `<YYYY-MM-DD>`.
- S3 `WORLD_BUCKET`: reads `stories/state/*`, writes `threads/story-map.json` (matcher; R3 tier off unless `ENABLE_R3_TIER=true`).

## Forecast draw (decision 0038)
The DRAW node of `project-docs/architecture/ARCHITECTURE_FORECAST_LOOP.md` (stack tree), as built here:
```text
+- 1 DRAW        weekly, model                       [NewsProjectInvokeAgentLambda]
|  +- inputs : story entry facts of the week + FACTS# premise block + arc digest
|  +- rule   : only if the story moved this week (new entry facts); at most 3 outcomes per story per week
|  |           each = an event DONE (not said), due 7-90 days out, own p, a named source that would report it
|  |           gates drop: no p, vague source, lead outside 7-90, restatement, near-duplicate of an open branch on the story
|  +- model  : yes (writes the outcomes)
|  +- output : forecast_drawn fact (never changed); branch.text = the event text
|  +- cost   : about $0.003-0.005 per story forecast (A/B report 2026-10-17)
```
Code: `src/forecast-draw.js` (pure: prompt, cadence `drawDecision`, outcome adapter, open-branch texts), `src/questions.js` (gates G7-G12 plus G14 said-not-done), `src/lib.js` (`buildGatedScenarios` with `outcomeMode`, `MAX_OUTCOMES = 3`, `HORIZON_DAYS = 90`, `PROMPT_VERSION = 3`), `index.js` (`ensureStored` reads the thread's PRED# rows once via `readThreadForks`).
- Cadence: `decideReuse` says "generate" only when the story moved (no stored forecast, or its article set changed). A moved story is still not drawn when its thread has a PRED# row dated within the last 7 days; it keeps the stored forecast (or has none). `force` bypasses the cadence. The PRED# write stays `attribute_not_exists`, so the first draw of a day stands. Dry run plans show `skip` / `reuse:fork-within-7d`.
- Count and shape: the model returns `outcomes[]` (at most 3), not 3 scenarios x 3 triggers. Stored and logged, each outcome is a one-trigger scenario: `label` = the event text (so `branch.text` is the event), `probability_range` = its own p, `horizon` = `by <due>`, `rationale`, and the trigger `{text, deadline, p, resolutionSource, qid, question:true}`; the content carries `unit: 'outcome'`. Home PredictionDisplay, ThreadForecast, `world.scenarios()`, `branchesFromScenarios`, the sampler and LinkedIn read that shape unchanged. qid is `qidFor(PRED#<topic>, <day>, '<i>-0')`.
- Gates (outcome mode drops, never keeps as narrative): G3 lead > 90 days, G9 lead < 7 days, G7 no/out-of-range p, G8 vague or short source, G10 restates the story, G11 formality at p >= 95, G12 near-duplicate of any OPEN branch of the thread (deadline not passed) or of an outcome kept in the same draw, G13 ungrounded date/event, G14 a statement verb (says, announces, denies, warns, pledges, issues a statement ...) with no action verb (signs, passes, imposes, ...), CAP more than 3 kept.

### Choices (narrowest reading of 0038)
- "Moved this week" = the story's article set changed since the stored forecast, or there is none (`decideReuse` generate). Every story has an archive entry each run, so "has an entry" alone would not filter.
- "Last fork" = the newest PRED# row of any topicId the thread has had (`THREAD#<id>/TOPICS` set plus this topic), last 90 days; 7 days means a draw is allowed on the 7th day after.
- "Open branch" = a trigger in those rows whose deadline is today or later; verdicts are not read, so an early-resolved branch counts as open (stricter duplicate gate).
- Outcomes keep the stored `scenarios[]` field names instead of a new `outcomes` array, so no reader and no shared code changes. `precedents` is kept as the base-rate step; winners and losers are kept.
- Gate G14 is a verb list, not a model: ambiguous noun senses (strike, order, file, cut, delay) are left out of the action list on purpose, and "announces" alone is a statement.
- A story skipped by the cadence with no stored forecast gets no forecast for that run (honest empty). The run is "zero-generated" only if no summary or cause chain was generated either; a `prediction`-only action on a quiet run can therefore return 503.

## Models
- `XAI_API_KEY` / `GROK_API_URL` (code default `api.x.ai`; set in the live env) / `GROK_MODEL` (fallback `deepseek-flash`): legacy names, live provider is DeepSeek. `PREDICTION_MODEL` overrides the forecast model. All calls share `lib.buildChatBody` with thinking disabled.
## Threading
- `src/threading.js` (pure): a topic joins the thread of an archive entry from today's earlier runs or the past 7 days on its `continues_topic` title or its own title (both compared normalised: case, whitespace, punctuation), else when the composite score (0.5 keywords + 0.3 regions + 0.2 category) is >= 0.4 AND keyword-only Jaccard is >= 0.15; otherwise it founds `thread-<slug>-<sha1>`. Measured in `.board/linking/joins.md`. The whole run is compared before new ids are minted (including forward explicit continuations); it does not merge two established historical threads. If continues_topic and exact title disagree, the thread's latest archived member wins, with tie retaining continues_topic and conflict evidence logged. Each assignment logs `[join] {topicId, threadId, via, score, kwScore}` (via `continues_topic|title|score|new` or `run-*`; conflict/run-anchor metadata when applicable).
- Repair: `node backend/pipeline/cli/threads.mjs list-joins --since <date>` (read-only), `merge <from> <into>`, `split <threadId> <topicId...>` print every DynamoDB/S3 change and write only with `--apply` (operator yes). Tests: `node --test backend/pipeline/cli/threads.test.mjs`.
## Gotchas
- Freshness guard (`src/run-guard.js`): no generation writes from active fallback, missing/future generation time, a prior UTC day's generation, or a generation older than the latest archive write. Reads rolling/current/prior-day archives consistently before generation and again before publication. `force` cannot bypass freshness; `readOnly` cache inspection and `dryRun` planning remain available. Zero newly generated items returns HTTP 503 with `[pipeline-status] {status:"failed", reason:"zero-generated", generationId, generated, reused, failed}` and does not swap, archive, match or prune (cache reuse may already have restamped topic rows). Stale staging returns the same marker with `reason:"stale-staging"` and `staleReason`. Monitor integration is a coordinator change.
- Run guard: a `staging` already marked `agentProcessedAt` is skipped unless `force`, `topicId`, `readOnly` or `dryRun`. A skipped `staging` generated before the latest gemini slot start (04:15/12:15/20:15 UTC) logs `[pipeline-status] {reason:"stale-processed-staging"}` and throws so `lambda-errors-*` fires; one generated in the current slot stays a quiet skip. `http()` emits `Access-Control-Allow-Origin: *` (scheduler-invoked). `package.json` lists Bedrock SDK deps the code does not use.

## Source field contract

Archive sources preserve selector `publishedAt`, `outlet`, and `age` unchanged. New PRED rows carry `threadId`, `category` from `categories[0]` (legacy singular category fallback), `forkId = <PK>|<SK>`, and zero-based positional `scenarioIndex` on each scenario. Older rows remain readable without these fields.

## Tests
- `cd backend/pipeline/NewsProjectInvokeAgentLambda/src && npm test` (`node --test ../test/*.test.js`): 99 tests, 97 pass; 2 fail on main already and unchanged: `handler with zero generated returns failure marker...` and `cache-only run emits zero-generated failure...` (date-mocked run-guard harness reports `stale-staging`).
Last verified: 2026-10-22 (draw changes are tests-only, not deployed; the guards and same-run joins are deployed: `NewsProjectInvokeAgentLambda-dev` last modified 2026-10-21 12:54Z; tests last run 2026-10-20)
