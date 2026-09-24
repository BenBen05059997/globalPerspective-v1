<!--
Plan doc for TASK_2026-09-24_pair_arcs_relocation.md Phase 1 (relocate). Written by a
read-only planning agent; execution is a separate pass. Do not start Phase 2 (legacy-map
removal) until this is built, browser-tested, and the task checklist for Phase 1 is checked off.
-->

> **CANCELLED 2026-09-24 (operator: "no build")** after Phase 1 was built and render/toggle-
> verified. Port preserved on branch `archive/pair-arcs-port`; code reverted from `main`.
> Ideas harvested to `_reference/LEGACY_MAP_IDEA_HARVEST_2026-09-24.md`. Kept for the
> verified-data findings (§0) and as the reference if the port is ever revived.

# Pair-arcs ("Connections") relocation onto SituationMap3D — implementation plan

## 0. What was verified before writing this plan

**Live data** (`aws dynamodb scan` against table `SummarizeAndPredict`, `PK begins_with "PAIR#"
AND SK = "PAIR_ANALYSIS"`, 2026-09-24): **15 records**, spanning **14 distinct countries**:
China, Cuba, Iran, Israel, Lebanon, North Korea, Pakistan, Russia, Saudi Arabia, South Korea,
Taiwan, Ukraine, United Kingdom, United States.

**Critical finding — `countries` field is dead.** `usePairAnalyses.js` / the
`pair_analyses_list` handler (`amplify/backend/function/newsSensitiveData/src/index.js` L921-962)
projects a `countries` attribute, and `WorldMapV2.jsx`'s flow-builder (L278) checks
`Array.isArray(p.countries)` first — but `newsPairIntelligence/src/index.js`'s `writeAnalysis()`
(L569-591) **never writes a `countries` array**; it writes `pairA`/`pairB` (full canonical
English names, e.g. `"United States"`, `"North Korea"`) and `PK: PAIR#<slug>`. So in production
`p.countries` is always `undefined` and **every record falls through to slug-parsing**
(`WorldMapV2.jsx` L280-286). The relocated code must do the same — slug-parsing is not a
fallback, it is the only working path. `slug` is built by
`buildCanonicalSlug()` (`newsPairIntelligence/src/index.js` L123-126): both country names are
canonicalized, lowercased, hyphenated, sorted alphabetically, and joined with `-and-`
(e.g. `"iran-and-israel"`, `"china-and-taiwan"`).

**Coordinate reconciliation is a non-issue for the current data.** All 14 live country names
match `src/utils/situationLabels.js`'s `ISO3_NAME` table **exactly, verbatim, case-sensitive**
(CHN→'China', CUB→'Cuba', IRN→'Iran', ISR→'Israel', LBN→'Lebanon', PRK→'North Korea',
PAK→'Pakistan', RUS→'Russia', SAU→'Saudi Arabia', KOR→'South Korea', TWN→'Taiwan',
UKR→'Ukraine', GBR→'United Kingdom', USA→'United States') and all 14 ISO3 codes are present in
`src/utils/countryGeo.js`'s `ISO3_TO_NUM` (so `SituationMap3D`'s existing `iso3Centroid()`
resolves every one of them today). **Zero unresolvable countries at present.** This is the
cleanest possible single source of truth: reuse `ISO3_NAME`, inverted, as the name→ISO3 table —
no need to port `WorldMapV2`'s giant `NUM_TO_A3` / `TOPO_NAME_FIXES` / `EXTRA_ALIASES` tables
(~180 lines) wholesale.

## 1. Source behaviour being ported (`src/components/WorldMapV2.jsx`)

- **`realFlows` useMemo** (L259-306): for each pair record, parses `slug` on `-and-` into two
  lowercased, space-joined country-name strings; resolves each via `nameToISO` (built from the
  topojson's own feature names, L388-424) or `EXTRA_ALIASES`; drops the pair if either side or
  its centroid is unresolvable; computes `stale` from `generatedAt` vs. a 7d/30d `timeWindow`
  cutoff (kept, dimmed+dashed, not dropped); computes `w` ('strong'/'mod') from whether either
  country's *current signal bucket* is H/E (**this dependency does not port** — `SituationMap3D`
  has no per-country signal feed; see §4 decision); classifies `g` (group: `fx`/`tech`/`geo`) by
  regex over `pairTitle`; filters by a `flowFilters` toggle (**not porting** — no per-group UI
  exists on `/map`, out of scope for v1, see open questions).
