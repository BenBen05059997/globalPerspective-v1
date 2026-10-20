# Pipeline alarm proposal

`spec.json` is a reviewable configuration proposal, not an installer. Lane G never creates filters, alarms, topics,
roles or subscriptions. Coordinator applies it after verifying deployed log groups/providers and notification routing.

The inventory maps `scripts/functions.json` deployed names to source imports of `_shared/llm` and direct completion
clients. It includes parked/blocked callers so a manually invoked legacy function is covered where its log group exists.
A model-name/balance guard is not itself a completion caller; selection shadow and the LinkedIn poster do not currently
call an LLM. A source-level inventory does not prove deployed zips match: verify those differences before applying.
The sensitive-data proxy currently calls an LLM only for a dead dossier route; remove its filter only after that route's
removal is deployed (G3). No secret values belong in this inventory.

Each active stage has an aggregate failed-run metric/alarm and per-Lambda native `Errors` alarms. Stage 4 is a shared
library, not a Lambda: explicit `stage4` failed-run attribution is REQUESTED from consumer owners, and native consumer
Errors covers uncaught failures meanwhile. Stage 5's proposed `newsStoryRecord` filter is held until its function/log
group is registered; the stage alarm alone cannot discover uninstrumented errors. Stage 6's cloud routine also needs
its own failed-publish/check signal from its runner, REQUESTED rather than a fabricated Lambda metric. Generic markers
use `[pipeline-status] ... failed`; add them to swallowed-error paths in other lanes before claiming full coverage.

Crucially, an async handler returning `{statusCode:503}` is a successful Lambda invocation. **Agent Errors alone misses
its empty/stale run.** Retain the marker metric on `/aws/lambda/NewsProjectInvokeAgentLambda-dev` as well as its native
Errors alarm. Native errors catch throws, timeouts and runtime failures; marker alarms catch recognized failed outcomes.
The 402 pattern includes `Insufficient Balance` because the agent's legacy error drops the numeric status. The two
patterns were validated on synthetic strings during lane D; coordinator should retest against the actual deployed log
format when creating filters. Filters only see newly ingested logs, not a retroactive backlog.

Capture success matches `[capture] ... chosen topics`, excluding capture-failed messages. The no-capture alarm fills
missing five-minute buckets with zero and requires 108 consecutive missing buckets (9h = 8h selector cadence +1h grace).
It is a dead-man switch, not an exact per-invocation deadline. FILL prevents an older sparse success from satisfying the
most recent missing-data window. Test an 8h normal cadence and a skipped run; seed with a real capture before enabling
actions. For a precise 30-min deadline coordinator should add a scheduled expected-run/last-success check to the selector
owner; lane G cannot alter pipeline code/schedules. Missing capture logs also detect the capture S3 write's caught failure.

All alarm actions use the proposed surviving topic **GlobalPerspectivesAlerts** (plural, existing email + chat). Its
ARN is in the JSON. Verify confirmed subscriptions and operator routing preference first. Migrate every monitor's
`SNS_TOPIC_ARN` (newsFreshnessMonitor, newsErrorDigest, newsModelGuard, newsSourceAudit, newsImpactAudit) by fetching and
merging the full env map without printing secrets; update narrow sns:Publish permissions and all old alarm actions.
Perform a coordinator-approved notification delivery check; then detach/retire GlobalPerspectiveAlerts (singular,
email-only) only after verifying no publishers/subscriptions are lost. No automatic topic deletion or new sends here.
The group README's old claim of one existing topic is inaccurate; this is a proposed consolidation.

Freshness transition state requires private S3 `monitoring/freshness/state.json` in the existing world bucket, env
`FRESHNESS_STATE_BUCKET`, GetObject/PutObject on that exact key (and required KMS permissions if bucket encryption needs
them). Do not grant ListBucket or a public Worker route. Existing marker state remains across deploys and must not have
a short expiration rule. The monitor defaults to 9h; audited live `STALE_HOURS` is 9 (not reconfigured by this branch).
Configure permissions/env before deployment; missing/inaccessible state fails loudly rather than reverting to spam.
One unhealthy notification and one recovery notification per incident, including repeated proxy failures; no healthy
startup message. Conditional S3 reservations suppress overlapping runs. SNS Standard plus S3 cannot guarantee exactly-once
across a crash after SNS acceptance but before delivered-state persistence: retries may repeat that transition id.
Persisted pending delivery retries after a 60s lease; SNS/state failure throws, so Errors alarms see it. `dryRun` touches
neither SNS nor state. Settle-check notifications keep their existing daily cadence and are separate from this dedupe.

Coordinator REQUESTS: all AWS changes above; pipeline.json/readme store-flow changes for the proposed marker; failed
markers/reader attribution from other stage owners; stage-5 registration; routine failure signal; and notification topic
migration. Nothing here enables user-facing sends or changes generated pipeline blocks.

References: [Lambda invocation errors](https://docs.aws.amazon.com/lambda/latest/dg/troubleshooting-execution.html),
[alarm missing data](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html),
[alarm evaluation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarm-evaluation.html).

Offline verification: `node --test backend/monitoring/alarms/spec.test.mjs`.
