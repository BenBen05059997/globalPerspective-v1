<!--
Task file per project-docs/playbooks/TASK_WORKFLOW.md (+ the "Task files + pre-commit
doc-guard" section it now carries). Standalone task file (spans the whole architecture
domain, outlives a single plan doc). First file written under the new task-file convention.
-->

## Cleanup execution (Tier A + Tier B + newsStripeWebhook deletion) — 2026-09-24 — done

**Goal:** Execute `CLEANUP_AUDIT_2026-09-24.md` §4 Tier A (safe-delete, no build needed) and
Tier B (safe-delete, requires `npm run build` verify) in full, plus the operator-approved
deletion of `amplify/backend/function/newsStripeWebhook/` (Tier D1, decided: delete). Tier C
and the remaining Tier D items (D2 SNS topic, D3 pair-arcs) were OUT OF SCOPE — untouched.

**Reads / references:** `project-docs/architecture/CLEANUP_AUDIT_2026-09-24.md` §4 (source of
truth for the exact file/action lists).

**Changes (code / repo):**

Tier A (commit `4c264f2`, no build needed):
- A1: `amplify/backend/function/linkedInAutoPost/` removed (was entirely untracked/gitignored —
  node_modules + stale zip; nothing was in git, so `rm -rf`, not `git rm`)
- A2: `test-gemini.js` `simple-prompt.js` `index.html` `package-lock.json` (repo root) +
  `global-perspectives-starter/get-pip.py` — `git rm`
- A3: `aws s3 rm --recursive s3://globalperspective-world-280362093938/shadow/` — 6 objects
- A4: `newsAnalyze-sandbox` Lambda env `GROK_MODEL` `deepseek-chat` → `deepseek-v4-pro`
  (merge-not-clobber; verified live)
- Plus (Tier D1): `git rm -r amplify/backend/function/newsStripeWebhook/` (8 tracked files)

Tier B (commit `a7e1c75`, build-verified; deploy deferred):
- B1: frontend sweep — 20 files removed (10 components: ApiKeyGate, BriefingCard,
  CountryGrouping, PerspectiveComparison, SectionNav, SideNav, LoadingStates, MiniMap,
  ArticleCard, MapSidePanel; `WorldMap.jsx` + `WorldMap.css` [pre-V2, NOT WorldMapV2]; 5 hooks:
  usePrediction, useSummary, useBookmarks, useResearchBriefing, useTraceCause;
  `utils/geocoding.js`; `services/appsyncProxy.js`; `SummaryDisplay.css`). Every file re-grepped
  for importers immediately before deletion — all zero.
- B2: `git rm -r src/` (root legacy Amplify scaffold, 5 tracked + 2 gitignored files)
- B3: `npm uninstall aws-amplify @aws-amplify/api-graphql` (212 packages removed, `npm ls`
  clean, removal-only package.json diff)

**Docs updated (in the same commits as the code):**
- `ARCHITECTURE.md`: §10 linkedInAutoPost note corrected; §12 newsStripeWebhook note
  (removal by operator decision); naming-traps line; component count 67→58, hook count 34→29;
  struck rows for BriefingCard / WorldMap.jsx / MapSidePanel + the 5 removed hooks; "no longer
  routed" prose + contentService caller list updated
- `README.md:24` — root one-off list reconciled to actual removal
- `CHANGES.md` — dated entries for both commits
- `CLEANUP_AUDIT_2026-09-24.md` §4 — Tier A/B rows + D1 marked EXECUTED
- `INDEX.md` — CLEANUP_AUDIT row status updated

**Completion checklist:**
- [x] Tier A actions A1-A4 executed (commit `4c264f2`)
- [x] Tier B actions B1-B3 executed (commit `a7e1c75`)
- [x] newsStripeWebhook directory removed
- [x] `npm run build` passes (frontend, post B1/B2/B3; only 3 pre-existing unrelated warnings)
- [~] Browser click-through — N/A: pure dead-code deletion (every file confirmed zero-importer),
      no rendered surface changes; the build + full test suite are the operative gate here
- [x] Test suite run — `npx vitest run` 235/235 across 19 files; WorldMapV2's 3 tests re-run in
      isolation 42/42 (component deliberately kept)
- [x] No deploy performed (deferred to next gated `./deploy.sh` — dead-code deletion produces an
      identical bundle)
- [x] ARCHITECTURE.md updated — same commits as code
- [x] README.md:24 updated — same commit as code
- [x] CHANGES.md entries added — same commits as code
- [x] CLEANUP_AUDIT_2026-09-24.md §4 status marks updated — same commits as code
- [x] INDEX.md row updated — same commit as code
- [x] This task file's status header set to `done`
- [x] Committed (`4c264f2`, `a7e1c75`); push handled by monitor via account switch
