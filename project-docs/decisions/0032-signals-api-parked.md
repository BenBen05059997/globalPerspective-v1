# 0032. The Signals API is parked

Status: accepted (extends 0015's list of parked jobs)
Date: 2026-10-19

## Context
Decision 0001 ruled the signal API is not the product; 0015 left `newsSignals` running because the operator
wanted to rethink its algorithm first. On 2026-10-19 it still built daily (`TriggerSignalsBuild`,
`cron(0 10 * * ? *)` UTC, ENABLED, input `{"action":"build"}`), no API key had been issued
(`GlobalPerspectiveApiKeys`), and no page reads it.

## Decision
We will park the Signals API: disable `TriggerSignalsBuild` and keep the code, the Function URL and the key
table. Disabling the rule is a schedule change the coordinator runs with a fresh operator yes
(`aws events disable-rule --name TriggerSignalsBuild --region ap-northeast-1`).

## Consequences
- `runbooks/parked-jobs.md` lists the rule ("to be disabled" until the change is run, then DISABLED).
- Re-enabling is a product decision: `aws events enable-rule --name TriggerSignalsBuild`.
- The last `signals/latest.json` stays in S3 and goes stale; SERVE keeps answering any key minted later.

Source: `project-docs/plans/PLAN_2026-10-19_linking_and_pages.md` ("Backlog": Signals API; operator 2026-10-19).
