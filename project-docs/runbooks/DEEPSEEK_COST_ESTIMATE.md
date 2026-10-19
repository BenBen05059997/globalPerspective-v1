# DeepSeek cost estimate (per job)

Last verified: 2026-10-19 (balance from the `newsModelGuard` log; deployed zips checked with `scripts/lambda.sh diff`).
Figures below are measured from `[usage]` log lines; the 2026-10-05 per-job estimate was dropped.
DeepSeek's usage page (platform.deepseek.com) is the real bill; check it against this.

Prices used (api-docs.deepseek.com pricing page, fetched 2026-10-04), per 1M tokens, off-peak / peak:

| Model | Input (cache hit) | Input (cache miss) | Output |
|---|---|---|---|
| deepseek-flash | $0.003 / $0.006 | $0.15 / $0.30 | $0.60 / $1.20 |
| deepseek-v4-pro | $0.022 / $0.044 | $0.66 / $1.32 | $1.98 / $3.96 |

Peak = 01:00–04:00 and 06:00–10:00 UTC, Mon–Fri. Thinking mode is off on every news job.

## Update 2026-10-17

- Measured spend: the 2026-09-30 top-up lasted ~12 days → **~$0.75/day** for all callers. The balance ran out 2026-10-12 → 10-15 (all jobs failed); `newsModelGuard` now alerts below $3.
- Research job (largest cost, ~50–65%) changed to one grounded v4-pro call per story (was two): measured 59–65% of the old per-story cost on 13 live + 40 held-out stories (`predictions/forecast-ab/`).
- DeepSeek calls from the 10-17 deploys log `[usage] {...}` with real token counts (the measured table below).

## Measured 2026-10-18 (from `[usage]` log lines; a Sunday, so off-peak prices only)

| Job | $ on 10-18 (00:00–15:15 UTC) |
|---|---|
| Topic selection (`newsInvokeGemini-dev`) | 0.068 |
| Research + forecasts (`NewsProjectInvokeAgentLambda-dev`, grounded single call) | 0.060 |
| Story link webs (`newsSystemsAnalysis`) | 0.038 |
| Story scan (`newsSituationIngest`) | 0.031 |
| Country briefings (`newsCountryIntelligence`) | 0.023 |
| Thread analysis (`newsThreadAnalysis`) | 0.018 |
| Weekly brief (`newsWeeklyBrief`, Sundays) + daily brief (`newsPostDevTo`) | 0.011 |
| **Logged total** | **~0.25** (full day ≈ $0.33–0.38) |

Not logged yet (their deployed zips print no `[usage]` line): `newsDriftCorrector`, `newsSourceAudit`, `newsPredictionResolver`, Studio (`newsAnalyze`). `newsBreakingAlert` makes no LLM call. Weekday peak hours (01–04, 06–10 UTC) cost 2×. Balance 2026-10-18 15:23 UTC: $0.49 (`newsModelGuard` alerting below $3).

Not counted:
- **Studio** (`newsAnalyze`): each member analysis adds its own cost.
- **PPA project** (`PPAfetchMarketNews-dev` 12/day, ward-profile jobs): uses a separate DeepSeek key.
  If both keys sit on one DeepSeek account, that spend shows on the same bill.
- Parked jobs (economy, impact audit, pair intel, weekly markets): crons disabled.

## How to re-measure

- Per job: CloudWatch Logs Insights over the `[usage]` lines, summing `prompt_tokens` / `completion_tokens` by `fn`.
- Story scan log line: `[ingest] N already classified, M new` and `classified M new in K LLM calls` (expect K = 1–2 after the first run).
- Research job log line: `Generation complete: X generated, Y reused`; reuse lines read `Reused <kind> for <id> from same-title <id>`.
- Invocations per job: CloudWatch `AWS/Lambda` `Invocations`, period 86400.
- Real spend: DeepSeek usage page, split by API key and model.
