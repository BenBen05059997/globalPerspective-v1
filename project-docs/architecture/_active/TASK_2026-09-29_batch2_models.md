## Batch 2: the right model in each place (D2, D3, change-driven story analysis) — 2026-09-29 — active (PLAN ONLY; nothing executed, nothing changed)

**Goal:**
- **D2:** story analysis (`newsThreadAnalysis`) moves from Gemini 2.5 Flash to DeepSeek **`deepseek-flash`**, and only re-analyses a story that has new events since its last analysis.
- **D3:** **`deepseek-v4-pro`** for the four high-leverage calls: topic selection, daily brief, weekly brief, and the story forecast (research pre-call + forecast call). Summary and cause chain stay on flash.

**Source:** `BACKEND_PLAN_2026-09-27.md` (D2, D3, AI map); Batch 1 (`TASK_2026-09-28_batch1_efficiency.md`, done). Operator (2026-09-27): "we should use flash deepseek instead of gemini". This phase was **read-only**: AWS reads, downloads of deployed zips, hash-only comparisons of keys (no key value was printed or written anywhere).

**Reads / references:** deployed zips downloaded to `/private/tmp/claude-501/-Users-benlai-Downloads-globalPerspective-v1/923a878d-8755-4b54-8ac8-114b13c73db2/scratchpad/batch2/` (re-download before any deploy). Live `newsModelGuard` log 2026-09-28 12:00 UTC: `liveModels = ["deepseek-flash","deepseek-v4-pro"]`.

---

## 0. Findings (live + code, 2026-09-29)

**Deployed vs repo (all five Lambdas whose config or code changes):** every `index.js` matches the repo except a dead fallback model string (and comments); nothing else differs. The repo is the base for every code edit.

| Lambda | Deployed `CodeSha256` (record) | Timeout / memory | Diff vs repo |
|---|---|---|---|
| `newsThreadAnalysis` | `tlVlGb9+uphDy9JJxrbc4vYNXRBm5slSGXIFr1BoXvY=` | 630 s / 512 MB | L8 fallback only (`grok-4-1-fast-non-reasoning` vs `gemini-2.5-flash`) |
| `NewsProjectInvokeAgentLambda-dev` | `ZC/gW3uSSsQNZ1+fDRbdzSnzbGxShxHVNPXRzD21WhM=` | 600 s / 512 MB | none (Batch 1 deploy, byte-identical) |
| `newsInvokeGemini-dev` | `WlCD3+2oWfPXDItk7f0Qk9wkd6xMLY3DAVPPBjZ2zrc=` | 355 s / 512 MB | L24 fallback only |
| `newsPostDevTo` | `tga1S60wl5EVvpvLWA5IsHhWsh5Q9cd4ZS536PecCpg=` | 120 s / 256 MB | L19 fallback only |
| `newsWeeklyBrief` | `89/Llp0Yo2r+jwTopWRS+woudrJdRxlx48CEqKv+iGQ=` | 180 s / 256 MB | L17 fallback + one comment |

**`thinking:{type:'disabled'}` in the DEPLOYED code:**

| Lambda | Sent? | Where |
|---|---|---|
| topic selection `newsInvokeGemini-dev` | yes | L691, `openai.chat.completions.create` (SDK, `response_format:json_object`, `max_tokens 12000`) |
| daily brief `newsPostDevTo` | yes | L176, `callGrok` (`max_tokens 2000`) |
| weekly brief `newsWeeklyBrief` | yes | L299 (`max_tokens` env = 3500, JSON mode) |
| agent (summary, cause, research, forecast) | yes | L673, the single `invokeGrok` used by all four calls |
| **`newsThreadAnalysis`** | **NO** | `invokeGrok` L360–373 sends only `model, messages, max_tokens, temperature, top_p`. On DeepSeek V4 this would default to thinking-on and burn `max_tokens` / empty `content`. **Must be added** |