- **Arc render** (L587-632, inside the `connections` layer branch): quadratic-Bézier SVG path
  between the two projected centroids; `stroke` = `FLOW_COLOR[g]` (`fx:#1e6091 tech:#5b3a91
  geo:#a2442e`); `stroke-opacity` = `(w==='strong'?0.75:0.35) * (stale?0.45:1)`; `stroke-width`
  = `w==='strong'?1.8:1.0`; `stroke-dasharray` = `'3 3'` when stale or not-strong (solid only for
  strong+fresh); click → `navigate('/weekly/country/' + encodeURIComponent(isoToName[fl.a] ||
  fl.a))` — **always navigates to `fl.a`, the alphabetically-first country of the sorted slug**
  (an arbitrary but deterministic parity target, keep as-is). Endpoint circles are also drawn at
  each involved country's centroid, colored by signal bucket, clickable to open the legacy
  country-detail rail (`handleCountryClick`) — this is tied to `WorldMapV2`'s own detail panel
  and has no equivalent target on `/map`; **do not port** (see §4).
- **Toggle**: `LAYERS` array (L115-119) includes `{id:'connections', label:'Connections', sub:
  'bilateral arcs'}`; `layers.connections` state defaults `false` (L147); a sidebar button
  (L732-736ish) flips it.

## 2. Target files and exact changes

### 2a. `src/utils/countryGeo.js` — add the name→ISO3 table

Add, near the existing exports:

```js
// Name → ISO-3, for resolving pair-analysis country-name strings (from newsPairIntelligence's
// slug, e.g. "iran-and-israel") to a centroid via ISO3_TO_NUM. Built by inverting
// situationLabels.ISO3_NAME (same curated country set, same canonical English names the backend's
// canonicalize() produces) plus a short alias list for backend name variants ISO3_NAME doesn't
// carry. Verified against live PAIR# records 2026-09-24 (14/14 resolve).
export const NAME_TO_ISO3 = {
  // ...inverted ISO3_NAME entries, lowercased keys...
  'united arab emirates': 'ARE',   // backend canonicalize() expands "UAE" to the full name
  'czech republic': 'CZE',         // ISO3_NAME uses the short "Czechia"
  'ivory coast': 'CIV',            // NOT in ISO3_TO_NUM today — see risks below
};
```

Import `ISO3_NAME` from `situationLabels.js` at the top of `countryGeo.js` to build this by
inversion at module load (`Object.fromEntries(Object.entries(ISO3_NAME).map(([iso,name]) =>
[name.toLowerCase(), iso]))`), then spread the small alias overlay on top so overlaps favor the
alias (e.g. if a future pair used "UAE" verbatim rather than the backend's expanded canonical
form — the alias list should include both `'uae': 'ARE'` and `'united arab emirates': 'ARE'` to
be safe). Keep this table hand-maintained and small; it only needs to cover names that
`newsPairIntelligence`'s `canonicalize()` (L92-104) can actually produce, not the full 190-country
universe `WorldMapV2` covers for its heatmap/labels.

Why `countryGeo.js` and not a new file: the task doc explicitly calls this out as the fallback
location, and it's already the module SituationMap3D imports for `ISO3_TO_NUM` /
`ISO3_CENTROID_FALLBACK`, so co-locating keeps "country → geometry" logic in one place.

### 2b. `src/components/SituationMap3D.jsx` — add the `pair-arcs` layer

1. Import: `import { NAME_TO_ISO3 } from '../utils/countryGeo.js';` (extend the existing
   countryGeo import line).
