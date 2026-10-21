# 0036. Facts file format: layout, fact object, content IDs, Run, backfill

Status: accepted (implements step 1 of 0035; `ARCHITECTURE_TIMELINE.md` §2 to §5 are narrowed by this record where they differ)
Date: 2026-10-21

## Context
0035 makes `record/facts/` the system of record and says step 1 is "Ingest writes facts alongside today's rows".
It does not fix the file format. FOUNDATION.md (A, C, E, G) found the inputs a lane must handle:
- `eventId` is `sha1(kind + sourceKey)`, and an entry `sourceKey` is `archive#date|generationId|topicId`. `topicId` is `<title>-<rank>` and changes between runs, so the same article gets a new ID on a re-run.
- Entries carry no `schemaVersion`, no source ID, no actor ID, no absolute publish time (only `archivedAt`).
- `iso3`, `actors`, `event_type` are absent before about 2026-09-12; 28 of 60 days have no `archive#` row.
- The record manifest write is unconditional, so two writers can lose a day from `days`.
- The timeline writer calls a model per day (chapter, trigger, line) and writes `coverage` events; both are readings or Run data under 0035.
`shared/src/s3json.js` already gives `getLines` (ETag) and `appendLines` (If-Match, 412 retry, dedupe by id).

## Decision

### 1. File layout
| Object | Key | Written by | Mode |
|---|---|---|---|
| Facts of one UTC day | `record/facts/YYYY-MM-DD.jsonl` | `newsStoryRecord` | append-only, `appendLines(key, facts)` |
| Manifest | `record/facts/manifest.json` `{schemaVersion:1, days:[...sorted unique]}` | `newsStoryRecord` | conditional rewrite |
| Run of one day | `record/runs/YYYY-MM-DD.json` | `newsStoryRecord` | see section 4 |
| Shadow mirror | `record/shadow/facts/...`, `record/shadow/runs/...` | same code, `shadow:true` | same rules |

- One JSON object per line. The day is the UTC date of the fact's `at`, not the run date: a late fact lands in an old file.
- `appendLines` dedupes by `eventId` and writes with If-Match (If-None-Match `*` for a new file). On 412 it re-reads and retries (3 times). If it still loses, the run fails; nothing is half-written because the whole object is one PUT.
- **Manifest rule.** Read with `getJson` (keep the ETag). Compute `days = sort(unique(old.days + dates this run wrote))`. PUT with If-Match (If-None-Match `*` when absent). On 412: re-read, re-merge (union is idempotent), retry up to 5 times, then fail the run with `failures:[{stage:'manifest'}]`. Never write a manifest from a stale read without the condition. A reader that finds a file missing from `days` still trusts the file; `days` is an index, not the truth, and a Run (section 4) names every day it wrote.
- Shadow mode (before the flip) writes the same bytes under `record/shadow/`; the flip is a prefix change, not a code change.

### 2. The fact object
| Field | Type | Req | Meaning |
|---|---|---|---|
| `schemaVersion` | int | yes | `1` |
| `eventId` | string | yes | `sha1(kind + sourceKey)`; entry facts use the content rule in section 3 |
| `kind` | string | yes | one of the kinds below |
| `at` | ISO UTC string | yes | when it happened or was reported; for entries without a publish time, `archivedAt` |
| `date` | `YYYY-MM-DD` | yes | UTC date of `at`; selects the file |
| `precision` | `exact` or `day` | yes | `exact` when `at` is a real timestamp; `day` when only the day is known (all archive entries today) |
| `threadId` | string or null | yes | story; null only for `run` and facts with no story |
| `iso3` | string[] | yes | sorted unique; `[]` when unknown |
| `actorIds` | string[] | yes | sorted unique `name:<normalized>`; `[]` when unknown |
| `sourceIds` | string[] | yes | `sha1(registrable domain)` of each outlet cited |
| `payload` | object | yes | kind-specific |
| `producer` | `{lambda, runId}` | yes | writer name with version, and the Run it belongs to |
| `sourceKey` | string | yes | stable key of the raw row (`archive#date\|generationId\|topicId`, `PRED#...`, `Q#...`) |
| `sourceRow` | `{store, key, index?}` | yes | provenance back to the raw row, kept as today |
| `idBasis` | `'url'` or `'title'` | entry only | how `eventId` was formed |
| `sources` | `[{sourceId, outlet, url, title}]` | entry only | evidence list; `outlet` from `outlets.js`, null when unknown |

