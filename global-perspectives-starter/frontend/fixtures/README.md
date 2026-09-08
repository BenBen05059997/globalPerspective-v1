# Frontend fixtures

## `world.json`

A hand-authored sample of the **map-as-home data contract** (`world/latest.json`) — the single
object the map/home fetches. Schema + field meaning: `project-docs/architecture/DATA_STRATEGY.md` §5.

Two uses:

1. **Read-path proof (S0·T3).** This file was uploaded to `s3://globalperspective-world-280362093938/world/latest.json`
   and is served in prod at `https://globalperspective.net/data/world/latest.json` (via the Cloudflare
   Worker `/data/*` route) until the live tracker (Stage S2) starts writing the real bundle.
2. **Local dev.** The world-data service (added in S4·T1) reads:

   ```js
   const WORLD_URL = import.meta.env.VITE_WORLD_URL || '/data/world/latest.json';
   ```

   For frontend work with **no AWS/Worker dependency**, point it at this fixture, e.g. run `npm run dev`
   with `VITE_WORLD_URL=/fixtures/world.json` (copy the file under `public/` or serve it), or set
   `VITE_WORLD_URL` to a local static server. Do **not** commit a `.env` with this — it is a per-dev
   convenience (`.env*` is never committed in this repo).

Keep this fixture in sync with the contract if the schema changes.
