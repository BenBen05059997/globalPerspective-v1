# 14. DeepSeek replaces Gemini; no fallback provider

Status: accepted
Date: 2026-09-27

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
