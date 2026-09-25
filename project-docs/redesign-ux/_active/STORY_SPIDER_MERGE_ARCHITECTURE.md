# Story page × spider page — architecture and merge plan

**Status:** APPROVED direction (operator, 2026-09-25: "the recommendations are solid, align with that"); nothing built yet. Companion to
`STORY_DOSSIER_BOARD_DESIGN_BRIEF.md`. The facts come from a read-only code map of both pages (file:line references below).

## 1. What each page is today

| | Story page (`/weekly/thread/:id`) | Spider page (`/spider-demo`) |
|---|---|---|
| Unit | **One story** (a thread of daily news entries) | **A web of stories** for one country (or all countries in the World tier) |
| Frontend | `features/threads/ThreadPage.jsx`: tabs Overview / Timeline / Actors / Sources / Economy + a Live Signals rail | `features/spider-demo/SpiderDemo.jsx` (`CausalWebSVG`, `NodePanel`, `EdgePanel`, `DossierProvenance`) + `SpiderWorld.jsx` |
| Reads (all via `newsSensitiveData`) | `narrative_thread` (entries from the topics archive), `thread_analysis` (`THREAD#id / THREAD_ANALYSIS` + latest `DRIFT#`), `prediction_snapshot` (`PRED#topicId`), `economic_impact` (`ECON#THREAD#id`) | `systems_analysis` (`SYSTEMS#country / SYSTEMS_ANALYSIS`), `world_overview` (scan of `SYSTEMS#` + country intel + drift), `dossier_analysis` (built per click), plus `narrative_thread` and `prediction` for the side panel |
| Written by | `newsThreadAnalysis` (story arc, root cause, actors, 4 axes), `newsDriftCorrector`, `newsEconomicImpact`, the prediction Lambda | `newsSystemsAnalysis`, daily 07:15 UTC, DeepSeek v4-pro, **top 10 countries by 30-day article volume** (rotates daily; live env `SYSTEMS_TOP_N=10`, verified 2026-09-25; the code default is 5) |
| "Why" content | `rootCauseChain`: one prose chain *inside* the story (trigger → enabling condition → structural factor) | Links *between* stories: **backbone** edges (shared actor, computed deterministically) and **causal** edges (model judgment: mechanism, lag, confidence, cited entries, temporal-anomaly flag) |

**The key fact:** a spider node **is** a story, because node `id` = `threadId` (`newsSystemsAnalysis` nodes; `dossier.js:71`).
The spider graph is literally a map of how stories connect, and the story page is one node of it.
`dossier_analysis(country, threadId, hops=1)` already cuts out one story's neighbourhood.

## 2. Correction to the wireframe
The dossier wireframe's "causal web" put a story's *own events* on the lanes. The real data puts **stories** on the lanes.
So the dossier's "Why it's happening" section becomes two layers:
1. **Inside the story:** the `rootCauseChain` as 3 linked steps (trigger → condition → structural). Every story has this.
2. **Around the story:** the focal story in the centre of the spider lanes, with its 1-hop neighbour stories.
   - Solid lines are shared actors (✅ fact, deterministic).
   - Dashed lines are causal influences (💭 model judgment, with mechanism + confidence).
   - Click a neighbour to see its StoryPeek, or open it.
   - This part appears only when the story is in a country the web covers today.

## 3. Problems to fix before merging
1. **Per-click LLM.** `dossier_analysis` re-reads the graph and calls DeepSeek (v4-flash) on *every* click,
   uncached. That's slow and a cost per view, and it fails during the current DeepSeek outage.
   The page should show the **stored graph only** (no LLM on view). **That path already exists:** the sibling action
   `event_dossier` returns the same dossier *without* the LLM call (`newsSensitiveData/src/index.js:872-877`). The prose
   "explain this web" moves to the Analysis Studio (the existing rule: on-demand analysis lives in the Studio).
2. **No story → web lookup.** Graphs are stored per country, and `event_dossier` needs the country as well as the
   `threadId`. Stage 1 (no backend change): pass the story's country from its entries' `regions` and show the web if
   the story is in that country's graph. Stage 2 (cleaner): when `newsSystemsAnalysis` writes `SYSTEMS#country`, also write a small per-story record
   (`THREAD#id / SK=WEB`, same TTL) holding the story's 1-hop neighbourhood. It's a dedicated record, one read per page, and no scan.
