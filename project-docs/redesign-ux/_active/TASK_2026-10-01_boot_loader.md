## Boot loader (Option B, shared utility) — 2026-10-01 — done

**Goal:** Replace the bare "Loading…" screens with the operator-approved "Option B" loading animation (a wireframe globe with a rotating radar sweep and a SENSOR STATUS list), built as ONE shared `BootLoader` so the pre-JS `index.html` boot, the App `Suspense` fallback and the map home all look the same. Ticks are real (a sensor flips only when its data actually arrived); failures are honest with a real RETRY. No deploy, commit or push in this task; the monitor verifies, commits and deploys.

**Decisions (mine, flagged for the operator):**
- Colours (operator ruling, 2026-10-01): ONLY the site's existing tokens; no new theme, no dark/light switch, no `prefers-color-scheme`. Dark tone = the console tokens (`.gp-console`: `--c-bg #070d15 / --c-accent #5fd4ff / --c-warn / --c-text-head / --c-text-dim / --c-hairline / --c-panel-2` for the filled globe / `--c-mono`); light tone = the light shell tokens (`--paper / --ink / --ink-dim / --line / --accent / --paper-2`). The mockup hexes (`#070a0f`, `#5eead4`, `#fdba74`, `#0f2233`) were approximations and are NOT used. The static copy in `index.html` cannot read CSS vars before the CSS loads, so `BootLoader.css` carries token-value fallbacks (`var(--c-bg, #070d15)`) and `quality/boot_tokens_guard.mjs` (run by `verify_pages.sh` + a vitest) fails if any fallback drifts from `tokens.css` or a literal colour appears.
- The failure state shows RETRY plus a second button (OPEN ANYWAY): the spec asks for a real retry AND that data that did load is never hidden behind another sensor's failure, so the visitor can always open the console (which then shows its existing honest status line).
- The loader shows once per page load on `/`; returning to `/` from another page in the same session skips it (the console just re-mounts).
- Static boot is injected by a tiny inline script (not written in the HTML body) so no-JS readers and non-rendering crawlers still see only the `<noscript>` content, never "CONNECTING".
- The slow-network note counts from PAGE LOAD when the visitor was already watching the full pre-JS boot (`staticBoot.js` `bootWaitedMs`), so React mounting does not restart the 8 s clock.
- Sweep phase is derived from `performance.now() % 2600` in both the static and React copies, so the handoff has no visible rotation jump.

