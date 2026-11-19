# Frontend fixtures

## `world.json`

A hand-made map bundle (`world/latest.json`, the object the map/home fetches; field meaning: `project-docs/architecture/DATA_STRATEGY.md`
§5), refreshed 2026-11-19 from the live shape. **Local dev only:** `npm run dev:fixture` serves it at `/data/world/latest.json` (the same
dev-server plugin as `record-views/`, `vite.config.js`); its dates move with the record-views fixture and its `generated_at`,
`next_expected_at` and source times are now. The build never loads it. Production reads the tracker's real bundle through the Worker's
`/data/*` route.

It covers: one story with two alerts in two countries (`thread-fixture-harbour-plan`, NZL and AUS: one situation per country and story);
a merged situation whose `threadId` is the latched oldest story (`thread-fixture-freight-rates`) while its label and `leadThreadId` are
today's heaviest story (`thread-fixture-ferry-route`); an alert whose story has no step in the last 24 h (`thread-fixture-port-strike`,
not a key of `index/today.json` `stories`); and an official disaster alert with no story (`gdacs#FL#9000001`). `ranked[].href` links the
`leadThreadId`, as the tracker now does. Every label starts with "Fixture".

## `record-views/`

A hand-made set of record views (`/data/record/views/*`, the files `newsStoryRecord` writes) for checking the story page
and the Stories list with no network. **Local dev only:** `npm run dev:fixture` (`vite --mode fixture`) adds a dev-server
plugin (`vite.config.js`, `apply: 'serve'`) that answers `/data/record/views/*` from this folder; a file not here is a
404. Every date in a file is moved by the days from `manifest.json` `factsThrough` to today, and the manifest's
`builtAt` is now, so the stories stay fresh. The build never loads the plugin or these files.

Open `/weekly/thread/thread-fixture-harbour-plan`: an entry of each `role` (start, move, measure), a written-late
entry (0061), a placed article row, an entry merged in from `thread-fixture-harbour-union` (alias view), and judged
links in both directions (`thread-fixture-port-strike` feeds in, `thread-fixture-freight-rates` is fed into; that one
has no analysis, so Read in full shows its plain timeline list). `index/today.json` is today's edition placed in its stories (`storyId`, `role`, `stories` cards, `latest.roles`): the latest
run holds a move with a watch question (harbour plan, 6 steps), a one-step start (`thread-fixture-lighthouse`), a start and a move of one
story in the same run (`thread-fixture-ferry-route`: a start whose story has 2 steps), a measured change that is its story's only step
(`thread-fixture-cargo-volumes`, so its first step is not a start) and an item no story view holds (no chip); an earlier run holds a move
with no watch question (freight rates). The story files of those ids are here, so "Open the story" works. Every headline starts with "Fixture" and is test text,
not news. `src/features/threads/__tests__/recordViewsFixture.test.js` checks every file against the schemas in
`backend/record/newsStoryRecord/schema/views/`.
