## Grounded forecasts + DeepSeek cost controls — 2026-10-17 — active

**Goal:** Stop the forecast pipeline from inventing calendar facts (and copying template probabilities), and cut the research/forecast job's DeepSeek cost by about half, without breaking the scored forecast record that started 2026-09-30. Also: measure real token use, warn before the DeepSeek balance runs out, and backtest Jev as the "should we post this story?" gate.

**Why now (evidence, 2026-10-17):**
- Read today's 12 stories (Hormuz, Pope Leo, Kenya Ebola, Sri Lanka blackout, Egypt/Sisi in depth). Leader facts are right (FACTS# grounding works) and the forecast questions are specific, dated and checkable. But the research brief's UPCOMING DEADLINES section invents dates, and they leak into reader-facing forecast text:
  - "G20 Summit Nov 15–16 2026, New Delhi" — actually Miami (Doral), 14–15 Dec 2026 ([Wikipedia](https://en.wikipedia.org/wiki/2026_G20_Miami_summit)). Hormuz forecast rationale repeats "before the G20 Summit in mid-November".
  - "UNSCR 2231 remaining provisions expire Dec 2026" (believed already terminated Oct 2025; not re-checked).
  - Likely invented: "WHO Executive Board special session Oct 20–24", "Sri Lanka Cabinet Committee on Economic Management meeting Oct 20"; filler such as "World AIDS Day — not directly relevant".
- Probabilities are templated: nearly every story is "Most Likely 55–70% / Optimistic 15–20% / Pessimistic 15–20%", 3 scenarios.
- Some questions resolve in 1–2 days (Pope Angelus 10-18 p85; Sri Lanka power by 10-19 p85). The 7-day lead gate keeps them out of scoring, but they still show on the page.
- Cost: the research job is ~50–65% of DeepSeek spend (~$0.35–0.50/day, est.); ~90% of it is the two v4-pro calls per story (research ~900 out, forecast ~1,200 out). Same-title reuse (2026-10-05) reuses 0–3 stories per run because topic selection rewords headlines. Balance ran out 2026-10-12 → 10-15 (4th silent lapse); the top-up of 09-30 lasted ~12 days (~$0.75/day all callers).

**Root cause (code + references):**
1. `buildResearchPrompt` (`amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js`) demands "Be specific — name real people, institutions, treaties, and dates" and an UPCOMING DEADLINES list "in the next 1–3 months … Include specific dates where known". Nothing in the inputs carries a calendar (headline, snippets, FACTS# leaders, arc digest; the Brave web step is off — no key since 2026-09-10). The only source is model memory, which ends before Oct 2026, so the model fills the list with plausible guesses. Models are trained/graded so a confident guess beats "I don't know" ([OpenAI, Why language models hallucinate](https://openai.com/index/why-language-models-hallucinate/)), and are weakest on events past their data, often hallucinating instead of declining ([LLMLagBench](https://arxiv.org/pdf/2511.12116)).
2. `buildPredictionPrompt` says "Using the research briefing above…", so invented dates become stated reasons.
3. The JSON schema shows `"probability_range": "e.g. '55-65%'"` and `"horizon": "e.g. '2-4 weeks'"`; models anchor on numbers placed in the prompt, and prompt-only mitigations barely help ([Anchors in the Machine](https://arxiv.org/pdf/2511.05766), [SynAnchors](https://arxiv.org/pdf/2505.15392)).

**Reads / references:**
- `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` (`buildResearchPrompt`, `buildPredictionPrompt`, `generateAndStore`, `ensureStored`, `findSiblingItem`, `touchItem`, `logPredictionSnapshot`, `assignThreadId`, `readPastArchiveEntries`), `lib.js` (`decideReuse`, `validateTrigger` G1–G6, `buildGatedScenarios`, `METHODOLOGY_VERSION`), `questions.js` (G7–G12)
- `project-docs/prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md`, `project-docs/prediction/PREDICTION_V1_EXAMPLE.md`
- `amplify/backend/function/newsModelGuard/src/index.js` (daily 12:00 UTC, SNS `GlobalPerspectiveAlerts`)
- `amplify/backend/function/newsInvokeGemini/src/index.js` (`captureIngestion` → `GlobalPerspectiveIngestCapture`: SAW vs CHOSE per run), `project-docs/pipeline-ingest/IMPACT_VALIDATION_METHODOLOGY.md`
- `project-docs/ops/DEEPSEEK_COST_ESTIMATE.md`, memory `project_deepseek_cost`
- Consumers: `RESEARCH_BRIEFING` is served by `newsSensitiveData` (`research_briefing` action) but no frontend page calls `fetchResearchBriefingCache` → safe to stop producing.

### Phases (live tracker — update every phase; monitor ✓ before the next)

| # | Phase | Status | Gate to pass |
|---|---|---|---|
| P0 | Before/after harness on today's stories | ☐ | report shown to operator |
| P1 | Grounded single-call forecast (prompt) | ☐ | P0 numbers meet the bar below + operator go |
| P2 | Grounded-date gate in code (G13) | ☐ | tests + P0 rerun |
| P3 | One forecast per story per UTC day (threadId reuse) | ☐ | 2 live runs measured |
| P4 | Token-usage logging (all DeepSeek callers) | ☐ | real counts in logs for 24h |
| P5 | Low-balance alert in `newsModelGuard` | ☐ | test alert received |
| P6 | Jev "post this story?" backtest | ☐ blocked on Jev key + new-paid-API yes | backtest report |

**P0 — before/after harness (no live change).** Script `predictions/forecast-ab/run.mjs` loads the live job's prompt builders (module loaded with stubbed AWS SDK, as in the 10-05 reuse simulation), rebuilds today's inputs for the stored topics (staging topics item, FACTS#, 7-day archive digest), and runs A = current two-call path and B = new single grounded call on the same 12 stories. DeepSeek key read from the job's Lambda env inside the process only, never printed or written (operator yes 2026-10-17). Cost ~$0.10. Output `predictions/forecast-ab/REPORT_2026-10-17.md` (side by side per story) with measured metrics:
- dated claims in rationale/questions whose date or named scheduled event is NOT in the inputs (ungrounded-date count; hand-check a sample against a source);
- probability spread across stories (distinct `probability_range` values; share equal to 55–65/60–70);
- question count kept by gates G1–G12, mean lead time, share with lead < 7 days;
- tokens in/out from `usage` and $ per story.
**Bar for P1:** B has 0 ungrounded dated claims on the sample, keeps ≥ the same number of scoreable questions, and costs ≤ 60% of A. Operator reviews the side-by-side before any deploy.

**P1 — grounded single-call forecast.** Replace research + forecast with one v4-pro call:
- Inputs unchanged (snippets, FACTS# premise block, arc digest), plus an explicit rule: *only use a date or a named scheduled event if it appears in the snippets, the archive digest or the facts block; if none is known, say "no scheduled date known" — that is a correct answer.*
- Keep the separate reasoning sections (precedents, actors) inside the same response only if P0 shows they help question quality; otherwise drop them.
- Remove the example numbers from the schema (`"probability_range": "string, your own estimate"`, `"horizon": "string"`); ask for the probability to be justified by the precedents' base rate.
- Same output JSON shape → story page, Briefings question chip, country cards, Studio and the track record are unaffected.
- Stop writing `RESEARCH_BRIEFING` items (no reader); leave the proxy action returning empty.
- Methodology record: bump the prompt identity on every new `PRED#` row (`methodologyVersion` 1 → 2, or a `promptVersion` field — decide with the operator) so the scoring study can split pre/post-change forecasts.

**P2 — grounded-date gate (G13) in code.** In `buildGatedScenarios`: any explicit calendar date or named scheduled event in a trigger text or scenario rationale that does not occur in the input text (snippets + digest + facts) → the trigger is kept as narrative (`question:false`, like G7–G12) and the rationale sentence is dropped; record in `capture.dropped`. Trigger `deadline` fields are forecast windows, not claims, and are exempt. Unit tests with today's real cases (G20 New Delhi, UNSCR 2231 Dec 2026, WHO EB Oct 20–24). Defence in depth: the prompt asks, the code enforces.

**P3 — one forecast per story per UTC day.** Reuse lookup keyed on the story's `threadId` (computed before generation via `assignThreadId(topic, pastEntries)`; `pastEntries` is already loaded at the start of the run), not on the headline: if a forecast for the same thread was logged today, copy it (as the sibling path does) and skip the v4-pro call. Also fix the gap seen 10-05: an item reused by unchanged fingerprint writes no `PRED#` row for the day, so the next run regenerates. Trade-off (operator-accepted 2026-10-17 unless vetoed): a story that changes a lot during the day keeps its morning forecast until the next day. Measure on 2 live runs: forecasts generated vs reused.

**P4 — token logging.** Log `usage.prompt_tokens`, `usage.completion_tokens`, `prompt_cache_hit_tokens` (DeepSeek) per call with job + step, plus a CloudWatch metric per job. Callers: research job, story scan, topic selection, systems analysis, country intelligence, thread analysis, weekly/daily brief. Then replace estimates in `DEEPSEEK_COST_ESTIMATE.md` with measured numbers.

**P5 — low-balance alert.** `newsModelGuard` already holds the DeepSeek key and publishes to SNS: add `GET https://api.deepseek.com/user/balance` (check the current endpoint/response in DeepSeek docs at build time) and alert when total balance < $3 (~4 days at the current rate); include the measured daily burn from P4. Verify with a one-off test threshold.

**P6 — Jev gate backtest (after the operator supplies the key; new paid API needs a fresh yes).** Jev (TypeSafe) is a decision model: Choice / Score / yes-probability over text, no writing ([Requesty](https://www.requesty.ai/blog/typesafe-jev-explained)); ~$0.042 per M input, output free; experimental, pin a versioned model id. Design: candidates (story-scan stories or topic selection's raw headline pool) → Jev answers "should Global Perspectives publish this today, given these editorial rules?" (rules copied from the topic-selection prompt: impact, region/category spread, not a repeat) → code applies quotas + dedup and picks top N → a small flash call writes titles/descriptions for the chosen only. Backtest on `GlobalPerspectiveIngestCapture` (SAW vs CHOSE per past run): agreement with past picks, recall of high-impact stories per `IMPACT_VALIDATION_METHODOLOGY.md`, cost. Only public headlines are sent. No live switch without operator review of the backtest.

**Changes (code):**
- `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` (P1 prompt + single call; P3 threadId reuse + PRED gap; P4 usage logging)
- `amplify/backend/function/NewsProjectInvokeAgentLambda/src/lib.js` (P2 G13 in `buildGatedScenarios`; P3 reuse decision; version constant)
- `amplify/backend/function/NewsProjectInvokeAgentLambda/test/lib.test.js` (+ new tests)
- `amplify/backend/function/newsModelGuard/src/index.js` (P5)
- P4 usage logging in: `newsSituationIngest/src/index.js`, `newsInvokeGemini/src/index.js`, `newsSystemsAnalysis/src/*`, `newsCountryIntelligence/src/*`, `newsThreadAnalysis/src/*`, `newsWeeklyBrief/src/*`, `newsPostDevTo/src/*` (diff each deployed zip against the repo first)
- New: `predictions/forecast-ab/run.mjs`, `predictions/forecast-ab/REPORT_2026-10-17.md` (P0); `predictions/jev-backtest/*` (P6)

**Docs to update on completion:**
- `project-docs/architecture/ARCHITECTURE.md` §2 (`NewsProjectInvokeAgentLambda`: single grounded call, G13, threadId reuse, no RESEARCH_BRIEFING) and the `newsModelGuard` section (balance alert)
- `project-docs/prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md` (addendum: v2 prompt, G13, version split) and `PREDICTION_V1_EXAMPLE.md` if the example output changes
- `project-docs/ops/DEEPSEEK_COST_ESTIMATE.md` (measured numbers from P4)
- `CHANGES.md` per phase; `project-docs/INDEX.md` row for this task; memory `project_deepseek_cost`, `project_prediction_methodology_v1`

**Approvals:**
- P0 key use in the harness: operator yes 2026-10-17.
- P1–P5 Lambda code deploys: standing Lambda authorization (work the operator asked for), each deployed as a single bare command after diffing the deployed zip; P1 additionally waits for the operator's review of the P0 side-by-side.
- P6: operator supplies the Jev key and a fresh yes for the new paid API.

**Completion checklist:**
- [ ] P0 report delivered and reviewed
- [ ] P1–P5 code + tests, each deployed and verified on live runs
- [ ] docs updated (same commit as each phase)
- [ ] CHANGES.md entries
- [ ] Lambda tests (`node --test`) pass for every touched function
- [ ] P6 backtest report (when unblocked)
- [ ] status header flipped to `done`