**`newsThreadAnalysis` today** (repo `amplify/backend/function/newsThreadAnalysis/src/index.js`, 409 lines; zip = `index.js riskDimensions.js package.json package-lock.json`, no `node_modules`):
- Gemini assumptions: `INTER_CALL_DELAY_MS` 13000 (`sleep`, L33, L67) is free-tier pacing; endpoint `generativelanguage.googleapis.com/v1beta/openai/chat/completions`; `XAI_API_KEY` holds the **Gemini** key. There is **no** `thinking_budget`, `generationConfig` or `response_format` in the request; JSON is enforced by the prompt ("Return ONLY valid JSON") and `stripCodeFence` (L399–408).
- Live env NAMES: `GROK_API_URL, GROK_MODEL, INTER_CALL_DELAY_MS, MAX_TOKENS (=6000, already), SUMMARIZE_PREDICT_TABLE, TOPICS_DDB_TABLE, XAI_API_KEY, XAI_API_KEY_BACKUP`. **No `BRAVE_SEARCH_API_KEY`**: `searchForContext` returns `[]` every run, so this Lambda has had **no web grounding** (`searchResultsCount` 0). Not changed here (Q3).
- Key hashes (SHA-256 prefix only): thread `XAI_API_KEY` = `ac6b28a8` = Gemini key (identical to `geminiCurrency-dev` `GOOGLE_GEMINI_API_KEY`, which is our rollback source); the news DeepSeek key on `newsCountryIntelligence`, drift, systems, audit, brief, weekly brief, topic selection is `4b81a7ba`. `XAI_API_KEY_BACKUP` `f057341c` is the same everywhere and unused by any code.
- Selection today (L44–68): all threads with ≥ 2 archive entries in the last 30 days, sorted by **entry count** (not recency), top `MAX_THREADS=10`; skipped only if `existing.entryCount === thread.entries.length`. So a big old thread can hold a slot, and a same-count thread whose members changed is missed; also entries ageing out of the 30-day window change the count.
- Output size (live `THREAD_ANALYSIS` items, 212 rows): stored item 5.5 k chars median, 15 k max including metadata; `MAX_TOKENS=6000` env is adequate. Old Gemini latency 19–32 s per thread.
- Caller: rule `TriggerDailyAnalysis` `cron(40 4 * * ? *)` (Batch 1), **no input**; the handler ignores the event.

**Agent forecast path** (`NewsProjectInvokeAgentLambda/src/index.js`): `generateAndStore` prediction branch = research call (`RESEARCH_MAX_TOKENS 800`, optional Brave grounding, but the live env has **no Brave key** so it is ungrounded) then forecast call (`PREDICTION_MAX_TOKENS 1500`), both through `invokeGrok` with the single `GROK_MODEL`. The forecast log row and the items already store `model: response.modelId`, so records will show which model produced each forecast.

**`newsModelGuard`** scans env var NAMES from `MODEL_VARS` (env not set, default `GROK_MODEL,LLM_MODEL,MODEL,AUDIT_MODEL,JUDGE_MODEL,PPLX_MODEL,AI_MODEL`). A new `PREDICTION_MODEL` var would **not** be checked unless added (guard env = `SNS_TOPIC_ARN, DEEPSEEK_API_KEY, DEEPSEEK_MODELS_URL`).

**What still uses Gemini after this batch (listed only, not changed):** `newsEconomicQuality` (parked, key `ac6b28a8`), `newsWeeklyMarkets` `JUDGE_*` (parked, key `ac6b28a8`), `geminiCurrency-dev` (`GOOGLE_GEMINI_API_KEY` `ac6b28a8`; `currencyRouter-dev` calls it), `newsSensitiveData-dev` `GOOGLE_GEMINI_API_KEY` (hash `baa58574`, **no code reads it**: stale env). Public copy still names Gemini: `Disclosures.jsx` L48 and L95 (the L95 sentence is the economy judge, parked), `PrivacyTerms.jsx` L45, L71. Still true (Gemini remains for those uses), so no edit proposed (Q2).

**Rough cost, off-peak (ESTIMATES from the plan's ~224 articles and the code's token caps; not measured; DeepSeek prices from `AI_PROVIDER_PRICES_2026-09-27.md`, v4-pro $0.66 in / $1.98 out per 1 M, flash $0.15 / $0.60):**

| Call | Per call | Per day | Note |
|---|---|---|---|
| topic selection (pro) | ~33 k in, ~6 k out ≈ $0.03 | 3 runs ≈ **$0.10** | was flash ≈ $0.01 |
| forecast (pro), research + forecast | ≈ $0.007 per story | ≤ 17 new stories × 3 runs ≈ **$0.36** worst case | once per story per day |
| daily brief (pro) | ≈ $0.006 | ≈ $0.006 | |
| weekly brief (pro) | ≈ $0.01 | ≈ $0.001 | |
| story analysis (flash) | ≈ $0.03 per thread | ~3 changed threads ≈ **$0.08** | was free on Gemini |
Total roughly **$0.5–0.6 a day (~$15–18 a month)** on top of Batch 1's savings; all runs are scheduled off-peak (peak would double them).

