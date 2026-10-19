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
| [0009](0009-economy-parked.md) | 2026-09-25 | Economy is parked | accepted |
| [0010](0010-country-view-split.md) | 2026-09-25 | The country view is split by job | accepted |
| [0011](0011-track-record-and-studio.md) | 2026-09-25 | Track record lean and sampled; Studio stays a page | accepted |
| [0012](0012-story-web-is-news-based.md) | 2026-09-25 | A story's web is its own news; "judged to feed into", never "caused" | accepted |
| [0013](0013-ds1-design-system-tier-never-a-colour.md) | 2026-09-26 | DS1: hue = crisis type; risk tier is never a colour | accepted (hues amended by 0022) |
| [0014](0014-deepseek-replaces-gemini-no-fallback.md) | 2026-09-27 | DeepSeek replaces Gemini; no fallback provider | accepted |
| [0015](0015-park-jobs-that-feed-nothing-shown.md) | 2026-09-28 | Park scheduled AI jobs whose output no page shows | accepted |
| [0016](0016-map-console-is-home.md) | 2026-10-01 | The map console is the home page | accepted |
| [0017](0017-retired-routes-and-tours.md) | 2026-10-01 | /breaking and /weekly-markets redirect; guided tours removed | accepted |
| [0018](0018-spider-demo-retired-into-stories-web.md) | 2026-10-02 | /spider-demo retires into the Stories WEB view | accepted |
| [0019](0019-frontend-hosting-two-worker-cloudflare.md) | 2026-10-05 | Hosting moves to Workers Static Assets behind the existing Worker | accepted (not cut over) |
| [0020](0020-editorial-selection-done-not-said.md) | 2026-10-18 | Story selection counts things done, not things said | accepted |
| [0021](0021-rules-reset-code-is-truth.md) | 2026-10-19 | Rules reset: code and live AWS are the truth | accepted |
| [0022](0022-crisis-hues-option-a.md) | 2026-10-19 | Crisis hues re-picked (option A) | accepted |
| [0023](0023-radar-one-sweep-12h-window.md) | 2026-10-19 | Radar: one sweep, happening now = 12 h, max 5 | accepted |
| [0024](0024-feature-public-api-and-lambda-grouping.md) | 2026-10-19 | Feature index.js public API; Lambdas grouped by feature | accepted |
| [0025](0025-docs-storage-layout.md) | 2026-10-19 | How documentation is stored | accepted |
