# Track record & Analysis Studio: do we need them, what for, how shown? (debate ruling, 2026-09-25)

**Status:** ruling for operator discussion. Design only; nothing built. Process:
- a fact pass (code, live proxy, CloudWatch, read-only DynamoDB scan) and a research pass
  (Metaculus, Good Judgment, Nate Silver, Polymarket; Perplexity Pages/Spaces, NotebookLM, Elicit, AlphaSense, Deep Research);
- three advocates: A destinations, B embedded everywhere, C lean/park;
- two critics: product/trust and engineering/statistics.

## Facts that changed the question (verified)
- **Track record is thinner than it looks.**
  - All **122 scored triggers come from one scoring run on 24 Jul**, covering 55 forecasts whose deadlines fall on **6–10 Jul** (one news week).
  - **Nothing has been scored in ~2 months.** Checked live: the recent-resolved list is all deadlines 9–10 Jul, all confirmed 24 Jul.
  - The `newsPredictionResolver` Lambda was never the source of those scores. It is a legacy proposer, dead for 10 days on the DeepSeek balance, with its own bugs: it mixes legacy and v1, takes items in scan order, retries the same 40 forever after a 402, and uses whole-item overwrites.
- **Statistics:**
  - Brier 0.154 vs a base-rate guess of 0.185, so skill ≈ 0.17. Bootstrapped by forecast, the **95% CI for skill is [−0.09, 0.35], i.e. indistinguishable from zero.**
  - Triggers are scored against their parent *scenario's* probability, which is not true calibration.
  - **The "strong" verdict is not defensible.**
- **Pending is two groups:** 14,153 not yet due and **6,454 overdue**. About 250 new dated triggers arrive a day, so scoring every trigger can never catch up.
- **The counter gap** (20,744 vs 122 + 20,607) is **15 triggers marked "unclear"**, counted in the total but in neither group.
- **Studio:**
  - The member server path has had **zero uses since 10 Jul** and is broken now (DeepSeek). BYOK usage is unknown (not logged).
  - Anonymous visitors are blocked entirely.
  - Best discoverability on the site (5 prefilled entry points).
  - Strong but unmarketed features: structured Key Judgments, citation validator, visual blocks.
  - No permalinks, no example.

## Ruling
### Track record: keep it, lean and honest (public)
**What it's for:**
- For readers: "do they admit when they're wrong?"
- For analyst buyers: "is the calibration real?" Today the honest answer is "not yet, and here's proof we know it".

**Page, in order:**
1. **Status line:** "Early: 122 triggers from 55 forecasts in one week of July scored; so far about what a base-rate guess would get. Next scoring: …" plus **last scored date** (freshness).
2. **Corrections ledger first.** "This read changed on <date> because <cited event>" is the real differentiator.
3. **Right and wrong examples** (recently resolved).
4. **"What we've learned so far"** (one click down): "we run too confident: things we rated ~64% likely happened 51% of the time". Buckets carry n and the number of distinct forecasts, and are labelled *early read*.
5. **Methodology**, including counts that add up: "15 unscoreable", "6,454 overdue", "14,153 not yet due".

**Removed now:** the "strong" verdict pill and the home counters (until they add up).

**Links:**
- Keep "How these forecasts are scored →" (story mode) and "All corrections →" (country card).
- Story mode and country cards may show a **ledger line** ("This read changed on <date> →").
- **No per-forecast badges** until sampled scoring makes them resolvable. Never infer "missed" from a passed deadline; unscored = "awaiting".

**Fix the engine first (the real work):**
- **Score a sample:** at capture, pick 1 trigger per forecast at random, score those in deadline order in a weekly run, and mark the rest "not scored (sampled)".
- Deterministic scoring for scheduled events (summits, votes, data releases).
- A **dead-man's alarm to SNS** when no verdict has been written for 10 days.
- Retire or fix the legacy resolver.
- Show calibration buckets with confidence intervals only after about **500 randomly sampled scores**: ≥100 per bucket, ≥30 forecasts, ≥4 deadline weeks.

### Analysis Studio: keep it as a page, "A-lite", entered from context
**What it's for:** the analyst workspace and the product you'd sell. It is also the already-decided home for the country deep-dive + web, bilateral view, "explain this web" and "Generate a briefing". Those need page space and state, so it is not a drawer.

**Anonymous visitors:** a one-line purpose + **one real, complete, cited example run** (read-only permalink, dated) + sign-in. Never a locked mockup.

**Signed in:** lens picker (with story chips prefilled from story mode / country card / briefings) → Bottom line → Key judgments (probability + confidence) → cited prose → visual blocks → **Share** (the next build).

**Copy now:**
- Remove the credits copy.
- The member path is either hidden or honestly labelled "temporarily unavailable".
- BYOK is the working path. Reword the promise to "your key and content never leave your browser" if an anonymous usage count is added (opt-in).

**Next build: a shareable permalink.** It saves the output **plus a frozen snapshot of the cited sources** (JSON on S3, unguessable id), only when the user clicks Share, with a noindex option, size cap, rate limit and delete link.

**Entry from other pages:**
- Story mode, the country card and briefings keep "Analyze in Studio →" (prefilled).
- Small hand-off drawers are allowed for scenario and explain-the-web; the long lenses open the page.

**Parked:**
- Member path promotion and credits. Un-park at ≥10 runs a month for a quarter, measured *after* the example + permalinks ship.
- New lenses beyond the decided ones.
- A saved-analysis library.

## Staged plan (sizes are the critics' estimates)
- **Track record:**
  - S1 (~0.5 day): copy + counters + ledger first + early-read labels.
  - S2 (~1–2 days): sampled scoring + weekly run + alarm + retire/fix the resolver.
  - S3 (later): buckets with confidence intervals at about 500 samples.
- **Studio:**
  - S1 (~1 day): copy cleanup, park the member path, public example.
  - S2 (~2–3 days): Share permalink with frozen citations.
  - S3 (~1 week+): country deep-dive / bilateral / generate-briefing pages + hand-off drawers.

## Decisions for the operator
| # | Decision | Recommendation |
|---|---|---|
| T1 | Keep the track record page, lean and honest, with the ledger first | Yes |
| T2 | Switch forecast scoring to a **random sample** (1 trigger per forecast) | Yes: otherwise "track record" can never be current |
| T3 | Who scores: a weekly operator/agent run vs a fixed AI resolver | Weekly agent run + deterministic checks; alarm either way |
| S1 | Keep the Studio as a page (A-lite) with a public example | Yes |
| S2 | Studio permalinks: public-but-unlisted by default; may BYOK runs be shared under the site's name? | Unlisted + noindex by default; label "generated by a reader with their own key" |
| S3 | Fund DeepSeek, or move the resolver / member path / other AI jobs to another provider | Operator's business call. Everything stays frozen until one of them |