2. Add two new props: `pairAnalyses = []` and `showConnections = false`, plus a callback
   `onSelectCountry` (called with an ISO3 string on arc click — kept distinct from `onSelect`,
   which takes a *situation* id and has different semantics/URL target).
3. New `pairArcs` useMemo (co-located near `selectionGeo`, independent of `focusId`):
   ```js
   const pairArcs = useMemo(() => {
     if (!showConnections || !Array.isArray(pairAnalyses)) return [];
     const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // fixed 30d — no time-window UI in v1
     const out = [];
     for (const p of pairAnalyses) {
       if (!p.slug || !p.slug.includes('-and-')) continue;
       const [s1, s2] = p.slug.split('-and-');
       const c1 = s1.replace(/-/g, ' ').trim();
       const c2 = s2.replace(/-/g, ' ').trim();
       const isoA = NAME_TO_ISO3[c1];
       const isoB = NAME_TO_ISO3[c2];
       if (!isoA || !isoB) continue;
       const from = iso3Centroid(isoA), to = iso3Centroid(isoB);
       if (!from || !to) continue;
       const stale = p.generatedAt ? (new Date(p.generatedAt).getTime() < cutoffMs) : false;
       const title = String(p.pairTitle || '').toLowerCase();
       let group = 'geo';
       if (/trade|tariff|export|import|peso|yen|lira|imf|fx|capital|sanction/.test(title)) group = 'fx';
       else if (/chip|semi|fab|ai|tech|cloud|data/.test(title)) group = 'tech';
       out.push({ from, to, isoA, group, stale, label: p.pairTitle || `${isoA}–${isoB}`, slug: p.slug });
     }
     return out;
   }, [pairAnalyses, showConnections]);
   ```
   Note: dropped the `w` ('strong'/'mod') dimension entirely — it depended on `WorldMapV2`'s
   live per-country signal bucket, which `SituationMap3D` doesn't have (it only has *situations*,
   not a country-keyed signal feed). See §4 for why, and the open question below for whether it's
   worth wiring `useCountrySignal` in just for this.
