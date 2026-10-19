# newsSituationTracker

Sole writer of situation state and the map bundle. Each sweep reads the GDACS snapshot and the significant news stories, folds them into prior state (open / raise / spread / cool, close after N cooling sweeps, archive closed ones after `CLOSED_KEEP_HOURS`), and assembles `world/latest.json` with situations, ranked list, templated lede and freshness. Links a story to a thread via `threads/story-map.json`. No LLM.

## Deployment
- Deployed name `newsSituationTracker` · runtime `nodejs22.x` · group `situations` (scripts/functions.json)
- Trigger: `TriggerSituationTracker` `rate(30 minutes)` ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsSituationTracker diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- S3 `WORLD_BUCKET` reads: `situations/inbox/gdacs-latest.json` (from newsGdacsIngest), `stories/index.json` (from newsSituationIngest), `threads/story-map.json` (from NewsProjectInvokeAgentLambda)
- S3 writes: `situations/state/<id>.json`, `situations/index.json`, `situations/history/YYYY/MM/DD/HH/<HHMM>.json`, `situations/archive/<id>.json`, `world/latest.json` (max-age 60), `world/latest.member.json`, `world/YYYY/MM/DD/HH/<HHMM>.json`
- CloudWatch namespace `METRIC_NS` (default `GlobalPerspective/Situations`), dimension `Mode` shadow|live
- Tuning env names: `SWEEP_MIN`, `GDACS_STALE_MIN`, `CLOSE_AFTER_COOL_CHECKS`, `CLOSED_KEEP_HOURS`, `SITUATION_TTL_DAYS`, `STORY_MAP_MIN_OUTLETS`, `STORY_MAP_MIN_SEVERITY`, `STORY_MAP_CAP`, `CORROBORATION_CAP`, `RAISE_COOLDOWN_MIN`

## Gotchas
- `DRY_RUN` defaults to true in code: unless it is exactly `false`, everything is written under `shadow/situations/` and `world/shadow/`. Live env sets `DRY_RUN=false` (checked 2026-10-19).
- The code default for `SWEEP_MIN` is 10; the live rule is 30 minutes and live `SWEEP_MIN` is 30 (checked 2026-10-19). `SWEEP_MIN` only sets `next_expected_at`.
- A humanitarian news story sharing a country with a GDACS situation is skipped (one event, one pin).
- `situations-core` comes from `backend/shared/src` through the `src/_shared` symlink (one copy, shared with newsGdacsIngest); `scripts/lambda.sh` zips it as a real file. Its tests: `backend/shared/test/situations-core.test.mjs`.

## Tests
- `cd backend/situations/newsSituationTracker/src && node index.test.mjs` - 7 passed 2026-10-19

Last verified: 2026-10-19
