# CRITIC 1 — Reader experience, accessibility, brand
Reviewing: `HOME_MAP_BRIEFINGS_FRONTEND_DESIGN.md` (Opus) against `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md` (binding).
Audience: B2B analysts who produce theses. Reading is free.

---

## 1. First 10 seconds, desktop split + mobile

**Design's choice:** lede sentence → status bar (counts, freshness) → split map+list stage, no hero callout, no
tour auto-start.

**Critique:** The literal wireframe in §2.2 puts FOUR rows of dense, abbreviated, jargon-heavy chrome above the
content a first-time reader can parse:
```
Watching 1 · ●high 0 ●elev 1 ●mod 0 ●low 0 │ ◆0 ■0 ▲0 ●1 │ Map 12 min ago · next 11:44 UTC │ Stories 11 days old ⚠ ⓘ
```
That's four glyph-coded clauses, a raw shape legend (◆■▲●) with no inline key, two separate freshness clocks,
and a warning icon — all in a single 40px row, in mono figures, before the reader has seen one actual headline.
Compare to the current live home screenshot (`home_desktop.png`): today's page leads with a plain-English H1
("Today's Global Topics") and three round numbers in a stat row. The new design trades that immediate
legibility for an instrument-panel readout that only someone who already knows the product's vocabulary
(axis shapes, tier names, GDACS) can decode at a glance. A first-time B2B analyst reads dashboards for a
living, but even analysts need the legend adjacent to the data on first exposure, not deferred to an ⓘ
popover (§3.4).

Verified live: today's map page (`map_desktop.png`) is much sparser — "No high-tier situations · 1 elevated
worth watching," one line, then a modal explaining the three nav destinations in plain words. The new design
removes exactly that plain-language framing sentence in favor of glyphs, which is a regression in first-visit
clarity even though it is a `principle 2` "freshness is data" win.

**Concrete change — MODIFY.** Keep the counts row, but (a) give tier counts and axis counts *words* the first
time a reader loads the page in a session, collapsing to glyphs after acknowledgment (mirrors how the
first-visit banner is dismissible once) — or simpler, (b) put the shape/hue legend inline in the status bar
itself as tiny labeled swatches instead of bare ◆■▲● glyphs, so the reader never needs the ⓘ to parse the row
they see on load. This is cheap (a `<abbr>`-style label under each glyph) and doesn't add a row.

---

## 2. "Being watched" vs "In the news" vs "Developments" — one mental model or three lists?

**Design's choice (§4.2):** three groups, sorted differently (tier desc for watched; outlets desc for news;
outlets desc for developments), with the design's own §11.3 admitting "two different orderings sit on one
page... the risk is that readers read group order as importance order."

**Critique:** This is the single biggest legibility risk in the doc, and the designer has already flagged it
without resolving it. For a first-time reader, "Being watched" (tier-driven, GDACS-derived, usually 0–1 items
per the live data) sitting above "In the news" (outlet-count-driven, 17 items) *looks* like a priority
ordering — item 1 in group A must outrank item 1 in group B, because that's how every other ranked list on
the internet works. But the design explicitly says these are two unrelated metrics glued into one page order.
A reader skimming for "what matters most" will misread the boundary as a value judgment the system isn't
making. This compounds with finding 2 below: since ~65% of stories are unmatched to a situation, "Being
watched" will typically hold 0–1 items (as today's live screenshot shows) while "In the news" holds 17 — so
the page's most prominent, top-positioned group is usually its thinnest, and the reader has to scroll past a
mostly-empty "watched" shelf to reach the news they came for. That's a bad first impression of a data-sparse
product before DeepSeek funding even resolves (§11.1).

The "country shown when selected" honest fallback (§3.2, §5.3) is the right integrity call and does not read
as broken **once explained** — the label chip "Saudi Arabia · no live situation" and the callout line "No live
situation: country shown" are both plain English. My concern isn't the mechanism, it's that at ~65% unmatched,
the map pane will mostly show empty ocean with country outlines lighting up only on click, while 17 kicker
rows in the list all read "(country)". That repeated parenthetical, seventeen times, reads as a persistent
apology/disclaimer rather than information — a "sorry, half-broken" tell for a paying-adjacent B2B audience
who will notice a pattern that consistent.

