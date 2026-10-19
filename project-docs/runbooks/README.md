# Runbooks

One runbook per scheduled job or alert: Trigger / What it means / Check / Fix / Escalate, with a
"Last verified" date. Region `ap-northeast-1`. Schedules: `aws events list-rules` and
`aws scheduler list-schedules` (times UTC unless a runbook says Asia/Tokyo).

## The 8-hourly news cycle (UTC 04/12/20)
:15 [topic-selection](topic-selection.md) → :20 [selection-shadow](selection-shadow.md) → :25 [news-agent](news-agent.md); :35 [breaking-alert](breaking-alert.md)

## Daily and weekly AI jobs
[thread-analysis](thread-analysis.md) 04:40 · [systems-analysis](systems-analysis.md) 05:00 · [country-intelligence](country-intelligence.md) 05:15 · [drift-corrector](drift-corrector.md) 05:30 · [prediction-resolver](prediction-resolver.md) 10:30 · [source-audit](source-audit.md) Mon/Wed/Fri 11:30 · [daily-brief](daily-brief.md) 23:00 JST · [weekly-brief](weekly-brief.md) Sun 06:00 → [weekly-email](weekly-email.md) Sun 14:00

## Feeds and builders (no LLM unless noted)
[situation-ingest](situation-ingest.md) hourly (LLM) · [situation-tracker](situation-tracker.md) 30 min · [gdacs-ingest](gdacs-ingest.md) 20 min · [gdelt-conflict](gdelt-conflict.md) 6 h · [predictions-snapshot](predictions-snapshot.md) 30 min · [signals-build](signals-build.md) 10:00 · [markets-data](markets-data.md) hourly · [country-facts](country-facts.md) Mon 05:00 JST · [social-posts](social-posts.md) every 3 h JST

## Monitors and alerts
[freshness-monitor](freshness-monitor.md) · [error-digest](error-digest.md) · [model-guard](model-guard.md) · [alarms](alarms.md) · [parked-jobs](parked-jobs.md)

## Procedures
[DEPLOYMENT_NOTES](DEPLOYMENT_NOTES.md) (frontend release) · [DOMAIN_SETUP](DOMAIN_SETUP.md) · [BUG_PLAYBOOK](BUG_PLAYBOOK.md) · [AGENT_REVIEW_METHOD](AGENT_REVIEW_METHOD.md) · [ANALYTICS_GUIDE](ANALYTICS_GUIDE.md) · [DEEPSEEK_COST_ESTIMATE](DEEPSEEK_COST_ESTIMATE.md)
