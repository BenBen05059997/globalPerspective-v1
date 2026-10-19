# One link system and a leaner page set

Status: active (operator approved 2026-10-19)

## Why
Readers cannot move between related things. Each page builds its own links by hand (country links in 21 files,
story links in 14, track-record links in 20, links into the map in none), so whether a page links well depends
on who wrote it. Browser walk-through and code audit 2026-10-19: the story page does not link its countries,
forecasts do not link to their track-record entry and back, nothing links to "show on map", the Stories map
view is a dead end, and the same brief lives at three addresses.

## Decisions (operator, 2026-10-19, after an Opus debate + judge)
1. Build one link system: every reader destination has one canonical address from one module, one link
   component renders it, every entity carries the ids of what it relates to, and a check stops hand-built paths.
2. Merge `/daily`, `/weekly-brief`, `/briefings` into one Briefings page (modes: read, weekly, present). Old
   addresses keep working through real redirects in the Cloudflare Worker.
3. Keep `/today`; link it from the map and give it a bot pre-render.
4. Studio leaves the navigation now (still reachable by URL; shares keep working). Measured 2026-10-19
   (`.board/linking/studio.md`): 0 member runs in 30 days, 0 shares; the deployed `newsAnalyze` prompt is stale
   against the frontend's. Its redesign as the bring-your-own-hypothesis tool gets its own plan. It returns when
   the public example, sharing and a deployed version matching the repo are all in place.
5. Economy stays parked (not deleted). Remove every link that dead-ends in economy; label the country FX box as
   raw market prices with a timestamp.

## Link design (from L0 facts, 2026-10-19)
Facts: `.board/linking/entities.md`, `countries.md`, `renders.md` (live data + code). Key findings: topic ids change every
run (title + position), thread ids are stable once made; countries are keyed by English name in records and URLs
but by ISO3 in situations and topics, with ~9 disagreeing alias tables, duplicate records (USA 45 vs United States 85;
DR Congo x2; Palestine x5) and region records (Africa, Europe, Global…); ~67 hand-built links; nothing links into
the map; no single forecast is addressable.

### Canonical entities and addresses (`shared/lib/links.js`; backend mirror for emails)
| Entity | Key | Address | Notes |
|---|---|---|---|
| Story | `threadId` (stable) | `/weekly/thread/:threadId` (`threadPath`) | Topics are not linked entities: a topic links to its thread. |
| Country | ISO3 | `/weekly/country/:displayName` | URL keeps the display name (saved items, follows); the page resolves aliases and codes and redirects to the canonical name. Non-countries are plain text; a place inside one country links to that country. |
| Situation | situation id | `/?focus=<id>` | No thread: link its country. |
| Map focus | story / country | `/?story=<threadId>`, `/?country=<ISO3>` | `?story=` resolves any thread via `web_index.threads[threadId]` (NOT `threads/story-map.json`, which holds only ~18 tier-1 pairs keyed `axis#ISO3#actor`); `?country=` flies to and outlines the country (`.board/linking/briefings_and_map.md` has the 3-line change for each). |
| Forecast | `qid` | `/track-record?q=<qid>`; inline `#q-<qid>` on the story page | Track record reads `q`, opens the board, scrolls, highlights; old qids need a lookup. |
| Briefing | date / week | `/briefings?date=YYYY-MM-DD`, `/briefings?mode=weekly&week=YYYY-MM-DD` | After the merge; old `/daily/:date`, `/weekly-brief` 301 here. |
| Studio | thread ids | `/analyze?stories=<threadId,…>` | Today it accepts only today's topic ids. |

One component, `<EntityLink kind id>`, renders link + hover preview for story, country, situation, forecast.
One country source: `backend/shared/src/iso3Names.json` extended to `{name, aliases[]}` (+17 missing countries,
GUM/HKG/VAT); every other table and alias list is deleted; one resolver `resolveCountry(text) -> {iso3, name} | null`.

### Ids to add at the source (L2)
- Read API: `prediction_snapshot` returns `threadId`; track record `recent[]` gets `qid` + `clusterKey`.
- Forecast trigger verdicts: the reader and the snapshot builder expect `finalVerdict` / `confirmedBy` /
  `agentVerdict` on PRED# triggers, but no job writes them any more (the resolver writes immutable Q#/SETTLE#
  rows) — the track record's "happened / didn't" per trigger must be read from the Q#/SETTLE# rows (`fields.md`).
