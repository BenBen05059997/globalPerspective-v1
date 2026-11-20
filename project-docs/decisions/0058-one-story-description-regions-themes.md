# 0058. One story description, one region table, themes from judged links

Status: accepted in direction (operator, chat, 2026-11-10); rules 8 to 10 were approved by the operator on 2026-11-13; the items under "Open details" that are not marked answered are not decided. Steps 2, 3 and 4 are built, committed (57ef9582, 7136de0d, 8d8fd084) and deployed on 2026-11-14 about 06:12Z (`newsStoryRecord` and `newsBoard`); the first scheduled builder run on the new code (12:35Z, 2026-11-14) is not verified yet. Steps 5 to 9 (everything that reads the new data in the frontend or the board) are not built. Amends 0005, 0012, 0037, 0042 and 0054 as each step ships (see the last section). Rule 1 amended by 0065 (a story may also carry a `name`); steps 5 and 6 and the section "What the theme page and the index show" amended by 0066 (the public board from the themes, region boards second).
Date: 2026-11-10

## Context
Pages show a story's title, region, risk tier and grouping from different places, so the same story reads differently on different pages. The numbers below come from a read-only trace of 2026-11-10 (public view files of 2026-11-09 and 2026-11-10; `web.json` and `analyses.json` are the snapshots of 2026-11-09, so some figures mix two days) and from a static mock of the board. Both are working notes in `.board/reviews/` (`story-fields-trace-2026-11-10.md`, `board-theme-mock-2026-11-10.md`). `.board/` is ignored by git, so this record carries the numbers itself.
- Title: three names exist for one story. The record's `title` (newest entry in the last 30 days, a fact; 0037 amendment of 2026-11-04, `backend/record/newsStoryRecord/src/views.js:387`), the model's `analysis.threadTitle` (as of the day the analysis ran), and the title the link-judging model saw (`analysis.threadTitle`, else the newest entry; `backend/pipeline/newsSystemsAnalysis/src/index.js:235`). `web.json` and `analyses.json` differ in title for 83 of the 85 stories in both. Several readers still show the model title first (rule 1).
- Region: four tables (frontend 7 plus World, board 10, map labels 13 names, broad regions) and four sources of a story's country list. 76 of 249 site countries have no board region.
- Tier: computed in the browser (`deriveHeadline`). The score is stored only on the analysis (243 of 364 analyses have one; 162 of 818 active stories have an analysis, 20 percent).
- Description: five different texts exist per story. The weekly review's `line` covers 83 percent of active stories (682 of 818), the analysis `storyArc` 20 percent.
- Grouping: no theme exists. Judged links exist for the webs of 13 countries only. 15 of 64 link reasons contain raw evidence codes such as "(E17, E20)". A merged story still appears under its old id in the web index (3 of the 336 web threads are aliases; 6 of 64 links touch one).
- The builder, `newsStoryRecord`, is the only view writer and already holds the facts, the analysis note, the reading and the link notes in one pure function (`backend/record/newsStoryRecord/src/views.js:507`). It does not validate files against `schema/views/` when it writes.

## Decision
`newsStoryRecord` stamps one shared description on every story, writes one region table's result, a themes file and a region summary once a day. Pages display these; they do not compute title, region or tier. New fields are added beside the old ones; an old field is removed only after every reader has moved (step 7). A missing value is `null` with a reason (0037 section 6; CLAUDE.md "Never invent facts"). Backend changes run in a shadow build first.

The operator approved this direction in chat on 2026-11-10 ("looks good"; "no build but layout the plan"). The rules below are recorded as the direction. Where a rule depends on something not decided, it is listed under "Open details".

