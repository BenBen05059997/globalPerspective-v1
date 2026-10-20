# weekly

The analyst's weekly: one brief per week, the same for every reader. It is the one backend source of truth for the weekly's content: schema, section model, and the pull, check, publish and hold scripts. The agent procedure lives in `.claude/skills/weekly-brief/SKILL.md` and holds only the steps; every rule, field and path comes from here.

<!-- pipeline:begin (generated from project-docs/architecture/pipeline.json; do not edit) -->
Pipeline: 1 Ingest → 2 Stories → 3 Analysis → 4 One reader → 5 Timeline → **6 Views** → 7 Delivery → 8 Watch
This folder is stage 6: the analyst's weekly: schema, section model, pull, check, publish. Timeline: writes the Week view (weekly/); reads through world/ until the timeline exists. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).
<!-- pipeline:end -->

## Three names, never mixed

| Name | What it is | Where it lives |
|---|---|---|
| record | the world's memory: one dated, append-only account per story | `backend/record/`, S3 `record/` |
| weekly | the analyst's weekly, the same for every reader | `backend/weekly/`, S3 `weekly/`, `features/weekly/` |
| board | the personal layer owned by one member | `backend/board/`, DynamoDB board items + prefs fields, `features/board/` |

An agent working on the weekly does not write `record/` or board data. See `project-docs/architecture/ARCHITECTURE_RECORD.md` §0.

## Owns

S3 `weekly/` only: `weekly/YYYY-MM-DD.json` (week ending; status `draft`, `published` or `held` is carried in the file) and `weekly/latest.json` (the newest published week).

## Reads

NewsCache `archive#` (7 days, plus 30 for story births), `THREAD_ANALYSIS`, `DRIFT#` / `DRIFTLOG#` (thread and country), `PRED#` scenarios with triggers, `Q#` due dates and verdicts, `web/latest.json` (S3). Later `record/` replaces the direct table reads (record plan, step 2).

## Read by

- `newsEmailSender` (`backend/distribution/newsEmailSender`), through the runtime-only `src/_weekly` symlink (W3): renders the email from `sections.js` and `weekly/latest.json`.
- `features/weekly/` (W5), through a mirrored copy of the sections core block, kept identical by `scripts/check-shared-sync.mjs`.
- The board, later.

## Files

| File | What it does | Stage |
|---|---|---|
| `schema/weekly.schema.json` | JSON Schema (draft-07) for one week's file; item caps equal `sections.js` | W0, frozen |
| `schema/examples/` | one valid example (week ending 2026-10-18, reshaped from the hand-run draft 2) and four invalid ones | W0 |
| `sections.js` | compatibility symlink to `runtime/sections.js`, the section model: keys, order, titles, required, item caps, email word caps, empty texts, label and confidence words, `orderedSections(weekly)` | W0, frozen |
| `test/` | section/schema, selection, checker and fake-S3 tests | W0–W2 |
| `pull.mjs` | reads the tables, applies the frozen selection rules, writes the inputs JSON | W1 |
| `check.mjs` | schema plus honesty rules against the inputs | W2 |
| `publish.mjs` | writes `weekly/YYYY-MM-DD.json` create-only and `weekly/latest.json` | W2 |
| `hold.mjs` | sets a week to `held` | W2 |

## How to run

Tests: `node --test backend/weekly/test/*.test.*` (the schema test borrows ajv from the frontend). Pull, check, publish and hold commands are below.

## Status

W0 schema and section model frozen; W1 pull and W2 author/check/publish/hold implemented. Plan: `project-docs/plans/PLAN_2026-10-20_analyst_weekly.md`.

## Pull (W1)

`node backend/weekly/pull.mjs --week-ending 2026-10-18 --out /tmp/weekly.inputs.json`

`pull(weekEnding, client)` takes the shared world/ client contract. Only
`backend/shared/src/world/` parses source rows and derives birth, missing days, coverage, outlets,
historical analysis, tiers and forks. `readInputs` collects its normalized views; `selection.mjs`
contains only the weekly's event/path/held-score gates, ranking, section projection and hashing.
The local entry point uses `local-client.mjs`: a generic AWS CLI transport behind world/'s adapters
when the SDK is not installed. No CLI or domain-row parser lives in the readers or selector.
Read errors propagate; only a successful missing item becomes a coverage gap. Archive reads cover
37 days at four in parallel; analyses use batchGet, history/drift/scenarios use scoped queries.
Archive topic ids are always passed to `scenarios` along with the story id. The default country
read scope is the existing drift writer's twelve countries, overridden by DRIFT_COUNTRIES.

The Sunday `web/YYYY/MM/DD.json` snapshot is preferred. Only its absence permits the latest-web
fallback; errors do not. The selected key is recorded in inputs.evidence.webSource and every
normalized row retains world/'s sourceRow/sourceKey. Fallback links remain possibly_related and
must be disclosed as a later snapshot in working notes. Sampled questions and verdicts also use
shared world readers; the weekly never parses Q# rows itself.