- Thread analysis: `iso3[]` (resolver over its topics' regions).
- Country intelligence: top `threadIds[]` (from the archive's regions).
- Archive entries, daily brief stories + country to watch, weekly signals, corrections, story web: `iso3[]` from the
  resolver (not a second AI field — today the AI's `iso3` and `regions` disagree).
- Drift "Because:" lines: `threadId` next to the `topicId`.
- Studio citations: `threadId`.
- Weekly signals: fill `related`; a route for past weeks.
- Country records: merge duplicates under the canonical name, retire the 7 region records. Prepared dry run
  (`.board/linking/country_merge.md` + `.mjs`): copy 105, delete 368 (112 alias + 256 region), 0 user rows to
  rewrite. Apply only after a table backup AND after the changed writers are deployed (merged in the repo 2026-10-19:
  `newsCountryIntelligence` keys by the canonical short name, `newsCountryFactsUpdater` writes DR Congo / UAE;
  not yet deployed), else the duplicates return; operator yes per run.

### Data-quality issues found (backlog, not part of linking)
Thread mis-joins (a Brazil debate inside the Amazon-deforestation thread), situations fragmenting per entity
(afghan / afghan-taliban / afghanistan), 19 of 56 situations with a thread, one forecast whose title did not match its
thread, topic-keyed forecasts spread over many keys.

### Decided (operator, 2026-10-19)
- Display names: short forms ("UAE", "DR Congo").
- Merge duplicate country records under the canonical name and retire the region records (each DynamoDB write is
  listed before it runs).

## Checklist
Each step: one commit or merge, verify + checks green, browser-checked before any release. Releases need the
operator's yes.

### L0 · Gather the facts (read-only) — done 2026-10-19, see Link design
- [x] Entity inventory: for each thing a reader can open (situation, story/thread, topic, country, forecast,
      brief edition, weekly signal, breaking alert, saved item, Studio run) — its id, its canonical page, where
      it is stored, and which related ids it carries today (sampled from live data, not docs).
- [x] Render inventory: every place a page shows one of those things, whether it links, and how.
- [x] Country identity: every distinct "country" string in live data and code, mapped to an ISO code or
      marked not-a-country (e.g. Strait of Hormuz, West Bank); which pages exist for which.
- [x] Link targets: the deep-link parameters each page accepts today (`/?focus=`, `/?story=`, `/?country=`,
      `/briefings?date=&mode=`, `/track-record` anchors, `/analyze?stories=`).

### L1 · The link module and component
- [x] `shared/lib/links.js`: `storyHref`, `countryHref`, `mapHref({situation|story|country})`,
      `briefingHref({date|mode})`, `forecastHref`, `studioHref(stories)` — the only place addresses are built.
- [x] Country identity helper: name ⇄ ISO3, canonical display name, `isCountry`.
- [x] `<EntityLink kind id>` in `shared/ui` (extends `StoryLink`): link + hover preview for story, country,
      situation, forecast.
- [x] Track-record deep links: a forecast entry is addressable (anchor or route) — design with L0 facts.
- [x] Back-end mirror for emails (`backend/shared/src/links.js`), same rules.

### L2 · Related ids at the source
- [x] Add the missing related ids where the data is written (merged 2026-10-19: L2-IDS ab2cc23, L2-JOINS 0e23594) (decided from L0): e.g. forecasts → thread id,
      brief items → thread id + ISO3, situations → ISO3 list, weekly signals → thread id + ISO3.
- [x] Deployed 2026-10-19 except `newsSituationIngest` and `newsSituationTracker` (situation ids change: deploy right after the website release, whose map resolves old ids through `aliases[]`). Country record merge applied 2026-10-20 after a backup. Signals build rule disabled.

### L3 · Apply on every page
- [x] Story page: countries, forecast → track record, "show on map".
- [x] Map: affected countries, country card → country page, situation without a story → its country.
- [x] Country page: show on map, its forecasts, latest briefing mention.
- [x] Track record: each forecast → its story and country.
- [x] Stories map view: story → story page, country → country page.
- [x] Briefings (all modes) and weekly email: every story, region and country linked.
- [x] Studio: picked stories open their story page.
- [x] Remove dead links: `/weekly-markets` on `/today`, economy fallbacks, `?tab=economy`.

### L4 · Guard
- [x] `quality/check_links.mjs` (pre-commit): fails on a hand-built route string outside `shared/lib/links.js`
      (ratchet on today's count, falls to zero).

### P · Pages
- [x] B1 One Briefings page with read / weekly / present modes; carry over the weekly subscribe card and the
      daily share, copy, save controls.
- [x] B2 Real 301s in the Worker: `/daily/:date` → `/briefings?date=`, `/weekly-brief` → `/briefings?mode=weekly`,
      plus the routes retired in decision 0017. Client redirects stay as a fallback. (Worker upload needs a yes.)
- [x] B3 Weekly email button → the new address; saved "daily" items → the new address; sitemap and the
      Worker's page directory updated.
- [x] T1 Map → "Read today's topics" link; Worker bot pre-render for `/today`.
- [x] S1 Studio out of the nav; `plans/` gets the Studio redesign plan with its return criteria.
- [x] E1 Economy dead links removed; FX box labelled.
- [x] C1 (`useSystemsAnalysis` deleted, P-SMALL) one address for the countries list, the other redirects.
- [x] Decision records for 2-5 (0028-0032) (superseding 0016's /today wording only where needed, and 0017's client-only redirects).

### R · Release (deploy later; operator says when)
Done 2026-10-20: country record merge applied (backup `SummarizeAndPredict-pre-country-merge-2026-10-19`; 105 copied,
368 deleted); `newsPostLinkedin` deployed (posts link the story page); Cloudflare candidate uploaded, but it cannot load
data: the read API's CORS allows only the site origins, so a `workers.dev` preview shows "could not be loaded".
- [ ] Release the website: `./deploy.sh --target legacy-pages --commit "..." --push` (Pages serves production).
- [ ] Upload the front Worker `cloudflare/front-worker/production/worker.mjs` (301s for retired addresses, bot
      pre-render for `/briefings` modes and `/today`): code-only, keep name, routes, bindings, secrets and settings;
      record the live version first (rollback target); never a bare `wrangler deploy`.
- [ ] Right after the website: deploy `newsSituationIngest` and `newsSituationTracker` (situation ids change; the new
      map resolves old ids through `aliases[]`).
- [ ] Smoke checks on production: the 5 curl checks in `runbooks/DEPLOYMENT_NOTES.md`, plus `/daily` and
      `/weekly-brief` return 301 to `/briefings`.
- [ ] Browser click-through on production, desktop and phone width:
  - Map: `/?story=<threadId>` (today's and an older thread), `/?country=ARE`, `/?country=Europe` (no fly-to),
    `/?focus=<old situation id>`, affected-country chips, "Open the country page", "Read today's topics".
  - Story page: country links, forecast links to `/track-record?q=`, "Show on map", "Analyze this arc", related stories.
  - Stories `/weekly`: Countries link, board/web/timeline/map views open stories; `/weekly?section=countries` redirects.
  - Country: `/weekly/country/USA`, `/United Arab Emirates`, `/ARE` redirect to the short name; UAE and DR Congo show
    analysis; Show on map; `/weekly/country/Strait of Hormuz` has no follow/save/map.
  - Track record: `?q=<qid>` scrolls and highlights on desktop and phone; story and country links.
  - Briefings: read (previous/next/latest day, share, copy, save), weekly (week before, latest, save), present (deck
    toggle, editions, "Show <country> on the map"); `/daily`, `/daily/<date>`, `/weekly-brief` redirect.
  - /today: "Story arc" opens the thread, country links, archive modal links; no masthead Studio link.
  - Account: saved daily/weekly/story/country items open the right page. Breaking bell and strip.
  - Studio `/analyze?stories=<threadId>`; shared analysis "Run your own".
- [ ] If anything fails: Pages rollback via `./deploy.sh --target stage-pages --artifact <previous hash>`; Worker
      rollback to the recorded version.

## Added 2026-10-19 (operator yes; each point checked in code and live data, not assumed)

### L2 is also "stable ids and sound joins" (verified)
- Topic ids are the title plus the run position (`newsInvokeGemini/src/index.js:683`, `createStableTopicId(title, idx)`),
  so they change every run; summaries and forecasts are keyed by them. Thread ids are stable. Rule: every
  per-story record is keyed by `threadId`; the topic id stays internal.
- A topic joins a thread when its `continues_topic` title matches, else when the composite score
  (`0.5*keywords + 0.3*region + 0.2*category`) >= 0.4 against the last 7 days
  (`NewsProjectInvokeAgentLambda/src/index.js:1189-1210`). Measured 10-06..10-19 (`.board/linking/joins.md`, route
  reconstructed from NewsCache `archive#` rows): 380 novel topics → 30% joined by title, 31% by score, 39% new;
  of 15 judged joins scoring 0.40-0.55, 8 were wrong; every wrong join had keyword-only overlap <= 0.10, every
  right one >= 0.14; same region + category alone scores 0.5 with zero keyword overlap. 39 of 153
  `continues_topic` titles did not match verbatim (case/wording); same-day earlier generations are never
  compared, so same-day duplicates fork. Work: keep 0.4 but require keyword-only overlap >= 0.15 (a shared ISO3
  gate is useless: 115 of 116 score joins already share one); normalise titles in both lookups; include same-day
  earlier generations in the lookback; log every join `{topicId, threadId, via, score, kwScore}`; operator
  merge/split tool. Merged 2026-10-19 (0e23594): all of it, including `backend/pipeline/cli/threads.mjs`
  (`list-joins`, `merge`, `split`) and news situations keyed `news#<ISO3>#<threadId>` with the old ids as aliases;
  not yet deployed.
- Situation id = `news#<axis>#<ISO3>#<entity>` (`newsSituationIngest/src/classifier-core.js:133`), so one country
  splits by entity: live 2026-10-19, 59 situations, Ukraine 8, France 7, Iran 7; only 20 carry a `threadId`.
  Work: key news situations by country + thread when a thread exists, so the map, the story and the country agree.

### L3 also carries one "as of" block (verified)
- The map, story page and country page each show freshness in their own way (`SituationHome`, `ThreadPage`
  `updatedAt`/`as of`, `CountryPage` `updatedAt`); briefing slides show only the edition date; the track record
  shows "checked once". Work: one shared `AsOf` block (generated time + source job) on every page, fed from the
  object's own timestamp.

### P also carries one fact/judgment tag (verified)
- Four wordings for one idea across pages: "fact" (39 uses), "model judgment" (23), "inference" (19),
  "AI-generated" (19); `threads` already has `ClaimTag kind="fact|judgment"`. Work: `ClaimTag` moves to
  `shared/ui` and replaces the others; "judged to feed into" stays as the story-web relation wording (decision 0012).

### Backlog for the next plan (not in this one)
- One read model per page: today the story page reads 5 data hooks, the country page 6, the map 7, each with its
  own browser cache. Target: each page reads one object (story, country, world, briefing, track record) that the
  jobs write and the read API serves; the related ids from this plan live in that object.
- Fewer jobs (verified in `.board/linking/fields.md`): no field has two writers across jobs; the duplication is
  within jobs (DRIFT# = DRIFTLOG#, HISTORY# copies the main row, THREAD WEB is a slice of WEB#INDEX, SYSTEMS#
  has no page reader). Merge candidates: the 04:40 → 05:00 → 05:15 → 05:30 chain (thread analysis, story web,
  country intelligence, drift corrector); retire SYSTEMS# once the Worker's `world_overview` goes; stop writing
  never-shown fields (`situationSummary`, `dominantCategory`, `activeArcCount`, `latencyMs`, `model`, `usage`,
  the DRIFT `current*` fields); unused proxy actions `RESEARCH_BRIEFING`, `pair_analysis`.
- Signals API: builds daily (`TriggerSignalsBuild` 10:00 UTC), 0 keys issued (`GlobalPerspectiveApiKeys`), no page
  reads it. Operator 2026-10-19: PARK — disable `TriggerSignalsBuild` (schedule change, needs a yes when run), keep
  the code and the Function URL; recorded in decision 0032 and `runbooks/parked-jobs.md`; the rule is still ENABLED until it is disabled with an operator yes.

## Usage evidence (read API logs, 7 days to 2026-10-19; `.board/linking/usage.md`)
No page views exist in the repo; the read API logs only API calls with an Origin. Over 7 days of browser traffic:
Stories pages are the most active (~10–30 loads/day); the map ~6–20 sessions/day; country pages ~4 loads/day;
`/today` 6 direct hits in the week and its on-click Predict / Trace Cause calls: 0; `/daily` and `/weekly-brief`
cannot be separated from the map and `/briefings` (they share the same calls); track record low; Studio 0 member
runs and 0 shares. Operator 2026-10-19: `/today` stays, linked from the map (decision 0029; the site has no users yet; usage numbers do not decide
this; it can be promoted later). GA4 is the only source of true page views if a firmer answer is ever wanted.

## Briefings merge facts (`.board/linking/briefings_and_map.md`)
What moves into Read / Weekly / Present is itemised with file:line. Still without a home: a weekly archive (the
read API returns only the latest week → needs a `week=` read), per-signal as-of and TierChip on slides, Save for
the weekly brief (SaveButton knows only `daily`). `/weekly-brief` has no bot pre-render today; the Worker's
`/daily` canonical uses the requested date, not the served one; `quality/verify_pages.sh` asserts DailyPage
strings and must change with the page.