4. New layer, built alongside `selectionLayers` (same file, a sibling `useMemo`):
   ```js
   const GROUP_RGB = { fx: [30, 96, 145], tech: [91, 58, 145], geo: [162, 68, 46] };
   const pairArcLayer = useMemo(() => {
     if (!pairArcs.length) return null;
     return new ArcLayer({
       id: 'pair-arcs', data: pairArcs, pickable: true,
       getSourcePosition: (d) => d.from, getTargetPosition: (d) => d.to,
       getSourceColor: (d) => [...GROUP_RGB[d.group], d.stale ? 90 : 190],
       getTargetColor: (d) => [...GROUP_RGB[d.group], d.stale ? 90 : 190],
       getWidth: (d) => (d.stale ? 1 : 1.8),
       onClick: (info) => info.object && onSelectCountry && onSelectCountry(info.object.isoA),
       updateTriggers: { getSourceColor: [pairArcs], getWidth: [pairArcs] },
     });
   }, [pairArcs, onSelectCountry]);
   ```
   Same-alpha source/target (unlike `spread-arcs`'s directional fade) because a bilateral
   relationship arc has no inherent direction — both ends matter equally; that's a deliberate
   styling delta from `spread-arcs`, not an oversight.
5. Splice into the composed `layers` array (currently L218-223). Insert `pairArcLayer` right
   after `baseLayers[0]` (land) and before the selection-state arcs/fills, so situation pins
   (`core`, drawn last) stay on top both visually and for click-picking:
   ```js
   const layers = [
     baseLayers[0],
     ...(pairArcLayer ? [pairArcLayer] : []),
     ...selectionLayers.filter((l) => l.id !== 'dest-rings'),
     baseLayers[1], baseLayers[2], baseLayers[4], baseLayers[3],
     ...selectionLayers.filter((l) => l.id === 'dest-rings'),
   ];
   ```
6. Extend `getTooltip` (L225-230) to branch on the picked object shape — situations have
   `verb_label`, pair-arcs have `label`/`slug`:
   ```js
   const getTooltip = useCallback(({ object }) => {
     if (!object) return null;
     if (object.slug && object.label) {
       return { html: `<b>${object.label}</b>${object.stale ? '<br/>· older analysis' : ''}`, style: { /* same style object as below */ } };
     }
     if (!object.verb_label) return null;
     // ...existing situation branch...
   }, []);
   ```
7. **Not porting**: the endpoint node circles + their click-to-open-country-panel behavior
   (`WorldMapV2` L616-631). `SituationMap3D` has no per-country detail panel — its rail only
   shows *situations*. Recreating that would require building a new UI surface, out of scope for
   a relocation. The arc itself plus click→`/weekly/country/<name>` is the parity contract per
   the task doc (§5 "interaction parity"), and that's fully preserved via `onSelectCountry`.

### 2c. `src/components/SituationHome.jsx` — wire the hook, prop, and toggle

1. Imports: add `import { useNavigate } from 'react-router-dom';` (currently only
   `useSearchParams, Link` are imported) and `import { usePairAnalyses } from
   '../hooks/usePairAnalyses.js';`.
2. Inside the component: `const navigate = useNavigate();` and
   `const { analyses: pairAnalyses } = usePairAnalyses();`.
3. New toggle state, alongside the existing `view`/`legendOpen` state (~L124-129):
   ```js
   const [showConnections, setShowConnections] = useState(false); // parity default with WorldMapV2 (off)
   ```
4. `onSelectCountry` callback:
   ```js
   const onSelectCountry = useCallback((iso3) => {
     navigate(`/weekly/country/${encodeURIComponent(iso3Name(iso3))}`);
   }, [navigate]);
   ```
   (`iso3Name` is already imported from `situationLabels.js` at the top of this file.)
5. Pass through to `SituationMap3D` (~L167-170, inside the `USE_3D` branch):
   ```jsx
   <SituationMap3D
     situations={situations} focusId={focusId} callout={callout} tour={tourProps} newIds={newIds} view={view}
     onSelect={userSelect} onOpenCallout={userSelect} height={mapH}
     pairAnalyses={pairAnalyses} showConnections={showConnections} onSelectCountry={onSelectCountry}
   />
   ```
   The non-3D `<SituationMap>` fallback (`canUse3D()` false, WebGL unavailable) does **not**
   get pair-arcs in this phase — it's an SVG-free 2D fallback with a different rendering model;
   adding arcs there is out of scope (flag as an open question below, low priority — WebGL is
   near-universal).
6. Toggle button in `.sh-controls` (~L172-183), alongside "Walk me through today" / Flat-Globe /
   Key:
   ```jsx
   {pairAnalyses.length ? (
     <button className="sh-ctl" onClick={() => setShowConnections((v) => !v)} aria-pressed={showConnections}>
       Connections
     </button>
   ) : null}
   ```
   Guard on `pairAnalyses.length` so the button doesn't appear while the (rare) case of zero
   pair records exists — matches the existing pattern where `sh-ctl` buttons already
   conditionally render (`ranked.length >= 2 && !tourOn`, `USE_3D`).

## 3. Interaction & styling parity checklist

| WorldMapV2 (source) | SituationMap3D (target) | Parity |
|---|---|---|
| Toggle default off | `showConnections` default `false` | ✅ same |
| Slug-parsed country names → ISO via topojson-name table | Slug-parsed → ISO via `NAME_TO_ISO3` (inverted `ISO3_NAME`) | ✅ same data, smaller table |
| Centroid via `d3.geoCentroid` on fetched 110m topojson | Centroid via existing `iso3Centroid()` (same `countries-110m.json`, bundled not fetched) | ✅ same geometry, no extra network fetch |
| Color by group (fx/tech/geo) | Same regex, same 3 colors (converted hex→RGB) | ✅ |
| Width/opacity by strong/mod + stale | Width/opacity by stale only (no signal-based strong/mod — see §4) | ⚠️ simplified |
| Dashed line for stale/weak | No dash (deck.gl `ArcLayer` has no dash prop) — alpha/width only | ⚠️ simplified, deck.gl limitation |
| Click → `/weekly/country/<alphabetically-first-country>` | Same, via `onSelectCountry(isoA)` → `navigate` | ✅ same |
| Endpoint node dots, colored by signal, clickable to legacy panel | Not ported (no equivalent target panel) | ❌ dropped, see §2b.7 |
| `flowFilters` (fx/tech/geo checkboxes) | Not ported (no UI for it) | ❌ dropped, all groups always shown when layer is on |
| `timeWindow` (7d/30d) UI toggle | Fixed 30d cutoff, no UI | ❌ dropped |

## 4. Why the signal-based "strong/mod" weight doesn't port cleanly

`WorldMapV2`'s arc strength depends on `useCountrySignal(nameToISO)` — a live per-country
signal-bucket feed keyed by every country in its topojson-derived `nameToISO` map.
`SituationMap3D` has no equivalent: its only country-shaped data is `situations[].iso3_affected`
(which countries a *situation* touches), not a standing per-country signal score. Wiring
`useCountrySignal` into `SituationHome` just to feed this one visual dimension is possible but
adds a second data hook + a second name→ISO resolution path for a cosmetic width/opacity
difference on ≤15 arcs. **Recommendation: skip it for v1** (ship stale/fresh only, as coded
above); revisit only if the operator wants the strong/mod distinction back. Flagged as an open
question below rather than decided unilaterally, since it's a genuine scope call.

## 5. Risks / unknowns

1. **`Ivory Coast` (CIV) is not in `ISO3_TO_NUM`.** Not a problem for any *current* pair record,
   but if `newsPairIntelligence` is ever manually invoked for a pair involving Côte d'Ivoire (or
   any of the ~50 minor countries `situationLabels.ISO3_NAME` doesn't carry — see its comment
   "need not be exhaustive"), that pair will silently fail to resolve and simply won't render an
   arc (same silent-drop behavior as `WorldMapV2` today, so no regression — just noting the
   ceiling). If it matters, add the missing ISO3→numeric-id entries to `ISO3_TO_NUM` (and a
   `NAME_TO_ISO3` alias) when it's next observed live.
