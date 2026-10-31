# 0048. The daily and weekly briefs move into the record (notes, views, page reads)

Status: accepted (operator, 2026-10-31); follows 0035, 0037, 0042; amends the `brief` row of 0042's subtype table
Date: 2026-10-31

## Context
STEP5_AUDIT step 10: `DAILY_BRIEF#` (137 rows, writer `newsPostDevTo`, 23:00 JST) and `WEEKLY_BRIEF#` (15 rows, writer `newsWeeklyBrief`, Sundays
06:00 UTC) had no record shape. 0042 reserved one subtype, `brief`, with subject `daily:DATE` or `weekly:WEEK`. Readers: the `daily_brief`,
`latest_daily_brief` and `weekly_brief` actions (no membership gate; `weekly_brief` serves `status: 'published'` only) through `useDailyBrief`,
`useDailyEditionsIndex` and `useWeeklyBrief`; the Cloudflare Worker pre-render; and `newsEmailSender` (the ENABLED weekly email reads `WEEKLY_BRIEF#`).

## Decision
- **Two subtypes, not one.** `daily_brief` (writer `newsPostDevTo`) and `weekly_brief` (writer `newsWeeklyBrief`), both with subject kind `brief`, because
  0042 gives one writer per `record/notes/<subtype>/` prefix and two Lambdas would otherwise append to the same day file. Subject ids are
  `daily:YYYY-MM-DD` (the row's `dateKey`) and `weekly:YYYY-MM-DD` (the row's `weekOf`, the run's date, which is the key the action takes); an ISO week
  would collide when a week is run twice. `part` is `''`. `at` is the row's `generatedAt`, `model` the row's own (every live row has one).
  `iso3` = the countries the brief names. `noteId` = the shared `noteId` of subtype, subject, part and `at`.
- **Payload = the stored row** minus `PK`, `SK`, `ttl`, `generatedAt` and `model` (the envelope carries those). Countries are not rewritten into it:
  old rows have no `iso3` on stories, so the one function that fills them from the names (`briefWithIso3`, `weeklyWithIso3`) moved from the read API's
  `lib.js` to shared `backend/shared/src/briefs.js`, used by the action and by the record's views, so both answer the same. Drafts are noted (a regenerated
  or held-back weekly is a later note of the same subject) and kept out of every view.
- **Writers**: after the DynamoDB put, `newsPostDevTo` and `newsWeeklyBrief` call shared `briefNotes.writeBriefNote`, which builds the note with
  `dailyBriefNote` / `weeklyBriefNote` and writes it with `makeNoteWriter` under `NOTES_PREFIX`. Unset writes nothing (the other note writers default to
  `record/shadow/`; here nothing happens until the coordinator sets it). A failure logs `[notes]` and never fails the run; the DynamoDB puts stay.
  One helper for both writers: they differ only in subtype and builder.
- **Backfill**: `backend/record/cli/backfill-brief-notes.mjs` (like the other backfills: default writes `record/shadow/`, `--live` writes `record/`, `--dry` writes nothing). A row and
  the note a writer makes of it have the same `noteId`, so a re-run, or a row written by both, appends nothing. 2026-10-31 dry run: 152 notes, none skipped.
- **Views** (`briefViews.js`, written with the story views before the indexes and the manifest): `briefs/daily/<date>.json` and `briefs/weekly/<weekOf>.json`
  (`{schemaVersion, builtFrom, dateKey|weekOf, brief}`, `brief` = the action's `data`), and `index/briefs.json` (every daily `{dateKey, headline,
  generatedAt}` and every published weekly `{weekOf, asOf, lede, signals, generatedAt}`, newest first; 23 KB). The newest note of a subject wins. Built from the
  live rows, `brief` equals the live `latest_daily_brief` and `weekly_brief` answers key for key. The 152 briefs add about 0.9 MB of puts to each nightly
  run (137 daily files, growing a day at a time).
- **Membership**: the actions have no gate for these two, so the views carry the same; nothing is added that the action withholds, and the one thing the
  action filters (a weekly that is not published) is in no view.
- **Pages**: `shared/api/briefViews.js` reads the index and views (pure readers, failures reported to the sink and answered as null, a date the index does
  not list answered without a request). `useDailyBrief`, `useDailyEditionsIndex` and `useWeeklyBrief` read the record first and ask the action for what it
  does not hold. Because the views are rebuilt at 23:45 UTC and the daily brief appears at 14:00 UTC, the latest daily asks the action for **today's** brief
  alone unless the record already holds it, and the latest weekly asks the action once the record's newest is a week old; the newer one wins.

## Consequences
- Until the briefs reach the views the same day, the action stays a live source for today's daily and the new Sunday weekly. The guards above can go when a
  run of `newsStoryRecord` follows each brief (or the views are rebuilt by the writer), which is a scheduling decision, not part of this one.
- `DAILY_BRIEF#` and `WEEKLY_BRIEF#` cannot be deleted yet. Left as they are: the Worker's bot pre-render (`worker.mjs` `daily_brief`, `latest_daily_brief`,
  `weekly_brief`) and `newsEmailSender` (the ENABLED weekly email reads `WEEKLY_BRIEF#`; a user-facing send, its source is not changed here). Each must
  read the record, or be retired, before the rows go (STEP5_AUDIT step 10). The brief writers keep their DynamoDB puts until then; the rows keep their 90 and 180 day TTLs.
- The writers need `s3:PutObject` and `GetObject` on `record/notes/daily_brief/*`, `record/notes/weekly_brief/*` (and `record/shadow/` while in shadow) on their roles.
- 0042's table row `brief | daily:YYYY-MM-DD or weekly:YYYY-Www` is replaced by the two subtypes above (the schema and `notes.js` changed; no `brief` note was ever written).
