# The record pipeline: what runs when, what each step reads and writes

Status: design (2026-10-20); revised 2026-10-21 for two clocks (facts daily, readings weekly): the stage list and the
object model are in `ARCHITECTURE_TIMELINE.md` (§1b, §4, §8), which wins on any difference. Companion to `ARCHITECTURE_RECORD.md` (structure) and `plans/PLAN_2026-10-20_record_backend.md`
(order of work). Times are UTC. Existing steps are marked (exists); the rest is planned. The existing content pipeline
is in `backend/pipeline/README.md` and `ARCHITECTURE.md` data flow 1.

## The day (every day)
| Time | Step | Lambda | Reads | Writes | Why this order |
|---|---|---|---|---|---|
| 04:15 / 12:15 / 20:15 | topics picked (exists) | `newsInvokeGemini-dev` | RSS | `NewsCache staging` | — |
| 04:25 / 12:25 / 20:25 | stories written, threads assigned, forecasts logged (exists) | `NewsProjectInvokeAgentLambda-dev` | `staging`, `FACTS#` | `NewsCache archive#<date>`, `THREAD#`, `PredictionLog PRED#` | the day's entries and scenarios exist after this |
| 04:40 | threads re-analysed (exists) | `newsThreadAnalysis` | archives, `THREAD#` | `THREAD_ANALYSIS`, `THREAD_HISTORY#` | daily risk and expected path |
| 05:00 | story web (exists; + link confirmation, planned) | `newsSystemsAnalysis` | archives, `THREAD_ANALYSIS` | `WEB#INDEX`, `web/latest.json`, `web/YYYY/MM/DD.json` | links before the record reads them |
| 05:15 | country briefings (exists) | `newsCountryIntelligence` | archives, `THREAD_ANALYSIS`, `FACTS#`, `DRIFT#` | `COUNTRY#`, `HISTORY#` | — |
| 05:30 | drift notes (exists) | `newsDriftCorrector` | `HISTORY#`, `THREAD_HISTORY#`, archives | `DRIFT#<date>`, `DRIFTLOG#<date>` | the "expected path changed" signal the record turns into chapters |
| **05:45** | **daily facts (shadow-only today)** | `newsStoryRecord` | archives (today + 30 d), `PRED#` scenarios, `Q#*/VERDICT*`, own `record/` | `record/facts/YYYY-MM-DD.jsonl` and the facts-only views (active index, links, daily counts); shadow: `record/shadow/` | after drift (05:30) so the day's notes exist as input; no model; no schedule yet |
| 10:30 | forecast sample settled (exists; auto since 0034) | `newsPredictionResolver` | `PRED#`, `Q#`, Brave Search, LLM | `Q#*/VERDICT`, `SETTLE#` | public score |
| every 30 min | track record snapshot (exists) | `newsPredictionsSnapshot` | PredictionLog | `predictions/track_record.json` | — |
| on demand | pair verdict (planned, board) | `newsConnect` (`backend/board/`) | `record/`, `web/`, daily scores | `record/pairs/*` | cached per pair per day |
| on demand | board read/write, arrivals, reports (planned, board) | `newsBoard` (`backend/board/`) | `record/`, `weekly/latest.json`, user tables | `SavedItems` boards, `UserPrefs` fields | — |
| 07:40 (planned window) | alert digest (planned, board) | `newsEmailSender` mode `alerts` | `newsBoard` report, `UserPrefs.alerts` | `EMAILLOG#alerts#<date>`, Resend | one email at most; nothing if nothing fired |

## The week
| When | Step | Who | Reads | Writes |
|---|---|---|---|---|
| Friday night | review: one full analysis, in order (planned) | `newsRecordReview` (`backend/record/`) | the week's `record/facts/*` per active story, its own earlier readings | `record/readings/YYYY-Www.jsonl`, `record/runs/YYYY-Www.json` (each reading accepted or rejected with a reason) |
| after the review | views rebuilt (planned) | `backend/record/` | facts + readings | `record/views/*` |
| after the views | the weekly report (planned; replaces `newsWeeklyBrief`) | headless Claude Code run following `.claude/skills/weekly-brief/SKILL.md`; `backend/weekly/pull.mjs` selects from the week's readings, `check.mjs` validates, `publish.mjs` writes | `record/readings/*`, `record/views/*`, `predictions/track_record.json` | `weekly/YYYY-MM-DD.json` (`status:'published'`), `weekly/latest.json` |
| until the next day | veto window | operator, one command (`backend/weekly/hold.mjs`) | - | appends `status:'held'` to the week's file via a new snapshot and moves `latest.json` back |
| weekly email day, 14:00 | weekly email (exists; new source) | `newsEmailSender` mode `weekly` | `weekly/latest.json`, `UserPrefs digestOptIn`, `newsBoard` report | `EMAILLOG#weekly#<weekOf>`, Resend |
| Sun 06:00 (exists, to retire) | old weekly brief | `newsWeeklyBrief` / `TriggerWeeklyBrief` | - | `WEEKLY_BRIEF#` (retired after the first new-path send, fresh yes) |
| on demand | re-run the review on a past week after an algorithm fix | `newsRecordReview` | that week's facts | new readings that supersede the old |

The exact clock times and the veto window length are not decided; they follow the review's first runs.

## The month
| Step | Who | Reads | Writes |
|---|---|---|---|
| the board's monthly (planned, board) | `newsBoard` on first request after month end | four weekly reports, `record/` | cached on the board item (`report.monthly`) |

## Inside the two writers
**Superseded 2026-10-21.** The earlier ten per-day steps (birth, duplicate check, events, chapter, forks, trigger check,
corrections, verdicts, line, write) put model calls in a daily writer. Replaced by:
- `newsStoryRecord` (daily, no model): birth, entries, forecasts (forks), verdicts, sources and actors as facts, appended
  idempotently by `eventId`; unknown actors stored as `unresolved:<name>`; a missing archive day is recorded in the Run,
  not as a fact. Its code still contains the old chapter, trigger and line model steps; they are to be removed (not yet done).
- `newsRecordReview` (weekly, planned): chapters, branch status (the fired / dead / late / resurrected rules from
  `shared/record.js`, including "fired needs a citation from the named source or two distinct outlets"), lines, typed
  links and actor merges, each as a reading that cites facts and may supersede an earlier one. Duplicate stories are
  proposed as merges and resolved as an alias, never by rewriting.
Cost: the model runs once a week, per active story with new facts; measured in the first run on the golden week.

## Failure behaviour
- A missing archive day (as 2026-10-14) is recorded in the Run object (coverage), not as a timeline fact; the weekly prints it.
- A Lambda error leaves the previous view in place; the next run catches up (idempotent per date and per period).
- A review with zero readings or a high rejection rate raises an alarm (Run objects are the signal). A weekly report with
  no readings for the week writes `status:'draft'` and nothing is sent.
