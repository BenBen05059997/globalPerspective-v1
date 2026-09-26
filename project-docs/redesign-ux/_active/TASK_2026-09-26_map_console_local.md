## Map console at `/map`, built locally for review — 2026-09-26 — active

### Goal
Build the approved **map home (operations console)** at `/map`, on a local branch, so the operator can review it on `localhost:5173/map` before anything ships.
- Operator, 2026-09-26: "yes we can build the map first and lets see what we have … first build it in local and let me see".
- **Out of scope:**
  - deploy (`./deploy.sh`);
  - merging to `main`;
  - changing `/` (the S6 home swap is a later decision);
  - backend / Lambda changes.
- This is master-plan stage 7a pulled forward, with only the stage-1 foundation pieces it needs (`REDESIGN_MASTER_PLAN.md` §7).

**Decisions this build follows** (all approved):
- **Look:** console design system DS1; the new design wins over the old light tokens.
- **Globe:** **B, NASA night lights (Black Marble)** (H4, 26 Sep). **Radar mode kept:** the phone default, a GLOBE | RADAR switch on desktop, and automatic radar when 3D isn't available.
- **Console:** HUD (situation brief, threat board, sensor status, intel feed, alert stack); the click → story card; StoryPeek on every story mention.
- **Honesty:** the "paused since 12 Sep" line is computed from data. A story with no exact place **shades its country** (H2); the orientation banner replaces the guided tour (H1).
- **Legend:** shape = kind, hue = crisis type, size + double ring = HIGH, brightness = freshness, dashed = judged link; motion budget = 3 movers, max 8 pulses; GDACS level as a text badge.
- **Phone (P1):** the map page opens on MAP (radar), with LIST and ALERTS tabs; the card opens as a bottom sheet; 44px targets.
- **Not decided (so not built):** option E, the small real globe in the radar's corner.

### Reads / references (not modified)
- `REDESIGN_MASTER_PLAN.md` §3.1–3.2, `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md` rounds 2–3, `CONSOLE_WIREFRAME_TECHNIQUE.md`, `STORY_DOSSIER_BOARD_DESIGN_BRIEF.md` (story card + StoryPeek), `STORY_WEB_RETHINK_PLAN.md` §8–9.
- Canvas boards A1–A5, DS1, P1: https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW
- Globe options: https://claude.ai/artifact/QpC85emw93DTtzoPxGabGp
- Data: `hooks/useWorld.js` + `api/worldData.js` (`world/latest.json` via the Worker), the proxy `topics` / `archive_range` actions.

### Files this task touches (update as scope shifts)
| Phase | Create / edit |
|---|---|
| M0 | branch `map-console`; this file |
| M1 | `src/shared/styles/tokens.css` (a new **scoped** `.gp-console` token section, so other pages keep their look); `src/features/map/SituationHome.css` |
| M2 | `src/features/map/SituationHome.jsx` (console frame); new `src/features/map/components/Hud*.jsx` (brief, threat board, sensor status, intel feed, alert stack); new `src/shared/lib/freshness.js` ("paused since", computed from the newest `generatedAt`); tests |
| M3 | `src/features/map/components/SituationMap3D.jsx` (night-lights globe on the existing deck.gl `GlobeView`, spin / stop / turn-to-story, reduced motion); new asset `public/textures/earth-night.jpg` (~0.7 MB, NASA Black Marble via the MIT `three-globe` examples; lazy-loaded after the shell) |
| M4 | new `src/features/map/components/RadarMap.jsx` (flat map from the bundled `assets/countries-110m.json`, sweep, one flare per pass); the mode switch in `SituationHome.jsx`; tests |
| M5 | new `src/shared/ui/StoryPeek.jsx` + `src/shared/hooks/usePeek.js` + `src/shared/lib/peekData.js`; new `src/shared/lib/storyStatus.js` (▲●◆▼); new `src/features/map/components/StoryCard.jsx`; country shading in both maps; new `src/features/map/components/OrientationBanner.jsx`; tests |
| M6 | new `src/features/map/components/MapLegend.jsx`; the motion-budget helper in `src/features/map/lib/` |
| M7 | `SituationHome.jsx` / `.css` phone layout (MAP · LIST · ALERTS, bottom sheet); `src/app/layout/Layout.jsx` **only if the operator asks** for the new site shell in this review |

