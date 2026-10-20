# situations

The map's data group. It ingests disaster alerts and world news, folds them into open situations, and publishes one bundle
for the home map. It serves readers of the home page. Two of the Lambdas also leave raw data for audits and other jobs.

Timeline: writes no timeline events yet; future source of `situation` events; the map becomes the Map view later. See [ARCHITECTURE_TIMELINE.md](../../project-docs/architecture/ARCHITECTURE_TIMELINE.md).

## Architecture

| Lambda (deployed name) | What it does | Trigger (live) | Reads | Writes | README |
|---|---|---|---|---|---|
| newsGdacsIngest | Fetches the GDACS disaster list and writes the current events and an Orange/Red snapshot. | Rule `TriggerGdacsIngest`, rate(20 minutes), ENABLED | gdacs.org events API | S3 `corpus/gdacs/latest.json`, `situations/inbox/gdacs-latest.json` | [link](newsGdacsIngest/README.md) |
| newsSituationIngest | Fetches RSS feeds, classifies headlines with an LLM, clusters them into stories, keeps the significant ones. | Rule `TriggerSituationIngest`, rate(1 hour), ENABLED | RSS hosts; DeepSeek endpoint; S3 `stories/index.json`, `stories/classify-cache.json` | S3 `corpus/YYYY/MM/DD/HH.jsonl`, `stories/state/`, `stories/index.json`, `stories/classify-cache.json` | [link](newsSituationIngest/README.md) |
| newsSituationTracker | Folds GDACS and news stories into situation state and builds the map bundle. | Rule `TriggerSituationTracker`, rate(30 minutes), ENABLED | S3 `situations/inbox/gdacs-latest.json`, `stories/index.json`, `threads/story-map.json`, own state | S3 `situations/state/`, `situations/index.json`, `situations/history/`, `situations/archive/`, `world/latest.json` | [link](newsSituationTracker/README.md) |
| newsGdeltConflict | Aggregates GDELT material-conflict events by country into a daily file. No LLM. | Rule `TriggerGdeltConflict`, cron(0 */6 * * ? *) UTC, ENABLED | data.gdeltproject.org latest export | S3 `corpus/gdelt/<date>.json` | [link](newsGdeltConflict/README.md) |

## Pipeline

1. Every 20 minutes newsGdacsIngest writes the GDACS snapshot to the situations inbox.
2. Every hour newsSituationIngest classifies new headlines and writes the stories and the story index.
3. Every 30 minutes newsSituationTracker reads the snapshot, the story index and `threads/story-map.json` (written by NewsProjectInvokeAgentLambda-dev in the pipeline group).
4. It opens, raises, spreads, cools and closes situations, archives closed ones, and writes `world/latest.json`.
5. The Cloudflare Worker serves `/data/world/*.json`, `/data/situations/state/*.json` and `/data/stories/state/*.json` from the private world bucket. Other prefixes are refused.
6. The home page `/` fetches `world/latest.json` (hook `useWorld`) and a situation's state file when one is opened. This path does not use the API proxy.
7. newsGdeltConflict runs separately every six hours. Its file is read by newsImpactAudit, not by the map.
8. The corpus files from steps 1 and 2 are read by newsSelectionShadow (pipeline group) and newsImpactAudit (monitoring group).

## Shared code

- `situations-core.js`: newsGdacsIngest and newsSituationTracker. `links.js`: newsSituationTracker. `llm.js`: newsSituationIngest.
- newsSituationIngest's `classifier-core.js` is also linked into newsSelectionShadow.
- newsGdeltConflict has no `_shared` link.

## Known limits

- The tracker writes to `shadow/situations/` and `world/shadow/` unless env `DRY_RUN` is exactly `false`. The live value is `false`.
- newsImpactAudit, the reader of the GDACS and GDELT corpus, has its schedule `TriggerImpactAudit` DISABLED.
- newsGdeltConflict samples one 15-minute export per run, and the last run of the day overwrites the day file.
- newsGdacsIngest and newsGdeltConflict no longer write DynamoDB; some header comments and env names in their code are stale.
- newsSituationIngest returns without fetching if its LLM key is unset. GDELT queries inside it are off unless `GDELT_ENABLED=true`.
- Situation titles and classifications are model-written; the lede is templated.

## How to check it

    aws events list-rules --region ap-northeast-1 --query 'Rules[?contains(Name,`Gdacs`)||contains(Name,`Situation`)||contains(Name,`Gdelt`)].[Name,State,ScheduleExpression]' --output text
    aws s3 ls s3://globalperspective-world-280362093938/world/ --recursive | head -3
    aws lambda get-function-configuration --region ap-northeast-1 --function-name newsSituationTracker --query 'Environment.Variables.DRY_RUN'

Last verified: 2026-10-20 against code @14dd450d and live AWS.
