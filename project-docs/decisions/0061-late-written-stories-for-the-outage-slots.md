# 61. The four news runs lost to the model outage are written late from the saved articles, marked as written late, and the two days stay a gap in our record

Status: accepted (operator, chat, 2026-11-16); the script is built and was dry-run on 2026-11-16 UTC (16:09 to 16:16, about 01:09 JST on 17 Nov); the live write has not been run. Follows 0040 (this is the "later decision" it deferred for model replay), 0055, 0060; amends 0036 (additive fields), 0040, 0055.
Date: 2026-11-17

## Context
- The model provider ran out of credit (0060). The news runs of 2026-11-14 20:15 UTC and 2026-11-15 04:15, 12:15 and 20:15 UTC wrote no entries. The raw articles of those days were saved before the model call (0040 rule 1): `record/inbox/articles/2026-11-14.jsonl` and `2026-11-15.jsonl` hold 495 and 503 lines.
- The facts of 2026-11-14 are in `record/facts/` with a Run `ok` and 25 entries (the 04:15 and 12:15 runs). The Run of 2026-11-15 is `failed`, `archiveDay: missing`, and has no entries.
- 0040 recovers a gap day as articles only and rejects "model replay of recovered days now (cost; later decision)". The operator made that decision on 2026-11-16: write the stories now, from the saved articles, and say so.
- The record stores an entry's event time as the earliest source publish time, so a late entry's fact would be indistinguishable from a live one. Nothing marked a story as written late. `newsHealth` shows an agent row `ok` from 20 entries in the day file, so late lines would have hidden the outage. The resolver calls a day a gap only when its Run is not `ok` or `partial`, or `archiveDay` is not `present` (0055); after a re-run the Run of 2026-11-15 would have been `ok`.

## Decision
1. **One script, run from a laptop; no Lambda is invoked or changed in behaviour.** `backend/record/cli/recover-late-slots.mjs`. It runs the live code of `newsIngest` (`src/selection.js`: prompt, answer validation, source enrichment, filters, repeat check) and `newsAgent` (`src/story-text.js`: summary and cause-note prompts, call options, stored item). That code was lifted out of the two handlers into exported functions with no change to the live path (commits `f83c72ef`, `5ee41c7a`); the handlers call the same functions in the same order. No prompt text is copied.
2. **Per missed slot** (2026-11-14 20:15, 2026-11-15 04:15, 12:15, 20:15 UTC), in time order:
   - Rebuild the article pool as of the slot from the saved lines: lines first seen by that run or earlier, the age label computed at the slot, the newest 25 per feed, the live age and blocked-domain filter, one row per url, the feed order of the live list.
   - Rebuild the "seen today" list and the 7-day archive titles and the threading window from the entries inbox as of the slot, plus the script's own earlier slots. DynamoDB (`staging`, `seen-today`, `archive#`) is not read or written.
   - One topic-selection call, then a summary call and a cause-note (`trace_cause`) call per topic, through the shared `chat()` on `anthropic:claude-sonnet-5-5` with the Lambdas' own options (selection `maxTokens` 12000; agent `MAX_TOKENS` 1500).
   - **No forecast is generated.** No forecast function is called, the model steps are `topic_selection`, `summary` and `trace_cause` only, and the script loads no forecast, question or log code (a test checks the source and the steps).