2. **`countries` field on the DDB item is dead code** (§0). Nobody currently relies on fixing
   this, but the executor should not "helpfully" try to use `p.countries` — it will always be
   `undefined`. Slug-parsing is correct and is what this plan implements.
3. **Only 15 records / 14 countries exist.** The feature is genuinely thin. It's still worth
   preserving per the operator's explicit 2026-09-24 decision (`CLEANUP_AUDIT_2026-09-24.md` §4
   D3), but the executor shouldn't over-invest in polish (e.g. the dropped `flowFilters`/
   `timeWindow` UI) for a ≤15-arc layer — the simplifications in §3 are intentional, not
   corner-cutting under time pressure.
4. **ArcLayer picking on thin lines can be finicky** at `pickingRadius={16}` (already set
   globally on the `DeckGL` instance) — the existing `spread-arcs` layer is `pickable: false`
   precisely because it never needed picking. `pair-arcs` is the first pickable `ArcLayer` in
   this file; if clicks feel unreliable in testing, widen `getWidth` (e.g. minimum 2.5) rather
   than fighting `pickingRadius` (that's shared with the `core` situation-pin layer and
   shouldn't be widened just for arcs).
5. **Layer stacking**: pair-arcs sit under the `core` situation-pin layer per §2b.5's ordering,
   so an arc passing directly under/behind a pin will lose the click to the pin. Acceptable —
   pins are the primary interaction surface; this mirrors deck.gl's normal "last-drawn wins"
   picking semantics and matches how `spread-arcs` is already ordered relative to `core`.
6. **Performance**: 15 arcs is trivial for deck.gl; no perf risk regardless of how the data
   grows by an order of magnitude or two.

## 6. Step order for the executor

1. Add `NAME_TO_ISO3` to `src/utils/countryGeo.js` (§2a). Sanity-check by hand against the 14
   live country names above (all should resolve).
2. Extend `src/components/SituationMap3D.jsx`: import, new props, `pairArcs` memo, `pairArcLayer`
   memo, splice into `layers`, extend `getTooltip` (§2b).
3. Extend `src/components/SituationHome.jsx`: imports, `usePairAnalyses()`, `showConnections`
   state, `onSelectCountry`, prop-thread into `<SituationMap3D>`, toggle button (§2c).
4. `npm run build` — must pass clean.
5. Browser click-through on `/map` (standing rule, not optional): toggle "Connections" on, confirm
   arcs render (expect up to ~15, fewer after de-dup by shared centroids), hover shows the
   tooltip with `pairTitle`, click an arc navigates to `/weekly/country/<name>` for the
   alphabetically-first country in that pair, toggle off makes them disappear, toggling the
   Flat/Globe view doesn't break arc positions.
6. Update docs per the task file's "Docs to update on completion" list (`ARCHITECTURE.md` map
   section, `CHANGES.md`, `CLEANUP_AUDIT_2026-09-24.md` §4 D3, `INDEX.md` if applicable, and the
   `project_pair_intelligence` memory note) — same commit as the code, per this repo's
   docs-as-code rule.
