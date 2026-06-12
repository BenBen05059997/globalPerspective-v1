# Backend Migration — `deepseek-chat` → `deepseek-v4-flash`

**Status:** ⚠️ **ATTEMPTED config-only migration 2026-06-12 → REGRESSED → REVERTED.**
All 9 are back on `deepseek-chat` (known-good, verified `0 failed`). A correct
migration needs a **code change** (see §3, rewritten). **Deadline:** the
`deepseek-chat`/`deepseek-reasoner` aliases **retire 2026-07-24** — after that any
Lambda still set to them fails (silently — caught parse/throw, 0 CloudWatch errors;
only [[project-freshness-monitor]] would catch it, like the Grok-credit exhaustion).
See [[project-ai-provider-migration]]. ~6 weeks of runway; prod is safe meanwhile.

## 0. What we learned the hard way (2026-06-12)

A plain env swap `deepseek-chat → deepseek-v4-flash` **broke** the JSON-producing
Lambdas: `newsEconomicImpact` went from `0 failed` (Jun 9–11 baseline) to `5 failed`
with "Failed to parse LLM response: Unterminated string in JSON". Root cause: the V4
model IDs are **dual-mode and default to THINKING ON**, which emits `reasoning_content`
and changes output/token-budgeting → broken JSON. The legacy `deepseek-chat` alias is
specifically the **non-thinking** variant.

Verified by direct API test:
- `deepseek-v4-flash` (no param) → `reasoning_content` present (thinking ON).
- `deepseek-v4-flash` + body `"thinking": {"type": "disabled"}` → `reasoning_content`
  absent, clean `content` — the true equivalent of `deepseek-chat`.

So the correct target is **`deepseek-v4-flash` + `thinking:{type:'disabled'}` in the
request body** — a CODE change in each Lambda's DeepSeek call, not just an env var.
Reverted immediately; prod restored to baseline.

## 1. Why

DeepSeek's API surface changed: the only current model IDs are **`deepseek-v4-flash`**
(fast/cheap) and **`deepseek-v4-pro`** (strongest). `deepseek-chat` is now just a legacy
alias for V4-Flash and is being retired. So `deepseek-chat → deepseek-v4-flash` is the
**exact equivalent** — same model, same speed, same price, same OpenAI-compat path. No
behavior or cost change; it just stops us depending on a soon-dead alias.

Verified 2026-06-12: live `/models` lists only `deepseek-v4-flash` + `deepseek-v4-pro`;
both smoke-tested OK through `chat/completions`; the response `model` field echoes the
ID. No Lambda code branches on the literal `deepseek-chat` (the only occurrences are
`process.env.GROK_MODEL || 'deepseek-chat'` fallback defaults).

## 2. Scope — 9 Lambdas (this project)

Found by scanning every Lambda's env for a `deepseek-chat` value (region ap-northeast-1):

| Lambda | env var |
|--------|---------|
| `NewsProjectInvokeAgentLambda-dev` | `GROK_MODEL` |
| `newsCountryIntelligence` | `GROK_MODEL` |
| `newsEconomicImpact` | `GROK_MODEL` |
| `newsInvokeGemini-dev` | `GROK_MODEL` |
| `newsPairIntelligence` | `GROK_MODEL` |
| `newsPostDevTo` | `GROK_MODEL` |
| `newsPredictionResolver` | `GROK_MODEL` |
| `newsSystemsAnalysis` | `GROK_MODEL` |
| `newsWeeklyBrief` | `GROK_MODEL` |

**Out of scope (different project, flagged not touched):** `PPAcomputeWardProfiles-dev`,
`PPAfetchMarketNews-dev` (`LLM_MODEL=deepseek-chat`). Same deadline applies to them —
owner to confirm before migrating.

## 3. Correct procedure (CODE change + env, staged) — NOT done yet

Per Lambda:
1. **Code:** in the DeepSeek `chat/completions` request body, add
   `thinking: { type: 'disabled' }` (alongside existing `model`, `messages`,
   `response_format`, `max_tokens`). Only takes effect on V4 IDs; harmless to add now.
2. **Redeploy** the Lambda code (zip `src/` — preserving its existing `node_modules`
   packaging — + `update-function-code`). Per-Lambda packaging must be confirmed; some
   bundle deps, some rely on the runtime SDK.
3. **Env:** flip `GROK_MODEL` → `deepseek-v4-flash` (read-modify-write the full env map
   via temp `file://`, key never printed — [[feedback-no-secrets-manager]]).
4. **Verify per Lambda:** invoke once; confirm success AND no regression vs its baseline
   (e.g. `newsEconomicImpact` must stay `0 failed`; check logs for `reasoning_content`
   leakage / parse errors).

**Staged rollout (recommended):** do `newsEconomicImpact` first end-to-end, prove
`0 failed`, then roll the same recipe to the other 8 one at a time. Do NOT batch-flip
config without the code change — that is exactly what regressed.

Old §3 (config-only) is retained below struck-through as the cautionary record:
> ~~1. get env → 2. set GROK_MODEL=deepseek-v4-flash → 3. update-function-configuration
> → 4. verify.~~ **WRONG on its own — V4 defaults to thinking mode; broke JSON parsing.**

## 4. Source hygiene (repo, optional redeploy)

3 Lambdas hardcode the fallback default `|| 'deepseek-chat'`
(`newsEconomicImpact`, `newsPredictionResolver`, `newsWeeklyBrief`). Update those to
`|| 'deepseek-v4-flash'` so the dormant fallback isn't a future landmine if the env var
is ever removed. The env var is authoritative, so this needs **no redeploy to take
effect now** — it's belt-and-braces for the repo.

## 5. Verification

- After each: `get-function-configuration` shows `GROK_MODEL=deepseek-v4-flash`.
- Re-scan all Lambdas for any remaining `deepseek-chat`/`-reasoner` value → only the
  2 PPA* (out of scope) should remain.
- Spot-check: invoke one safe generator (`newsEconomicImpact`) and confirm success.

## 6. Rollback

Trivial and safe until 2026-07-24: set `GROK_MODEL` back to `deepseek-chat` the same
way. (No data migration, no schema change.)

## 7. Done-check

- [ ] 9 Lambdas show `GROK_MODEL=deepseek-v4-flash`
- [ ] re-scan clean (only PPA* remain)
- [ ] 3 source fallbacks updated + committed
- [ ] frontend picker already on V4 (commit `6c2acb0`, shipped)
- [ ] PPA* flagged to owner
