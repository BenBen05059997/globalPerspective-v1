# 0037. Views rebuilt from facts: files, builder, serving, contract

Status: accepted, links rule amended 2026-10-22 (implements step 2 of 0035; `ARCHITECTURE_TIMELINE.md` §5 and §6 are narrowed by this record where they differ)
Date: 2026-10-21

## Context
0035 says readers see only views, served as static JSON through the Worker. 0036 fixed the facts format. Step 2 needs the view files, the builder and the serving rule. What exists today:
- `newsBoard` reads `record/index.json` and `record/stories/{id}/latest.json` itself (`recordViews.js`). `enrichBoard` copies `line, risk, born, chapters, liveBranches, confirmedLinks, lastMoved` onto each pin. `arrivals.js` fetches up to 40 `stories/{id}` per call (one GET each) to look at `links[]`.
- The board UI reads the story through `callBoard('story_view')`: `story.line`, `chapters`, `events`, `forks[].branches[].status`, `links`. The story page reads other endpoints (`fetchNarrativeThread`, `fetchWebIndex`), not the record.
- The Worker `/data/*` route fetches S3 with a signed reader identity (`S3_ACCESS_KEY_ID` secret), allows only `world/`, `situations/state/`, `stories/state/`, sends `public, s-maxage=300, stale-while-revalidate=600`, and passes the S3 ETag through. A missing key answers 404 ("not generated yet").
- Readings do not exist until step 3, so `line`, `chapters`, branch status, confirmed links and `risk` cannot be built yet.

## Decision

### 1. View files
All under `record/views/` (shadow: `record/shadow/views/`, same names). Every view has `schemaVersion: 1` and `builtFrom: {factsThrough: "YYYY-MM-DD", readingsThrough: null}`.

| View | Key | Content |
|---|---|---|
| Active index | `index/active.json` | stories with any fact in the last 60 days (UTC, by fact `date`) |
| All index | `index/all.json` | every story, same row shape |
| Links | `links/{threadId}.json` | cheap grounds with other active stories; `confirmedLinks: []` |
| Story | `stories/{threadId}.json` | facts projection (below) |
| Daily counts | `counts/{YYYY-MM-DD}.json` | counts per story for one day |
| Manifest | `manifest.json` | `{schemaVersion:1, builtAt, runId, factsManifestDays: n, factsThrough, readingsThrough:null}` |

**Index row** (both indexes): `threadId, born, lastFactAt, iso3[], actorIds[], sourceCount, entryCount, forkCount, branchCount, liveBranchCount, latestVerdictAt, aliasOf` (`null` unless merged; merged stories are not rows in `active.json`) and `aliases[]` on a survivor. Also `title`: the title of the first `entry` fact (a fact, not a reading), so arrivals need no extra GET. `line`, `risk`, `chapters`, `confirmedLinks` are not row fields yet (see section 6).
- `liveBranchCount` = branches of any `forecast_drawn` with `due >= today` and no `verdict`. `latestVerdictAt` = latest verdict `at`, else `null`.
- Row order: `lastFactAt` descending, then `threadId`.
- **Size.** `active.json` is small by construction (60 days). `all.json` target under 2 MB; hard cap 5 MB. Over 5 MB the builder fails the run (`failures:[{stage:'views'}]`) rather than truncate. The fix, when it is needed, is a decision: shard to `index/all-YYYY.json` by year of `born` and make `all.json` a list of shard keys. Not built now.

**Links view** `{threadId, links:[{otherThreadId, sharedActorIds[], sharedIso3[], sharedSourceIds[], grounds, daysApart}], confirmedLinks:[], confirmedLinksReason:"no reading yet"}`.
Amended 2026-10-22 (operator) after the first dry run over 519 stories produced 25,615 rows, 57% of them resting only on a shared outlet (23 outlets exist) and the USA alone in 5,873 pairs:
- **Sources never count.** `sharedSourceIds` is kept for information; `grounds` counts only actors and countries.
- **Specificity.** A shared actor or iso3 counts as a ground only if fewer than 5% of the stories in `index/active.json` carry it (computed per build from the active index; the threshold is a constant in `views.js`). Background IDs such as `USA` or `name:donald trump` therefore never link two stories on their own.
- **Near in time.** Both stories must have a fact within 14 days of each other (`|lastFactAt(a) - lastFactAt(b)| <= 14 days`, by `date`); `daysApart` records the gap. Long-range connections are readings (step 3, `confirmedLinks`), not cheap links.
- **Order and cap.** Rows with `grounds` 0 are dropped; sort by the rarest shared ID (lowest share of active stories) then `otherThreadId`; max 50 per story. Pairs are formed within the active index only (one pass over an inverted index of actor and iso3 IDs).
These are shared facts, not judged links. The UI labels them "shares: <names>, N days apart" and must not call them links (0012).

