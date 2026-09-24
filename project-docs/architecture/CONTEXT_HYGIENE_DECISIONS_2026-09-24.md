# Context hygiene decisions: 2026-09-24

Status: DECIDED (by the Opus decider, as the operator delegated). Nothing has been applied yet. Execution is the §4 plan.
Scope: every file that shapes a Global Perspectives (GP) Claude Code session. That means the CLAUDE.md chain, `.claude/` config and skills, the auto-memory directory, the agent-facing repo docs, and stray root files.
Method: I read every file below in full, or by section for the six memory "journals" over 12KB. I verified claims against the tree (`ls`, `git ls-files`, `grep`) and against the two fetched official docs cited in §1. I did not use live AWS. Where a decision depends on deployed state, the source is named.

---

## 1. Criteria (grounding)

From the official Claude Code memory docs (fetched 2026-09-24):

- **Load chain.** CLAUDE.md is loaded from the working directory and every ancestor directory, plus the user-level file. For cwd `/Users/benlai/Downloads/globalPerspective-v1`, that means `/Users/benlai/CLAUDE.md`, `/Users/benlai/Downloads/CLAUDE.md` and the repo `CLAUDE.md`. `~/.claude/CLAUDE.md` does not exist.
- **Contradictions.** "If two rules contradict each other, Claude may pick one arbitrarily. Review your CLAUDE.md files ... periodically to remove outdated or conflicting instructions."
- **Size.** "Target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence."
- **Exclusion.** "The `claudeMdExcludes` setting lets you skip specific files by path or glob pattern." It works at any settings layer. The docs' own example puts it in `.claude/settings.local.json`. It is non-destructive.
- **Context vs. enforcement.** Memory is "context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook."
- **Auto memory.** "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded at the start of every conversation." Topic files are read on demand. The index should hold one line per entry. Stale entries should be merged or dropped. Don't store what the repo already records.

From the prompting best-practices doc (fetched 2026-09-24):

- "Claude's latest models are trained for precise instruction following." They take instructions literally, so a stale imperative gets executed rather than second-guessed.
- "If your prompts were designed to reduce undertriggering ... these models may now overtrigger. The fix is to dial back any aggressive language. Where you might have said 'CRITICAL: You MUST use this tool when...'" you can now use normal phrasing.
- "Tune anti-laziness prompting ... dial back that guidance."

**Decision rules used below**

1. A file that states a current task, status or fact that is no longer true gets fixed or removed first. A literal model acts on it.
2. When two loaded sources contradict, keep exactly one: the newer and operator-confirmed one.
3. Anything duplicated across CLAUDE.md, a skill, memory and ARCHITECTURE.md lives in one place. The others link to it.
4. Hard rules that are already mechanized (`deploy.sh` hash-guard, pre-commit doc guard, pre-push verify, Stop hook) get one calm line in CLAUDE.md, not a CRITICAL block.
5. Memory keeps only non-derivable knowledge: operator preferences, gotchas, decisions and current status pointers. Build logs, schemas and file lists belong to the repo.

---

## 2. Findings ranked by behavioral impact

Each finding names the wrong behavior a current, literal model plausibly produces.

### F1. A parked billing task is framed as the "Active task", next to standing prod-AWS authorization (repo `CLAUDE.md`)

The `CLAUDE.md` section "Prod AWS Lambda deploys" says: "**Active task:** ship the analysis-credits feature to prod." It points to `project-docs/billing/_active/PROD_CREDITS_NEXT_STEPS.md`, whose title is "# NEXT TASK — ship analysis credits to production".

Memory records that credits were **PARKED 2026-07-06** (`project_credit_billing`, `project_member_gating`). It also records that prod `newsAnalyze` is a **prompt-patched deployed zip, not the repo file**, because the repo file carries the parked credits code (`project_analysis_studio`).

- **Wrong behavior:** a session that is told to "keep going" (per agent-kit) treats the loaded "Active task" as its assignment. The same section grants standing `update-function-code`/`update-function-configuration` authorization. The model can set `POLAR_CREDIT_PACKS`, then deploy repo `newsAnalyze`. That would put a parked paid feature live **and** overwrite the patched member-analysis Lambda, which is a regression plus a billing change.
- **Severity:** highest. It is irreversible-ish and touches billing.

### F2. Two foreign CLAUDE.md files load into every GP session

- `/Users/benlai/Downloads/CLAUDE.md` belongs to the **notetrail piano-room** project: Next.js, Supabase, Vercel, "Read this first, then `SPEC.md`". `SPEC.md` and `DATA-MODEL.md` also sit loose in `~/Downloads`.
  - Wrong behavior: the model goes looking for or reads `SPEC.md`, proposes Next.js/Supabase/Vercel patterns in a Lambda/DynamoDB/GitHub Pages repo, and applies notetrail's "non-negotiable principles", for example "Postgres is the single source of truth".
  - A concurrent notetrail session already fights GP for the gh account (`reference_github_account_switch`), so the projects are live side by side.
- `/Users/benlai/CLAUDE.md` is generic. It uses tool names absent from the current tool set (`MultiEdit`, `TodoWrite`).
  - "Only commit changes when explicitly asked" contradicts agent-kit's "commit locally when verify is green, don't stop to confirm". Per the docs, one of the two is picked arbitrarily.
  - "Always run lint/typecheck" duplicates `npm run verify`.
  - Wrong behavior: sessions stall waiting for commit permission, or invoke tools that no longer exist.

### F3. Authorization rules contradict each other inside the loaded chain

- **Lambda env.** The repo `CLAUDE.md` grants standing authorization for `update-function-configuration` (the call that rewrites Lambda env). The same file's quick-binding table, and `agent-kit/PROJECT.md` `<NEVER_TOUCH>`, say "Firebase/Lambda env vars: needs an explicit, fresh yes".
- **git push.** The `CLAUDE.md` manual deploy steps and "Verification Checklist" end in `git push` / "Ready to push". The `deploy-frontend` skill's Step 5 pushes unconditionally. Meanwhile agent-kit says `git push` needs a fresh "yes" every time.
- **Commit style.** `CLAUDE.md` says follow `git log` (plain present-tense summaries). `CLAUDE.template.md` says Conventional Commits. The real log is plain summaries.
- **Wrong behavior:** either needless stalls (asking for permission the operator already granted), or the reverse, where a skill-triggered "deploy" pushes without the gate.

### F4. Memory steers "what's next" to an April plan

- The `MEMORY.md` index line for `feedback_consult_plans_first` says: "Before recommending next steps, OPEN project_redesign_v2_plan.md".
- That topic file says "ALWAYS read ... `project_redesign_v2_plan.md`" plus repo-root `REDESIGN_V2_PLAN.md` / `BACKEND_TODO.md` paths. Those files moved into `project-docs/` on 09-08.
- `project_redesign_v2_plan` (228 lines, 2026-04-26) is labelled "APPROVED" and "don't build new pipelines".
- **Wrong behavior:** a literal model opens a 5-month-old completed plan, treats it as the approved direction, and argues against new pipelines. It misses the real `_active` plans (map-home/situation, event registry, severity codebook).

### F5. Wrong facts that get copied straight into output

- **`.agents/product-marketing-context.md`** (tracked) is read first by **32** marketing skills. It says: Paddle is the Merchant of Record, there are Member/Enterprise tiers, archives are gated, welcome emails go via Loops.so, and "paid tiers coming". Reality: Paddle is dead, Polar is live, reading is free, and membership buys depth plus Studio compute.
  - Wrong behavior: any marketing or copy task publishes false billing claims. That is the exact misinformation class `feedback_no_misinformation_fallback` forbids.