7. Check off the Phase 1 rows of the task file's completion checklist. Do **not** start Phase 2
   (legacy-map removal) in the same pass unless explicitly told to — the task file gates Phase 2
   on Phase 1 being browser-verified first.
8. Deploy is explicitly deferred to a separate, explicit `./deploy.sh` invocation per the task
   file — do not auto-push.

## 7. Open questions for the operator/monitor

1. **Connections toggle default: off (parity with `WorldMapV2`) or on** (so the relocated
   feature is actually visible without a discovery step)? This plan defaults to **off** for
   strict parity, but given the whole point of this task is to make the feature *reachable*
   again, on-by-default is a defensible alternative.
2. **Is the strong/mod (signal-based) arc-weight distinction worth reproducing** by wiring
   `useCountrySignal` into `SituationHome`, or is stale/fresh alone sufficient (this plan's
   default, §4)?
3. **Arc color scheme**: keep the `fx`/`tech`/`geo` three-color regex classification (this
   plan's default), or collapse to a single "connections" color now that the feature is a small
   accent layer rather than a primary map mode? Three colors adds a legend-explanation burden
   that doesn't currently exist anywhere on `/map`'s legend UI (`.sh-legend` documents axis
   colors and tier glow, not a fourth "flow type" dimension) — this plan does not add a legend
   entry for it, which is arguably an inconsistency worth flagging rather than silently doing.
4. **Non-3D fallback** (`<SituationMap>`, used when WebGL is unavailable): out of scope per this
   plan. Confirm that's acceptable, or scope a follow-up.

## 8. Monitor decisions on §7 (2026-09-24, Fable)

1. **Toggle default: OFF.** `/map` is the flagship hero surface; 15 thin arcs on the default view
   risk clutter without explanation. A visible labeled "Connections" toggle already upgrades the
   feature from "only on an unlinked route" to "one click from the main map" — that satisfies the
   operator's "keep it reachable" intent. (One-line change if the operator later wants it on.)
2. **Signal-based strong/mod weight: SKIP** (ship stale/fresh only, per §4). Not worth a second
   data hook for a cosmetic width delta on ≤15 arcs.
3. **Arc color: SINGLE NEUTRAL ACCENT, not the 3-color fx/tech/geo scheme.** Decisive reason:
   `/map`'s hue already carries meaning (crisis-type / axis per the map-home design). A second,
   unrelated 3-color scheme for arc "flow type" would **collide semantically** with the map's
   existing hue language and would need a legend entry that doesn't exist. Use one muted accent
   (e.g. a desaturated slate/indigo distinct from the axis hues) at stale/fresh alpha. Drop the
   `group` regex classification entirely — simpler transform, no legend debt. Keep the tooltip
   (`pairTitle`) as the way to convey what a connection is about.
4. **Non-3D `<SituationMap>` fallback: OUT OF SCOPE** — WebGL is near-universal; confirmed.
