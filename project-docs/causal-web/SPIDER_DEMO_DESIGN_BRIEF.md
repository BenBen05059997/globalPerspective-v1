# Design Brief — "Causal Web" view (/spider-demo)

## What this page is
The visual centerpiece of an **enterprise analyst sense-making tool**. It shows how news stories about a region/topic **connect and evolve over time**, so a professional analyst (geopolitical-risk or finance) can read a situation fast and defend their read. Current example dataset: Iran.

It is React 19 + d3, served in an existing app with a light editorial aesthetic (cream/"paper" background, serif headlines, rust accent — please match the existing CSS tokens: `--paper`, `--ink`, `--accent`, etc.). It's a prototype; ~10–30 nodes at a time.

## The data we're visualizing
- **Nodes = "story threads"** (one news story tracked across days). Each node has:
  - a **headline** (e.g. "Iran launches missiles at Israel", "Oil prices fall to three-month low"),
  - a **category** → currently the node **color** (military/conflict = red, economics = amber, energy = green, politics = dark red, diplomacy = blue, other = purple),
  - a **time** (peak date / date range),
  - **size** = importance / how connected it is,
  - underlying **daily coverage + sources** (shown on click).
- **Edges = relationships between stories.** Today they're "A may have influenced B" with a time-lag label (e.g. "15d", "11d") and a confidence level (weak/medium/strong).

## What we want the analyst to GET from this view
1. **Read what each story is at a glance** (the headline, not just a colored dot).
2. **See how the situation is connected and how it unfolded over time** — the "web" + a sense of chronology.
3. **Drill in:** click a node → that story's *genesis* (how it formed across days) + sources; click an edge → *why* we think the two are linked + citations.

## Problems with the current layout (see screenshot)
- It's a **random force-directed scatter** — mostly **disconnected dots that don't read as a "web"** and convey no structure or time.
- **Labels overlap and collide** (headlines run into each other) and **clip off the canvas edges** ("...demand ceasefire in", "World nears oil operat").
- **Very sparse edges** (e.g. 3 edges among 15 nodes) so the few connections look lost.
- No sense of **time** even though chronology is central to the story.

## Design direction we want
- **Move away from the random force scatter.** Strongly prefer one (or a combination) of:
  - a **timeline-anchored layout** (e.g. left→right = time / chronology), so the analyst reads how the story unfolded; and/or
  - a **focus + context** approach: don't dump all nodes — let the analyst pick a focal story and see its **neighborhood (ego-network)**, expanding on demand.
- **Make it actually look connected.** Lean on the *reliable* connections (stories that share actors/entities, are the same story continuing, or follow in time sequence) as a **dense backbone**; keep "influenced/caused" arrows as a **sparse, visually-distinct, opt-in overlay** (a toggle), not the main structure.
- **Fix label legibility:** no overlap, no clipping. Options: labels only on hover/selection for non-focal nodes, a clean graph+list combo, leader lines, or collision-aware placement. Headlines must be readable.
- **Honesty (important):** show confidence honestly as weak/medium/strong (never a fake %); it's fine for some nodes to be **isolated** (do NOT invent connections to force a prettier web); never imply more certainty than we have.

## Interactions to preserve
- **Click a node →** side panel: story headline, its **genesis timeline** (daily coverage), a **scenario/"what's next"** block (clearly labeled "💭 model judgment — interpretation, not sourced fact"), and a link to the full thread.
- **Click an edge →** side panel: the **mechanism** (why linked) + **citations** + confidence.
- Keep a **legend** (category colors) and a small footer (node/edge counts, "generated" timestamp).

## The one-line goal
Turn a scattered, unreadable dot-cloud into a **legible, time-aware "story web"** an analyst can read in five seconds and trust — connections that are real, labels that are readable, and a clear way to drill into any story or link.

## Out of scope
No backend/data changes, no auth/multi-tenant. This is purely the **layout + visual + interaction design** of the existing single page (`SpiderDemo.jsx` / `SpiderDemo.css`). Deeper data-model rationale (why causation is a sparse overlay) lives in `SPIDER_WEB_MODEL_PLAN.md` if useful.
