# Frontend fixtures

## `world.json`

A hand-authored sample of the **map-as-home data contract** (`world/latest.json`) — the single
object the map/home fetches. Schema + field meaning: `project-docs/architecture/DATA_STRATEGY.md` §5.

Production no longer uses it: the situation tracker writes the real bundle to S3, served at
`https://globalperspective.net/data/world/latest.json` through the Cloudflare Worker `/data/*` route.

**Local dev only.** `src/features/map/api/worldData.js` reads `VITE_WORLD_URL` (default `/data`; a
value ending in `.json` is used as the bundle URL as is). For frontend work with no AWS/Worker
dependency, copy this file under `public/` and run `npm run dev` with
`VITE_WORLD_URL=/fixtures/world.json`. Do **not** commit a `.env` with this (`.env*` is never
committed in this repo).

The fixture is behind the live contract (checked 2026-10-19): the live bundle also carries
`_counts`, and situations carry `affected_names` and `tier_changed_at`, which this file lacks;
the fixture has `_note`, which the live bundle does not. Refresh it from the live bundle when you
depend on those fields.