Inputs v2 contain normalized story candidates with exact source tuples and world-derived forks.
The fork's p is the question trigger's percent probability or null; scenarioP is separate and
never substitutes for missing p. When writing weekly.schema.json, convert a nonnull trigger p
from percent to the schema's fraction at that output boundary only. Branch status remains
not_checked until a record view supplies actual checks. Dates retain all deduplicated next-week
occurrences; email targets never trim the stored file.

Birth is earliest observed inside the lookback; windowLimited and missingBefore expose its bounds.
Historical risk/analysis uses analysisAsOf(..., weekEnding), preventing later regenerations leaking
backward. Coverage and analysed/new counts come directly from world.coverage.

New selection conservatively requires a completed-action headline. Periodic reports, prospective
actions and statements without an event are excluded with reasons. Qualified events have tracked
links, or risk >=50 and two outlets. Single-outlet stories rank last and must say “one source” in
the fact. Remaining order: links, risk tier, stable story id; never entry count. Store the top three,
with overflow ids in the inputs. Moved excludes births this week and risk below 25; a >=10 point
movement must hold over the last two readings and at the as-of analysis. A path move requires an
explicit logged expectation revision plus changed trajectories, ignoring percentage-only rewrites.
These lexical event/path gates have known false negatives while the record lacks structured kinds;
ambiguous trajectory changes remain in pathReviewCandidates for review rather than becoming moves.

## Write and check (W2)

Read the inputs and write to `schema/weekly.schema.json` following `.claude/skills/weekly-brief/SKILL.md`.
Use exactly the selected new/moved sets and every selected next-week date occurrence. Facts require exact source tuples from the same story; single-outlet
facts explicitly say “one source”. Every judgment is one plain sentence with its mechanism and a labelled
confidence. First reads are low confidence. Inferred links remain possibly_related; no defensible links
without an operator-reviewed input edge. Branches retain logged trigger/probability/deadline and
`not_checked` status. Forward tests/deadlines must be after the week Sunday; archive step dates and birth
dates are historical exceptions. Date-section items must fall within the next seven days. Never invent a
new call: this lane has no prediction-log writer; surface proposed new calls in notes for the coordinator.

`node backend/weekly/check.mjs /tmp/week.json --inputs /tmp/weekly.inputs.json`

Checks schema, canonical hash, selected membership, story/source provenance, exact coverage counts,
numbers in cited fact text and input story evidence, logged date/branch fields, chronology, labels and
section item caps. Word totals are advisory only. They count field strings rather than the final renderer’s printed count. The checker cannot prove that a paraphrase is
entailed, that an actor name is correctly used, or that a mechanism is sound: the writing procedure must
review each cited sentence and every judgment. A passing check is not a semantic fact-check.

Tests borrow the frontend's installed ajv, as the W0 schema test does. In a fresh worktree set NODE_PATH
to an existing installation of that dependency if necessary; no dependency files need changing.

## Publish and hold (W2; separate from writing)

`node backend/weekly/publish.mjs /tmp/checked-week.json`

`node backend/weekly/hold.mjs 2026-10-18`

These commands require the AWS SDK available to Node and scoped S3 credentials. They are live writes;
unit tests use only an injected fake client through `backend/shared/src/s3json.js`. Do not run them as
part of the writing skill. Publish creates `weekly/YYYY-MM-DD.json` with published status, then advances
latest. An identical retry repairs a failed latest write; different content at the same key fails.
Older weeks never replace a newer latest. Hold creates the immutable `weekly/YYYY-MM-DD.held.json`
snapshot; it never rewrites the original week, and cannot be republished. If that week is current, latest
returns to the nearest earlier published, nonheld weekly snapshot (search bounded at ten years). With no
predecessor latest carries the held snapshot so readers skip it. These operator commands must run
serially; no distributed lock is provided. The hold snapshot is an additional file under this group's
existing weekly/ ownership, not a new store or shared writer.

## First dry-run fixture

`test/fixtures/weekly-2026-10-18.json` is the W2 dry-run draft used by email rendering tests.
Its full inputs and rendered HTML/text are review artifacts in the lane mailbox, not production uploads.
The frozen top three new items match W0; Hormuz remains in the lead and trace. No moved item clears
the conservative evidence gate (the prior example’s Trump change was a human reconstruction).
The full file includes 98 deduplicated logged future dates instead of the example’s three hand-picked
items; it excludes the inferred FEMA grace-date because no logged future deadline supplies that date.
Coverage is 11 of 59 new stories with analysis dated by Sunday, rather than the W0 example’s 14 current
analysis rows. Risk 78 is high under the existing shared 25/50/75 bands, correcting the example’s elevated
word. All quantitative calls quote existing PRED# triggers; this procedure creates no new calls.

## Sender runtime

`runtime/sections.js` is the canonical model file. `sections.js` is a relative symlink to it,
so existing tools, schema-cap tests and the frontend sync guard keep their established path.
The sender's `_weekly -> ../../../weekly/runtime` ships only this runtime directory: no pull,
publish, fixtures, tests or schema examples enter the Lambda package through that symlink.
The sender skips and logs missing, held, nonpublished and wrong-Sunday latest snapshots, then
uses the existing EMAILLOG marker. It never sends an older week when a hold rolls latest back.
