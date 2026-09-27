# LLM Provider Comparison — Global Perspectives Studio/Batch Workload

Accessed: 2026-09-27. Sources: official provider pricing/docs pages only (URLs and access date given per table). Where an official page didn't state a figure, it is marked "not stated"; where a widely-repeated figure could not be confirmed on an official page in this pass, it is marked **UNVERIFIED**.

---

## 1. DeepSeek

Source: https://api-docs.deepseek.com/quick_start/pricing (accessed 2026-09-27), https://api-docs.deepseek.com/api/create-chat-completion (2026-09-27), https://api-docs.deepseek.com/quick_start/rate_limit (2026-09-27), https://api-docs.deepseek.com/ (2026-09-27)

| Model | Input $/1M (cache hit) | Input $/1M (cache miss) | Output $/1M | Context | Max output | Batch discount | Free tier | JSON/structured output | Web search cost | Source | Accessed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| deepseek-flash | $0.003 off-peak / $0.006 peak | $0.15 off-peak / $0.30 peak | $0.60 off-peak / $1.20 peak | 1M tokens | 384K (non-thinking default 8K; 64K in thinking mode, 128K with `reasoning_effort: max`) | not stated (no separate batch endpoint documented) | none stated | `response_format: {type: "json_object"}` supported | n/a (no built-in web-search tool documented) | api-docs.deepseek.com/quick_start/pricing | 2026-09-27 |
| deepseek-v4-pro | $0.022 off-peak / $0.044 peak | $0.66 off-peak / $1.32 peak | $1.98 off-peak / $3.96 peak | 1M tokens | 384K max | not stated | none stated | same JSON mode | n/a | api-docs.deepseek.com/quick_start/pricing | 2026-09-27 |

Notes:
- **Off-peak discount:** exactly half of peak rates. Peak window: 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday, excluding Chinese public holidays (i.e., off-peak = the rest of the time, including all weekend hours).
- **Thinking/reasoning mode:** controlled via `thinking: {type: "enabled"|"disabled"}` plus `reasoning_effort` (`none`/`low`/`high`/`max`) on deepseek-flash; thinking is on by default; tool use/tool_choice is **not supported** while thinking mode is active. Reasoning tokens are billed as ordinary output tokens (no separate reasoning-token price stated); response includes a `reasoning_tokens` field in the usage breakdown.
- **Prepaid balance model:** charges are deducted from "your topped-up balance or granted balance" (i.e., prepaid credit). The pricing page does not state what happens at zero balance (requests presumably fail) or describe any auto-recharge feature — **not stated**, and no auto-recharge was found on official pages — mark auto-recharge existence **UNVERIFIED (likely absent)**.
- **Rate limits:** DeepSeek does not publish RPM/TPM; it enforces a **concurrency** cap instead — deepseek-flash 2,500 concurrent requests, deepseek-v4-pro 500 concurrent requests, account-wide across all API keys; exceeding it returns HTTP 429. Capacity expansion available on request at no extra cost.
- **OpenAI-compatible endpoint:** confirmed — "The DeepSeek API uses an API format compatible with OpenAI/Anthropic," base URL `https://api.deepseek.com`, endpoint `/chat/completions`. This matches the shape the site's Lambdas already use.
- **Region/data residency:** no statement found on official pages — **not stated**.
- **Status page:** status.deepseek.com (third-party trackers report ~99.6–99.8% uptime across components; this is not an official Anthropic/DeepSeek-published SLA number, cite with caution).

---

## 2. Google Gemini API

Sources: https://ai.google.dev/gemini-api/docs/pricing (2026-09-27), https://ai.google.dev/gemini-api/docs/rate-limits (2026-09-27), https://ai.google.dev/gemini-api/terms (2026-09-27), https://ai.google.dev/gemini-api/docs/structured-output (2026-09-27)

