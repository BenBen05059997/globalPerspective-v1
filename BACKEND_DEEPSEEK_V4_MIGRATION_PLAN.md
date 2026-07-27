# Backend Migration — `deepseek-chat` → DeepSeek V4

**Status:** ✅ **DONE 2026-07-26/27 — but the deadline was MISSED and it became a live incident.**
The migration below was written 2026-06-12 with ~6 weeks of runway and was **not executed in time**.
`deepseek-chat` retired **2026-07-24** exactly as predicted → the whole DeepSeek fleet went dark for
~36h (silent: caught parse/throw, 0 CloudWatch errors — surfaced only by [[project-freshness-monitor]]'s
stale-content alert, precisely the failure mode this doc called out). Fixed under fire on 07-26 using the
**code-change recipe in §3** (the config-only path stayed wrong). See CHANGES.md 2026-07-27 and
[[project-ai-provider-migration]].

**Deviation from the original plan:** the plan targeted **all → `deepseek-v4-flash`**. Actual outcome uses
an **intent-based pro/flash split** (operator decision): **`deepseek-v4-pro`** for the 3 open-analytical
reads (`newsCountryIntelligence`, `newsSystemsAnalysis`, `newsEconomicImpact`) and **`deepseek-v4-flash`**
for the mechanical/constrained/high-volume rest. All send `thinking:{type:'disabled'}`. Repo `src/index.js`
of the 10 on-main functions now carries the patch (main `8f6c82f`), so a zip-from-repo deploy won't regress.
The 2 PPA* functions were migrated 2026-07-27 too (→ `deepseek-v4-flash`; `PPAfetchMarketNews` smoke-tested green).

**Lesson:** a doc-with-a-deadline is not a reminder — nothing was watching the 07-24 date, so a known,
planned, trivial migration became a production outage. Future dated-deadline migrations need an actual
scheduled check (cron/calendar), not just a plan file.

<details><summary>Original 2026-06-12 plan (retained for the record — now executed)</summary>

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

- [x] 9 Lambdas migrated to V4 (`GROK_MODEL`=`deepseek-v4-pro` ×3 / `deepseek-v4-flash` ×6) + `thinking:disabled` code patch — 2026-07-26
- [x] re-scan clean — no `deepseek-chat` left in the GP fleet
- [x] `thinking:disabled` ported into repo `src/index.js` (10 on-main functions, main `8f6c82f`) — supersedes the "3 source fallbacks" item; the fallback defaults matter less now that the request body is patched
- [x] frontend picker already on V4 (commit `6c2acb0`, shipped)
- [x] PPA* migrated too (2026-07-27) — `PPAcomputeWardProfiles-dev` + `PPAfetchMarketNews-dev` → `deepseek-v4-flash` + patch

</details>