Fact kinds written in step 1:
| kind | payload essentials |
|---|---|
| `entry` | title, summary, category, eventType, continuesTopic, `topicId` (as seen, not an ID) |
| `story_born` | first title; derived from the earliest `entry` per `threadId` |
| `forecast_drawn` | forkId, branches `{branchId, text, p, trigger, resolutionSource, due}` |
| `verdict` | qid, result `yes|no|void`, decidedBy, evidence |
| `correction` | `corrects` (eventId), what was wrong, reason |
| `story_merged` | `{from, into, reason, evidence}`; `from` and `into` are `threadId`s, `threadId` field = `into` |
| `run` | `{runId, status, counts}`; the day was processed (section 4) |

Not facts: `chapter`, `line`, `branch_status`, `link` are readings (step 3). `coverage` is Run data. `situation` stays deferred.
`type` (action or statement) from the earlier sketch is dropped from the envelope; selection reads `payload.eventType` until the review defines it.

### 3. IDs by content
**Entry `eventId`.** `sha1('entry' + canonicalUrl)` where `canonicalUrl` is the lexically smallest canonical url among the entry's `sources[]` (sort after canonicalising), so source order cannot change the ID. Steps:
1. Trim; parse with `new URL`. If it throws, treat as no url.
2. Lowercase scheme and host; drop `www.`; drop default ports (80, 443).
3. Path: keep case; remove a trailing `/` unless the path is `/` only; no other rewriting.
4. Query: remove `utm_*`, `fbclid`, `gclid`; sort the remaining pairs by key then value; drop `?` when empty.
5. Drop the fragment.
6. Re-serialise as `scheme://host[:port]path[?query]`.

**No url fallback.** `sha1('entry' + date + normalizedTitle)`; `normalizedTitle` = `normalizeActor`-style (trim, collapse spaces, lowercase). Set `idBasis:'title'`. Title-basis IDs are weaker (a re-titled run creates a second fact); the reader may fold two title-basis entries with the same `threadId` and `date` and does not do so in step 1.

Other IDs:
| Object | ID | Rule |
|---|---|---|
| Source | `sourceId` | `sha1(registrable domain)`, domain lowercased, `www.` dropped, registrable part = last two labels, or last three when the host ends in a listed two-level public suffix (`co.uk org.uk ac.uk co.jp co.kr co.in co.za com.au com.br com.cn com.mx com.ar com.tr`; the list is a constant in `backend/shared/src/outlets.js`, extended with a note here); leading `www.`, `m.`, `amp.` dropped; `outlet` = `getOutletMeta(domain).outlet`, null when unknown, never invented |
| Actor | `actorId` | `'name:' + normalizeActor(name)` from `backend/shared/src/record.js`; unresolved names keep this form, no `unresolved:` prefix yet (deferred until the actor table) |
| Story | `threadId` | unchanged |
| Merge | `story_merged` | points `from` to `into`; readers resolve transitively (A to B to C = A to C), reject a cycle by ignoring the later record |
| Other kinds | `sha1(kind + sourceKey)` | as today |

### 4. The Run object
`record/runs/YYYY-MM-DD.json` for the daily facts run.
```
{ runId: "2026-10-21-1", schemaVersion: 1, producer: "newsStoryRecord@x.y.z",
  startedAt, finishedAt, status: "started|ok|partial|failed",
  inputs: { archiveDay: "present"|"missing"|{thin:<count>}, todayArchive: "present"|"missing" },
  counts: { entry: n, story_born: n, forecast_drawn: n, verdict: n, correction: n, story_merged: n, run: 1 },
  failures: [{stage, message, ref?}], notes: "" }
```
- `runId` = date + `-` + attempt number (1 for the first run of the date, counted from existing Run objects).
- `thin` when the day has fewer than 20 entries (normal days hold 35-50; the outage days 2026-10-13 and 10-20 held 13 and 14; constant in the writer, change it with a note here).
- `status`: `ok` all stages done; `partial` some facts written, at least one failure; `failed` nothing written or a fatal error.
- **Not append-only, on purpose.** It is written first as `status:"started"` and overwritten at the end, so a crash leaves a visible `started` Run with no `finishedAt` (that is the alarm), and a retry replaces its own earlier attempt's result. Facts stay append-only; the Run is the one mutable object, and it holds no world data.
- A `run` fact (`threadId:null`, `at`=`finishedAt`, `sourceKey`=`run#<runId>`) is appended at the end so the timeline records that the day was processed. A failed Run still appends it, with the status in the payload.

