# Golden week fixture

Real facts frozen from `s3://globalperspective-world-280362093938/record/facts/` (read-only sync, 2026-10-22) for the week
2026-10-13..2026-10-19. The `newsRecordReview` Lambda runs against it with a stub model in tests (deterministic); a scored run
compares a real model's readings to the expected ones (spec: step 3, "Testing: the golden week").

## Contents
- `facts/YYYY-MM-DD.jsonl`: every fact (any kind) of the selected stories from their birth through 2026-10-19, same file-per-day
  layout as `record/facts/` (decision 0036), filtered to those stories. Days 2026-10-13 .. 10-19 plus earlier days back to 2026-09-30.
  No fact after 2026-10-19 is included.
- `stories.json`: the selected stories, with why each was chosen (`why`), birth date, fact count.
- `manifest.json`: source, range, seed, counts, day list.
- `expected/`: empty. Expected readings are drafted by two independent Claude Opus agents and checked by the operator
  (same method as the judge benchmark); they are not written by hand here.

## Selection rule
Active story = a story with any fact dated in the week (103 stories). Target 40; groups overlap and some groups are short, so 29 are kept.
Only stories with a `story_born` or `entry` fact are eligible: 14 of the 103 are forecast-only in the facts (a forecast_drawn with
no entry anywhere) and were left out; that is a data finding, not a fixture choice.
1. Top 10 by `entry` facts in the week (ties by threadId).
2. Forecasts with a branch `due` in the week: only 7 stories qualify, all kept. The week holds no `verdict` facts.
3. Duplicate candidates: pairs sharing a specific actor and a specific country, last facts within 14 days. Specific = carried by
   fewer than 5% of the 103 active stories (decision 0037 rule). 12 pairs found, 10 eligible stories kept.
4. 10 at random from the remaining active stories: mulberry32, seed 20261019, over the sorted threadId list, Fisher-Yates shuffle.

## Counts
29 stories, 462 fact lines, 19 day files, about 1.36 MB.

## Scoring (decision 0039, amended 2026-10-31)
Run: `node scripts/golden-week.js real` from `backend/record/newsRecordReview` (env `GROK_API_URL`, `XAI_API_KEY`, `REVIEW_MODEL` as on the
Lambda). Pass: over three runs, no story fails, no `no_citation`/`unknown_eventId` rejection, no other rejection beyond the odd shape
slip; then an operator spot check of a few stories and the 2-3 story canary. `capture` writes the exact model input; `replay DIR`
puts drafted answers through the same check.

| Prompt | Model | Stories read | Lines | Chapters | Rejected | Result |
|---|---|---|---|---|---|---|
| review-3 | deepseek-v4-pro | 22-23 of 27 (rest cut off at 3000 tokens) | 20 | 38 | 45 (30 fired/dead on open branches, 9 chapter dates, 2 uncited) + 126 unsupported `holding` | fail |
| review-4 | deepseek-v4-pro, 3 runs | 27 of 27 | 25 of 26 | 48-51 | 2-3 shape slips, 0 citation; plus 15 `over_cap` assignments on one story | pass the gates |

Runs: `runs/review-4-real/readings-N.jsonl`, `run-N.json`.

What the fixture can and cannot test: every entry summary is null (headlines only); no story has neighbours, verdicts, earlier
readings or operator aliases, so links, merges and alias conflicts are untested. Known data problems it shows: the Amazon
deforestation stories (35a31e, c5bce9, da86ee) and the Canadian base fire stories (6822c0, bf3dd0) are duplicates the review cannot
merge without neighbours; da86ee has no entries; us-court-halts-execution ae75a8 holds about 20 unrelated entries (an over-joined
thread). Two independent Opus drafts (2026-10-30) agreed on 26 lines, the same 4 past-due branches and 14 of 15 flagged entries,
differed on chapter granularity (28 vs 40); the files were lost with a temporary folder, so `expected/` stays empty.
