# Pair Intelligence UI — Implementation Plan

**Phase 1.6** — surface the 15 pair intelligence records sitting in DDB to users.
**Target:** production-ready MVP matching existing CountryPage design language.

---

## Goals

- Make pair analyses viewable at deterministic URLs (`/weekly/pair/:slug`)
- Provide a discovery page (`/weekly/pairs`) listing all 15 available pairs
- Match existing frontend patterns (CountryPage, ThreadPage) — no new UX vocabulary
- SEO-friendly, shareable, mobile-responsive, analyst-depth
- Graceful handling of `sparse` / `thin` dataQuality records

## Non-goals (v2+)

- Animated arc between countries
- Pair comparison view (A×B vs A×C)
- Historical pair analysis versioning / changelogs
- Personalized "watch this pair" notifications
- Parallax / scroll-reveal animations

---

## Architecture

```
User → /weekly/pair/:slug  → PairPage.jsx
                           → usePairIntelligence(slug)
                           → restProxy (action=pair_analysis)
                           → newsSensitiveData Lambda
                           → DDB GetItem PAIR#{slug} / PAIR_ANALYSIS

User → /weekly/pairs       → PairListPage.jsx
                           → usePairAnalyses()
                           → restProxy (action=pair_analyses_list)
                           → newsSensitiveData Lambda
                           → DDB Query PK begins_with PAIR#
```

---

## Backend changes

### `newsSensitiveData/src/index.js`

Add two new actions:

**1. `pair_analysis`** — single pair
```
GET /?action=pair_analysis&pair=iran-and-israel
→ DDB GetItem { PK: "PAIR#iran-and-israel", SK: "PAIR_ANALYSIS" }
→ returns { pairTitle, currentState, timeline, trajectory, rootDriver, predictions, watchItems, dataQuality, countries, generatedAt }
```

**2. `pair_analyses_list`** — all pairs (for discovery page)
```
GET /?action=pair_analyses_list
→ DDB Scan (cheap — only 15 records, single-page) with FilterExpression PK begins_with "PAIR#" AND SK = "PAIR_ANALYSIS"
→ returns [{ slug, pairTitle, leadSentence (first 200 chars of currentState), dataQuality, countries, generatedAt }, ...]
→ Sort by dataQuality rank (rich → moderate → sparse → thin), then generatedAt DESC
```

Both public (no auth — consistent with other weekly content actions).

---

## Frontend changes

### New files

**Hook:** `src/hooks/usePairIntelligence.js`
- Pattern: mirror `useCountryIntelligence` — uses AuthContext, 30min localStorage cache, keyed by user.uid
- Takes pairSlug (kebab-case)
- Returns `{ data, loading, error }`

**Hook:** `src/hooks/usePairAnalyses.js`
- Lists all pairs, cached 30min
- Returns `{ analyses: [...], loading, error }`

**Component:** `src/components/PairPage.jsx` + `PairPage.css`
- Hero: Google Map with both country halos + neutral arc between capitals
- Data quality badge (top-right of hero)
- Sections (in order, all scroll-visible, no tabs):
  1. Current State (narrative paragraphs)
  2. Root Driver (3-layer vertical reveal: Layer 1 large/bold → Layer 2 medium → Layer 3 small, with vertical connector)
  3. Timeline (5-7 event cards, vertical rail with dates)
  4. Trajectory (narrative paragraph)
  5. Predictions (card grid — claim / timeframe-confidence pill / mechanism)
  6. Watch Items (card grid — actor / indicator / why)
  7. Methodology + dataQuality disclosure (footer, small print)
- ShareButtons with pair-specific path
- IntelligenceLoader for loading state
- Graceful "No analysis available" if pair not in DDB

**Component:** `src/components/PairListPage.jsx` + `PairListPage.css`
- Grid of cards (3-col desktop, 2-col tablet, 1-col mobile)
- Each card: mini Google Map thumbnail showing both countries, pairTitle, lead sentence (from currentState), dataQuality badge, timestamp
- Card links to `/weekly/pair/:slug`
- Sort: dataQuality DESC (rich first), then generatedAt DESC
- IntelligenceLoader for loading

### Modified files

**`src/App.jsx`**
- Add routes: `/weekly/pair/:slug` → PairPage, `/weekly/pairs` → PairListPage
- Lazy-load both components (consistent with existing pattern)

**`src/services/restProxy.js`**
- Add `pair_analysis(slug)` and `pair_analyses_list()` proxy helpers (if the file has action-specific wrappers; otherwise generic `proxyAction` already handles this)

