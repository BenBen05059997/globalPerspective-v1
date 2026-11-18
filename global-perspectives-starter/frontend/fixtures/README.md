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

The fixture is behind the live contract (checked 2026-10-31): the live bundle also carries
`_counts`, and situations carry `affected_names`, `aliases` and `tier_changed_at`, which this file lacks;
the fixture has `_note`, which the live bundle does not. Refresh it from the live bundle when you
depend on those fields.

## `record-views/`

A hand-made set of record views (`/data/record/views/*`, the files `newsStoryRecord` writes) for checking the story page
and the Stories list with no network. **Local dev only:** `npm run dev:fixture` (`vite --mode fixture`) adds a dev-server
plugin (`vite.config.js`, `apply: 'serve'`) that answers `/data/record/views/*` from this folder; a file not here is a
404. Every date in a file is moved by the days from `manifest.json` `factsThrough` to today, and the manifest's
`builtAt` is now, so the stories stay fresh. The build never loads the plugin or these files.

Open `/weekly/thread/thread-fixture-harbour-plan`: an entry of each `role` (start, move, measure), a written-late
entry (0061), a placed article row, an entry merged in from `thread-fixture-harbour-union` (alias view), and judged
links in both directions (`thread-fixture-port-strike` feeds in, `thread-fixture-freight-rates` is fed into; that one
has no analysis, so Read in full shows its plain timeline list). Every headline starts with "Fixture" and is test text,
not news. `src/features/threads/__tests__/recordViewsFixture.test.js` checks every file against the schemas in
`backend/record/newsStoryRecord/schema/views/`.
