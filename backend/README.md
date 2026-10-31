# backend

The AWS Lambdas (region ap-northeast-1) behind globalperspective.net, grouped by job. Each group has a README with its
Lambdas, schedules, stores and pipeline. `scripts/functions.json` lists 37 news Lambdas (two are `-sandbox` twins with their own deploy script); live AWS is the truth for
what exists and what runs (`aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`).

## Groups

- [pipeline](pipeline/README.md): fetches and analyses the news, and writes the topics, threads and country records. Its Lambdas also write the daily model notes into the record.
- [situations](situations/README.md): ingests disaster and conflict feeds and tracks ongoing situations for the map.
- [predictions](predictions/README.md): snapshots, resolves and scores the forecasts behind the track record.
- [distribution](distribution/README.md): daily and weekly briefs, subscriber email, breaking alerts, social posts.
- [read-api](read-api/README.md): what the browser calls: the content proxy, saved items, preferences, shares, error reports, and the parked Signals API.
- [membership-studio](membership-studio/README.md): Polar billing, and the retired Analysis Studio Lambda (no page calls it).
- [monitoring](monitoring/README.md): alerts to the operator on freshness, errors, model health and summary drift.
- [record](record/README.md): the world's memory: daily facts, weekly readings, the notes the Lambdas write, and the static views the pages read.
- [board](board/README.md): the personal board of a signed-in member.
- [weekly](weekly/README.md): the analyst's weekly: schema and section model (the scripts are not written yet); not a Lambda.
- [shared](shared/README.md): helper modules several Lambdas use. Not a Lambda.

## How the groups connect

The pipeline and the situations group collect and explain the news. `record` turns what they wrote into facts, readings and
views in S3, which the Worker serves to the pages. The read proxy in `read-api` still answers what the views do not hold yet.
The world DynamoDB tables (`NewsCache`, `SummarizeAndPredict`, the `PRED#` rows of the prediction log) are still written and
read until step 5 retires them; the design is in `project-docs/architecture/ARCHITECTURE.md` and `ARCHITECTURE_TIMELINE.md`.

## A Lambda folder

- `backend/<group>/<name>/src/` holds the deployed code (`index.js`, `package.json`).
- `src/_shared` is a committed symlink to `backend/shared/src`; the deploy script zips it as real files.
- Tests sit in `test/` beside `src/` (a few keep a test script inside `src/`). Each folder has its own `README.md`.
- The folder name and the deployed name can differ (for example `newsInvokeGemini` is deployed as `newsInvokeGemini-dev`).
- Operator tools that run from a laptop sit in a group's `cli/` folder (`pipeline`, `distribution`, `record`), not in a Lambda.

## Deploying

- `scripts/functions.json` maps each deployed name to its folder, runtime, schedules and whether the zip ships `node_modules`.
- `scripts/lambda.sh <name> diff` compares the live zip with the repo. Always run it first; a deployed zip can differ from the repo.
- `scripts/lambda.sh <name> deploy` uploads, and needs the operator's go-ahead (see `CLAUDE.md`). `package` and `rollback` also exist.
- A function marked `deployBlocked` in `functions.json` (`newsAnalyze` and the two sandbox twins) is refused by the script.
- Environment variables are a second deploy surface: fetch the full map, merge, write it back whole.
- Live AWS wins over the repo and over `functions.json`; check the live function before trusting either.

## Storage rule

S3 for the world, DynamoDB for the user: what the pipeline computes about the world is a JSON object in S3; what a person owns or pays for is a DynamoDB row (`project-docs/architecture/DATA_STRATEGY.md`).