| Model | Input $/1M | Cached input $/1M (storage) | Output $/1M | Context | Batch discount | Free tier | JSON/structured output | Search grounding cost | Source | Accessed |
|---|---|---|---|---|---|---|---|---|---|---|
| Gemini 2.5 Pro | $1.25/1M (≤200K context tier) | $0.125/1M + $4.50/1M/hr storage | $10.00/1M | not fully re-stated beyond tiering (1M input context is standard for 2.5 line per model card) | 50% off | Full API access (free tier exists) | `response_schema` + `response_mime_type: application/json` | 1,500 requests/day free, then $35/1,000 prompts | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |
| Gemini 2.5 Flash | $0.30/1M | $0.03/1M | $2.50/1M | not stated in pricing table (see model card) | $0.15 in / $1.25 out | Free tier available; free-tier Search grounding capped at 500 requests/day | same | 1,500/day free (shared 2.5-line quota), then $35/1,000 | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |
| Gemini 2.5 Flash-Lite | $0.10/1M | not broken out separately | $0.40/1M | not stated in pricing table | $0.05 in / $0.20 out | Full access; 500 RPD Search-grounding limit on free tier | same | shared 2.5-line Search quota; then $35/1,000 | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |
| Gemini 3.5 Flash | $1.50/1M | $0.15/1M + $1.00/1M/hr storage | $9.00/1M | not stated | $0.75 in / $4.50 out | "Unlimited standard access" stated on pricing page (ambiguous — likely means the tier exists, not literally unlimited free calls) | same | Gemini-3.x line: 5,000 free/month, then $14/1,000 | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |
| Gemini 3.5 Flash-Lite | $0.30/1M | not broken out | $2.50/1M | not stated | $0.15 in / $1.25 out | Full access stated | same | 3.x-line quota as above | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |
| Gemini 3.7 Flash | $0.75/1M | $0.075/1M + $0.50/1M/hr storage | $3.75/1M | not stated | $0.375 in / $1.875 out | not stated | same | 3.x-line quota | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |
| Gemini 3.8 Flash | $0.75/1M (promotional rate through 2026-12-31, per page) | $0.075/1M + $0.50/1M/hr storage | $3.75/1M | not stated | 50% | not stated | same | 3.x-line quota | ai.google.dev/gemini-api/docs/pricing | 2026-09-27 |

Notes:
- **Free-tier RPM/RPD/TPM per model:** the official rate-limits page (ai.google.dev/gemini-api/docs/rate-limits) does **not** enumerate per-model numeric limits in text; it states limits depend on usage tier and directs users to the live dashboard at aistudio.google.com/rate-limit. It does give **spend-based** paid-tier limits (rolling 10-minute window): Tier 1 $10, Tier 2 $50, Tier 3 $200; free tier has no spend-based limit listed. Exact per-model free-tier RPM/RPD/TPM: **not stated on the docs page itself — must be read from the live AI Studio dashboard, which this pass did not access.** Mark as UNVERIFIED for exact numbers; only the Search-grounding free caps (500 RPD for 2.5-line free tier per the pricing page) were confirmed.
- **Batch mode:** consistently 50% off across the lineup (Gemini 2.5 Pro/Flash/Flash-Lite and 3.x Flash variants all show batch = half of standard input/output).
- **Grounding with Google Search:** 2.5-line models get 1,500 free requests/day, then $35 per 1,000 grounded prompts; 3.x-line models get 5,000 free per month, then $14 per 1,000. Google Maps grounding: 1,500/day free, then $25/1,000.
- **Structured output:** all current Gemini models support JSON Schema-constrained output via `response_schema` + `response_mime_type: "application/json"` (subset of JSON Schema; recent updates added `anyOf`, `$ref` support).
- **Data use, free vs. paid — confirmed via ai.google.dev/gemini-api/terms:** Free tier — "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services" (includes human review). Paid tier — "Google doesn't use your prompts (including associated system instructions, cached content, and files such as images, videos, or documents) or responses to improve our products," with only temporary retention for safety/compliance. This is the single most consequential differentiator for a product using free-tier Gemini 2.5 Flash today — any content run through the free tier is used for Google product improvement and human review.
- **OpenAI-compatible endpoint:** Gemini exposes one (`https://generativelanguage.googleapis.com/v1beta/openai/`) — this was not re-confirmed against an official page in this pass; the site should verify against ai.google.dev before relying on it. Mark **UNVERIFIED** in this report (widely documented but not fetched here).
- **Region/data residency:** not checked in this pass — not stated here.
- **Status page:** status.cloud.google.com (Gemini API / Vertex AI incidents appear there); Google AI Studio also publishes aistudio.google.com/status.

---

## 3. Anthropic (Claude)

Source: https://platform.claude.com/docs/en/about-claude/pricing (2026-09-27), https://platform.claude.com/docs/en/models/overview (2026-09-27), https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk (2026-09-27)

