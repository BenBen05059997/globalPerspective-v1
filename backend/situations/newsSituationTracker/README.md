# newsSituationTracker

Sole writer of situation state and the map bundle. Each sweep reads the GDACS snapshot and the significant news stories, folds them into prior state (open / raise / spread / cool, close after N cooling sweeps, archive closed ones after `CLOSED_KEEP_HOURS`), and assembles `world/latest.json` with situations, ranked list, templated lede and freshness. Links a story to a thread via `threads/story-map.json` (a prior situation latches the thread for its stories). A threaded story's situation id is `news#<ISO3>#<threadId>` (ISO3 from the storyId), so stories of one country and thread fold into one situation (`storyIds[]`); an unthreaded story keeps `news#<storyId>`. Old ids a situation absorbed stay in `aliases[]` (state, index and `world/latest.json`) so `/?focus=<old id>` can resolve; the absorbed old state objects are archived, not cooled. No LLM.

## News grouping (`NEWS_GROUPING`, default off)
One event, one situation. With `NEWS_GROUPING=true` the tracker runs a strict merge pass after the per-story/thread grouping (`planNewsGrouping` in `situations-core.js`). Two news stories/situations join only when (a) they share at least 2 normalised, non-live article URLs (lowercase scheme+host, no query/fragment/trailing slash; a story's URLs are compared with every URL the situation has held; live blogs and rolling pages are ignored, patterns in `LIVE_URL_PATTERNS`) or (b) they have an identical normalised title (lowercase, collapsed whitespace) AND share a country. No chaining: clusters are taken heaviest first and a new join must match the group's LEAD directly (grouped-for-life members stay). Never country overlap or title words alone; GDACS and closed situations are never touched.
- Grouped for life: the survivor persists `member_urls[]` (last 200 distinct), `member_story_ids[]` (only once it has merged; a lone situation's story id is not a join key), `threadIds[]` (threads of all members), `also_reported_as[]` (other member titles, distinct, not the lead; max 6). A story whose id or URL is in those sets joins it on every later sweep.
- Survivor id: the oldest open situation in the group (`opened_at`), so the long-lived link keeps working; a group of all-new stories uses its lead story's id. Every other id becomes an `aliases[]` entry (`?focus=` resolves it) and its old state is archived. The title is the lead story (outlets x severity, `mergeStories`).
- `world/latest.json` summaries carry `threadIds` and `also_reported_as` (only when non-empty).
- Merge list: each sweep's NEW merges are logged (`[tracker] merges [...]`) and written to `situations/merges/YYYY/MM/DD/HH/<HHMM>.json` (`shadow/situations/merges/...` under `DRY_RUN`), with the rule and its evidence (URL, or title + countries). Flag off: no new fields, no list, output unchanged.
- Shadow first: `DRY_RUN` (code default) writes the grouped universe only under `shadow/situations/` and `world/shadow/`; live `world/latest.json` is untouched. `NEWS_GROUPING` is read at start; it is not set in the live env yet.
- Live preview (read-only S3 GETs, no writes/invoke): `node scripts/preview-news-grouping-live.mjs` prints what would join this sweep.
- Replay: `node scripts/replay-news-grouping.mjs --dir <local copy of world snapshots + situations/state> --hours 24` (offline, never writes S3).

## Deployment
- Deployed name `newsSituationTracker` · runtime `nodejs22.x` · group `situations` (scripts/functions.json)
- Trigger: `TriggerSituationTracker` `rate(30 minutes)` ENABLED, EventBridge rule
- Deploy: `scripts/lambda.sh newsSituationTracker diff|package|deploy` (deploy needs operator authorization per CLAUDE.md). Zip does not ship node_modules.

## Reads / writes
- S3 `WORLD_BUCKET` reads: `situations/inbox/gdacs-latest.json` (from newsGdacsIngest), `stories/index.json` (from newsSituationIngest), `threads/story-map.json` (from newsAgent)
- S3 writes: `situations/state/<id>.json`, `situations/index.json`, `situations/history/YYYY/MM/DD/HH/<HHMM>.json`, `situations/archive/<id>.json`, `world/latest.json` (max-age 60), `world/latest.member.json`, `world/YYYY/MM/DD/HH/<HHMM>.json`; with `NEWS_GROUPING` also `situations/merges/YYYY/MM/DD/HH/<HHMM>.json`
- CloudWatch namespace `METRIC_NS` (default `GlobalPerspective/Situations`), dimension `Mode` shadow|live
- Tuning env names: `SWEEP_MIN`, `GDACS_STALE_MIN`, `CLOSE_AFTER_COOL_CHECKS`, `CLOSED_KEEP_HOURS`, `NEWS_STALE_MIN`, `SITUATION_TTL_DAYS`, `STORY_MAP_MIN_OUTLETS`, `STORY_MAP_MIN_SEVERITY`, `STORY_MAP_CAP`, `CORROBORATION_CAP`, `RAISE_COOLDOWN_MIN`, `NEWS_GROUPING` (`true` to group; default off)

## Gotchas
- Live `CLOSED_KEEP_HOURS` is 8 (code default 48; checked 2026-11-03): a closed situation is archived 8 hours after it closed. The map never draws closed situations.
- `DRY_RUN` defaults to true in code: unless it is exactly `false`, everything is written under `shadow/situations/` and `world/shadow/`. Live env sets `DRY_RUN=false` (checked 2026-10-19).
- The code default for `SWEEP_MIN` is 10; the live rule is 30 minutes and live `SWEEP_MIN` is 30 (checked 2026-10-19). `SWEEP_MIN` only sets `next_expected_at`.
- A humanitarian news story sharing a country with a GDACS situation is skipped (one event, one pin).
- Each ranked situation's `href` is its story page (`storyHref`) when threaded, else the map focused on it (`mapHref`, `/?focus=<id>`); both from `src/_shared/links.js`.
- `situations-core` comes from `backend/shared/src` through the `src/_shared` symlink (one copy, shared with newsGdacsIngest); `scripts/lambda.sh` zips it as a real file. Its tests: `backend/shared/test/situations-core.test.mjs`.

## Source field contract

Each source freezes independently when its input cannot be trusted. Frozen situations get no cooling, closure, archival, regrouping or synthetic history transition, and resume normal folding on a healthy input.

- News is degraded when `stories/index.json` is missing, marked degraded/failed, or stalled: `updated_at` missing or older than `NEWS_STALE_MIN` (default 180 minutes, three missed runs of the hourly `TriggerSituationIngest`; a failed ingest run keeps the old `updated_at`, so it ends up here too). Bundle: `sources.newsDegraded`, `stale: true`.
- GDACS is degraded when `situations/inbox/gdacs-latest.json` is missing/unreadable or marked `degraded`. newsGdacsIngest writes no snapshot at all when GDACS returns no events (so the last snapshot stays, and goes stale after `GDACS_STALE_MIN`). Bundle: `sources.gdacsDegraded`, `stale: true`. A snapshot with zero Orange/Red events but a normal GDACS reply is not degraded: those disasters really ended and cool and close as usual.

GDACS events that drop off the feed keep their last real alert level (`evidence.gdacs_level`) and get `evidence.gdacs_listed: false`. When one returns, it re-opens (`reopened`, state `peak`, no false "Alert raised") whether it was cooling or already closed (inside `CLOSED_KEEP_HOURS`). A listed event is never closed or expired for lack of change: each world summary carries `listed` for GDACS situations and the map does not hide a listed alert after 30 days without a change.

## Tests
- `cd src && npm test` runs `degraded.test.js`, `handler.test.js` (fake S3: live vs shadow write set, archive-then-delete) and `index.test.mjs`. All offline.
