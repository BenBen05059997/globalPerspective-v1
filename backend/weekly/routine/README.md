# analyst-weekly cloud routine

Repo source for stage 6 (Views): the routine writes the Week view in S3 `weekly/` only. It reads through `backend/shared/src/world/` until timeline views exist; it does not write the timeline, record or board. See [the pipeline and one-writer contract](../../../project-docs/architecture/ARCHITECTURE_TIMELINE.md) §1b and §5 and [weekly commands](../README.md).

`routine.json` is the complete desired routine definition, including the exact standalone prompt. Model: `claude-sonnet-4-6` (the operator's explicit default; no other Sonnet id was pinned in the inspected repo docs). Cron `0 6 * * 0` means Sunday 06:00 UTC. The writing skill stops after checking; the routine authorizes a separate publish step after that stop. A failed check ends this run immediately, overriding the skill's repair loop.

## Coordinator setup and updates

Only the coordinator creates or changes the cloud routine, triggers, IAM user or keys, with operator authorization. Review and merge lane B before this lane, then use the routine management interface/API to create `analyst-weekly` from `routine.json` or update the existing routine with these same fields. Keep repository `BenBen05059997/globalPerspective-v1`, branch `main`, the exact prompt and model. If that interface accepts local time, convert Sunday 06:00 UTC explicitly and verify the next scheduled run in UTC. The repo does not prescribe an unverified provider API or CLI command. Record the routine identifier and inspect the saved definition and next run after applying it; avoid duplicate schedules.

Provision a fresh checkout at the repository root, Node, AWS CLI for the current pull transport, the frontend's installed `ajv` dependency for check, and `@aws-sdk/client-s3` resolvable from publish.mjs. Dependency provisioning belongs to the coordinator's environment setup, not the writing run. Verify the merged weekly scripts bind the current shared `sampledQuestions` and dated `webAt` contracts before enabling the schedule. This branch starts from lane B's integration work; these offline configuration tests do not prove a cloud run is ready.

## IAM and credentials

Dedicated IAM user: `gp-weekly-routine`, account `280362093938`, region `ap-northeast-1`. Attach exactly `iam-policy.json`, with no additional grants. The coordinator reports this user already exists; this lane creates no cloud resource. Policy effects:

- DynamoDB `GetItem`, `BatchGetItem`, `Query`, `Scan` on `NewsCache`, `SummarizeAndPredict`, `GlobalPerspectivePredictionLog` only.
- S3 `GetObject` on `globalperspective-world-280362093938/web/*` and `weekly/*`.
- S3 `PutObject` on that bucket's `weekly/*` only. Publication normally writes the dated snapshot and latest pointer; no delete permission.
- S3 `ListBucket` on that bucket with `s3:prefix` restricted to `web/*` and `weekly/*`, supporting missing-object detection without granting unrelated listing access.

Store credential values only in the routine environment's secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (`ap-northeast-1`). The JSON stores names only. Never commit keys or print their values in logs. The coordinator creates a dedicated replacement key for this user when rotation is authorized, saves it directly into those environment secrets, verifies the configured identity and scoped read access without exposing secrets, and disables/removes the old key after confirming the replacement works. Update both key values together; do not broaden permissions or trigger a publishing run merely to test rotation. On suspected exposure, the coordinator revokes the affected key and replaces the environment credentials before the next run.

## Sunday operation

At 06:00 UTC the routine pulls inputs, writes and checks the current UTC Sunday's draft, then publishes unless a step fails. Publishing creates `weekly/YYYY-MM-DD.json` with published status and advances `weekly/latest.json`. An identical retry can repair latest; a different snapshot for an existing week fails. Never run publish and hold concurrently.

The operator can veto before 14:00 UTC through the coordinator:

```sh
node backend/weekly/hold.mjs <weekEnding>
```

Use the actual Sunday date in place of `<weekEnding>`. Hold creates an immutable `weekly/YYYY-MM-DD.held.json` and moves latest back (or leaves a held latest if no earlier week exists). Once held, that week cannot be republished. At 14:00 UTC `newsEmailSender` handles delivery, skipping held, missing, already-sent or wrong-Sunday snapshots. The routine never sends email.

Open the cloud routine's run history for `analyst-weekly`, select the scheduled UTC timestamp, and read its stdout/stderr and final report. Confirm week, filled/empty sections, check output and actual S3 keys written. Do not infer success just from a run starting. Logs must contain no credential values.

If pull or check fails, nothing publishes and the old week stays in `weekly/latest.json`; the sender skips it because it is not this Sunday's. Preserve the check output for the coordinator, who fixes the source issue through normal review before an authorized retry. A publish failure can leave the dated snapshot written before latest failed: inspect the report and use the publisher's identical retry behavior, never manually overwrite or delete a snapshot. Respect operator holds.

## Offline verification

```sh
node --test backend/weekly/routine/test/*.test.mjs
```

Tests validate configuration, referenced script paths, schedule, safety instructions and the exact policy grant boundary. A committed fixture preserves the coordinator's approved policy for portable comparison. To additionally compare the current mailbox artifact, set `WEEKLY_LIVE_POLICY` to its absolute path when running the tests. No test invokes AWS or a routine.