| Model | Input $/1M | Cache write (5m / 1h) | Cache read $/1M | Output $/1M | Context | Max output | Batch discount | Web search cost | Source | Accessed |
|---|---|---|---|---|---|---|---|---|---|---|
| Claude Haiku 4.5 | $1 | $1.25 / $2 | $0.10 | $5 | 200K | 64K | 50% ($0.50 in / $2.50 out) | $10/1,000 searches + token cost | platform.claude.com/docs/.../pricing | 2026-09-27 |
| Claude Sonnet 5 | $2 (standard, no scheduled increase — see note) | $2.50 / $4 | $0.20 | $10 | 1M | 128K | 50% ($1 in / $5 out) | $10/1,000 + tokens | same | 2026-09-27 |
| Claude Opus 5.5 | $4 | $5 / $8 | $0.20 (0.05x base) | $20 | 1M | 128K | 50% ($2 in / $10 out) | $10/1,000 + tokens | same | 2026-09-27 |
| Claude Fable 5.1 | $10 | $12.50 / $20 | $0.25 (0.025x base) | $50 | 1M | 128K | 50% ($5 in / $25 out) | $10/1,000 + tokens | same | 2026-09-27 |

Notes:
- **Sonnet 5 pricing history (per official page):** launched at $2 in / $10 out as introductory pricing through 2026-08-31; the previously scheduled increase to $3/$15 on 2026-09-01 **will not occur** — $2/$10 is now the standing price.
- **Prompt caching multipliers (relative to base input price):** 5-minute write 1.25x, 1-hour write 2x, cache-read (hit) 0.1x base for most models, but 0.025x on Fable 5.1/Mythos 5.1 and 0.05x on Opus 5.5. Multipliers stack with batch discount and data-residency multiplier.
- **Context:** 1M-token context is standard (not premium-priced) for Sonnet 5, Opus 5.5, and Fable 5.1; a 900K-token request bills at the same per-token rate as a 9K-token request. Haiku 4.5 stays at 200K context / 64K max output.
- **Web search:** $10 per 1,000 searches (billed per use regardless of result count) plus standard token cost for search-derived content; failed searches aren't billed. Web fetch tool: **no additional charge** beyond standard token cost for fetched content.
- **Batch API:** flat 50% off both input and output tokens across the current lineup; not available with Fast Mode.
- **OpenAI SDK compatibility layer — confirmed on official docs:** exists at `https://api.anthropic.com/v1/` using the OpenAI SDK's `chat.completions.create()` shape, but explicitly **not intended for production** ("primarily intended to test and compare model capabilities... not considered a long-term or production-ready solution"). Key gaps versus the site's current OpenAI-compatible Lambda usage: `strict` tool-calling is ignored (no guaranteed JSON schema conformance — use native Structured Outputs instead), **prompt caching is not supported through this layer** (only through native Anthropic SDK), `response_format` is ignored, and multiple system/developer messages get concatenated into one. If the site were to add Claude via its existing OpenAI-compatible plumbing, it would lose prompt caching — a load-bearing cost lever for the current DeepSeek setup.
- **Region/data residency:** `inference_geo: "us"` applies a 1.1x multiplier on all token pricing (input/output/cache) for Claude 4.6+ models; default `"global"` is standard pricing.
- **Status page:** status.claude.com (covers claude.ai, api.anthropic.com, Claude Code, etc.); third-party aggregators reported ~98.6% 30-day uptime at time of access — not an official SLA figure.

---

## 4. OpenAI

Source: https://developers.openai.com/api/docs/pricing (2026-09-27, redirected from platform.openai.com/docs/pricing and openai.com/api/pricing)

| Model | Input $/1M | Cached input $/1M | Output $/1M | Context | Batch discount | Source | Accessed |
|---|---|---|---|---|---|---|---|
| gpt-5-nano | $0.05 | $0.005 | $0.40 | not stated on pricing page (see model card) | 50% ($0.025/$0.0025/$0.20) | developers.openai.com/api/docs/pricing | 2026-09-27 |
| gpt-5-mini | $0.25 | $0.025 | $2.00 | not stated on pricing page | 50% ($0.125/$0.0125/$1.00) | same | 2026-09-27 |
| gpt-5 | $1.25 | $0.125 | $10.00 | not stated on pricing page | 50% ($0.625/$0.0625/$5.00) | same | 2026-09-27 |
| gpt-5.4-nano | $0.20 | $0.02 | $1.25 | not stated | 50% ($0.10/$0.01/$0.625) | same | 2026-09-27 |
| gpt-5.4-mini | $0.75 | $0.075 | $4.50 | not stated | 50% ($0.375/$0.0375/$2.25) | same | 2026-09-27 |
| gpt-5.5 (<272K context) | $5.00 | $0.50 | $30.00 | 272K stated in model name/tier label | 50% ($2.50/$0.25/$15.00) | same | 2026-09-27 |
| gpt-6-luna (current smallest "nano"-class flagship-family model) | $0.10 | $0.01 | $0.50 | not stated | not itemized separately on the table row fetched | same | 2026-09-27 |
| gpt-6-sol (current "mini"-class) | $2.00 | $0.20 | $10.00 | not stated | not itemized | same | 2026-09-27 |
| gpt-6-astra (current flagship) | $10.00 (short ctx) / $20.00 (long ctx) | $1.00 / $2.00 | $50.00 / $75.00 | two-tier pricing by context length (short vs. long; exact token breakpoint not stated on the fetched excerpt) | 50% stated | same | 2026-09-27 |