---

## 1. Phases

### A. `newsThreadAnalysis`: Gemini → DeepSeek flash, change-driven
**Resources:** repo `amplify/backend/function/newsThreadAnalysis/src/index.js` (constants L8–33, handler L37–80, `readExistingAnalysis` L145, `invokeGrok` L360, `writeAnalysis` L306); **new** `src/threadPolicy.js` + **new** `test/threadPolicy.test.js`; Lambda `newsThreadAnalysis`; rule `TriggerDailyAnalysis` (unchanged); env names `GROK_API_URL, GROK_MODEL, XAI_API_KEY, INTER_CALL_DELAY_MS, MAX_TOKENS`.

**Code change (sketch):**
```js
// invokeGrok body: add
thinking: { type: 'disabled' },                // DeepSeek V4 defaults to thinking-on; it would eat max_tokens
response_format: { type: 'json_object' },      // prompt already says "JSON" (DeepSeek JSON mode requires it)
// constants: GROK_MODEL fallback 'deepseek-flash'; INTER_CALL_DELAY_MS default '0' (no free-tier pacing)
// threadPolicy.js (pure):
//   entryIds(thread)            -> sorted topicIds
//   isStale(existing, thread)   -> existing missing => 'new-thread'
//        existing.entryTopicIds ? (thread has a topicId not in it => 'new-events') : (thread.entries.length > existing.entryCount => 'new-events')
//        else 'no-new-events'   // entries ageing OUT of the 30-day window never trigger a re-analysis
//   selectThreads({ threads, existingByThread, maxThreads }) -> changed threads only, ranked by newest entry date desc then entry count desc, cap MAX_THREADS (env, default 10)
// writeAnalysis: also store entryTopicIds (list of the analysed topicIds, <= 50) next to entryCount (entryCount stays: the daily brief reads it)
// event.dryRun: read archive + existing items, print per-thread decision + reason, no Brave, no LLM, no writes
```
**Env change (fetch → merge → write the full map via a chmod-600 temp file; hash-compare; delete the temp file; no value printed):** `GROK_API_URL` = `https://api.deepseek.com/chat/completions`, `GROK_MODEL` = `deepseek-flash`, `INTER_CALL_DELAY_MS` = `0`, `XAI_API_KEY` = the value of `newsCountryIntelligence`'s `XAI_API_KEY` (copied inside one python process from `get-function-configuration` output into the temp file; verify hash prefix `4b81a7ba`). `MAX_TOKENS` stays 6000. **Variables removed: none** (same names, new values); the Gemini key is not kept (no code reads a second key); `XAI_API_KEY_BACKUP` untouched. Rollback source for the Gemini key: `geminiCurrency-dev` `GOOGLE_GEMINI_API_KEY` (same hash `ac6b28a8`).
**Tests:** new `test/threadPolicy.test.js` (`node --test`; add a `test` script): new thread; new topicId → stale; only ageing-out (fewer entries, none new) → not stale; legacy item without `entryTopicIds` (count higher → stale, equal or lower → not); ranking (a small fresh thread beats a large old one); cap; the request body has `thinking:{type:'disabled'}` and no Gemini fields (small pure `buildRequestBody`).
**Verification now (no balance):** unit tests; deploy code + env; `dryRun` invoke (reads only, no Brave, no LLM): per-thread decision and reason; read back env names, model, URL, hash of the key (`4b81a7ba`), `LastUpdateStatus`; deployed files byte-identical to repo.
**Verification after top-up:** one manual run (operator go): threads chosen = changed ones only; each item `model: deepseek-flash`, `latencyMs`, JSON parsed (no "Failed to parse"), `entryTopicIds` present; a second run skips all; run finishes < 8 min (timeout 630); the 05:00 systems run and 05:15 country run read the fresh `THREAD_ANALYSIS`.
**Rollback:** `update-function-code` with the recorded zip (`tlVlGb9+…`), env back to the Gemini URL / `gemini-2.5-flash` / `13000` and the Gemini key from `geminiCurrency-dev`.
**Risk:** medium-low. (1) JSON mode can return empty content on rare calls: counted as a failed thread and retried next run (change-driven, so nothing is lost). (2) First run after deploy: legacy items have no `entryTopicIds`, so only threads with a higher entry count are re-analysed (no mass regeneration). (3) Flash may write differently from Gemini: compare a few stories side by side after the top-up (`quality/analysis`) before relying on it (plan item D2b). (4) Brave grounding stays off (Q3).

