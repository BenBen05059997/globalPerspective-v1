# NewsProjectInvokeAgentLambda

Per-cycle story generator. Loads the `staging` topics, checks freshness, assigns threadIds against the threading window, generates (or reuses)
a summary, cause chain and grounded forecast draw per topic (`action` summary|prediction|trace_cause|both, default both), swaps `staging` to
`latest`, writes the archive rows, the record inboxes and notes, thread pointers, reconciles today's PRED# threads, prunes old-generation
cache rows and marks `staging` processed (`agentProcessedAt`). Payload: `topicId`, `readOnly`, `force` (ignores the processed/cache guard and
the draw cadence, never freshness), `dryRun` (plan only, no LLM, no writes).

## Deployment
- `NewsProjectInvokeAgentLambda-dev`, `nodejs22.x`, group `pipeline` (scripts/functions.json); zip ships no node_modules.
- EventBridge Scheduler `InvokeNewsAgent` `cron(25 4/8 * * ? *)` UTC, 10 min after newsInvokeGemini.
- `scripts/lambda.sh NewsProjectInvokeAgentLambda diff|package|deploy` (diff first; deploy needs the operator).

## Reads (decision 0035 step 5d: two switches)
| Read | `ddb` (default) | `inbox` | Used by |
|---|---|---|---|
| `ARCHIVE_READS` | NewsCache `archive#DAY` today..today-7; freshness: `today-archive`, `archive#today`, `archive#yesterday` (consistent) | `<ENTRIES_INBOX_PREFIX>inbox/entries/DAY.jsonl` replayed (`entriesInbox.replayDay`) to the same rows | threading window, arc digest, G15, same-day siblings, freshness gate |
| `FORKS_READS` | `THREAD#<id>/TOPICS` pointer, then `PRED#<topicId>` query per id, SK >= today-90 | `<FORECASTS_INBOX_PREFIX>inbox/forecasts/DAY.jsonl` today-90..today replayed (`forecastsInbox.replay`, thread lines included): rows of this topic or naming the thread | draw cadence, G12 near-duplicate gate |

- `compare` reads both, answers from DynamoDB and logs `[archive-compare] window|freshness: equal|DIFFER n [...]` / `[forks-compare] <topicId> <threadId>: ...`.
  Unknown values, or inbox/compare with the inbox prefix unset, read DynamoDB. Code: `src/inbox-reads.js` (pure) + `index.js`.
- Timing: the run appends its inbox lines at the end, so at read time both sources hold the earlier runs only (same-day runs included).
  Forks also replay the run's queued forecast lines (already put to DynamoDB). Forecast day files are read once per run (91 GETs).
- Freshness from the inbox uses the two day files; the gate only reads the newest write time (`run-guard.lastArchiveWrite`), which a
  run's today-archive write never exceeds.
- Known fork differences (the inbox sees more): rows of topic ids the pointer never listed (drawn before it existed, 2026-10-19), and a row
  drawn earlier in the same run by a topic new to the thread. Rows before the forecasts inbox (2026-10-01) are DynamoDB-only until
  today-90 passes that day (2026-12-30).
- Also read: `staging`; `TOPIC#<id>` SUMMARY|PREDICTION|TRACE_CAUSE (reuse, siblings); `FACTS#<country>/COUNTRY_FACTS`; S3 `stories/state/*`
  (matcher). The archive write still reads `today-archive` and `archive#DAY` to merge into them.

## Writes (unchanged by the switches)
- NewsCache `latest`, `today-archive` (24 h, 3 sources), `archive#DAY` (90-day TTL, 10 sources, merged by shared `mergeArchiveDay`).
- SummarizeAndPredict `TOPIC#<id>` rows (TTL 259200 s, carry `threadId`), `THREAD#<id>/TOPICS` pointer (`topicId`, `topicIds` set);
  old-generation rows pruned when `CACHE_CLEANUP_ENABLED` (default true).
- PredictionLog (`PREDICTION_LOG_TABLE`, default `GlobalPerspectivePredictionLog`) `PRED#<topicId>/<day>`, put-once; after the archive
  write `lib.predThreadFix` moves today's row to the entry's final threadId (`drawnThreadId` keeps the first).