Notes:
- **Naming caveat (important):** As of 2026-09-27 the official OpenAI pricing table lists both a GPT-5.x line (5, 5.1, 5.2, 5.4, 5.4-mini, 5.4-nano, 5.5, 5.6-sol/terra/luna) **and** a newer GPT-6 line (gpt-6-luna/sol/astra) simultaneously, plus legacy GPT-4.1/4o/o-series rows still priced. This report reflects exactly what the pricing table returned; it was cross-checked with a second, differently-worded fetch of the same URL and the model names and prices were consistent between both fetches. The site's own docs/plans should confirm which line is "current" from OpenAI's own model-picker guidance before choosing a specific ID, since two full generations are listed as active at once.
- **Cached input discount:** consistently 10% of standard input price across the lineup (e.g., gpt-5: $1.25 → $0.125 cached; gpt-6-astra: $10 → $1 cached).
- **Batch API discount:** flat 50% off input, cached-input, and output uniformly across every row that has a batch price listed.
- **Web search tool cost (official, from same pricing page):** "Web search preview" — $10.00 per 1,000 calls when used with reasoning models (gpt-5 line, o-series), search content tokens billed at model rates; $25.00 per 1,000 calls for non-reasoning models with search content tokens free.
- **Context window:** exact numeric context windows were **not stated in the pricing table** (it shows a "short context" vs. "long context" price split rather than token counts) — for exact context sizes, the per-model doc pages (e.g., developers.openai.com/api/docs/models/gpt-5-nano) would need to be read; **not fetched in this pass — UNVERIFIED for exact figures**, though industry-standard reporting puts GPT-5-class context at 400K tokens.
- **OpenAI-compatible endpoint:** trivially yes (native), and the standard shape the site's Lambdas already speak.
- **Region/data residency:** not checked in this pass.
- **Status page:** status.openai.com (also mirrored at platform.openai.com/status).

---

## 5. Perplexity API (Sonar)

Source: https://docs.perplexity.ai/getting-started/pricing (2026-09-27); https://docs.perplexity.ai/models/model-cards (2026-09-27, limited detail returned)

| Model | Input $/1M | Output $/1M | Request/search fee | Context | Source | Accessed |
|---|---|---|---|---|---|---|
| Sonar | $1 | $1 | $5–$12 per 1,000 requests (varies by search-context size: low/medium/high) | not stated in fetched pages — UNVERIFIED | docs.perplexity.ai/getting-started/pricing | 2026-09-27 |
| Sonar Pro | $3 | $15 | $6–$14 per 1,000 requests (by context size) | not stated — UNVERIFIED | same | 2026-09-27 |
| Sonar Reasoning Pro | $2 | $8 | $6–$14 per 1,000 requests (by context size) | not stated — UNVERIFIED | same | 2026-09-27 |
| Sonar Deep Research | $2 | $8 | Citation tokens $2/1M, reasoning tokens $3/1M, searches $5/1,000 (no flat per-request fee; deep-research billing is itemized instead of the flat request fee used by the other three models) | not stated — UNVERIFIED | same | 2026-09-27 |

