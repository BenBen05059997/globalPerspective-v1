## How we store documentation — 2026-10-19 — proposed (operator review)

Why: the operator asked how docs should be stored, learning from how others do it. Code and live AWS are the truth (rules reset 2026-10-19); docs keep intent, decisions and how-to, and must not drift.

### What others do (sources checked 2026-10-19)
- Diátaxis (diataxis.fr): four kinds of doc — tutorial, how-to, reference, explanation; adopt step by step, never pre-create empty folders. For an internal solo project the useful three are how-to (runbooks), reference, explanation (decisions).
- ARCHITECTURE.md (matklad, 2021; rust-analyzer ~500 lines): bird's-eye view, a codemap that names files rather than linking them, **invariants** (including what is deliberately absent); short, only things that rarely change; revisited a couple of times a year.
- Decision records (Nygard 2011, adr-tools, MADR): one numbered 1-2 page file per decision — Status / Context / Decision / Consequences; append-only; a new record supersedes an old one.
- Design docs (Google; Rust RFCs; Oxide RFDs): Goals / Non-goals / Design / Alternatives; once accepted, changes go in a new doc, not edits.
- Docs next to code (Google doc guide; Backstage TechDocs): a README per directory saying what is here and what to read first; "minimum viable documentation", "default to delete", update in the same commit.
- Runbooks (Google SRE book): one per job/alert, written in advance.
- Agent docs (agents.md; Claude Code best practices): short, rules and pointers only; always-rules belong in hooks.

### Where we are (inventory 2026-10-19)
- 179 docs / 42.6k lines in `project-docs/` across 18 topic folders, each with its own `_active/_proposed/_shipped`; plus `internal-docs/` (9), `agent-kit/` (8), `_legacy` (9), reports in `quality/` (32) and `predictions/`.
- `_active/` holds 56 docs; 15 say done, 6 are result reports, 4 are approved rulings — about a quarter are actually active. 6 of 11 `_proposed` are stale (>30 days).
- ARCHITECTURE.md is 1,908 lines (Lambda section 796, Frontend 550); 4 of 10 sampled facts are wrong against live AWS, and it contradicts itself (schedule table vs Lambda sections).
- The Lambda inventory is written 4 times, the frontend 3 times, billing 4 times. INDEX and the onboard skill disagree on which reference wins.
- Backend features (topic selection, situations, countries, signals) have no home; their docs pile into `architecture/` and `redesign-ux/`.

### Target
```
CLAUDE.md                          ≤80 lines: rules, authorization, pointers (done 2026-10-19)
project-docs/
  INDEX.md                         ≤60 lines: one line per LIVING doc, nothing archived
  ARCHITECTURE.md                  ≤400 lines: purpose, codemap (names, not links), **Invariant:** callouts,
                                   cross-cutting concerns, one Mermaid container diagram. No inventories.
  decisions/NNNN-slug.md           decision records, append-only (Status: accepted | superseded by NNNN)
  plans/YYYY-MM-DD-slug.md         live design docs and plans only (cap 10); one `Status:` line
  runbooks/<job-or-alert>.md       Trigger / Check (exact command) / Fix / Escalate / Last verified
  reference/                       GENERATED from code + live AWS (Lambdas, schedules, env key names, S3 prefixes,
                                   routes); never hand-edited
  archive/                         finished plans, reports, legacy, old internal docs; not indexed
src/features/<name>/README.md      ≤40 lines: purpose, routes, entry files, data hooks used, decisions that apply
amplify/backend/function/<name>/README.md   ≤30 lines: purpose, trigger, reads/writes, gotchas (e.g. zip ≠ repo)
CHANGES.md                         frozen archive; git log is the change log
```
Doc types kept: 1 agent rules (CLAUDE.md) · 2 architecture overview · 3 decision record · 4 plan · 5 runbook · 6 feature/Lambda README · 7 generated reference. Reports and audits are dated outputs: they go to `archive/` once read, or stay next to the tool that made them (`quality/`, `predictions/`).

### Lifecycle
- Plan: proposed → active → done. When done, its lasting decisions become decision records, the plan moves to `archive/` in the same commit.
- Decision: accepted → superseded (new record links the old one). Never edited.
- Runbook/reference/README: carry `Last verified: YYYY-MM-DD`; anything not verified in 6 months is re-checked or deleted.

### Anti-drift (solo, no CI)
- Generated reference: `scripts/gen-reference.mjs` builds `reference/` from `scripts/functions.json` (already built from live AWS by B4), `aws events`/`scheduler`, `App.jsx` routes and `src/features`. Re-run on any architecture change (the Stop hook already reminds).
- `quality/check_docs.mjs` (runs with the other ratchets): size caps, INDEX lists only existing living docs, no `Status: done` left in `plans/`, every feature folder and Lambda has a README.
- Name files instead of linking them; facts that change live in code or the generated reference, never in prose.

### Migration (parallel, one commit per step, no content invented)
| Step | Work |
|---|---|
| D1 | Create the folders; `archive/` receives `_legacy`, `internal-docs` history, the 15 done `_active` docs, result reports, stale `_proposed` (operator confirms the stale list) |
| D2 | Extract decision records from existing rulings and plans (DS1 tokens and tier rule, crisis hues 10-19, editorial done-not-said, DATA_STRATEGY storage rules, economy parked, credits parked, Pages→Cloudflare migration, rules reset 10-19) — each cites its source doc |
| D3 | `scripts/gen-reference.mjs` + `reference/`; delete the hand-written inventories (BACKEND_GUIDE, SYSTEM_WIRING tables, ARCHITECTURE Lambda/DynamoDB/Scheduling sections) once the generated version covers them |
| D4 | Rewrite ARCHITECTURE.md to ≤400 lines (codemap + invariants + diagram), verified against code |
| D5 | Feature READMEs (13 frontend features) and Lambda READMEs (39), each checked against the code |
| D6 | Runbooks per scheduled job/alert from `ops/` + playbooks; INDEX rewritten; onboard skill points to INDEX → ARCHITECTURE; `quality/check_docs.mjs`; fix `scripts/test_pre_commit_hook.sh` (still tests the old CHANGES.md rule) |

### Decisions for the operator
1. Adopt this structure (yes/no/changes).
2. Archive rather than delete old docs (recommended: archive; delete later).
3. Run D1-D6 after wave 2 merges, in parallel with wave 3 (docs only, no code), or now.
