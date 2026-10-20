# The timeline: one source of truth, many views

Status: design adopted (operator, 2026-10-20). This is the system's core model. Every backend group and frontend feature
README links here and says which events it **writes**, which **views** it reads, and nothing else about storage.
Details of the subsystem that writes it: `ARCHITECTURE_RECORD.md`; what runs when: `ARCHITECTURE_RECORD_PIPELINE.md`;
storage rules: `rules/DATA_STRATEGY.md`. What exists today is checked against the code in §7.

## 1. The idea
Everything the site knows about the world is an **event on one timeline**: dated, append-only, never rewritten. Every
page is a **view** of that timeline, filtered by time, story, country, actor or kind. A page never stitches its own
picture from raw tables.

```
  raw pipeline tables ──► world reader ──► timeline writer ──► record/timeline/YYYY-MM-DD.jsonl   (the truth)
  (existing Lambdas)      (shared/world)    (newsStoryRecord)          │
                                                                       ├─► story view     record/stories/<threadId>
                                                                       ├─► index view     record/index.json
                                                                       ├─► country view   record/countries/<ISO3>   (later)
                                                                       ├─► corrections    record/corrections/
                                                                       └─► consumers: today · story page · country · weekly · board · map · track record
```

## 2. The event
One JSON line per event in `record/timeline/YYYY-MM-DD.jsonl` (UTC day of `at`).
```
{ "eventId": "<sha1(kind + sourceKey)>",      // idempotent: the same source row always gives the same id
  "at": "2026-10-16T12:26:00Z", "date": "2026-10-16",
  "kind": "entry",                            // see §3
  "threadId": "thread-…",                     // the story; null only for events with no story
  "iso3": ["IRN"], "actors": ["IRGC"],        // canonical (resolveIso3; actor normalised as world/ does)
  "sources": [{ "outlet": "BBC", "url": "…", "archive": "archive#2026-10-16", "topicId": "…" }],
  "label": "fact" | "judgment", "confidence": "low|medium|high"?,   // judgments are always labelled
  "payload": { … kind-specific … },
  "producer": "newsStoryRecord@<version>",
  "sourceRow": { "store": "NewsCache", "key": "archive#2026-10-16", "index": 7 } }   // provenance back to the raw row
```
Rules: an event is never edited or deleted; a change is a new event (a correction points at the eventId it corrects);
`eventId` makes re-runs safe; every fact names its source; every judgment carries its label.

## 3. Event kinds
| kind | label | payload (essentials) | comes from today |
|---|---|---|---|
| `entry` | fact | title, summary line, outlets | `NewsCache archive#` rows (agent Lambda) |
| `story_born` | fact | first title | derived: earliest entry per threadId |
| `read_changed` | judgment | risk from→to, expected path from→to, mechanism | `THREAD_HISTORY#`, `THREAD_ANALYSIS`, `DRIFT#`/`DRIFTLOG#` |
| `chapter` | judgment | name, one sentence written at the time | derived when a drift note changes the expected path |
| `forecast_drawn` | judgment | fork id, branches {text, p, trigger, resolutionSource, due} | `PredictionLog PRED#` |
| `branch_status` | judgment | branchId, fired/hold/dead/late/resurrected, evidence | trigger check (newsStoryRecord) |
| `verdict` | fact | qid, yes/no/void, decidedBy, evidence | `PredictionLog Q#/VERDICT*` |
| `correction` | fact | eventId corrected, what was wrong, reason | dead branch that fired; operator correction |
| `link_confirmed` | judgment | other threadId, strength, mechanism, evidence | `web/` links with the confirmation rule |
| `country_read_changed` | judgment | country, risk from→to, mechanism | `COUNTRY#/HISTORY#`, country `DRIFT#` |
| `situation` (later) | fact | opened/raised/closed, place, tier | `situations/` (map pipeline) |

## 4. Views
| View | Filter on the timeline | Stored as | Read by |
|---|---|---|---|
| Story | `threadId = X`, all kinds, in order (the tree is this view) | `record/stories/<id>/latest.json` + daily snapshot | story page, board, weekly |
| Index | latest state per story (line, risk, born, counts, last moved) | `record/index.json` | board pins, weekly selection |
| Country | `iso3 ∋ X` | `record/countries/<ISO3>` (later) | country page |
| Today | `date = today` | none: read the day file | today page (later) |
| Week | `date ∈ week`, kinds that changed something | the weekly JSON (`weekly/`) | weekly email and page |
| Board | events touching your pins and strings | computed on request (`newsBoard`) | board, the board's weekly |
| Map | today's events with a place, grouped | `world/latest.json` (map pipeline; joins later) | home map |
| Track record | `forecast_drawn`, `branch_status`, `verdict` | `predictions/track_record.json` (today) | track record page |

## 5. Who writes, who reads (one writer)
- **Writes the timeline and its stored views:** only `newsStoryRecord` (`backend/record/`), from raw tables through
  `backend/shared/src/world/`. Nothing else writes `record/`.
- **Reads raw tables:** only `backend/shared/src/world/` (ARCHITECTURE_RECORD.md §0c).
- **Everyone else reads views.** Until a view exists, a consumer may read through `world/` and says so in its README.
- Later, producers may append events directly (e.g. the agent Lambda emitting `entry`); the one-writer rule then moves
  to "one writer per event kind", recorded here before it happens.

## 6. Every folder links here
Each `backend/<group>/README.md` and `features/<name>/README.md` has a line:
`Timeline: writes <kinds or "none">; reads <views or "world/ (until <view> exists)">. See project-docs/architecture/ARCHITECTURE_TIMELINE.md.`
`quality/check_docs.mjs` fails a README that lacks the link.

## 7. What exists and what is missing (checked against code and live AWS)
Filled from the audit of 2026-10-20 (one reviewer per area; code and live AWS only, docs not trusted). See §7.1-§7.6.