### 5. Detecting a missing day
From the Step 0 finding (PLAN_2026-10-21_foundation.md): 28 archive days were lost because the model Lambda returned
`{status:'error'}` instead of throwing; the schedule ran 6/day with Errors = 0 and the day was marked "already processed".
Requirements for the facts writer:
1. A Run object is written on every run, including failure and skip; `inputs.archiveDay`, `inputs.todayArchive` and the
   entry count are recorded, so a swallowed upstream failure shows as `missing`/`thin`, never as `ok`.
2. Two alarms (Watch rule, topic needs the operator's yes): no `record/facts/DATE.jsonl` by a fixed UTC time; and an
   upstream fast-fail signal (the model Lambda's daily average Duration under 10 s, the pattern seen on every gap day).
3. The writer reads `today-archive` as well as `archive#DATE`, so a day whose archive row was never swapped in still
   yields facts (marked `inputs.archiveDay:"missing"`), and marks thin days.
Fixed now: a Run with `inputs.archiveDay = "missing"` is itself the alarm signal. A day with no Run object at all, or a Run left at `started`, is also an alarm.

### 6. Backfill rule
- Replay existing `archive#` rows from 2026-09-06 onward through the same code path as the daily run, oldest first. No second implementation.
- Idempotent: `eventId` dedupe makes a re-run a no-op; each replayed day gets its own Run (`runId` suffix `-1`, `notes:"backfill"`).
- A day with no `archive#` row gets a Run with `inputs.archiveDay:"missing"` and no facts. The 28 missing days are not reconstructed from other stores.
- Entries before 2026-09-12 lack `iso3` and `actors`: write `iso3:[]` and `actorIds:[]`, keep `sourceRow`, and leave `precision` as computed (`day`). Do not infer them from `regions` or titles.

### 7. What the facts writer stops doing
| Stops | Why |
|---|---|
| Per-day chapter, trigger and line model calls | readings, weekly, step 3 |
| `record/timeline/` path | replaced by `record/facts/` |
| `record/stories/*` and `record/index.json` as written products | views, step 2 |
| `coverage` events | Run data |
| `read_changed`, `country_read_changed`, `link_confirmed`, `branch_status` | readings or gone |

**Transitional rule.** Until step 2, the facts writer writes no view. `newsBoard` keeps returning `recordAvailable:false`. The old timeline stays untouched until step 2 reads facts.

## Consequences
| Item | Result |
|---|---|
| Entry ID by url | the same article is one fact across re-runs; costs one canonicalisation function with fixtures |
| `appendLines` rewrites the whole day file | fine at tens to hundreds of lines per day; revisit if a file passes about 5 MB |
| Manifest is merge-on-conflict | two writers cannot lose a day |
| Run is overwritten | one mutable object, justified in section 4 |
| Section 5 incomplete | step 1 cannot be called done until it is filled |

Rejected alternatives:
| Alternative | Why rejected |
|---|---|
| `topicId` (`<title>-<rank>`) as the entry ID | unstable between runs |
| One facts file per month | If-Match contention and file size |
| DynamoDB as the facts store | rejected in 0035 |
| Writing views in the same run | deferred to step 2; one writer per file |
| `unresolved:<name>` actor IDs now | needs the actor table; deferred |

## Source
`architecture/FOUNDATION.md` A, C, E, G; `architecture/ARCHITECTURE_TIMELINE.md` §2 to §5; `backend/record/newsStoryRecord/src/timeline.js`; `backend/shared/src/s3json.js`; `backend/shared/src/record.js`; `backend/shared/src/outlets.js`; decision 0035.

Deferred, not dropped: the action-vs-statement `type` on facts (operator 2026-10-21: add object fields only when the news needs them).
