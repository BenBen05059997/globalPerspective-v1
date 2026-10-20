## Colour consistency: map home and map page — 2026-10-19

Status: active — steps C1-C7 are in the code (the remaining literals are outside the map); four small bugs found on the way are open.

Rules (decided; decisions/0013, 0022, 0023): crisis TYPE is the only hue (dot, left stripe, type label); a risk tier is a number, a word and a ring weight, never a colour (neutral `--tier-*`); `--warn`, `--ok`, `--error` mean a state only; one accent (cyan) for links, focus and selected; hues are defined once in `shared/styles/tokens.css` / `tokens.js` and imported by every map renderer. Hues picked 2026-10-19 (option A): conflict `#ee7754`, humanitarian `#d987e0`, economic `#8fd46a`, `--error` `#f2689a`.

### State in the code (read 2026-10-19)
- C1 done: `TierChip` has no `hue` prop and reads the neutral tier tokens only; no `tierHue` remains.
- C2 done: the crisis hues are defined in `tokens.css` / `tokens.js`.
- C5 done: the re-picked hues above are the token values.
- C6 done in the code: the radar is one sweep per visit plus "happening now" breathing (`shared/map/radar.js`, a "Scan again" control in `MapLegend.jsx`; window 12 h, at most 5, decisions/0023). Not re-checked in a browser for this edit.
- C3 done 2026-10-20: the globe land fill, land borders and marker keyline are tokens (`--map-land`, `--map-land-line`, `--map-land-line-dim`, `--map-edge`, mirrored in `tokens.js`); no off-token colour is left in `features/map/**`. `shared/map/**` keeps two on purpose: the white sprite-atlas mask in `globeIcons.js` (deck.gl tints it per mark, so it must be white) and the `#rrggbb` formatter in `legend.js`.
- C4 done (checked 2026-10-20): `--ok` is the one green (sensor dot), `.sh-new` uses `--accent`, and stale / paused / escalating all use `--warn`.
- C7 done 2026-10-20: `--lower` run; `quality/color_literals_baseline.json` counts 68 hex, 4 functional, 1 template and 8 token-copy literals (it was 314 before, 5 RGB-array went to 0); none are in `features/map/**`; the ratchet only falls.

### Open
None of C1-C7; the items below are the open bugs.

Found on the way, not re-checked since the audit (verify before fixing): map labels clip at the right edge ("Guam, Northern M…") and the Europe cluster labels overlap; the home shows the same stories in the Alerts list and the Intel feed; the globe texture `/textures/earth-night.jpg` may 404 in production because the release copies only built assets (check `scripts/prepare-site-assets.mjs`); the country list "Highest Risk" rail should sort by score, not tier then article count (`features/countries/CountryListPage.jsx`).

Each step is small, browser-checked locally, and shipped only with the operator's yes for the release.
