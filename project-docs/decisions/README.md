# Decision records

One file per decision (Nygard format: Status, Date, Context, Decision, Consequences, Source).
Append-only: a decision is never edited; a new record supersedes it and says so in its Status.

| # | Date | Decision | Status |
|---|---|---|---|
| [0001](0001-analyst-tool-direction.md) | 2026-06-26 | The product is an analyst sense-making tool, not a signal API | accepted |
| [0002](0002-analysis-credits-parked.md) | 2026-07-06 | Analysis credits are parked | accepted |
| [0003](0003-storage-s3-world-dynamodb-user.md) | 2026-09-08 | S3 for the world, DynamoDB for the user | accepted |
| [0004](0004-developments-kept-demoted.md) | 2026-09-12 | Placeless developments kept, demoted below events | accepted |
| [0005](0005-one-importance-scale.md) | 2026-09-12 | One importance scale: the canonical risk tier | accepted |
| [0006](0006-frontend-feature-folders.md) | 2026-09-24 | Frontend by feature; Lambda paths stay put | partly superseded by 0024 |
| [0007](0007-pair-arcs-relocation-cancelled.md) | 2026-09-24 | Pair arcs are not moved onto the live map | accepted |
| [0008](0008-design-discussion-is-not-build.md) | 2026-09-25 | A design discussion is not a build go-ahead | accepted |
| [0009](0009-economy-parked.md) | 2026-09-25 | Economy is parked | superseded by 0049 |
| [0010](0010-country-view-split.md) | 2026-09-25 | The country view is split by job | superseded by 0035 (Studio half already gone in 0033) |
| [0011](0011-track-record-and-studio.md) | 2026-09-25 | Track record lean and sampled; Studio stays a page | superseded by 0035 (confirm step by 0034, Studio by 0033) |
| [0012](0012-story-web-is-news-based.md) | 2026-09-25 | A story's web is its own news; "judged to feed into", never "caused" | accepted |
| [0013](0013-ds1-design-system-tier-never-a-colour.md) | 2026-09-26 | DS1: hue = crisis type; risk tier is never a colour | accepted (hues amended by 0022) |
| [0014](0014-deepseek-replaces-gemini-no-fallback.md) | 2026-09-27 | DeepSeek replaces Gemini; no fallback provider | accepted |
| [0015](0015-park-jobs-that-feed-nothing-shown.md) | 2026-09-28 | Park scheduled AI jobs whose output no page shows | accepted (resolver part superseded by 0027; Signals parked by 0032) |
| [0016](0016-map-console-is-home.md) | 2026-10-01 | The map console is the home page | accepted |
| [0017](0017-retired-routes-and-tours.md) | 2026-10-01 | /breaking and /weekly-markets redirect; guided tours removed | accepted (client-only redirects superseded by 0028) |
| [0018](0018-spider-demo-retired-into-stories-web.md) | 2026-10-02 | /spider-demo retires into the Stories WEB view | accepted |
| [0019](0019-frontend-hosting-two-worker-cloudflare.md) | 2026-10-05 | Hosting moves to Workers Static Assets behind the existing Worker | accepted (not cut over) |
| [0020](0020-editorial-selection-done-not-said.md) | 2026-10-18 | Story selection counts things done, not things said | accepted |
| [0021](0021-rules-reset-code-is-truth.md) | 2026-10-19 | Rules reset: code and live AWS are the truth | accepted (archive/ part superseded by 0026) |
| [0022](0022-crisis-hues-option-a.md) | 2026-10-19 | Crisis hues re-picked (option A) | accepted |
| [0023](0023-radar-one-sweep-12h-window.md) | 2026-10-19 | Radar: one sweep, happening now = 12 h, max 5 | accepted |
| [0024](0024-feature-public-api-and-lambda-grouping.md) | 2026-10-19 | Feature index.js public API; Lambdas grouped by feature | accepted |
| [0025](0025-docs-storage-layout.md) | 2026-10-19 | How documentation is stored | partly superseded by 0026 and 0041 |
| [0026](0026-delete-not-archive.md) | 2026-10-19 | Delete old docs instead of archiving them | accepted |
| [0027](0027-forecast-resolver-unparked-as-weekly-settle.md) | 2026-09-30 | The forecast resolver is unparked as the weekly settle job | accepted |
| [0028](0028-briefings-merge-real-301s.md) | 2026-10-19 | One Briefings page; old addresses get real 301s | accepted (supersedes 0017's client-only redirects) |
| [0029](0029-today-kept-linked-from-map.md) | 2026-10-19 | /today is kept and linked from the map | accepted (refines 0016) |
| [0030](0030-studio-out-of-menu.md) | 2026-10-19 | The Studio leaves the menu until its return criteria are met | superseded by 0033 |
| [0031](0031-economy-parked-fx-box-labelled.md) | 2026-10-19 | Economy stays parked; dead links go; FX box labelled raw quotes | superseded by 0049 |
| [0032](0032-signals-api-parked.md) | 2026-10-19 | The Signals API is parked | accepted (extends 0015) |
| [0033](0033-lens-studio-retired.md) | 2026-10-20 | The lens Analysis Studio is retired | accepted (supersedes 0030) |
| [0034](0034-auto-verdicts-no-human-gate.md) | 2026-10-20 | The resolver writes verdicts itself; no human gate | accepted (supersedes the confirm step of 0011) |
| [0035](0035-facts-are-the-system-of-record.md) | 2026-10-21 | Facts are the system of record; five stages; IDs by content | accepted (supersedes 0010, 0011) |
| [0036](0036-facts-file-format.md) | 2026-10-21 | Facts file format: layout, fact object, content IDs, Run, backfill | accepted (implements step 1 of 0035) |
| [0037](0037-views-from-facts.md) | 2026-10-21 | Views rebuilt from facts: files, builder, serving, board contract | accepted (implements step 2 of 0035) |
| [0038](0038-forecast-loop.md) | 2026-10-22 | Forecast loop: few resolvable outcomes, nightly watch, verdict facts | accepted (refines 0034 and 0036, keeps 0011's sample) |
| [0039](0039-weekly-review.md) | 2026-10-22 | Weekly review: DeepSeek per story, narrow auto-merge, operator aliases, golden week | accepted (implements step 3 of 0035; amends 0036 kinds and 0037 §2) |
| [0040](0040-raw-before-model.md) | 2026-10-22 | Raw before model, recovered days, re-assignable stories, canonical actors | accepted (amends 0036, 0037, 0038, 0039) |
| [0041](0041-docs-slimmed-to-architecture-decisions-readmes.md) | 2026-10-26 | Docs slimmed to architecture, decisions, READMEs and one start file | accepted |
| [0042](0042-notes-move-to-the-record.md) | 2026-10-31 | The daily model notes move to the record (`record/notes/`), one schema and ID rule | accepted; amends 0040 |
| [0043](0043-question-draws-in-the-record.md) | 2026-10-31 | The weekly question draws move to the record (`question_commit`, `question_draw`), views carry scoring and state | accepted; follows 0035, 0038, 0042 |
| [0044](0044-track-record-view.md) | 2026-10-31 | The track record page reads `views/track-record.json` built from facts; legacy pilot stats are a constant; corrections stay gated on the action | accepted; follows 0037, 0043 |
| [0045](0045-eligibility-window-90-days.md) | 2026-10-31 | The weekly draw's eligibility window is 7-90 days everywhere (page, labels, views, read API), matching the draw; resolves 0043's open question | accepted (operator) |
| [0046](0046-weekly-index.md) | 2026-10-31 | The 30-day archive pages read `views/index/weekly.json`; the action serves the newest days and the fallback; the countries list stays on the action | accepted (operator); follows 0037, 0042, 0044 |
| [0047](0047-history-before-record.md) | 2026-10-31 | The history before the record (archive days 2026-03-07..09-05, 202 analyses, pre-record forecasts) is copied into the record by replaying the nightly code; unplaceable forecast rows are kept whole in `record/legacy/predictions/` | proposed (built and proven locally; the coordinator runs it, shadow first); follows 0035, 0042, 0044 |
| [0048](0048-briefs-in-the-record.md) | 2026-10-31 | The daily and weekly briefs move into the record: `daily_brief` and `weekly_brief` notes, `briefs/` views and `index/briefs.json`, three hooks read them first | accepted (operator); follows 0035, 0037, 0042 |
| [0049](0049-retire-economy.md) | 2026-10-31 | The economy product is retired: page, story tab, FX box, read actions and five Lambdas leave the code; the data is deleted later, one yes each | accepted (operator); supersedes 0009, 0031; trims 0032 |
| [0050](0050-fresh-views-after-ingest.md) | 2026-10-31 | The views are rebuilt after every ingest and brief by a `{refresh:true}` event that adds today's archive entries as provisional entries (no fact appended); pages answer the newest days from the views while the manifest is under 9 h old and keep the actions as the fallback | accepted (operator); follows 0035, 0037, 0046, 0048 |
| [0051](0051-entries-inbox-and-today-view.md) | 2026-10-31 | New entries reach the record through `record/inbox/entries/` (the agent's lines, replayed to what the archive row ends the day as; `ENTRIES_SOURCE` = archive, inbox or compare), and `index/today.json` replaces the topics, today, summary, prediction and trace_cause actions for "today" | accepted (operator); follows 0035, 0042, 0046, 0050 |
| [0052](0052-forecasts-inbox.md) | 2026-10-31 | Forecasts reach the record through `record/inbox/forecasts/` (the agent's `PRED#` rows and thread reconciles; `FORECASTS_SOURCE` = log, inbox or compare); the resolver finds its questions in the forecast facts (`QUESTIONS_SOURCE`); the track-record view carries the draw pool and `settleHealth`, the freshness monitor reads them (`SETTLE_SOURCE`); `forecasts/<thread>.json` views serve three live readers of `prediction_snapshot` | accepted (operator); follows 0035, 0038, 0043, 0044, 0050, 0051 |
| [0053](0053-country-and-story-readers-on-notes.md) | 2026-10-31 | The country and story history readers (read API `country_history`, `corrections_feed`, `thread_analysis`, `country_intelligence`, `country_facts`, previews; seven Lambdas) read the record's notes behind `NOTES_READS=ddb\|compare\|notes`, member gating kept in the Lambda; new `country_facts` and `story_history` note subtypes | accepted (operator); follows 0003, 0042, 0047, 0048, 0050 |
| [0054](0054-worker-email-and-ingest-readers-on-the-record.md) | 2026-10-31 | The Worker pre-render, the `rss` action, `newsPostDevTo`, `newsPostLinkedin`, `newsBreakingAlert`, `newsRecommend`, `newsBoard` and the weekly email read the record instead of NewsCache `latest` / `today-archive`, `THREAD_ANALYSIS`, `COUNTRY_INTELLIGENCE` and `WEEKLY_BRIEF#`, behind `RECORD_READS=ddb\|record\|compare`; the sent marker stays in DynamoDB | accepted (operator); follows 0048, 0050, 0051 |