**Navigation** — optional link surface (v1 can defer)
- Add "Pairs" item to main nav or /weekly hub page
- Add "Related pairs" links from CountryPage (e.g., Iran page → "Iran × Israel" card)

---

## Data shape (DDB PAIR_ANALYSIS record)

```json
{
  "pairTitle": "Iran-Israel Open Conflict and Nuclear Breakout",
  "currentState": "...narrative...",
  "timeline": [
    { "date": "2026-02-28", "event": "...", "significance": "..." }
  ],
  "trajectory": "Three scenarios... 1) Escalation... 2) Stalemate... 3) De-escalation...",
  "rootDriver": {
    "layer1": { "date": "2026-02-28", "actor": "Israel", "action": "Airstrike on Khamenei compound" },
    "layer2": "Structural pattern...",
    "layer3": "Historical context..."
  },
  "predictions": [
    { "claim": "...", "timeframe": "by 2026-05-15", "confidence": 0.65, "mechanism": "..." }
  ],
  "watchItems": [
    { "actor": "Assembly of Experts", "indicator": "Public statement on X", "why": "..." }
  ],
  "dataQuality": "rich",
  "countries": ["Iran", "Israel"],
  "generatedAt": "2026-04-18T..."
}
```

Shape confirmed from existing records — no schema changes needed.

---

## Visual design specifics

**Colors:**
- Neutral text/background (match DailyPage)
- Accent on confidence pills: green (>0.7), amber (0.4-0.7), red (<0.4)
- dataQuality badge: rich=dark green, moderate=green, sparse=amber, thin=gray (with "limited data" tooltip)

**Typography:**
- Serif headings (existing pattern)
- Sans body
- Layer 1 of rootDriver: 28px serif
- Layer 2: 20px serif
- Layer 3: 16px sans italic

**Map hero:**
- Google Map (reuse existing component), centered on midpoint of two country bounding boxes
- Both countries with subtle halo overlay (same neutral color, e.g., rgba(0,0,0,0.08) fill)
- Thin straight line (not animated) connecting capital coordinates
- Pair title + lead sentence overlay (bottom-left or centered)

**Responsive breakpoints:**
- Desktop: ≥1024px — 3-col card grids, full-width hero map
- Tablet: 768-1023px — 2-col grids, shorter hero
- Mobile: <768px — 1-col, hero collapses to ~40vh

---

## Implementation order

1. **Backend** (15min) — add `pair_analysis` + `pair_analyses_list` actions to `newsSensitiveData`
2. **Hooks** (15min) — `usePairIntelligence`, `usePairAnalyses`
3. **PairPage component** (60min) — hero + 7 sections + CSS
4. **PairListPage component** (30min) — grid + card + CSS
5. **Routing** (5min) — App.jsx
6. **Deploy backend** — upload new `newsSensitiveData.zip`
7. **Deploy frontend** — `npm run build`, copy to /docs, commit, push
8. **Verify** — visit `/weekly/pair/iran-and-israel`, confirm all sections render, share URL works

Total estimated effort: ~2.5 hours focused work.

---

## Test plan

After deploy, verify:
- [ ] `/weekly/pairs` loads, shows 15 cards sorted by dataQuality
- [ ] Each card links to correct pair page
- [ ] `/weekly/pair/iran-and-israel` renders all 7 sections with rich content
- [ ] `/weekly/pair/cuba-and-united-states` renders with "thin" dataQuality badge + disclaimer
- [ ] `/weekly/pair/nonexistent-slug` shows graceful "not found" state
- [ ] Mobile layout works on 375px width
- [ ] Share button generates correct URL
- [ ] IntelligenceLoader shows during load (cold visit without cache)
- [ ] 30min cache works (reload shows instant)

---

## Open questions (to settle during build)

1. **Map centering** — use bounding-box midpoint or manually-tuned coordinates per pair? → Start with midpoint; tune later if any pair looks bad.
2. **Arc on map** — actual polyline or just two visible dots? → Polyline (great-circle curve if Google Maps provides; straight line otherwise).
3. **Nav entry point** — where does user find pairs? → Start with direct URL access + a "Pairs" link on /weekly landing. Can add to main nav later.
4. **Prediction confidence rendering** — numeric (0.65) or descriptive ("medium-high")? → Descriptive: `<0.4 Low`, `0.4-0.7 Medium`, `>0.7 High`.

---

## Post-MVP follow-ups (not blocking)

- Related pairs cross-links from CountryPage (e.g., Iran page shows "Iran × Israel" card)
- Pair filter on WeeklyPage (show threads/topics relevant to a selected pair)
- Social sharing preview image generation (like daily brief)
- SEO: JSON-LD structured data for each pair page
- Analytics event on pair page view
