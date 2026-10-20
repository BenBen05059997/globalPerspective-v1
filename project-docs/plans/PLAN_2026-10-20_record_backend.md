# The record backend: branches checked, chapters written, links confirmed, boards stored

Status: design agreed in discussion (2026-10-20); nothing built. Serves `PLAN_2026-10-20_analyst_weekly.md` (steps 3–6)
and `PLAN_2026-10-20_board.md`. Storage follows `rules/DATA_STRATEGY.md` (S3 for the world, DynamoDB for the
user, one writer per prefix, snapshots immutable, `latest` is a pointer, `index.json` instead of listing).

## Decisions (operator, 2026-10-20)
1. **No human gate anywhere.** Verdicts, branch status, chapters, link confirmation and the weekly are written by
   Lambdas. A wrong result is a bug in the algorithm: the operator reports it, the algorithm is fixed, the correction
   is appended. This reverses decision 0011's "operator confirms verdicts" and today's weekly decision 3 ("confirm
   before send"); both become "publish unless vetoed", see §5.
2. **Own folders, three names.** `backend/record/` (the world's memory), the weekly run + `features/weekly/` (the shared
   report), `backend/board/` + `features/board/` (the personal layer). Revised 2026-10-20 from "board in read-api".
3. **The record is append-only.** A dated line, a branch status, a verdict or a correction is never rewritten; a
   change is a new dated row. Paragraph summaries are versioned. Deletion does not exist; items are greyed.

## 0. Documents (operator, 2026-10-20: documentation before building)
- Structure, what is common / shared / independent, how it touches other places: `architecture/ARCHITECTURE_RECORD.md`.
- Step by step with times, reads and writes, the inside of `newsStoryRecord`, failure behaviour: `architecture/ARCHITECTURE_RECORD_PIPELINE.md`.
- This file: decisions, stores, order of work, log. When the subsystem is live, the two architecture files stay (they
  describe what runs) and this plan's lasting decisions become records; the plan is then deleted (TASK_WORKFLOW §2).
- Grouping (operator, 2026-10-20: three names, own folders): **record** = `backend/record/` (`newsStoryRecord`);
  **weekly** = the weekly run + `features/weekly/`; **board** = `backend/board/` (`newsBoard`, `newsConnect`) +
  `features/board/`. New shared code only in `backend/shared/src/` (`record.js`, `s3json.js`); the frontend reads the
  record through a new `shared/hooks/useRecord.js`. See `ARCHITECTURE_RECORD.md` §0.

## 1. What is stored where

### S3 (world bucket), new prefixes
| Prefix | Sole writer | Cadence | Content |
|---|---|---|---|
| `record/stories/<threadId>/latest.json`, `record/stories/<threadId>/YYYY-MM-DD.json` | `newsStoryRecord` | daily 05:30Z | the story record: `born`, `line` (current, versioned), `chapters[]` (dated, put-once lines), `forks[]` (each: `drawnAt`, `branches[]` with `p`, `trigger`, `due`, `status[]` dated rows fired/hold/dead/late/resurrected), `events[]` (dated, with `archive#` + `topicId` refs, drift note of the day, which fork it killed), `links[]` (confirmed only, with `confirmedBy:'rule'` and evidence) |
| `record/index.json` | `newsStoryRecord` | daily | one row per story: id, line, risk, chapters, live branches, last moved, cluster hints (actors, countries). The board's pin source |
| `record/corrections/YYYY-MM-DD.json`, `record/corrections/index.json` | `newsStoryRecord` | daily | a branch called dead that fired, a fact line later contradicted; each with both dates and the reason |
| `record/pairs/<a>__<b>/latest.json`, `…/YYYY-MM-DD.json` | `newsConnect` | on demand, cached | pair verdict: grounds (actors, places, mechanism, lag, shared sources, path), strength, direction, conditional re-weighting, falsifier + date, evidence refs. A fact about the world, so S3, cached per pair per day |
| `weekly/YYYY-MM-DD.json`, `weekly/latest.json` | the weekly run (headless Claude Code, decision 2 of the weekly plan) | Sun 06:00Z | the analyst's weekly: changelog, lead trace, forecasts, dates, new, coverage |

Existing prefixes used, no new writer: `web/` (story web; `newsSystemsAnalysis` gains a `confirmed` field per link,
§3), `predictions/track_record.json` (`newsPredictionsSnapshot`; now counts auto-written verdicts).

### DynamoDB (user tables), no new table
| Table | Change |
|---|---|
| `GlobalPerspectiveUserPrefs` | add `followedThreads[]`, `followedActors[]`, alert rules per pin/string (`alerts: {pinId: {branchFired:'instant'|'daily'|'weekly', …}}`), `quietBoards[]` |
| `GlobalPerspectiveSavedItems` | board items, `kind:'board'`: `boardId`, `name`, `pins[]`, `strings[]` (ours kept / yours drawn, each with `line`, `keptAt`, `cutAt`), `weights{forkId: {branchId: p}}`, `dismissed[]`, `summary` (versions), `preset` origin. Passes the sorting test: gone with the account |
| `GlobalPerspectivePredictionLog` (world table, not yet migrated) | `newsPredictionResolver` writes `Q#<qid>/VERDICT` itself (no draft-then-confirm); `VOID#<iso>` rows for operator reversals with reason; later migration to `record/` per DATA_STRATEGY §6 |

Derived per-user documents (the board's weekly and monthly) are computed on request by `newsBoard` from
`record/*` + the board item, and cached on the board item for the week; they are not stored in S3.

## 2. Lambdas
| Lambda | Group | Schedule | Does |
|---|---|---|---|
| `newsStoryRecord` (new) | `backend/record/` | daily 05:30Z, after `newsSystemsAnalysis` 05:00Z | for every active story: birth from earliest `archive#`; duplicate check at birth (shared actors + place + 48h → merge via the threads CLI logic, logged); chapter row when the day's drift note changes the expected path (line written once, dated); trigger check for every live branch against the day's entries (LLM judgment, blind to `p`, writes fired/hold/dead/late, resurrected when a dead trigger later fires); corrections; `record/index.json` |
| `newsConnect` (new) | `backend/board/` | on demand (Function URL, JWT) | pair verdict: cheap grounds from `record/index.json` + `web/latest.json` + daily scores; one LLM call for mechanism, direction, conditional, falsifier; writes `record/pairs/`; a second ask the same day returns the cache |
| `newsBoard` (new) | `backend/board/` | on demand (JWT) | board CRUD; arrivals (new `record/index.json` rows tested against the board's pins, strong → pool, medium → overflow); the board's weekly and monthly; presets (read-only boards owned by the operator, forked on request) |
| `newsPredictionResolver` (change) | `backend/predictions/` | daily 10:30Z (exists) | writes the verdict row directly from its draft; `unclear` stays excluded from the score; a `VOID#` row with reason reverses one (appended, never deleted) |
| `newsSystemsAnalysis` (change) | `backend/pipeline/` | daily 05:00Z (exists) | link confirmation rule: `confirmed:true` when both stories carry evidence on ≥2 days from ≥2 outlets within 14 days; else `inferred`. The weekly and the board draw only confirmed links solid |
| `newsEmailSender` (change) | `backend/distribution/` | Sun 14:00Z (exists) | renders `weekly/latest.json`; for members with a board, prepends the board's weekly from `newsBoard`; alert digest daily from the alert rules (one email at most, nothing if nothing fired) |
| `newsWeeklyBrief` (retire) | `backend/distribution/` | Sun 06:00Z | retired after the first weekly from the new path has sent |
| weekly run (headless Claude Code, cloud) | `.claude/skills/weekly-brief/` | Sun 06:00Z | writes `weekly/YYYY-MM-DD.json` as published, `latest.json`; the sender publishes at 14:00Z unless vetoed |

`scripts/functions.json` gains the three new Lambdas with `dir` under `backend/record/` and `backend/board/`.
IAM: `newsStoryRecord` PutObject on `record/stories/*`, `record/index.json`, `record/corrections/*` only;
`newsConnect` on `record/pairs/*`; the weekly run's credential on `weekly/*` only (needs a fresh yes).

## 3. The trigger check (the heart)
Input per branch: `trigger` text, `due`, `resolution_source` (named outlet or feed), the day's entries for the story
and for linked stories. Output: one dated status row `{date, status: fired|hold|dead|late, evidence:[{archive, topicId,
url}], note}` with the model blind to `p`. Rules: `fired` needs a cited entry from the named source or two outlets;
`dead` only when a competing branch fired or the trigger became impossible; `late` when `due` passes with no trigger;
`resurrected` when a `dead` branch later fires. A `dead` that fires writes a correction. Scoring: Brier over fired/dead
with `unclear` excluded, as methodology v1; the public number stays null below 150 resolved.

## 4. Borrowed from mature systems
- **Polymarket / UMA optimistic oracle:** outcomes are proposed and settle automatically unless disputed within a
  window; rules fixed at creation. Ours: automatic verdicts; an operator `VOID#` with reason is the dispute; the
  trigger text and `resolution_source` are fixed when the branch is drawn.
- **Metaculus:** only admins resolve; annulled/ambiguous drop out of scoring; re-resolution is allowed but recorded.
  Ours: `unclear` excluded, re-resolution appended, never overwritten. Their pre-launch checklist = our generation
  gates (G1–G6); where our triggers are vague ("an SAF statement") the fix is in generation, not resolution.
- **Git / Wikipedia:** append-only revisions. Ours: dated rows, versioned paragraphs, nothing deleted.
- **Linkurious:** groups start collapsed with counts; summary edges. Ours: `record/index.json` carries the counts so
  the board can fold without reading story files.
What we lack against them and accept for now: a public dispute path (the operator is the only disputer), and a
community prediction line (we have one view, ours, plus the reader's private weighting).

## 5. Publish-unless-vetoed
The weekly is published by the run at 06:00Z and sent at 14:00Z. The operator may veto with one command before
14:00Z (writes `status:'held'` into the week's file; the sender skips). Alerts follow the same rule with their own
window. Enabling the sender on the new path is a user-facing send and needs a fresh yes when reached.

## 6. Order of work
0. ✓ 2026-10-20: architecture + pipeline documents written (§0). Each later step updates them in the same commit.
1. ✓ 2026-10-20 (e2132a75, deployed, CodeSha256 Z9D6hUJD…): `newsPredictionResolver` writes verdicts directly; corrections
   are appended `VERDICT#<n>` rows with a reason via the `correct` action / `predictions/settle-correct.js` (decision 0034).
   Smoke: dry-run tick clean, `--list` shows the one due question (FEMA, draft `not_yet`, re-draft due 2026-10-24).
2. `newsStoryRecord`: birth + duplicate check + chapters + trigger check + corrections + index. Dry-run week first,
   compared against the two hand drafts.
3. `newsSystemsAnalysis`: link confirmation field.
4. Weekly plan steps 3–6 on top of `record/` (the weekly reads `record/index.json` and the week's status rows instead
   of raw pulls).
5. `followedThreads` + `newsBoard` + `newsConnect` + `features/board/`: the Studio phase.
Each step: README in its folder, `scripts/functions.json`, ARCHITECTURE and DATA_STRATEGY §4 updated, Atlas regenerated.

## Log
- 2026-10-20: step 1 done and deployed; the first live verdicts will appear as drafts settle (next draft pass Monday
  2026-10-26, or the FEMA re-draft on 10-24).

## Open
- Storage review (side project, researched 2026-10-20; **decided: keep DynamoDB for the user side**, operator): replacing DynamoDB for the user side was
  compared against Supabase (Tokyo, Firebase JWT works with RLS, but Pro $25/mo because the free project pauses when
  idle), Neon, Cloudflare D1/Durable Objects (fastest reads behind our Worker, but Lambdas write only via a rate-limited
  REST API; would mean moving user Lambdas to Workers), Turso, Firestore and per-user JSON in S3. Finding: DynamoDB
  costs under $1/mo in-region with single-digit ms reads; the saving is in the number of tables, not the engine.
  Recommendation: keep DynamoDB for users, consolidate the 5 user tables, move the 7 world tables to S3 as DATA_STRATEGY
  §6 says, and write the prediction log as weekly write-once JSONL + a rebuilt question index. Unverified: current
  DynamoDB Tokyo prices, S3 compare-and-swap support. Sources in the session transcript (agent report, 2026-10-20).
- Whether `record/` should also absorb the prediction log migration (DATA_STRATEGY §6) in step 1 or later.
- The LLM for the trigger check: the resolver's `deepseek-v4-pro` or the headless run's model. Cost per day to be
  measured in the dry-run week.