### B. Story forecast on v4-pro (`NewsProjectInvokeAgentLambda-dev`)
**Resources:** repo `amplify/backend/function/NewsProjectInvokeAgentLambda/src/index.js` (`GROK_MODEL` L15, `generateAndStore` L520, `invokeGrok` ~L700), `src/lib.js` (new pure `buildChatBody`, `modelForKind`), `test/lib.test.js`; Lambda env names `PREDICTION_MODEL` (new), `LLM_CONCURRENCY`; function timeout.
**Change:** `const PREDICTION_MODEL = process.env.PREDICTION_MODEL || GROK_MODEL`; `invokeGrok(prompt, maxTokens, model = GROK_MODEL)`; the prediction branch passes `PREDICTION_MODEL` to **both** the research call and the forecast call; summary and cause stay on `GROK_MODEL`. `lib.buildChatBody` builds the request body for every call (always `thinking:{type:'disabled'}`); the `dryRun` plan lists the model per story and kind.
**Research pre-call on pro: recommended, yes.** The forecast is only as good as the briefing it is built from (historical precedents / base rates, key actors, **deadlines**); a weak briefing feeds a wrong deadline or base rate straight into a trigger that is later scored, and the forecast path is what the track record judges. The cost is small (800 output tokens, at most once per story per day because of the once-a-day rule) and it keeps one model per forecast in the log.
**Env:** `PREDICTION_MODEL=deepseek-v4-pro`; `LLM_CONCURRENCY` 4 → 8 and timeout 600 → 900 s. Reason (estimate): 17 stories per run each needing research + forecast on a slower model, non-thinking output at an assumed 30–60 tokens/s ≈ 60–110 s per story, so 4 workers would need up to ~8 min against a 600 s timeout (flash today: max run 108 s). DeepSeek's concurrency cap is 500 for v4-pro, so 8 is safe. A timed-out run never swaps, but the R2 fingerprints make the retry cheap.
**Tests:** `lib.test.js` (28 pass today): every body has `thinking.type === 'disabled'`; the model is `PREDICTION_MODEL` for prediction (both passes), `GROK_MODEL` for summary / cause; default `PREDICTION_MODEL` falls back to `GROK_MODEL`.
**Verification now:** tests; deploy (sha re-check `ZC/gW3u…`); `dryRun` invoke shows model per story / kind (no LLM); read back env + timeout; byte compare.
**Verification after top-up:** first run: `PRED#` rows show `model: deepseek-v4-pro`, `RESEARCH_BRIEFING` items too, summary / cause items `deepseek-flash`; forecast JSON parses (`capture` gates keep triggers); `Duration` < 500 s; `Generation complete` shows 0 failed.
**Rollback:** `update-function-code` with the recorded Batch 1 zip (`ZC/gW3u…`), unset `PREDICTION_MODEL`, concurrency 4, timeout 600.
**Risk:** medium: latency (see above) and cost (the forecast is the largest v4-pro spend, ≈ $0.36/day worst case). A model change does not regenerate stored forecasts (the reuse rule ignores the model): flash forecasts already made today stand.

### C. Env-only: topic selection, daily brief, weekly brief → `deepseek-v4-pro`
**Resources / env change** (each: fetch → merge → write full map via a temp file, hash-compare, delete; one command per Lambda):

| Lambda | Env var | Now → new | Timeout (now → new) | Why the timeout |
|---|---|---|---|---|
| `newsInvokeGemini-dev` (topic selection; SDK call, `max_tokens 12000`, JSON mode) | `GROK_MODEL` | `deepseek-flash` → `deepseek-v4-pro` | 355 → 600 s | the one call outputs up to 12 k tokens; at an assumed 30–60 tok/s that is up to ~6 min in the worst case; Batch 1 gave the agent a 10-minute gap after Gemini |
| `newsPostDevTo` (daily brief, `callGrok`, `max_tokens 2000`) | `GROK_MODEL` | → `deepseek-v4-pro` | 120 → 240 s | ~2 k output tokens ≈ 30–70 s; keep 2× margin. (`AI_MODEL` = the free OpenRouter model for the short overview is a different path, unchanged) |
| `newsWeeklyBrief` (one call, `MAX_TOKENS` 3500) | `GROK_MODEL` | → `deepseek-v4-pro` | 180 → 300 s | ~3.5 k tokens ≈ 60–120 s |

