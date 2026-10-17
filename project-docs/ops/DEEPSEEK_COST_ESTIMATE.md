# DeepSeek cost estimate (per job)

Status: estimate, 2026-10-05. Run counts are measured from CloudWatch logs (2026-09-30 → 10-03).
Token counts and every $ figure are **estimated** from how each prompt is built: no job logs its
token use. DeepSeek's usage page (platform.deepseek.com) is the real bill; check it against this.

Prices used (api-docs.deepseek.com pricing page, fetched 2026-10-04), per 1M tokens, off-peak / peak:

| Model | Input (cache hit) | Input (cache miss) | Output |
|---|---|---|---|
| deepseek-flash | $0.003 / $0.006 | $0.15 / $0.30 | $0.60 / $1.20 |
| deepseek-v4-pro | $0.022 / $0.044 | $0.66 / $1.32 | $1.98 / $3.96 |

Peak = 01:00–04:00 and 06:00–10:00 UTC, Mon–Fri. Thinking mode is off on every news job.

## Update 2026-10-17

- Measured spend: the 2026-09-30 top-up lasted ~12 days → **~$0.75/day** for all callers. The balance ran out 2026-10-12 → 10-15 (all jobs failed); `newsModelGuard` now alerts below $3.
- Research job (largest cost, ~50–65%) changed to one grounded v4-pro call per story (was two): measured 59–65% of the old per-story cost on 13 live + 40 held-out stories (`predictions/forecast-ab/`).
- Every DeepSeek call now logs `[usage] {...}` with real token counts — replace the estimates below with a week of measured numbers (CloudWatch Logs Insights: filter `[usage]`, sum `prompt_tokens`/`completion_tokens` by `fn`).

## Before vs after the 2026-10-05 fixes ($/day, estimated)

```
                         before                          after
Story scan (hourly)      ███████████████  0.60–0.80      █  ~0.05
Research + forecasts     █████████  ~0.45                ████  ~0.15–0.25
Topic selection          ██  ~0.10                       ██  ~0.10
Story link webs          ██  ~0.09                       ██  ~0.09
Country briefings        █  ~0.07                        █  ~0.07
Thread analysis          ▌ ~0.03                         ▌ ~0.03
Everything else          ██  ≤0.10 total                 ██  ≤0.10 total
                         ─────────────────               ─────────────────
Total                    ~$1.3–1.6/day                   ~$0.5–0.7/day
                         (~$40–48/month)                 (~$15–21/month)
```
One █ ≈ $0.05/day.

## Per job

| Job (Lambda) | Model | Runs/day (measured) | Est. tokens per run | Before $/day | After $/day | Fix |
|---|---|---|---|---|---|---|
| Story scan (`newsSituationIngest`) | flash | 24 runs, ~288 calls | ~2.1k in / ~3k out per 35-article call | 0.60–0.80 | ~0.05 | Only new articles go to the model (`stories/classify-cache.json`) |
| Research + forecasts (`NewsProjectInvokeAgentLambda-dev`) | flash (summary, cause) + v4-pro (research, forecast) | 3 runs, ~110–130 items each | per story: flash ~2k in / 0.5k out; v4-pro ~4k in / 1.2k out | ~0.45 | ~0.15–0.25 | Same-title reuse: forecast + research once per story per day |
| Topic selection (`newsInvokeGemini-dev`) | v4-pro | 3 | ~30k in / ~6.5k out (output measured) | ~0.10 | ~0.10 | none |
| Story link webs (`newsSystemsAnalysis`) | v4-pro | 10 webs | ~6k in / ~2.5k out each | ~0.09 | ~0.09 | none |
| Country briefings (`newsCountryIntelligence`) | v4-pro | 3–11 | ~8k in / ~3k out each | ~0.07 | ~0.07 | none |
| Thread analysis (`newsThreadAnalysis`) | flash | 10 | ~8k in / ~3k out each | ~0.03 | ~0.03 | none |
| Resolver, daily brief, drift notes, source audit, weekly brief | mostly v4-pro, small caps | 1 each | small | ≤0.10 total | ≤0.10 total | none |

Not counted:
- **Studio** (`newsAnalyze`): 0 runs in the week measured. Each member analysis adds its own cost.
- **PPA project** (`PPAfetchMarketNews-dev` 12/day, ward-profile jobs): uses a separate DeepSeek key.
  If both keys sit on one DeepSeek account, that spend shows on the same bill.
- Parked jobs (economy, impact audit, pair intel, weekly markets): crons disabled.

Cross-check: balance went $9.11 → $8.54 in ~7.5 h on 2026-09-30 (incl. ~$0.25 of tests), which fits ~$1.3–1.6/day.

## How to re-measure

- Story scan log line: `[ingest] N already classified, M new` and `classified M new in K LLM calls` (expect K = 1–2 after the first run).
- Research job log line: `Generation complete: X generated, Y reused`; reuse lines read `Reused <kind> for <id> from same-title <id>`.
- Invocations per job: CloudWatch `AWS/Lambda` `Invocations`, period 86400.
- Real spend: DeepSeek usage page, split by API key and model.
