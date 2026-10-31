# 0046. The 30-day archive pages read a record index (`views/index/weekly.json`)

Status: accepted (operator, 2026-10-31) for every reader except the countries list, which stays on `archive_range` (its counts move most; adopt later); follows 0035, 0037, 0042, 0044
Date: 2026-10-31

## Context
`useWeeklyArchive` and `useArchiveDayMap` read the `archive_range` action (30 days of DynamoDB `archive#` rows, 1.5 MB) for the Stories
page, the Stories map, the countries list and page, the story page's related stories, the map's country card and the risk layer's candidate
names. It was the last list reader still on the world rows. The entry facts carry the archive entry's topic, thread, title, category, `iso3`,
sources (outlet, url) and the archive day (in `sourceKey`, `archive#DATE|...`, with the place in the day's list in `sourceRow.index`), but not
its `regions` text, and they hold an article once.

## Decision
- `indexViews.js` builds `index/weekly.json` from the story views' entries (so placement, merges and reassignments apply): per archive day, in
  the archive's order, `topicId`, `threadId`, `title`, `category`, `iso3`, `sources:[{outlet,url}]`, and the day's `updatedAt` (the newest
  entry time of the day). Nothing else the readers show: no snippet, age, outlet country or tier. 500 KB for 720 entries; cap 2 MB.
- `shared/api/archiveRange.js` (`loadArchiveDayMap`) is the one loader both hooks use: the index for the recorded days, the action for the
  newest recorded day and every day after it (`days` = days since it + 1; the record is nightly and its newest day can be part-way, and
  `builtFrom.factsThrough` cannot mark that, because facts are dated by article time), and all 30 days from the action when the index is
  missing (404) or unreadable (reported as `weekly-index`). A failed call for the newest days is reported (`archive-range-recent`) and the
  recorded days are shown.
- Places are the entry's `iso3` named by the one country table (`EUU` as "European Union"); sources are named by outlet, else by the url's host.

## What readers see differently (archive_range vs the index, live capture 2026-10-31, 30 days)
- Repeats: the archive lists 838 entries, the record 720 (118, 14 percent, are an article listed again on a later day, which the facts rule keeps
  once). Chosen: show it once, on its first day, as the story timeline already does (`viewEntries.js`). A story's article count falls (60 of 321
  stories), its day count (41), its last-seen day moves earlier (33); the age group changes for 1 and the board column for none.
- Stories: 333 stories in the action, 326 in the index (merged stories appear under their survivor: 12 archive ids gone, 5 ids new); 67 entries sit
  under another story than the archive's.
- Places: the archive's stored `iso3` is richer than its `regions` text (the action recomputes `iso3` from `regions`). On the 720 matched entries 136 differ
  (130 add countries, e.g. "Middle East" + "United States" gives Iran too; 5 lose one). A region that is not a country (Global, Middle East, Europe)
  is not carried, so the country page's broad-region coverage ("Middle East" stories on Gulf countries) draws on the EU only.
- Countries list: 79 rows, 78 after (3 gone at the two-article threshold, 2 new); 48 of the rows change count: repeats take about 10 percent off the
  large ones (United States 216 to 188 on the same entries) and the places add (United States 217, Iran 27 to 41, Canada 19 to 22, North Korea 15 to 20).
- Risk layer candidates: 60 names both ways, 4 differ at the tail (Uganda, Norway out; Belgium, Qatar, Myanmar, Philippines in). Names are canonical
  ("UAE", "United States") and merge the archive's spellings.
- Days: 24 of 25 (2026-10-20 is a partial day whose 14 entries are all repeats); the Stories page's "no stories for N days" line counts it as missing.
- Order of places: ISO3 order, not the model's order (the Stories row shows the first two or three).
- Source names: outlet names ("France 24") instead of the archive's host names ("france24.com").

## Consequences
- Until the record can state the archive's `regions` (a new fact field and a backfill from the rows), the Stories page and map are close and the countries
  list and country page are the readers whose numbers move. To hold one back, give it its own loader that calls only the action.
- The action stays for the newest recorded day and after, and as the fallback; the rows cannot be deleted before the record carries today's entries.
