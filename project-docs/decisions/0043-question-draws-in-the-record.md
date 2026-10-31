# 0043. The weekly question draws move to the record (`question_commit`, `question_draw`)

Status: accepted (operator, 2026-10-31; follows 0035, 0036, 0038 and 0042)
Date: 2026-10-31

## Context
The record has the forecasts (`forecast_drawn` branches with `qid`, question, `scenarioP`) and the verdicts (`verdict` facts, from
`record/inbox/verdicts/`). It has not had the weekly sample. Whether a question is in the pre-registered sample of 22 (0011, 0038) lives
only in the PredictionLog: `SEED#<week>/COMMIT`, `SAMPLE#<week>/DRAW` and a `Q#<qid>/SAMPLED` row per pick. The read API's
`prediction_snapshot` reads those rows to give every question its `scoring` (`sampled`, `not_eligible`, `warm_up`, `awaiting_draw`,
`not_sampled`) and its `state` (`yes`, `no`, `void`, `awaiting`, `past_deadline_unchecked`; only for a sampled question). Without
the draws, story views built from the record alone cannot say which questions are scored, and a comparison against the snapshot
mislabelled 36 of 38 triggers. 0035 makes facts the system of record; a commitment published before the week and a draw anyone can
recompute are facts about the world, so they belong there.

## Decision
The resolver also writes each weekly commit and each weekly draw to an inbox it alone owns; `newsStoryRecord` turns the lines into two
new fact kinds; the story views carry `scoring` and `state` on every branch, computed with the snapshot's rules.

### 1. Layout and writers
| Object | Key | Writer | Mode |
|---|---|---|---|
| Draws inbox | `record/inbox/draws/YYYY-MM-DD.jsonl` (shadow `record/shadow/inbox/draws/`) | `newsPredictionResolver` only (day = the UTC day of `committedAt` / `drawnAt`) | append-only, `appendLines`, one nightly writer, as `inbox/verdicts/` |
| Facts | `record/facts/YYYY-MM-DD.jsonl` | `newsStoryRecord` only | as every fact (0036) |

The resolver appends in the same step as its PredictionLog write, best effort: a failed append is reported in the run's `errors` and the
DynamoDB rows stay (the line can be re-sent with the backfill CLI). `newsStoryRecord` reads the run day and the 6 days before
(`inboxFrom` backfills), like the other inboxes.

### 2. Inbox lines
One file, a `type` on each line (`schemaVersion: 1`, `sourceKey` as for verdicts):
- `commit`: `{weekId, weekStart, weekEnd, commitHash, rule, committedAt}`. `commitHash` is the sha-256 of the week's secret seed, published
  before the week starts (the resolver commits the next two weeks every night).
- `draw`: `{weekId, rule, K, eligible, clusters, seedHex, picked: [{qid, hash, clusterKey}], drawnAt}`. `seedHex` is the seed revealed at the
  draw (`sha-256(seedHex) = commitHash`); `picked` is the sample in rank order. The pool of eligible questions stays in the PredictionLog
  (`SAMPLE#<week>/DRAW.pool`); it is not copied, because no view needs it.

### 3. Kinds and IDs (schema `fact.schema.json`, examples in `schema/examples/`)
| Kind | `at` | `threadId` | `eventId` | Payload |
|---|---|---|---|---|
| `question_commit` | `committedAt` (exact) | null | `sha1('question_commit' + weekId)` | `{weekId, weekStart, weekEnd, rule, commitHash}` |
| `question_draw` | `drawnAt` (exact) | null | `sha1('question_draw' + weekId)` | `{weekId, rule, K, eligible, clusters, seedHex, picked: [{qid, hash, clusterKey}]}` |

A week has one commit and one draw (put-once in the PredictionLog), so the week is the identity: a re-read, a recovered line or a
backfill is the same fact. `iso3`, `actorIds`, `sourceIds` are empty. Both kinds belong to no story, so the story groupings and counts
ignore them; they count in the Run's `counts` like every kind.

### 4. Views
Each fork branch in `views/stories/<id>.json` gains two fields, `null` on a legacy branch (no question id):
- `scoring`: `sampled` when the `qid` is in any `question_draw.picked`; otherwise `not_eligible` when the lead (issue day to `due`) is
  under 7 or over 84 days; otherwise `warm_up` (no `question_commit` for the issue day's ISO week), `awaiting_draw` (a commit, no draw), or
  `not_sampled` (both). The issue day is the date in the `forkId`.
- `state`: only for a sampled question: the latest verdict's `result` (`yes`, `no`, `void`), else `past_deadline_unchecked` when `due`
  is before today, else `awaiting`. `null` for a question that was not sampled.

The rules are `backend/shared/src/questionState.js` (`isoWeekOfDay`, `sampleState`, `outcomeState`), ported rule for rule from the read
API's `questionSampleState` / `questionOutcomeState`. The read API keeps its copy until it is retired; a parity test in
`newsStoryRecord/test/draws.test.js` runs both on a grid of cases so they cannot drift while both exist.

### 5. Backfill and order
`backend/record/cli/backfill-question-draws.mjs` reads the existing `SEED#` and `SAMPLE#` rows (read only) and writes the same inbox lines
(`sourceKey` `backfill:draws/...`, so a re-run appends nothing) to the shadow prefix by default; `--live` writes the live prefix. Order:
resolver deploy (with its IAM), backfill to the live inbox, `newsStoryRecord` deploy, then a facts run with `inboxFrom` set to the first
draw day. A page may use `scoring` / `state` from the views only after the live facts hold the draws.

## Rejected
- Sampled flag on the `verdict` or `forecast_drawn` fact: the draw happens after the forecast and before the verdict; both facts are
  immutable, and the commitment itself (published before the week) would still be missing.
- Fact per pick (`question_sampled`): the draw is one event and one rule; per-pick facts repeat the week and make "was this week drawn"
  depend on having at least one pick.
- Copying `pool` into the draw fact: hundreds of ids per week that no view reads. Verifying the draw still needs the PredictionLog pool;
  adding it later is one more field.
- `newsStoryRecord` querying the PredictionLog for `SEED#` / `SAMPLE#`: puts a table read back into the facts run (0038 amendment: no
  table is read for verdicts), for data that is static once written.
- A second copy of the state rules inside `views.js`: the shared module is the one record-side implementation.

## Consequences
- The story views can drop the `prediction_snapshot` read for the forecast section's state and the track record's scored set.
- IAM: the resolver role needs `s3:PutObject` / `GetObject` on `record/inbox/draws/*` and `record/shadow/inbox/draws/*`
  (`newsPredictionResolver-record`); `newsStoryRecord` already reads `record/*`.
- The snapshot's eligibility window is 7-84 days, the resolver's draw rule is 7-90 (`LEAD_MAX`, 0038). A question issued 85-90 days
  before its deadline can be drawn, so it is `sampled`; one that was not drawn is labelled `not_eligible` by the snapshot and by the
  views, although the rule made it eligible. Resolved 2026-10-31 by 0045: 7-90 everywhere.
