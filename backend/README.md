# backend

The AWS Lambdas (region ap-northeast-1) behind globalperspective.net, grouped by job. Each group has a README with its
Lambdas, schedules, stores and pipeline.

## Groups

- [pipeline](pipeline/README.md): fetches and analyses the news, and writes the topics, threads and country records.
- [situations](situations/README.md): ingests disaster and conflict feeds and tracks ongoing situations for the map.
- [predictions](predictions/README.md): snapshots, resolves and scores the forecasts behind the track record.
- [distribution](distribution/README.md): daily and weekly briefs, subscriber email, breaking alerts, social posts.
- [read-api](read-api/README.md): what the browser calls: the content proxy, saved items, preferences, shares, error reports.
- [membership-studio](membership-studio/README.md): the member Analysis Studio run and Polar billing.
- [monitoring](monitoring/README.md): alerts to the operator on freshness, errors, model health and summary drift.
- [economy-parked](economy-parked/README.md): economy features, parked; only market data collection still runs.
- [shared](shared/README.md): helper modules several Lambdas use. Not a Lambda.

## A Lambda folder

- `backend/<group>/<name>/src/` holds the deployed code (`index.js`, `package.json`).
- `src/_shared` is a committed symlink to `backend/shared/src`; the deploy script zips it as real files.
- Tests sit in `test/` beside `src/` (a few keep a test script inside `src/`). Each folder has its own `README.md`.
- The folder name and the deployed name can differ (for example `newsInvokeGemini` is deployed as `newsInvokeGemini-dev`).

## Deploying

- `scripts/functions.json` maps each deployed name to its folder, runtime, schedules and whether the zip ships `node_modules`.
- `scripts/lambda.sh <name> diff` compares the live zip with the repo. Always run it first.
- `scripts/lambda.sh <name> deploy` uploads, and needs the operator's go-ahead (see `CLAUDE.md`). `package` and `rollback` also exist.
- Live AWS wins over the repo and over `functions.json`; check the live function before trusting either.

## Storage rule

S3 for the world, DynamoDB for the user: what the pipeline computes about the world is a JSON object in S3; what a person owns or pays for is a DynamoDB row (`project-docs/architecture/DATA_STRATEGY.md`).

Last verified: 2026-10-20 against code @14dd450d and live AWS.
