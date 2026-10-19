## Site consistency and modernisation — 2026-10-19

Status: active — frontend waves 1-3 and the Lambda restructure are in the code; the back-end hygiene items below are open. The colour work for the map is `PLAN_2026-10-19_colour_consistency.md`.

Why: pages drifted apart again after the 2026-10-01 dark-site unification (own class prefixes per view, no shared primitives, only colour ratcheted). "Consistent" means every page builds the same thing the same way: the same tokens and the same shared blocks, and a colour has one meaning everywhere.

### Done (checked in the code 2026-10-19)
- Guards: `quality/check_color_literals.mjs`, `check_style_px.mjs`, `check_shared_blocks.mjs`, `check_feature_cycles.mjs`, run by pre-commit and `npm run verify`.
- Shared primitives in `src/shared/ui`: `Button`, `Tabs`, `Card`, `Chip`, `Tooltip`, `StoryPeek`, `TierChip` (no `hue`); `--ai-*` and `CATEGORY_BADGE_COLORS` are gone.
- Structure: feature `index.js` public APIs and no feature cycles (decisions/0024); react-router 7; the Python starter and Amplify scaffolding are gone.
- Back end: Lambdas grouped under `backend/<group>/<name>/`; `scripts/lambda.sh` + `scripts/functions.json` (diff, package, deploy, rollback); one shared `backend/shared/src/llm.js`; the Brave code paths removed from the three Lambdas that had no key (operator, 2026-10-19; deploy them to take effect).

### Open
- Node: 10 Lambdas still on `nodejs20.x` (end of life): `newsAnalyze`, `newsAnalyze-sandbox`, `newsDriftCorrector`, `newsEmailSender`, `newsModelGuard`, `newsPolarBilling`, `newsPolarBilling-sandbox`, `newsRecommend`, `newsWeeklyBrief`, `newsWeeklyMarkets` (`scripts/functions.json`). Move each to 22+ one at a time; `newsAnalyze` is deploy-blocked and the two `-sandbox` twins deploy through `backend/membership-studio/_sandbox/`, so ask first.
- Retired model default: `deepseek-v4-flash` is still the default string in `newsPostDevTo/src/index.js` (the live env value is what runs; `newsModelGuard` watches for it).
- `GROK_*` / `XAI_*` env names stay as they are (kept on purpose, `backend/shared/src/llm.js`); no rename is planned.
- Dead env keys (still live 2026-10-19): `XAI_API_KEY_BACKUP` and `OPENAI_API_KEY` (no code reads them) on `newsInvokeGemini-dev`, `NewsProjectInvokeAgentLambda-dev` and others; `BRAVE_SEARCH_API_KEY` / `BRAVE_CONCURRENCY` on `newsInvokeGemini-dev` (ingest no longer uses Brave); the unused social-platform secrets on `newsPostLinkedin` (zip-diff first). Secret env changes need the operator's yes per Lambda; fetch the full map, merge, write it back whole.
- Brave grounding: only `newsPredictionResolver` has a key and uses Brave.
- Frontend leftovers from the audit, not re-checked: hooks that copy the same storage + TTL fetch (a shared cached-query hook was proposed), global CSS class names defined in more than one feature, the unmaintained `@googlemaps/react-wrapper` dependency, repo-root `cli/` (a proxy command-line tool; confirm it is still wanted).
