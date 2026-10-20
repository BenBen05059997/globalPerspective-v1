# The record pipeline: what runs when, what each step reads and writes

Status: design (2026-10-20); companion to `ARCHITECTURE_RECORD.md` (structure) and `plans/PLAN_2026-10-20_record_backend.md`
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
| **05:45** | **the story record (planned)** | `newsStoryRecord` | archives (today + 30 d), `THREAD_ANALYSIS`, `DRIFT#` of the day, `PRED#` scenarios, `Q#*/VERDICT*`, `web/latest.json`, own `record/` | `record/stories/<id>/{latest,YYYY-MM-DD}.json`, `record/index.json`, `record/corrections/*` | after drift (05:30) so today's chapter decision is informed; before the resolver (10:30) is fine because the record reads verdicts a day late by design |
| 10:30 | forecast sample settled (exists; auto since 0034) | `newsPredictionResolver` | `PRED#`, `Q#`, Brave Search, LLM | `Q#*/VERDICT`, `SETTLE#` | public score |
| every 30 min | track record snapshot (exists) | `newsPredictionsSnapshot` | PredictionLog | `predictions/track_record.json` | — |
| on demand | pair verdict (planned, board) | `newsConnect` (`backend/board/`) | `record/`, `web/`, daily scores | `record/pairs/*` | cached per pair per day |
| on demand | board read/write, arrivals, reports (planned, board) | `newsBoard` (`backend/board/`) | `record/`, `weekly/latest.json`, user tables | `SavedItems` boards, `UserPrefs` fields | — |
| 07:40 (planned window) | alert digest (planned, board) | `newsEmailSender` mode `alerts` | `newsBoard` report, `UserPrefs.alerts` | `EMAILLOG#alerts#<date>`, Resend | one email at most; nothing if nothing fired |

## The week (Sunday)
| Time | Step | Who | Reads | Writes |
|---|---|---|---|---|
| 06:00 | the analyst's weekly written (planned; replaces `newsWeeklyBrief`) | headless Claude Code run following `.claude/skills/weekly-brief/SKILL.md`; `scripts/weekly-brief/check.mjs` validates, `publish.mjs` writes | `record/index.json`, this week's `record/stories/*` status rows, `record/corrections/`, `web/latest.json`, `predictions/track_record.json` | `weekly/YYYY-MM-DD.json` (`status:'published'`), `weekly/latest.json` |
| 06:00–14:00 | veto window | operator, one command (`scripts/weekly-brief/hold.mjs`) | — | rewrites nothing; appends `status:'held'` to the week's file via a new snapshot and moves `latest.json` back |
| 14:00 | weekly email (exists; new source) | `newsEmailSender` mode `weekly` | `weekly/latest.json`, `UserPrefs digestOptIn`, `newsBoard` report for members with a board | `EMAILLOG#weekly#<weekOf>`, Resend |
| Sun 06:00 (exists, to retire) | old weekly brief | `newsWeeklyBrief` / `TriggerWeeklyBrief` | — | `WEEKLY_BRIEF#` | retired after the first new-path send (fresh yes) |

## The month
| Step | Who | Reads | Writes |
|---|---|---|---|
| the board's monthly (planned, board) | `newsBoard` on first request after month end | four weekly reports, `record/` | cached on the board item (`report.monthly`) |

## Inside `newsStoryRecord` (the heart; planned)
For every thread with an entry in the last 30 days, in this order, idempotent per date:
1. **Birth.** `born` = earliest `archive#` date carrying the threadId. Written once.
2. **Duplicate check.** A thread born in the last 48 h whose actors and place match another active thread, with ≥1 shared
   outlet headline, is merged into the older one using the threads CLI logic (`backend/pipeline/cli/threads.mjs` → module).
   The merge is logged in the record (`events[].merged`), and `record/index.json` drops the duplicate.
3. **Events.** Append today's entries (`archive`, `topicId`, headline, outlets); attach the day's `DRIFT#` note if any.
4. **Chapter.** If today's drift note says the expected path changed (the corrector's "moved" gate) and the last chapter
   is older than 7 days, open a chapter: name + one sentence from the LLM (blind to earlier chapters' text), `writtenAt`
   today, put-once.
5. **Forks.** Each `PRED#<topicId>/<date>` scenario set for the thread becomes a fork at its event (first time seen):
   branches with `p`, `trigger`, `resolutionSource`, `due`. Existing forks are never rewritten.
6. **Trigger check.** For every live branch (`status` empty or `hold`): the LLM, blind to `p`, reads the trigger text,
   `due`, `resolutionSource` and today's entries for this thread and its confirmed links, and returns fired / hold / dead
   with cited entries. Rules (`shared/record.js`): `fired` needs a citation from the named source or two outlets; `dead`
   only when a sibling fired or the trigger became impossible; `late` is set by date, not by the LLM, when `due` passes
   without `fired`; `resurrected` when a `dead` branch's trigger is seen later. One dated status row per change.
7. **Corrections.** A `dead`→`fired` transition, or a line later contradicted, appends to `record/corrections/YYYY-MM-DD.json`.
8. **Verdicts.** `Q#<qid>/VERDICT*` rows for the thread's sampled questions are mirrored as `scored:{verdict, decidedAt}` on
   the matching branch (read-only mirror; the log stays the source).
9. **Line.** Rewrite the one-sentence `line` from the current chapter and the latest status rows; keep the previous text
   in `versions[]`.
10. **Write.** `record/stories/<id>/YYYY-MM-DD.json` (create-only), then `latest.json`; after all threads, `record/index.json`.
Dry-run mode writes to `record/shadow/` for one week before the real prefix (plan step 2).

Cost control: the LLM is called only in steps 4 (rare) and 6 (one call per live branch with new entries; branches with no
new entries are `hold` without a call). Expected: tens of calls a day, measured in the dry-run week.

## Failure behaviour
- A missing archive day (as 2026-10-14) is recorded in `record/index.json.coverage.missingDays[]`; the weekly prints it.
- A Lambda error leaves the previous `latest.json` in place; the next day's run catches up (idempotent per date).
- The weekly run with no `record/` for the week writes `status:'draft'` and nothing is sent; the freshness monitor
  alarms on a Sunday without a `published` file.
