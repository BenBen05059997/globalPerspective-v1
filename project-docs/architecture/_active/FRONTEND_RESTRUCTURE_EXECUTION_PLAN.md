<!--
Status: EXECUTABLE PLAN, not yet approved to run. Companion to
project-docs/architecture/_active/TASK_2026-09-24_frontend_feature_folders.md (the task-file
wrapper) and project-docs/architecture/REPO_RESTRUCTURE_DESIGN_2026-09-24.md (the design this
plan operationalizes — read that first for rationale; this doc is the literal how-to).

Tree re-verified 2026-09-24 against the design: `find frontend/src -type f | wc -l` = 193,
identical to the design's count, and `git log a6407d3..HEAD -- frontend/src` is empty (zero
frontend/src commits since the design's evidence snapshot). No design-vs-tree discrepancy
found — the design's file mapping in §2.3 is current and this plan uses it as-is.
-->

# Frontend Restructure — Execution Plan

## §0 Operator decisions needed BEFORE P0

Do not start P0 until these are answered. Each has a recommended default (design's
recommendation, or this plan's where the design left it open) — if the operator gives no
answer, the executor implements the default and notes that choice in the P0 commit message and
in the "Progress ledger" Notes column, per the parent CLAUDE.md rule ("implement the
recommended default and leave the choice configurable rather than hard-coding a guess" —
adapted here to "implement the recommended default and record the choice, since this is an
org/naming decision, not a runtime config knob").

**(a) Scope: full P0–P12, or P0+P1 only?**
- Recommended default: **full P0–P12.** The design's §5 argument against doing this
  incrementally ("two conventions for months") is the deciding factor for a solo-dev repo
  that's read mostly by agents reconstructing context every session.
  Fallback if 14–17h isn't available now: **P0+P1 only** (~3h) — independently valuable
  (hardened guards + absolute imports), and every later phase becomes a 30-minute mechanical
  step whenever picked up. This plan's phase sections work identically either way; a partial
  run just stops after P1 and the task file stays `active` with a note of where it stopped.

**(b) Delete the 5 orphans (P0)?**
- Files: `utils/topicMatch.js`, `hooks/useCountrySignal.js`, `test/useCountrySignal.test.js`,
  `components/atoms/MacroChip.jsx` (+ its rule block in `atoms.css`), `assets/react.svg`.
- Recommended default: **yes, delete all 5.** Re-verify zero-importer status immediately before
  deleting (grep commands below) — do not trust the design's evidence blindly since it's a
  point-in-time claim, even though it was re-checked as current in this plan's header note.
  Verification commands (run from `global-perspectives-starter/frontend/src`):
  ```
  grep -rn "topicMatch" .. --include=*.{js,jsx} | grep -v "utils/topicMatch.js"
  grep -rn "useCountrySignal" .. --include=*.{js,jsx} | grep -v "hooks/useCountrySignal.js\|test/useCountrySignal.test.js"
  grep -rn "MacroChip" .. --include=*.{js,jsx,css}
  grep -rn "react.svg" .. --include=*.{js,jsx,html}
  ```
  Each must return zero hits outside the file itself before deleting. If any grep returns a
  hit, stop and flag it — do not delete that file, and record why in the P0 commit.

**(c) DisruptionRow.jsx / DisruptionPreview.jsx (test-only, no production importer) — keep or delete?**
- Recommended default: **keep, move them to `features/economy/components/` as planned (P8).**
  Rationale: unlike the P0 orphans, these have deliberate test coverage
  (`atoms_economic.test.jsx`) and `verify_pages.sh` QualityFlag-wiring guards that assert
  something about them on purpose — they read as a parked/kept UI kit, not accidental dead
  code. Deleting them is a separate decision with its own blast radius (drop the guard rows in
  `verify_pages.sh`, drop the test assertions, decide whether the "kit" concept is still
  wanted) that shouldn't ride along with a pure-move programme. If the operator instead says
  delete: do it as an explicit P0-adjacent step (not silently inside P8), with the
  `verify_pages.sh` QualityFlag guard rows for both files removed in the same commit.

**(d) Ambiguous-home files (Δ) — confirm the design's calls as defaults:**
| File | Default (design's call) | Alternative, if operator overrides |
|---|---|---|
| `WeeklyPage.css` (3,074 lines) | `features/threads/WeeklyPage.css`, unsplit | Extract shared selectors to `shared/styles/editorial.css` — **not in this programme**, record as follow-up only |
| `AIComponents.css` | `features/home/AIComponents.css`, unsplit | same follow-up note as WeeklyPage.css |
| `hooks/useGeminiTopics.js`, `utils/contentService.js` | `shared/data/` | `features/home/` (rejected: would make `shared/ui/IntelligenceLoader` import a feature, breaking the one dependency rule) |
| `hooks/useMarketsCountry.js` | `features/economy/hooks/` | `features/countries/hooks/` (its only consumer is CountryPage) |
| `components/atoms/SourceRobustness.jsx` vs `utils/sourceRobustness.js` | `shared/ui/SourceRobustness.jsx` vs `features/analysis-studio/lib/sourceRobustness.js` | none — this split is load-bearing: names differ only by case, **must never share a directory** on case-insensitive macOS |
| `components/atoms/atoms.css` (737 lines) | `shared/ui/atoms.css`, unsplit | Split per-atom — not in this programme |
| `test/causalGraph.test.jsx`, `test/macroValues.test.js` | `features/countries/__tests__/` | none proposed |
| `test/redesign.test.jsx` | `test/integration/redesign.test.jsx` | none proposed |
- Recommended default for the whole row: **accept the design's calls as-is**, since each has a
  stated reason in the design's §2.4 and none is reversible-for-free later (moving again is
  just another `git mv`, so accepting now isn't high-risk).

**(e) Legacy Python prototype (`global-perspectives-starter/{agent,backend,global-perspectives-batch,tests}`, `requirements.txt`, `test_gemini.py`) — archive, delete, or leave?**
- Recommended default: **leave untouched, out of scope for this plan.** It has zero live
  references (confirmed in the design's evidence pass) and is explicitly a separate cleanup
  decision, same class as the CLEANUP_AUDIT Tier D items. Do not fold it into P0–P12 even if
  approved — if the operator approves archiving/deleting it, that becomes its own task file
  (e.g. a CLEANUP_AUDIT-style entry), not a phase here, so its history/verification doesn't mix
  with the feature-folder move's revert points.

**(f) Deploy cadence: once at the end, or after risky phases?**
- Recommended default: **no deploy during the programme; one optional deploy at the very end,
  gated by a fresh operator "yes" as always.** Every phase is designed to be a pure move (bundle
  hash identical pre/post), so there's no behavior change to ship incrementally — deploying
  mid-programme adds a deploy-gate interruption for zero user-facing benefit. If the operator
  wants a safety-net deploy after a specific risky phase (P8 economy, P11 threads — the two
  with the most inbound edges / N-files), that's a fine override; note it in that phase's
  ledger row. `git push` after each phase's verify passes is still the standing rule (separate
  from deploy) and happens every phase regardless.

---

## §1 Ground rules

1. **One phase = one commit.** Never combine two phases in one commit, never split one phase
   across two commits (except a same-phase fix-up commit if verify fails and you need a second
   commit to correct it — see Stop conditions).
2. **`git mv` only.** Never `rm` + re-`Write` a file that's being relocated — that breaks
   `git log --follow` and whole-file `git blame`. New files (e.g. `move-module.mjs`,
   `jsconfig.json`) are the only legitimate plain `Write`s in this programme, plus the P0
   deletions (which use `git rm`, not `git mv`).
3. **No filename renames.** Every moved file keeps its exact basename — this is the
   "relocate, never rename" invariant the whole plan leans on for doc/grep survivability.
4. **`CHANGES.md` entry in every commit.** The pre-commit hook blocks a commit touching
   `frontend/src/**` without one (`.githooks/pre-commit` `CODE_RE`). Write the entry before
   attempting the commit, not after a failed attempt.
5. **Stop conditions — revert the phase commit and stop, then report, don't improvise past
   these:**
   - Any verify step (`npm run verify`, build, `verify_pages.sh`, Node tooling checks, browser
     click-through) fails and the fix isn't obviously in-phase-scope (i.e., the fix would touch
     files outside this phase's file list).
   - Test count drops from the pre-phase count (a test silently stopped being discovered —
     R9 in the design). **Exception:** a drop exactly equal to the test cases in a test file
     the phase *intentionally deletes* (only P0: `test/useCountrySignal.test.js`) is expected —
     record the pre-phase count and that file's case count, and require
     `post == pre − deleted_cases` exactly. Any other drop is a stop.
   - Build succeeds but the bundle hash differs from the pre-phase build **and** a diff of the
     prettified bundles shows more than import/comment reordering (i.e., an actual logic
     change slipped in).
   - A browser click-through finds a regression (blank page, console error introduced by the
     move, broken route).
   - Revert with `git revert <phase-sha>` (never `git reset --hard` on a shared branch without
     explicit operator sign-off), then stop and report what broke before attempting the phase
     again.
5b. **Bundle-hash note (monitor, verified after P0):** `vite.config.js` injects `__BUILD_SHA__` (git short sha) and `__BUILD_DATE__` via `define`, so the main bundle's filename hash changes on EVERY commit even with no code change. **Never treat a hash change alone as a signal.** The per-phase check is instead: (i) main-bundle byte size equals the pre-phase size (±a few bytes for the sha string), and (ii) if size differs, prettify both bundles and diff with the sha literal masked — only import-order/module-id churn is acceptable. Pre-P0 and post-P0 main bundle: **1,046.07 kB**.

6. **Never deploy or touch `amplify/` Lambda paths** as part of this programme. §2.6 of the
   design is final: backend paths are out of scope. If a phase's grep sweep surfaces a
   Lambda-side comment referencing a moved frontend path (e.g. `riskDimensions.js` mentioning
   `src/utils/riskTiers.js`), leave it — R6 in the design, update both copies together at the
   next real deploy of those Lambdas, not here.
7. **Push after each phase's verify passes** — standing rule from `CLAUDE.md`
   ("`git push` is allowed once verify/hooks pass"). Push at the end of every phase commit, not
   batched at the end of the programme, so `git worktree`/other-branch collisions (R5) surface
   early.
8. **Worktree check before every phase (from P1 on):** `git worktree list` must show no other
   worktree/branch with in-flight frontend edits. At design time there were 0 side branches
   ahead of main — re-check this is still true immediately before each phase, since sessions
   may be long-lived.

---

## §2 Per-phase sections

Each phase follows this shape: goal → exact file list → relative-import exceptions (if any) →
verification commands in order → browser click-through checklist → docs/scripts/hooks to
update in the same commit → rollback → estimated time.

All paths below are relative to `global-perspectives-starter/frontend/src/` unless they start
with a repo-root directory. "N" marks a file that must keep relative imports (Node tooling
outside `src/` imports it by relative path — see P1 and design R3).

### P0 — Pre-flight: delete orphans + harden guards

**Goal:** Make the guard system fail loudly instead of silently before any file moves, and
remove confirmed dead code so it doesn't get carried into a feature folder.

**File list:**
- Delete (after §0(b) re-verification), 5 files via `git rm`: `utils/topicMatch.js`,
  `hooks/useCountrySignal.js`, `test/useCountrySignal.test.js`,
  `components/atoms/MacroChip.jsx`, `assets/react.svg`. Plus edit (not delete)
  `components/atoms/atoms.css` to remove the MacroChip rule block.
- Edit `quality/verify_pages.sh`: change `must_not_have()` so a missing target file is a
  **FAIL**, not a silent PASS (currently `grep` on a nonexistent file returns non-match →
  treated as "pattern absent" → PASS). Add an explicit file-existence check ahead of the grep:
  if `[ ! -f "$file" ]`, fail with a distinct message ("target file does not exist") rather
  than reusing the "pattern not present" PASS message.
- Edit `.githooks/pre-push`: change the trigger regex from path-fragment matching
  (`atoms/(Mechanism|Disruption|Severity|Quality)`) to basename-only matching
  (`(MechanismCard|Disruption(Row|Preview)|SeverityBadge|QualityFlag)`), so the verifier still
  triggers after these files move out of `components/atoms/`.
- Edit `scripts/auth-guard-check.mjs`: change hook resolution from a fixed `src/hooks/` path
  assumption to a basename search under `src/` (however the script currently locates hook
  files — read it first, then generalize the lookup, don't rewrite unrelated logic).

**Relative-import exceptions:** none (no files move directories in P0, only deletions/edits).

**Verification commands, in order:**
1. `cd global-perspectives-starter/frontend && npm run verify` — record the test count.
   Expect 193 files minus the deleted orphan's test cases (the design's baseline is "16 files /
   193 tests" before P0 deletions — confirm actual pre-P0 numbers by running verify once before
   touching anything, since this plan doesn't hard-code a number that might already be stale).
2. `npm run build` — must succeed; this phase doesn't move code so the bundle should be
   byte-identical modulo the two orphan files' code disappearing from the bundle (expected, not
   a stop condition).
3. `bash quality/verify_pages.sh` — after the P0 hardening, this must still be green (nothing
   it currently guards was deleted) and the negative WeeklyPage guard must now be provably
   "checked", not vacuously passing.
4. `node scripts/auth-guard-check.mjs` — must pass after the basename-search generalization.
5. `git log --follow -- <each deleted file>` sanity check is not applicable (deletions, not
   moves) — instead confirm `git status` shows exactly the 5 deletions + atoms.css edit +
   verify_pages.sh + pre-push + auth-guard-check.mjs edits, nothing else.

**Browser click-through:** none required — P0 touches no rendered feature, only guard
tooling and dead code. Optional sanity: load `/` and `/map` once to confirm nothing visibly
broke (MacroChip/topicMatch/useCountrySignal had zero importers, so this should be a no-op).

**Docs/scripts/hooks to update in this commit:**
- `CHANGES.md` — entry describing the orphan deletions (list all 5) and the guard hardening.
- `project-docs/architecture/ARCHITECTURE.md` — remove any rows that reference the deleted
  files, if present (grep `topicMatch|useCountrySignal|MacroChip|react.svg` against
  ARCHITECTURE.md first; likely none, but check).
- `project-docs/playbooks/BUG_PLAYBOOK.md` — if it describes the `verify_pages.sh`
  `must_not_have` mechanic, update to reflect the hardened (fail-on-missing-file) behavior.

**Rollback:** `git revert <P0-sha>`.

**Estimated time:** 1–1.5 h.

---

### P1 — Tooling: `@/` alias + absolute imports, no file moves

**Goal:** Make every later phase a one-string-per-file rewrite instead of a relative-path
puzzle, and build the move helper.

**File list (edits, no moves):**
- `global-perspectives-starter/frontend/vite.config.js` — add
  `resolve: { alias: { '@': path.resolve(__dirname, 'src') } }` (import `path` and `url` as
  needed for ESM `__dirname` equivalent, matching the existing `execSync` import style already
  in this file). Vitest shares this config's `resolve` block automatically since `test` is
  defined in the same `defineConfig` call, so `vi.mock('@/…')` resolves without extra config.
- New `global-perspectives-starter/frontend/jsconfig.json`:
  ```json
  { "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } }, "include": ["src/**/*"] }
  ```
  (for editor/cclsp go-to-definition; has no runtime effect).
- Codemod every relative import in `src/` (`import`, `export … from`, `vi.mock('…')`, dynamic
  `import('…')`) to `@/…`, **except**:
  - The **N** files (list below) — leave every import statement inside them relative, and
    leave the import *of* them from elsewhere as whatever the codemod produces (external
    imports of an N file are fine to be absolute; it's the N file's own outgoing imports, and
    Node tooling's imports of the N file, that must stay relative).
  - Intra-feature relative imports that Node tooling also depends on transitively, e.g.
    `utils/disruptionGate.js → ../data/economicAnalogs.js` — keep that specific edge relative
    even though `disruptionGate.js` itself is N.
- `test/redesign.test.jsx` — switch its `../../tests/fixtures/*.json` relative import to a
  `@fixtures` alias; add that alias alongside `@` in both `vite.config.js` and
  `jsconfig.json` (`'@fixtures': path.resolve(__dirname, 'tests/fixtures')`).
- New `global-perspectives-starter/frontend/scripts/move-module.mjs`: takes `<old-path>
  <new-path>` (relative to `src/`), does `git mv`, rewrites every `@/<old-path-without-ext>`
  specifier occurrence across `src/**` (including inside `vi.mock('@/…')` strings and dynamic
  `import('@/…')` strings) to `@/<new-path-without-ext>`, then prints a grep of remaining
  references to the old path in: `project-docs/**/_active/**` and `project-docs/**/*.md` files
  NOT under `_shipped/_legacy/_reference` (live docs only — historical docs are deliberately
  left stale per the design's R4), `quality/**`, `scripts/**`, `.githooks/**`,
  `.claude/skills/**`, `agent-kit/**`. This script is the workhorse every phase P2–P11 calls
  per file (or in a loop over that phase's file list).

**N files (must keep relative imports; used by Node tooling outside `src/`) — mark with a
one-line header comment `// imported by Node tooling outside src/ — keep relative imports` at
the top of each:**
- `utils/composeTopicsLede.js` (home)
- `utils/composeEconomyBriefing.js`, `utils/disruptionGate.js`, `data/economicAnalogs.js`
  (economy)
- `services/llm.js`, `utils/analysisPrompt.js`, `utils/analysisValidator.js`,
  `utils/analysisStruct.js` (analysis-studio)

**Verification commands, in order:**
1. `cd global-perspectives-starter/frontend && npm run verify` — test count must equal P0's
   post-deletion count exactly.
2. `npm run build`, then `ls dist/assets/index-*.js` and compare the hash against the P0
   post-build hash. **This is the critical check for P1**: a pure specifier rewrite must
   produce byte-identical (or at least logic-identical) output. If the hash differs, diff the
   prettified bundles (`npx terser --format ... ` or any JS beautifier, whatever's already
   available in the repo — check `package.json`/`node_modules/.bin` first rather than adding a
   new dependency) and confirm the only differences are import ordering / comments, not logic.
3. `bash quality/verify_pages.sh` — must stay green (no files moved directories yet, only
   import syntax changed).
4. `node scripts/auth-guard-check.mjs`.
5. Run every Node-tooling consumer of an N file, to prove they still resolve after the
   surrounding non-N files switched to `@/`:
   - `node quality/briefing/verify_compose.mjs`
   - `node quality/briefing/verify_lede.mjs`
   - `node quality/briefing/verify_instrument_why.mjs`
   - `node global-perspectives-starter/frontend/scripts/test-disruption-gate.mjs` (with a scan
     file if one is required by its CLI, or at minimum confirm it imports without a resolution
     error)
   - An import-smoke check for `quality/analysis/*.mjs` (5 files importing `llm.js` and
     `analysis*` utils): `node -e "import('./quality/analysis/check.mjs')"` -style checks for
     each of `check.mjs`, `compare.mjs`, `judge.mjs`, `run.mjs`, `source_check.mjs`.
6. `npm run dev` and load a handful of routes across different features (`/`, `/map`,
   `/economy`, `/weekly`, `/analyze`) to confirm nothing broke — this phase changes every
   file's import lines, so a broad spot-check is warranted even though no directory moved.

**Browser click-through:** spot-check `/`, `/map`, `/economy`, `/weekly`, `/weekly/countries`,
`/daily`, `/analyze`, `/account`, `/breaking`, `/track-record` — confirm each loads with no
console error. Full per-feature click-throughs happen in their own phase (P3–P11); this is a
broad regression check because P1 touches literally every file's import lines.

**Docs/scripts/hooks to update in this commit:**
- `CHANGES.md` — entry describing the alias addition + codemod + N-file marking + helper
  script.
- `project-docs/architecture/ARCHITECTURE.md` — add a "Frontend imports" note under the
  Frontend section: `@/` alias convention, N-file exception, pointer to this plan.
- `CLAUDE.md` (repo root, "Project Structure" or "Layout" section) — one line noting the `@/`
  alias exists and where it's defined.

**Rollback:** `git revert <P1-sha>`.

**Estimated time:** 2 h.

---

### P2 — `app/` + `shared/`

**Goal:** Lay down the two non-feature directories every feature will depend on, before any
feature moves.

**File list — `app/`:**
| Current | Destination |
|---|---|
| `App.jsx` | `app/App.jsx` |
| `App.css` | `app/App.css` |
| `index.css` | `app/index.css` |
| `bootstrapProxy.js` | `app/bootstrapProxy.js` |
| `components/Layout.jsx` | `app/layout/Layout.jsx` |
| `components/Layout.css` | `app/layout/Layout.css` |
| `components/AIToast.jsx` | `app/layout/AIToast.jsx` |
| `components/LoadingBar.jsx` | `app/layout/LoadingBar.jsx` |
| `components/LoadingIndicators.css` | `app/layout/LoadingIndicators.css` |
| `components/ErrorHandling.jsx` | `app/errors/ErrorHandling.jsx` |
| `components/ErrorModal.jsx` | `app/errors/ErrorModal.jsx` |
| `onboarding/useOnboarding.js` | `app/onboarding/useOnboarding.js` |
| `onboarding/tours.js` | `app/onboarding/tours.js` |
| `onboarding/tour-theme.css` | `app/onboarding/tour-theme.css` |
| `test/routes.test.jsx` | `app/__tests__/routes.test.jsx` |

`main.jsx` does NOT move (`index.html:181` hard-codes `/src/main.jsx`).

**File list — `shared/`:**
| Current | Destination |
|---|---|
| `services/restProxy.js` | `shared/api/restProxy.js` |
| `services/errorSink.js` | `shared/api/errorSink.js` |
| `contexts/AuthContext.jsx` | `shared/contexts/AuthContext.jsx` |
| `contexts/ErrorContext.jsx` | `shared/contexts/ErrorContext.jsx` |
| `hooks/useGeminiTopics.js` | `shared/data/useGeminiTopics.js` |
| `utils/contentService.js` | `shared/data/contentService.js` |
| `hooks/useIsMobile.js` | `shared/hooks/useIsMobile.js` |
| `utils/threadPath.js` | `shared/lib/threadPath.js` |
| `utils/riskTiers.js` | `shared/lib/riskTiers.js` |
| `utils/countryMapping.js` | `shared/lib/countryMapping.js` |
| `utils/dateUtils.js` | `shared/lib/dateUtils.js` |
| `test/riskTiers.test.js` | `shared/lib/__tests__/riskTiers.test.js` |
| `test/utils.test.js` | `shared/lib/__tests__/utils.test.js` |
| `styles/tokens.css` | `shared/styles/tokens.css` |
| `tokens.js` | `shared/styles/tokens.js` |
| `components/atoms/atoms.css` | `shared/ui/atoms.css` |
| `components/atoms/EditorialShell.jsx` | `shared/ui/EditorialShell.jsx` |
| `components/atoms/StatusStrip.jsx` | `shared/ui/StatusStrip.jsx` |
| `components/atoms/SeverityBadge.jsx` | `shared/ui/SeverityBadge.jsx` |
| `components/atoms/DirectionArrow.jsx` | `shared/ui/DirectionArrow.jsx` |
| `components/atoms/SourceRobustness.jsx` | `shared/ui/SourceRobustness.jsx` |
| `components/Markdown.jsx` | `shared/ui/Markdown.jsx` |
| `components/IntelligenceLoader.jsx` | `shared/ui/IntelligenceLoader.jsx` |
| `components/IntelligenceLoader.css` | `shared/ui/IntelligenceLoader.css` |
| `components/CopyBriefing.jsx` | `shared/ui/CopyBriefing.jsx` |
| `components/ShareButtons.jsx` | `shared/ui/ShareButtons.jsx` |
| `components/atoms/RiskScorecard.jsx` | `shared/ui/risk/RiskScorecard.jsx` |
| `components/atoms/RiskScorecard.css` | `shared/ui/risk/RiskScorecard.css` |
| `components/atoms/RiskScoreBadge.jsx` | `shared/ui/risk/RiskScoreBadge.jsx` |
| `components/atoms/RiskDeltaPill.jsx` | `shared/ui/risk/RiskDeltaPill.jsx` |
| `test/riskScorecard.test.jsx` | `shared/ui/risk/__tests__/riskScorecard.test.jsx` |

Use `scripts/move-module.mjs` for every row above (loop over the table).

**Relative-import exceptions:** none of these files are N.

**Verification commands, in order:**
1. `npm run verify` — same test count as P1.
2. `npm run build` + bundle-hash compare against P1's build.
3. `bash quality/verify_pages.sh` — this phase moves `Layout.jsx`, so update its path
   reference in `verify_pages.sh` (`$SRC/components/Layout.jsx` → `$SRC/app/layout/Layout.jsx`)
   in this same commit before running the check.
4. `node scripts/auth-guard-check.mjs`.
5. `npm run dev`, click through every route (this phase touches app-level chrome that every
   page renders through — Layout, error boundary, onboarding — so a full route sweep is
   warranted, not just a feature-scoped one).

**Browser click-through:** load every route once (`/`, `/map`, `/economy`, `/weekly-markets`,
`/weekly`, `/weekly/thread/:id` (pick one live thread), `/weekly/countries`,
`/weekly/country/:name` (pick one), `/daily`, `/weekly-brief`, `/track-record`, `/breaking`,
`/signin`, `/account`, `/membership`, `/analyze`, `/about`, `/spider-demo`). Confirm: Layout
nav renders, error boundary doesn't fire spuriously, onboarding tour still launches on a fresh
localStorage/incognito profile, AIToast/LoadingBar still appear during a loading state on at
least one page.

**Docs/scripts/hooks to update in this commit:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — start the "Frontend Path map" (old→new) table;
  add the "Feature → Lambda index" table (from the design's §2.6, transcribed as-is — this is
  documentation only, no code/paths change on the Lambda side).
- `quality/verify_pages.sh` — `Layout.jsx` path.
- `quality/dashboard.js` lines ~155-156 — read first; the design says these reference economy
  atoms (moved in P8, not here) — confirm no change needed in P2, note if wrong.
- `.githooks/pre-push` — `Layout\.jsx` basename still matches the P0-hardened regex; confirm,
  no edit needed.
- `project-docs/architecture/PAGES_GUIDE.md`, `project-docs/architecture/SYSTEM_WIRING.md` —
  grep for path-qualified (not bare-basename) references to any file in this phase's table;
  fix each hit.
- `project-docs/playbooks/BUG_PLAYBOOK.md` line ~314 (`components/ErrorHandling.jsx` →
  `app/errors/ErrorHandling.jsx`).
- `project-docs/architecture/AGENT_REVIEW_METHOD.md` line ~168 (`src/components/` grep example
  → update to the new tree shape).
- Backend comments citing `src/utils/riskTiers.js` (in `newsCountryIntelligence` and
  `newsThreadAnalysis`'s `riskDimensions.js`, and `newsEmailSender`'s `renderDriftEmail.js`):
  **leave untouched** per design R6 — do not edit Lambda source in this programme.

**Rollback:** `git revert <P2-sha>`.

**Estimated time:** 2–3 h.

---

### P3 — `static` + `spider-demo`

**Goal:** Shakedown run for `move-module.mjs` on leaf features (no inbound edges from other
features).

**File list:**
| Current | Destination |
|---|---|
| `components/AboutContact.jsx` | `features/static/AboutContact.jsx` |
| `components/Contact.jsx` | `features/static/Contact.jsx` |
| `components/PrivacyTerms.jsx` | `features/static/PrivacyTerms.jsx` |
| `components/Disclosures.jsx` | `features/static/Disclosures.jsx` |
| `components/WhitepaperPage.jsx` | `features/static/WhitepaperPage.jsx` |
| `components/SpiderDemo.jsx` | `features/spider-demo/SpiderDemo.jsx` |
| `components/SpiderDemo.css` | `features/spider-demo/SpiderDemo.css` |
| `components/SpiderWorld.jsx` | `features/spider-demo/SpiderWorld.jsx` |

Note: `spider-demo` cross-imports `threads` (CompactTimeline, useNarrativeThread) and
`countries` (useSystemsAnalysis) — those targets haven't moved yet at P3, so SpiderDemo's
imports of them stay pointed at their pre-move `@/` paths (e.g. `@/hooks/useNarrativeThread`)
until P10/P11 move those specific files, at which point `move-module.mjs`'s specifier rewrite
(run during P10/P11) updates SpiderWorld/SpiderDemo's import lines too, since the helper
rewrites every occurrence of the old specifier repo-wide, not just within the moved file.

**Verification commands:** same 4-step sequence as P2 (verify, build+hash, verify_pages,
auth-guard-check), no Node-tooling step (no N files here).

**Browser click-through:** `/about`, `/contact`, `/privacy`, `/disclosures`, `/whitepaper`,
`/spider-demo`.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — append this phase's rows to the path map.
- `quality/verify_pages.sh` — the two `Disclosures.jsx` rows (path update, ×2 as noted in the
  design's phase table).
- Live docs: grep for path-qualified refs to any file in this table; the design notes none
  expected (basename-only citations) — verify, don't assume.

**Rollback:** `git revert <P3-sha>`.

**Estimated time:** 30 min.

---

### P4 — `weekly-brief`, `daily`, `track-record`

**Goal:** Small features, few inbound edges (home → track-record's hooks).

**File list:**
| Current | Destination |
|---|---|
| `components/DailyPage.jsx` | `features/daily/DailyPage.jsx` |
| `components/DailyPage.css` | `features/daily/DailyPage.css` |
| `hooks/useDailyBrief.js` | `features/daily/hooks/useDailyBrief.js` |
| `components/WeeklyBriefPage.jsx` | `features/weekly-brief/WeeklyBriefPage.jsx` |
| `components/WeeklyBriefPage.css` | `features/weekly-brief/WeeklyBriefPage.css` |
| `hooks/useWeeklyBrief.js` | `features/weekly-brief/hooks/useWeeklyBrief.js` |
| `components/TrackRecordPage.jsx` | `features/track-record/TrackRecordPage.jsx` |
| `components/TrackRecordPage.css` | `features/track-record/TrackRecordPage.css` |
| `hooks/useTrackRecord.js` | `features/track-record/hooks/useTrackRecord.js` |
| `hooks/useCorrectionsFeed.js` | `features/track-record/hooks/useCorrectionsFeed.js` |

**Verification commands:** standard 4-step sequence.

**Browser click-through:** `/daily`, `/daily/:dateKey` (pick a live date), `/weekly-brief`,
`/track-record`. Also load `/` (Home) since it imports `useTrackRecord`/`useCorrectionsFeed`
cross-feature — confirm Home's track-record widget still renders.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- `quality/verify_pages.sh` — `DailyPage.jsx` rows (×3 per the design's phase table).
- `scripts/auth-guard-check.mjs` — confirm `useDailyBrief` still resolves via the P0 basename
  lookup (should be automatic; verify, don't assume).

**Rollback:** `git revert <P4-sha>`.

**Estimated time:** 45 min.

---

### P5 — `map`

**Goal:** Situation map (2D + deck.gl 3D).

**File list:**
| Current | Destination |
|---|---|
| `components/SituationHome.jsx` | `features/map/SituationHome.jsx` |
| `components/SituationHome.css` | `features/map/SituationHome.css` |
| `components/SituationMap.jsx` | `features/map/components/SituationMap.jsx` |
| `components/SituationMap3D.jsx` | `features/map/components/SituationMap3D.jsx` |
| `hooks/useWorld.js` | `features/map/hooks/useWorld.js` |
| `services/worldData.js` | `features/map/api/worldData.js` |
| `utils/countryGeo.js` | `features/map/lib/countryGeo.js` |
| `utils/situationLabels.js` | `features/map/lib/situationLabels.js` |
| `assets/countries-110m.json` | `features/map/assets/countries-110m.json` |

**Verification commands:** standard 4-step sequence. Also confirm the deck.gl 3D view still
loads its topojson asset from the new `features/map/assets/` path (check for any
import-relative or `fetch()`-relative reference to `countries-110m.json` that the codemod
might not catch if it's not a JS `import` statement — e.g. a `new URL('./countries-110m.json',
import.meta.url)` pattern).

**Browser click-through:** `/map` — confirm both 2D and 3D view modes render, tooltips work,
situation labels appear.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- Live `_active` docs: `MAP_HOME_SITUATION_PLAN.md`, `MAP_HOME_SITUATION_LEDGER.md`,
  `MAP_UI_FIX_QUEUE.md` — grep each for path-qualified references to the moved files, fix.

**Rollback:** `git revert <P5-sha>`.

**Estimated time:** 45 min.

---

### P6 — `breaking` + `account`

**Goal:** Many inbound edges (app/layout → account's `useMembership`, app/layout → breaking's
`NotificationBell`; 6+ pages → account's SaveButton/FollowButton/SubscribeCard).

**File list — `breaking/`:**
| Current | Destination |
|---|---|
| `components/BreakingFeedPage.jsx` | `features/breaking/BreakingFeedPage.jsx` |
| `components/BreakingDetailPage.jsx` | `features/breaking/BreakingDetailPage.jsx` |
| `components/BreakingPage.css` | `features/breaking/BreakingPage.css` |
| `components/NotificationBell.jsx` | `features/breaking/components/NotificationBell.jsx` |
| `components/NotificationBell.css` | `features/breaking/components/NotificationBell.css` |
| `components/atoms/BreakingStrip.jsx` | `features/breaking/components/BreakingStrip.jsx` |
| `components/atoms/BreakingStrip.css` | `features/breaking/components/BreakingStrip.css` |
| `hooks/useNotifications.js` | `features/breaking/hooks/useNotifications.js` |
| `hooks/useBreakingAlert.js` | `features/breaking/hooks/useBreakingAlert.js` |

**File list — `account/`:**
| Current | Destination |
|---|---|
| `components/Account.jsx` | `features/account/Account.jsx` |
| `components/Account.css` | `features/account/Account.css` |
| `components/SignIn.jsx` | `features/account/SignIn.jsx` |
| `components/AuthCallback.jsx` | `features/account/AuthCallback.jsx` |
| `components/MembershipPage.jsx` | `features/account/MembershipPage.jsx` |
| `components/MembershipPage.css` | `features/account/MembershipPage.css` |
| `components/SaveButton.jsx` | `features/account/components/SaveButton.jsx` |
| `components/FollowButton.jsx` | `features/account/components/FollowButton.jsx` |
| `components/SubscribeCard.jsx` | `features/account/components/SubscribeCard.jsx` |
| `components/SubscribeCard.css` | `features/account/components/SubscribeCard.css` |
| `hooks/useMembership.js` | `features/account/hooks/useMembership.js` |
| `hooks/usePreferences.js` | `features/account/hooks/usePreferences.js` |
| `hooks/useSavedItems.js` | `features/account/hooks/useSavedItems.js` |

Note: `SignIn.jsx` and `AuthCallback.jsx` import `WeeklyPage.css` (still at its old path until
P11) — their import line gets rewritten by `move-module.mjs` only when `WeeklyPage.css` itself
moves (P11), same mechanism as the spider-demo note in P3. No special handling needed now.

**Verification commands:** standard 4-step sequence.

**Browser click-through:** `/breaking`, `/breaking/:id` (pick a live id), `/signin`,
`/auth/callback` (if testable without a real OAuth round-trip, at least confirm it renders),
`/account`, `/membership`. Also load 2-3 pages that embed SaveButton/FollowButton/SubscribeCard
(e.g. `/`, `/weekly`, `/track-record`) and confirm those widgets still render and are
clickable. Confirm the layout's NotificationBell (app chrome) still shows unread state.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- `POLAR_BILLING_PLAN.md` (`_active`) — 1 path reference per the design; grep and fix.
- `verify_pages.sh` — none expected per the design's phase table; confirm.

**Rollback:** `git revert <P6-sha>`.

**Estimated time:** 1 h.

---

### P7 — `analysis-studio`

**Goal:** N-file-heavy feature (`llm.js`, `analysisPrompt.js`, `analysisValidator.js`,
`analysisStruct.js` all feed `quality/analysis/*.mjs` Node tooling).

**File list:**
| Current | Destination |
|---|---|
| `components/AnalysisStudio.jsx` | `features/analysis-studio/AnalysisStudio.jsx` |
| `components/AnalysisStudio.css` | `features/analysis-studio/AnalysisStudio.css` |
| `components/ProviderModal.jsx` | `features/analysis-studio/components/ProviderModal.jsx` |
| `components/ProviderModal.css` | `features/analysis-studio/components/ProviderModal.css` |
| `components/atoms/AnalysisVisuals.jsx` | `features/analysis-studio/components/AnalysisVisuals.jsx` |
| `components/atoms/AnalysisVisuals.css` | `features/analysis-studio/components/AnalysisVisuals.css` |
| `services/llm.js` **N** | `features/analysis-studio/lib/llm.js` |
| `utils/analysis.js` | `features/analysis-studio/lib/analysis.js` |
| `utils/analysisPrompt.js` **N** | `features/analysis-studio/lib/analysisPrompt.js` |
| `utils/analysisValidator.js` **N** | `features/analysis-studio/lib/analysisValidator.js` |
| `utils/analysisStruct.js` **N** | `features/analysis-studio/lib/analysisStruct.js` |
| `utils/byok.js` | `features/analysis-studio/lib/byok.js` |
| `utils/sourceRobustness.js` | `features/analysis-studio/lib/sourceRobustness.js` |
| `test/analysisStruct.test.js` | `features/analysis-studio/__tests__/analysisStruct.test.js` |
| `test/analysisVisuals.test.jsx` | `features/analysis-studio/__tests__/analysisVisuals.test.jsx` |

**Relative-import exceptions:** `services/llm.js`, `utils/analysisPrompt.js`,
`utils/analysisValidator.js`, `utils/analysisStruct.js` are N — after moving, they keep their
existing relative-import header comment from P1; **their own internal imports of each other
and of anything else must stay relative**, but files elsewhere in `src/` that import *them* can
use `@/features/analysis-studio/lib/...` freely (only the N file's outbound imports and the
Node tooling's imports of the N file are constrained).

**Verification commands, in order:**
1–4. Standard sequence.
5. Node-tooling consumers, all 5 of `quality/analysis/{check,compare,judge,run,source_check}.mjs`
   (13 import lines total per the design) — run each script's smoke path or at minimum an
   import-resolution check. Read each file first to confirm the exact relative path it now
   needs (`../../global-perspectives-starter/frontend/src/features/analysis-studio/lib/llm.js`
   or similar) — **update these Node scripts' import paths in this same commit**, since they
   import `llm.js`/`analysis*` by relative path from `quality/analysis/`, and the file's
   directory changed even though its own internal imports stay relative.
6. `quality/analysis/README.md` — check for path references, update.

**Browser click-through:** `/analyze` — confirm provider modal opens, BYOK key entry works
(or at least renders without error if no key is configured), a full analysis run if API access
is available, visuals render.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- `quality/analysis/{compare,judge,run,check,source_check}.mjs` — update their relative import
  paths to `llm.js`/`analysisPrompt.js`/`analysisValidator.js`/`analysisStruct.js` (this is
  code, not just docs — do it in this commit since the pre-commit `CODE_RE` also matches
  `quality/[^/]*\.js`, though these `.mjs` files under `quality/analysis/` may not match that
  exact regex; check `CODE_RE` carefully — it's `quality/[^/]*\.js` which only matches direct
  children of `quality/`, not `quality/analysis/*.mjs`. These edits still need a CHANGES.md
  entry per the phase's own moved-file changes, so the commit is covered regardless).
- `quality/analysis/README.md`.
- `QWEN_AND_VISUAL_BLOCK_PLAN.md` (`_active`) — grep and fix path references.

**Rollback:** `git revert <P7-sha>`.

**Estimated time:** 1 h.

---

### P8 — `economy`

**Goal:** The widget kit + 3 more N files (`composeEconomyBriefing.js`, `disruptionGate.js`,
`economicAnalogs.js`), plus the most `verify_pages.sh`-guarded feature.

**File list:**
| Current | Destination |
|---|---|
| `components/EconomyPage.jsx` | `features/economy/EconomyPage.jsx` |
| `components/EconomyPage.css` | `features/economy/EconomyPage.css` |
| `components/WeeklyMarketsPage.jsx` | `features/economy/WeeklyMarketsPage.jsx` |
| `components/WeeklyMarketsView.jsx` | `features/economy/components/WeeklyMarketsView.jsx` |
| `components/WeeklyMarketsView.css` | `features/economy/components/WeeklyMarketsView.css` |
| `components/atoms/MechanismCard.jsx` | `features/economy/components/MechanismCard.jsx` |
| `components/atoms/InstrumentChip.jsx` | `features/economy/components/InstrumentChip.jsx` |
| `components/atoms/QualityFlag.jsx` | `features/economy/components/QualityFlag.jsx` |
| `components/atoms/DisruptionRow.jsx` | `features/economy/components/DisruptionRow.jsx` |
| `components/atoms/DisruptionPreview.jsx` | `features/economy/components/DisruptionPreview.jsx` |
| `components/atoms/Sparkline.jsx` | `features/economy/components/Sparkline.jsx` |
| `hooks/useDisruptionsList.js` | `features/economy/hooks/useDisruptionsList.js` |
| `hooks/useEconomicImpact.js` | `features/economy/hooks/useEconomicImpact.js` |
| `hooks/useTopMovers.js` | `features/economy/hooks/useTopMovers.js` |
| `hooks/useMarketsGlobal.js` | `features/economy/hooks/useMarketsGlobal.js` |
| `hooks/useMarketsHistory.js` | `features/economy/hooks/useMarketsHistory.js` |
| `hooks/useMarketsCountry.js` | `features/economy/hooks/useMarketsCountry.js` |
| `hooks/useWeeklyMarkets.js` | `features/economy/hooks/useWeeklyMarkets.js` |
| `utils/composeEconomyBriefing.js` **N** | `features/economy/lib/composeEconomyBriefing.js` |
| `utils/disruptionGate.js` **N** | `features/economy/lib/disruptionGate.js` |
| `data/economicAnalogs.js` **N** | `features/economy/data/economicAnalogs.js` |
| `data/economicAnalogs.json` | `features/economy/data/economicAnalogs.json` |
| `test/economyPage.test.jsx` | `features/economy/__tests__/economyPage.test.jsx` |
| `test/atoms_economic.test.jsx` | `features/economy/__tests__/atoms_economic.test.jsx` |
| `test/useEconomicImpact.test.js` | `features/economy/__tests__/useEconomicImpact.test.js` |

If §0(c) resolved to "delete DisruptionRow/DisruptionPreview", skip those two rows here and
instead `git rm` them + drop the corresponding `verify_pages.sh` QualityFlag guard rows +
`atoms_economic.test.jsx` assertions for them in this same commit.

**Relative-import exceptions:** `composeEconomyBriefing.js`, `disruptionGate.js`,
`economicAnalogs.js` are N. `disruptionGate.js`'s import of `../data/economicAnalogs.js` stays
relative and both files move together in this phase so that relative path
(`../data/economicAnalogs.js`) continues to resolve unchanged after the move (same relative
offset: `lib/disruptionGate.js` → `../data/economicAnalogs.js` → `data/economicAnalogs.js`,
identical structure at both the old and new location).

**Verification commands, in order:**
1–4. Standard sequence.
5. Node-tooling: `node quality/briefing/verify_compose.mjs`, `node
   quality/briefing/verify_instrument_why.mjs`, check `quality/briefing/assertions.js` for a
   path-reference comment that needs updating (not a functional import, per the design), and
   `node global-perspectives-starter/frontend/scripts/test-disruption-gate.mjs` (this imports
   `../src/utils/disruptionGate.js` by relative path from `frontend/scripts/` — update this
   script's own import path in this commit to `../src/features/economy/lib/disruptionGate.js`).
6. `e2e/economic.spec.js` — per the design this only references routes, so no path edit
   expected; confirm by reading it.
7. `verify_pages.sh` — this phase moves 6 atom files referenced by guards; update all 6 atom
   rows + the 4 `EconomyPage.jsx` rows (per the design's phase table) in this same commit
   before running the check.
8. `quality/dashboard.js` lines ~155-156 — this is the phase the design flags these lines as
   relevant (they were noted "no change needed in P2" specifically because they concern economy
   atoms moved here); read the lines and update if they hard-code an economy-atom path.

**Browser click-through:** `/economy`, `/weekly-markets`. Also `/`, `/daily`, `/weekly/thread/:id`
(pick one), `/weekly/country/:name` (pick one), `/weekly/countries` — confirm every page that
surfaces economic-disruption UI (MechanismCard, DisruptionRow/Preview, SeverityBadge via
economy data, QualityFlag) still renders it correctly, since economy is the most
cross-feature-imported widget kit in the app.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- `quality/verify_pages.sh` — 6 atom rows + 4 `EconomyPage.jsx` rows.
- `quality/dashboard.js` lines ~155-156.
- `quality/briefing/verify_compose.mjs`, `verify_instrument_why.mjs`, `assertions.js` (comment).
- `global-perspectives-starter/frontend/scripts/test-disruption-gate.mjs` (relative import
  path).
- `ECONOMY_BRIEFING_PLAN.md` (`_proposed`) — grep and fix.

**Rollback:** `git revert <P8-sha>`.

**Estimated time:** 1.5 h.

---

### P9 — `home`

**Goal:** Topics page + the lede composer (N).

**File list:**
| Current | Destination |
|---|---|
| `components/Home.jsx` | `features/home/Home.jsx` |
| `components/Home.css` | `features/home/Home.css` |
| `components/AIComponents.css` | `features/home/AIComponents.css` |
| `components/TopicNav.jsx` | `features/home/components/TopicNav.jsx` |
| `components/TopicNav.css` | `features/home/components/TopicNav.css` |
| `components/TodayArchiveSidebar.jsx` | `features/home/components/TodayArchiveSidebar.jsx` |
| `components/TodayArchiveSidebar.css` | `features/home/components/TodayArchiveSidebar.css` |
| `components/ArchiveTopicModal.jsx` | `features/home/components/ArchiveTopicModal.jsx` |
| `components/PredictionDisplay.jsx` | `features/home/components/PredictionDisplay.jsx` |
| `components/SummaryDisplay.jsx` | `features/home/components/SummaryDisplay.jsx` |
| `components/TraceCauseDisplay.jsx` | `features/home/components/TraceCauseDisplay.jsx` |
| `components/atoms/LedeBand.jsx` | `features/home/components/LedeBand.jsx` |
| `components/atoms/LedeBand.css` | `features/home/components/LedeBand.css` |
| `hooks/useTodayArchive.js` | `features/home/hooks/useTodayArchive.js` |
| `utils/composeTopicsLede.js` **N** | `features/home/lib/composeTopicsLede.js` |

**Relative-import exceptions:** `composeTopicsLede.js` is N.

**Verification commands, in order:**
1–4. Standard sequence.
5. `node quality/briefing/verify_lede.mjs` — update its relative import path to
   `composeTopicsLede.js`'s new location in this commit.
6. `verify_pages.sh` — 4 `Home.jsx` rows per the design's phase table.

**Browser click-through:** `/` — confirm topics feed, archive sidebar/modal, AI
summary/prediction/trace widgets, and the lede band all render.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- `quality/briefing/verify_lede.mjs` (import path).
- `quality/verify_pages.sh` — 4 `Home.jsx` rows.

**Rollback:** `git revert <P9-sha>`.

**Estimated time:** 1 h.

---

### P10 — `countries`

**Goal:** Cross-imports `threads` (still at its pre-move path until P11 — fine, since imports
are absolute `@/` after P1 and `move-module.mjs` will retarget them when threads moves).

**File list:**
| Current | Destination |
|---|---|
| `components/CountryListPage.jsx` | `features/countries/CountryListPage.jsx` |
| `components/CountryListPage.css` | `features/countries/CountryListPage.css` |
| `components/CountryPage.jsx` | `features/countries/CountryPage.jsx` |
| `components/CountryPage.css` | `features/countries/CountryPage.css` |
| `components/CountryOverviewMap.jsx` | `features/countries/components/CountryOverviewMap.jsx` |
| `components/BackgroundTimeline.jsx` | `features/countries/components/BackgroundTimeline.jsx` |
| `components/SystemsGraph.jsx` | `features/countries/components/SystemsGraph.jsx` |
| `components/SystemsGraph.css` | `features/countries/components/SystemsGraph.css` |
| `components/atoms/CountryWhatChanged.jsx` | `features/countries/components/CountryWhatChanged.jsx` |
| `components/atoms/CountryWhatChanged.css` | `features/countries/components/CountryWhatChanged.css` |
| `hooks/useCountryIntelligence.js` | `features/countries/hooks/useCountryIntelligence.js` |
| `hooks/useCountryHistory.js` | `features/countries/hooks/useCountryHistory.js` |
| `hooks/useSystemsAnalysis.js` | `features/countries/hooks/useSystemsAnalysis.js` |
| `utils/countryDrift.js` | `features/countries/lib/countryDrift.js` |
| `test/countryDrift.test.js` | `features/countries/__tests__/countryDrift.test.js` |
| `test/countryWhatChanged.test.jsx` | `features/countries/__tests__/countryWhatChanged.test.jsx` |
| `test/useSystemsAnalysis.test.js` | `features/countries/__tests__/useSystemsAnalysis.test.js` |
| `test/causalGraph.test.jsx` | `features/countries/__tests__/causalGraph.test.jsx` |
| `test/macroValues.test.js` | `features/countries/__tests__/macroValues.test.js` |

**Verification commands:** standard 4-step sequence. No N files.

**Browser click-through:** `/weekly/countries`, `/weekly/country/:name` (pick 2-3 different
countries to exercise the systems graph, background timeline, and what-changed widget across
different data shapes). Also confirm `/spider-demo` (which imports `useSystemsAnalysis`
cross-feature) still loads.

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — path map append.
- `quality/verify_pages.sh` — `CountryPage.jsx` ×3 rows, `CountryListPage.jsx` ×3 rows.

**Rollback:** `git revert <P10-sha>`.

**Estimated time:** 1 h.

---

### P11 — `threads`

**Goal:** Most inbound edges (countries, home, account/SignIn+AuthCallback all depend on
threads files) — goes last so it touches the fewest still-unmoved foreign files. Also the
programme's cleanup phase: delete the now-empty flat directories and add the enforcement
eslint rule.

**File list:**
| Current | Destination |
|---|---|
| `components/WeeklyPage.jsx` | `features/threads/WeeklyPage.jsx` |
| `components/WeeklyPage.css` | `features/threads/WeeklyPage.css` |
| `components/ThreadPage.jsx` | `features/threads/ThreadPage.jsx` |
| `components/ThreadPage.css` | `features/threads/ThreadPage.css` |
| `components/WeeklyMap.jsx` | `features/threads/components/WeeklyMap.jsx` |
| `components/WeeklyMap.css` | `features/threads/components/WeeklyMap.css` |
| `components/CompactTimeline.jsx` | `features/threads/components/CompactTimeline.jsx` |
| `components/StoryEntryCard.jsx` | `features/threads/components/StoryEntryCard.jsx` |
| `components/ThreadIntelligence.jsx` | `features/threads/components/ThreadIntelligence.jsx` |
| `components/ThreadForecast.jsx` | `features/threads/components/ThreadForecast.jsx` |
| `components/TrendBadge.jsx` | `features/threads/components/TrendBadge.jsx` |
| `hooks/useWeeklyArchive.js` | `features/threads/hooks/useWeeklyArchive.js` |
| `hooks/useThreadAnalyses.js` | `features/threads/hooks/useThreadAnalyses.js` |
| `hooks/useNarrativeThread.js` | `features/threads/hooks/useNarrativeThread.js` |
| `hooks/useThreadForecast.js` | `features/threads/hooks/useThreadForecast.js` |
| `utils/mapConstants.js` | `features/threads/lib/mapConstants.js` |

Also in this phase's commit:
- Delete the now-empty directories: `components/`, `hooks/`, `utils/`, `services/`,
  `contexts/`, `onboarding/`, `data/`, `assets/`, `styles/` (verify each is actually empty
  first — `find <dir> -type f` should return nothing; if anything remains, some earlier phase's
  file list was incomplete against the live tree — stop and reconcile before deleting).
- Add an eslint rule (`no-restricted-imports` or equivalent, in whatever config format this
  repo's `eslint.config.js` uses — check the existing file before adding) banning:
  - `@/components/*`, `@/hooks/*`, `@/utils/*` (the old flat-dir aliases; should now 404 since
    the dirs are gone, but the explicit lint rule gives a clear error message instead of a
    bare module-not-found)
  - Any `shared/**` file importing from `@/features/**` (enforces the one dependency rule:
    `app → features → shared`, `shared` never imports `features` or `app`).

**Verification commands, in order:**
1–4. Standard sequence — this is the largest single-phase file count remaining, so budget
   extra time for the build-hash diff if it's not clean.
5. `npm run verify` **after** adding the eslint rule — confirm it doesn't fire a false positive
   against any legitimate remaining import (feature→feature imports by direct path are
   allowed; only `shared→features` and the old flat-dir aliases are banned).
6. `verify_pages.sh` — `ThreadPage.jsx` ×3 rows, plus the WeeklyPage negative guard (the one
   R1 called out by name in the design — this is the guard P0 hardened; confirm it now
   correctly fails if `WeeklyPage.jsx` regains an economic import, by temporarily reintroducing
   one during verification if practical, or at minimum confirm the file-existence check added
   in P0 covers this row).
7. `scripts/auth-guard-check.mjs` — confirm `useWeeklyArchive`, `useThreadAnalyses` still
   resolve via basename lookup.

**Browser click-through:** `/weekly`, `/weekly/thread/:threadId` (pick 2-3 threads with
different data completeness), `/weekly/countries` (cross-import of WeeklyMap/useWeeklyArchive),
`/weekly/country/:name` (cross-import of useThreadAnalyses), `/signin`, `/auth/callback`
(cross-import of `WeeklyPage.css`), `/spider-demo` (cross-import of CompactTimeline,
useNarrativeThread).

**Docs/scripts/hooks to update:**
- `CHANGES.md`.
- `project-docs/architecture/ARCHITECTURE.md` — final path-map append; Key
  Components/Hooks tables get a "Path" column (per the design's phase-table note).
- `quality/verify_pages.sh` — `ThreadPage.jsx` ×3 rows, WeeklyPage negative guard path.
- `PAIR_ARCS_RELOCATION_PLAN.md` (`_active`) — grep and fix.
- `project-docs/architecture/PAGES_GUIDE.md` — final pass across the whole doc (not just
  threads-specific lines), since this is the last feature phase.

**Rollback:** `git revert <P11-sha>`. Note: reverting this phase also un-deletes the flat
directories and the eslint rule — confirm the revert is clean before re-attempting.

**Estimated time:** 1.5 h.

---

## §3 Final phase acceptance (after P11, before or as P12)

- [ ] `no-restricted-imports` eslint rule is active and `npm run verify` is clean under it.
- [ ] `components/`, `hooks/`, `utils/`, `services/`, `contexts/`, `onboarding/`, `data/`,
      `assets/`, `styles/` no longer exist under `src/`.
- [ ] `project-docs/architecture/ARCHITECTURE.md` has a complete old→new path table (all 193
      files, minus the 5 P0 deletions, covered across the phase-by-phase appends) and the
      Feature → Lambda index table.
- [ ] `project-docs/INDEX.md` has a row pointing at this plan + the design doc (P12).
- [ ] `CHANGES.md` has one entry per phase commit (12 phases + P0 = up to 13 entries, or fewer
      if §0(a) chose P0+P1-only).
- [ ] `README.md` "where things live" table added (P12).
- [ ] This task file (`TASK_2026-09-24_frontend_feature_folders.md`) header flipped from
      `active` to `done`, and the design doc's status line updated to reflect execution
      (e.g. "EXECUTED 2026-09-24 through <date>" in place of "DESIGN ONLY").
- [ ] Operator auto-memory lazy pass done (P12) — only path-qualified mentions, not every
      basename citation.
- [ ] No deploy has occurred as part of this programme unless the operator explicitly asked
      for one with a fresh "yes" at a specific phase (§0(f)).

---

## §4 Risk register (from the design's §4) — which phase's check catches each

| # | Risk | Caught by |
|---|---|---|
| R1 | Silent guard bypass (`verify_pages.sh` `must_not_have` passes on a missing file; pre-push trigger regex stops matching after atoms move out of `atoms/`) | P0 hardening (file-existence check, basename-only trigger regex); every phase's step-3/step-6 verify_pages run afterward is a loud FAIL instead of a silent PASS if something regresses |
| R2 | Import breakage incl. `vi.mock()` strings, dynamic `import()`, CSS `@import`, JSON imports | P1's codemod covers all specifier forms via `move-module.mjs`; each phase's `npm run verify` (vitest fails on a bad mock path), `npm run build` (Rollup fails on unresolved import), bundle-hash compare (wrong-but-resolvable import) |
| R3 | Node tooling imports frontend source by relative path; N-file marking could be "helpfully" converted to `@/` by a future edit | P1's N-file exclusion from the codemod + header comments; each N-touching phase's step-5 Node-consumer run (P7, P8, P9) |
| R4 | Stale path references in docs/scripts/skills | Relocate-never-rename keeps bare-basename citations valid; each phase's "Docs to update" list + `move-module.mjs`'s printed grep of remaining live-doc hits; final P12 sweep |
| R5 | Merge conflicts with parallel work (worktrees/other agents editing frontend files mid-programme) | §1 ground rule 8 (worktree check before every phase); keep phases short, don't leave one half-done overnight |
| R6 | Backend comments + `riskDimensions.js` shared-module pair drift | P2's explicit "leave backend comments untouched" decision; `check-shared-sync.mjs` isn't touched by this programme at all |
| R7 | `deploy.sh` assumptions break | Not applicable — verified in the design that nothing in `src/` moves affects `deploy.sh`'s `FRONTEND_DIR`/`dist/`/`docs/` logic or `index.html`'s `/src/main.jsx` reference; no phase-specific check needed, but §0(f) keeps deploys out of the programme entirely as a belt-and-braces |
| R8 | CSS cascade order changes if a "cleanup" reorders imports | `move-module.mjs` rewrites specifiers in place, never reorders lines (ground rule 2/3); bundle-hash compare in every phase catches CSS bundle reordering specifically |
| R9 | Test discovery drop (a test silently stops being picked up by vitest's glob) | Every phase's verify step 1 requires the test count to exactly match the pre-phase count; a drop is a stop condition (§1 ground rule 5) |
| R10 | Memory and skills drift | P12's lazy memory pass; `.claude/skills/onboard/SKILL.md` only cites ARCHITECTURE generically (confirmed, no direct frontend path) so needs no edit; `deploy-frontend` skill cites `frontend/src/` generically, no edit needed |

---

## §5 Progress ledger

| Phase | Status | Commit | Verify result | Notes |
|---|---|---|---|---|
| §0 decisions | done | — | — | Operator approved full P0–P12, all §0 defaults (see task file LIVE TRACKER header) |
| P0 | done | see CHANGES | verify: 193→184 tests (15 files, was 16; drop of 9 = deleted file's case count, exact match); build OK, bundle `index-Dt4Ycdco.js`→`index-ckwjjoRN.js` (size unchanged, byte-for-byte in the two unaffected chunks); `verify_pages.sh` 32/0 (hardening confirmed by injected-failure test); `auth-guard-check.mjs` PASS (7/7 hooks resolve via basename search); `test_pre_commit_hook.sh` 5/5 PASS | All 4 re-verification greps clean before deleting. Removed dangling `useCountrySignal` row from ARCHITECTURE.md hooks table. |
| P1 | done | see CHANGES | verify: 15 files / 184 tests (unchanged from P0); build: main bundle byte-identical (1,046,069 bytes, hash unchanged since no commit landed between builds); `verify_pages.sh` 32/0; `auth-guard-check.mjs` PASS; N-file Node-tooling consumers all resolve (verify_compose 5/5, verify_lede 4/4, verify_instrument_why 10/10, quality/analysis/{check,compare,judge,run,source_check}.mjs import-smoke clean, run.mjs 18/18; test-disruption-gate.mjs's JSON-import-attribute error confirmed pre-existing via git stash) | 364 specifiers rewritten across 98 files; 2 relative imports remain, both inside N files (disruptionGate→economicAnalogs, economicAnalogs→its .json), both expected exceptions. move-module.mjs written + tested against a throwaway tree copy (move, rewrite, leftover-grep, `_legacy` exemption all confirmed), real tree untouched by the test. |
| P2 | not started | — | — | — |
| P3 | not started | — | — | — |
| P4 | not started | — | — | — |
| P5 | not started | — | — | — |
| P6 | not started | — | — | — |
| P7 | not started | — | — | — |
| P8 | not started | — | — | — |
| P9 | not started | — | — | — |
| P10 | not started | — | — | — |
| P11 | not started | — | — | — |
| P12 | not started | — | — | — |
