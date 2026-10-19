## Site consistency and modernisation — 2026-10-19 — proposed (operator review)

Why: the operator sees pages drifting apart again after the 2026-10-01 dark-site unification, and asked for a whole-site check plus a modern, feature-organised structure for the front end, back end and repo. Method: 8 read-only audit agents (map reuse, Stories, countries/daily/brief, today/studio/briefings, foundation/shared/static, drift cause, front-end stack, back-end pipeline), plus a live computed-style pass over 12 routes in Chrome at 1440px. The colour plan for the map home is `PLAN_2026-10-19_colour_consistency.md`; this plan widens it to every page and the codebase.

### What "consistent" means here
Every page builds the same thing the same way: the same tokens (colour, type size, spacing, radius) and the same shared blocks (button, tabs, card, chip, tier chip, category tag, section header, story row, tooltip, loader). A colour has one meaning everywhere.

### Findings (evidence in the agent reports; key items spot-checked)
**Live pages:** the colour values themselves are mostly on tokens (11 of 12 routes show 0 off-token colours; the map home shows 7, e.g. navy `rgba(8,16,26,.7)` alert cards). The drift is in meaning, components and type:
- Type sizes per page: /daily 21 distinct font sizes, /today 17, /weekly-brief 15, /track-record 14 (off-scale values like 9.5, 10.5, 12.5, 13.5, 15.5px).
- One element, many builds: tier chip drawn 6+ ways; ~14 tab implementations; ~40-49 button classes; ~80 card classes; 6 tooltip styles; "selected" drawn 9 ways on Stories alone, 4 on Studio/Today.
- Meaning collisions: status colours used as categories (daily trajectory up=amber/down=green; timeline health=green; Studio run marker amber; briefings fact badge green); tier tokens used for sentiment/impact/direction; a second "AI" palette (`--ai-*`: trace = the same green as OK); crisis hues 1-5° from error/warn/accent.
- Leftover light theme: `threads/WeeklyPage.css` (story entry cards `#f9fafb`/`#fff`, Tailwind greys) and `CATEGORY_BADGE_COLORS` pastels (`shared/styles/tokens.js:94`) used on briefing slides and story entry cards. Not visible on the thread page's default view I checked; present in code paths.
- Real breakage: undefined tokens — `--space-md/lg/…` and `--font-size-*` (31 uses, `home/AIComponents.css`: chain/timeline/impact render unspaced), `--card-bg` (static/Whitepaper, transparent), `--font-mono`, `--ccv2-ink-dim`, `--text-2xs`.
- Bugs: country "Highest Risk" rail and featured list sort by tier then article count, and chips use a different tier source than the bands (`CountryListPage.jsx:41,87,185-189,205,296-303`); "Most likely: Most Likely" (`StoryMode.jsx:105`).

**Why it drifted (root causes):**
1. New views get their own class prefix (`sb-`, `sw-`, `sa-`, `sc-`) instead of extending shared blocks; nothing checks for copies.
2. `shared/ui` has domain blocks but no primitives (Button, Tabs, Card, Chip), so every page rolls its own.
3. Type, spacing and radius tokens exist but are not used or guarded (only colour is ratcheted).
4. The colour ratchet only stops increases: the 314 leftover literals were frozen, never cleaned; it misses named colours, RGB arrays, template-built colours, and token copies.
5. Checks run only via `npm run verify`; the pre-push hook runs them only for a list of economy files.
6. Shared props allow rule breaks (TierChip `hue`, StoryRow `tierHue`).

**Front-end structure (stack is current: React 19, Vite 7, Vitest 4, ESLint 9):**
- 38 data hooks in 4 patterns; ~20 copy-paste the same storage+TTL fetch; 14 have no abort guard.
- 56 global CSS files, 29 class names defined in more than one feature; 8 cross-feature CSS imports.
- ~80 cross-feature imports, 4 import cycles (threads<->map, countries<->threads, map<->countries, daily<->briefings).
- Behind: react-router 6 (v7 is an import rename); unmaintained `@googlemaps/react-wrapper` (a second map stack); unused `@chenglou/pretext`; dead restProxy exports.

**Back end and repo:**
- No Lambda deploy script: hand-built zips, rollback zips in scratchpads that vanish. 18 copies of the DeepSeek client; `placeFilter.js`/`dayZero.js` x6.
- 9 Lambdas on nodejs20.x (end of life); `newsInvokeGemini` ships aws-sdk v2 and an unused Gemini SDK (16.7 MB zip).
- Retired `deepseek-v4-flash` still the code default in ~12 Lambdas; `GROK_*`/`XAI_*` env names hold DeepSeek in 18 Lambdas; `newsInvokeGemini` runs DeepSeek.
- Dead: Amplify scaffolding outside `backend/function`, the Python starter in `global-perspectives-starter/`, `cli/`, several disabled rules. Three doc trees; one feature's code spread over 5-6 top-level folders.

### Plan (each step small, one commit, browser-checked; no deploy without the operator's yes)
**Phase 0 — guards first, so it cannot drift again (S)**
- Pre-commit runs the colour ratchet whenever frontend CSS/JSX is staged (<1s).
- Widen the colour check (named colours, RGB arrays, `0x`, template colours, token copies) and add a ratchet for raw font-size, radius and spacing.
- A copy check: fail on new hand-made tier chips/tabs/section headers outside `shared/ui`.

**Phase 1 — foundation (S-M)**
- Tokens: re-pick 3 crisis hues away from error/warn/accent (operator picks swatches); retire `--ai-*`, `CATEGORY_BADGE_COLORS`, the `app/index.css` alias layer and duplicate tokens; define or remove the undefined tokens; one type scale.
- New shared primitives: Button, Tabs/Segmented, Card, Chip; one Tooltip (StoryPeek); one "selected" style (accent outline).
- TierChip: remove `hue`/`tierHue`; collapse the 6 tier renderers into it.

**Phase 2 — pages, one feature at a time (M each)**
Map home (incl. the radar redesign C6/R1-R6) → Stories → Countries/Daily/Brief → Today/Studio/Briefings → Track record/Account/Static. Each: tokens only, shared blocks only, meaning fixes, the bugs above. Literal baseline falls each step.

**Phase 3 — front-end structure (S-M)**
`useCachedQuery` replaces the copied fetch hooks; delete dead code; move cross-feature modules (situationLabels, StoryMode, SaveButton/FollowButton) to `shared/` and break the cycles; each feature gets `index.js` as its public API; CSS modules only where class names collide; react-router v7.

**Phase 4 — back end and repo (S-L)**
- `scripts/lambda.sh <name> diff|deploy|rollback` + `functions.json` (feature, dir, deployed name, runtime, schedule); rollback zips kept locally.
- Replace retired model defaults; shared `llm.js` bundled into each Lambda at deploy; Node 20 → 22; drop aws-sdk v2.
- Rename `GROK_*`/`XAI_*` → `LLM_*` (env change with secrets: operator yes per Lambda).
- Archive dead folders; then group Lambdas, CLIs and docs by feature with one README each (largest move; last).

### Decisions for the operator
1. Radar "happening now" window (Claude recommends: changed in the last 12 hours, at most 5 — covers the latest 8-hourly brief but not yesterday).
2. Start order: Phase 0+1 then the map home (recommended), or another page first.
3. The 3 crisis hue swatches (Phase 1).
4. Phase 4 renames/moves and env renames: go/no-go each.
5. Parked jobs still running (markets data hourly, signals daily with no keys): keep or stop.
