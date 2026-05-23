# Economic Disruption — UI Wiring Plan (Phase 4)

Follow-on to [`ECONOMIC_DISRUPTION.md`](ECONOMIC_DISRUPTION.md) §"Where it surfaces in the UI" and the 2026-05-21 three-agent design debate. Phases 1–3 surfaced the layer as **card decoration** (`SeverityBadge` chip stamped on Home / Weekly / CountryList cards). Phase 4 shifts to **structural integration** — plugging the economic dimension into editorial slots each page already has (sidecars, leaderboards, expandable buttons, deep links), the way FT, Bloomberg and Reuters do it at the body level.

## Goal
Make the economic layer feel like it travels with the news without crowding card chrome. Cut decoration that has no unique destination. Add structural slots where readers are already looking.

## Non-goals
- Do **not** redesign `/economy` — it's the destination index, already correct.
- Do **not** kill the ThreadPage Economy tab or `MechanismCard` — that's the deepest reading surface.
- Do **not** cut the Home topic-kicker `SeverityBadge` yet — it's the only ambient discovery hook on the front door. Instrument CTR first (out of scope for this plan).

## Priority-ranked work items

### P0 — Safe wins, do first
| # | Page | Change | File:line (approx) | Why |
|---|---|---|---|---|
| **P0.1** | `/daily` | DailyPage lead-disruption headline currently links nowhere — make it a deep link to `/weekly/thread/{scopeId}?tab=economy` | `DailyPage.jsx:115-117` | Defect; both pragmatist + ambient agents flagged it |
| **P0.2** | `/map` | WorldMapV2 country detail panel — add a top-1 `DisruptionPreview` row using `econRef.current[iso]` already in scope | `WorldMapV2.jsx:1003-1075` | Lens draws rings but panel never mentions disruption — handoff is broken |
| **P0.3** | `/` | Home "Story arc →" link — when the topic's thread has an economic_impact record, route to `?tab=economy` instead of `/weekly` | `Home.jsx` story-arc link | Smarter href, no new UI |
| **P0.4** | `/weekly` | Cut `SeverityBadge` from WeeklyPage StoryCard meta row | `WeeklyPage.jsx:323-325` | 9 chips on one card; minimalist + pragmatist agents both flagged it as decoration without unique destination |

### P1 — Structural integrations
| # | Page | Change | File:line | Why |
|---|---|---|---|---|
| **P1.1** | `/` | Add 4th **"Economic"** AI expander button next to Summary / Predict / Trace Cause — collapsed by default, expands `MechanismCard` inline on click | `Home.jsx` AI button row | Matches the existing on-demand pattern; opt-in vs always-on chip |
| **P1.2** | `/weekly/countries` | Add **"Most Disrupted"** leaderboard to right rail (top 5 countries by max active severity) | `CountryListPage.jsx` right rail | Currently 2 leaderboards (Highest Risk + Most Covered); third one parallels the existing pattern; passive-discovery surface |
| **P1.3** | `/daily` | Add 1-line "Economic angle" beneath the Lead Story AI prediction sidecar when its thread has an impact record | `DailyPage.jsx` lead sidecar | Sidecar slot already exists for AI-side context |
| **P1.4** | `/weekly/country/:name` | Merge `MechanismCard.watchSignals` from active disruptions into the page's "What to Watch" rail | `CountryPage.jsx` watch list | Same editorial intent, currently two separate buckets |

### P2 — Polish (defer until P0+P1 ship)
| # | Page | Change |
|---|---|---|
| **P2.1** | `/weekly` | Boost ranking of severe-disruption threads in "Rising This Week" featured list |
| **P2.2** | `/daily` | Numbered Top Stories — inline instrument micro-pill in body (Bloomberg/Reuters pattern) |
| **P2.3** | `/map` | Pair-arc tooltips — mention disruption when arc thread has one |
| **P2.4** | `/weekly/thread/:id` | Surface severe-disruption `watchSignals` into the status strip |
| **P2.5** | `/weekly/country/:name` | Cross-reference winners/losers in Macro Snapshot rail (highlight relevant instrument) |
| **P2.6** | `/map`, `/weekly/country/:name` | Tint causal-graph nodes whose source thread has impact |
| **P2.7** | `/weekly-map` | MapSidePanel: severity rim-color on markers + chip on side-panel cards |

### P3 — Debated removals (need analytics first)
- Home topic-kicker `SeverityBadge` (`Home.jsx:366-374`) — needs CTR instrumentation before cutting.
- CountryListPage CountryCard `SeverityBadge` (`CountryListPage.jsx:47`) — sort + new "Most Disrupted" leaderboard (P1.2) may make per-card chip redundant; revisit after P1.2 ships.

## Test strategy
- **No new backend.** All changes are frontend-only and reuse existing hooks (`useEconomicImpact`, `useDisruptionsList`, `useTopMovers`).
- Build via `cd global-perspectives-starter/frontend && npm run build`, copy `dist/` → `docs/` per CLAUDE.md.
- Frontend vitest suite (149 tests) must stay green.
- Smoke-test each touched page in dev server before committing.

## Deploy order
1. **Batch A (P0):** all four P0 items in one commit. Low risk, no new components needed.
2. **Batch B (P1.1):** "Economic" AI button on Home — biggest UX change in this plan, ship alone so any regression is isolated.
3. **Batch C (P1.2, P1.3, P1.4):** leaderboard + sidecar line + watch-signal merge. All small, can ship together.
4. **Batch D (P2):** polish items, picked off as time allows.

Each batch lands as its own commit with corresponding CHANGES.md entry.
