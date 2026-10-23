# Forecast loop (draw, watch, gather, judge, record, review)

Status: active (2026-10-22): lanes M, N, O merged; record side deployed; generator and resolver deploy wait on IAM, a shadow run and the operator

Design: [ARCHITECTURE_FORECAST_LOOP.md](../architecture/ARCHITECTURE_FORECAST_LOOP.md). Rules: [decision 0038](../decisions/0038-forecast-loop.md).
Replaces `TASK_2026-10-17_grounded_forecast_and_cost.md` (deleted; `git show 4c1c9ad7:project-docs/plans/TASK_2026-10-17_grounded_forecast_and_cost.md` has its P0-P7 detail, the P7 impact map and the Jev backtest steps). Foundation step 2b ([PLAN_2026-10-21_foundation.md](PLAN_2026-10-21_foundation.md)) records the forecast row this plan answers.

## Goal
Close the loop: few resolvable outcomes drawn per story per week, a cheap nightly watch, a boxed judge, verdict facts, a weekly review. Pages stop promising checks that never come.

## Checklist
| Item | Owner | Operator yes? | Status | Evidence |
|---|---|---|---|---|
| Decision 0038 written | coordinator | no | ☑ | 0038 + inbox amendment d3219d4b |
| Generator: at most 3 outcomes/story/week, event text as `branch.text`, gates (lead 7-90, near-duplicate of open branch), draw only when the story moved | draw lane (`NewsProjectInvokeAgentLambda`) | Lambda deploy under standing authorization | ☑ | lane M merged; deployed 2026-10-23 with lane AB (CodeSha256 aXHKCkI9…): the first run after the DeepSeek top-up draws under the new rules; a dryRun can still be invoked by event |
| Draw quality: no invented calendar facts (grounded-date gate), no templated probabilities, drop example numbers from the schema; the 5-precedent prompt v2b awaits an operator yes | draw lane | yes for prompt v2b | ☐ | older plan P1/P2; A/B harness `predictions/forecast-ab/` |
| Resolver: watch triggers from `record/facts` (new entry that day, due + 3 days) | resolver lane (`newsPredictionResolver`) | no | ◐ | lane N merged 1dea6b38 (70 tests); dry run 2026-10-22: 96 candidates by age, cap 60; NOT deployed: needs IAM (GetObject record/facts/*, PutObject inbox) and a shadow run |
| Resolver: gather (superseded: web search dropped, see next row) and judge (existing lib.js rules, `issued_before_method` reason) | resolver lane | no | ◐ | lane N merged with web search, results on or before due; NOT deployed; gather changes to own entries after the draw (0038 amendment 2) |
| Resolver: evidence from own entry facts only (remove web search); "not reported by" wording | Sonnet lane | no | ◐ | merged 2026-10-22 (lane P, a3d5a148..994536a2; 78 tests pass): search.js and Brave deleted; rule-made `no` when no post-draw entry after grace; NOT deployed (DeepSeek); operator removes `BRAVE_SEARCH_API_KEY` from the Lambda env |
| Verdict inbox `record/inbox/verdicts/` (0038 amendment): resolver writes, facts writer reads 7 days | lanes N + O | IAM: yes (resolver PutObject inbox, GetObject record/facts) | ◐ | both sides merged; facts writer side deployed 2026-10-22 (CodeSha256 FzkQoXG4…, reads an empty inbox); resolver IAM applied 2026-10-22 (inline `newsPredictionResolver-record`: GetObject record/facts/*, Get/PutObject record/inbox/verdicts/* + shadow, ListBucket for 404s); resolver code not deployed |
| Coverage guard: a `no` only when every day from draw to due has a Run ok/partial with archiveDay present; else not_yet `coverage_gap` | Sonnet lane Q | IAM: GetObject record/runs/* on the resolver role | ◐ | lane Q merged (185199c2; 84 resolver tests pass): a gap day (missing/thin/failed/unreadable Run) turns any `no` into not_yet `coverage_gap`; gaps do not count toward the 3-draft void. Needs IAM GetObject record/runs/* (until then every no is held). Not deployed |
| Draw gates G15 already-true at draw, G16 vague institution | Sonnet lane Q | no | ◐ | lane Q merged (c874d781): G15 Jaccard 0.6 vs the story's entries up to the draw (last 7 archive days), G16 generic institution labels; not deployed |
| Page wording per 0038 (open, happened + quote, not reported by, could not be checked, recorded before scoring began) | Sonnet lane R | frontend release: yes | ☐ | |
| Legacy void job: the 2,451 branches without a question id voided once with `issued_before_method` | resolver lane | yes (one-time bulk write) | ◐ | built in newsStoryRecord behind `{legacyVoid:true, shadow}` (lane O 3d2bada3), deployed, NOT run; shadow run first, live needs operator yes |
| Page wording: board StoryTree and BoardWeekly, thread ThreadForecast, track-record copy ("open · due DATE", "happened · DATE", "not reported by DATE", "could not be checked · reason"; no "not checked yet") | frontend lane | yes (frontend release) | ☐ | |
| `counts.branchesDue` counts resolvable branches only | record lane (`newsStoryRecord`) | no | ☑ | lane O 1ff0bf8d: `isResolvable` = question:true + qid; legacy branches flagged, excluded from due/live counts; deployed |
| Verification 1: unit/golden tests (fixed branch + fixture; non-verbatim quote, no before due + 3, invalid void reason rejected) | resolver lane | no | ☑ | lanes M/N/O: draw.test.js (13), resolver judge/watch tests, inbox tests; all merged |
| Verification 2: dry-run replay over the 44 sampled questions and 20 branches with a known outcome; done by the judge benchmark (ARCHITECTURE_FORECAST_LOOP.md, Judge benchmark) | resolver lane | no | ☐ | |
| Verification 3: shadow fortnight to `record/shadow/`, agreement on the shared 22 | resolver lane | no | ☐ | |
| Verification 4: operator spot-check, 10 random verdicts a week, at least 90% agreement over two weeks before "not reported by" goes live | operator | yes | ☐ | |
| Verification 5: metrics and alarms (verdicts/day, void share, two-pass disagreement, branches past due + 3 unchecked, model errors) | monitoring lane | yes (alarms) | ☐ | |
| Judge benchmark: gold set (~100 questions: 44 sampled + past-due + ~20 with a later entry), frozen evidence once per question | Sonnet agent (read-only) | no | ☑ | 110 questions, frozen search results for 101, page text for 47 due questions (38 usable); `gp-mailbox/artifacts/judge-bench/` |
| Reference labels: two Claude Opus sub-agents judge independently under the resolver's rules (verified quote, grace, void reasons); agreed = `reference.json`, disagreed = `disputed.json` for the operator | coordinator + 2 Opus agents | no | ☑ | 47/47 agreement (kappa 1.00), every yes quote verified by code; 5 happened, 2 did not, 2 void, 38 not_yet (weak evidence); `reference.json`, `disputed.json` empty |
| Operator decides `disputed.json` and labels a blind 50 | operator | time | ☐ | |
| Benchmark re-cut on own entries after draw (questions + the entry facts written after each draw) | Opus agents | no | ☐ | waits on the DeepSeek top-up so the pipeline writes entries again; the web-evidence run stays as a first attempt |
| Score candidate judges against `reference.json` (DeepSeek flash/pro, then others): kappa, false-happened, quote pass, cost | Opus agent | no | ☐ | runner script in `newsPredictionResolver/bench/` (Sonnet lane, not opened); DeepSeek arm waits on the top-up |
| Judge model chosen from benchmark (kappa ≥0.6, false happened <5%) | operator | decision | ☐ | |
| Weekly review writes readings citing verdicts (foundation step 3) | review lane (`newsRecordReview`) | review model open in foundation plan | ☐ | |
| Carried over, selection: P7c shadow week (`newsSelectionShadow`, from 2026-10-18 20:20 run to about 10-25) then P7d switch to the layered selector; P6 blind review | selection lane | yes (P7d switch) | ◐ | `runbooks/selection-shadow.md` |
| Carried over, cost: P4 measured token counts replace estimates in `runbooks/DEEPSEEK_COST_ESTIMATE.md`; P5 low-balance alert in `newsModelGuard` | cost lane | no | ◐ | task rows said deployed 2026-10-17; recheck live |

## Open questions
- Brave quota and price are not in the repo; the watch's volume (a few dozen checks a night expected) must be measured in the shadow fortnight.

## Log
- 2026-10-22: design agreed by the operator after the forecast-loop research brief; this plan replaces the 2026-10-17 grounded-forecast task.
- 2026-10-22: verdict hand-off decided by the operator: an S3 inbox (`record/inbox/verdicts/`), not a DynamoDB lookup (about 4,989 queries a night) and not a resolver write to `record/facts/`; 0038 amendment; IAM yes still needed.
- 2026-10-22: lanes M (draw), N (resolver), O (record) merged. newsStoryRecord deployed with the inbox reader and legacy flags. Next: resolver IAM (GetObject record/facts/*, Put/GetObject record/inbox/verdicts/* and shadow), resolver shadow run, generator dryRun; both deploys need the operator's yes.
- 2026-10-22: resolver IAM applied (operator yes). Shadow run and resolver deploy blocked by DeepSeek 402 (still failing 04:18Z): the judge uses DeepSeek (`GROK_MODEL` deepseek-flash). Deploying before the top-up would make the 10:30 tick fail nightly. The resolver also needs env `WORLD_BUCKET` at deploy.
- 2026-10-22: judge benchmark agreed by the operator (gold set of about 100, frozen evidence, reference model of another family, kappa and false-happened gates); design in ARCHITECTURE_FORECAST_LOOP.md, rows added above.
- 2026-10-22: benchmark method fixed by the operator: no OpenRouter or new provider; reference labels come from two independent Claude sub-agents in this session, results kept as JSON in the mailbox artifacts; the operator settles disagreements. Questions+evidence collection running.
- 2026-10-22: reference labels done. Findings: (1) gathering, not judging, is the bottleneck: 38 of 47 undecided on old, unfetchable or missing pages; (2) the hard cases are timing (event already true at draw) and wording; the draw gate must reject outcomes already true, and `criterion_met_at_issue` needs a precise rule (draw time vs event time). Both judges are one model family: the operator's blind labels remain the ground truth.
- 2026-10-22: operator decision, 0038 amendment 2: evidence is only our own entry facts on the forecast's story dated after the draw (no web search); "no" is worded "not reported by DATE"; cross-story matches go to the weekly review as confirmed links; benchmark to be re-cut on own entries.
- 2026-10-22: lane P merged: the resolver reads only the story's own entries after the draw; verdict evidence is {eventId, quote, date} (passed through unchanged by newsStoryRecord and the views).
- 2026-10-22: `BRAVE_SEARCH_API_KEY` removal is tied to the resolver deploy (the live resolver's Monday drafts still search with it).
- 2026-10-22: operator: finish the rest before deploying the resolver. Lanes Q (coverage guard, draw gates) and R (page wording) opened. The resolver deploy now waits on lane Q as well as DeepSeek.
- 2026-10-22: lane Q merged. Resolver deploy prerequisites now: DeepSeek top-up, IAM GetObject record/runs/*, shadow review.
- 2026-10-23: NewsProjectInvokeAgentLambda deployed (draw rules + PRED# thread reconciliation). Takes effect at the first funded run.
- 2026-10-23: resolver deployed (CodeSha256 UHqPWXy/…, 512 MB, `WORLD_BUCKET`, IAM `record/runs/*` read). First watch: 40 grace candidates, 0 moved. Drafts stay `needs_human` until DeepSeek is funded; `BRAVE_SEARCH_API_KEY` and `GROK_MODEL` removal waits until the new build is accepted.
