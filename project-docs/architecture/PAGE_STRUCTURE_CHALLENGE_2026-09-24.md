# Challenge — Page Structure Proposal (2026-09-24)

Seats: **Reader** (first-time analyst visitor + returning daily reader) and **Business** (solo
developer, low traffic, B2B/analyst positioning, $15/mo–$150/yr membership). Evidence gathered
2026-09-24 via source grep, live `curl`/Playwright against `https://globalperspective.net`, and
read-only AWS CLI (Lambda config + CloudWatch Logs Insights) against the live account. All ledger
citations are to `project-docs/redesign-ux/_active/MAP_HOME_SITUATION_LEDGER.md`.

---

## A. Front door: map-as-home vs. composed "Today"

**The proposal's claim:** S3 (the news layer) hasn't landed yet, so the map is structurally thin —
"1 situation today, GDACS only" — and the plan's own §12 concedes "the map will feel thin until S3
exists." Therefore build a new composed Today page now, and gate the map-as-home swap on S3
shipping plus a 14-day density threshold. Today "reuses existing parts... survives LLM outages,"
implying it's the safe, low-build option versus the bold, risky map swap.

**My challenge (evidence):**

1. **S3 has already landed. It shipped two weeks before this review.** Ledger: S3·T1
   `newsSituationIngest` — "✅ done (LIVE hourly)... 295 arts→stories across 4 axes verified."
   S3·T3 — "✅ done (LIVE + browser-verified)... **40 situations across all 4 axes** (conflict
   17/political 13/humanitarian 7/economic 3); map shows the world." Both dated 2026-09-10. The
   entire map rendering stack built on top of it (S4 data layer, S4.5 legibility pass, S5 WebGL,
   S5.5 design port + fix queue) is also marked done, and S5.5·T1a states outright: **"Frontend
   map programme fully shipped."** `/map` has been prod-deployed since commit `8872cb7` (2026-09-09
   ledger note: "`https://globalperspective.net/map` is live"). So the proposal's central premise
   for Q2 — that the map's thinness reflects a missing pipeline stage — restates the plan's own
   09-08 framing without re-checking it against the plan's own later stages, which the proposal's
   own evidence list cites (`MAP_HOME_SITUATION_LEDGER.md`) but doesn't appear to have read past S2.

2. **The 1-situation state today is a billing outage on already-shipped code, not a missing
   feature — confirmed live.** `curl https://globalperspective.net/data/world/latest.json` (fetched
   during this review) shows `sources.news: "2026-09-24T09:50:16Z"` — about one hour old, i.e. the
   hourly `newsSituationIngest` pipeline **is running** — yet `situations` contains exactly one
   entry (the GDACS cyclone). CloudWatch Logs Insights on `/aws/lambda/newsSituationIngest`
   (2026-09-22 to 09-24) shows every classification batch failing: `WARN [ingest] batch failed: LLM
   402` (repeated, every run, both days sampled). `aws lambda get-function-configuration
   --function-name newsSituationIngest` confirms it calls `api.deepseek.com` /
   `deepseek-v4-flash`. Cross-checking the Home topics generator (`newsInvokeGemini-dev`, which the
   review's own context note also names as DeepSeek-starved) shows the identical failure:
   `ERROR Lambda error: APIError: 402 Insufficient Balance` on 2026-09-23T08:00. **With no
   classification, `newsSituationIngest` can cluster no new stories, so the tracker has nothing to
   fold into a situation except the deterministic, LLM-free GDACS opener** — which is exactly the
   "1 situation, GDACS only" state both the plan (§12) and the proposal (Q2) describe as evidence
   the *pipeline doesn't exist*. It exists; it's unpaid. Topping up the DeepSeek account is an
   operator action measured in minutes, not an engineering stage — the ledger's own evidence (40
   situations across 4 axes on 09-10) is what this same code produces when the bill is paid.

3. **This also reframes "is Today a new build competing for the same time."** The composed Today
   page in §3.1 has never been built: it requires a new lead-stories ranking module, a new
   situations-module embed, a new trust strip placement, and is explicitly sequenced *after* Stage
   3's rebuild (§6). S6·T1 (the map home swap), by contrast, is one ledger row — swap `/` to the
   already-shipped `SituationHome`, redirect `/map`, update one nav line
   (`Layout.jsx:67`), wire the Worker's existing `/data/*` SigV4 pattern to pre-render `/`. The
   proposal has the effort comparison backwards: **Today is the net-new build; the map swap is
   finishing paid-for work that's sitting live behind an unlisted URL.**

