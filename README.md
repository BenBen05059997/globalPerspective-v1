# Global Perspectives

AI-powered global-news intelligence platform — [globalperspective.net](https://globalperspective.net). The production frontend is currently GitHub Pages (`docs/`) behind Cloudflare's `globalperspective-rss` Worker; a Workers Static Assets migration is in progress but has not been deployed. Backend: AWS Lambdas (list: `scripts/functions.json`) + S3 + DynamoDB + Firebase Auth. Content is public; Polar membership buys following countries and deeper history (the Analysis Studio was retired 2026-10-20).

## Architecture

One record, two clocks. Facts (what happened) are appended daily with no model: raw articles are captured before the
model runs, entries are assigned to stories, and verdicts come back through inboxes. Readings (what it meant) are written
weekly with hindsight, cite the facts, and supersede earlier readings instead of editing them. Pages, the board and the
weekly report are views of that record, served as static JSON through the Worker; pages are moving over one at a time and some still read the old DynamoDB world rows (START_HERE says which). The ten-stage pipeline and the object model are in
`project-docs/architecture/ARCHITECTURE_TIMELINE.md`; the stage list as data is `project-docs/architecture/pipeline.json`;
what is stopped or waiting is in `project-docs/START_HERE.md`; what is deployed comes from AWS.

## Where to look

Start with [`CLAUDE.md`](CLAUDE.md) (rules, authorization, verify) and [`project-docs/START_HERE.md`](project-docs/START_HERE.md) (the doc map and where we left off). Code and deployed AWS beat any doc; `docs/` is build output, not source; there is no CI by design (local `quality/check_*.mjs` checks catch drift).
