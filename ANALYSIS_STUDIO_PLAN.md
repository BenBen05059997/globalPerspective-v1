# Analysis Studio (`/analyze`) — Plan

**Status:** DESIGN / not started. Created 2026-06-10.
**Goal:** A page where a signed-in user **picks real stories from our data and gets a deep, cited analysis** — turning a passive reader into an active analyst. This is the feature that the future Polar **credits** will meter (see [`POLAR_BILLING_PLAN.md`](./POLAR_BILLING_PLAN.md) Decision #5). **Build the feature first, monetize later.**

> Sequencing decision (2026-06-10): build `/analyze` **before** billing. You can't sell per-run credits for a feature that doesn't exist or isn't proven good.
>
> **Testing phase = BYOK (Bring Your Own API Key), NO cap (2026-06-10).** During testing the **user supplies their own LLM API key** and pays for their own tokens — so there's zero cost to us and **no usage cap needed**. The key lives **only in the user's browser** (localStorage), and the analysis call goes **browser → provider directly**; our servers never see, log, or store it. Our data is already public, so the testing version may need **no backend at all** (browser → our proxy for records, browser → provider for the LLM call). Later, when we provide the compute, we swap BYOK for **our** key + Polar **credits**.

---

## Core decision — offer BOTH input modes, compare them (2026-06-10)

Two input modes, **same engine + same guardrails underneath**. The experiment is purely the input UX; we ship both and let real usage tell us which wins.

| Mode | Input | Best for |
|------|-------|----------|
| **Guided** | pick stories → choose a fixed **lens** (template) | repeatable, pro-feeling output; new users |
| **Free-form** | pick stories → **ask anything** (open prompt) | power users with a specific question |

**Both modes share the non-negotiable guardrails** (this is the honesty contract, NOT the thing being A/B-tested):
- Every claim cites a real `topicId`/source from the **selected** stories. Uncited claims dropped.
- "Insufficient data" / honest refusal rather than hallucinate when our corpus doesn't cover the ask ([[feedback-no-misinformation-fallback]]).
- A sensible **token bound** per run (good output hygiene; cost is on the user's own key during BYOK, becomes a credit-priced ceiling later).
- Answer is locked to the user's **selected** records — free-form is "ask anything *about these stories*," not open web chat.

### Guided lenses (v1 set — fixed templates, each = a system prompt + output schema)
1. **Scenario forecast** — named scenarios + probabilities + dated triggers (reuse our prediction frame).
2. **Winners & losers** — who benefits / who's hurt, by actor and sector.
3. **Economic ripple** — instruments/sectors affected, direction, mechanism (reuse `ECONOMIC_IMPACT` frame).
4. **Root-cause chain** — immediate trigger → medium-term condition → structural factor (reuse thread `rootCauseChain` frame).
5. **Compare stories** — synthesize 2–4 selected stories: common drivers, divergences, combined outlook.

> Add more lenses over time — it's data-only (a new template entry). Optional free-text "focus note" allowed in Guided mode too.

### How we "see what is better"
Lightweight, no heavy infra:
- Post-result **rating**: 👍/👎 + optional "was this useful?" one-liner.
- Track which `mode` (guided/free-form) and which `lens` get used, completion rate, repeat usage.
- During BYOK testing this can be **client-side / minimal** (e.g. a tiny fire-and-forget log, or just our own dogfooding) — no need for a usage-cap table since there's no cap. A proper `GlobalPerspectiveAnalysisLog` table comes with the credits phase.

---

## Our moat (why this beats pointing ChatGPT at our RSS)

We don't analyze raw articles — we **synthesize across our own pre-computed intelligence** already in DynamoDB: topic `SUMMARY`/`PREDICTION`/`TRACE_CAUSE`, `THREAD_ANALYSIS`, `COUNTRY_INTELLIGENCE`, `SYSTEMS_ANALYSIS`, `ECONOMIC_IMPACT`. Richer than raw-article analysis, partly cached (cheaper), and impossible to replicate without our pipeline. Citations to the exact source are the trust pitch (the lesson from AlphaSense/Perplexity/Ground News).

---

## UX sketch (`/analyze`, signed-in)

0. **Provider/model chooser modal (BYOK, testing phase)** — a modal where the user **chooses their provider + model and pastes their key**:
   - **Provider dropdown** → **Model dropdown** (models filtered to the chosen provider) → **API key field**.
   - Stored in **browser localStorage only** (`{ provider, model, baseUrl, key }`), with a clear note: *"Your key + choice stay in your browser and are never sent to our servers."* "Clear key" button + a "Change model" affordance.
   - **Two code paths:** (a) one **OpenAI-compatible** chat-completions path covers OpenAI / DeepSeek / Gemini (OpenAI-compat endpoint) / OpenRouter — just swap `baseUrl`/`model`/auth header; (b) a **small separate Anthropic adapter** (`/v1/messages`, `x-api-key` + `anthropic-version` headers, top-level `system`).
   - **Providers in the modal (confirm + CORS-check each at build):**
     - **OpenAI** — `gpt-*` models.
     - **DeepSeek** — `deepseek-chat` (matches our pipeline, cheap).
     - **Google Gemini** — via OpenAI-compat endpoint, `gemini-2.5-*`.
     - **OpenRouter** — one key fronts many models, browser-CORS friendly.
     - **Anthropic** — Claude models (**Opus 4.8** deepest, **Sonnet 4.6** balanced/default, **Haiku 4.5** cheap, **Fable 5**); browser calls need `anthropic-dangerous-direct-browser-access: true`. Confirm exact model IDs + request shape against the `claude-api` reference when wiring the adapter.
   - Prefer browser-callable providers; any that block browser CORS fall back to the no-store pass-through.
   - (Later this whole modal disappears — we provide the key/compute and meter via Polar credits.)
1. **Select stories** — from today's topics / a search over our data / a thread / a country. Multi-select 1–4.
2. **Choose mode** — toggle: **Guided** (lens dropdown) ↔ **Free-form** (prompt box). Optional focus note.
3. **Run** → loading state → **cited structured report** (claims link to source stories) + 👍/👎 rating + "Run another."

New route `/analyze` + `AnalysisStudio.jsx`. Entry points: a nav item + an "Analyze this" button on topic/thread/country cards (pre-selects that story).

---

## Backend sketch

### Testing phase (BYOK) — likely NO new backend
With client-side BYOK the flow is fully client-side:
1. Browser fetches the selected records from our **existing public proxy** (`topics`, `summary`, `thread_analysis`, `country_intelligence`, `economic_impact`, etc.) — already available, no auth.
2. Browser builds the prompt (lens template or user prompt + records + cite-or-refuse guardrail) and calls the **LLM provider directly** with the user's key (`MAX_TOKENS` bound).
3. Browser post-parses (drop uncited claims) and renders `{ report, citations[] }`.
- **Key never leaves the browser.** Nothing new to deploy backend-side for testing.
- ⚠️ **Verify at build time:** does the chosen provider allow **direct browser calls (CORS)**? If yes → pure client-side. If no → thin **no-store pass-through** Lambda that forwards the request with the user's key (passed per-request, **never persisted, never logged**) purely to dodge CORS. Pick a browser-callable provider first to avoid this.

### Credits phase (later) — `newsAnalyze` Lambda
When we provide the compute: Function URL, **Firebase-JWT gated** (reuse the proven `verifyFirebaseToken` from `newsSensitiveData`/`newsSavedItems`/`newsRecommend`), checks credit balance, loads records server-side, calls **DeepSeek V4** with **our** key, decrements credits, logs the run. Reuses existing DeepSeek plumbing + DDB read patterns.

---

## Open questions
- **Providers in the chooser modal:** OpenAI, DeepSeek, Gemini, OpenRouter (OpenAI-compatible path) **+ Anthropic** (separate adapter). Confirm browser-CORS per provider at build.
- Story selection surface: just today's topics, or full archive search? (lean: today's topics + recent threads for v1.)
- Max stories per run (lean: 4 — bounds tokens).

## Sequencing
1. **Now (BYOK, no cap):** build `/analyze` — both modes, all honesty guardrails, key stored browser-only, analysis run on the user's own key. Likely no new backend.
2. **Then:** observe which mode/lenses win; tune prompts + lenses.
3. **Later (credits):** swap BYOK → our key behind the `newsAnalyze` Lambda + Polar credits, per [`POLAR_BILLING_PLAN.md`](./POLAR_BILLING_PLAN.md).
