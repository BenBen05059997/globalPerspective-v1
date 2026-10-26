# record

The world's memory, on two clocks: facts appended daily with no model, readings written weekly with hindsight. The weekly, story tree, board and track-record page read views of it.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Daily notes → 4 One reader → **5 Facts** → **6 Review** → **7 Views** → 8 Weekly report → 9 Delivery → 10 Watch
This folder is stage 5, 6, 7: newsStoryRecord appends the daily facts (5) and rebuilds the views (7); newsRecordReview (planned) writes the weekly readings (6). Timeline: newsStoryRecord is the only writer of record/facts; newsRecordReview (planned) is the only writer of record/readings and record/runs; views are rebuilt from both. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, user DynamoDB items, `features/board/` |

An agent working on the record does not write the other groups. Design: `project-docs/architecture/ARCHITECTURE_TIMELINE.md`.

## What the group owns

Two writers, each the only writer of its files (design decided 2026-10-21):
- `newsStoryRecord`: the facts writer and the only view builder, deployed, scheduled daily (rule `TriggerStoryRecord`, cron(45 23 * * ? *), payload `{"shadow":false}`). Appends `record/facts/YYYY-MM-DD.jsonl` per decision 0036 and writes the Run in `record/runs/YYYY-MM-DD.json`; no model. It turns the inboxes into facts: `record/inbox/articles/` (raw capture by the selector, 0040) into `article` facts, `record/inbox/assignments/` into `assignment` facts (the views follow the latest assignment per entry), `record/inbox/verdicts/` (the resolver) into `verdict` facts, and `record/inbox/merges/` (the review) into `story_merged` facts. It also reads `record/readings/` and the who's who file (`record/operator/aliases.json`, operator-owned, applied to actor ids in the views only; canonical ids are `wd:Q...`, entries marked generic never ground a link). On a missing archive day it still converts the articles; the Run reports `inputs.rawDay` and `counts.articles`.
- `newsRecordReview`: the weekly review (Monday 01:00 UTC, decision 0039). Reads the week's facts per active story and writes `record/readings/YYYY-Www.jsonl` (chapters, branch status, lines, typed links, merge and alias proposals), a review Run in `record/runs/review-YYYY-Www.json` and `record/inbox/merges/`; it may also propose assignments (readings only). Each reading cites facts and may supersede an earlier one; it is accepted or rejected with a reason. Merged in the repo; not created in AWS.

Views under `record/views/` are rebuilt in full from facts and readings after each daily append; the manifest is written last. Dated objects are create-only; latest and index objects are replaceable pointers.

## What it never writes

DynamoDB, `record/pairs/*`, `weekly/*`, user tables. Duplicate detection reports proposals; it never merges or splits threads (a merge is a review proposal, applied through the inbox).

## Schema

`newsStoryRecord/schema/fact.schema.json` and `run.schema.json` (draft-07) with examples; the old story and index schema went with the stories product. View schemas are in `newsStoryRecord/schema/views/`. See [newsStoryRecord](newsStoryRecord/README.md) for the format, tests and the local runner.

## Status

Live state per stage comes from AWS (`aws lambda get-function`, `aws events describe-rule`); what is stopped or waiting is in `project-docs/START_HERE.md`. No Run alarm exists (parked). Coordinator owns AWS resources and deployment.

## cli/reconcile-actors.mjs
Operator script, no model: reads actor ids from the live `views/index/active.json` (`--live`, read-only) or a local file (`--input`), asks Wikidata (`wbsearchentities` and, for offices, one SPARQL query; 1 request/second in total) for the top N (`--top`) or all (`--all`), and keeps a hit only when its description names an allowed class (person, office, government, ministry, armed forces, police, central bank, court, parliament, party, company, NGO, international organisation, armed group, country/region).

Match tiers (`confidence`/`via`): `exact` (top hit's label equals the name, accents folded), `alias` (matched alias equals the name), `near` (spelling variant: label or alias within 2 edits, same word set after folding word order, "of/the", demonyms and "military" = armed forces, or the same surname with a first name within 2 edits or an initial; any of the top 3 hits, but a lower hit sharing the exact name is a namesake and never counts; legal suffixes such as AG/Inc are ignored). A hit with no usable description is judged by its label ("Armed Forces of X"). A "<demonym> <org>" name also searches its entity title ("Government of South Korea").

Offices: when the hit looks like a position, the script probes it (instance of position or public office, not a human) and reads the holders (office P1308, or a person's P39) with P580/P582. The holders overlapping the actor's first to last appearance in the index are the answer: one holder gives a proposal for the person with `title` = the office name and `via: office->holder`; several give one proposal each with `period` and `ambiguous_period: true`; none gives the position item itself flagged `position_item`.

Dry run by default; `--write --out DIR` writes `aliases.candidate.json` (the alias-file schema; variants resolving to one id pool under the commonest name; generic and unresolved names included; `ambiguous` listed apart because one canonical takes one id), `review.md` (ready / check / unresolved / generic, one line per entry), plus `aliases.proposals.json`, `generic.candidates.json`, `unresolved.json`, `summary.json`. `--cache FILE` keeps Wikidata answers so a rerun costs no requests. It never writes `record/operator/aliases.json`; the operator copies accepted entries. Tests: `node --test cli/test/*.test.mjs` (no network).

Choices: ready = exact, alias, or an office with exactly one holder; check = near, ambiguous_period, position items. Only the operator promotes a candidate; wrong confident hits are caught in review, not by tightening the rule further.