**Code:** none (fallback strings stay; env overrides). Optional repo hygiene later: set the fallbacks to `deepseek-flash` without deploying.
**Tests:** none (env only). Confirmed above: all three send `thinking:{type:'disabled'}` in the deployed code.
**Verification now:** read back `GROK_MODEL` and timeouts, hash-compare of every other var, `LastUpdateStatus`, `CodeSha256` unchanged. No LLM call is possible without balance.
**Verification after top-up (each needs the operator's go: one real pro call):** topic selection: invoke once, check the log lines `Grok finish_reason: stop`, `completion_tokens`, `chars`, Duration well under 600 s, 13 topics with valid `iso3` / `sources`, no truncation salvage; the next agent run follows 10 min later. Daily brief: next 14:00 run → `DAILY_BRIEF` row with `model` and non-empty JSON. Weekly brief: next Sunday 06:00 run, or one manual invoke.
**Rollback:** `GROK_MODEL` back to `deepseek-flash` and timeouts back to 355 / 120 / 180 (values recorded above).
**Risk:** medium-low. Slower and 4.4× the price per token; a slow topic-selection run delays every downstream job (thread analysis 04:40 reads the archive the agent writes). The freshness monitor (`STALE_HOURS 9`) will alert if a run fails.

### D. `newsModelGuard` covers the new variable
**Resources:** Lambda `newsModelGuard` env `MODEL_VARS` (currently unset = default list; env also holds `DEEPSEEK_API_KEY`, a secret: full-map write via temp file, hash-compare).
**Change:** set `MODEL_VARS=GROK_MODEL,LLM_MODEL,MODEL,AUDIT_MODEL,JUDGE_MODEL,PPLX_MODEL,AI_MODEL,PREDICTION_MODEL`. Do this **before** phase B so `PREDICTION_MODEL` is never unchecked.
**Verification:** read back; after the next 12:00 UTC run the log line shows `checkedFunctions`, `liveModels` containing `deepseek-flash` and `deepseek-v4-pro`, and **no** finding for `PREDICTION_MODEL`, `GROK_MODEL` = `deepseek-v4-pro` or `deepseek-flash` on the changed Lambdas (13 findings on 09-28 were the pre-rename names; the 2 PPA Lambdas may remain listed). A manual `invoke` of the guard is read-only (one `/models` GET, an SNS mail only if it finds something): needs the operator's go.
**Rollback:** unset `MODEL_VARS` (default list). **Risk:** low.

---

## 2. Order of work (one bare `aws` command per call; STOP and report after each phase)
1. **D** (guard env), so the new variable is watched.
2. **A** (thread analysis: code + tests + deploy + env + `dryRun`).
3. **B** (agent: code + tests + deploy + env + timeout + `dryRun`).
4. **C** (three env changes + timeouts).
5. Top-up (operator) → per-phase "after top-up" checks, cheapest first: thread analysis (flash), agent, topic selection, then the next daily and weekly briefs; compare the D2 stories side by side.
No frontend change, no IAM change, no `newsAnalyze`, no schedule change (the cron chain from Batch 1 stays).

## 3. IAM
None. The agent and thread-analysis roles already have DynamoDB access; nothing new is read or written outside DynamoDB.

## 4. Docs to update on completion (same commits)
- `ARCHITECTURE.md`: AI provider paragraph (L11, L15, L17), Lambda §1 (topic selection now v4-pro, L196), §3 `newsThreadAnalysis` (L271–291: DeepSeek flash, change-driven rule, no pacing, key env; remove the Gemini free-tier warning), §2 (forecast on v4-pro, `PREDICTION_MODEL`), §7 daily brief model, §23 weekly brief model, §30 model guard (`MODEL_VARS`), the provider table (L1188–1190), the ASCII diagram L61 ("Gemini 2.5 Flash generates").
- `BACKEND_PLAN_2026-09-27.md`: D2 / D3 rows and the AI map.
- `CHANGES.md` per phase; `INDEX.md` row for this task file.
- Memory: `project_ai_providers.md` (Gemini removed from story analysis; what still uses Gemini), `feedback_misleading_grok_naming.md` note that `newsThreadAnalysis`'s `XAI_API_KEY` now holds DeepSeek.


### Operator answers (2026-09-29)
"ok and you can update the plan and then execute the rest": all as the monitor recommended.
1. **Yes:** the forecast's research pre-call also on `deepseek-v4-pro`.
2. **Public copy (Privacy L45 / L71, Disclosures L48 / L95):** update so it stays accurate. **Draft only**: legal copy is shown to the operator verbatim before it is committed (CLAUDE.md: legal copy is a stop-and-ask).
3. **No** Brave / web grounding for story analysis for now.
4. **Yes:** timeouts 355→600 s (topic selection), 120→240 s (daily brief), 180→300 s (weekly brief), 600→900 s + concurrency 8 (agent).
5. **Yes:** story analysis on changed threads only, newest first, cap 10.
6. **Yes:** after the top-up, one manual topic-selection invoke on v4-pro (+ the agent's forecast calls) to check output size / latency.

## ▶ LIVE TRACKER
| Phase | What | Status | Evidence |
|---|---|---|---|
| 0 | Operator "execute" + Q1–Q6 answered | Queued | |
| D | guard `MODEL_VARS` += `PREDICTION_MODEL` | Done 2026-09-29 (✅ monitor verified 2026-09-29 (read-back MODEL_VARS incl. PREDICTION_MODEL, 4 vars, Successful)) | `newsModelGuard` env `MODEL_VARS` unset -> `GROK_MODEL,LLM_MODEL,MODEL,AUDIT_MODEL,JUDGE_MODEL,PPLX_MODEL,AI_MODEL,PREDICTION_MODEL` (default list + `PREDICTION_MODEL`). Full map via chmod-600 temp file (deleted); hash compare: 3 -> 4 vars, only `MODEL_VARS` added, none changed/removed; `LastUpdateStatus=Successful`; `CodeSha256` unchanged `zdYWbPry…prZ0=` (env-only). Next verification: the 12:00 UTC guard run log |
| A | thread analysis: DeepSeek flash + `thinking` disabled + change-driven + tests + deploy + env + `dryRun` | Queued | sha `tlVlGb9+…BoXvY=` recorded |
| B | agent `PREDICTION_MODEL` (research + forecast on v4-pro), concurrency 8, timeout 900 | Queued | sha `ZC/gW3u…WhM=` recorded |
| C | topic selection / daily brief / weekly brief `GROK_MODEL` → v4-pro + timeouts | Queued | shas recorded in §0 |
| Post | after top-up: per-phase checks, side-by-side story comparison, docs, status → done | Queued | |

**Completion checklist:**
- [ ] operator "execute" + open questions answered
- [ ] D done and verified
- [ ] A: code + tests + deploy + env + dryRun; after top-up: change-driven run, JSON parses, timing
- [ ] B: code + tests + deploy + env; after top-up: forecast `model` = v4-pro in `PRED#` rows, `Duration` < 500 s
- [ ] C: three envs + timeouts; after top-up: one good run of each
- [ ] guard log clean for the new values
- [ ] docs updated in the same commits (ARCHITECTURE, BACKEND_PLAN, CHANGES, INDEX, memory)
- [ ] status → done

## Open questions for the operator
1. **Q1:** the forecast's research pre-call also on v4-pro (recommended: yes, reason in phase B)?
2. **Q2:** the public copy still says "DeepSeek V4 and Google Gemini" (`Disclosures.jsx` L48, `PrivacyTerms.jsx` L45, L71) and the economy-judge sentence (`Disclosures.jsx` L95). Gemini remains for the parked judges and currency, so I propose no wording change. Confirm (legal copy is your call).
3. **Q3:** `newsThreadAnalysis` (and the agent) have **no Brave key** in their env, so web grounding is silently off there. Leave, or copy the Brave key in later (a separate secret copy)?
4. **Q4:** timeouts and concurrency raised as stated (topic selection 355 → 600 s, daily brief 120 → 240 s, weekly brief 180 → 300 s, agent 600 → 900 s with `LLM_CONCURRENCY` 8). All are estimates until the first real runs; OK?
5. **Q5:** thread selection becomes "changed threads only, newest first, at most 10", instead of "the 10 largest, skipped if the count is unchanged". Confirm.
6. **Q6:** after the top-up, may I run one manual topic-selection invoke on v4-pro (1 real LLM call, then the agent's forecast calls) to check output size and latency before the next scheduled run?
