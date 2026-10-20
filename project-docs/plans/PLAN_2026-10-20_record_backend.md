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
  **weekly** = `backend/weekly/` (one source of truth) + the weekly run + `features/weekly/`; **board** = `backend/board/` (`newsBoard`, `newsConnect`) +
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
| `newsStoryRecord` (new) | `backend/record/` | daily 05:45Z, after `newsDriftCorrector` 05:30Z | for every active story: birth from earliest `archive#`; duplicate check at birth (shared actors + place + 48h → report only, no merge: open operator decision); chapter row when the day's drift note changes the expected path (line written once, dated); trigger check for every live branch against the day's entries (LLM judgment, blind to `p`, writes fired/hold/dead/late, resurrected when a dead trigger later fires); corrections; `record/index.json` |
| `newsConnect` (new) | `backend/board/` | on demand (Function URL, JWT) | pair verdict: cheap grounds from `record/index.json` + `web/latest.json` + daily scores; one LLM call for mechanism, direction, conditional, falsifier; writes `record/pairs/`; a second ask the same day returns the cache |
| `newsBoard` (new) | `backend/board/` | on demand (JWT) | board CRUD; arrivals (new `record/index.json` rows tested against the board's pins, strong → pool, medium → overflow); the board's weekly and monthly; presets (read-only boards owned by the operator, forked on request) |
| `newsPredictionResolver` (change) | `backend/predictions/` | daily 10:30Z (exists) | writes the verdict row directly from its draft; `unclear` stays excluded from the score; a `VOID#` row with reason reverses one (appended, never deleted) |
| `newsSystemsAnalysis` (change) | `backend/pipeline/` | daily 05:00Z (exists) | link confirmation rule: `confirmed:true` when both stories carry evidence on ≥2 days from ≥2 outlets within 14 days; else `inferred`. The weekly and the board draw only confirmed links solid |
| `newsEmailSender` (change) | `backend/distribution/` | Sun 14:00Z (exists) | renders `weekly/latest.json`; for members with a board, prepends the board's weekly from `newsBoard`; alert digest daily from the alert rules (one email at most, nothing if nothing fired) |
| `newsWeeklyBrief` (retire) | `backend/distribution/` | Sun 06:00Z | retired after the first weekly from the new path has sent |
| weekly run (headless Claude Code, cloud) | `backend/weekly/` + `.claude/skills/weekly-brief/` | Sun 06:00Z | writes `weekly/YYYY-MM-DD.json` as published, `latest.json`; the sender publishes at 14:00Z unless vetoed |

`scripts/functions.json` gains the three new Lambdas with `dir` under `backend/record/` and `backend/board/`.
IAM: `newsStoryRecord` PutObject on `record/stories/*`, `record/index.json`, `record/corrections/*` only, GetObject on
`record/*` (append-only updates read its own state) and `web/*`, ListBucket scoped to `record/` (a missing object is a
404, not a 403);
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

## Story pipeline review (2026-10-20, read-only; proposals need operator decisions)
Nothing here is changed yet; the "Proposed" section needs operator decisions.

### Live incident found by the review (2026-10-20)
DeepSeek returns `402 Insufficient Balance` since about 03:50Z on 2026-10-20. Failing today: `newsSituationIngest`
(03:50), `newsInvokeGemini-dev` (04:15, 12:15: no new topics), `NewsProjectInvokeAgentLambda-dev` (04:25: re-archived
the 2026-10-19 20:15 topics under `archive#2026-10-20`), `newsThreadAnalysis` (04:40), `newsSystemsAnalysis` (05:00),
`newsCountryIntelligence` (05:15). `NewsCache latest` is still gen-1792440950003 (2026-10-19 20:15Z). No alarm fired.
The same outage caused the missing `archive#2026-10-14` and the thin 2026-10-13 (402 from 10-13 20:15 to 10-15 04:15).
Fix: operator tops up the DeepSeek balance (billing; operator only). Follow-up: an alarm on `LLM 402` in any Lambda, and
the agent must not re-archive stale staging as a new day.

### The four words, as the code uses them
| Word | What it is | Made by | Cadence | Reader sees it |
|---|---|---|---|---|
| topic | one item picked by the selector LLM from ~28 feeds (≤13 a run) | `newsInvokeGemini-dev` | 04:15, 12:15, 20:15 | `/today` |
| thread | the editorial story arc a topic joins (`thread-<slug>-<hash>`), ~90 days | `NewsProjectInvokeAgentLambda-dev` (`src/threading.js`) | 10 min after each selection | as "story": `/weekly/thread/:id`, the map's "open story" |
| story (map) | a cluster of classified headlines, id `axis#ISO3#first-entity` | `newsSituationIngest` | hourly | never directly (internal) |
| situation | a map pin: a GDACS event or the news stories of one country + thread (`news#ISO3#threadId`, else `news#<storyId>`) | `newsSituationTracker` | 30 min | the home map |
"Story" means a thread on every page and a map cluster in the backend: two meanings for one word.

### Editorial side: findings
1. **Same-day duplicates (cause fixed 2026-10-19, not yet proven).** The lookback skipped today (`for i = 1`), so a later
   run could not join an earlier run's thread the same day. 18 events in 2026-10-06..10-19 got 2-3 threadIds (17 same-day),
   e.g. Pakistan school collapse, Brazil deforestation (3 threads), Canada base fire, Trump "energy ceasefire". Fixed in
   b198ff92 (deployed 2026-10-19 09:41Z); only two runs ran with the fix before the outage, so it is unproven.
2. **Over-joins (cause fixed 2026-10-19; damage remains).** The old score rule joined on region + category alone, e.g. the
   Oregon school shooting joined a court/execution thread (`...ae75a8`, now 24 mixed entries). Fixed in b8858db6
   (keyword overlap ≥ 0.15). Mixed threads still to inspect: `ae75a8`, `287240` (28), `4e946d` (27), `68e0fb` (23).
3. **Still open:** topics in one run are never compared with each other; `continues_topic` beats an identical title
   (Nepal floods forked across days); the day row is capped at 50 entries; runs that generate nothing still write an archive.
4. The 18 old duplicates are still split in every downstream store (archive, THREAD#, PRED#, analyses, web index).

### Map side: findings
1. **Weak link to threads.** Map stories link to threads only on an exact shared article URL: 17 links from 3,436 map
   stories; 8 of 28 news situations carry a thread (2026-10-20). Big open pins have none (Putin-Trump-Xi, Sudan drone attack).
2. **Fragmentation.** A map story's id uses the first entity the LLM lists, so one event splits when that changes:
   Russia-Ukraine as 7 pins, French student protests as 4, Yemen as 3. Unthreaded stories never fold together.
3. **No cleanup:** `stories/state/` holds 3,436 objects, never pruned; the matcher scans all of them every run.
4. **Duplicated work:** 13 of ~25 feeds are fetched by both pipelines; both call an LLM to classify the same news.

### Proposed (operator decisions)
1. Now: top up DeepSeek; add an alarm on `LLM 402`; stop the agent writing a day's archive from stale staging.
2. Watch the 2026-10-19 fixes for a clean week before any automatic merge; meanwhile merge the 18 known duplicates once
   with `backend/pipeline/cli/threads.mjs merge --apply` (it already covers every store), and split the mixed threads.
3. Automatic merging, if wanted after that, belongs in the agent Lambda at join time (compare same-batch topics and the
   day's earlier runs; two agreeing signals; merge into the oldest id; log and undo), not in the record.
4. Structure: one meaning of "story". Options to discuss: (a) keep two pipelines, rename the map's internal "story" to
   "cluster", and link clusters to threads by country + actor + time instead of exact URL; (b) one ingest: the hourly
   map ingest becomes the only feed reader and classifier, and the 8-hourly selector picks topics from its clusters
   (one feed list, one classification, threads built from clusters). (b) removes the duplicated work and the weak link;
   it is a larger change.

## Log
- 2026-10-20: story pipeline review added (definitions, duplicate and fragmentation causes, DeepSeek 402 outage).
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
