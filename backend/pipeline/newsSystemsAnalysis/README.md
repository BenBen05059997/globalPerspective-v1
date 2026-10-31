# newsSystemsAnalysis

Daily cross-domain causal "web" per country. Reads 30 days of topic archives plus thread analyses, groups threads by country (real countries only, `src/placeFilter.js`), and asks an LLM for a node/edge graph for the top `SYSTEMS_TOP_N` (default 5) countries. Then rebuilds per-story web records and one index from all current webs (`src/webRecords.js`). Event `{ countries: [...] }` overrides the targets; `{ dryRun: true }` returns prompt sizes and coverage with no LLM call and no writes.

## Deployment
- Deployed name `newsSystemsAnalysis` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: `TriggerNewsSystemsAnalysis` `cron(0 5 * * ? *)` UTC, ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsSystemsAnalysis diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). The zip ships node_modules (package installs prod deps).

## Reads / writes
- DynamoDB `TOPICS_DDB_TABLE`: reads `today-archive` and `archive#YYYY-MM-DD` (key `id`)
- DynamoDB `SUMMARIZE_PREDICT_TABLE`: reads `THREAD#<id>`/`THREAD_ANALYSIS`; writes `SYSTEMS#<country>`/`SYSTEMS_ANALYSIS`, `WEB#INDEX`/`LATEST`, `THREAD#<id>`/`WEB`
- S3 `WORLD_BUCKET` (fallback `globalperspective-world-280362093938`): after the DynamoDB writes, writes the same snapshot (`runId`, `index`, `records`, raw per-country `webs`) to `web/YYYY/MM/DD.json` (UTC date; a same-day rerun overwrites) and `web/latest.json`; a failure is logged and does not fail the run. Role has write-only `s3:PutObject` on `web/*`.
- S3 `WORLD_BUCKET`, link notes (decision 0042): each edge of a country web stored in this run is also written as a `link` note to `<NOTES_PREFIX>notes/link/DAY.jsonl` through shared `notes.js` (`src/recordNotes.js`): subject = `pairKey(from, to)`, part = the web's country ISO3, `threadId` null, payload = the edge (`from`, `to`, `country`, `confidence`, `lagDays`, `mechanism`, `cited`), `cites` = eventIds of the cited entries (shared `entryIdentity` over the archive entries' source urls; one not found is left out). A web holding both directions of a pair keeps the stronger edge as the note and the other as `payload.reverse` (the links view makes it a row of its own). Each web is also one `web` note (`<NOTES_PREFIX>notes/web/DAY.jsonl`, written first): subject = the country ISO3, part `''`, payload = `country`, `nodes` (the web's thread ids, with or without an edge) and `backbone` (the deterministic shared-actor edges: `from`, `to`, `sharedActors`, `weight`), `at` = the web's `generatedAt`; a web with no edge has no link note, so this is how the record knows it exists. The links view (`web`) reads coverage and the shared-actor backbone from it. The node summaries are not notes (still `SYSTEMS#`). A country with no ISO3 is skipped and logged. Best-effort: a failure logs `[notes]` and never fails the run. `NOTES_PREFIX` defaults to `record/shadow/`; set `record/` to go live. Needs role access: Get/Put on `record/notes/link/*`, `record/notes/web/*` and the same under `record/shadow/`, plus `s3:ListBucket` on the world bucket so a new day file reads as missing (the existing `web/*` policy is write-only).
- Other env names: `SYSTEMS_TEST_COUNTRIES` (comma list restricting targets), `MAX_TOKENS` (default 3000), `TEMPERATURE` (default 0.3)

## Models
- `GROK_MODEL` (code fallback `deepseek-v4-pro`) through the shared client `src/_shared/llm.js`: `GROK_API_URL` (fallback `https://api.deepseek.com`), key `XAI_API_KEY`. The GROK_/XAI_ names hold DeepSeek values. Thinking mode disabled.

## Gotchas
- `SYSTEMS#` rows carry a 14-day `ttl`, but the table's TTL is disabled, so old webs never expire; readers judge freshness from `generatedAt`.
- A web-index failure is logged and does not undo the country webs already written.
- Cites are kept only if the model was shown that entry (short `E12` codes mapped back to topicIds).
- `dayZero`, `placeFilter` (+ name tables) and `llm` come from `backend/shared/src` through the `src/_shared` symlink; `scripts/lambda.sh` zips them as real files. Shared-module tests live in `backend/shared/test`.

## Tests
- `cd backend/pipeline/newsSystemsAnalysis/src && npm test` (`node --test ../test/*.test.js`)