Notes:
- The per-request search fee for the non-deep-research models is tiered by "search context size" (low/medium/high), each with its own $/1,000-request rate; the pricing page doesn't map "low/medium/high" to a token-count definition in the excerpt retrieved.
- Model-card page (docs.perplexity.ai/models/model-cards) did not surface context-window numbers or an explicit OpenAI-compatibility statement in this fetch; Perplexity's Sonar API is widely known to use an OpenAI-compatible `chat/completions` shape via `https://api.perplexity.ai`, but that specific claim was **not independently confirmed on an official page in this pass** — mark **UNVERIFIED** per the "grep or ask, never assume" rule, even though it is very likely true and consistent with how the site's Studio already lets readers bring a Perplexity key.
- Perplexity has migrated its status infrastructure from Instatus to incident.io; the current official status page is at **status.perplexity.ai** (per docs.perplexity.ai's own status references).
- Region/data-residency: not stated in pages fetched.

---

## 6. Qwen (Alibaba Cloud Model Studio) — optional, international pricing

Source: third-party aggregators only in this pass (see caveat below); official Alibaba Cloud Model Studio pricing page (alibabacloud.com/help/en/model-studio/model-pricing) was not directly fetched due to effort/time budget — **treat every number below as UNVERIFIED against an official page**, pending a follow-up fetch.

| Model | Input $/1M (reported) | Output $/1M (reported) | Notes |
|---|---|---|---|
| Qwen3.8-Flash | $0.14 | $0.42 | UNVERIFIED — third-party source only |
| Qwen3.7-Plus | $0.40 | $1.20 | UNVERIFIED |
| Qwen3.5-Flash | $0.10 | $0.40 | UNVERIFIED |
| Qwen3.5-Plus | $0.40 | $2.40 | UNVERIFIED |
| Qwen3.8-Max | $2.00 | $6.00 | UNVERIFIED |

- **OpenAI-compatible endpoint:** confirmed via Alibaba Cloud's own doc title "Call Qwen models via OpenAI API" (help.aliyun.com/en/model-studio/compatibility-of-openai-with-dashscope) — international base URL `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`, with region-specific variants for Virginia (US), Singapore, Tokyo, and Hong Kong. This part is confirmed from an official Alibaba Cloud help page title/URL, but the pricing table itself was not fetched — pricing rows above remain UNVERIFIED.
- **Region/data residency:** the multiple regional base URLs above (US/Singapore/Tokyo/Hong Kong) suggest Alibaba does offer some regional routing choice for Qwen, but the exact data-residency guarantees per region were not confirmed on an official page in this pass.

---

## Cross-cutting notes / caveats

1. **Free-tier data use is the sharpest differentiator found:** Google's own terms confirm free-tier Gemini traffic (which is what the site currently uses for Gemini 2.5 Flash) is used to improve Google's products and subject to human review, while paid-tier traffic is not. This is a live consideration for a news-intelligence product processing potentially source-sensitive text through the free tier.
2. **DeepSeek off-peak discount is exactly 2x, not tiered** — a batch job that can be scheduled into the UTC 10:00–01:00 (i.e., outside 01:00-04:00 and 06:00-10:00) or all-weekend window pays half. This maps directly onto the site's daily/hourly cron jobs and is worth checking against the deploy schedule in `project-docs`.
3. **Anthropic's OpenAI-compat layer is explicitly not production-grade** and drops prompt caching — if Claude models are ever added through the site's existing OpenAI-compatible Lambda plumbing (rather than the native Anthropic SDK), caching-driven cost savings would be lost. Native SDK integration would be required to keep that lever.
4. **OpenAI's pricing page currently lists two full model generations simultaneously** (GPT-5.x and GPT-6.x families) as of the access date — this is unusual enough that it's worth a manual confirmation directly on the live page before any procurement decision, since a fast-changing table increases the odds this snapshot ages quickly.
5. **Gemini's free-tier RPM/RPD/TPM per model could not be pulled from a static docs page** — Google now serves those numbers only through the live AI Studio dashboard (aistudio.google.com/rate-limit), which requires an authenticated session and was not accessed in this pass. Anyone re-verifying this table should pull those numbers directly from the dashboard under the project's own Google account, not from this document.
6. **Qwen pricing in this report is UNVERIFIED** — it's included per the "optional" instruction from third-party aggregator summaries only, since the official Alibaba Cloud Model Studio pricing page itself wasn't fetched in this pass. Treat the Qwen section as directional only.
7. **Perplexity Sonar context-window sizes and the OpenAI-compatibility claim are UNVERIFIED** — the fetched pages didn't state them explicitly; both are very likely true from general knowledge of the product but were not confirmed against an official page in this pass, per the "no assumptions" rule.
8. **Anthropic status uptime (98.6%) and DeepSeek status figures (99.6–99.8%) came from third-party aggregators, not an official SLA page** — cite them as directional, not contractual.
