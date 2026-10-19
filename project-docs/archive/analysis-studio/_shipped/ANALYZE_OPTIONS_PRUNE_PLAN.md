# Analysis Studio — Options Prune Plan

> **Thesis:** `/analyze`'s value is **our data + honest guardrails**, not variety. The
> options list (7 providers × ~25 models; 5 guided lenses) grew by accretion and was
> never pruned. Every option that a generic ChatGPT tab answers equally well *dilutes*
> the "this needs our data" story — and the two weakest lenses are also the two with the
> least quality hardening. **Prune to the necessary set; tier the rest.** No new
> capability — this is subtraction + a maintenance refresh.
>
> Status: ✅ DONE — the prune is executed in code (`utils/analysisPrompt.js` LENSES = scenario/economic/compare only; winners_losers/root_cause removed; OpenRouter dropped from `services/llm.js`). [Corrected 2026-09-08 doc-staleness sweep — prior "PLANNED (2026-07-24). Not started." was stale.] Originally verified against live code this session
> (`utils/analysisPrompt.js` LENSES, `components/AnalysisStudio.jsx` modes,
> `services/llm.js` PROVIDERS). Related: `ANALYSIS_STUDIO_PLAN.md`,
> `ANALYSIS_PRO_STRUCTURE_PLAN.md`, `QWEN_AND_VISUAL_BLOCK_PLAN.md`,
> memory `project_analysis_studio`.

## Why now

- All the 06-13 → 07-10 quality hardening (ICD-203 structure, gp-struct visuals, MECE
  calibration, thin-input guard) targeted **Scenario forecast + Economic ripple**. The
  other lenses ride along **untested** — so the guardrails cover ~60% of what a user can
  actually pick. Pruning to the hardened set makes coverage ~100% *by subtraction*.
- Pre-surfacing usage was ~2 runs/30d → **no demand data** justifies the long tail. The
  list is supply-driven, not demand-driven.
- The model-ID lists have already gone stale (see P3) — a smaller surface is a
  maintainable surface.

---

## P1 — Guided lenses: 5 → 3 (the core change)

Current (`analysisPrompt.js` LENSES): `scenario`, `winners_losers`, `economic`,
`root_cause`, `compare`.

| Lens | Decision | Rationale |
|---|---|---|
| **Scenario forecast** (`scenario`) | **KEEP — flagship** | Signature output; MECE probabilities + `Indicator\|Confirms\|Kills` table + ScenarioBars. Backed by our prediction log. Most-hardened lens. |
| **Economic ripple** (`economic`) | **KEEP** | direction→magnitude→mechanism + RippleTable; ties to `/economy` + market data. Second-most-hardened. |
| **Winners & losers** (`winners_losers`) | **MERGE → economic** | Largely a subset of ripple (who benefits/loses ≈ ripple by actor). No unique visual, little dedicated testing. Fold in as a "Who's exposed" section of the economic lens task. |
| **Root-cause chain** (`root_cause`) | **CUT or REBORN** | Weakest slot: the pipeline **already computes `TRACE_CAUSE`** per story and feeds it in as *input context* — this lens asks the model to re-derive what we hand it = generic-LLM work. Either drop it, or reframe (P1b) as the genuinely-novel **"Challenge our causal chain"** — interrogate/extend the existing trace, surface a missing link or a weak one. Only worth keeping in the reborn form. |
| **Compare stories** (`compare`) | **KEEP — conditional** | Cross-story synthesis; meaningless with 1 story selected. Show the option **only when ≥2 stories are selected** (dead/confusing otherwise). |

**Target lens set:** Scenario forecast · Economic ripple (absorbs winners/losers) ·
Compare (≥2 stories) — plus, if we do P1b, "Challenge our causal chain."

### P1b (optional, decide during build) — reborn Root-cause
If kept: rewrite the `root_cause` task from "derive the causal chain" to "here is our
cached causal trace `[TRACE_CAUSE]` — stress-test it: what's the weakest link, what
event would break it, what's missing?" This is unique to us (we have the trace to
challenge) and dodges the "generic LLM" critique. If we don't want the scope, **cut it**.

### Honesty / no-regression rules (P1)
- **Additive-safe deletion:** removing a lens id must not break saved deep-links
  (`?stories=` + any lens param) — unknown lens → fall back to Scenario forecast, don't
  error ([[feedback_no_unauthorized_removal]] — this is an intentional, recorded prune,
  not a silent drop; note it in CHANGES).
