# 11. Track record stays lean and sampled; the Studio stays a page

Status: accepted
Date: 2026-09-25

## Context
A fact pass found all 122 scored forecasts came from one July week and nothing had been scored in
about two months, so a "track record" could never be current. The Analysis Studio's role was also
in question. Three advocates and two critics debated; the operator approved the ruling ("i like
your recommendation").

## Decision
We will:
- T1 keep the track record page, lean and honest, ledger first;
- T2 score a random sample of forecast questions (one trigger per forecast);
- T3 score with a weekly operator/agent run plus deterministic checks, with an alarm either way;
- S1 keep the Studio as a page (A-lite) with a public example;
- S2 make Studio permalinks unlisted and noindex by default, labelled when a reader's own key
  generated the run.
S3 (fund DeepSeek or move jobs to another provider) stays the operator's business call.

## Consequences
- The scoring pipeline (per-question probability and named resolution source, weekly seeded
  sample, Monday operator settle-review) was built in Batch 4.

Source: `project-docs/archive/redesign-ux/_active/TRACK_RECORD_AND_STUDIO_RULING.md`;
`project-docs/archive/architecture/_active/TASK_2026-09-30_batch4_scoring_web_share.md`
