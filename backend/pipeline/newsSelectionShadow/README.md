# newsSelectionShadow

Shadow run of the layered story selector (plan P7). Shortly after each live topic selection it logs what the layered selector would have picked next to what was published; nothing on the site reads the output. Steps: take the last 8 hours of story-scan corpus, merge into stories, tag disaster stories matching active GDACS Red/Orange situations, ask Jev for impact, new-since-last-brief, and done-or-said, then select with the live run's slot count, skipping its own picks from the previous 24h. Rules live in `selection-core.js` (shared with `predictions/jev-backtest/run.mjs`).

## Deployment
- Deployed name `newsSelectionShadow` · runtime `nodejs22.x` · group `pipeline` (scripts/functions.json)
- Trigger: EventBridge rule `TriggerSelectionShadow` `cron(20 4,12,20 * * ? *)` (UTC, ENABLED)
- Deploy: `scripts/lambda.sh newsSelectionShadow diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- S3 `WORLD_BUCKET` reads: `audit/ingest-capture/latest.json` and dated captures, `corpus/YYYY/MM/DD/HH.jsonl`, `situations/state/gdacs_*`, own `audit/selection-shadow/<date>/` files
- S3 writes: `audit/selection-shadow/<YYYY-MM-DD>/<HHMM>.json` and `audit/selection-shadow/latest.json`
- External APIs: Jev `api.typesafe.ai/v1/systemone` (model `jev-latest`, key `JEV_API_KEY`, 30s timeout)

## Models
- Jev (`jev-latest`) only; cost logged at a hard-coded input price. No LLM env model names.

## Gotchas
- Throws without `JEV_API_KEY`; skips (returns `ok: false`) when no live selection ran in the last 30 min.
- Hard guard: throws when a run would need more than `MAX_JEV_CALLS` (default 300) Jev calls.
- `classifier-core.js` is a symlink to `newsSituationIngest/src/classifier-core.js` (one clustering source); the deployed zip must hold the real file, so check `diff` before deploy.

## Tests
- `cd backend/pipeline/newsSelectionShadow/src && node selection-core.test.mjs` (offline): 6 tests passed 2026-10-19.

Last verified: 2026-10-19
