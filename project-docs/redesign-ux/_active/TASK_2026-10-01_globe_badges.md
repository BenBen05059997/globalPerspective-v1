## Globe status badges, alert diamonds and selection brackets at constant screen size — 2026-10-01 — done

**Goal:** On the desktop deck.gl globe (`SituationMap3D.jsx`) the ▲●◆▼ status badges, the ◆ GDACS alert diamonds and the selection HUD brackets must stay a constant SCREEN size, sit right beside their own marker at every zoom (-0.5 to 6) and during spin/drag, hide on the far side, and never appear detached. Confirmed on the live site by the monitor: they were drawn as tiny GEOGRAPHIC polygons (`pxPolygon()` + `degPerPx(zoom)`), which grow / drift / merge when zoomed. The look approved in R4a (shape = kind, white badge with dark edge up-right of the mark, ◆ diamond for alerts, HUD brackets for the selection) does not change. RadarMap (phone, d3) is untouched. No deploy, commit or push in this task.

**Reads / references:**
- `CLAUDE.md`; `project-docs/playbooks/TASK_TEMPLATE.md`; `src/features/map/lib/legend.js` (token rules); the legend comment block at the top of `SituationMap3D.jsx`.
- deck.gl 9.4 sources: `@deck.gl/core/dist.webgl-only/viewports/globe-viewport.js` (scale = 2^(zoom - log2(pi*cos(viewLat)))), `@deck.gl/layers/dist/icon-layer/*` (pixel-space billboards).
- Screenshots of the bug: session scratchpad `zoom_0.png`, `zoom_step3.png`, operator `images/1.png`.

**Changes (code):** (under `global-perspectives-starter/frontend/` unless noted)
- `src/features/map/components/SituationMap3D.jsx`: remove `degPerPx`, `lonScale`, `pxPolygon`, `bracketPaths` and the SolidPolygon/Path geometry for badges, diamonds and brackets; draw them as pixel-space IconLayers (see decision below).
- NEW `src/features/map/lib/globeHorizon.js` (+ `__tests__/globeHorizon.test.js`): shader extension hiding a sprite whose anchor faces away or whose centre is outside the sphere's silhouette (monitor-reported limb leak).
- NEW `src/features/map/lib/globeIcons.js` (+ `lib/__tests__/globeIcons.test.js`): the generated icon atlas (canvas, white shapes, tinted per instance via `mask`) and the pixel sizes / offsets, kept out of the component so it is testable.
- `quality/verify_pages.sh`: guards that the badge / diamond / bracket layers are pixel-sized icon layers and that `degPerPx` / `pxPolygon` are gone.
- Docs (below). NOT touched: `docs/`, `docs/config.js`, `deploy.sh`, RadarMap, any Lambda / Worker.

**Root cause (measured before the fix):** (0) IconLayer drew nothing on GlobeView because GlobeView sets cullMode 'back' on every layer and IconLayer's vertex shader flips y (pixelOffset.y *= -1), reversing the quad's winding so every sprite is back-face culled; fixed with parameters.cullMode 'none' (proved by a run-time variant: no-depth / non-billboard / URL atlas all still drew nothing; cullMode none drew everything). (1) `degPerPx` = 360 / (0.85 * 512 * 2^z) ignores deck's GlobeViewport scale 2^(zoom - log2(pi * cos(viewLat))), so polygons were about 40% oversize and latitude dependent; (2) a polygon in lon/lat is a fixed patch of the sphere, so it can only be the right pixel size at one latitude / view angle, and it foreshortens toward the limb; (3) tiny geographic polygons tessellate/depth-test badly at `MARK_LIFT_M` (the detached triangles).

**Decision:** IconLayer billboards with a generated canvas atlas (white shapes, `mask` tint). Why: sizeUnits 'pixels' + getPixelOffset give exact constant size and offset at any zoom, latitude and during spin with no geometry rebuild; depth test hides the far side exactly like the dots; picking works on the alpha; one atlas, 5 layers. TextLayer rejected (is an IconLayer underneath, needs a font with ▲●◆▼ and a font atlas); ScatterplotLayer has no triangle/diamond; re-projecting polygons per frame would rebuild layers on every spin tick and keep tessellation artefacts.

**Docs to update on completion:**
- `CHANGES.md` entry; `project-docs/INDEX.md` row (added in phase 0).
- `project-docs/architecture/ARCHITECTURE.md`: the `SituationMap3D.jsx` row (line ~1650) if it describes the badge drawing; the R4a legend comment block in the component.
- This file: status `done`, tracker final.

**Completion checklist:**
- [x] code
- [x] docs updated (same working tree, no commit)
- [x] CHANGES.md entry
- [x] verify (`npm run verify`, `bash quality/verify_pages.sh`, Playwright at 1440x900 on the globe, before/after sizes)
- [x] status header flipped to `done`
- [x] no deploy, no commit: monitor verifies, commits and deploys

**Live tracker:**

| Phase | What | Status |
|---|---|---|
| 0 | Plan (this file, INDEX row) | done |
| 1 | Harness (Playwright, 15-marker fixture, pixel measurement) + BEFORE shots | done (`badge_shots/before*`) |
| 2 | Experiment: IconLayer invisible -> cullMode 'back' + y-flip winding | done |
| 3 | Implement + tests (globeIcons 8) + guards (verify_pages 92 pass) | done |
| 4 | AFTER shots + measurements, hover / click / far side / boot sensor | done (`badge_shots/after*`) |
| 4b | Monitor: lone sprite past the limb; GlobeHorizon extension (anchor facing + centre inside silhouette), live-data sweep 38 views / 270 sprites, 0 orphans | done |
| 5 | Docs (CHANGES, ARCHITECTURE, INDEX) + `npm run verify` (see CHANGES) | done |

**Measured (badge white-fill bbox, px; design = 9):** before 9-13 at every zoom, offset from the intended position 3-12 px, none matched within 12 px at lat 48; after 7-8 at zoom 2.2 / 3 / 4.4 / 5.8 and lat 39 / 48, offset 0.3-1.4 px.

**Known, not changed:** a selected marker's HUD bracket corner (box half-size ring+9) overlaps its own up-right badge (centre ring+6) by design of the approved numbers; the bracket draws on top. The live 55 px detached triangle was not reproduced locally.
