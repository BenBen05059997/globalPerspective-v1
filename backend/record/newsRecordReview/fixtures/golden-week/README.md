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
Active story = a story with any fact dated in the week (103 stories). Target 40; groups may overlap, so fewer are kept (32).
1. Top 10 by `entry` facts in the week (ties by threadId).
2. Forecasts with a branch `due` in the week: only 7 stories qualify, all kept. The week holds no `verdict` facts.
3. Duplicate candidates: pairs sharing a specific actor and a specific country, last facts within 14 days. Specific = carried by
   fewer than 5% of the 103 active stories (decision 0037 rule). 12 pairs, 13 stories kept (the pairs are listed in the lane report).
4. 10 at random from the remaining active stories: mulberry32, seed 20261019, over the sorted threadId list, Fisher-Yates shuffle.

## Counts
32 stories, 451 fact lines, 19 day files. Size is under 2 MB (see the lane report).

## Plan for expected readings
Two independent Claude Opus agents each draft readings for every story (line, chapter, links, branch status) from `facts/` only,
without seeing each other's output. The operator checks and reconciles them into `expected/`. The scored run requires citation
validity 100%; line and chapter agreement is judged by the two Claude judges.
