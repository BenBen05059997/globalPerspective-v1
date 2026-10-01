## Stories BOARD + WEB views, spider-demo retirement, leftover fixes — 2026-10-02 — active

**Goal:** finish the approved Stories board (REDESIGN_MASTER_PLAN §3.4 B4: BOARD / TABLE / MAP / WEB; TABLE = the A list, plus the 2026-10-01 C timeline), retire `/spider-demo` into WEB (§3.1, §3.9), and close the leftovers from the dark-site release. Operator 2026-10-02: "ok you can execute the rest"; standing ruling 2026-10-01: "Follow the master plan".

**Binding rules:** master plan §1 honesty rules (never invent; model output labelled "model judgment"; "judged to feed into", never "caused"; no placeholder UI; stale looks stale; public data never gated on sign-in); DS1 tokens only (risk = word + ring weight + number, no traffic-light; crisis hue = crisis type; amber = warnings/staleness); shared blocks (`shared/ui`); no deploy / docs/ edits / AWS / Cloudflare without the monitor; nothing removed beyond what this file lists.

**Reads / references:** approved wireframe `redesign-ux/_reference/wireframe-2026-09-24/Board.dc.html` (B4: BOARD columns ▲ escalating / ● new / ◆ steady / ▼ cooling with sparkline cards; TABLE; MAP; WEB story graph — "THE 14 MOST-LINKED STORIES · X = PEAK DATE", lanes by category, dashed links weighted by confidence, "STRONGEST LINKS · LIST VIEW OF THE GRAPH", footnote "DASHED = MODEL JUDGMENT · NEVER 'CAUSED' · MERGED FROM N ANALYSES, NEWEST <date> · K OLDER THAN 30 DAYS HIDDEN") and `StoryWeb.dc.html`; `STORY_WEB_RETHINK_PLAN.md`; master plan §3.3–§3.4; `TASK_2026-10-01_dark_site_shared_tokens.md` (P4 Stories build); `TASK_2026-09-30_batch4_scoring_web_share.md` (D8 web data: `web_index`, `THREAD#id/WEB`, `WEB#INDEX/LATEST`); `features/threads/` (`lib/storyGroups.js`, `hooks/useWebIndex.js`, `useStoryLinks.js`), `features/spider-demo/`.

### Phases
**P7a · Leftovers + BOARD**
1. Topic-tag dots: colour = crisis type only (master plan "hue = crisis type"): `CategoryTag` and any `CATEGORY_DOT` dots (daily, country, map panel, Stories) use the crisis hue of the topic's crisis mapping (`shared/lib/crisisHue`), or no dot when unmapped. Retire the 12-colour palette where nothing else needs it.
2. Country page map hero framing: on `/weekly/country/:name` the live Google map strip shows the far north with the country marker under the card. Make the visible strip centre on the country (fit its bounds within the visible band). Verify on the live-data harness AND note that Google Maps needs the live key (dev lacks it) — if unverifiable locally, implement against the SVG fallback + the Google `fitBounds`/padding API and say so.
3. BOARD view (`/weekly?view=board`): four columns ▲ escalating / ● new / ◆ steady / ▼ cooling. **Status must be derived honestly from real data** and the rule shown in a caption (wireframe: "STATUS FROM TREND + ACTIVITY + WHAT-CHANGED"): e.g. new = first coverage within 3 days; escalating = coverage rising (last 3 days > previous 3) or a real tier rise from analysis history; cooling = no coverage in the last N days or falling; steady = otherwise — pure function in `lib/storyGroups.js` with tests; label the glyphs with what they measure. Cards: crisis hue, kicker (crisis type · place), title, small activity sparkline from real per-day counts, TierChip, sources, updated; StoryPeek on hover; same filters as the list. Phone: BOARD collapses to a single-column list grouped by status (no 4-column layout under 900px).
Views become List | Board | Timeline | Map | Web (List = TABLE).

**P7b · WEB + spider-demo retirement**
4. WEB view (`/weekly?view=web`): story graph from the real web data (`web_index` / per-story WEB records; read how `useWebIndex`/`useStoryLinks` fetch it): the N most-linked stories (default 14) as nodes in crisis-type lanes, x = peak date, dashed links (thicker = stronger, confidence words), hover/focus StoryPeek, click opens the story; an accessible list twin "Strongest links": "<from> ↓ judged to feed into · <confidence> · <n> webs → <to>" with the mechanism text labelled "model judgment"; footnote computed from data: analyses merged, newest date, how many older than 30 days hidden. Empty/thin data: honest state, never padded. Phone: the list twin is the default; the graph scrolls horizontally inside its frame.
5. Retire `/spider-demo`: redirect to `/weekly?view=web` (LegacyRedirects), delete `features/spider-demo/` once nothing imports it, update guards/sitemap notes/Worker repo copy references.

**P7c · Master-plan gap audit (read-only, parallel)** — a separate agent compares REDESIGN_MASTER_PLAN §3 item by item with the code/live site and lists what is built, partially built, or missing; the monitor turns real gaps into P8.

### Changes (code) — filled by each phase before coding
- P7a: …
- P7b: …

### Docs to update on completion
`ARCHITECTURE.md` (routes: views, spider-demo redirect; threads feature map), `REDESIGN_MASTER_PLAN.md` §3.4 + build status, `CHANGES.md` per phase, `INDEX.md` row, `STORY_WEB_RETHINK_PLAN.md` status line if it tracks the board WEB.

### ▶ LIVE TRACKER
| Phase | What | Status |
|---|---|---|
| P0 | Plan (this file) | ✅ 2026-10-02 |
| P7a | Topic dots → crisis hue, country map framing, BOARD view | ⏳ |
| P7b | WEB view, /spider-demo → WEB | — |
| P7c | Master-plan gap audit (read-only) | ⏳ |

**Completion checklist:**
- [ ] code
- [ ] docs updated (same commits)
- [ ] CHANGES.md entries
- [ ] verify + verify_pages exit 0; live-data browser checks at 1440 + 390
- [ ] no deploy — waits for operator yes
- [ ] status → done