- S3 `WORLD_BUCKET`: `threads/story-map.json` (matcher, R3 off unless `ENABLE_R3_TIER=true`); entry notes `<NOTES_PREFIX>notes/entry/DAY.jsonl`
  (decision 0042); entries inbox (0051) one line per daily-row entry with `latest` and `run` fields; forecasts inbox (0052) a `drawn` line
  per put and a `thread` line per reconcile, queued and appended once per run by `inboxId`. Each is best-effort (`[notes]`, `[inbox]`).
- Live env: `NOTES_PREFIX`, `ENTRIES_INBOX_PREFIX`, `FORECASTS_INBOX_PREFIX` = `record/`. Role `newsprojectLambdaRole1fd679db-dev`:
  inline `entriesInboxWriter` / `forecastsInboxWriter` grant `s3:GetObject`+`PutObject` on `record/inbox/{entries,forecasts}/*` (and shadow)
  plus `s3:ListBucket` (a missing day reads as empty); `entryNotesWriter`, `matcher-s3-access`; DynamoDB via `AmazonDynamoDBFullAccess`.

## Forecast draw (decision 0038)
- `src/forecast-draw.js` (prompt, cadence `drawDecision`, outcome adapter, open-branch texts), `src/questions.js` (gates),
  `src/lib.js` (`buildGatedScenarios`, `MAX_OUTCOMES = 3`, `HORIZON_DAYS = 90`, `PROMPT_VERSION = 3`).
- Cadence: draw only when `decideReuse` says generate (no stored forecast or the article set changed) AND the thread has no fork in the last
  7 days; else keep the stored forecast (or none). Dry-run plans show `skip` / `reuse:fork-within-7d`.
- Output: up to 3 outcomes, each stored as a one-trigger scenario (`label` = event, own p, `by <due>`, `qid`), `unit: 'outcome'`, so every
  reader of `scenarios[]` is unchanged. Gates drop: lead > 90 or < 7 days, no/out-of-range p, vague source, restatement, formality at
  p >= 95, near-duplicate of an open branch of the thread (deadline not passed; verdicts not read), ungrounded date, statement verb
  without an action verb, already true in a story entry of the window, generic actor, more than 3.

## Threading
- `src/threading.js` (pure): join an entry of the window on `continues_topic` or title (normalised), else composite score >= 0.4 with
  keyword Jaccard >= 0.15; else found `thread-<slug>-<sha1>`. The whole run is compared before ids are minted. Each assignment logs
  `[join] {topicId, threadId, via, score, kwScore}`.
- Repair: `node backend/pipeline/cli/threads.mjs list-joins|merge|split` (writes only with `--apply`, operator yes).

## Gotchas
- Freshness (`src/run-guard.js`): no writes from a missing/future/prior-day generation or one older than the latest archive write; checked
  before generation and again before publication. Zero generated returns 503 `[pipeline-status] {reason:"zero-generated"}`, stale staging
  `reason:"stale-staging"`; neither swaps or archives. A processed staging from before the current gemini slot throws
  `stale-processed-staging`; one from the current slot is a quiet skip.
- A run that returns `stale-staging` at the publication check has already put PRED# rows but does not flush their forecasts-inbox lines
  (they wait in memory for the next warm invocation, or are lost on a cold start).
- Source fields: archive sources keep selector `publishedAt`, `outlet`, `age`; PRED# rows carry `threadId`, `category` (`categories[0]`),
  `forkId = <PK>|<SK>` and `scenarioIndex`; older rows lack them and stay readable.
- `http()` emits `Access-Control-Allow-Origin: *`. `package.json` lists Bedrock SDK deps the code does not use.
- Models: `XAI_API_KEY` / `GROK_API_URL` / `GROK_MODEL` are legacy names; the live provider is DeepSeek. `PREDICTION_MODEL` overrides the
  forecast model. Calls share `lib.buildChatBody` (thinking off).

## Tests
- `cd src && npm test` (`node --test ../test/*.test.js`). `test/inbox-reads.test.js` writes a fixture world with the agent's own code and
  reads it back per switch value. Two run-guard handler tests fail on main and are unchanged (the date-mocked harness reports `stale-staging`):
  `handler with zero generated returns failure marker...`, `cache-only run emits zero-generated failure...`.