- Folding winners/losers into economic must **preserve the anti-fabrication counterweight
  wording** already in that lens (don't let the merge reintroduce invented org names).
- The merged economic lens still emits its `gp-struct` `ripples` block (the 07-10
  reliability fix) — verify emission after the edit (`emit-test`-style check).

---

## P2 — Modes: keep all 3 (no change, documented decision)

`guided` / `freeform` / `deep`. All three earn their slot — recorded here so a future
pass doesn't re-litigate:
- **Guided** — decision-grade structure + visuals (the flagship path).
- **Free-form** — proven honesty role: correctly **refused** a thin rumor where guided
  over-reached (06-11 audit). A mode that can say "no" is worth keeping on an
  honesty-branded product.
- **Deep research** — the only web-grounded path (Perplexity always-search / Anthropic
  search tool). Distinct capability; already honestly gated (disabled + tooltip for
  no-search providers).

**No mode changes.** Only the lens list inside Guided shrinks.

---

## P3 — Provider modal: tier + trim + refresh (maintenance)

Not "which model is best" — this is about **not presenting 7 providers × ~25 models as
equals** to a first-run user (choice-as-friction) and killing dead model IDs.

1. **Tier the modal** (presentation only, no removal needed for the top set):
   - **Recommended:** DeepSeek (what members run) · Gemini (genuinely free key = the $0
     onboarding ramp).
   - **More providers** (collapsed): OpenAI (everyone-has-a-key segment), Anthropic
     (second search path + high-end), Perplexity (**the** always-search provider — keep,
     it's why deep mode exists).
2. **Retire OpenRouter** — pure duplication (reaches DeepSeek/Claude/GPT that already
   have first-class rows) and the hardest model list to keep current.
3. **Grandfather Qwen** — added 07-10 for the operator's own free key; real users with
   DashScope *workspace* keys ≈ 0. Show the Qwen row **only if a saved Qwen key already
   exists** (don't offer it fresh; don't break the operator's saved config).
4. **Refresh model IDs on the survivors** — verified aging this session: `gpt-4o`/`4.1`,
   `gemini-2.5`, `claude-sonnet-4-6`. Update to current (Sonnet 5, current GPT/Gemini);
   the memory already flags Anthropic IDs as "re-confirm if a run 404s." 5 short lists is
   maintainable; 7 wasn't.

Net: modal goes from a **7 × ~25 grid → 2 obvious choices + an advanced drawer**, keeps
both search paths, keeps the free ramp, shrinks the stale-ID surface ~40%.

---

## P4 — Verify the prune didn't cost quality (the point of doing it)

The whole justification is "hardened lenses cover ~100% after the cut." Prove it:
1. `cd global-perspectives-starter/frontend && npm run verify` (lint/typecheck/build).
2. Run `quality/analysis/check.mjs` on live stories through **each surviving lens** on the
   member config (v4-pro) — validator must be **0 fabrication**, `gp-struct` emits + all
   numbers survive `validateStruct`. (This also fills the **stale-sample gap**: current
   committed samples are all 2026-06-13, none on the live v4-pro config.)
3. Deep-link regression: a `?stories=…` link pointing at a **removed** lens falls back to
   Scenario forecast, no crash.
4. Browser click-through: modal tiering renders; Compare hidden at 1 story, shown at 2;
   Qwen hidden with no saved key, shown with one.

## Build order
1. P1 lens edits (`analysisPrompt.js` LENSES + `AnalysisStudio.jsx` lens picker;
   Compare-conditional; winners/losers merge; decide P1b cut-vs-reborn).
2. P3 provider tiering (`ProviderModal.jsx` + `llm.js` — tier metadata, drop OpenRouter,
   Qwen-conditional, refresh IDs).
3. P4 verify (verify + check.mjs per lens + deep-link + browser).
4. CHANGES.md entry (record the intentional lens removals + why).
5. Deploy = `./deploy.sh` (frontend build → docs/ → 404 resync) — **gated, explicit
   per-deploy auth**. Member path (`newsAnalyze`) SYSTEM_PROMPT must stay FE-synced if the
   economic lens task text changes (the patched-deployed-zip method — repo file carries
   PARKED credits code, per memory `project_analysis_studio`).

## Out of scope / open
- Not touching the honesty guardrails, the validator, or `newsAnalyze` gating/model.
- Provider *removal* (vs hide) deferred — hiding is reversible; deletion isn't.
- Demand-driven from here: re-add a provider/lens only when a real user asks.
