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
4. Studio leaves the navigation now (still reachable by URL; shares keep working). Its redesign as the
   bring-your-own-hypothesis tool gets its own plan. It returns when the public example, sharing and a
   deployed version matching the repo are all in place.
5. Economy stays parked (not deleted). Remove every link that dead-ends in economy; label the country FX box as
   raw market prices with a timestamp.

## Checklist
Each step: one commit or merge, verify + checks green, browser-checked before any release. Releases need the
operator's yes.

### L0 · Gather the facts (read-only)
- [ ] Entity inventory: for each thing a reader can open (situation, story/thread, topic, country, forecast,
      brief edition, weekly signal, breaking alert, saved item, Studio run) — its id, its canonical page, where
      it is stored, and which related ids it carries today (sampled from live data, not docs).
- [ ] Render inventory: every place a page shows one of those things, whether it links, and how.
- [ ] Country identity: every distinct "country" string in live data and code, mapped to an ISO code or
      marked not-a-country (e.g. Strait of Hormuz, West Bank); which pages exist for which.
- [ ] Link targets: the deep-link parameters each page accepts today (`/?focus=`, `/?story=`, `/?country=`,
      `/briefings?date=&mode=`, `/track-record` anchors, `/analyze?stories=`).

### L1 · The link module and component
- [ ] `shared/lib/links.js`: `storyHref`, `countryHref`, `mapHref({situation|story|country})`,
      `briefingHref({date|mode})`, `forecastHref`, `studioHref(stories)` — the only place addresses are built.
- [ ] Country identity helper: name ⇄ ISO3, canonical display name, `isCountry`.
- [ ] `<EntityLink kind id>` in `shared/ui` (extends `StoryLink`): link + hover preview for story, country,
      situation, forecast.
- [ ] Track-record deep links: a forecast entry is addressable (anchor or route) — design with L0 facts.
- [ ] Back-end mirror for emails (`backend/shared/src/links.js`), same rules.

### L2 · Related ids at the source
- [ ] Add the missing related ids where the data is written (decided from L0): e.g. forecasts → thread id,
      brief items → thread id + ISO3, situations → ISO3 list, weekly signals → thread id + ISO3.
- [ ] Deploy the changed Lambdas with `scripts/lambda.sh` (diff first).

### L3 · Apply on every page
- [ ] Story page: countries, forecast → track record, "show on map".
- [ ] Map: affected countries, country card → country page, situation without a story → its country.
- [ ] Country page: show on map, its forecasts, latest briefing mention.
- [ ] Track record: each forecast → its story and country.
- [ ] Stories map view: story → story page, country → country page.
- [ ] Briefings (all modes) and weekly email: every story, region and country linked.
- [ ] Studio: picked stories open their story page.
- [ ] Remove dead links: `/weekly-markets` on `/today`, economy fallbacks, `?tab=economy`.

### L4 · Guard
- [ ] `quality/check_links.mjs` (pre-commit): fails on a hand-built route string outside `shared/lib/links.js`
      (ratchet on today's count, falls to zero).

### P · Pages
- [ ] B1 One Briefings page with read / weekly / present modes; carry over the weekly subscribe card and the
      daily share, copy, save controls.
- [ ] B2 Real 301s in the Worker: `/daily/:date` → `/briefings?date=`, `/weekly-brief` → `/briefings?mode=weekly`,
      plus the routes retired in decision 0017. Client redirects stay as a fallback. (Worker upload needs a yes.)
- [ ] B3 Weekly email button → the new address; saved "daily" items → the new address; sitemap and the
      Worker's page directory updated.
- [ ] T1 Map → "Read today's topics" link; Worker bot pre-render for `/today`.
- [ ] S1 Studio out of the nav; `plans/` gets the Studio redesign plan with its return criteria.
- [ ] E1 Economy dead links removed; FX box labelled.
- [ ] C1 Delete `useSystemsAnalysis`; one address for the countries list, the other redirects.
- [ ] Decision records for 2-5 (superseding 0016's /today wording only where needed, and 0017's client-only redirects).

### R · Release
- [ ] Website build; Cloudflare preview upload (yes); browser click-through of every page and link at desktop
      and phone width; production release (yes).
- [ ] Worker upload with the 301s and `/today` pre-render (yes).
- [ ] Open from the 2026-10-19 run: `newsPostLinkedin` deploy needs `--force` (operator runs it or says leave it).

## Data we still lack
No analytics in the repo. Three rulings could change with numbers: `/today` visits, email/search arrivals at
`/daily` and `/weekly-brief`, Studio use. Sources: GA4, Search Console, Worker logs for bot renders.
