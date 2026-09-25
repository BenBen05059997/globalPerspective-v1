## Remaining redesign topics (design only) — 2026-09-26 — active

**Goal:** finish the design of everything that still has none, so the build can start from a complete, approved set.
- Topics: site navigation, phone layouts, a design-system board, the home-page leftovers, the small pages, and a build order.
- **Design only:** records decisions and canvas boards. No product code is touched without an explicit "build" (operator rule, 2026-09-25).

**Reads / references:**
- `project-docs/ACTION_CHECKLIST.md` (page redesign roadmap + design canvas map)
- `redesign-ux/_active/STORY_WEB_RETHINK_PLAN.md` §7–9 (story mode, legend, tokens T1–T9)
- `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md`, `COUNTRY_VIEW_DISCUSSION.md`, `TRACK_RECORD_AND_STUDIO_RULING.md`
- Current shell: `global-perspectives-starter/frontend/src/app/App.jsx` (27 routes) and `src/app/layout/Layout.jsx` (nav groups brief / intel / markets / acct, footer)
- Design canvas: https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW (sources in `redesign-ux/_reference/wireframe-2026-09-24/`)

**Changes (design artifacts, not code):**
- This file
- `ACTION_CHECKLIST.md` (roadmap + canvas map rows)
- `INDEX.md` row
- One decision section per phase, in this file or the page's own doc
- New canvas boards under `redesign-ux/_reference/wireframe-2026-09-24/` (+ `canvas.json`)

**Docs to update on completion:**
- `ACTION_CHECKLIST.md` roadmap statuses
- `INDEX.md`
- Memory `project_map_home_situation.md`, if the home decisions change

### Live tracker
Each phase runs: research + debate (agents) → canvas board with real data → critic check → operator decision → recorded here. A phase is ✅ only after the operator decides.

| Phase | What gets decided | Status | Commit | Monitor ✓ |
|---|---|---|---|---|
| N · Site navigation | Top menu; how countries, sign-in/account and the retired pages (`/breaking`, `/spider-demo`, `/economy`, `/weekly-markets`) are reached; "AI paused" status line; footer | **Now** | — | — |
| P · Phone layouts | One shared phone pattern for map + slides + time bar (story mode, country card, briefings, track record, Studio) | queued | — | — |
| DS · Design-system board | T1–T9 tokens + shared pieces (StoryPeek, slide card, time bar, solid/dashed/hatched layers, freshness, "model judgment" label, quote/receipt) | queued | — | — |
| H · Home leftovers | Banner vs tour; country shading vs pins; build behind `/map` first; "real Earth on top right" | queued | — | — |
| SP · Small pages | About, whitepaper, privacy, disclosures, contact; membership / account / sign-in, including the signed-out `/account` | queued | — | — |
| B · Build order | The sequence from design to build, with dependencies (C11 story mode first) and operator gates | queued | — | — |

Also open, outside these phases: Studio decisions S5–S10 (`TRACK_RECORD_AND_STUDIO_RULING.md`).

**Completion checklist:**
- [ ] every phase ✅ with an operator decision recorded
- [ ] ACTION_CHECKLIST roadmap + canvas map updated each phase
- [ ] INDEX row
- [ ] status header flipped to `done`
- No code, so no CHANGES.md entry and no verify step.