**Concrete change:**
- **MODIFY** grouping: merge "Being watched" and "In the news" into one sorted list by default, with a small
  inline badge (a tier chip when one exists, nothing when it doesn't) rather than a hard section break —
  OR, if the operator wants the section break kept (it does encode a real distinction: measured vs
  monitored), add one line of connective copy under the group headers on first load: "Watched = confirmed
  incident; In the news = everything else, sorted by how widely it's reported" so the reader isn't left to
  infer the two orderings are unrelated. Cheapest fix: add that sentence to the first-visit banner copy in
  §3.7, which already exists and already explains the map's encoding — extend it one clause to also explain
  the list's two orderings, since banner real estate is already spent.
- **AGREE** with the "(country)" fallback mechanism itself; **MODIFY** only the repetition — shorten the
  seventeen-times-repeated parenthetical kicker text to a single dot/icon (already planned: no marker, fill
  only) plus a one-time explainer in the group header ("In the news · 17 — country shown where no live
  situation exists") instead of on every row.

---

## 3. Story card density / three disclosure levels

**Design's choice (§4.5–4.7):** level 1 = ~4-line list item with kicker, headline, arc badge+timeline strip,
evidence row. Level 2 = in-place card with 6 sections (what's happening, latest change, timeline, severity,
forecast, sources) plus 4 exit links.

**Critique:** Level 1 is reasonable and matches the "compact analyst" density the brand voice calls for — the
existing home page already does headline + 2 metadata rows + 4 action buttons (see `home_desktop.png`), so
this isn't a big jump. Level 2 is dense but appropriately so for an analyst audience; the mock in §4.6 is
legitimately close to "a second page" in content volume (6 labeled sections, a 13-event timeline table, an
axis scorecard, forecast text, source list) even though it renders inline. The design's own honesty rule (omit
sections with no data, never show "N/A") is the right guardrail and should keep it from feeling bloated on
sparse stories — but on a *fully populated* story (the Houthi example used throwout) the card will be several
screens tall inside an already-scrolling 560px list pane. That's a genuine "second page in disguise" outcome
for exactly the stories most worth reading, which cuts against principle 1 ("list is the product").

One specific density problem: the card has **four exit CTAs** at the bottom (`Read full story →`, `Analyze in
Studio →`, `Copy link`, `Show map*`) with no visual hierarchy between them — all styled the same per the mock.
For a first-time reader this is a choice-paralysis moment right where the design most wants a click-through to
Studio (the monetizable action per the marketing context's "Analysis Studio compute" upsell).

**Concrete change — MODIFY.** (a) Make `Read full story →` visually primary (filled/accent) and the other
three secondary/text-style, since "go deep" is the level-3 intent this section exists to trigger. (b) For
cards with all 6 sections populated, cap the inline card's rendered height (e.g. ~2x viewport of the pane) with
its own internal "Show 13 events → all in full story" rather than rendering the entire 13-row timeline inline
— the design already truncates to "newest 3 listed... [all 13 →]" for the timeline (good), but severity +
forecast + sources are each rendered in full with no analogous cap, so on a rich thread the card can still run
long. Apply the same truncate-then-link pattern uniformly.

---

## 4. Removing the guided tour and ambient hero callout; dropping the ticker

**Design's choice (§3.6, §3.7, §11.6, §11.7):** tour removed (replaced by manual prev/next in `view=map`);
hero callout removed (nothing selected → no callout, since the list already shows the top item); ticker
rejected outright with a reasoned justification.

**Critique — these are the right calls, with one gap.** The live screenshot shows the current tour is a modal
scrim ("Welcome to Global Perspectives... Click the ? in the top bar any time for a guided walkthrough") that
blocks the page behind a dark overlay before the reader sees any content — objectively worse first-impression
UX than a slim inline banner, so removing the auto-start (X-1) is a clear win. The ticker rejection is well
argued (WCAG 2.2.2 pause requirement, redundant with alert stack + list, would loop on today's 1-situation
data) and matches "no ambient animations" (principle 3).

The gap: the tour, whatever its execution flaws, gave the reader an explicit statement of *what the four nav
destinations mean relative to each other* (Topics vs Threads vs Economy vs Track Record — see the modal copy
in `map_desktop.png`). The first-visit banner (§3.7) replaces this only for the map's *visual encoding*
(colour/glow/pulse) and the list's presence, not for site-level orientation ("what is this site, why should I
trust it, where do I go for X"). A first-time analyst who lands on `/` cold, with the tour gone and no hero
callout, has: nav bar labels, one dense sentence (lede), a chrome row of glyphs (§1 above), and a mostly-empty
map. That is *less* explicit orientation than today's page, which — however clumsy — states its four sections
in one paragraph inside the modal before dismissal.

**Concrete change — MODIFY.** Keep the tour removed from auto-start (correct), but don't rely solely on the
map-specific banner to carry all first-visit orientation. Either (a) extend the first-visit banner's normal
copy (§3.7) with one added clause naming what the reader can do next ("Briefings has the daily digest;
Analyze lets you go deep on any story") — it already ends in `[Got it]` so one more short sentence is cheap —
or (b) rely on the "How we read the world" methodology block that's kept below the fold (§2.1) but that's too
far down for a 10-second read. I'd do (a): fold one orientation clause into the existing banner rather than
inventing a new UI element, since the brief says the banner "explains what the reader is looking at" — reading
this literally as map-only is too narrow.

---

## 5. Briefings: 3-minute skim, trust placement

**Design's choice (§6):** dated editions, stamped read time (words/230), prev/next skipping empty days, daily
anatomy (big picture → judgments → region → watch → markets), weekly anatomy ending in corrections →
scorecard → watchlist → signup.

**Critique:** The anatomy order matches the brief exactly and is good practice — corrections and scorecard
placed together near the end of the weekly edition is the right trust-building sequence (show the forecast,
then immediately show the track record of forecasts, back to back) rather than scattering them. The "~3 min
read" stamp computed from real word count (not a guess) is exactly the freshness-honesty principle applied to
a new surface, good.

One real skimmability risk the design itself documents but somewhat undersells: §6.4's gap table shows the
**daily** edition currently ships with "Key judgments" that have **no likelihood or confidence badge** (B6 not
built) and **no Read-story links** (no threadId on `topStories`) — meaning the flagship "analyst format"
promised in the brief ("each with a likelihood + confidence, in the Studio's analyst format") literally cannot
render until backend work lands. That's a significant gap between what's promised in the copy the reader sees
and what ships in H4. If the interim daily edition ships with judgment bullets that quietly drop the
likelihood/confidence language, a brand built on "grounded, traceable, decision-ready" language (per
`.agents/product-marketing-context.md`) is showing analyst-audience readers something that superficially
resembles ICD-203 tradecraft standards but isn't actually calibrated yet. That's a credibility risk specific to
this audience — analysts will notice missing calibration language immediately, more than a casual reader
would.

**Concrete change — MODIFY.** Until B6 ships, don't label the interim section "Key judgments" (a specific
intelligence-tradecraft term implying likelihood/confidence per ICD-203) — call it "What's moving" or "Top
developments" for the unscored interim version, and reserve "Key judgments" for when the badges actually
render. This is a one-line copy change that avoids overpromising to an audience that will clock the
discrepancy.

---

## 6. Accessibility

Going through the design's own §9 point by point against WCAG and the brief's accessibility constraint
("story list is the accessible twin... every map action reachable from the list by keyboard").

- **List-as-twin claim (§9.1):** Broadly credible — the design does enumerate map facts (place, tier, axis,
  state, escalation, freshness) as also present in the list, and prev/next stepping is exposed both places.
  **AGREE.** One omission: the **alert stack's "reason" text** ("raised to High 40m ago") is described only as
  a map-pane row (§3.3); I don't see it stated whether the *list* view surfaces the same reason string
  anywhere other than implicitly via `changedAt`/tempo chips. If the alert reason ("tier rose" vs "new" vs
  "breaking alert") isn't literally text somewhere in the list item, the twin claim has a small gap. **MODIFY:**
  confirm the alert reason string appears in the list item's kicker/tempo chips (it partially does via "▲
  getting worse", "◇ new" per §4.5, but "breaking alert 2h ago" as a category doesn't obviously map to a list
  chip) — make this 1:1 explicit in the build spec.

- **Keyboard flow map↔list (§5.4, §9.2):** The no-per-marker-tab-stop decision is well-justified (WCAG 2.1.1
  satisfied via list + bracket-stepping) and matches how serious data-viz apps (e.g., financial terminals)
  handle dozens of map points. **AGREE.** But the `[`/`]` stepping only works once the map region has focus,
  and the map region is a single tab stop reached only after the skip link. A keyboard-only reader who wants
  to explore stories geographically must: tab to map region → press `[`/`]` repeatedly → the list scrolls to
  match. That's a legitimate keyboard-operable path, correctly designed. **AGREE, no change.**

- **Focus management on card expand (§5.5, §9.4):** disclosure pattern with `aria-expanded`/`aria-controls`,
  focus stays on header when opened by list click, doesn't move into list when opened by map — this is
  correct, standard practice, and prevents the "focus theft" anti-pattern the brief doesn't explicitly demand
  but good a11y requires. **AGREE.**

- **Inner-scroll list pane trap — the designer's own flag (§11.5):** This is real and under-mitigated.
  `overscroll-behavior: contain` prevents scroll *chaining* to the page, but it does **not** help a keyboard
  user or a screen-reader user who tabs into the list pane and then needs many Tab presses to reach content
  below the stage (trust strip, newsletter, footer) — because Tab order follows DOM order, and if the list
  pane's 17+ items are all individually focusable buttons, a keyboard user must tab through every single list
  item to escape the pane and reach page-level content below. The design doesn't specify a "skip to below
  stage" mechanism, only a "Skip map, go to story list" skip link (§9.2) which moves *into* the trap, not past
  it. **OPPOSE the "test it first" deferral in §11.5** — this needs a concrete fix now, not a wait-and-see: add
  a second skip link "Skip stories, go to page content" right after (or as part of) the pane, mirroring the
  existing skip-map pattern. Trivial to add, meaningfully reduces keyboard fatigue, and costs nothing in visual
  design.

- **Reduced motion (§9.6):** Comprehensive — pulses, fly-to, pane transitions, smooth scroll, skeleton
  shimmer, banner slide-in all covered by one hook. **AGREE, well done.**

- **Contrast, four axis colours on light AND dark map (§7.1, §9.5):** The design explicitly separates `--axis-*`
  (marks on dark, unchanged oklch values) from `--axis-*-ink` (darkened variants for text on light/`--card`),
  and flags these ink values as "starting points that must be contrast-verified... before merge." That's the
  right process, but it means **the design as written does not yet guarantee AA contrast** — it's a TODO
  wrapped in a design doc, not a verified spec. For the political axis in particular (`#9b8cf8` light purple →
  `#5f4fc4` ink) and economic (`#38b6e0` cyan → `#1f6f8f` ink), these are exactly the hue families where
  hitting 4.5:1 while staying visually distinct from their siblings is hardest. **MODIFY:** don't let this ship
  as "verify later" — run the contrast checker against actual `--paper`/`--card` background values *before*
  this doc is treated as final, since axis-ink text appears in the list kicker on every single row (§4.5) —
  this isn't an edge case, it's the primary text color for the whole list's category labels.

- **Tap targets on mobile (§9.7):** 44×44px minimum stated for controls, above the brief's 40px floor.
  **AGREE.** But the mobile peek card is specified at 72px height with no stated internal tap-target audit —
  and the segmented `[Map|List]` toggle at 44px total height for *two* tabs side by side on a 390px viewport
  needs to be checked against real label widths ("Map"/"List" plus icons) so each tab individually clears
  44×44, not just the container. Minor, flag for build-time verification.

---

## 7. Brand / tone — game-inspired map vs credible intelligence

**Design's choice:** explicitly borrows Civ VI's notification stack, HOI4's map modes, DEFCON's restraint, with
a stated principle ("borrowing... is about how they *read*, not how they *reward*. No points, no dramatic
effects").

**Critique:** The design is unusually disciplined about this relative to typical "gamify the dashboard" drift —
no points, no achievement language, no juicy particle effects, motion has exactly one meaning, pulses capped
at 3 and tied to a real 24h-change rule rather than decoration. This matches the brand voice's "credible,
analytical, direct... senior analyst" register and avoids every item on the words-to-avoid list I checked
against (no "game-changer," "revolutionary," "disruptive," "cutting-edge," "powered by AI" headline,
"leverage" as verb) — I did not find any of those in the design doc's actual UI copy strings (banner copy,
lede examples, status bar labels, group headers). **AGREE with the restraint.**

Two soft tone risks worth flagging:
1. The alert stack is explicitly modeled on a 4X strategy game's notification tray, and even with restrained
   styling, "alert stack... Civilization-style" as an internal name risks leaking into visible copy or dev
   comments that later get reused as user-facing microcopy ("+N more" popovers, badge counts) — a pattern
   that reads as gamified regardless of restraint if a developer literalizes the metaphor (e.g., a red count
   badge that looks like an app-store notification dot rather than an analyst's alert queue). **MODIFY:**
   the design should explicitly specify the "+N more" and alert-count treatments use the same risk-tier /
   axis token colors as the rest of the page, not a generic red notification-badge red, to keep it looking like
   an instrument rather than a game HUD. This isn't stated either way in §3.3 — worth pinning down.
2. "World status bar" language like "Watching N" is fine, but the glyph-dense presentation (§1 above) risks
   reading as a game HUD (resource counters) rather than an intelligence dashboard specifically because it's
   glyphs-with-no-adjacent-words on first load. This is the same finding as §1 above, restated as a brand risk:
   density without labels reads as "game stat bar," density with labels reads as "terminal." **Same fix as §1.**

No instance of literal brand words-to-avoid found in the design's copy. The lede/banner copy samples given
("What you're looking at: events we're actively monitoring...") read as calm, declarative, analyst-register —
consistent with brand voice. **AGREE, no violation found.**

---

## Top 5 changes ranked by reader impact

1. **Fix the status-bar legibility gap (§1/§7).** Add inline labels or a persistent-until-acknowledged legend
   for the tier/axis glyph row so a first-time reader isn't asked to decode ◆■▲● and dual freshness clocks
   before seeing a headline. Highest impact because it sits above every single reader's first fold.
2. **Resolve the two-orderings confusion between "Being watched" and "In the news" (§2).** Either merge the
   groups or add one explanatory clause (cheapest: extend the first-visit banner). The design itself flags
   this as unresolved risk (§11.3) — it shouldn't ship unresolved given how often "Being watched" will be
   near-empty per live data.
3. **Fix the inner-scroll keyboard trap in the list pane (§6 of this critique / design §11.5).** Add a "skip
   stories, go to page content" link. Cheap, concrete, and the design's own "test it first" stance is too soft
   for a documented a11y gap.
4. **Verify axis-ink contrast before treating the doc as final (§6).** These colors are the primary text color
   on every list row's kicker — not decoration — so "must be contrast-verified... before merge" is a load-
   bearing TODO that should be resolved now, not deferred.
5. **De-risk the "Key judgments" copy in the interim daily edition (§5).** Don't use ICD-203-coded language
   ("Key judgments... likelihood + confidence") for content that ships without likelihood/confidence badges
   (B6 gap). An analyst audience will notice the mismatch between tradecraft-styled labeling and actually
   uncalibrated content faster than any other reader segment would.
