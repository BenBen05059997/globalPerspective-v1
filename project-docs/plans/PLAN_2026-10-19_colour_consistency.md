## Colour consistency: map home and map page — 2026-10-19

Status: active — steps C1-C6 are in the code; C7 (colour ratchet) still has a baseline to bring down, and four small bugs found on the way are open.

Rules (decided; decisions/0013, 0022, 0023): crisis TYPE is the only hue (dot, left stripe, type label); a risk tier is a number, a word and a ring weight, never a colour (neutral `--tier-*`); `--warn`, `--ok`, `--error` mean a state only; one accent (cyan) for links, focus and selected; hues are defined once in `shared/styles/tokens.css` / `tokens.js` and imported by every map renderer. Hues picked 2026-10-19 (option A): conflict `#ee7754`, humanitarian `#d987e0`, economic `#8fd46a`, `--error` `#f2689a`.

### State in the code (read 2026-10-19)
- C1 done: `TierChip` has no `hue` prop and reads the neutral tier tokens only; no `tierHue` remains.
- C2 done: the crisis hues are defined in `tokens.css` / `tokens.js`.
- C5 done: the re-picked hues above are the token values.
- C6 done in the code: the radar is one sweep per visit plus "happening now" breathing (`shared/map/radar.js`, a "Scan again" control in `MapLegend.jsx`; window 12 h, at most 5, decisions/0023). Not re-checked in a browser for this edit.
- C3/C4/C7 partly done: `quality/color_literals_baseline.json` counts 68 hex, 4 functional, 1 template, 5 RGB-array and 8 token-copy literals (it was 314 before); the ratchet only falls.

### Open
| # | Change |
|---|---|
| C3 | Remaining off-token surfaces, text and borders in `features/map/**` and `shared/map/**` move to tokens; one selected style (accent outline). |
| C4 | One green (`--ok`); "new" uses the accent; one amber (`--warn`) for stale, paused and escalating. |
| C7 | Lower the baseline with `--lower` as literals go (`quality/check_color_literals.mjs`). |

Found on the way, not re-checked since the audit (verify before fixing): map labels clip at the right edge ("Guam, Northern M…") and the Europe cluster labels overlap; the home shows the same stories in the Alerts list and the Intel feed; the globe texture `/textures/earth-night.jpg` may 404 in production because the release copies only built assets (check `scripts/prepare-site-assets.mjs`); the country list "Highest Risk" rail should sort by score, not tier then article count (`features/countries/CountryListPage.jsx`).

Each step is small, browser-checked locally, and shipped only with the operator's yes for the release.