4. **What the operator loses by deferring, concretely:** the plan's own decisions-already-taken
   (§6 — hue=axis, 2.5D tilted world, dark "war room" front door, auto-tour) represent several
   rounds of build + in-person operator review + a fresh-designer critique-and-repair cycle
   (S5.5, "operator reviewed the live `/map` in person... an independent Sonnet critique... a
   design brief was handed to a fresh Claude designer, two rounds produced an approved static
   target"). That is the single most differentiated visual asset on the site
   (`.agents/product-marketing-context.md`: "World map with geodesic connection lines... Visual
   evidence of how stories connect across borders" is listed as differentiator #6). Shelving it a
   second time, on a premise ("S3 hasn't landed") that's now factually outdated, spends more of a
   solo operator's scarce time than confirming a vendor invoice.

**What I can't verify:** whether the map, once DeepSeek is paid up, will show *good* breadth (real
4-axis coverage, not noise) — I can't run the pipeline myself. But the ledger's S5.5·T3/T3b/T3c
sequence (corroboration cap, identity-alias dedup, axis-flip measurement) is exactly the kind of
quality work you'd want done *before* trusting the density number, and it's marked done and
deployed. That's reasonable, not certain, confidence.

**Verdict: OPPOSE the "S3 hasn't landed" framing (factually wrong, live-verified) and MODIFY Q2.**
Don't build a new Today page as the near-term front door. The legitimate next step is finishing
S6·T1 (already-scoped, already-cheap) gated on a one-line check the proposal never lists in Stage
0: **confirm DeepSeek balance is restored and situations re-populate** — the plan's own 14-day/≥5
situations/≥2 axes rule is a fine acceptance test, but recognize it as a *billing-recovery* gate,
not an *engineering* gate, and it can likely be satisfied in days once paid, not "when S3 ships."

---

## B. Merges / renames: cost vs. benefit, and what breaks

**The proposal's claim:** rename `/weekly/thread/:id`→`/story/:id`, `/weekly/country/:name`→
`/country/:name`, `/weekly`→`/stories`, merge `/map`+`/weekly/countries`→`/world`, merge
`/daily`+`/weekly-brief`→`/briefings`, all via permanent Worker-edge 301s; "traffic is low... the
SEO cost of moving is lowest now."

**My challenge (evidence):**

1. **The two core "analyst spine" renames are not the same size of job, and the proposal treats
   them as one line item.** `threadPath()` (`shared/lib/threadPath.js:12-21`) is a single,
   centralized URL builder with **30 call sites** across the frontend — migrating `/story/:id` is
   genuinely a one-function edit. **`/weekly/country/:name` has no equivalent helper.** It is
   hand-built inline at **19 separate call sites** (`Home.jsx:458`, `EconomyPage.jsx:240`,
   `MechanismCard.jsx:17`, `DailyPage.jsx:391,448`, `ThreadPage.jsx:435`,
   `TrackRecordPage.jsx:57`, `Account.jsx:97,580`, `CountryListPage.jsx` ×6,
   `CountryPage.jsx:272,645`, and `shared/ui/CopyBriefing.jsx:103`, which additionally
   hardcodes the **full public URL** `globalperspective.net/weekly/country/...` into a
   copy-to-clipboard share string). §Q4 files both renames under one "S/M effort" line; the country
   rename is materially riskier (a missed call site is a live 404 or a stale shared link, not a
   build error — there's no compiler check for a template-literal string).

2. **The Cloudflare Worker isn't a redirect layer waiting to be pointed at new paths — it's the
   thing that would need rewriting, in the file with the highest blast radius on the site.**
   `WORKER_FULL_CODE.md` hardcodes old paths in four separate places: the bot-served root-page
   directory (lines 127–139), the canonical-URL builders inside `renderThreadPage`/
   `renderCountryPage`/`renderDailyPage` (lines 172, 197, 238–239), and — the part the proposal's
   §7 risk 2 doesn't call out — **the bot-detection route matchers themselves**
   (`/^\/weekly\/thread\/([^/]+)\/?$/` at line 340, `/^\/weekly\/country\/([^/]+)\/?$/` at line
   355, `/^\/daily(?:\/([^/]+))?\/?$/` at line 370). A 301 layer has to run *before* these
   matchers or an old-path request from a bot (say, a LinkedIn crawler resolving a
   September-dated post's stored `/weekly/thread/abc123` link) falls through un-rendered instead
   of getting redirected-and-previewed — silently breaking the exact social-preview mechanism the
   Worker exists for. This file is also, per the project's own no-CI stance, deployed by hand
   (copy-paste into the Cloudflare dashboard) — every route migration here is an unverified-by-tooling
   edit to the single most consequential file in the stack, for both routing and SEO.

3. **Already-published external links don't get fixed by a 301 alone — they need the redirect to
   be airtight, forever, on that same hand-deployed Worker.** `newsPostLinkedIn/src/index.js:460`
   hardcodes `${SITE_URL}weekly/thread/${topic.threadId}` into **every LinkedIn and Bluesky post
   ever made** by this Lambda — those posts are frozen text on someone else's platform.
   `newsSensitiveData/src/index.js:2113-2114`'s RSS generator falls back to the same path for
   subscribers whose readers may have cached URLs. Two **live** email templates hardcode old paths:
   `renderWeeklyEmail.js:30` (`${site}/weekly-brief`, the Sunday digest CTA — `TriggerWeeklyEmailSend`
   is ENABLED) and `newsBreakingAlert/src/index.js:189` (`${SITE_URL}/weekly/thread/${threadId}`,
   rendered as a CTA button in every breaking alert — `TriggerBreakingEmailSend rate(15 minutes)`
   is ENABLED). `renderDriftEmail.js:91` hardcodes `/weekly/country/` too, though that send path is
   disabled by design (`TriggerDriftEmailSend` — DISABLED), so its risk is latent, not live. None of
   this is prohibitive — it's why the proposal is right that redirects must be edge-permanent — but
   it means the migration's true surface is "rewrite the hand-deployed Worker's matchers + canonical
   builders + add a redirect table, then re-verify five separate Lambda emitters," not "the frontend
   route table changes."

4. **`/world` (merging `/map` into `/weekly/countries`) risks undoing work the map programme just
   finished, for a benefit that's nav tidiness, not reader value.** The proposal's own §7 risk 6
   admits this: "it needs a clear toggle, not overlay, or it recreates the old map's '30-40
   countries lit at once' problem." That problem is precisely what S4.5 (legibility pass),
   S5.5·T3 (corroboration cap — "the single-outlet mass that was inflating 'elevated' now
   correctly sits at 'moderate'"), and S5.5·T3b (identity-alias dedup, "Trump-related storyIds
   collapsed 6→3") were built to solve, across three separate ledger stages. Folding a second,
   differently-scaled encoding (country risk tier) onto the same renderer is a real regression risk
   against work the ledger shows took real iteration to get right — not "shuffling," but not free
   either, and the proposal doesn't budget for it as its own legibility pass.

5. **What's genuinely close to costless, and I'll say so:** `/briefings` (door-merge of `/daily` +
   `/weekly-brief`, formats stay distinct — this is a nav change, not a data change),
   `/contact`→`/about` (three cards, no helper to migrate), and `/disclosures`→`/methodology`
   (single static page, pure rename). These match the proposal's own "Low priority... acceptable to
   skip" framing for `/economy`→`/markets` too — non-controversial.

**Verdict: MODIFY.** AGREE on the door-merges (`/briefings`, `/contact`→`/about`,
`/disclosures`→`/methodology`) and on `/story/:id` (the centralized helper makes it cheap). MODIFY
`/country/:name`: budget it as its own, larger task — not the same line item as `/story/:id` — given
19 uncentralized call sites including one that generates public share URLs. OPPOSE `/world` as
currently scoped: don't merge the map and country-risk layer into one renderer without first
shipping and testing the toggle in isolation, given that legibility is the exact thing the map
programme spent three ledger stages earning.

---

## C. Sequencing: rebuild Story/Country first, or fix the pipeline?

**The proposal's claim:** Stage 3 ("the analyst spine" — rebuild Story + Country pages: mobile
overflow, CLS, archived-state, no Google-Maps hero) is "the biggest value... where the buyer
lives," and should run before Stage 4 (Today) and Stage 5 (consolidations). Stage 0 (SEO 404,
freshness badge, parked-credit copy, hygiene) correctly runs first.

**My challenge (evidence):**

1. **The DeepSeek outage this review already flags as context doesn't just starve the daily brief
   — it starves the exact pages Stage 3 wants rebuilt first.** The review's own framing note says
   the outage "starves several pipelines: today's `/daily` brief, story summaries, the map's
   situation list, fresh country/thread analyses." I confirmed this live for two of those
   (`newsSituationIngest` and `newsInvokeGemini`, both throwing `402 Insufficient Balance` as
   recently as 2026-09-23). Home's own "updated 11d ago" stamp (verified live) lands almost exactly
   on the outage's stated start date (2026-09-24 minus 11 days = 2026-09-13 — the review's own
   "~2026-09-13" onset date) — strong circumstantial confirmation that topic/thread/country
   generation has been frozen since the outage began. **Rebuilding Story and Country pages' CSS,
   layout, and CLS (real, evidenced debt: 516–572px mobile overflow, 0.29–0.87 CLS, 9× duplicate
   fetches) doesn't touch this.** It ships a better-built shell around content — living forecasts,
   drift notes, root-cause chains — that may not be advancing underneath it. For the stated buyer
   (thesis-producer paying for "how this story evolved" and "what changed"), a beautifully laid-out
   page with an 11-day-old analysis is not obviously higher-leverage than a plain page with a
   current one.

2. **The proposal doesn't put "confirm the LLM vendor account is funded" anywhere in Stage 0**, even
   though it's a near-zero-effort check (minutes, not a coding session) that gates the payoff of
   nearly everything downstream — Stage 3's content, Stage 4's story cards, and Section A's map
   density all sit on the same unpaid bill. For a solo developer with limited time, this is the
   textbook highest-leverage-per-minute fix on the whole list, and it's absent.

3. **Effort honesty cuts against Stage 3 going first.** The proposal's own §7 risk 8 admits: "Stage
   3 and Stage 5 are multi-session builds, and I have not sized them." Committing an unsized,
   multi-session rebuild of the two most complex pages on the site ahead of confirming the pipeline
   under them is healthy is a real risk for a one-person team's time budget — if the outage is still
   live when Stage 3 ships, the rebuild inherits the same stale-content problem it started with,
   just better-laid-out.

**Leaner alternative sequence:** Stage 0 as proposed, **plus a Stage 0.5: verify/restore DeepSeek
balance and confirm the daily cron chain (`newsInvokeGemini`→`newsThreadAnalysis`→
`newsCountryIntelligence`→...→`newsSituationIngest`) is producing fresh output** — this is a
same-day check, not a build. Only then decide whether Stage 3's CSS/CLS work is still the top
priority, or whether shipping the already-built map (Section A) and iteratively patching Story/
Country's worst mobile-overflow bugs (a subset of Stage 3, not the full rebuild) delivers more
reader-visible value per hour of solo-dev time while content quality is reassessed.

**Verdict: MODIFY.** AGREE Stage 0 goes first and that Story/Country have real, evidenced UI debt
worth fixing. OPPOSE the implicit ordering that a full unsized Stage-3 rebuild outranks a near-free
pipeline-health check — sequence the billing/pipeline verification before committing multi-session
effort to pages whose core value proposition (fresh analysis) may currently be broken underneath
the CSS.

---

## D. Nav 9→6 and the "Today" name

**The proposal's claim:** collapse nine nav items into six reader jobs (`Today · Stories · World ·
Markets · Briefings · Track Record`, + Studio/Membership/bell), fixing A2's finding that
Membership and Breaking are absent from nav today.

**My challenge (evidence):**

1. **It doesn't actually fix A2's Alerts finding — it relabels the status quo.** The 2026-09-24
   review's own A2 finding (X-23) is that `/breaking` has "no nav/footer entry... only in-content"
   paths — filed P2 should-fix. The proposal's fix is `/alerts`, explicitly "out of top nav." A
   returning reader checking "did anything happen" still has no persistent nav entry point beyond
   the bell — the finding is renamed, not resolved. (To be fair, the proposal's reasoning — it would
   sit empty most weeks as a nav peer — is legitimate; I'd rather see a footer-and-bell combination
   called out explicitly as the fix, rather than silently declining A2's finding under the new name.)

2. **Folding `/weekly/countries` into a "World" layer-toggle costs a currently-standalone reader
   job a click.** Live nav check today shows 9 items, each one click away, including "Countries" as
   its own entry (verified via live Playwright pass: "Topics Daily Weekly Brief Threads Countries
   Map Economy Analyze Track Record"). The review grades `/weekly/countries` C+ with real content
   (66 countries / 15 briefings) — it's a page analysts actually use as a job in its own right (J3
   sibling per the review's A4 framing: "geographic roll-up" as one of three deliberate splits, not
   redundant). Under `/world`, reaching the country index means landing on the map's default layer
   (situations, per §3.4's stated default) and then finding and using a layer toggle — one more
   decision for a routine lookup, on a page whose "encoding legibility" the proposal's own §7 risk 6
   flags as fragile.

3. **"Today" as the front-door name works against the register the rest of the proposal fights to
   establish.** §4.3/Q1 explicitly reject consumer framing ("no coffee ask," push toward
   "Methodology," analyst register as the tie-break). But `.agents/product-marketing-context.md`'s
   own brand-voice section lists "words to avoid" and states the positioning line verbatim: **"This
   is not a faster news feed. It is a fundamentally different product."** "Today" is exactly the
   masthead word Ground News / Apple News / any morning-briefing consumer app would use — it's the
   first word a cold analyst visitor reads, before any of the register work the rest of the page
   does. This is a small thing, but it's a naming choice the proposal makes without weighing it
   against its own glossary discipline.

**Verdict: MODIFY.** AGREE 9→6 is roughly the right count and that Studio/Membership deserve real
nav presence (matches E1-a/E1-c, uncontested). MODIFY the Alerts disposition — state plainly that
A2 stays open rather than implying the rename resolves it. MODIFY the World merge's effect on the
Countries job — keep a one-click path to the country index (a tab default, not just a mode toggle
one layer deep). MODIFY the "Today" label — pressure-test it against the product's own "words to
avoid" register before locking it in; "Brief" or an unnamed masthead reads closer to the analyst
register the rest of the doc argues for.

---

## E. Fact-check: §7's "11d ago" (Home) vs "7h ago" (weekly) discrepancy

**The proposal's claim (§7 risk 4):** "I have not verified whether the 'updated 11d ago' on Home is
the topics feed or the summary cache... `/weekly` showed 'updated 7h ago' in the same session, so
the stamps disagree on what they measure. That needs a source check before the Stage 0 freshness
fix is designed."

**What I found (live-verified, with file:line source citations):**

- **Both stamps go through the same shared component**, `shared/ui/StatusStrip.jsx` (`timeAgo()`,
  lines 7–16), but **each caller feeds it a different field**, so the two numbers measure different
  things despite looking like one freshness claim:
  - **Home** (`features/home/Home.jsx:357`) passes `updatedAt` from `useGeminiTopics()`
    (`shared/data/useGeminiTopics.js:12,48`), which reads `contentService.getGeminiTopics()`
    (`shared/data/contentService.js:81`) → the proxy's `topics` action → `newsSensitiveData`'s
    `readTopicsCache` (`amplify/backend/function/newsSensitiveData/src/index.js:1426-1483`), which
    returns `TOPICS_TABLE`'s `latest` item's `Item.updatedAt` **verbatim, unmodified**. That field
    is written only by `newsInvokeGemini`'s topic-generation run
    (`amplify/backend/function/newsInvokeGemini/src/index.js:426`, `updatedAt = now.toISOString()`
    at actual generation time). **This is a genuine, honest signal** — and I independently confirmed
    via CloudWatch that `newsInvokeGemini-dev` has been failing with `402 Insufficient Balance`
    since at least 2026-09-23, and the outage the review cites started "~2026-09-13" — 11 days
    before this review, matching the "11d ago" figure almost exactly. **Home's stamp is real and
    currently correctly reporting a frozen pipeline.**
  - **`/weekly`** (`features/threads/WeeklyPage.jsx:918-925`) passes `updatedAt={`${latestDate}T12:00:00`}`,
    where `latestDate = allDates[0]` (`WeeklyPage.jsx:897`) — a **date-label key** ("today's" date),
    not a timestamp, from `useWeeklyArchive()`'s `archive_range` proxy action. The backend
    (`newsSensitiveData/src/index.js:1682-1701`, `readArchiveRange`) unconditionally labels the
    latest archive slot with **today's actual calendar date**, regardless of how stale the
    underlying `topics` item is, and does carry a real `updatedAt` field in that response
    (`index.js:1699`) — **but `WeeklyPage.jsx` never reads it**; it only uses the date-label key.
    So `/weekly`'s top-strip number is `Date.now() − noon-of-today`, i.e. **hours-since-noon of the
    current calendar day** — a function of wall-clock time, not of when content last changed. It
    reads the *same* underlying stale `topics` item Home reports as 11 days old, but reports a
    small, always-fresh-looking "Nh ago" number regardless.
  - Live re-check during this review: Home showed "updated 11d ago"; `/weekly`'s top strip showed
    "updated **8h** ago" (one hour later in the day than the designer's earlier "7h" observation —
    consistent with the noon-anchored math, not a data refresh). `/weekly`'s own per-thread rows
    (a different code path, `updatedLabel()` at `WeeklyPage.jsx:51-55`, driven by real per-thread
    dates) correctly showed staleness down to "17d ago" for older threads — confirming the top-strip
    bug is isolated to that one call site, not a site-wide archive problem.

**What this means for the Stage 0 freshness fix (X-2):** the fix isn't "propagate one real
timestamp to the header/marketing layer" as X-2 frames it — Home's stamp is *already* real. The bug
is that **`/weekly`'s top-strip caller passes the wrong field** (a date label instead of the
archive's own carried `updatedAt`) to a shared component that's otherwise correct. That's a
one-line fix at `WeeklyPage.jsx:920-925` (read the archive entry's real `updatedAt`, not
`allDates[0]` + hardcoded noon) — smaller than X-2 implies, but it doesn't fix the deeper problem: even
a corrected `/weekly` stamp would then honestly also show "11d ago" (or worse), because the content
underneath both pages is frozen on the same unpaid DeepSeek bill. **The freshness-badge fix and the
DeepSeek-balance fix are two different bugs that happen to share a symptom** — Stage 0 should do
both, but neither substitutes for the other, and only one of them (the balance) actually makes the
site's content current again.

**Verdict: MODIFY the proposal's §7 framing.** AGREE the discrepancy is real and worth a Stage-0
fix. OPPOSE treating it as one root cause needing "one data path" (X-2's framing) — it's two
separate, independently-verified bugs (a wrong-field bug on `/weekly`, and a funding outage
upstream of both pages), and conflating them risks the Stage-0 fix shipping a technically-correct
`/weekly` timestamp that still says "11d ago" everywhere, with no visible improvement, because the
real blocker was never the badge.

---

## Where I concede

- Q1 (analyst/B2B-first, general reader welcome) — agree without reservation; well-supported by
  `product-marketing-context.md` and the existing member-gating model.
- Stage 0's hygiene list (SEO 404/200 fix, parked-credit copy removal, onboarding-tour mobile
  blocker, `document.title` sweep) — agree, cheap and clearly evidenced by the review.
- Story/Country pages' UI debt (mobile overflow, CLS, duplicate fetches, Google-Maps hero) is real
  and worth fixing — I only contest whether a full unsized rebuild should be *first*, not whether
  it's needed.
- `/story/:id`, `/briefings`, `/contact`→`/about`, `/disclosures`→`/methodology` — low-risk,
  worth doing roughly as scoped.
- The "story" vocabulary consolidation (Q4) — sensible, matches existing Home copy and the
  marketing glossary; low-risk, copy-only.
- Studio/Membership need real nav presence — uncontested, matches E1-a/E1-c.
- The World page's two-encoding risk (§7 risk 6) — the proposal already flags this itself; I only
  add that the map programme's own recent history makes it a bigger risk than "needs a clear
  toggle" suggests.

## My alternative in 5 lines

1. Today (same session): check and restore the DeepSeek account balance — this alone likely
   unfreezes topics, threads, country intel, and the map's news layer simultaneously.
2. Ship Stage 0 as proposed, plus S6·T1 (the map home swap) once situations re-populate to a
   sane density — it's already built, reuses zero new design effort, and is the differentiator.
3. Patch Story/Country's worst mobile-overflow and duplicate-fetch bugs as targeted fixes, not a
   full rebuild, until content freshness is confirmed to justify the larger investment.
4. Do the cheap renames/merges (`/story/:id`, `/briefings`, `/about`, `/methodology`) at low risk;
   defer `/country/:name` and `/world` until the 19-site country-link audit and a toggle-tested
   `/world` prototype exist.
5. Revisit the composed-Today idea only if, after (1)-(2), the map genuinely can't carry the front
   door — which the live evidence here doesn't yet support.
