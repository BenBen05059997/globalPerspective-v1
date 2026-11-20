# 14. DeepSeek replaces Gemini; no fallback provider

Status: accepted (the "no fallback provider" rule amended by 0059; the models moved to Claude by 0060; the "four high-leverage calls on Pro" consequence partly superseded by 0056)
Date: 2026-09-27
Amended 2026-11-15: decision 0059 adds Anthropic as a second provider (chosen per job by the model value); the "no fallback provider" rule above no longer holds. DeepSeek stays supported.
Amended 2026-11-17: decision 0060 moved all twelve model-calling jobs to Claude on 2026-11-16 (Haiku 5.5 or Sonnet 5.5 per job, set by env value; 0056 had moved four jobs to Flash first). So the consequence "four high-leverage calls on `deepseek-v4-pro`" no longer holds. The DeepSeek provider code stays as the way back.

## Context
Story analysis ran on Gemini 2.5 Flash; most other jobs ran on DeepSeek. The AI pipeline had been
dark since 13 Sep because of the third DeepSeek balance lapse since July.

## Decision
We will replace Gemini with DeepSeek (operator: "gemini is not that good and we should use flash
deepseek instead of gemini"): story analysis moves to DeepSeek, the Gemini judges are parked with
economy, and the source audit goes to flash. We will not add a fallback provider (D2c); the
planned protection was a prepaid buffer (B1) plus a balance alarm (D6m, which the operator later
declined on 2026-09-29).

## Consequences
- Batch 2 moved the four high-leverage calls (topic selection, daily brief, weekly brief, story
  forecast) to `deepseek-v4-pro`.
- A DeepSeek balance lapse stops the AI pipeline; GDACS and other non-LLM feeds keep running.
- Env names `GROK_*` / `XAI_*` hold DeepSeek settings; read the live env, not the name.

Source: `git show a5c0de8:project-docs/plans/BACKEND_PLAN_2026-09-27.md` (deleted 2026-10-19) (Decisions);
`git show 120de90:project-docs/archive/architecture/_active/TASK_2026-09-29_batch2_models.md` (deleted 2026-10-19); `CLAUDE.md`