3. **Dry run first.** The default mode writes nothing to AWS. It writes the would-be inbox lines (`entries/DAY.jsonl`), entry notes (`notes.jsonl`), the topics and the stories per slot, the model usage and a manifest to `--out`. The live mode is separate: `--write --out DIR` appends exactly those files (no model call) to `record/inbox/entries/DAY.jsonl` and `record/notes/entry/` (`record/shadow/` with `--shadow`). The lines land in the files of the slot's day (2026-11-14 and 2026-11-15). **Day-file rule:** `--write` refuses a day file that is UTC yesterday or later, so a day D can be written from D+2 00:00 UTC (2026-11-14 from 2026-11-16, 2026-11-15 from 2026-11-17). Reason: `index/today.json` reads the inbox files of the last two UTC days (`publish.js` `readTodayInbox`) and keeps every entry whose `archivedAt` is within 24 h of the newest write (`todayView.js`); a late line's `archivedAt` is its real writing time, so a late line in yesterday's file would show as a fresh story on the Today page. The agent's freshness gate (`run-guard.js` `lastArchiveWrite`) reads the same two files and takes the newest `archivedAt`, so a late line there could also make the next agent run fail as "generation-already-archived". Day keys come from the slot, never from the clock; the clock is used only for the written-at time. **One generate run per write:** "idempotent" holds per out dir (same `inboxId` and `noteId` append nothing). A second generate makes new `inboxId`s, so the script refuses to write when the day file already holds late lines of the same slot with other `inboxId`s. **Backup:** before the first append to each object `--write` saves the object's current content to `OUT/backup/<key>` (the bucket has no versioning) and stops if a copy cannot be written. It also refuses a line without the marker or with a `prediction`, `forecast` or `scenarios` key.
4. **The marker.** Each late entry line, entry fact and story row carries `writtenLate`, additive, `schemaVersion` unchanged:
   ```json
   "writtenLate": { "writtenAt": "2026-11-17T01:30:00.000Z", "slot": "2026-11-15T12:15:00.000Z" }
   ```
   `writtenAt` is the real time the story was written (also the line's `archivedAt` and `batch`); `slot` is the missed run it stands in for. Both are ISO times. A malformed marker is dropped on read. A live entry has no such key. It is carried:
   - entries inbox line: a field of the entry (`entriesInbox.js` keeps every non-own field);
   - entry fact: `payload.writtenLate`; an entry with no usable publish time stands on its slot (`at` = the slot, `precision: day`) so its fact lands in the slot's day file, not in the day it was written;
   - story view row (`views/stories/*.json` entries) and `index/today.json` entries: `writtenLate`;
   - the Run: `inputs.lateWritten {entries, slots}`, present only on a day with late entries (below);
   - `newsHealth`: the agent row of a day with late entries is `late` (new status, with `facts.lateEntries` and a note), not `ok`. The `/ops` page does not draw `late` yet: until the frontend change it reads as "no data" with the note, which is honest and not `ok`.
   A story born from a late entry is born at its slot (`derive.js` `birthByThread`), so its `story_born` fact stays in the slot's day file and not in the day it was written. A summary longer than the 1500-character inbox cap is cut at the last complete line (`entriesInbox.js` `trimSummary`), never mid-word; readers of the story page see the full note, the Today list and the archive modal see the inbox copy. The cause-chain prompt forbids talking about the source text and an unsupported weekday (`TRACE_CAUSE_PROMPT_VERSION` 2, stamped on the note's `promptVersion`).
   The entry note keeps its own true `at` (when the model wrote it), so the notes file day is the UTC day the generate run ran: this run's notes are dated 2026-11-16 (`record/notes/entry/2026-11-16.jsonl`). A later, separate frontend change can show one line such as "Written 17 Nov from articles saved on 15 Nov" from `writtenAt` and `slot`.
5. **Both days stay a record gap for forecast settling (0055).** The Run of a day with late entries gets `inputs.lateWritten`, and `gather.js` `runGap` (the resolver) and `quality.js` `coverageOf` (the `/ops` quality part) count a Run with `lateWritten` as a gap ("stories written late"), after the existing tests. The resolver's rules are unchanged: a gap blocks a `no` (`coverage_gap`, then void "record gap" at due + 3 days, 0055), and does not block a `yes`. So the late stories may support a `yes`, and those two days never let a forecast be judged `no`. The day 2026-11-14 is not a gap today (Run `ok`, 25 entries); after the late entries and a record run for it, it is one. The rule is a property of the day's Run, recomputed from the inbox lines at every run of that day, so a re-run cannot clear it while `newsStoryRecord` reads entries from the inbox (`ENTRIES_SOURCE=inbox`, the live setting on 2026-11-17). A later agent batch that reuses the `topicId` of a late line in the same day file replaces that line (the replacement rule of `entriesInbox.js`) and with it the marker.
6. **Out of scope.** Daily and weekly briefs for the gap stay missing. The failed weekly review is re-run later.

## What this changes for forecasts (read from `record/views/track-record.json`, built 2026-11-16, sampled questions only)
- 110 sampled questions: 3 `yes` (settled), 12 void "record gap" (their gap days are 2026-10-20 to 10-31, not these days), 95 open (86 awaiting, 9 past deadline and unchecked).
- Of the 95 open, 91 have a window (the day after the draw to the due day) that includes 2026-11-14, and 90 include 2026-11-15. 2026-11-15 is already a gap (its Run is `failed`), so for those 90 nothing changes: without the marker the re-run of 2026-11-15 would have made it `ok` and freed them for a `no`; with the marker they stay blocked.
- One open sampled question has a window that includes 2026-11-14 but not 2026-11-15 (due 2026-11-14): it can no longer get a `no`; it will settle void "record gap" once due + 3 days has passed.
- Settled verdicts are untouched: verdict rows are immutable and no job re-judges them. Unsampled questions live in DynamoDB and were not counted.