**Story view** (facts projection):
```
{schemaVersion, builtFrom, threadId, born, aliasOf:null, iso3[], actorIds[], sourceIds[],
 entries:[{eventId, date, at, precision, title, summary, category, eventType, sources:[{sourceId,outlet,url,title}]}],  // date ascending
 forks:[{forkId, drawnAt, branches:[{branchId, text, p, trigger, resolutionSource, due,
          verdict: null | {at, result, decidedBy, evidence}}]}],
 merges:[{from, into, at, reason}],
 corrections:[{corrects, at, reason}],
 line: null, chapters: [], branchStatus: null,
 reading: {state: "none", reason: "no reading yet"} }
```
`branchStatus: null` always carries `reading.reason`. A `correction` fact is applied: the corrected entry keeps its row with `corrected:true`. Entries cap at 400 per view (newest kept, `entriesOmitted` count set); a story that large needs a shard decision.

**Counts view** `{date, byStory:{threadId:{newEntries, branchesDue, verdicts}}, total:{...}}`. `branchesDue` = branches whose `due` is that date. Written for each day of the current and previous ISO week and for any day whose facts changed; older files are not rewritten.

### 2. Who builds, how
Amended by 0039: `newsStoryRecord` stays the only view builder and reads readings; the review does not own `stories/*`.

| Rule | Value |
|---|---|
| Builder | `newsStoryRecord`, after each daily facts append, in the same invocation (TIMELINE §6). In step 2 it builds all views above. From step 3, `newsRecordReview` owns the story views and adds readings fields. Then `stories/{id}` is written by the review only |
| Rebuild | full from `record/facts/` (all days in the manifest) every time; idempotent, same facts give the same bytes except `builtAt` |
| Write | plain `PutObject`, no If-Match (views are derived and replaceable; a concurrent rebuild writes the same content) |
| Order | `stories/*` and `links/*` and `counts/*`, then `index/active.json`, then `index/all.json`, then `manifest.json` last. A reader that sees a new manifest sees a complete set; a crash leaves the old manifest, which is the alarm (manifest `builtAt` older than the Run) |
| Failure | a view failure marks the Run `partial` with `failures:[{stage:'views'}]`; facts already written stay |
| Cost | one pass over all fact files per run; revisit if the build exceeds 60 s (then keep a derived roll-up, not incremental view edits) |

### 3. Aliases
`story_merged {from, into}` resolves transitively (0036 section 3). The view of `from` becomes `{schemaVersion, builtFrom, threadId, aliasOf: <survivor>}` and nothing else. The survivor's row carries `aliases[]` (all transitive `from`s); the survivor's facts projection includes the merged story's entries, tagged `fromThreadId`. The merged story is not in `active.json`; it stays in `all.json` with `aliasOf` set so old links resolve. Clients that read an alias view fetch the survivor.

### 4. Serving
| Item | Decision |
|---|---|
| `DATA_ALLOWED` | add `/^record\/views\/[\w./-]+\.json$/`. Not `record/facts/` (large, raw, one file per day, append-only history that is not a page contract), not `record/runs/` (operations data), not `record/readings/` (readers get readings only through the story view, after the review accepts them) |
| Cache | exactly today's pattern, no special case for views: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`, ETag passed through. One rule for every `/data/*` prefix; tune later with evidence, not now. Missing key stays 404 "not generated yet" |
| Member-only | none. Views are public; `.member.` keys are not used |
| Who calls what | the browser fetches `index/active.json`, `stories/{id}.json`, `links/{id}.json`, `counts/{date}.json` through `/data/record/views/...` |
| `newsBoard` | keeps server-side only: `enrichBoard` (pin enrichment on get_board; one GET of `index/active.json`, fallback `index/all.json` when a pinned story is not active) and `arrivals` (index + `links/{id}` for candidate stories, replacing N story GETs). Moves to the browser: `story_view` (becomes a direct fetch of `stories/{id}.json`; the Lambda action is removed when nothing calls it) and the board weekly's story reads |
| Files read by `newsBoard` | `record/views/index/active.json`, `record/views/index/all.json`, `record/views/links/*`. It no longer reads `record/index.json` or `record/stories/*` (removed with this step) |

### 5. IAM and Worker changes (each needs the operator's yes)
| # | Change | Where |
|---|---|---|
| 1 | `s3:PutObject` on `record/views/*` and `record/shadow/views/*` | `newsStoryRecord` role |
| 2 | `s3:GetObject` on `record/views/index/active.json`, `record/views/index/all.json`, `record/views/links/*` (and `record/views/stories/*` only if `story_view` stays) | `newsBoard-role` (today: no S3) |
| 3 | `s3:GetObject` on `record/views/*` | the Worker's reader IAM user (the key in `S3_ACCESS_KEY_ID`; it is a signed identity, not a public bucket policy) |
| 4 | Worker upload: allowlist line and the views cache header | `cloudflare/front-worker/production/worker.mjs` (Worker upload needs a yes) |
| 5 | CloudWatch alarm on manifest age (topic needs a yes; Watch rule, 0036 section 5) | CloudWatch |
Shadow views are not served; the Worker never reads `record/shadow/`.

