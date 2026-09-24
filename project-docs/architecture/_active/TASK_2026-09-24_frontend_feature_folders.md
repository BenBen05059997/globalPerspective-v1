<!--
Task file per project-docs/playbooks/TASK_WORKFLOW.md (+ TASK_TEMPLATE.md). Spans the whole
frontend restructure programme (P0-P12); outlives any single phase commit. Executor: flip
this file's header to `done` only after P12 (or the operator-approved stopping phase) lands
and every "Docs to update" item below is staged in that phase's commit or the final commit.
-->

## Frontend feature-folder restructure — 2026-09-24 — active

**Goal:** Reorganize `global-perspectives-starter/frontend/src/` (193 files, flat
`components/`/`hooks/`/`utils/`/`services/`) into `app/` + `shared/` + 13 `features/`
directories, per the approved design, so a feature's code lives in one directory instead of
being reconstructed from imports every session. No behavior change — pure move + import-path
rewrite, phase by phase, one commit per phase, fully reversible with `git revert`.

**Reads / references:**
- `project-docs/architecture/REPO_RESTRUCTURE_DESIGN_2026-09-24.md` — source of truth: full
  193-file mapping table (§2.3), ambiguous-file calls (§2.4), cross-feature edges (§2.5),
  backend decision (§2.6), phase plan (§3), risk register (§4).