**Not touched:**
- `docs/` (build output), `docs/config.js`, `public/config.js`;
- any Lambda or the Worker;
- `/` and other pages' styles.

### Docs to update, per phase, in the same commit
- [ ] this file's tracker row (status, commit, monitor evidence)
- [ ] `CHANGES.md` entry (required by the pre-commit hook on code commits)
- [ ] `MAP_HOME_SITUATION_LEDGER.md` (a new S5.6 row group for the console)
- [ ] `project-docs/architecture/ARCHITECTURE.md` frontend path map, when a new `shared/*` part lands (M2, M5)
- [ ] `REDESIGN_MASTER_PLAN.md` §7 stage 7a status, at the end

### Live tracker
- **How each phase runs:**
  - a Sonnet agent executes it on branch `map-console`;
  - the monitor re-verifies: `npm run verify`, a browser click-through of every touched control at `localhost:5173/map` (desktop + phone width), a data-honesty check (no "live" claims except GDACS; dates visible), and reduced motion;
  - then it commits on the branch and pushes **the branch only**.
- **Sizes:** each phase is sized when it starts; no earlier estimate exists.

| Phase | Goal | Status | Commit | Monitor ✓ |
|---|---|---|---|---|
| M0 · Branch + plan | Branch created; this file | ✅ | plan on main | branch `map-console` created |
| M1 · Console tokens | DS1 as a scoped theme: surfaces, text, accent, crisis hues, freshness ramp, motion durations, 44px | ✅ | see git log (branch) | verify 21 files / 200 tests green (3 pre-existing lint warnings); browser: `/map` dark console palette with live world data (1 GDACS situation, 13 Sep content pause shown by the page's own lines); fixed an early-closed CSS comment (palette dropped) + an invisible fold heading; phone-width check not possible (window wouldn't shrink below desktop), and M1 has no layout change |
| M2 · Console frame | HUD panels + intel feed (the map's accessible twin) + the computed "paused since" line + sensor status per source | ✅ | see git log (branch) | verify 23 files / 212 tests; browser: status line "PAUSED SINCE SEP 12", honest news-desk row, tier counts, feed click selects + `?focus=` URL. Monitor fix: the line survives past the 30-day lookback. Known issues for M3/M6: the HUD panels crowd the map's left edge and overlap the selection callout area; the brief repeats the header lede |
| M3 · Night-lights globe | Real Earth (B) on `GlobeView`; spin, stop on touch, turn to the selected story; reduced motion = still | ✅ | see git log (branch) | verify 24 files / 226 tests; browser: fresh load opens on the night-lights globe (zoom-checked: city lights + borders), spin control + attribution present; agent also checked spin stop, fly-to Mexico, flat toggle. Not checked: OS reduced motion (code + unit tests only). Known issue for M6: the globe renders small at the default zoom |
| M4 · Radar mode | Flat radar, sweep, flare per pass, "scanned" mark in the feed (no focus theft); GLOBE / RADAR switch; auto radar without 3D | **Now** | — | — |
| M5 · Card, peek, shading, banner | Story card, linked selection in the URL, StoryPeek everywhere, country shading for place-less stories, orientation banner | queued | — | — |
| M6 · Legend + motion budget | Compact "?" legend; max 3 movers / 8 pulses; GDACS text badge | queued | — | — |
| M7 · Phone | MAP (radar) default + LIST + ALERTS; card as a bottom sheet; 44px | queued | — | — |
| Review | Operator reviews on localhost; list of changes | queued | — | — |

### Completion checklist
- [ ] M1–M7 ✅ on branch `map-console`, each with monitor evidence
- [ ] `npm run verify` green on the branch
- [ ] operator reviewed at `localhost:5173/map`
- [ ] all docs above updated in the same commits
- [ ] no deploy and no merge: both need a fresh operator "yes"
- [ ] status header flipped to `done`

**Local review setup:** run `VITE_WORLD_URL=https://globalperspective.net/data npm run dev` in `global-perspectives-starter/frontend`, then open `http://localhost:5173/map`. This reads the live world file (the Worker allows any origin, and the call is read-only). Don't commit an `.env` for this.
