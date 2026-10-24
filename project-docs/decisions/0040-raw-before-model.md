# 0040. Raw before model, recovered days, re-assignable stories, canonical actors

Status: accepted (operator, 2026-10-22; amends 0036, 0037, 0038, 0039; refines 0035)
Date: 2026-10-22

## Context
Foundation review and selection audit, 2026-10-22 (measured on `record/facts/` 2026-09-05..10-22, `audit/ingest-capture/`, 100 Wikidata lookups):
- 93% of fetched articles are never stored; only the model's chosen topics reach the record.
- 28 days before 2026-09-06 plus the DeepSeek outage days (from 2026-10-20) are lost, and a model outage loses the news itself.
- 67% of stories have a single entry; 93 of 504 forecast stories have no entry.
- 71% of actor ids are singletons (spelling variants); Wikipedia/Wikidata covers 39% of names.
- 22% of picks are said-not-done, against 0020.

## Decision
Four rules, in build order.
1. Raw capture. Every fetched article is stored before any model call. The selector appends its fetched set to inbox `record/inbox/articles/DAY.jsonl` (`rawId = sha1(canonical url)`); `newsStoryRecord` converts it into `article` facts in `record/facts/` (inbox rule, 0038). No new facts writer. The Run records `inputs.rawDay`; `counts.articles` shows fetched vs chosen.
2. Recovery. A missed day is rebuilt from public records with no model: GDELT DOC article list per outlet-day (primary), GDELT GKG for actors and places, Wayback CDX of outlet RSS (backstop). A recovery script writes the same inbox `record/inbox/articles/DAY.jsonl`; the Run has `notes:"recovery"`.
3. Assignments. Entries belong to stories through `assignment` facts; views follow the latest per entry. Producers: ingest (`by:"ingest"`), the weekly review (proposals), the operator, via inbox `record/inbox/assignments/DAY.jsonl`. The entry eventId stays sha1(canonical url); one article is one fact and threads claim it.
4. Canonical actors. Views replace actor names by canonical ids: `wd:Q...` where a QID exists, else `name:...`, from `record/operator/aliases.json` first, Wikidata reconciliation second. Facts are untouched. Generic groups (protesters, "the government") get `generic:true` and are excluded from links and merges.

Operator answers to the review's 8 questions:
1. Raw articles are `article` facts in `record/facts/`; the selector writes the inbox, `newsStoryRecord` converts.
2. Per-feed cap 8 to 25 for capture only; the model still sees the selected set.
3. Recover the September gap as articles only, before 2026-12-14 (GDELT DOC window); model replay is a later decision.
4. Recovered days show "recovered from public records", never carry forecasts, are unscored in the track record.
5. Entry eventId stays url-only.
6. Entry reassignments are proposals; the operator approves.
7. Canonical id `wd:Q...` else `name:...`; `generic:true` excluded from links and merges.
8. Capture deploys first, with the Run alarm for a missing raw day.

Recovery rules: event date kept; `recoveredAt` and `recoveredFrom` on every recovered fact; no retroactive forecasts (`forecast_drawn` refused on a recovered day); open forecasts are checked against recovered facts; readings re-run over recovered weeks; label "recovered from public records".

Selector changes (audit 2026-10-22, editorial change approved by the operator): the live selector gets the 0020 done-not-said rule, code-level dedupe, an RSS parser fix (3 of 26 feeds never parsed), and a significance floor replacing "Generate N topics" and the category quotas. Feeds for Latin America and Southeast Asia wait for the operator's URLs.

What changes in 0035-0039:
- 0035: Ingest's first write is the raw layer (the fact log begins at fetch); the rebuild test reads raw articles and inbox; an actor table is replaced by the alias file.
- 0036: kinds `article` and `assignment`; `rawId`; Run `inputs.rawDay`; recovery allowed for any gap day (the "28 days not reconstructed" rule narrows to days before 2026-09-06 that GDELT cannot serve).
- 0037: story and index views follow the latest assignment; actor ids canonical; `counts.articles`.
- 0038: evidence includes recovered `article` facts after the draw; no forecast on a recovered day.
- 0039: `assignment` proposal subtype; recovered articles used when re-running a week; `story_merged` is the bulk case of assignment (kept as redirect). Alias rule unchanged.
- Unchanged: two clocks, one writer per prefix, no human gate, views derived and rebuildable.

## Rejected
- A separate raw prefix outside facts (two readers, a second format).
- Model replay of recovered days now (cost; later decision).
- Auto-reassigning entries (the operator approves).
- Google News or per-outlet scrapers (terms, fragility; GDELT and Wayback suffice).

## Consequences
- The selector gains write access to `record/inbox/articles/*` (IAM, operator yes) and the Run alarm is built with it.
- Recovery must run before 2026-12-14, after which the GDELT DOC window no longer reaches September.
- The record grows by every fetched article; facts files get larger.
- Views must tolerate recovered days without forecasts or scores.

Source: `gp-mailbox/artifacts/foundation-review.md` sections 5 and 6; `gp-mailbox/artifacts/selection-audit.md`.

## Amendment 2026-10-24: recovery source
The GDELT DOC API rate-limits a single client for hours, so recovery reads GDELT's raw 15-minute GKG 2.1 files instead (static downloads, same coverage, headline from `PAGE_TITLE`, time = when GDELT saw the article, so `precision:"day"`). The DOC API stays as an opt-in fallback; Wayback RSS stays as the source with real publish times. Operator agreed 2026-10-24.
