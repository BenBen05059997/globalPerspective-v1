# Analysis Studio — Deep Research (web) Mode + Elite Prompt

**Status:** Mode + provider **SHIPPED** 2026-06-11 (commit `26d10ec`). **Elite prompt
upgrade SHIPPED** 2026-06-11. Live BYOK run (CORS + response shapes) **unverified**
(needs a Perplexity/Anthropic key — BYOK by design).
**Feature:** Analysis Studio (`/analyze`) — see `ANALYSIS_STUDIO_PLAN.md` (feature),
`ANALYSIS_STUDIO_TESTING_PLAN.md` (output validator + eval).

---

## 1. The ask & the constraint

The reader wanted free-form to *"search the article on the internet, find as many
relevant resources as you can, and generate a deep analysis — why it happened, what
might happen."*

**The constraint that shapes everything:** a plain `chat/completions` call **cannot
search the web**. Telling such a model to "search the internet" makes it *fake*
having searched — fabricated sources, the exact misinformation failure we built the
validator to stop (`feedback_no_misinformation_fallback`). So deep research is only
offered where the provider's API genuinely retrieves.

This is the **industry-standard** pattern (Perplexity, OpenAI/Gemini/Anthropic deep
research): real retrieval wired into the call, not a prompt wish.

---

## 2. Provider support matrix (verified against docs 2026-06-11)

| Provider | Web search | How | In chooser? |
|----------|-----------|-----|-------------|
| **Perplexity sonar** | ✅ always | OpenAI-compat `api.perplexity.ai`; returns `citations` + `search_results` | **added** (`sonar-pro`, `sonar`, `sonar-reasoning-pro`, `sonar-deep-research`) |
| **Anthropic** | ✅ tool | `web_search_20250305` tool on Messages API; citations on text blocks | yes (tool attached only in deep mode) |
| **OpenAI** | ⚠️ partial | needs `gpt-4o-search-preview` / Responses API (not our path) | no deep |
| **Gemini** | ⚠️ awkward | `google_search` **rejected** by the OpenAI-compat endpoint we use | no deep |
| **DeepSeek** | ❌ | no web search in API | no deep |

`webSearch: 'always' | 'tool'` on each `PROVIDERS` entry (`services/llm.js`) drives
the gating. Absent = deep disabled.

---

## 3. The three modes (one engine, shared guardrails)

| Mode | System prompt | Provider req | Source of truth |
|------|---------------|--------------|-----------------|
| Guided lens | `SYSTEM_PROMPT` | any | our cached `SUMMARY`/`PREDICTION`/`TRACE_CAUSE` |
| Free-form | `SYSTEM_PROMPT` | any | our cached data |
| **Deep research** | `DEEP_SYSTEM_PROMPT` | search-capable only | our stories **seed** a real web search |

Closed-book modes forbid outside material; deep mode instructs the model to gather
it — via real retrieval, citing only sources it actually fetched.

---

## 4. The elite prompt (`DEEP_SYSTEM_PROMPT`)

Bar = a **buy-side desk note / ISW assessment**, not a news recap. Required sections:

1. **Bottom line** — a *thesis*: one sharp, directional, ideally non-consensus call + stated confidence. A view, not a summary.
2. **What happened** — dense with **hard numbers pulled from sources** (levels, %, sizes, dates), each attributed. "A large share" is a failure; "~20m b/d, ~⅕ of consumption" is the bar.
3. **Why it happened** — the transmission mechanism in concrete steps.
4. **What might happen next** — 2–3 named scenarios, each with a calibrated probability, a **historical analog / base rate** that justifies it, and a **dated, falsifiable trigger**.
5. **What the consensus is missing** — one genuinely non-obvious insight (overlooked actor, second-order effect, mispriced risk) — or say there isn't one.
6. **Who is affected** — actors/sectors/instruments, direction + mechanism, cited.

Calibration rules kept: distinguish fact from judgment; conflicting sources → give
the range + which you trust; thin evidence → a confident "we can't call this yet,
here's what would change that" under *Limits*, not false precision.

**Why prompt-only:** the model already retrieves real sources in this mode, so we can
demand specificity/numbers **without** loosening honesty — the rigor was being left
on the table by the v1 prompt.

---

## 5. Honesty handling in deep mode

- **Gating, never silent degradation:** mode disabled (with the reason in the
  tooltip) for no-search providers; `runChat` *hard-throws* on `webResearch` without
  `provider.webSearch`; switching to a no-search provider drops you out of deep mode.
- **Validator adapted:** phantom-`[n]` citation check **still enforced**; the
  invented-figure (vs our context) check is **skipped** — the web legitimately
  introduces new figures. Web claims must come from retrieved sources (prompt rule).
- **Provenance shown:** model-retrieved sources render under the analysis ("Web
  sources (model-retrieved)"); disclaimer flags they're **not pipeline-verified**.

---

## 6. Validation evidence (engine, not plumbing)

Ran by the assistant acting AS the deep-research model on a live story (US–Iran /
Hormuz + Broadcom AI-guide miss), real retrieval (EIA, CNBC, Bloomberg):

- v1 output: solid desk summary, validator clean — but no thesis, soft numbers, no analogs.
- v2 output (elite prompt): stated non-consensus thesis ("market has the risk
  backwards"), hard sourced numbers (~20m b/d, +143% AI rev, $16B vs $17.2B),
  scenarios anchored to the 2019 Abqaiq analog (+19.5%→round-tripped in ~2wks) with
  dated triggers, plus a non-obvious read (AI priced for perfection; China = most
  exposed Hormuz importer). **Validator: `ok:true`, 0 warnings.**

This proves the **prompt design + output quality + validator integration** end-to-end.

---

## 7. Open / unverified

- **Live BYOK run** still needed (no Perplexity/Anthropic key in infra — BYOK):
  confirm (a) browser→provider **CORS**, (b) **response-shape parsing**
  (`openAIWebSources()` for Perplexity `search_results`/`citations`; Anthropic
  citation-block extraction). First real key run verifies both; if a parse misses,
  fix the adapter.
- **Cost note:** `sonar-deep-research` bills separately for citation/reasoning/search
  tokens — surface model cost in the chooser later.
- **Prompt tuning dial:** v2 has a strong house view; some readers find that too
  opinionated. Keep a knob to dial conviction up/down if feedback warrants.

---

## 8. Future (not built)

- Add **OpenAI Responses API** + **Gemini `extra_body` grounding** paths so deep
  research isn't limited to Perplexity/Anthropic.
- Eval **Layer for deep mode**: golden web-research fixtures + an LLM-judge for
  faithfulness/overreach (mirrors `ANALYSIS_STUDIO_TESTING_PLAN.md` Phase 3).
- Polar-credit metering: deep runs cost more (search tokens) → price accordingly
  (`POLAR_BILLING_PLAN.md`).
