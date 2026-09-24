<!--
Task file per project-docs/playbooks/TASK_WORKFLOW.md. Written before starting, per the
new task-file convention. Operator decision 2026-09-24: preserve the pair-arcs feature by
relocating it onto the live /map (SituationHome) BEFORE removing the legacy map — chosen over
retiring the feature. Follows from CLEANUP_AUDIT_2026-09-24.md §4 D3.
-->

> **CANCELLED 2026-09-24 (operator: "no build").** The Phase 1 port was built and verified
> rendering/toggling, then the operator cancelled the relocation — the new map is the design;
> legacy ideas are harvested as concepts instead (`_reference/LEGACY_MAP_IDEA_HARVEST_2026-09-24.md`).
> The working deck.gl port is preserved on branch **`archive/pair-arcs-port`**; the feature code
> was reverted from `main`. Phase 2 (legacy-map removal) proceeds as pure cleanup.

## Pair-arcs relocation, then legacy-map removal — 2026-09-24 — done (cancelled)

**Goal:** Preserve the pair-arcs ("Connections") feature — currently displayed ONLY by the
legacy `WorldMapV2` on the unlinked `/map-legacy` route — by relocating it as a toggleable
layer onto the live `/map` (SituationHome / SituationMap3D, deck.gl GlobeView). THEN remove the
legacy map. Two phases; deploy (gated) only after Phase 2 and a browser test.

Why: the map-home redesign took `/map` (SituationHome), pushing WorldMapV2 to `/map-legacy`, so
the arcs have been reachable only via a hidden route. The weekly `TriggerPairIntelligenceWeekly`
cron (ENABLED) still produces the data. Operator chose preserve-and-relocate over retire.

**Reads / references:**
- `src/components/WorldMapV2.jsx` — source impl: `usePairAnalyses()` (L165) → `flows` transform
  (L256-306, pair→{a,b ISO, weight, group, label, slug, stale}) → SVG arc paths (L601-613),
  click → `/weekly/country/<name>`; "connections" layer toggle (L117).
- `src/components/SituationMap3D.jsx` — target impl: already imports `ArcLayer`; already renders
  a `spread-arcs` ArcLayer (L206-208) with `getSourcePosition/getTargetPosition` from centroids;
  centroid resolution via `ISO3_TO_NUM`/`ISO3_CENTROID_FALLBACK` (`utils/countryGeo.js`) +
  `geoCentroid`. THIS is the pattern the pair-arcs reuse.
- `src/components/SituationHome.jsx` — hosts SituationMap3D (lazy), owns layer-toggle UI.
- `src/hooks/usePairAnalyses.js` — the data hook (keep; gains a second consumer).
- `CLEANUP_AUDIT_2026-09-24.md` §4 D3.

**Changes (code):**
- Phase 1 (relocate — build the feature):
  - `src/components/SituationMap3D.jsx` — add a `pair-arcs` ArcLayer fed by pair data transformed
    to `{from:[lon,lat], to:[lon,lat], weight, label, slug}` via the existing centroid resolver;
    reconcile WorldMapV2's name→ISO2 lookup with this file's ISO3→centroid system; click →
    `/weekly/country/<name>` parity; gate on a layer-visible prop.
  - `src/components/SituationHome.jsx` — call `usePairAnalyses()`, pass arcs + a "Connections"
    layer toggle into the existing layer-control UI.
  - (possibly) `src/utils/countryGeo.js` — add any missing name→ISO helper if the reconciliation
    needs it; prefer reusing what exists.
- Phase 2 (remove legacy map — AFTER Phase 1 verified in browser):
  - `src/App.jsx` — remove `WorldMapV2` import (L23) + `/map-legacy` route (L103).
  - delete `src/components/WorldMapV2.jsx`, `src/components/WorldMapV2.css`.
  - delete 3 tests that render it: `src/test/{signalFilters,searchBar,layers}.test.jsx`
    (macroValues.test.js only mentions it in a comment — KEEP).
  - `usePairAnalyses.js` stays (now consumed by SituationHome).

**Docs to update on completion:**
- `ARCHITECTURE.md` map section — WorldMapV2 removed; pair-arcs now a layer on `/map`
  (SituationHome); component/count adjustments; "no longer routed" prose.
- `CHANGES.md` — dated entries (Phase 1 relocate; Phase 2 remove).
- `CLEANUP_AUDIT_2026-09-24.md` §4 D3 → mark relocated + legacy map removed.
- `INDEX.md` — if any map-doc row references WorldMapV2.
- memory `project_pair_intelligence` — correct the stale "pair_analyses_list powers /map arcs
  (do NOT remove)" note: arcs now live on SituationHome's Connections layer, not WorldMapV2.

**Completion checklist:**
- [x] Port plan written + reviewed (Sonnet drafts, monitor reviews) before any code
- [x] Phase 1: pair-arcs render as a toggleable layer on `/map`; click parity; `npm run build` passes
- [x] ~~Browser click-through of `/map` — arcs appear, toggle works, click navigates (standing rule)~~
      MOOT — Phase 1 port reverted from `main` (preserved on `archive/pair-arcs-port`) when the
      operator cancelled the relocation; the cancelled-path executed is removal-without-port
      (Phase 2 below), not the port going to production.
- [x] Phase 2: legacy map + route + 3 tests removed; `npm run build` + `npx vitest run` pass —
      **EXECUTED 2026-09-24** via the cancelled-path (pure removal, no relocation): `WorldMapV2.jsx`/
      `.css`, the `/map-legacy` route, `usePairAnalyses.js`, and `signalFilters`/`searchBar`/
      `layers`.test.jsx deleted; build clean, vitest 16 files / 193 tests passing (was 19/235).
- [x] Docs updated (same commits as code) — CHANGES.md done for Phase 1; ARCHITECTURE.md/
      CLEANUP_AUDIT_2026-09-24.md §4 D3/INDEX.md updated in the Phase 2 (removal) commit
- [x] CHANGES.md entries added (Phase 1 entry added; Phase 2 removal entry added)
- [ ] Deploy: deferred to an explicit gated `./deploy.sh` (this IS a visible-surface change — needs
      a real deploy to reach prod, unlike the pure dead-code deletions; do NOT auto-push)
- [x] Status header flipped to `done (cancelled)` — see banner at top of this file