- `project-docs/architecture/_active/FRONTEND_RESTRUCTURE_EXECUTION_PLAN.md` — the
  phase-by-phase executable plan (this task's actual instructions).
- `project-docs/playbooks/TASK_TEMPLATE.md`, `project-docs/playbooks/TASK_WORKFLOW.md` —
  task-file convention this file follows.
- `CLAUDE.md` — verify gate (`npm run verify`), browser click-through rule, deploy gate
  (fresh "yes" every time), push-after-verify standing rule.
- `.githooks/pre-commit` — blocks a commit touching `frontend/src/**` without a `CHANGES.md`
  entry; reminds (non-blocking) about this task file's "Docs to update" list once staged code
  matches its "Changes (code)" list below.
- `.githooks/pre-push` — runs `quality/verify_all.sh --fast` when the diff range touches
  economic-layer files (regex includes `atoms/(Mechanism|Disruption|Severity|Quality)`,
  `EconomyPage`, `Home.jsx`, `DailyPage`, `ThreadPage`, `CountryPage`, `CountryListPage`,
  `WeeklyPage`, `Layout.jsx`, `Disclosures`, `quality/`) — P0 hardens this regex to
  basenames only; every later phase's commit will likely trigger it.
- `quality/verify_pages.sh` — Layer-7 per-page grep guards; P0 hardens `must_not_have` to fail
  on a missing file instead of silently passing.
- `global-perspectives-starter/frontend/vite.config.js`, `package.json` — P1 adds the `@/`
  resolve alias here; `npm run verify` = `eslint . && vitest run`.

**Changes (code):**
- `global-perspectives-starter/frontend/src/**` — every file moved per the design's §2.3
  mapping table (see the execution plan for the literal per-phase file lists; this task file
  does not repeat all 193 rows).
- `global-perspectives-starter/frontend/vite.config.js`, new
  `global-perspectives-starter/frontend/jsconfig.json` (P1: `@` alias).
- New `global-perspectives-starter/frontend/scripts/move-module.mjs` (P1 helper).
- `.githooks/pre-push` (P0: basename-only trigger regex).
- `quality/verify_pages.sh` (P0: hardened `must_not_have`; every phase after P2: path updates
  as files referenced by guards move).
- `scripts/auth-guard-check.mjs` (P0: basename-based hook resolution instead of fixed
  `src/hooks/`).
- `global-perspectives-starter/frontend/eslint.config.js` (or equivalent) — P11: add
  `no-restricted-imports` for `@/components/*`, `@/hooks/*`, `@/utils/*`, and
  `shared/** → features/**`.
- Deletions (P0, operator-approved): `utils/topicMatch.js`, `hooks/useCountrySignal.js`,
  `test/useCountrySignal.test.js`, `components/atoms/MacroChip.jsx` (+ its rule in
  `atoms.css`), `assets/react.svg`.

**Docs to update on completion:**
- `project-docs/architecture/ARCHITECTURE.md` — new "Frontend Path map" (old→new, added
  incrementally P2 onward, per phase) + new "Feature → Lambda index" table (added P2) +
  import-convention note (`@/` alias, P1) + Key Components/Hooks tables get a "Path" column
  (P11).
- `project-docs/INDEX.md` — row for this task/design doc set (P12).
- `CHANGES.md` — one dated entry per phase commit (pre-commit hook blocks without it).
- `project-docs/architecture/SYSTEM_WIRING.md` — any frontend path references that are
  path-qualified (not bare basenames) go stale; fix in the phase that moves them.
- `project-docs/architecture/PAGES_GUIDE.md` — same; also gets a final pass in P11.
- `project-docs/architecture/BUG_PLAYBOOK.md` — line referencing `components/ErrorHandling.jsx`
  (P2); confirm whether it also documents `verify_pages.sh` guard mechanics (update if P0
  changes that mechanic).
- `project-docs/architecture/AGENT_REVIEW_METHOD.md` — line ~168, `src/components/` grep
  example → update to reflect the new tree (P2).
- Domain `_active` plan docs with path-qualified frontend references, touched in the phase
  that moves the relevant files: `MAP_HOME_SITUATION_PLAN.md` /
  `MAP_HOME_SITUATION_LEDGER.md` / `MAP_UI_FIX_QUEUE.md` (P5), `POLAR_BILLING_PLAN.md` (P6),
  `QWEN_AND_VISUAL_BLOCK_PLAN.md` (P7), `ECONOMY_BRIEFING_PLAN.md` (P8),
  `PAIR_ARCS_RELOCATION_PLAN.md` (P11). Grep each phase's diff for `_active/` doc hits before
  closing that phase's commit — the execution plan's per-phase table is the starting list, not
  exhaustive.
- `README.md` — "where things live" table (P12).
- Operator auto-memory (`~/.claude/projects/.../memory/*.md`) — lazy pass, P12 only (basenames
  don't change, so only path-qualified mentions need touching; low priority).
- This task file's own header (`active` → `done`) and the design doc's status line, in the
  final phase's commit (or the commit that closes the operator-approved stopping point, e.g.
  P1 if only P0+P1 is approved).

**Completion checklist:**
- [ ] Operator decisions recorded (execution plan §0) before P0 starts
- [ ] P0 — orphans deleted, guards hardened, verified with `npm run verify` + `verify_pages.sh`
- [ ] P1 — `@/` alias + `jsconfig.json` + codemod to absolute imports + `move-module.mjs` helper,
      bundle-hash identical to pre-phase build
- [ ] P2 — `app/` + `shared/` moved; ARCHITECTURE path map + Feature→Lambda index started
- [ ] P3 — `static` + `spider-demo` moved
- [ ] P4 — `weekly-brief`, `daily`, `track-record` moved
- [ ] P5 — `map` moved
- [ ] P6 — `breaking` + `account` moved
- [ ] P7 — `analysis-studio` moved (N-file Node-tooling checks pass)
- [ ] P8 — `economy` moved (N-file Node-tooling checks pass)
- [ ] P9 — `home` moved (N-file Node-tooling checks pass)
- [ ] P10 — `countries` moved
- [ ] P11 — `threads` moved; old flat dirs deleted; eslint `no-restricted-imports` rule added
- [ ] P12 — README + INDEX + memory pass; task file and design doc flipped to `done`
- [ ] Every phase: docs updated in the same commit, `CHANGES.md` entry present, `npm run verify`
      passes with the expected test count, build hash compared, `verify_pages.sh` green, browser
      click-through done for the moved feature's routes
- [ ] No deploy performed as part of this task (deploy needs a separate fresh "yes" each time)
