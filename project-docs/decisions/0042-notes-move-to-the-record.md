# 0042. The daily model notes move to the record (`record/notes/`)

Status: accepted (amends 0040 and ARCHITECTURE_TIMELINE.md "daily notes stay raw"; follows 0003)
Date: 2026-10-31

## Context
The record (0035) holds facts and readings in S3; only the board reads it. Every other page also shows the model's daily
notes: the per-entry summary, forecast and cause tabs, story analysis, drift notes, country briefings, the story-web links and
the briefs. Those live only in DynamoDB (`SummarizeAndPredict` `TOPIC#`, `THREAD_ANALYSIS`, `DRIFT#`, `COUNTRY#`/`HISTORY#`,
`WEB#INDEX`, `DAILY_BRIEF#`/`WEEKLY_BRIEF#`). The timeline design said they "stay raw daily notes", which contradicts the
rebuild test (the site rebuilds from the record alone) and 0003 (what we compute about the world goes to S3). The agent also
prunes every older `TOPIC#` generation, so the per-entry notes of older stories are lost today.

## Decision
Notes are written to the record as a third object beside facts and readings. A note is model text (or a model judgment) about
something the record already names; it is never a fact, and the views label it as model text.

### 1. Layout and writers
| Object | Key | Writer | Mode |
|---|---|---|---|
| Notes of one subtype and UTC day | `record/notes/<subtype>/YYYY-MM-DD.jsonl` | one Lambda per subtype (table below) | append-only, `appendLines` (dedupe by `noteId`) |
| Manifest of one subtype | `record/notes/<subtype>/manifest.json` `{schemaVersion:1, days:[...]}` | the same Lambda | conditional rewrite, the facts manifest rule (0036 §1) |

One writer per prefix (DATA_STRATEGY). The day is the UTC date of the note's `at`.

| Subtype | Subject | Writer (today's DynamoDB home) | Step |
|---|---|---|---|
| `entry` | an entry fact (`eventId`) | `NewsProjectInvokeAgentLambda` (`TOPIC#` SUMMARY, PREDICTION, TRACE_CAUSE) | 1 |
| `story_analysis` | a story (`threadId`) | `newsThreadAnalysis` (`THREAD_ANALYSIS`) | 2 |
| `drift` | a country (ISO3) | `newsDriftCorrector` (`DRIFT#`) | 2 |
| `country` | a country (ISO3) | `newsCountryIntelligence` (`COUNTRY#`, `HISTORY#`) | 3 |
| `link` | a story pair (`pairKey`) | `newsSystemsAnalysis` (`WEB#INDEX`) | 4 |
| `brief` | `daily:YYYY-MM-DD` or `weekly:YYYY-Www` | the brief writers (`DAILY_BRIEF#`, `WEEKLY_BRIEF#`) | 5 |

### 2. The note object (schema `backend/record/schema/note.schema.json`)
`{schemaVersion:1, noteId, subtype, subject:{kind, id}, part, threadId, iso3[], at, date, payload, cites[eventId], model,
promptVersion, producer:{lambda, runId}}`
- `subject.kind` is `entry` | `story` | `country` | `pair` | `brief`; `subject.id` is the record's own ID for it: an entry
  `eventId`, a `threadId`, an ISO3 code, `pairKey(a, b)` (shared `record.js`), or `daily:DATE` / `weekly:WEEK`. Never a title or
  a `topicId` (unstable across runs, 0036); a `topicId` may be kept inside `payload` for tracing only.
- `part` names which text of the subject this is (`summary`, `prediction`, `cause` for an entry; `''` when the subtype has one).
- `noteId = sha1('note|' + subtype + '|' + subject.id + '|' + part + '|' + at)` (shared `record.js` `noteId`). Same note, same
  ID: a retried write appends nothing.
- `cites`: eventIds the note rests on (an entry note cites its entry). `threadId` and `iso3` are copied for indexing (null / []).
- `model` and `promptVersion` as on readings; `producer` as on facts.
- A newer note of the same subject and part replaces the older one in the views (latest `at` wins); files are never edited.

### 3. Views and pages
`newsStoryRecord` reads the note manifests and attaches the latest note per subject and part to the views (an entry's notes on
the entry, a story's on the story view, a country's in a country view when step 3 adds it), each marked as model text with its
`at` and `model`. A page moves to the views only when its notes are there; until then it keeps its DynamoDB read.

### 4. Not notes
Source details the page shows are not model text: outlet tier, type and country are looked up from the shared outlet table
when the views are built (`getOutletMeta`), and the RSS snippet and actor display names are raw capture, added to new entry
facts. Facts stay pre-model (0040).

### 5. Order and retirement
Per subtype: the writer writes both places (DynamoDB and the note); the views attach the notes; the page switches; when no
reader is left, the DynamoDB rows are deleted with an operator yes each. Older `TOPIC#` notes already pruned are not recovered;
the backfill copies the current generation once.

## Rejected
- Notes as facts: breaks raw-before-model (0040); a fact is what happened, a note is what a model wrote about it.
- One `record/notes/YYYY-MM-DD.jsonl` for all subtypes: six writers on one key; one writer per prefix keeps appends uncontended.
- `newsStoryRecord` copying `TOPIC#` into notes nightly: notes pruned between agent runs would be lost; the writer that makes a
  note records it.
- Keeping notes in DynamoDB for good: violates 0003 and keeps two systems for every page.
