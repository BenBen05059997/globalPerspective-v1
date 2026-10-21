# Local record dry run: October 19–20, 2026

Executed with live read-only DynamoDB/S3 inputs on October 20 UTC (October 21 JST), `--no-llm`, and consecutive local shadow state at `/Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/`. AWS writes, model calls, deployment, merge/split and push: **zero**. These are local artifacts, not published record data.

## Results

| Metric | 2026-10-19 | 2026-10-20 |
|---|---:|---:|
| Stories attempted / processed | 267 / 267 | 267 / 267 |
| Retained archive entries in 30-day window | 727 | 741 |
| Records initialized | 267 | 0 |
| Stories born on the run date | 16 | 0 |
| Proposed duplicate merges | 1 | 1 (same pair) |
| Forks | 546 | 546 |
| Branches | 4,521 | 4,521 |
| Late branches | 94 | 106 |
| Verdicts mirrored | 0 | 0 |
| Index size, KB (1024 bytes) | 89.89 | 89.86 |
| Gzipped index size, KB | 19.14 | 19.15 |
| Planned chapter / trigger / line calls | 28 / 1,265 / 267 | 6 / 380 / 267 |
| Planned total calls | 1,560 | 653 |
| Actual calls / story failures | 0 / 0 | 0 / 0 |

October 19 is a cold bootstrap, including retained forks and drift notes. October 20 uses the preceding run's drift window (inclusive for recovery). No-LLM lines stay empty and branches never receive model-generated closure, so the second day's estimates are conservative; they do not describe a normal run after a successful LLM-enabled first day. The coordinator must review bootstrap cost and runtime settings before the cloud shadow week. No dollar cost is asserted without an approved model and measured tokens.

## Duplicate proposal and evidence

Both runs propose only:

- From `thread-deadly-fire-at-canadian-milita-bf3dd0` into the older `thread-deadly-fire-at-canadian-milita-6822c0`.
- Shared actor `mark carney`; country `CAN`.
- NPR (`npr.org`): “Carney says 4 service members killed and dozens injured in fire at Alberta military base”.
- The Guardian (`theguardian.com`): “Four people killed in ‘violent, fast-moving’ fire at Canadian military base”.
- Younger birth: `2026-10-18T20:26:20.508Z`.
- October 19 cutoff: `2026-10-19T23:59:59.999Z`; October 20 cutoff: the injected current UTC clock `2026-10-20T15:17:55.084Z`. The younger story remains within 48 hours at both cutoffs; it would leave that window later on October 20.

No story was dropped, merged, aliased or split. Full proposal evidence is retained in each report/index JSON.

## Coverage and source limitations

- October 19 archive window: September 20–October 19; 19 present days. Missing: September 20–29 and October 14.
- October 20 window: September 21–October 20; 20 present days. Missing: September 21–29 and October 14.
- Both runs: 23 distinct source domains; 65/267 stories have an as-of analysis, 202 do not; no history fallback was available for those missing analyses. Analysis source dates range October 1–19. Forty-eight bootstrap births are explicitly window-limited. Every birth remains bounded by retained input history, including those without the window-limited flag.
- Both runs: 184 branches lack trigger probability and 184 lack a named resolution source; none lack a due date. Probability remains null rather than borrowing scenario probability. Canonical world reads reach older PRED rows without threadId through archive topic IDs, which accounts for additional forks/gaps compared with the obsolete baseline.
- October 20 archive exists. Its 14 entries repeat October 19 topicIds/generation `gen-1792440950003`, as the coordinator's upstream audit found. They are captured as actual archival observations, with their real collection time and provenance. This lane does not rewrite raw rows or pretend the archive is missing. Publication time is unavailable in those old rows; collection time is not event occurrence time.
- October 19 web source: `2026-10-19T23:41:32.912Z`; October 20 dated web source: `2026-10-20T05:00:21.595Z`. Forecasts and analysis remain as of October 19. A present archive alone does not prove the entire upstream pipeline is fresh.
- No chapters, fired/dead judgments or prose lines were invented. Reports explicitly mark skipped model work `not run: no llm`. Deterministic late statuses remain available. Verdict/resurrection/correction behavior is exercised by fake-model tests; no live verdict was available to mirror.
- Bounded birth, prose-only expected-path changes, positional forecast identity and expiring sources are documented in the Lambda README. The earlier full-scan/local-parser baseline is quarantined under `baseline-local-reader-2026-10-19/`; it is not the final result and contains known actor schema failures.

## Validation

`validate-local.mjs` uses shared s3json and the runtime's own projections. Final validation passes for **801 story objects** (534 dated snapshots and 267 latest views) and **3 indexes** (both retained daily copies and the final pointer): no schema errors, exact story reconstruction from saved cursors, exact index reconstruction, and exact corrections reconstruction. Timeline: **6,940 unique events across 20 UTC days**; duplicate event IDs: zero. Live corrections: zero.

Reproduce without network or writes:

```sh
FRONTEND_NODE_MODULES=/Users/benlai/Downloads/globalPerspective-v1/global-perspectives-starter/frontend/node_modules node backend/record/newsStoryRecord/validate-local.mjs --out /Users/benlai/Downloads/gp-mailbox/artifacts/record-dryrun/
```

Artifact files: `input-2026-10-19.json`, `input-2026-10-20.json`, `report-<date>.json`, `index-<date>.json`, `validation.json`, and all would-be objects under `record/shadow/`. Rerunning an already completed date reports zero new work; preserve the original reports when auditing first-run call estimates.