- **Memory `project_growth_strategy`**
  - It says "Pricing: Free / $9.99/mo / $29.99/mo". These are the fabricated prices recorded as an incident in `feedback_no_assumptions`; the real price is $15/mo or $150/yr.
  - It lists Mastodon, Telegram, Nostr and Farcaster as "Active via Lambda". Only LinkedIn and Bluesky are live (`pending_work`).
- **Memory `project_billing_deprecated`** keeps the "How to apply: Do not wire new features to tier gating. Favor removal over repair" rule under a "REVERSED" banner. Member gating has been live since 07-07.
  - Wrong behavior: the model argues against or removes live gating.

### F6. Stale model/provider facts in files that look authoritative

- **Memory `project_ai_provider_migration`** opens with a "Final provider routing" table that puts everything on `deepseek-chat`. That alias was retired 2026-07-24 and caused a 36h outage. The correct v4-pro/v4-flash split is buried in appended updates further down.
- **`feedback_misleading_grok_naming`** lists a 05-18 mapping on `deepseek-chat`.
- **`.claude/skills/onboard/SKILL.md`**
  - It points to `/Users/benlai/Downloads/globalPerspective-v1/ARCHITECTURE.md`, which does not exist (it moved to `project-docs/architecture/`).
  - It describes "All 4 Lambda functions" and an "xAI Grok" pipeline. There are ~33+ Lambdas and DeepSeek/Gemini.
  - It triggers "when starting a new session", the overtriggering pattern the prompting guide warns about.
- **Wrong behavior:** code or env edits that reintroduce `deepseek-chat`, and a wrong system model at session start.

### F7. Contradictory storage doctrine

- `feedback_clean_architecture` says "default to proposing a dedicated table and/or Lambda".
- `DATA_STRATEGY.md` (ADOPTED 09-08, echoed in `project_map_home_situation`) says "never add a DynamoDB table without an exception in DATA_STRATEGY.md". World data goes to S3. DDB holds only Users, SavedItems, UserPrefs and ApiKeys.
- **Wrong behavior:** a new feature proposes a new DDB table. Either rule may be picked.

### F8. Contradictory status lines inside memory

| Where | Says | Reality / newer source |
|---|---|---|
| `MEMORY.md` → `pending_work` | "Pending: social bugs (Nostr, Mastodon)" | The file says DROPPED 05-30 |
| `project_email_sender` | Both email rules ENABLED | S9·T1 on 09-10 DISABLED the breaking email sender cron (`project_map_home_situation`) |
| `project_site_orientation` body | "`pair_analyses_list` powers /map arcs" | Pair is dormant; WorldMapV2 was deleted 09-24 |
| `project_economy_ux_overhaul` | "vite `base` is `./`" | `feedback_404_spa_fallback`: base is `'/'`, don't revert |
| `feedback_narrative_page_layout` | "symlink `node_modules`" into worktrees | `agent-kit/PROJECT.md`: COW-clone, "real dir not a symlink" |
| `project_daily_brief` | Past dates member-gated via `resolveUserTier` | `resolveUserTier` was deleted 06-01; `/daily` is reported broken (`SYSTEM_USAGE_2026-09-11.md`) |
| `project_analysis_studio` | Anthropic IDs `claude-sonnet-4-6`… "use current session values" | The same file later says they were refreshed to `claude-sonnet-5` on 07-26 |
| `project_breaking_alert_scoring_rework` index line | "⚠️ CHECK: may have been redeployed" | The file says DEPLOYED 09-08, bytes verified |
| `reference_proxy_request_behavior` | `systems_analysis` 404 for most countries is expected (~2 countries) | `SYSTEMS_TOP_N=10` rotating since 09-10 |

**Wrong behavior:** the model acts on whichever line it reads first.

### F9. `ARCHITECTURE.md` opens with a 26KB single-line changelog

- Line 5 ("**Last verified:** 2026-08-01 (refresh: ...") is one paragraph of 26,274 characters, about 6.5k tokens.
- It sits directly under line 3, which says "reconciled against the live-AWS audit of 2026-09-10". There are two freshness claims one line apart.
- Line 11 still says "AI Provider (as of 2026-05-16)".
- **Wrong behavior:** every "read ARCHITECTURE.md first" spends its budget on superseded history. The model may cite statuses from that paragraph as current, or trust the older "Last verified" date.

### F10. The deploy procedure is duplicated about six times, in CRITICAL/MUST voice

- **The copies:**
  - Repo `CLAUDE.md` has it three times: the TL;DR, the full manual steps (with CRITICAL comments), and the Common Mistakes plus Verification Checklist.
  - `deploy-frontend` skill.
  - `ops/DEPLOYMENT_NOTES.md`.
  - `ARCHITECTURE.md` §Deployment Workflow.
  - Memory `feedback_404_spa_fallback`.
  - The `MEMORY.md` footer.
- **Mechanized already:** `deploy.sh` strips maps, resyncs `404.html` and hash-guards `config.js`, and `postbuild` emits `404.html`.
- **Drift in the skill copy:**
  - Co-author "Claude Sonnet 4.5".
  - Prod URL `benben05059997.github.io/...`, which is not canonical.
  - "Backend Lambda functions are deployed separately via AWS Amplify", which is false: they are deployed with the manual AWS CLI.
  - An unconditional `git push`.
- **Wrong behavior:** the model runs manual copy steps instead of `deploy.sh`, re-verifies 404 parity several times, or follows the drifted skill.
- `CLAUDE.md` is 237 lines, over the 200-line target, mostly because of this duplication.

### F11. Memory has grown into session journals

- Six topic files exceed 12KB: `project_analysis_studio` 32.9KB, `project_analyst_tool_direction` 25.8KB, `project_prediction_methodology_v1` 21.3KB, `project_map_home_situation` 19.3KB, `project_redesign_v2_plan` 16.3KB, `project_pair_intelligence` 12.4KB. The directory totals ~431KB.
- They duplicate `CHANGES.md` and the plan docs, and contain contradictions (F8). Two files are unindexed: `project_prediction_and_maps`, `project_redesign_v1`.
- One file has an empty `name:` (`project_home_map_lede`). Frontmatter mixes `type:` and `metadata:`.
- `reference_linkedin_token_refresh` stores a LinkedIn **client secret** in plain text (`WPL_AP1…`, described as stale). Secrets don't belong in memory even when stale.
- `MEMORY.md` itself is 90 lines / 17KB, within the load limit, but its entries are multi-clause paragraphs of up to 518 chars. The index loads fully; the problem is signal-to-noise and stale imperatives inside the lines.

### F12. The user-level auto-mode classifier context describes a different repo

- In `~/.claude/settings.json`, `autoMode.environment` says "Repository visibility: Private — BenBen05059997/PropertyAnalysisJP", "Source control: This repo (PropertyAnalysisJP) and its origin remote only", "Trusted internal domains: pro-co.net".
- This applies to GP sessions too. GP is a public repo with a different remote and domain.
- **Plausible effect:** classifier denials on legitimate GP operations. Memory records several: `--no-verify` denied, "[Modify Shared Resources]" on looped `aws`, `aws iam` blocked.
- **Status:** operator-owned, and it needs a feasibility check (§4c).

### F13. Smaller items