**Reads / references:**
- `CLAUDE.md`; `project-docs/playbooks/TASK_TEMPLATE.md`; `REDESIGN_MASTER_PLAN.md`; `project-docs/distribution/WORKER_FULL_CODE.md` (bots get the Worker's own HTML for pre-rendered paths, and only the plain SPA shell otherwise; unchanged).
- `src/app/App.jsx`, `src/app/layout/Layout.jsx` + `.css`, `src/shared/styles/tokens.css` (`.gp-console` block), `src/features/map/SituationHome.jsx` + `.css`, `hooks/useWorld.js`, `api/worldData.js`, `components/RadarMap.jsx`, `components/SituationMap3D.jsx`, `src/shared/data/useGeminiTopics.js`, `src/shared/api/errorSink.js`, `index.html`, `quality/verify_pages.sh`.

**Changes (code):** (under `global-perspectives-starter/frontend/` unless noted)
- NEW `src/shared/ui/boot/BootLoader.jsx` (+ `BootLoader.css`, `staticBoot.js` handoff helper, `index.js`): the component.
- NEW `src/shared/ui/boot/__tests__/bootLoader.test.jsx` (states, slow note with fake timers, failure + retry, no ticks without props, handoff).
- NEW `src/features/map/lib/bootSensors.js` (+ `lib/__tests__/bootSensors.test.js`): the three sensors derived from real signals.
- `src/shared/data/useGeminiTopics.js`: add a `settled` flag (first load finished, either way); `refetch` clears it.
- `src/features/map/hooks/useWorld.js`: add `retry()` (re-runs the fetch with `loading` true again); an aborted (superseded) load no longer flips `loading` off while its replacement is in flight (found by the Playwright timeline: the Disaster sensor flashed NOT LOADED under StrictMode).
- `src/features/map/components/RadarMap.jsx`, `SituationMap3D.jsx`: optional `onFirstDraw` (and deck `onError` -> `onDrawError`) so the Map sensor ticks only on a real first draw.
- `src/features/map/SituationHome.jsx`: mounts the BootLoader with the three sensors, reports failures to the error sink (`reportFetchError`), Retry re-runs the failed loads, crossfade to the console; globe `Suspense` fallback becomes the compact loader.
- `src/app/App.jsx`: `Suspense` fallback -> `RouteFallback` (full dark + sensors waiting on `/`, compact light elsewhere); layout effect removes the static boot node.
- `index.html`: inline boot CSS + a tiny script that builds `#gp-boot` (full+sensors on `/`, compact elsewhere) + `<noscript>` safety + module-script `onerror`.
- NEW `quality/boot_tokens_guard.mjs` + NEW `src/shared/ui/boot/__tests__/indexHtmlBoot.test.js`, `src/features/map/__tests__/bootSensorsWiring.test.jsx`: colour-token drift guard, index.html/CSS mirror check, SituationHome sensor wiring.
- `index.html` also carries a head listener `#gp-boot-err` (Vite drops `onerror` on the module tag).
- `src/features/map/SituationHome.css`: phone control row (extra phase 3b, operator request): the five chips ran off the left edge at 390/360 ("gh", "Rad", "Country risk" wrapping); under `max-width: 899.98px` the row anchors both edges, wraps to two rows, chips stay nowrap and 44px tall. Desktop unchanged.
- `quality/verify_pages.sh`: guards (no bare "Loading…" fallback, no timer ticks, reduced-motion rule, index.html boot node + removal on mount).
- Docs (below). NOT touched: `docs/`, the Worker, `docs/config.js`, `deploy.sh`.

**Docs to update on completion:**
- `CHANGES.md` entry; `project-docs/INDEX.md` row (added in phase 0).
- `project-docs/architecture/ARCHITECTURE.md`: frontend shared ui / loading section + the map-home row.
- `project-docs/redesign-ux/_active/REDESIGN_MASTER_PLAN.md` build status.
- This file: status `done`, tracker final.

**Completion checklist:**
- [x] code
- [x] docs updated (same working tree, no commit)
- [x] CHANGES.md entry
- [x] verify (`npm run verify`, `bash quality/verify_pages.sh`, Playwright at 1440 + 390, production-build pre-JS check)
- [x] status header flipped to `done`
- [x] no deploy, no commit: monitor verifies, commits and deploys

**Live tracker:**

| Phase | What | Status |
|---|---|---|
| 0 | Plan (this file, INDEX row) | done |
| 1 | Shared component + tests | done (BootLoader 17, index.html 6, sensors 5, wiring 4 = 32 tests) |
| 2 | index.html static boot + handoff | done |
| 3 | Map sensor wiring + Suspense fallback | done (full suite 905+ green) |
| 3b | Phone control row clipped at 390/360 (operator addition) | done |
| 4 | Browser checks (Playwright 1440 / 390, dev + prod build) | done (shots in the session scratchpad `boot_shots/`) |
| 5 | Docs (CHANGES, ARCHITECTURE, master plan, INDEX) + guards | done (`verify_pages.sh` 85 pass; `npm run verify` 121 files / 911 tests) |

**Measured (gzip):** main JS 133,365 -> 135,059 (+1.7 KB); CSS 14,175 -> 15,215 (+1.0 KB); `index.html` 3,088 -> 5,856 (+2.8 KB); SituationHome chunk +0.56 KB.