3. **Coverage.** Only ~10 countries get a web each day, so most stories have no "around" layer. The honest default:
   show the "inside" chain always, and the "around" web when present. It is labelled "web coverage: top countries by news volume",
   never faked. Widening coverage is a cost decision for later (after DeepSeek is funded).
4. **Stale country list.** `SpiderDemo.jsx:20-23` still hard-codes 12 countries, but the backend switched to a rotating
   top-10 on 2026-09-14. Derive the list from the data instead.

## 4. Making them one system (shared pieces)
| Shared piece | Used by |
|---|---|
| `CausalWeb` component (extracted from `CausalWebSVG`), three scales: **ego** (one story + neighbours), **country**, **world** | Dossier section 2 (ego) · Country page "web" section (country tier, the spider country view's new home) · Intel board WEB view (world tier, from `world_overview`) |
| One edge vocabulary: solid = shared actor ✅, dashed = causal 💭 (with confidence), temporal-anomaly edges hidden but counted | All three scales + the console's "possibly related" lines, if approved |
| `StoryPeek` / `StoryLink` (already specified) | Every node and neighbour |
| `CompactTimeline` (already shared) | Dossier timeline + spider node panel |
| One route helper (`threadPath` → `/story/:id` after the C6 rename) | Everything |

**After the merge `/spider-demo` has no job left**: its country tier lives on the country page, its World tier is
the board's WEB view, and its node panel is the dossier. It retires (redirect to `/stories?view=web`).

## 5. Suggested order
1. Frontend only: extract `CausalWeb` from SpiderDemo; the dossier "around the story" layer reads `event_dossier`
   (no LLM) with the story's country. No backend change needed to start.
2. Backend, optional: `newsSystemsAnalysis` also writes `THREAD#id / WEB` (ego record), so any story finds its web in
   one read without knowing the country. A small change with no new LLM calls.
3. Board WEB view on `world_overview`; country page web section; retire `/spider-demo`.
4. Move the per-click `dossier_analysis` prose into the Studio as an on-demand lens.

## Decisions (operator, 2026-09-25)
- No AI on page views: pages read the stored web via `event_dossier`; the written explanation moves to the Studio.
- Start frontend-only: no edits or deploys to any Lambda for step 1. Both pages already share `newsSensitiveData`,
  and `event_dossier` already exists there. The optional per-story `WEB` record is the only step that touches backend code.
- Web coverage stays at the top 10 countries until DeepSeek is funded.

## Live check (2026-09-25, public proxy, read-only)
- `event_dossier` works live for the AfD story and returns the focal node with **no LLM call**.
- **Link density varies a lot:** Germany's web has 3 stories and 0 links, so the AfD story has no neighbours and its
  "around" layer would be omitted. The United States web has 15 stories, 6 causal + 17 shared-actor links, and 11 connected stories.
  `world_overview` covers 16 places (including regions like Europe / Middle East) with 41 cross-country links.
- **Webs are frozen by the DeepSeek outage:** the newest were built 2026-09-12 (Germany 2026-09-10). The page must show the
  web's own "built X ago" date, as the rest of the site does.

## 6. Frontend design: debate outcome (2026-09-25). SUPERSEDED in part by `STORY_WEB_RETHINK_PLAN.md` §5 (news-based, not country)
**Process:** a reference research pass, then three advocates, then two critics (reader/analyst and engineering/data-honesty), then the monitor's ruling.
- **Research:** Recorded Future Intelligence Card, Connected Papers, Obsidian local graph + linked references, Kumu,
  GDELT, explainer journalism, and ego-network / edge-uncertainty / graph-literacy / accessibility papers. The research favours a list first and an optional graph.
- **Positions:** A, a lane web (the spider SVG at ego scale). B, a before/after flow (Connected Papers style). C, an orbit (a radial radar disc).
  All three advocates misdrew edge direction or invented chain text. Both critics concluded that direction must be *written*, not left to arrowheads.

**What the real data forced:**
- The best-connected US story has 3 outgoing and 0 incoming causal links. "Before" is almost always the story's own root-cause chain.
- Backbone links are often trivial (a single shared actor such as "Donald Trump").
- `rootCauseChain` is a string on most stories and an object `{proximate, medium_term, deeper_structural}` on 11 of them,
  as long paragraphs with no short labels. This crashed the live story page; it was fixed in `e7f5842` and is not yet deployed.
- `event_dossier` takes **~9 s**: per-node genesis reads over 90 archive days, and it holds one of the 4 proxy slots.
  `systems_analysis` returns a whole country web in **0.12 s**. **Ruling: the page reads `systems_analysis` and extracts the ego view client-side**
  (a port of the pure `subgraphIds`/`assembleDossier` from `dossier.js`, hops = 1, without genesis). This supersedes §3.1's "use `event_dossier`".
- Citations are headline strings, not entry ids, so they can be listed but not linked.
- Categories are free text (technology, climate, society, military…), so map them the way `categoryToLane` does.

**RULING: "Chain, then consequences"** (a synthesis of both critics; list first; nothing drawn that the data doesn't say)
1. **Header:** `WHY IT'S HAPPENING` · chip `Web as of 12 Sep · this story has N updates since` (N counts entries after
   `generatedAt`; the chip turns amber after 7 days) · `Analysis 12 Sep`.
2. **How we got here** (label: *AI analysis*). The object shape shows three fixed labels taken from the data keys: **Trigger / Enabling
   condition / Structural factor**. Each step shows its first sentence (abbreviation-safe, ≤160 chars at a word boundary) and a per-step
   "Read full" expander. The string shape shows one clamped paragraph. No generated summaries.
3. **Earlier stories judged to feed in** (*model inference*): shown **only if ≥1 incoming edge**. Otherwise one muted line:
   "No earlier story in this web is linked into this one."
4. **Judged to feed into** (*model inference*; never "led to" or "caused"). A strip first: `Spilled into: ■ ECONOMY ■ CONFLICT ■ POLITICS`.
   - Rows are sorted by confidence, then lag. Each row: category chip · headline as a StoryLink with StoryPeek · `+26d · 11 Sep` · `●●● strong` (word always
     shown) · the mechanism sentence verbatim · a "3 cited headlines" disclosure · a muted fact line `Shared actors: Iran, Strait of Hormuz`.
   - Weak rows are dimmed with a dashed left rule.
5. **Shares actors with** (*fact, not a causal claim*): chips, excluding stories already listed above. Weight ≥ 2 shows by default;
   weight-1 links collapse to "+1 story shares only 'Donald Trump'" (expandable).
6. **Optional time strip:** only when there are ≥3 causal neighbours and the viewport is ≥600 px. One row, x = date, dots coloured by category,
   `aria-hidden` (the list is the accessible version). "Open the full web →" goes to the country web (today `/spider-demo`; later the country page).
7. **Provenance footer** (the existing DossierProvenance idea): `3 model links · 2 shared-actor links · 1 hidden (date inconsistency)`.
8. **States:**
   - Loading: skeleton rows.
   - Story in a web but with 0 links: one line.
   - **No web for this story's country this cycle:** "Webs cover the 10 busiest countries, rotating daily." This must read differently from 0 links.
   - Story in several webs: one line "Also in the Iran / Middle East webs →".
   - Fetch error: render nothing and report to the error sink.
   - Mobile: one column; ≥40 px targets; no time strip.
   - Reduced motion: no transitions.
9. **Home story card:** WHY shows the same three labels with the first sentence only, 2 lines, no expander. No web line in v1, so no extra fetch per card.
   Revisit once per-story `WEB` records exist.

**Build size (engineering critic's estimate):** the hook plus ego port ~120 lines, the section ~200, the chain helper ~40 (done as
`shared/lib/rootCause.js`), the time strip ~120, CSS ~80. Frontend only.

**~~Blocking data issue~~ CORRECTED 2026-09-25: the table's TTL is DISABLED, so nothing expires (see `STORY_WEB_RETHINK_PLAN.md`). The note below was wrong:** every `SYSTEMS#` web has a 14-day TTL (`newsSystemsAnalysis` index.js:25), and the cron
stopped producing on 09-12 (DeepSeek outage). The US web expires **2026-09-26 07:15 UTC** (verified via `ttl`); Germany, France and Japan
have already passed theirs. Once DynamoDB deletes them, every story shows "no web" until DeepSeek is funded and the 07:15 UTC cron
rebuilds them from the archive. So this is a temporary gap, not permanent loss, since the webs are regenerated from source. Options: extend the TTL on the
existing items (a non-destructive write) to keep the Sep-12 webs visible with honest "as of" labels, or accept the gap.
