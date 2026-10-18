## Colour consistency: map home and map page — 2026-10-19 — proposed (operator review)

Why: the operator sees the home (`/`) and map mixing yellow, red, orange and white with no clear meaning. Overnight audit 2026-10-18/19: a read-only code audit of the token system, a live-site pass in Chrome (desktop 1440×900; phone width could not be forced in that browser), and a cited good-practice guide. Raw reports (scratchpad, not in git): `ui_tokens_audit.md`, `ui_good_practice.md`, screenshots `home_before.jpg`, `risk_chips_before.png`, `risk_chips_after_neutral.png`, `home_after_neutral_chips.jpg`.

### What the site already decided (keep)
`shared/styles/tokens.css` (live 2026-10-01, DS1 in `REDESIGN_MASTER_PLAN §3.1`): hue = crisis TYPE only; risk tier = number + word + ring weight, **never a colour**; amber `--warn` = stale/paused, `--ok`/`--error` = a check passed/failed. The rules are right. The home page breaks them.

### What is wrong (evidence)
1. **Risk chips take the crisis colour on the home page.** `TierChip` accepts a `hue` prop (`shared/ui/TierChip.jsx:13`) and the map passes the crisis hue (`features/map/components/HudIntelFeed.jsx:58,101`, `HudCountryRiskFeed.jsx:34` via `.hud-tier-chip --pin`, `SituationHome.css:96-102`). So "HIGH"/"ELEVATED" is coral for conflict, amber for humanitarian, violet for political — it reads as a red/amber/purple severity scale, the exact thing DS1 forbids. `/weekly` and the country list show the same chips neutral, so the same word looks different on two pages. Live computed colours on `/`: `gp-tier` High/Elevated/Moderate in `#ee7754` and `#d89e28`.
2. **Crisis hues sit on top of the status colours.** conflict `#ee7754` vs `--error #ff6a4d` (4° apart); humanitarian `#d89e28` vs `--warn #ffb347` and the "older" label; economic `#38b6e0` vs the accent `#5fd4ff` (an economic country looks "selected"). The GDACS "RED ALERT" chip is drawn amber.
3. **Five yellows/oranges for four meanings** (`--warn`, humanitarian, `#ffb27a` escalating, `#f2d492` stale banner, `--run-hatch`) and **three greens** (`#6fd29a`, `#34d399`, `#7ee0b8`) for ok / live / new.
4. **About 20 surface colours in three tint families** in `SituationHome.css` (token teal-navy, a neutral grey-blue `#0d1017…`, a navy `rgba(8,16,26)…`), plus `.sh-root` and `.sh-console` rules giving the same control two backgrounds (`SituationHome.css:505-583`).
5. **Pure white / off-token whites**: `#fff` hover/outline/badge (`SituationHome.css:279,308`, `RadarMap.jsx:182,201`), `#dfe6f2` labels, `#eef5f9` brackets; "selected" is drawn three different ways.
6. **The four crisis hues are defined in four places** (`tokens.css/js`, `SituationMap.jsx:13`, `crisisHue.js:9`, `SituationMap3D.jsx:32`); neutral `#9aa4b2` hard-coded 8× next to `--tier-moderate`.
7. **The radar sweep** is the brightest object on the page (a solid cyan wedge across the map and markers).
8. The colour ratchet passes (314 = baseline) but cannot see deck.gl RGB arrays, named colours, or a literal that duplicates a token.

### Target rules (cited in `ui_good_practice.md`: Carbon, Primer, Atlassian, Radix, WCAG 2.2, Munzner)
- One surface ladder (`--bg`, `--panel`, `--panel-2`, `--panel-3`); no other surface values. One text ladder (`--text-head/body/muted/dim`); no `#fff`.
- One accent (cyan) for links, focus, selected. One "selected" style: accent outline.
- Status colours (`--warn`, `--ok`, `--error`) only for state, never for categories. One green.
- Crisis type = hue on the dot, the left stripe and the type label only. Tier = neutral chip everywhere (word, number, ring weight); on the map, tier = marker size + ring, as the Key already says.
- A crisis hue must not be confusable with a status colour or the accent (≥ 30° hue apart or clearly different lightness), colour-blind checked, ≥ 3:1 on the basemap.
- Hues defined once (tokens) and imported by every map renderer.

### Proposed steps (each small; nothing ships without the operator's go and a browser check)
| # | Change | Size | Needs a decision? |
|---|---|---|---|
| C1 | Tier chips neutral everywhere: drop the `hue` prop path from the map feeds (`HudIntelFeed`, `HudCountryRiskFeed`, `StoryRow` `tierHue`); GDACS alert chip neutral with the level word | S | no (restores DS1) |
| C2 | One hue source: map renderers import `--hue-*` from `tokens.js`; delete the 3 copies | S | no |
| C3 | Surfaces/text/borders in `SituationHome.css` and `RadarMap.jsx` → tokens; delete `.sh-root` duplicates; one selected style | M | no |
| C4 | One green (`--ok`), "new" uses the accent; one amber (`--warn`) for stale/paused/escalating | S | no |
| C5 | Re-pick 2 crisis hues off the status/accent colours: humanitarian off amber, economic off the accent cyan; conflict keeps a warm red but `--error` moves away from it or is not used on the map | S code, design choice | **yes — operator picks from 2–3 swatches** |
| C6 | Radar sweep at low opacity (or off by default) | S | yes (taste) |
| C7 | Ratchet: also count deck.gl RGB arrays and named colours; baseline must fall after C1–C4 | S | no |

C1 preview (live page with a local style override, nothing deployed): `risk_chips_before.png` → `risk_chips_after_neutral.png`, and `home_after_neutral_chips.jpg`. With neutral chips the colour left on the page is only the crisis type, and the alert list and feed read as one system.

### Found on the way (bugs, not colour)
- Country list "Highest Risk" rail sorts by tier then article count, not by score: United States (85) is listed above Ukraine (95) (`features/countries/CountryListPage.jsx:185-189`). S.
- Story page badge reads "Most likely: Most Likely (60%)": it prints the scenario's name, which is "Most Likely" (`features/threads/components/StoryMode.jsx:105`). Show the scenario's short description instead. S.
- Map labels clip at the map's right edge ("Guam, Northern M…"), and the Europe cluster labels overlap.
- Home shows the same stories twice (Alerts list left, Intel feed right).
- Globe night texture `/textures/earth-night.jpg` is 404 in production (deploy copies only `dist/assets` + `index.html`, `scripts/deploy-pages-legacy.sh:88-92`); the "Earth at night: NASA Black Marble" credit shows over a flat globe.
