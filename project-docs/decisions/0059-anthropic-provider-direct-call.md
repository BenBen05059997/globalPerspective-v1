# 59. Anthropic is a second model provider, called directly; the provider is a prefix on the model value

Status: accepted (operator decision 2026-11-15); amends 0014 ("no fallback provider"); relates to 0056.
Date: 2026-11-15

Code: built and committed on a branch. Not yet done: deploy, any env change, any Lambda switched to Claude. DeepSeek is the live provider until the operator switches a job.

## Context
- DeepSeek ran out of credit on 2026-11-14 and news intake stopped (the third balance lapse; see 0014).
- On 2026-11-15 the operator decided to add Anthropic as a provider and run on Claude Haiku 5.5 first, to keep DeepSeek fully working because it may be used again, and to make switching provider easy, because other providers may come.
- The Lambdas ship without `node_modules` (`"nodeModules": false` in `scripts/functions.json` for most of them), so the official SDK would mean a new dependency in every zip.

## Decision
1. **Anthropic is a provider in the shared client** (`backend/shared/src/llm.js`). It calls `POST https://api.anthropic.com/v1/messages` with the global `fetch`, no SDK and no new dependency (the operator chose the direct call over the SDK). The key is env `ANTHROPIC_API_KEY`. Each provider reads only its own key: a DeepSeek key (`XAI_API_KEY`) is never sent to Anthropic, and the Anthropic key is never sent to DeepSeek.
2. **The provider is a prefix on the model value.** `anthropic:claude-haiku-5-5` selects Anthropic; the prefix is stripped before the request and in the `[usage]` log. Only a known provider name counts as a prefix. A bare model name behaves as before: provider `deepseek`, or the caller's explicit `provider` for `openrouter`, `gemini` and `other`. A job's provider is therefore one env value (`GROK_MODEL`, `PREDICTION_MODEL`, `REVIEW_MODEL`, `AUDIT_MODEL`, `DRAFT_MODEL`), a Lambda can mix providers per step, and a new provider is one table entry. Reversal to DeepSeek is the same one env value, as in 0056.
3. **`chat()` keeps its contract.** Same options, same return `{content, model, usage, finishReason, latencyMs, raw}`, same errors (`LLM <status>: <message>`, `LLM timeout after <ms>ms`), same transport retry (network, timeout, 429 and 5xx retried; other 4xx never).
4. **What the Anthropic path does differently, on purpose.**
   - `system` goes in the top-level `system` field. `maxTokens` is required by the API; a call without one gets 4096.
   - `temperature` and `topP` are accepted from callers and not sent: Haiku 5.5 and Sonnet 5.5 return 400 for non-default values.
   - Thinking is off unless the caller asks (it is on by default there and its tokens eat `max_tokens`, the same failure as the DeepSeek 2026-07-26 outage): `thinking: {type: "disabled"}` for Haiku, `between_tools` for Sonnet 5.5, which rejects `disabled`.
   - There is no schema-less JSON mode. With `json: true` the helper adds one sentence to the system text (a single JSON value only, no code fences, no commentary) and, if the answer still has prose around the JSON, cuts it down to the JSON in this one place. A truncated answer is returned as is, for the caller's own salvage.
   - `stop_reason` `end_turn` and `stop_sequence` become `finishReason` `stop`, `max_tokens` becomes `length`. `refusal` (HTTP 200) throws `LLM refusal (<category>)`.
   - Usage is mapped to the names the readers use (`prompt_tokens` including cache reads, `completion_tokens`, `prompt_cache_hit_tokens`), so `newsHealth` and `monitoring/ops.json` keep working. Haiku 5.5 and Sonnet 5.5 are in `backend/monitoring/newsHealth/src/prices.json`.
5. **`newsAgent` uses the shared client** instead of its own `fetch`. Its DeepSeek request is unchanged. It gains the shared timeout (180 s) and one transport retry. An empty answer now fails that story instead of storing the raw response body.

## Consequences
- This amends 0014: it said no fallback provider. There is still no automatic fallback; a job is moved by hand by changing its model env value. DeepSeek stays supported.
- Relation to 0056: its Flash-versus-Pro tests were not re-run for Claude. Haiku 5.5 is the first choice because the operator picked it, not because a recorded test chose it. Rule 1 of 0056 (a job's model is chosen by a recorded test) still applies; the tests for Claude are not yet done.
- Prompts were tuned for DeepSeek and are unchanged. Output shape, length and JSON discipline can differ on Claude.
- `newsModelGuard` reads only model ids that start with `deepseek-`, so `anthropic:...` values are ignored by it, and its DeepSeek balance check and email are unchanged. While DeepSeek stays below its threshold it keeps emailing; that is a separate choice.
- The `/ops` money panel still carries the key `deepseek`; Claude lines are priced into the same total.
- Not yet done: set `ANTHROPIC_API_KEY` on the Lambdas, change model env values, deploy the Lambdas, compare Claude output with DeepSeek's.