### Rule 1. Story title: not a new rule
0037's amendment of 2026-11-04 already decides it: a story's title is the headline of its newest non-article entry within 30 days (`titleOf`, `backend/record/newsStoryRecord/src/views.js:387`); `analysis.threadTitle` is a model paraphrase, stays an analysis field and "is not the story title". This record only requires the readers that still show the model title first, and the title shown to the link-judging model, to follow it. Checked against the code on 2026-11-10; each line still says what is listed:
| Reader | What it does today | Line |
|---|---|---|
| Country page arc list | `ta?.threadTitle \|\| arc.latestTitle`; `latestTitle` is the title of the first entry of the arc (`entries[0].title`, line 371) | `global-perspectives-starter/frontend/src/features/countries/CountryPage.jsx:825` |
| Copy-briefing text | `analysis?.threadTitle \|\| thread.latestTitle` | `global-perspectives-starter/frontend/src/shared/ui/CopyBriefing.jsx:28` |
| Board presets (server) | pin title `a.title \|\| web title \|\| topic title \|\| id`; `a.title` is the analysis `threadTitle` (`backend/shared/src/world/readers.js:136`) | `backend/board/newsBoard/src/presets.js:35` |
| Board pins (browser) | sets the model `threadTitle` first; a title carried by the pin (the preset's, which is the model title) and today's topic title overwrite it when present (lines 42, 44) | `global-perspectives-starter/frontend/src/features/board/hooks/usePinInfo.js:38` |
| Link-judging prompt | `title: analysis?.threadTitle \|\| last entry title \|\| 'Unknown'` | `backend/pipeline/newsSystemsAnalysis/src/index.js:235` |
Evidence that the model title falls behind: of 5 sampled stories, 4 name the same event in newest-entry and model wording (Algeria, Anthropic, Binance, G7); 1 names a different event (`thread-trump-claims-iran-war-will-end-442c7f`: newest entry 2026-10-15 "US Issues Fresh Iran-Related Sanctions Targeting 16 Individuals and 10 Entities", analysis "Trump's Escalating Rhetoric on Iran War Leaves Exit Unclear" made 2026-10-01, 6 entries). Age of the 85 analyses behind `web.json`: 17 under 2 days, 30 of 2-7, 19 of 8-14, 10 of 15-30, 9 over 30. `newsThreadAnalysis` re-runs a story only when it has a new `topicId`, at most 10 stories a day.
The shared fields carry the same string as the story view's `title`. Whether a story with no entry (92 of 818 active rows, `title: null`) is listed is an open check below.

### Rule 2. Regions
The board's 10 regions are the regions of the whole site: Middle East, Europe, East Asia, Southeast Asia, South Asia, Central Asia, Africa, North America, Latin America, Oceania. One table in `backend/shared/src/` (today it is `backend/board/newsBoard/src/regions.js`, 173 ISO-3 codes), completed for the countries that have no region. The builder stamps `regions` on every story; pages stop deriving it. The frontend's 7-plus-World table and the browser's region code are deleted in step 7.
Where the board and the frontend tables disagree, the board table wins:
| Countries | Frontend | Board | Active stories touched |
|---|---|---|---|
| Georgia, Armenia, Azerbaijan | Asia | Europe | 2 |
| Cuba, Haiti, Dominican Republic, Jamaica, Trinidad and Tobago, Guatemala, Honduras, El Salvador, Nicaragua, Panama, Belize, Costa Rica | North America | Latin America | 13 |
| The 12 South American countries | South America | Latin America | 27 |
| Asia (33 countries) | Asia | split into East, South, Southeast, Central | most Asia stories |
| HKG, ESH | no code | East Asia, Africa | the site table has them |
The map's own 13-name table (`situationLabels.js`) is out of scope; it is a presentation table and can later be derived from the same table.

### Rule 3. A story in several regions
A story counts in every region its countries fall in (0054's preset rule, "a place involved is a place affected", extended to the whole site). "World" in a filter means only a story with no country. In the 818 active stories 231 touch more than one board region (the frontend rule shows "World" for 321, 39 percent: 221 multi-region, 92 no country, 8 other). Consequence: region counts add up to more than the story count (995 region memberships over 716 stories), and each page that shows a total says "a story counts in each region it touches". "World" would then hold about 102 of 818 (92 with no country, 10 with only non-region codes).

### Rule 4. Themes
A theme is a group of stories connected by judged links, built by the builder once a day into `index/themes.json`; `index/regions.json` is a per-region summary with the plain states: no stories, no links judged, links.
- Links used: judged links, weak ones included, with the limit that a weak link only attaches a group of 2 or fewer (rule 9). Texture follows `project-docs/architecture/ARCHITECTURE_BOARD.md` section 3 (operator, chat, 2026-11-10): a link of ours is drawn dashed until the weekly review confirms it, and solid only after; strength is shown by line width and the strength word, never by colour. No link is confirmed today, so every theme link is drawn dashed for now. Shared-actor pairs never join groups (0012 and 0037: shared facts are not links; they are what glued the 31-story blob, which splits into 14 and 11 without them).
- Merged (alias) story ids are resolved to the surviving story before grouping; a link whose two ends become one story is dropped.
- One link per story pair: the strongest across the countries' webs, ties by newest. (64 raw links are 54 pairs; 10 pairs were judged in two countries' webs, possibly with different strength.)
- A theme is shown from 3 stories. This keeps 9 groups of 56 stories and leaves out the two pairs (4 stories).
- Title: the theme's countries line (countries by story count) with a lead story's headline under it. The title names only countries of 2 or more stories (rule 8); the lead rule is rule 9.
- The themes file also carries each story's count of open forecasts, so the theme page can show "what follows" without a model call (operator agreed in chat, 2026-11-10). It holds groups of 3 or more only.
- No hub splitting in the first version (the mock's variant d put 2 stories in two themes each). Look at the real groups first.
- Evidence codes: the note keeps the reason as the model wrote it (notes are append-only, 0042). The published reason text has the "(E..)" groups removed, and the cited entries stay as data (`cited`: topicId, date, title). The codes cannot be mapped back from the text (numbered per run; counts differ from `cited`). No code strips them today.
- Theme id: `themeId = "theme-" + threadId` of the anchor, anchor = the theme's story with the earliest `born` (ties: smaller `threadId`), after alias resolution. Pending the stability check under "Open details".
Mock results on the 2026-11-09 data (336 web stories; links counted once per pair):
| Variant | Groups | Sizes | Stories connected |
|---|---|---|---|
| (a) judged plus shared-actor | 7 | 31, 8, 6, 5, 4, 4, 3 | 61 |
| (b) judged only, weak included (this rule) | 11 | 14, 11, 8, 5, 4, 4, 4, 3, 3, 2, 2 | 60 |
| (c) judged, strong and medium only | 12 | 11, 6, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2 | 44 |
| (d) (c) split at hubs | 14 themes | 9, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2 | 44 (2 appear twice) |
Weak links are what keep Israel-Palestine in one group of 8; under (c) it becomes 4 plus a pair. The mock's index page drew variant (d) and its theme page variant (b); the second mock (step 6) uses (b). Webs exist for 13 countries (links: United States 12, Iran 10, Ukraine 9, Israel 7, Russia 6, United Kingdom 4, China 3, France 3, South Korea 3, Japan 2, India 2, Saudi Arabia 2, Yemen 1); Africa and Latin America have none; 223 of 336 web stories are one-off (`single_update`).

### Rule 5. Short description
The weekly review's `line` (one sentence, 54-198 characters, median 114), with its week beside it (`lineWeek`). When there is no line the value is `null` and `lineReason` says why ("no reading yet", the wording 0037 section 6 uses). No fallback to the first sentence of `analysis.storyArc`, the newest entry's summary bullet or the web node summary: each is a different kind of text and would be labelled wrongly. The `line` can name another subject than the title (`thread-russia-says-it-will-open-human-cbeb97`: title about trilateral peace talks, line about strikes on Kyiv), because it is a week reading and the title is the newest entry. It is missing on 136 of 818 active rows (92 with no entries, 30 born in the last 8 days, 14 other); a new story gets its line after the Monday review.

### Rule 6. Tier
The builder stamps `tier` from the analysis score with `tierFromScore` (`backend/shared/src/world/tier.js`), with the analysis date beside it (`riskAt`). With no score the value is `null` and `tierReason` says why: "no analysis yet" or "analysis has no score" (121 of 364 analyses have none). Where `dimensions` exist, `riskScore` equals the worst axis in all 187 cases, so `tierFromScore(riskScore)` gives the same tier as the browser's `deriveHeadline` for all 243 scored analyses. The tier is as old as the analysis (9 of the 85 in `web.json` are over 30 days old), which is why the date is stamped.
This amends one sentence of 0037. It reads (0037, Consequences, "Open for step 3"): "the review adds `line`, `chapters`, `branchStatus` to the story view and `confirmedLinks` to `links/`; it then also writes `risk` as `tierFromScore(score)` from a dated reading (see `backend/shared/src/world/tier.js`), never from the old THREAD_ANALYSIS score." What changes: the new `tier` field is taken from the analysis score (`riskScore` of the story analysis note). "Never from the old THREAD_ANALYSIS score" no longer holds for `tier`. The review's own `risk` on the reading stays as that sentence says.

### Rule 7. The shared story fields, and write-time validation
One shape, defined once in `backend/record/newsStoryRecord/schema/views/story-stamp.schema.json` and referenced by every file that names a story. Names stay as close as possible to those the views already use.
| Field | Type | Status | Rule |
|---|---|---|---|
| `threadId` | string | existing | survivor id; an alias row keeps `aliasOf` |
| `title` | string or null | existing | rule 1 |
| `line` | string or null | existing on rows (the story view keeps its own `line{text,week,cites}`) | rule 5 |
| `lineWeek` | ISO week or null | new | the reading's week; on the story view it is a top-level field beside its `line` object |
| `lineReason` | string or null | new | set when `line` is null; also top-level on the story view |
| `iso3` | string[] | existing | valid country codes only, plus `EUU`; sorted; `WLD`, `LAT`, `UNK` removed in the builder (see open checks). On `index/web.json` `threads[id]` it stays that row's own list (top places in the 30-day window) |
| `regions` | string[] | new | region names of rule 2 for every country; sorted; `[]` for no country |
| `tier` | `low` / `moderate` / `elevated` / `high` or null | new (analysis rows have `riskLevel`, but the analysis writer never stores it: 0 of 364) | rule 6 |
| `riskScore` | 0-100 or null | existing on the analysis | analysis score (worst axis) |
| `riskAt` | ISO time or null | new | the analysis `generatedAt`; null when there is no score |
| `tierReason` | string or null | new | set when `tier` is null |
| `lastFactAt` | ISO time | existing | |
| `born` | date | existing | |
| `themeId` | string or null | new | rule 4; null when in no theme |
Where it appears: rows of `index/active.json` and `all.json`, the story view top level (the model's `analysis` stays as is), `index/web.json` `threads[id]`, `index/analyses.json` per analysis (a display `title` beside the model's `threadTitle`), `index/themes.json` (stories). `links/{id}` ends do not carry the stamp (see "Built so far"). The browser's `deriveHeadline` stays for the per-axis scorecard only.
Validation: the builder validates each file against its schema before writing. On a failure the old file stays and the Run records it. Today only tests validate (`backend/record/newsStoryRecord/test/views-schema.test.js`); the only write-time guards are size caps. The schemas are `additionalProperties:false` (rows, indexes, `links.web`), so every new field needs its schema edit and a golden-file update (`backend/record/newsStoryRecord/test/golden/views.golden.json`, `indexviews.golden.json`) before the tests pass. Size: `all.json` is 1.73 MB of a 5 MB cap and each index is capped at 2 MB (`backend/record/newsStoryRecord/src/indexViews.js:14`); measured on live files with the real function (2026-11-10): `all.json` 1,732,970 to 2,422,869 bytes (cap 5,242,880); `active.json` 410,914 to 531,131; `analyses.json` 871,551 to 1,012,561 (cap 2,097,152); `web.json` 187,683 to 314,468 (cap 2,097,152).

### Rule 8. What the stamp's new fields mean (operator, 2026-11-13)
- `lastEntryAt` and "new facts": the time of the story's newest news entry. "New facts this week" counts news entries only (within 7 days before the web index's `generatedAt`); forecast facts and verdict facts do not count (the nightly settle writes a verdict fact on many stories, so counting it would show old stories as new). On the 2026-11-14 live input this moved 96 of 262 stories out of the count (166 of 905 active stories remain).
- Crisis type: the type of a story's newest news entry. The builder stamps the raw `category` of that entry (lowercase, as the entry has it; null when no news entry has one). The one mapping from raw category to Conflict, Political, Economic, Humanitarian or Other lives in the frontend, `global-perspectives-starter/frontend/src/shared/lib/crisisHue.js`; the backend does not map it. Society, technology and science are not in that map and fall to Other. Hue means crisis type only (0013, unchanged).
- Page wording (approved, not built): "Colour shows the kind of crisis. Bright means new facts this week." and "N of M with new facts this week".
- Theme title: it names only countries with at least 2 stories in the theme, up to 4 (`titleCountries`); the others are counted in `moreCountries`. When no country has 2 stories, the first 4 countries by story count are used. These fields exist on each theme in `index/themes.json`, not on story rows.
- Regions: `EUU` is kept in story `iso3` and counts as Europe. `WLD`, `LAT` and `UNK` are dropped in the builder (they come from old, append-only facts). A story with no country has no region (`regions: []`); 97 of 905 active stories on the 2026-11-13 data.
- The entries inbox does not validate `iso3`: `backend/record/newsStoryRecord/src/inboxEntries.js` has no `iso3` check. The selector's `canonicalIso3` (`backend/pipeline/newsInvokeGemini/src/index.js`) is the only guard, and the builder cleans the rest.

### Rule 9. How themes are grouped (as built in `backend/record/newsStoryRecord/src/themes.js`)
This is the built form of rule 4; where they differ, this rule is what the code does.
1. One link per story pair after merges (rule 4). Strength is the web link's `confidence` (strong, medium, weak); anything else ranks after weak.
2. Strong and medium links join their two stories first.
3. Then every other link (weak, or no strength) is taken in order of most cited entries, newest cited date, then ids. It joins its two groups only if the smaller of the two has at most 2 stories. A weak link therefore attaches one story or one pair to a group, and never joins two bigger groups. A refused weak link belongs to no theme.
4. A group is a theme from 3 stories. There is no hub splitting.
5. Lead story: most judged links inside the theme, ties by highest tier, then newest `lastFactAt`, then smaller id (open detail 2 is built this way). Anchor and `themeId`: as rule 4.
6. Theme order in the file: most stories with new facts, then most strong links, then most stories, then id.
Known oddity (2026-11-14 data, not changed): a 3-story theme led by a German strikes story ("German unions launch wave of strikes over cost-of-living pressures") is titled France, because all 3 stories are tagged FRA and only one is tagged DEU. The rule works as written; whether it gives the right title is not decided.

### Rule 10. Verification on live input, 2026-11-14
Report: `.board/reviews/0058-record-rebuild-old-vs-new-2026-11-14.md` (local rebuild of the old and the new builder on the same copy of the live record, read-only; `.board/` is ignored by git, so the numbers are here). No rows were added or removed in any index or story view. Changed existing fields: `iso3` cleaned on 8 stories, and 14 link ends dropped in 6 link files (all grounded on `WLD` only). 8 themes over 50 stories (of 905 active). Region states: "links" for 8 regions, "no links judged" for Central Asia and Latin America. 92 active rows are forecast-only stories with `title: null` (honest nulls). Every view passes its schema (ajv, the same check the tests use). Old-versus-new run time 3.05 s and 3.15 s locally. Other reports: `.board/reviews/lambda-deployed-vs-repo-2026-11-14.md` (the deployed `newsStoryRecord` equalled the repo before the deploy; `newsBoard` differed only in unused shared files) and `.board/reviews/newsboard-post-deploy-2026-11-14.md` (after the deploy: `list_presets` answers with 9 presets, no errors in the logs; `preset-central-asia` does not exist because it has fewer than 2 stories). Live: `newsStoryRecord` CodeSha256 `3UMM24ri...` and `newsBoard` `z5VakW2D...`, both from 8d8fd084 (read from AWS on 2026-11-14).

## Open details (not decided)
1. Completion of the 76 countries with no board region. The draft table below is a proposal for the operator to confirm. It is built into `backend/shared/src/regions.js` and deployed as it stands; the operator's confirmation is not recorded. Total 76 = 26 with a frontend region plus 50 territories (45 given a region here, 5 left without).
| Countries | Frontend region | Proposed board region | Flag |
|---|---|---|---|
| AND LIE MCO SMR VAT | Europe | Europe | |
| CPV COM MUS SYC STP | Africa | Africa | |
| FSM KIR MHL NRU PLW TON TUV WSM | Oceania | Oceania | |
| ATG BHS BRB DMA GRD KNA LCA VCT | North America | Latin America | Disagrees with the frontend. The board already puts CUB DOM HTI JAM TTO in Latin America. The name "Latin America" would then cover the Caribbean, a wording choice for the operator. |
| ABW AIA BES BLM CUW CYM FLK GLP GUF MAF MSR MTQ PRI SXM TCA VGB VIR | none | Latin America | Territories. PRI and VIR are US territories (alternative: North America). |
| ALA FRO GGY GIB IMN JEY SJM | none | Europe | |
| ASM CCK COK CXR GUM MNP NCL NFK NIU PCN PYF TKL WLF UMI | none | Oceania | CCK and CXR sit in the Indian Ocean; UMI is mixed Pacific and Caribbean |
| MYT REU SHN | none | Africa | |
| BMU GRL SPM | none | North America | |
| MAC | none | East Asia | with HKG, already East Asia |
| ATF BVT HMD IOT SGS | none | no region | sub-Antarctic or ocean territories |
Also flagged: Georgia, Armenia and Azerbaijan move from Asia to Europe (2 active stories), as the board table already has them.
2. The lead-story rule for a theme. The mock's rule "highest tier, ties by score, then most strong or medium links inside the theme" picked a story that does not describe the theme (the 9-story theme leads with an Iran-war and midterm-politics story chosen for risk, not centrality). Coordinator's suggestion: most judged links inside the theme, ties by highest tier, then newest. Step 4 is built and deployed with this rule (rule 9). Answered in code; the operator's confirmation of the leads is not recorded.
3. Whether the theme id rule (anchor = earliest `born`) is stable enough. The id changes when two themes merge (one id disappears), or when the anchor story ages out of the 30-day web window or is merged away. Still open: only one day was built on live input (2026-11-14), so stability across days is not checked, and the first live run is not verified. If many ids change, the fallback carries ids over from the previous day's file; that makes the builder read its own earlier output, which changes 0037's "rebuilt in full from facts" and needs its own decision. No user data stores a theme id today (board pins hold story ids), so a changed id loses a link, not data.
4. Write-time validation (not built; the builder has no validator, only the tests validate): whether a JSON-schema library (the tests use `ajv` taken from the frontend `node_modules`; the builder has none) may be added to the Lambda zip, which is a new dependency and needs the operator's yes, or whether a small hand-written check is used.
5. The visible change of the Stories page sentence from the first sentence of `analysis.storyArc` to the `line`. It needs the operator's yes at the release of step 7.
6. Whether the browser can read `index/themes.json` and `index/regions.json` directly, so that `newsBoard` needs no IAM change. The Worker already serves any `record/views/**.json` (`cloudflare/front-worker/production/worker.mjs:20`, confirmed live as the deployed code on 2026-11-14; `candidate.mjs` not read). Nothing in the frontend or in `newsBoard` reads the two files yet. `newsBoard`'s role names single files (`backend/board/newsBoard/README.md:9-10`), so if it must read the new files that is an IAM change and needs the operator's yes. From repo files; not verified against live AWS.
7. Whether the forecast-only stories (first open check) are listed on story lists, and under what name. Nothing on record decides it; the data alone is a card with no title and one forecast question. Coordinator's suggestion: leave them off story lists. Not built; still open.
8. Whether theme pages are visible to search engines. `/board` is noindex today because it is a member page (`global-perspectives-starter/frontend/src/features/board/README.md`, "Routes"). Nothing on record decides it for theme pages.

## Open checks (traced 2026-11-10; details in `.board/reviews/0058-open-checks-2026-11-10.md`)
- Titleless rows, answered: the 92 active rows with `title: null` and `entryCount: 0` are forecast-only stories. A row exists for any thread with a non-run fact; "active" means `lastFactAt` within 60 days, and forecast and verdict facts count; the title comes from entries only (`backend/record/newsStoryRecord/src/views.js`). In `all.json` every one of the 677 non-alias titleless rows has `entryCount` 0, and no titled row has 0. Why their entries are on no thread is not traced (it needs the facts files): either the entry id (sha1 of the smallest canonical source URL) matched an earlier entry, or the forecast's `threadId` differs from the entry's final thread. Whether they are listed is open detail 7.
- Non-country codes, answered: on the 2026-11-10 `active.json` the codes not in `iso3Names.json` are `EUU` 14 stories, `WLD` 6, `LAT` 1, `UNK` 1, and no others (the earlier figures 16, 10, 2, 1 are not reproduced). They are model tags from the selector prompt (`backend/pipeline/newsInvokeGemini/src/index.js`), carried through entry facts into the story `iso3`. Commit 950583af (2026-10-20, `canonicalIso3`) drops unknown codes at the selector; every affected story was born 2026-10-01 to 10-16, and no weekly entry after 10-20 has one. So the cleaning is for old, append-only facts and belongs in the builder (step 3); `regionsOfCountries` (step 2) already gives them no region. Answered 2026-11-14: the entries inbox (`inboxEntries.js`) does not validate `iso3`; the selector's `canonicalIso3` is the only guard (rule 8). Checked 2026-11-14: the deployed selector (`newsIngest`) defines and calls `canonicalIso3`, so it includes 950583af (`.board/reviews/lambda-deployed-vs-repo-2026-11-14.md`).
- Shadow comparison, answered: nothing copies live `record/` into `record/shadow/`, so an S3 shadow build is not comparable with live, and a bulk copy is costly (S3 PUTs were the main AWS cost). Use a local rebuild instead: sync live `record/` and `record/views/` to a local folder (read-only `aws s3 sync`); run `backend/record/newsStoryRecord/scripts/rebuild-test.js` with the current builder as the baseline (content refreshed from DynamoDB will differ), then with the new builder; diff the two outputs. `rebuild-test.js` prints counts only and needs a small change to write both outputs. Diff the deployed `newsStoryRecord` against the repo first. Done 2026-11-14 as planned, with `--out DIR` (commit 7136de0d): see rule 10.

## Built so far
Steps 2, 3 and 4 were built and reviewed on 2026-11-10 (the notes below are from then), committed as 57ef9582 (step 2), 7136de0d (`rebuild-test.js --out`) and 8d8fd084 (steps 3 and 4), and deployed on 2026-11-14 about 06:12Z: `newsStoryRecord` (CodeSha256 `3UMM24ri...`) and `newsBoard` (`z5VakW2D...`), backups in `.deploy-backups/`. The first scheduled builder run on the new code (`TriggerStoryRecordRefresh`, 12:35Z, 2026-11-14) is not verified yet. Steps 5 to 9 are not built.
- Step 2: the table is `backend/shared/src/regions.js`. Its 76 added countries follow the draft table of open detail 1, which is still a proposal (`ATF BVT HMD IOT SGS` have no region).
- Step 3: the stamp is one function, `backend/record/newsStoryRecord/src/storyStamp.js`, with schema `schema/views/story-stamp.schema.json`.
- The story view keeps its own `line` object (`{text, week, cites}`) and gains `lineWeek` and `lineReason`. The stamp's string `line` is on index rows and the index files.
- `index/web.json` `threads[id]` keeps its own `iso3` (the top places in the 30-day window); the stamp is added there without `iso3`.
- `riskAt` is null when there is no score.
- Story `iso3` is cleaned in the builder (valid codes plus `EUU`). Link grounds use the cleaned codes, so `WLD`, `LAT` and `UNK` no longer count as a shared country. This changes model input for the weekly review's selection (`backend/record/newsRecordReview/src/select.js`, shared-country grounds). How many live links change is not measured yet.
- `links/{id}` ends do not carry the stamp. Coordinator's suggestion: about 4,400 link files would be rewritten, and a link already names the other story and its title. The operator said yes to the plan in chat on 2026-11-10; confirm at the step 4 review.
- Write-time validation is not built; open detail 4 is still open.
- Sizes: see rule 7.
- Tests: `newsStoryRecord` 301 of 301 pass; `backend/shared` 297 of 297; `newsBoard` 59 pass, 4 skipped (the skips existed before).
- Step 4 (built and reviewed 2026-11-10, same branch, uncommitted): `backend/record/newsStoryRecord/src/themes.js` builds `index/themes.json` and `index/regions.json`; the stamp carries `themeId` (null when the story is in no theme). Link strength is the web link's `confidence` and the reason is its `mechanism` with the "(E..)" groups removed; the link data has no confirmed state, so none is published. Each theme story carries `liveBranchCount` (open forecast questions) from its index row.
- Step 4, region `state`: "no stories", "no links judged" or "links". "links" means a judged pair has an end in the region, even when the pair is too small to be a theme, so a region can read "links" with no theme. On the 2026-11-09 data Africa reads "links" for that reason; Latin America and Central Asia read "no links judged".
- Step 4, check on the 2026-11-09 `web.json` (no alias list in that copy, so merges were not resolved): 54 pairs from 64 links; 9 themes of sizes 14, 11, 8, 5, 4, 4, 4, 3, 3 (56 stories), as rule 4 expects. Leads by the suggested rule: the 14-story theme leads with "Trump Waives Russia Sanctions Under New Law", the 11-story theme with "Trump Signals 'Positive Momentum' Toward Ending Iran War". One 4-story theme (lead "US Wraps Up Military Mission in Iraq") had no countries in that data and mixes subjects. Tests after step 4: `newsStoryRecord` 315 of 315.
- Both were run on 2026-11-14 once the AWS login worked (rule 10).
- Not done: the theme-id stability check on past days, alias resolution on live data beyond the one local rebuild, write-time validation in the builder.

## Order of work
Rules for every step:
- One step at a time. A step starts only after the one before it is reviewed and the operator has seen the result.
- Backend changes run in shadow first (`record/shadow/views/`) and are compared with the live files before going live.
- Diff the deployed Lambda against the repo before any deploy (`scripts/lambda.sh <name> diff`); the trace did not check whether the deployed `newsStoryRecord` or `newsSystemsAnalysis` equals the repo.
- New fields are added beside the old ones. An old field is deleted only after every reader has moved (step 7).
- Never invent a value. A missing value is `null` with a reason (0037 section 6).
- No alarms or emails. Failures show on `/ops`.
- Needs a fresh yes each time: frontend releases (`./deploy.sh --target ...`), IAM changes, new spend, a new dependency.
- Not in this record: the map's situations (their own store and headlines). A later, separate step.

| Step | What is done | How it is checked | What it needs from the operator |
|---|---|---|---|
| 1. Trace and record | Done 2026-11-10. Every place that computes or reads a story's title, region, tier, description and grouping was traced; this record is the result. | Read-only; no `aws` command, no code change. Tests were not run. | Done: direction accepted in chat. The open details above still wait for the operator. |
| 2. One region table | Move the board's table to `backend/shared/src/`, complete it (open detail 1), give the non-country codes no region (`EUU` counts as Europe), make `newsBoard` import it. Removing `WLD`, `LAT`, `UNK` from story `iso3` is in step 3 (the builder), because they sit in old facts only (open checks). A test over every country code the site knows (`backend/shared/src/countries.js`, 249 countries). | Board presets give the same result as before, except for the newly covered countries. | The completion table confirmed; `aws login` (commit hook and deploy); a yes for each Lambda deploy under the standing authorization. |
| 3. Shared description, tier stamp, validation (in the builder) | `story-stamp.schema.json` and one builder function that produces the fields of rule 7. Every index file carries them beside its old fields. The tier stamp (rule 6). Write-time validation. Each new field needs its schema edit and its golden-file update because the schemas are `additionalProperties:false`. | Shadow build; then compare with live: same stories, and the new fields agree across all index files for every story. Tests (`node --test`). Size against the caps. | Open detail 4 (dependency); the open checks on titles and the shadow comparison; `aws login`. |
| 3b. Title shown to the link-judging model | `newsSystemsAnalysis` (`index.js:235`) uses the story title of rule 1 instead of `analysis.threadTitle` first. This changes model input, so it gets a dry-run comparison first: list per story the old and the new prompt title for one day, and count how many differ. Links already judged keep their old basis. Placed after step 3 so the title is the same function as the builder's. | The dry run shows the inputs only. Running the model on both inputs to compare links is new model spend. | A yes before any model comparison run; diff the deployed Lambda first; a yes for the deploy. |
| 4. Themes file and region summary | The builder writes `index/themes.json` (stable id, title parts, lead story, stories, links with strength and reason, countries, regions, highest tier, and each story's count of open forecasts so the theme page can show "what follows" without a model call; operator agreed in chat 2026-11-10; the file holds groups of 3 or more only) and `index/regions.json` (per region: story count, highest tier, its themes, plain state). Alias resolution before grouping; evidence codes out of the published reason; cited entries kept as data. | Shadow build; group sizes match the mock's numbers for the same day's data (variant b); schema validation; theme-id stability on three past days (open detail 3). | Open details 2 and 3. |
| 5. The board backend reads the views | First check whether the browser can read the two files directly (open detail 6). `newsBoard` presets read them and its own grouping code is deleted. All regions are listed. `presets.js` follows the title rule (rule 1). | Preset answers compared before and after; the member board (pins, forks of presets) still works on a test account in local dev. | A yes for an IAM change if the Lambda must read the new files. |
| 6. Board redesign in the frontend | After the pending fix release is merged (it touches the same board files). Design in "What the theme page and the index show" below. A second mock first, with the title rule and variant (b). Then the two-row index, the theme board page, the visitor links from a story page and from the map's country card, and the board usability findings that still apply. Board pins follow the title rule (`usePinInfo.js`). | Browser check at 1440 and 390 px, signed out, on live data; every touched control clicked. | The new wording (the mock's list of new texts) approved; "yes release". |
| 7. Other pages read the shared fields | Stories (cards, filter, sentence), Countries chips, Today rail, the weekly map, the country page story list and the copy-briefing text read title, region, tier and description from the view files; the last two follow the title rule. Then the frontend's own region and tier code is deleted. | Counts per region on each page equal the region summary file; no reader of a removed field is left (trace section F lists them). | Open detail 5 (Stories sentence); "yes release". |
| 8. The guard and coverage numbers | A quality check that fails when a page computes title, region or tier itself. Coverage numbers on `/ops`: share of stories analysed, share linked, per region. | The check fails on a planted violation; `/ops` shows the numbers. | Nothing beyond the release yes. |
| 9. Coverage decision (spend) | With the step 8 numbers, decide whether to raise the daily analysis limits (`MAX_THREADS=10`) or add a cross-country link pass. | Costs from `COSTS.md` before and after. | The operator's yes: new model spend. |

### Status of the steps, 2026-11-14
| Step | Status |
|---|---|
| 1 | Done 2026-11-10. |
| 2 | Built and deployed: 57ef9582; `newsBoard` reads the table. |
| 3 | Built and deployed: 8d8fd084 (stamp, cleaned `iso3`, schemas). Write-time validation not built. 3b (title shown to the link-judging model) not built. |
| 4 | Built and deployed: 8d8fd084 (`index/themes.json`, `index/regions.json`, `themeId`). First live run not verified; theme-id stability across days not checked. |
| 5 to 9 | Not built. No page and no Lambda reads the two new views yet. `newsBoard` presets still use their own grouping. |

### What the theme page and the index show (operator, chat, 2026-11-10)
Context from `ARCHITECTURE_BOARD.md`: the board's question is "do these things connect, how, and what follows if they do"; presets are "by region now; theme and desk later"; the build rule of its section 2 applies (the full screen is designed first, a part with no data is absent, no placeholder).
- Theme page, in this order: (1) countries line, lead headline, story count, highest tier with its date; (2) how they connect: each link as a sentence with "judged to feed into" (0012), the strength word, the cleaned reason and the dated entries cited; (3) what follows: the open forecasts on the theme's stories (question, percent, due date), no model call; (4) what moved this week: stories with new facts first, each with its short line; (5) the graph, second and small, reusing the read-only preset view; (6) for members, fork to my board.
- Not on the theme page: pin budget, clue pool, weights, alerts. They stay on the member's own board.
- Index: two rows, themes then the 10 regions. Each region states no stories, no links judged, or links; a region with no links lists its stories by tier.
- Ways in: a link from the story page and from the map's country card (already in step 6). The menu stays as decided (0033).
- Order: step 4, then a second mock made from the real themes file, then the design is settled in chat, then the build.
- New wording still needs the operator's approval before release.

## Rejected
- Computing region or tier again in each page (the cause of the problem).
- Using shared-actor pairs in themes (0012, 0037).
- Carrying theme ids over from yesterday's file in the first version (breaks "rebuilt in full from facts").
- Strong and medium links only (variant c): 9 of the 31 stories drop out, and the 8-story Israel-Palestine group falls to 4 plus 2.
- A fallback chain for the description (rule 5).

## Consequences
- One builder stamp means pages stop disagreeing. The cost is a schema, golden files and the readers listed in the trace for every file touched.
- The title in the stamp is only as good as rule 1; the link-judging prompt must follow it (step 3b) or links are judged on a different name than users see.
- Region counts add up to more than the story count (rule 3).
- Tier is as old as the analysis; `riskAt` shows it. Coverage is the limit: 20 percent of active stories have an analysis. A coverage decision (more model spend) is step 9, with its own yes.
- Theme coverage is the limit of judged links: 13 countries, none in Africa or Latin America, one-off stories not linked.
- If `newsBoard` reads the new files it needs its IAM grant extended (single files today); the Worker needs no change. Both from repo files, unverified against live AWS.
- Unverified against live AWS in the trace: schedules, IAM policies, env, deployed zips. No `aws` command was run.

## Amends
Each is appended to the amended record as "Amended by 0058", and takes effect as the step that builds it ships. Until then the rule in the older record stands as built.
- 0037 (views from facts): index row fields and the story stamp; new views `index/themes.json` and `index/regions.json`; write-time schema validation (new rule); the sentence quoted in rule 6 ("never from the old THREAD_ANALYSIS score") for the new `tier`. The title rule of its amendment of 2026-11-04 is kept (rule 1), not changed.
- 0005 (one importance scale): the builder stamps the tier, so pages stop deriving it; the analysis writer still stores no `riskLevel`.
- 0054 (readers on the record): the preset rule "a story belongs to every region its countries fall in" becomes the site rule; `newsBoard` presets read the themes and regions files and its own grouping code is deleted (step 5).
- 0012 (story web is news-based): themes are groups of judged links ("judged to feed into"); weak links count; texture follows `ARCHITECTURE_BOARD.md` section 3 (dashed until the weekly review confirms a link, solid only after); shared-actor pairs do not join groups. The wording rules stay.
- 0042 (notes in the record): the published reason text has evidence codes removed; the notes stay unchanged.
- Not amended: 0046 (the weekly index keeps its `titles` map, which equals the stamp title), 0040, 0057.
- Navigation only: `ARCHITECTURE_BOARD.md` section 8 ("by region now; theme and desk later"), `ARCHITECTURE_TIMELINE.md` section 5 (view table), `DATA_STRATEGY.md` view list. These describe what is built; they change when the steps ship (CLAUDE.md "Docs").

Source: working notes (ignored by git, so not required to read this record): `.board/reviews/story-fields-trace-2026-11-10.md` and `.board/reviews/board-theme-mock-2026-11-10.md` (with its data in `.board/reviews/mocks/board-themes-2026-11-10/`); decisions 0005, 0012, 0035, 0037 (and its amendment of 2026-11-04), 0040, 0042, 0046, 0054, 0057; `backend/record/newsStoryRecord/src/{views,indexViews,publish}.js`; `backend/board/newsBoard/src/{regions,presets,world}.js`; `global-perspectives-starter/frontend/src/shared/lib/{countryMapping,riskTiers,situationLabels}.js`.