## What stays missing
- No forecast for these four slots, and no daily or weekly brief for the gap.
- The DynamoDB rows a live run writes: `staging`, `seen-today`, `archive#DAY`, `today-archive`, `TOPIC#` rows, thread pointers, the story map. Readers that still read DynamoDB archive rows do not see the late stories (the weekly brief reads in `compare` mode and answers from DynamoDB; the selector's 7-day titles are always read from DynamoDB). The threading readers set to `inbox` (agent, thread, systems, country, drift) see them.
- The live path is unchanged, so a later live run does not know these stories except through the inbox.

## Where the replay differs from a live run
- The pool is rebuilt from lines, not from the feeds: items that had left a feed's newest 25 by the slot still appear; items without a publish time are placed after the dated ones; a feed that failed that run is absent.
- The seen-today list and archive titles come from the entries inbox, not from DynamoDB; the live `seen-today` was written at ingest time even where the agent later failed.
- `TOPICS_LIMIT` is 13 as 0060 records it; the live value was not read. `SOURCE_ENRICH_*` are unset on the live ingest, so the defaults apply.
- A story whose summary and cause note both failed is left out and listed in the manifest; the live agent would have archived it with empty text.
- The model answers are new: the stories are not what a live run on 2026-11-14 would have written.

## How to undo
- The entries inbox lines and the entry notes are inputs. Remove the lines with a `writtenLate` field from `record/inbox/entries/2026-11-14.jsonl` and `2026-11-15.jsonl`, and the notes with `producer.lambda` `recover-late-slots` from `record/notes/entry/2026-11-16.jsonl` (the day the generate ran), then run `newsStoryRecord` for both days again. Rewriting those objects needs the operator's yes (destructive data operation).
- Facts are append-only (0036). The entry, ingest `assignment` and `story_born` facts written from the lines stay; each entry fact carries `payload.writtenLate`, so every reader can tell them apart. Removing them means rewriting the day fact files and is a separate operator decision.

## Readers that pick entries by `archivedAt` or `batch` recency, not by file day
Checked 2026-11-17 (not changed). With the day-file rule none of them sees a late line as new; without it they would:
- `publish.js:55-57` and `todayView.js:35,40,54`: the Today view (above).
- `run-guard.js:11-12` (`lastArchiveWrite`) and `:20`, fed by the agent's `readFreshnessArchives` (today's and yesterday's inbox files): a late line newer than the staging generation makes the next agent run fail as `generation-already-archived`.
- `threading.js:86-88` (`latest`): the thread join prefers the newest `archivedAt`; a late entry in the 7-day window counts as newer than live entries of earlier days.
- `archiveReads.js:105-109` with `entriesInbox.js:130` (`replayToday`): the `today-archive` row is rebuilt from today's file only, keeping entries archived within 24 h of the last batch.
- `world/derive.js:48` (`birthByThread`): fixed for late entries (see Decision 4).
- `newsRecommend` `scoring.js:86` scores a topic by `archivedAt` recency; it would rate a late story as new if it reads one from the Today view.
The readers set to `inbox` (agent, thread, systems, country, drift) otherwise read by file day, so the late stories appear as entries of 2026-11-14 and 2026-11-15, which is intended.

## Consequences
- 0040's rule "no retroactive forecasts" holds: no forecast is written for these slots.
- The marker is the one way to tell a story written after its slot from a live one in facts, views and `/ops`; a later outage can use the same script and field.
- Deploys needed (nothing is deployed by this decision): `newsIngest` and `newsAgent` (the lifted modules; behaviour unchanged), `newsStoryRecord` (marker, Run field), `newsPredictionResolver` (the gap rule), `newsHealth` (`late` status, coverage rule). `newsReadApi` and the frontend are not touched.
- Where it shows: [ARCHITECTURE_TIMELINE.md](../architecture/ARCHITECTURE_TIMELINE.md) (Run), [ARCHITECTURE_OPS.md](../architecture/ARCHITECTURE_OPS.md) (agent row), [ARCHITECTURE_FORECAST_LOOP.md](../architecture/ARCHITECTURE_FORECAST_LOOP.md) (coverage), [backend/record/cli/README.md](../../backend/record/cli/README.md).

Source: `.board/reviews/backfill-design-facts-2026-11-16.md` (local, not in git); live S3 and Lambda env read 2026-11-17 (`HEAL` is `dry`; `ARCHIVE_READS` is `inbox` on agent, thread, systems, country and drift, `compare` on the weekly brief); `record/views/track-record.json` of 2026-11-16.