- **`.claude/loop-prompt.md`:** it drives a queue file (`ANALYZE_OPTIONS_PRUNE_QUEUE.md`) that no longer exists anywhere in the tree.
- **`README.md` and `CLAUDE.md`:** both warn about a "Root `src/` legacy scaffold" that no longer exists.
- **`project-docs/playbooks/TASK_WORKFLOW.md`:** it names the `TodoWrite` tool.
- **`global-perspectives-starter/frontend/FRONTEND_ARCHITECTURE.md`:** it is already bannered stale but still sits beside the code.
- **Untracked private key in the working tree:** `globperpectives-firebase-adminsdk-*.json` (a service-account private key) sits in the repo root. It is gitignored, so it is not published, but any repo-wide `grep`/`Read` can pull key material into a transcript.
- **`global perspective.zip`:** it sits in the repo root. It is a gitignored April mockup.
- **User-level agents:** `ui-bug-hunter` lists removed tools (`MultiEdit`, `TodoWrite`, `BashOutput`, `KillBash`). `subsystem-doc-auditor` is PropertyAnalysisJP-specific. Both appear in every GP session's agent list.

---

## 3. Decision table

Legend:
- **KEEP**: current and useful.
- **TRIM**: keep, but cut or rewrite as stated.
- **MERGE**: fold into the named file, then remove the source.
- **ARCHIVE**: move out of the load or read path, preserved.
- **DELETE**: remove.
- **EXCLUDE**: skip via `claudeMdExcludes`.

### 3a. CLAUDE.md chain and `.claude/` config