### 6. Board and story page contract
Reading-derived fields are `null` or empty with a reason. The UI must show the text below, never a blank, a guess or "something went wrong".

| UI | Reads | From | Empty or null text |
|---|---|---|---|
| Pin enrichment (`enrichBoard`) | `born`, `lastFactAt` (as `lastMoved`), `entryCount`, `liveBranchCount` | `index/active.json` row | row missing: `recordAvailable:false` as today |
| Pin `line` | `line: null` | not in step 2 | "no reading yet · first weekly review pending" |
| Pin `risk` | `risk: null`; never copy `tierFromScore` of an old score | not in step 2 | omit the badge (no text) |
| Pin counts | `chapters: null`, `confirmedLinks: null`, `liveBranches = liveBranchCount` | row | chapters and links show "no reading yet" |
| StoryTree level `line` | `story.line` | `stories/{id}.json` | "no reading yet · first weekly review pending" (replaces "No dated one-line read...") |
| StoryTree `chapters` | `story.chapters` | same | "no reading yet · first weekly review pending" |
| StoryTree `forks and events` | `entries[]` (as `events`: `date`, `title` as `headline`, `sources` as `outlets`), `forks[].branches[]` with `text, trigger, due, verdict` | same | no entries: "No dated event has been recorded for this story."; branch with no verdict: "This branch has not been checked yet."; the per-branch status list stays empty until step 3 (`branchStatus: null`, text "no reading yet") |
| StoryTree `event` | `entries[i].sources[]` | same | `driftNote` and `killed` are readings: hidden |
| ArrivalsTray | candidate rows from `index/active.json` (`born`, `title`), grounds from `links/{id}.links[]`, `confirmedLinks` | index and links | `confirmedLinks` is empty, so there are no strong cards; tray text: "No new story touches your board since DATE." (honest: nothing is confirmed). Card title: row `title`, no line |
| BoardWeekly: moved | pins whose `lastFactAt` is in the last 7 days | index row | as today |
| BoardWeekly: branches | verdicts in the last 7 days from `forks[].branches[].verdict` | story view | as today; statuses `fired/dead/resurrected` need readings, so only verdicts show (`yes` and `no`) |
| BoardWeekly: links | `confirmedLinks` | links view | "No confirmed link has been recorded this week." |
| Unsettled zone | counts for the current ISO week (Monday to Sunday, UTC) from `counts/{date}.json` for each day, per pinned story | counts | label "this week, unsettled: N new entries, N branches due, N verdicts"; no sentences, no line; zero all: "Nothing new this week." |
| "N new entries since" | sum of `newEntries` over `counts/` days after the visit day, plus today | counts | none: hidden |
| Story page | steps 2 for the board only. The story page keeps its current endpoints until a later step moves it; it may read `stories/{id}.json` for `entries`, `forks`, `merges` with the same empty texts | | |

A fact in the current ISO week is unsettled because the weekly review has not yet read it; at the first weekly review after the week ends it becomes settled and gets a line and chapters. The `BoardWeekly` label must say "unsettled", never "latest".

### 7. Rejected alternatives
| Option | Why not |
|---|---|
| Build views in `newsBoard` on request | N stories means N GETs plus a full facts scan per call (seen in `arrivals`, 40 GETs); slow and costly; the board is not the facts owner |
| One giant index with everything | grows without bound; every pin pays for every story; indexes are for finding, story files for reading |
| Serve `record/facts/` directly | large, raw, one file per day, append-only; not a page contract; any field change breaks pages |
| Views in DynamoDB | 0035: the world is S3; DynamoDB is for user data; no second store to keep in sync |
| Incremental view updates | harder to prove correct than a full rebuild; the rebuild test in 0035 needs the full path anyway |

## Consequences
- The board can ship its unsettled zone with facts only; every reading field is visibly absent, not faked.
- `recordViews.js` and `arrivals.js` change to the new keys; `record/index.json` and `record/stories/*` stop being read and are deleted after nothing reads them (separate operator yes).
- `ARCHITECTURE.md` gets one line (views served via the Worker) when the Worker change ships.
- Open for step 3: the review adds `line`, `chapters`, `branchStatus` to the story view and `confirmedLinks` to `links/`; it then also writes `risk` as `tierFromScore(score)` from a dated reading (see `backend/shared/src/world/tier.js`), never from the old THREAD_ANALYSIS score.

Source: `architecture/ARCHITECTURE_TIMELINE.md` §4 to §6; `plans/PLAN_2026-10-21_foundation.md` step 2; `backend/board/newsBoard/src/{recordViews,arrivals,index}.js`; `cloudflare/front-worker/production/worker.mjs`; `features/board/components/{StoryTree,ArrivalsTray,BoardWeekly}.jsx`.

## Amended by 0040 (2026-10-22)
views follow the latest `assignment`, canonical actor ids, `counts.articles`.
