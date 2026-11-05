# backend

The AWS Lambdas (region ap-northeast-1) behind globalperspective.net, grouped by job. Each group has a README with its
Lambdas, schedules, stores and pipeline. `scripts/functions.json` lists 38 entries (five are `deployBlocked`: `newsAnalyze`, the two `-sandbox` twins, `newsSensitiveData-dev` and `newsPostDevTo`; the `NewsProjectInvokeAgentLambda-dev` and `newsInvokeGemini-dev` twins were deleted 2026-11-05); live AWS is the truth for
what exists and what runs (`aws lambda list-functions`, `aws events list-rules`, `aws scheduler list-schedules`).

## Groups

- [pipeline](pipeline/README.md): fetches and analyses the news, and writes the topics, threads and country records. Its Lambdas also write the daily model notes into the record.
- [situations](situations/README.md): ingests disaster and conflict feeds and tracks ongoing situations for the map.
- [predictions](predictions/README.md): draws the weekly sample and settles the forecasts behind the track record.
- [distribution](distribution/README.md): daily and weekly briefs, subscriber email, breaking alerts, social posts.
- [read-api](read-api/README.md): what the browser calls: the content proxy, saved items, preferences, shares and error reports.
- [membership-studio](membership-studio/README.md): Polar billing, and the retired Analysis Studio Lambda (no page calls it).
- [monitoring](monitoring/README.md): alerts to the operator on freshness, errors, model health and summary drift.
- [record](record/README.md): the world's memory: daily facts, weekly readings, the notes the Lambdas write, and the static views the pages read.
- [board](board/README.md): the personal board of a signed-in member.
- [shared](shared/README.md): helper modules several Lambdas use. Not a Lambda.

How the groups connect: [ARCHITECTURE.md](../project-docs/architecture/ARCHITECTURE.md) and [ARCHITECTURE_TIMELINE.md](../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

## A Lambda folder

- `backend/<group>/<name>/src/` holds the deployed code (`index.js`, `package.json`).
- `src/_shared` is a committed symlink to `backend/shared/src`; the deploy script zips it as real files.
- Tests sit in `test/` beside `src/` (a few keep a test script inside `src/`). Each folder has its own `README.md`.
- The folder name and the deployed name can differ (for example `newsInvokeGemini/` is deployed as `newsIngest` and `NewsProjectInvokeAgentLambda/` as `newsAgent`).
- Operator tools that run from a laptop sit in a group's `cli/` folder (`pipeline`, `distribution`, `record`), not in a Lambda.

## Deploying and storage

Deploy rules (`scripts/lambda.sh <name> diff` first, `deployBlocked` entries, env as a second surface) are in [CLAUDE.md](../CLAUDE.md); `scripts/functions.json` maps each deployed name to its folder, runtime, schedules and whether the zip ships `node_modules`. Storage rule (S3 for the world, DynamoDB for the user): [DATA_STRATEGY.md](../project-docs/architecture/DATA_STRATEGY.md).