| File | Decision | Reason / what exactly |
|---|---|---|
| `/Users/benlai/CLAUDE.md` | **EXCLUDE** (+ operator: rewrite or delete at source) | Generic. It uses tool names that don't exist (`MultiEdit`, `TodoWrite`). "Only commit when explicitly asked" contradicts agent-kit (F2). Nothing in it is GP-specific. |
| `/Users/benlai/Downloads/CLAUDE.md` | **EXCLUDE** (+ operator: relocate) | Different project (notetrail). Must not be edited or deleted by GP sessions. Exclude now; recommend moving it with `SPEC.md` and `DATA-MODEL.md` into the notetrail project folder so no other `~/Downloads/*` project inherits it. |
| `~/.claude/CLAUDE.md` | n/a | Does not exist. |
| Repo `CLAUDE.md` | **TRIM** (rewrite, draft in §5a) | 237 lines → ~100. Remove the "Active task" credits block (F1). Resolve the authorization contradiction (F3). Collapse the 3 deploy sections to one pointer at `deploy.sh`. Drop the stale root-`src/` trap. Replace CRITICAL/MUST voice. Remove Lambda-CORS detail (lives in memory + ARCHITECTURE Common Mistakes #7). No ARCHITECTURE duplication. |
| `.claude/settings.json` (Stop hook) | **KEEP** | This is the right pattern: a non-blocking docs reminder enforced by a hook, not prose. |
| `.claude/settings.local.json` | **KEEP** + add `claudeMdExcludes` | Operator confirmation needed (it's config). Snippet in §4c. |
| `.claude/cclsp.json` | **KEEP** | LSP config. |
| `.claude/loop-prompt.md` | **DELETE** | Stale single-use Ralph task prompt for a queue that no longer exists (F13). Recoverable from git (`187f39c` era). |
| `.claude/skills/onboard/SKILL.md` | **TRIM** (rewrite to ~15 lines) | Point it at `README.md` → `project-docs/INDEX.md` → `architecture/ARCHITECTURE.md`. Delete the Lambda count, the pipeline description and the "outdated docs" list. Change the trigger to "when asked to orient / read the docs", not "when starting a new session" (F6). |
| `.claude/skills/deploy-frontend/SKILL.md` | **TRIM** (→ ~30 lines) | Keep: run `./deploy.sh` (only after an explicit deploy "yes" in the current message), then `curl` prod for 200, `diff docs/index.html docs/404.html`, one push then let it settle (push only with a "yes"), and rollback via `git revert`. Remove: the manual copy steps, the Sonnet 4.5 footer, the github.io URL, and the "backend via Amplify" line (F10). |
| `.claude/skills/<32 marketing symlinks>` → `.agents/skills/*` | **KEEP** | On-demand and operator-installed (`skills-lock.json`). Their harm comes from the shared context file below, not from the skills themselves. |
| `.agents/product-marketing-context.md` | **TRIM** (rewrite the facts) | Rewrite: Polar membership $15/mo or $150/yr, reading free, membership = correction-history depth + change-alerts + Studio compute, live channels LinkedIn + Bluesky, no Enterprise tier, no archive gating, no Loops. Keep the positioning and ICP sections. Re-date it (F5). |

### 3b. Agent-facing repo docs

| File | Decision | Reason / what exactly |
|---|---|---|
| `agent-kit/CLAUDE.template.md` | **KEEP** (demote) | Portable template with `<PLACEHOLDER>`s. Stop telling sessions to "read at session start". Bind its operative rules (keep-going, halt list, auth list, deploy gate) directly into the repo `CLAUDE.md` in calm voice, so no mental substitution is needed. Drop its "Conventional commits" default for this repo (F3). |
| `agent-kit/PROJECT.md` | **TRIM** | Reconcile `<NEVER_TOUCH>` with the standing AWS authorization (the §5a wording, one source of truth). Replace `[[memory-slug]]` wiki-links with plain descriptions, because the memory files are being renamed or merged. |
| `agent-kit/{README,MEMORY_SYSTEM}.md`, `playbooks/*`, `ralph-loop.sh` | **KEEP** | On-demand reference. Not loaded. |
| `project-docs/INDEX.md` | **KEEP** | A good map. `_legacy/` is fenced under "Legacy / obsolete". |
| `project-docs/playbooks/TASK_WORKFLOW.md` | **TRIM** | Replace "the `TodoWrite` tool" with "the in-session task list". The rest is current and mechanized by `.githooks/pre-commit`. |
| `project-docs/playbooks/{AGENT_REVIEW_METHOD,BUG_PLAYBOOK,PLAN_EXECUTION_PLAYBOOK,TASK_TEMPLATE}.md` | **KEEP** | Current how-tos. |
| `project-docs/architecture/ARCHITECTURE.md` | **TRIM** (structure) | (1) Move line 5 verbatim to a new `project-docs/architecture/ARCHITECTURE_VERIFICATION_LOG.md` (reverse-chronological, append-only). It is an audit and verification log, not a change log, and most of its items already have dated `CHANGES.md` entries. That is why it goes to a log file rather than into the middle of `CHANGES.md`. (2) Replace lines 3 and 5 with one line: "Reconciled against live AWS 2026-09-10; verification history → ARCHITECTURE_VERIFICATION_LOG.md; changes → CHANGES.md". (3) Fix the "AI Provider (as of 2026-05-16)" lead-in to "current". (4) Replace §Deployment Workflow with a 2-line pointer to `ops/DEPLOYMENT_NOTES.md` + `deploy.sh`. Keep §Common Mistakes, which is canonical. Do this after the concurrent staleness agent finishes its pass on this file. |
| `project-docs/architecture/ARCHITECTURE_VERIFICATION_LOG.md` | **create** (ARCHIVE target) | Receives the line-5 history. |
| `project-docs/billing/_active/PROD_CREDITS_NEXT_STEPS.md` | **ARCHIVE** → `billing/_proposed/` | Add the banner "PARKED 2026-07-06 by operator. Not an active task. Do not execute without a fresh operator go-live decision." Retitle it away from "NEXT TASK" (F1). Coordinate with the concurrent agent, which owns stale references inside project-docs. This is a folder/status decision, not a reference fix. |
| `project-docs/_legacy/*` | **KEEP** | Correctly fenced. |
| `CHANGES.md` | **KEEP** | Append-only log (3,650 lines, not loaded). |
| `README.md` | **TRIM** | Delete the "Root `src/` is a legacy Amplify scaffold" trap bullet (the directory is gone). Keep the rest; it's a good router. |
| `global-perspectives-starter/frontend/FRONTEND_ARCHITECTURE.md` | **ARCHIVE** → `project-docs/_legacy/` | Already self-declared stale. Out of the code tree means a code-adjacent read can't mistake it for truth. It currently has an uncommitted edit from another agent, so move it after that lands. |
| `internal-docs/CLAUDE-MARKETING-PLAYBOOK.md` | **KEEP** | The name doesn't trigger CLAUDE.md loading. It is reference only. |
| `archive/` (tracked, 7 files) | **KEEP** | Clearly named. Optionally add it to INDEX's "not indexed" line. |

### 3c. Stray root files and user-level files (operator-owned)

| File | Decision | Reason |
|---|---|---|
| `globperpectives-firebase-adminsdk-fbsvc-*.json` (gitignored) | **ARCHIVE** out of the repo dir (operator) | Private key in the working tree (F13). Move it to e.g. `~/.config/gp-secrets/` and update any script that references it. |
| `global perspective.zip` (gitignored) | **ARCHIVE** out of the repo dir (operator) | April mockup, referenced only by a memory file being deleted. |
| `~/.claude/settings.json` `autoMode.environment` / `soft_deny` | **TRIM** (operator; verify feasibility first) | Scope the PropertyAnalysisJP-specific environment to that project, and give GP an accurate environment (public repo `BenBen05059997/globalPerspective-v1`, domain `globalperspective.net`, AWS account 280362093938, plaintext-Lambda-env secret model) (F12). |
| `~/.claude/agents/ui-bug-hunter.md` | **TRIM** (operator, optional) | Remove the removed tool names from its `tools:` list. |
| `~/.claude/agents/subsystem-doc-auditor.md` | **KEEP** (operator may move it to PropertyAnalysisJP `.claude/agents/`) | It is harmless in GP. It only triggers on its own examples. |

### 3d. Auto memory (`~/.claude/projects/-Users-benlai-Downloads-globalPerspective-v1/memory/`)

**Merge targets** are the files listed first in each MERGE row. New files are marked *(new)*.

#### Feedback files (19)

| File | Decision | What exactly |
|---|---|---|
| `feedback_no_assumptions` | KEEP | Core honesty rule. |
| `feedback_no_misinformation_fallback` | KEEP | Core honesty rule. |
| `feedback_no_unauthorized_removal` | KEEP | |
| `feedback_test_ui_in_browser` | KEEP | |
| `feedback_no_ci_solo_dev` | KEEP (absorbs smoke-test) | Add one line: `scripts/smoke-test.mjs` is a manual playbook; don't propose automating it. |
| `feedback_smoke_test_manual` | MERGE → `feedback_no_ci_solo_dev` | Same preference. |
| `feedback_no_secrets_manager` | KEEP | |
| `feedback_agent_review_method` | KEEP | Update the path to `project-docs/playbooks/AGENT_REVIEW_METHOD.md`. |
| `feedback_archive_payload_limit` | KEEP | Non-obvious code guard. |
| `feedback_lambda_function_url_cors` | KEEP | Canonical home of the CORS rule. CLAUDE.md stops repeating it. |
| `feedback_404_spa_fallback` | TRIM → ~6 lines | Keep: the parity rule, the fact that `deploy.sh` + `postbuild` handle it, the `diff` check, vite `base '/'` (don't revert), and the permalink principle (fetch detail by ID). Cut: incident narrative, a11y fix list, smoke-test internals (in `BUG_PLAYBOOK.md`). |
| `feedback_audience_depth` | TRIM | Drop the pair-intelligence bullets (pairs are dormant). Keep the rule and the thread/country/brief bullets. |
| `feedback_auth_guard_hooks` | TRIM | Add: membership limits are **server-side caps** (`newsSensitiveData` `capForTier`), never client guards. Drop "early access mode". |
| `feedback_clean_architecture` | TRIM | Rewrite to: prefer dedicated Lambdas over jamming. Storage follows `project-docs/architecture/DATA_STRATEGY.md`: S3 for world/content data; a new DDB table only for user-owned or mutable data, with a recorded exception. Resolves F7. |
| `feedback_consult_plans_first` | TRIM | Rewrite to: before proposing next steps or structural work, open the relevant `_active` plan via `project-docs/INDEX.md`. `pending_work`-style summaries are not plans. Remove the redesign-v2 and repo-root paths (F4). |
| `feedback_editorial_fact_layer` | TRIM (absorbs country-facts) | Keep the authority order (operator JSON > Wikidata `FACTS#` via `newsCountryFactsUpdater` > live search > archive). Drop the pair-Lambda paths and 04-18 narrative. |
| `feedback_misleading_grok_naming` | TRIM | Keep the rule (verify with `get-function-configuration`; plans and checkboxes ≠ deployed). Delete the 05-18 `deepseek-chat` mapping and point to `project_ai_providers` (F6). |
| `feedback_narrative_page_layout` | TRIM | Keep the principles. Delete the "symlink node_modules" process note; `agent-kit/PROJECT.md`'s COW clone is canonical (F8). |
| `feedback_prod_aws_deploy_classifier` | TRIM | Keep: bare single `aws` commands, no loops, `dangerouslyDisableSandbox` for AWS. Drop the credits "Step 1" narrative. |

#### Inbox file (1)

| File | Decision | What exactly |
|---|---|---|
| `pending_work` | DELETE | All items done or dropped. The two live marketing to-dos (RSS aggregator submission, Search Console sitemap) move into `project_growth_strategy`. |

#### Project files (50)

| File | Decision | What exactly |
|---|---|---|
| `project_map_home_situation` | TRIM (19KB → ~12 lines) | The active programme. Keep: plan, ledger and DATA_STRATEGY pointers; the locked decisions; the current stage (what's live, what's gated: S6 home swap needs its own "yes"); the tuning-knob names; "bare-named Lambdas". Everything else is in the ledger. |
| `project_analyst_tool_direction` | TRIM + rename → `project_strategy` (merge target) | ≤12 lines. Content: ICP = thesis producers (consultancies and funds first, gov later); the three pillars; calibration is a later sales asset, not a precondition; P1 discovery is blocking; signal API NOT sold (07-01), kept as plumbing; the defensible-edge rule ("possibly related", never "caused"). Spider build history is removed (it's in the repo plans). |
| `project_signal_api_pivot` | MERGE → `project_strategy` | Superseded by the 06-26 direction and the 07-01 decision. |
| `project_signal_api_moat_empty` | MERGE → `project_strategy` | Its one live fact (no API sale; calibration empty at the time) moves there. |
| `project_billing_deprecated` | TRIM + rename → `project_billing_polar` (merge target) | Polar membership LIVE ($15/mo, $150/yr); Paddle dead, don't revive; credits PARKED (pointer `billing/_proposed/PROD_CREDITS_NEXT_STEPS.md`); prod `newsAnalyze` = patched deployed zip (never deploy the repo file until credits go-live); operator TODO: rotate the Polar token, KYC. Delete the "don't wire tier gating" rule (F5). |
| `project_credit_billing` | MERGE → `project_billing_polar` | |
| `project_analysis_studio` | TRIM (33KB → ~15 lines) | Keep: the direction rule (on-demand = Studio lens; crons with live consumers stay); 3 lenses; providers (OpenRouter retired, Qwen grandfathered); member path = `deepseek-v4-pro` with thinking disabled and a 120s timeout ("No ACAO" on slow calls = timeout); the prod-deploy method (patched deployed zip); the honesty stack (validator, `gp-struct` validated, `check.mjs`, "check not benchmark"); the plan filenames. Delete the old Anthropic-ID line (F8) and all build narrative. |
| `project_ai_provider_migration` | TRIM + rename → `project_ai_providers` | Current state only: v4-pro = country, systems and econ; v4-flash = the rest; all send `thinking:{type:'disabled'}`; the Gemini free-tier jobs; `newsModelGuard` daily scan (env-only, blind to code defaults); `deepseek-chat` retired (never use it); verify stragglers with `get-function-configuration`. Delete the 05-16 table (F6). |
| `project_prediction_methodology_v1` | TRIM (absorbs calibration) | Keep: era-cut 07-04; `GlobalPerspectivePredictionLog` immutable (no TTL, never rewrite); hybrid resolution (resolver proposes, human or agent confirms; no auto-finalize); backlog policy (N=2wk + disclosed lapsed tier); measured findings (60–80% bucket ~13pts hot; empty 40–60% = a generation problem); runbook pointer `predictions/V1_RESOLUTION_RUNBOOK.md`. Delete the per-run logs. |
| `project_prediction_calibration` | MERGE → `project_prediction_methodology_v1` | Its invariants move there. |
| `project_member_gating` | TRIM | Live 07-07: server-side depth caps; FollowButton on CountryPage + /track-record; drift-email cron DISABLED until the first follower; runbook `DRIFT_EMAIL_ACTIVATION_PLAN.md` (L0–L1 standing, L2–L4 need a fresh "yes"). |
| `project_living_analysis` | TRIM | Corrector → drift-note → analyzer; the grounded-not-self-reflection principle; notes never overwrite; `DRIFT#` (60d) + `DRIFTLOG#` (permanent). |
| `project_risk_tiers` | TRIM + rename → `project_risk_scoring` (merge target) | Bands 25/50/75 in `utils/riskTiers.js` (single source); 4-axis vector, headline = worst axis (never an average), null = "no signal"; pointer to `SEVERITY_CODEBOOK.md`. |
| `project_scoring_model_v2` | MERGE → `project_risk_scoring` | |
| `project_breaking_alerts` | TRIM + rename → `project_email_and_alerts` (merge target) | Resend (not SES); `newsBreakingAlert` auto-emails the operator only; the subscriber breaking-email cron is DISABLED (09-10); weekly brief auto-publishes + emails Sundays; unsubscribe via `newsRecommend`; the bell = the public feed; "rotate the Resend key → update the Lambda env" reminder. |
| `project_email_sender` | MERGE → `project_email_and_alerts` | Its "both rules ENABLED" is superseded (F8). |
| `project_weekly_brief` | MERGE → `project_email_and_alerts` | |
| `project_breaking_alert_scoring_rework` | MERGE → `project_email_and_alerts` | One line: capped scorer deployed 09-08; tuning gated on a labeled gold set; docs `SCORING_RUBRIC.md` / `BREAKING_ALERT_V2_BUILD_PLAN.md`. |
| `project_economy_page_rebuild` | TRIM + rename → `project_economy` (merge target) | Two-layer model (dashboard vs news-cited leaderboard); the EditorialShell `children` gotcha; the deterministic briefing + `node quality/briefing/verify_compose.mjs`; SILVER excluded; the Gemini judge at 08:00 UTC by design (different family; don't switch to DeepSeek); the weekly-markets `seed_history` won't-overwrite gotcha; the `?view=week` mode. |
| `project_economy_briefing` | MERGE → `project_economy` | |
| `project_economy_instrument_universe` | MERGE → `project_economy` | |
| `project_economy_ux_overhaul` | MERGE → `project_economy` | Its localhost-testing gotchas are dropped as stale (vite base, CORS origin) (F8). |
| `project_economic_quality_judge` | MERGE → `project_economy` | |
| `project_weekly_markets` | MERGE → `project_economy` | |
| `project_error_sink` | TRIM + rename → `project_monitoring` (merge target) | Passive monitors: `newsClientErrors` + `newsErrorDigest`, `newsFreshnessMonitor` (>9h), `newsSourceAudit`, `newsModelGuard`, all on SNS `GlobalPerspectiveAlerts`; `node scripts/errors.mjs`; source maps private. |
| `project_freshness_monitor` | MERGE → `project_monitoring` | Its lesson moves there: "silent stale + 0 CloudWatch errors ⇒ look for a caught parse throw". |
| `project_source_truth` | KEEP | Current and short. The open L2/L3/L4 items are real. |
| `project_impact_first_redesign` | TRIM | Decision (impact-driven, typed by domain; GDELT is the net, not the ranker; validation = recall vs a human reference set). The shadow tables moved to S3 in S8. Plan pointers. |
| `project_signal_api_deployed` | TRIM | Now builds `signals/latest.json` on S3 (DDB table dropped 09-09); key-gated Function URL; `mint-key.mjs`; calibration stamp honest-empty. |
| `project_pair_intelligence` | TRIM → keep only the 09-24 status block (6 lines) | The 200-line historical body is in `project-docs/pairs/`. |
| `project_site_orientation` | TRIM | Keep P1–P4 live + "no /landing" + canonical page one-liners in the plan. Delete the false P5 "pair powers /map arcs" paragraph (F8). |
| `project_spider_demo_world_tier` | TRIM | Unlisted prototype; the "possibly related" wording rule; the SVG hit-path gotcha. The "deploy.sh stages all of frontend/src" gotcha moves to `reference_aws_deploy_gotchas`. |
| `project_cloudflare_worker` | TRIM (absorbs RSS URL) | Keep the 5 responsibilities, the POST-payload gotcha, the `/data/*` route, and the canonical feed URL `https://globalperspective.net/rss`. The code stays in `WORKER_FULL_CODE.md`. |
| `project_home_map_lede` | TRIM | Fix the empty `name:`. Keep the threadId-on-`latest` fix and the no-fallback-link rule. Drop the WorldMapV2 mention. |
| `project_recommendations_engine` | TRIM | Live scorer + `GlobalPerspectiveUserPrefs`; "For you" = discovery (excludes followed threads). Delete "NOT yet committed / no Function URL" (stale). |
| `project_agent_kit` | TRIM | Local gate `npm run verify`; `ralph-loop.sh` never deploys; parallel worktrees ⇒ `git log -1 main` before acting; land as a minimal delta. Drop the stale worktree names. |
| `project_docs_reorg` | TRIM → 2 lines | `project-docs/INDEX.md` is the map; bare-name mentions in old docs may be old root paths, so use `find`. |
| `project_repo_public_2026_06_23` | TRIM | Public repo ⇒ no secrets in the tree; check deploy state by comparing the live bundle hash to `docs/index.html`. |
| `project_growth_strategy` | TRIM (rewrite) | Keep: accounts (@globalperspect, `globalperspectives.app@gmail.com`, Hashnode), file locations, SEO keyword list, the two live to-dos from `pending_work`. Delete the pricing, KPIs and channel table (F5). |
| `project_category_audit` | MERGE → `reference_aws_deploy_gotchas` | Only the `TOPICS_LIMIT` env overrides code gotcha survives. |
| `project_country_facts_updater` | MERGE → `feedback_editorial_fact_layer` | Priority order only. The rest is in the repo. |
| `project_perf_parallelization_2026_05_18` | MERGE → `reference_aws_deploy_gotchas` | Keep only `LLM_CONCURRENCY` / `BRAVE_CONCURRENCY` / the `mapWithConcurrency` pattern and "md5-diff deployed vs repo before editing". |
| `project_daily_brief` | DELETE | Contradictory and stale (F8). `/daily` state lives in `SYSTEM_USAGE_2026-09-11.md` and ARCHITECTURE. |
| `project_economic_disruption` | DELETE | The "What's NOT done" list is false (it's live). Canonical: `ECONOMIC_DISRUPTION_PLAN.md` + ARCHITECTURE. |
| `project_economic_quality_human_review` | DELETE | The workflow is canonical in the `quality/reviews/` README. |
| `project_prediction_and_maps` | DELETE | Unindexed April history. The librsvg-fonts lesson is in `newsPostLinkedIn` code/README. |
| `project_redesign_v1` | DELETE | Unindexed April history ("maintenance overlay still active" is false). |
| `project_redesign_v2_plan` | DELETE | Completed April plan, in-repo as `REDESIGN_V2_PLAN.md`. It is the target of the F4 misdirection. |
| `project_rss_expansion` | DELETE | The feed URL moves to the worker memory. The feed list is in code. |
| `project_save_feature` | DELETE | Its "PENDING: upload zip" is stale. Architecture is in ARCHITECTURE. The CORS rule lives in `feedback_lambda_function_url_cors`. |

#### Reference files (11)

| File | Decision | What exactly |
|---|---|---|
| `reference_github_account_switch` | KEEP | |
| `reference_google_maps_key` | KEEP | |
| `reference_market_competitive_research_2026_06_26` | KEEP | Verified numbers plus a "don't use" list. |
| `reference_observability_usage` | KEEP | |
| `reference_page_wiring_contracts` | KEEP | |
| `reference_pages_deploy_concurrency` | KEEP | |
| `reference_web_data_sources` | KEEP | |
| `reference_bug_fighting_loop` | TRIM | Update the path to `project-docs/playbooks/BUG_PLAYBOOK.md`. Keep the 8 classes and the check commands. |
| `reference_linkedin_token_refresh` | TRIM | **Redact the client secret.** Keep the working UI method and the dead-ends list, minus the secret value. |
| `reference_proxy_request_behavior` | TRIM | Fix the stale `systems_analysis` "~2 countries" line (F8). |
| `reference_signal_api_source_records` | DELETE | Field inventory duplicates ARCHITECTURE §DynamoDB Tables. The pivot it served is shelved. |
| `reference_aws_deploy_gotchas` | *(new)* MERGE target | `newsSensitiveData-dev` vs bare-named Lambdas; `update-function-configuration --environment` replaces the whole map (fetch → merge → write, secrets via temp file); several deployed zips ≠ repo (diff first); Function-URL timeout masquerades as CORS; `TOPICS_LIMIT` env overrides code; `deploy.sh` stages all of `frontend/src` (clean tree first); the concurrency pattern. |

#### The index itself

| File | Decision | What exactly |
|---|---|---|
| `MEMORY.md` | TRIM (rewrite, draft in §5b) | One line per entry, grouped Rules → References → Project state. The overview shrinks to 3 lines. Delete the deploy recipe footer (duplicates CLAUDE.md + `deploy.sh`). |

### 3e. Counts

| Scope | KEEP | TRIM | MERGE | ARCHIVE | DELETE | EXCLUDE |
|---|---|---|---|---|---|---|
| CLAUDE.md chain + `.claude/` + `.agents` (11 rows, excl. the n/a row) | 4 | 4 | 0 | 0 | 1 | 2 |
| Agent-facing repo docs (14 rows, excl. the new log) | 8 | 4 | 0 | 2 | 0 | 0 |
| Root / user-level operator files (5) | 1 | 2 | 0 | 2 | 0 | 0 |
| Memory topic files (81) | 17 | 36 | 18 | 0 | 10 | 0 |
| `MEMORY.md` | 0 | 1 | 0 | 0 | 0 | 0 |
| **Total (112)** | **30** | **47** | **18** | **4** | **11** | **2** |

After execution, memory goes from 81 topic files (~431KB) to 54 files (17 kept + 36 trimmed + 1 new). The target is under ~120KB total, and no topic file over ~4KB.

---

## 4. Execution plan, by reversibility

Order matters. Do (a) first, because it removes the highest-impact live instruction (F1) at zero risk. Then (b). (c) waits on the operator.

### 4a. Repo files (git-reversible). The agent can do these in one or two commits after the concurrent staleness agent lands

**Execution status (2026-09-24):** Items 1–12 executed, with operator overrides on the push rule
(standing `git push` after verify/hooks, `./deploy.sh` still needs a fresh "yes" each time) and
§4c out of scope for this pass (left to the monitor). See `CHANGES.md` 2026-09-24 "Context
hygiene" entry for the full file list. §4b (auto-memory) not executed here.

1. **`CLAUDE.md`:** replace with the §5a draft. Carry forward the uncommitted 1-line change currently in the working tree, if it is still relevant.
2. **`PROD_CREDITS_NEXT_STEPS.md`:** `git mv` it to `project-docs/billing/_proposed/` and add the PARKED banner. Update its INDEX row and the `POLAR_BILLING_PLAN.md` §5 pointer. Coordinate with the staleness agent.
3. **`.claude/loop-prompt.md`:** `git rm`.
4. **Skills:** rewrite `.claude/skills/onboard/SKILL.md` and `.claude/skills/deploy-frontend/SKILL.md` per §3a.
5. **`.agents/product-marketing-context.md`:** rewrite the business-model facts per §3a.
6. **`agent-kit/PROJECT.md`:** reconcile `<NEVER_TOUCH>` with §5a's authorization block (verbatim, so there is one wording). Replace `[[slug]]` links with plain text.
7. **`TASK_WORKFLOW.md`:** apply the `TodoWrite` wording fix.
8. **`README.md`:** remove the `src/` bullet.
9. **`ARCHITECTURE.md`:** create `ARCHITECTURE_VERIFICATION_LOG.md` with the line-5 text verbatim, then apply the header and §Deployment Workflow edits. Do this last, after the staleness agent is done with this file.
10. **`FRONTEND_ARCHITECTURE.md`:** `git mv` it into `project-docs/_legacy/` and add an INDEX row.
11. **Verify:** `npm run verify` is not needed (no code changed). Check that `grep -rn "Active task\|MultiEdit\|TodoWrite\|Root \`src/\`" CLAUDE.md README.md .claude agent-kit project-docs/playbooks` returns nothing. `CLAUDE.md` should be under 200 lines (`wc -l`). Add a `CHANGES.md` entry.
12. **Rollback:** `git revert <sha>`.

### 4b. Memory files (NOT in git). Back up first; memory is being edited concurrently

The memory directory shows edits at 12:35 today from another session, so the snapshot and apply must be single-pass.

1. **Snapshot:** `tar -czf ~/.claude/backups/gp-memory-2026-09-24-pre-hygiene.tgz -C ~/.claude/projects/-Users-benlai-Downloads-globalPerspective-v1 memory`. Then `tar -tzf` the archive to confirm it lists 82 files.
2. **Re-check for concurrent edits:** check `ls -la --time-style=full-iso` right before writing. If any file's mtime is newer than the snapshot, diff it against the snapshot and carry the new lines into its merge target.
3. **Create merge targets first:** `project_strategy`, `project_billing_polar`, `project_ai_providers`, `project_risk_scoring`, `project_email_and_alerts`, `project_economy`, `project_monitoring` and `reference_aws_deploy_gotchas`. Populate them from their sources per §3d. Use one frontmatter schema throughout: `name`, `description`, `metadata: {type}`.
4. **Trim** the 36 TRIM files. Redact the LinkedIn client secret first.
5. **Delete** the 10 DELETE files and the 18 merged-away sources (`rm`, after the targets exist).
6. **Rewrite `MEMORY.md`** from §5b, adjusted to the actual filenames that exist after steps 3–5.
7. **Verify:**
   - Every index link resolves.
   - No file is unindexed.
   - `grep -rl "deepseek-chat\|\$9.99\|WPL_AP1\|project_redesign_v2_plan\|powers /map arcs" memory/` should return only intentional "retired/never use" mentions.
   - `MEMORY.md` is 70 lines or fewer and under 12KB.
8. **Rollback:** extract the tarball over the directory.

### 4c. Files outside the project (operator-owned). Each item needs operator confirmation

1. **Exclude the two ancestor CLAUDE.md files for GP only (non-destructive).** Merge this into the existing JSON of `/Users/benlai/Downloads/globalPerspective-v1/.claude/settings.local.json`:
   ```json
   "claudeMdExcludes": [
     "/Users/benlai/CLAUDE.md",
     "/Users/benlai/Downloads/CLAUDE.md"
   ]
   ```
   Verify in the next session with `/memory`: only the repo CLAUDE.md and auto memory should be listed. **Confirm:** yes/no. This changes a settings file, so it needs the operator's own approval, not an agent's.
2. **Relocate the notetrail files (recommended; not done by GP agents).** Move `~/Downloads/CLAUDE.md`, `SPEC.md` and `DATA-MODEL.md` into the notetrail project directory. Until then, any other project under `~/Downloads/` also inherits them. **Confirm:** where the notetrail project root is.
3. **Fix `/Users/benlai/CLAUDE.md` at the source.** Either delete it (the per-project CLAUDE.md files and `~/.claude/settings.json` already cover everything), or rewrite it as ≤10 neutral lines with no tool names and no commit policy. It affects every project under `/Users/benlai`. **Confirm:** delete or rewrite.
4. **Fix the user-level `autoMode.environment` (F12).**
   - First verify that `autoMode` is honored at project scope. Ask the `claude-code-guide` agent, or check the settings docs, before relying on it.
   - If it is honored, move the PropertyAnalysisJP block into that project's `.claude/settings.local.json`, and add a GP block to GP's `.claude/settings.local.json`.
   - If it is not honored, rewrite the user-level block to describe both repos neutrally.
   - **Confirm:** go / no-go.
5. **Move the Firebase admin-SDK key out of the repo working tree.** **Confirm:** the destination, and whether any local script reads it (a quick `grep -rn adminsdk scripts amplify` beforehand).
6. **Move `global perspective.zip` out of the repo dir.** Optional.
7. **Clean up the user-level agents.** Optional. Strip removed tools from the `ui-bug-hunter` `tools:` list. Optionally move `subsystem-doc-auditor` to PropertyAnalysisJP.
8. **Confirm the authorization block.** The §5a wording (standing vs. fresh-"yes" lists) becomes the single source. It restates, and does not widen, the 2026-07-01 standing authorization. The operator should still read it once and say yes or no.

---

## 5. Drafts (not applied)

### 5a. Proposed repo `CLAUDE.md` (~95 lines, calm voice)

```markdown
# Global Perspectives — working notes for Claude

AI global-news intelligence site (globalperspective.net). React frontend served from `docs/` by
GitHub Pages; ~35 AWS Lambdas (ap-northeast-1) + S3 world store + a few DynamoDB tables + Firebase
Auth; Cloudflare Worker in front. Solo developer; no CI by design.

## Where truth lives
- Doc map: `project-docs/INDEX.md`. System reference: `project-docs/architecture/ARCHITECTURE.md`
  (trust it over other docs; deployed AWS state beats both — check with the AWS CLI).
- Active work: the `_active/` plans listed in INDEX. Read the relevant one before proposing next steps.
- Change log: `CHANGES.md`. Storage rules: `project-docs/architecture/DATA_STRATEGY.md`.

## Layout
- Frontend source: `global-perspectives-starter/frontend/src/`. `docs/` is build output — don't
  hand-edit it; `docs/config.js` is operator-owned runtime config.
- Lambdas: `amplify/backend/function/<name>/src/` (deployed manually with the AWS CLI; the name
  "amplify" is historical). Several deployed zips differ from the repo — diff before editing.
- Scripts/checks: `scripts/`, `quality/`, `predictions/`.

## Verify
- Pre-commit gate: `cd global-perspectives-starter/frontend && npm run verify`.
- UI changes: exercise every touched control in a browser before calling it done; if you can't
  run a browser, say so.
- Hooks already enforce: CHANGES.md entry on code commits (pre-commit), page guards (pre-push),
  a docs reminder (Stop hook). You don't need to re-check what they check.

## Working style
- On reversible work, keep going without asking; report what changed and why as you go.
- Stop and ask on: a verify failure you can't fix, genuine ambiguity with irreversible outcomes,
  a business decision (pricing, positioning, legal copy), or anything on the list below.
- Diagnose-first requests ("why is X…", "check this"): report findings, then wait.
- Commits: plain descriptive summaries matching `git log`; stage explicit paths; one coherent
  change per commit. Update the docs a change makes stale in the same commit.

## Authorization
Standing (operator, recorded 2026-07-01): Lambda code and configuration updates for work the
operator asked for — `aws lambda update-function-code/-configuration/-url-config`, `aws events`,
`aws scheduler`, non-destructive `aws dynamodb` reads/writes. Run each as a single bare command
(not in a loop). When changing env: fetch → merge → write the full map; pass secrets via a temp
file. Verify after.

Needs a fresh "yes" in the current message every time:
- `./deploy.sh` (frontend deploy) and any `git push`
- secret values (API keys/tokens), IAM changes, Firebase auth config, `.env*`, `docs/config.js`
- Polar / billing code or config (credits are parked — not an active task)
- enabling user-facing sends (email crons), destructive data ops (delete tables/items/S3 prefixes)
- new paid APIs or dependencies

## Deploying the frontend
Run `./deploy.sh` (add `--commit "msg"` / `--push` only with a yes). It builds, copies to `docs/`,
strips source maps, keeps `docs/404.html` identical to `index.html`, and guards `docs/config.js`.
Afterwards: `curl -s -o /dev/null -w "%{http_code}" https://globalperspective.net` → 200, and
push once then let Pages settle. Details: `project-docs/ops/DEPLOYMENT_NOTES.md`.

## Product rules that affect code
- Never invent facts (prices, dates, URLs, handles) — find them in the repo or ask.
- No placeholder or "something went wrong" UI: fail empty/honest and report to the error sink.
- Public data hooks never gate on sign-in; membership limits are server-side.
```

(About 60 lines of content. There is deliberately no deploy-step duplication, no Lambda inventory and no CORS detail. Those live in `deploy.sh`, `ARCHITECTURE.md` and memory.)

### 5b. Proposed `MEMORY.md` (one line per entry)

```markdown
# Global Perspectives — memory index
Truth: repo `project-docs/INDEX.md` → `architecture/ARCHITECTURE.md`; deployed AWS beats docs. Don't copy docs here.

## Rules (feedback)
- [feedback_no_assumptions.md](feedback_no_assumptions.md) — Never invent prices/dates/URLs/handles; grep the repo or ask
- [feedback_no_misinformation_fallback.md](feedback_no_misinformation_fallback.md) — No placeholder/fallback UI; fail empty and report
- [feedback_no_unauthorized_removal.md](feedback_no_unauthorized_removal.md) — A mockup isn't permission to drop features; ask first
- [feedback_test_ui_in_browser.md](feedback_test_ui_in_browser.md) — UI work is done only after clicking every touched control
- [feedback_auth_guard_hooks.md](feedback_auth_guard_hooks.md) — No `!user` guards on public data hooks; tier caps are server-side
- [feedback_consult_plans_first.md](feedback_consult_plans_first.md) — Before "what's next", open the relevant `_active` plan via INDEX
- [feedback_clean_architecture.md](feedback_clean_architecture.md) — Dedicated Lambdas over jamming; storage per DATA_STRATEGY.md
- [feedback_no_ci_solo_dev.md](feedback_no_ci_solo_dev.md) — No CI/Actions gates; smoke-test is a manual playbook
- [feedback_no_secrets_manager.md](feedback_no_secrets_manager.md) — Plaintext Lambda env is the chosen secret store
- [feedback_misleading_grok_naming.md](feedback_misleading_grok_naming.md) — GROK_*/XAI_* env names hold other providers; check live config
- [feedback_agent_review_method.md](feedback_agent_review_method.md) — Audits: parallel read-only auditors vs live AWS + source
- [feedback_audience_depth.md](feedback_audience_depth.md) — Write AI content at analyst depth
- [feedback_editorial_fact_layer.md](feedback_editorial_fact_layer.md) — Current facts: operator JSON > Wikidata FACTS# > search
- [feedback_narrative_page_layout.md](feedback_narrative_page_layout.md) — Thread/Country pages: one tab system; rail is glanceable only
- [feedback_archive_payload_limit.md](feedback_archive_payload_limit.md) — archive_range returns lightweight entries (6MB limit)
- [feedback_lambda_function_url_cors.md](feedback_lambda_function_url_cors.md) — Code emits ACAO ⇒ Function-URL CORS empty, else populated
- [feedback_prod_aws_deploy_classifier.md](feedback_prod_aws_deploy_classifier.md) — Prod `aws` mutations as bare single commands
- [feedback_404_spa_fallback.md](feedback_404_spa_fallback.md) — 404.html == index.html (deploy.sh does it); vite base stays '/'

## Reference
- [reference_aws_deploy_gotchas.md](reference_aws_deploy_gotchas.md) — Lambda naming, env-map replace, zip≠repo drift, timeout-as-CORS
- [reference_pages_deploy_concurrency.md](reference_pages_deploy_concurrency.md) — One push then settle; judge liveness by served bundle hash
- [reference_page_wiring_contracts.md](reference_page_wiring_contracts.md) — Cross-page query/route contracts; useParams already decodes
- [reference_proxy_request_behavior.md](reference_proxy_request_behavior.md) — restProxy concurrency cap 4; proxy Lambda sizing
- [reference_bug_fighting_loop.md](reference_bug_fighting_loop.md) — BUG_PLAYBOOK classes + on-demand check scripts
- [reference_observability_usage.md](reference_observability_usage.md) — GA4 id + CloudWatch action-count usage proxy
- [reference_web_data_sources.md](reference_web_data_sources.md) — Free data sources + schedule→store→serve ingest pattern
- [reference_google_maps_key.md](reference_google_maps_key.md) — Maps key lives in GCP globalnews-473509, referrer-restricted
- [reference_linkedin_token_refresh.md](reference_linkedin_token_refresh.md) — 60-day token; refresh via generator UI (next ~2026-11-07)
- [reference_github_account_switch.md](reference_github_account_switch.md) — Push 403 as notetrailclerk → switch, push, switch back
- [reference_market_competitive_research_2026_06_26.md](reference_market_competitive_research_2026_06_26.md) — Verified market sizing/competitors; B2B only

## Project state
- [project_map_home_situation.md](project_map_home_situation.md) — ACTIVE: map-as-home + situation pipeline; S6 home swap needs its own yes
- [project_strategy.md](project_strategy.md) — Analyst tool for thesis-producers; signal API not sold; calibration later
- [project_billing_polar.md](project_billing_polar.md) — Polar membership live; Paddle dead; credits PARKED; newsAnalyze = patched zip
- [project_analysis_studio.md](project_analysis_studio.md) — /analyze: 3 lenses, v4-pro member path, validator; on-demand lens rule
- [project_ai_providers.md](project_ai_providers.md) — v4-pro/v4-flash split, thinking disabled; deepseek-chat retired; newsModelGuard
- [project_prediction_methodology_v1.md](project_prediction_methodology_v1.md) — v1 era-cut, immutable log, hybrid resolution, backlog policy
- [project_member_gating.md](project_member_gating.md) — Depth caps live; drift-email cron off until first follower
- [project_living_analysis.md](project_living_analysis.md) — Grounded drift notes, never overwrite; DRIFT#/DRIFTLOG#
- [project_risk_scoring.md](project_risk_scoring.md) — Tiers 25/50/75; 4-axis vector, worst axis leads; severity codebook
- [project_email_and_alerts.md](project_email_and_alerts.md) — Resend; weekly brief live; subscriber breaking cron disabled
- [project_economy.md](project_economy.md) — /economy two-layer model, briefing eval, weekly mode, Gemini judge
- [project_monitoring.md](project_monitoring.md) — Passive monitors → SNS GlobalPerspectiveAlerts; errors.mjs
- [project_source_truth.md](project_source_truth.md) — Summarizer fed snippets; newsSourceAudit; L2–L4 open
- [project_impact_first_redesign.md](project_impact_first_redesign.md) — Impact-driven selection decision + validation method
- [project_signal_api_deployed.md](project_signal_api_deployed.md) — newsSignals on S3, key-gated URL, mint-key.mjs
- [project_pair_intelligence.md](project_pair_intelligence.md) — DORMANT: no consumer, cron off; future Studio lens
- [project_site_orientation.md](project_site_orientation.md) — Home value-prop + grouped nav live; no /landing
- [project_spider_demo_world_tier.md](project_spider_demo_world_tier.md) — Unlisted /spider-demo; "possibly related", never "caused"
- [project_cloudflare_worker.md](project_cloudflare_worker.md) — Worker: RSS, bot pre-render, /data/*; POST payloads only
- [project_home_map_lede.md](project_home_map_lede.md) — Deterministic lede; link only with a real threadId
- [project_recommendations_engine.md](project_recommendations_engine.md) — newsRecommend scorer; "For you" = discovery
- [project_agent_kit.md](project_agent_kit.md) — verify gate; ralph-loop never deploys; expect main to move
- [project_docs_reorg.md](project_docs_reorg.md) — Docs live under project-docs/; old bare names → use find
- [project_repo_public_2026_06_23.md](project_repo_public_2026_06_23.md) — Public repo: no secrets in tree; check live bundle hash
- [project_growth_strategy.md](project_growth_strategy.md) — Accounts, SEO keywords, two open distribution to-dos
```

That is 54 entries, about 62 lines and about 7KB.
