# project-docs — Documentation Index

_Regenerated 2026-09-08. Docs are grouped by **feature domain**; within a domain, plans split by status (`_shipped` ✅ · `_active` 🔧 · `_proposed`/not-built 🔭 · `_reference` 📎 superseded-but-cited). Cross-cutting buckets (architecture, audits, strategy, playbooks, ops, distribution, _legacy) hold docs that span domains. Only `CLAUDE.md` + `CHANGES.md` live at the repo root._

**New here?** Read `architecture/ARCHITECTURE.md` (system) + `architecture/SYSTEM_WIRING.md` (code-grounded wiring), then jump to the relevant domain below.

_Not indexed here (separate trees, by purpose): `agent-kit/` = autonomy / verify / deploy playbooks for agents (bindings in `agent-kit/PROJECT.md`); `quality/` = eval + review harnesses and dated QA report snapshots; `internal-docs/` = legal / marketing / ops-internal notes; `predictions/` = forecast-resolution runbook + scripts; `amplify/**/README.md` = per-Lambda notes. See `playbooks/TASK_WORKFLOW.md` for the doc-lifecycle (status folders + supersede-by-banner) and Diátaxis folder convention._


## Architecture & system reference — read first

`project-docs/architecture/`

- **[ANALYTICS_GUIDE.md](architecture/ANALYTICS_GUIDE.md)** — Where to find GA4 / Cloudflare analytics.
- **[ARCHITECTURE.md](architecture/ARCHITECTURE.md)** — Authoritative system overview — Lambda inventory, DDB, routes (living doc).
- **[BACKEND_AUDIT_2026-09-10.md](architecture/BACKEND_AUDIT_2026-09-10.md)** — Whole-fleet Lambda audit (37 function dirs, live-AWS-verified): full inventory + 14 ranked cross-backend findings + deploy-model corrections. Evidence base for the 2026-09-10 ARCHITECTURE.md reconciliation.
- **[BACKEND_GUIDE.md](architecture/BACKEND_GUIDE.md)** — Quick-start Lambda function table.
- **[DATA_STRATEGY.md](architecture/DATA_STRATEGY.md)** — **ADOPTED 2026-09-08.** S3 for the world, DynamoDB for the user: one-writer-per-prefix, inbox/folder event sourcing, `world/latest.json` frontend contract, table-migration order. Binding for all new subsystems.
- **[OPTIMIZATION_REPORT.md](architecture/OPTIMIZATION_REPORT.md)** — Evidence-based (file:line) perf/cost fix list; companion to SYSTEM_WIRING.
- **[PAGES_GUIDE.md](architecture/PAGES_GUIDE.md)** — Page-by-page reference + 3-layer smoke-test convention.
- **[SYSTEM_WIRING.md](architecture/SYSTEM_WIRING.md)** — Code-grounded frontend↔backend↔DDB wiring; overrides ARCHITECTURE on drift.

## Analysis Studio (/analyze)

`project-docs/analysis-studio/`


**✅ shipped**
- **[ANALYSIS_PRO_STRUCTURE_PLAN.md](analysis-studio/_shipped/ANALYSIS_PRO_STRUCTURE_PLAN.md)** — Analysis Studio ICD-203 packaging upgrade — shipped.
- **[ANALYZE_OPTIONS_PRUNE_PLAN.md](analysis-studio/_shipped/ANALYZE_OPTIONS_PRUNE_PLAN.md)** — Provider/lens prune (5→3) — done.
- **[ANALYZE_SURFACING_PLAN.md](analysis-studio/_shipped/ANALYZE_SURFACING_PLAN.md)** — Surfacing /analyze across the site — shipped.

**🔧 active**
- **[QWEN_AND_VISUAL_BLOCK_PLAN.md](analysis-studio/_active/QWEN_AND_VISUAL_BLOCK_PLAN.md)** — DeepSeek visual-block fix + Qwen BYOK provider.

**🔭 proposed**
- **[SUMMARY_VERIFICATION_PLAN.md](analysis-studio/_proposed/SUMMARY_VERIFICATION_PLAN.md)** — AI-truth verification — §1 grounding shipped, judge layer absent.

**📎 reference**
- **[ANALYSIS_QUALITY_COMPARISON_PLAN.md](analysis-studio/_reference/ANALYSIS_QUALITY_COMPARISON_PLAN.md)** — Rubric study vs professional standards.
- **[ANALYSIS_SOURCE_TRUTH_PLAN.md](analysis-studio/_reference/ANALYSIS_SOURCE_TRUTH_PLAN.md)** — Source-truth layer — L1 shipped, L2 auditor unbuilt.
- **[ANALYSIS_STUDIO_BENCHMARK_PLAN.md](analysis-studio/_reference/ANALYSIS_STUDIO_BENCHMARK_PLAN.md)** — Benchmark→check reframe (superseded).
- **[ANALYSIS_STUDIO_DEEP_RESEARCH_PLAN.md](analysis-studio/_reference/ANALYSIS_STUDIO_DEEP_RESEARCH_PLAN.md)** — Deep-research web mode — shipped.
- **[ANALYSIS_STUDIO_PLAN.md](analysis-studio/_reference/ANALYSIS_STUDIO_PLAN.md)** — Core /analyze feature plan — shipped (historical).
- **[ANALYSIS_STUDIO_TESTING_PLAN.md](analysis-studio/_reference/ANALYSIS_STUDIO_TESTING_PLAN.md)** — Output validator/eval plan.

## Economy layer

`project-docs/economy/`

- **[ECONOMIC_DISRUPTION.md](economy/ECONOMIC_DISRUPTION.md)** — Economic-disruption concept & methodology (domain reference).

**✅ shipped**
- **[ECONOMIC_DISRUPTION_PLAN.md](economy/_shipped/ECONOMIC_DISRUPTION_PLAN.md)** — Economic Disruption layer build — Phases 1–2 shipped.
- **[ECONOMY_UX_PLAN.md](economy/_shipped/ECONOMY_UX_PLAN.md)** — /economy UX overhaul (filters/skeletons/mobile) — shipped.
- **[WEEKLY_MARKETS_PLAN.md](economy/_shipped/WEEKLY_MARKETS_PLAN.md)** — Weekly markets wrap (/economy This-week) — shipped.

**🔭 proposed**
- **[ECONOMY_BRIEFING_PLAN.md](economy/_proposed/ECONOMY_BRIEFING_PLAN.md)** — 'Today in the economy' briefing — Phase 1 shipped, Phase 2 proposed.

**📎 reference**
- **[ECONOMIC_DISRUPTION_QUALITY_PLAN.md](economy/_reference/ECONOMIC_DISRUPTION_QUALITY_PLAN.md)** — Quality-layer roadmap (A/B/C shipped; D/E lapsed).
- **[ECONOMIC_DISRUPTION_VIZ_PLAN.md](economy/_reference/ECONOMIC_DISRUPTION_VIZ_PLAN.md)** — Visualization/deep-link plan — partially shipped.
- **[ECONOMIC_DISRUPTION_WIRING_PLAN.md](economy/_reference/ECONOMIC_DISRUPTION_WIRING_PLAN.md)** — UI structural-integration plan — P0 landed.
- **[ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md](economy/_reference/ECONOMIC_INSTRUMENT_UNIVERSE_PLAN.md)** — Instrument universe selection (Stooq wiring dead → Yahoo).
- **[ECONOMIC_VERIFICATION_PLAN.md](economy/_reference/ECONOMIC_VERIFICATION_PLAN.md)** — Verification-loop checklist (scripts now exist).

## Predictions & calibration

`project-docs/prediction/`

- **[PREDICTION_V1_EXAMPLE.md](prediction/PREDICTION_V1_EXAMPLE.md)** — Worked example companion to the prediction plan.

**✅ shipped**
- **[LIVING_ANALYSIS_PLAN.md](prediction/_shipped/LIVING_ANALYSIS_PLAN.md)** — Self-correcting corrector→drift-note→analyzer loop — live.
- **[PREDICTION_METHODOLOGY_V1_PLAN.md](prediction/_shipped/PREDICTION_METHODOLOGY_V1_PLAN.md)** — Forecast pipeline rebuild — 4 phases shipped (Brave grounding inert in prod).
- **[RISK_TIERS_PLAN.md](prediction/_shipped/RISK_TIERS_PLAN.md)** — Score→tier migration (25/50/75) — complete.
- **[SCORING_MODEL_V2_PLAN.md](prediction/_shipped/SCORING_MODEL_V2_PLAN.md)** — Multi-axis risk scoring — phases A–D deployed; C/E pending.

**🔭 proposed**
- **[CALIBRATION_DIGEST_PLAN.md](prediction/_proposed/CALIBRATION_DIGEST_PLAN.md)** — Forecast calibration digest — designed, data-gated, DO NOT BUILD yet.

## Membership & billing

`project-docs/billing/`


**✅ shipped**
- **[MEMBER_GATING_PLAN.md](billing/_shipped/MEMBER_GATING_PLAN.md)** — Depth-gating (not whole pages) — deployed.

**🔧 active**
- **[POLAR_BILLING_PLAN.md](billing/_active/POLAR_BILLING_PLAN.md)** — Live billing spec — subscription live; credits built, not in prod. ⚠ token rotation open.
- **[PROD_CREDITS_NEXT_STEPS.md](billing/_active/PROD_CREDITS_NEXT_STEPS.md)** — Ordered go-live checklist for analysis credits.

## Alerts, email & notifications

`project-docs/alerts-email/`

- **[BREAKING_ALERT_DEBATE_2026-06-24.md](alerts-email/BREAKING_ALERT_DEBATE_2026-06-24.md)** — Multi-agent urgency-scoring debate.
- **[NOTIFICATION_GAP_ANALYSIS.md](alerts-email/NOTIFICATION_GAP_ANALYSIS.md)** — Competitive gap analysis for notifications.
- **[SCORING_RUBRIC.md](alerts-email/SCORING_RUBRIC.md)** — Breaking-alert scoring source of truth.

**✅ shipped**
- **[EMAIL_SENDER_PLAN.md](alerts-email/_shipped/EMAIL_SENDER_PLAN.md)** — Unified weekly+breaking+drift email Lambda — live.
- **[FOLLOW_SURFACING_PLAN.md](alerts-email/_shipped/FOLLOW_SURFACING_PLAN.md)** — FollowButton surfacing on the ledger — shipped.
- **[RECOMMENDATIONS_AND_DIGEST_PLAN.md](alerts-email/_shipped/RECOMMENDATIONS_AND_DIGEST_PLAN.md)** — Recs engine + email digest — live.
- **[SETTINGS_MENU_PLAN.md](alerts-email/_shipped/SETTINGS_MENU_PLAN.md)** — Notification settings menu — shipped.
- **[WEEKLY_DIGEST_PLAN.md](alerts-email/_shipped/WEEKLY_DIGEST_PLAN.md)** — Weekly Signals Brief — live.

**🔧 active**
- **[DRIFT_EMAIL_ACTIVATION_PLAN.md](alerts-email/_active/DRIFT_EMAIL_ACTIVATION_PLAN.md)** — Drift-email activation ladder (cron disabled by design).

**📎 reference**
- **[BREAKING_ALERTS_PLAN.md](alerts-email/_reference/BREAKING_ALERTS_PLAN.md)** — Breaking-news email alert build — Phase 4 live, verify stubbed.
- **[BREAKING_ALERT_V2_BUILD_PLAN.md](alerts-email/_reference/BREAKING_ALERT_V2_BUILD_PLAN.md)** — Re-scored alert scorer — Stage 1 coded, NOT deployed to prod.

## Causal web / Spider / dossier

`project-docs/causal-web/`

- **[EVENT_DOSSIER_SPEC.md](causal-web/EVENT_DOSSIER_SPEC.md)** — AI-legible export contract for the causal web.
- **[SPIDER_BUILD_SPEC.md](causal-web/SPIDER_BUILD_SPEC.md)** — Data contract for the two-tier Causal Web.
- **[SPIDER_DEMO_DESIGN_BRIEF.md](causal-web/SPIDER_DEMO_DESIGN_BRIEF.md)** — Design brief for the Causal Web view.

**🔭 proposed**
- **[ENTERPRISE_ANALYST_TOOL_PLAN.md](causal-web/_proposed/ENTERPRISE_ANALYST_TOOL_PLAN.md)** — Enterprise analyst tool — strategy open.
- **[SPIDER_WEB_MODEL_PLAN.md](causal-web/_proposed/SPIDER_WEB_MODEL_PLAN.md)** — Causal-web data-model redesign — build-ready.

## Pair intelligence

`project-docs/pairs/`


**✅ shipped**
- **[PAIR_INTELLIGENCE_PLAN.md](pairs/_shipped/PAIR_INTELLIGENCE_PLAN.md)** — Pair intelligence backend — built & live (data feeds /map).

**🔭 proposed**
- **[PAIR_UI_PLAN.md](pairs/_proposed/PAIR_UI_PLAN.md)** — Dedicated pair pages — NOT built (only /map arc consumes the data).

## Ingest & impact-first pipeline

`project-docs/pipeline-ingest/`

- **[IMPACT_AUDITOR.md](pipeline-ingest/IMPACT_AUDITOR.md)** — Impact-auditor design + first real run.
- **[IMPACT_FIRST_REDESIGN_PLAN.md](pipeline-ingest/IMPACT_FIRST_REDESIGN_PLAN.md)** — Root-cause master plan tying audits together.
- **[IMPACT_VALIDATION_METHODOLOGY.md](pipeline-ingest/IMPACT_VALIDATION_METHODOLOGY.md)** — QA methodology for impact-first pipeline.

**✅ shipped**
- **[RSS_CLOUDFLARE_TODO.md](pipeline-ingest/_shipped/RSS_CLOUDFLARE_TODO.md)** — RSS proxy via Cloudflare Worker — complete.
- **[SIGNAL_API_PLAN.md](pipeline-ingest/_shipped/SIGNAL_API_PLAN.md)** — Signal API v1 — deployed (~5,720 signals; 0 keys minted).
- **[SOURCE_DIVERSITY_PLAN.md](pipeline-ingest/_shipped/SOURCE_DIVERSITY_PLAN.md)** — Multi-source citation diversity — shipped, enabled.
- **[continue-news.md](pipeline-ingest/_shipped/continue-news.md)** — Cache-refresh (stale-while-revalidate) plan.

## AI provider / model ops

`project-docs/ai-provider/`

- **[DEEPSEEK_QUALITY_AUDIT.md](ai-provider/DEEPSEEK_QUALITY_AUDIT.md)** — Output-quality pass/fail audit for DeepSeek V4.

**✅ shipped**
- **[AI_PROVIDER_MIGRATION_PLAN.md](ai-provider/_shipped/AI_PROVIDER_MIGRATION_PLAN.md)** — Grok→DeepSeek/Gemini cost migration history.
- **[BACKEND_DEEPSEEK_V4_MIGRATION_PLAN.md](ai-provider/_shipped/BACKEND_DEEPSEEK_V4_MIGRATION_PLAN.md)** — deepseek-chat→V4 fleet migration — done (under incident).
- **[DEEPSEEK_V4_STRAGGLERS_PLAN.md](ai-provider/_shipped/DEEPSEEK_V4_STRAGGLERS_PLAN.md)** — Cleanup of unmigrated DeepSeek consumers.

## Redesign & UX

`project-docs/redesign-ux/`


**✅ shipped**
- **[PRODUCT_IMPROVEMENT_PLAN.md](redesign-ux/_shipped/PRODUCT_IMPROVEMENT_PLAN.md)** — 13-agent debate-driven UI/philosophy plan — P0/P1/P2 shipped.
- **[REDESIGN_PLAN.md](redesign-ux/_shipped/REDESIGN_PLAN.md)** — v1 redesign + markets data — shipped.
- **[SITE_ORIENTATION_PLAN.md](redesign-ux/_shipped/SITE_ORIENTATION_PLAN.md)** — Home/nav orientation + bot pre-render — shipped.

**🔧 active**
- **[MAP_HOME_SITUATION_PLAN.md](redesign-ux/_active/MAP_HOME_SITUATION_PLAN.md)** — Map becomes the home page: per-article ingest classification + GDELT (drops Brave from ingest), GDACS un-shadowed, new `newsSituationTracker` (adaptive re-check cadence), WebGL 2.5D hue-by-crisis-type map. Approved 2026-09-08; **v2 (stages S0–S8) after the DATA_STRATEGY decision** — S3-backed situations/stories/`world/latest.json`, Worker-served. P0 done, P1·T1 shipped-then-superseded. Tracked in **[MAP_HOME_SITUATION_LEDGER.md](redesign-ux/_active/MAP_HOME_SITUATION_LEDGER.md)**.
- **[SITUATION_BACKEND_AUDIT.md](redesign-ux/_active/SITUATION_BACKEND_AUDIT.md)** — Deep live-AWS audit of `newsGdacsIngest`→`newsSituationIngest`→`newsSituationTracker`→S3→Worker→`/map`: 14 ranked findings (storyId fragmentation is the root cause of tracker churn) informing the slice 4+5 tuning plan. 2026-09-10.
- **[MANAGEMENT_PROPOSAL_2026-09-11.md](architecture/MANAGEMENT_PROPOSAL_2026-09-11.md)** — DRAFT system-management proposal synthesized from the backend+frontend audits: 8 moves (deploy manifest, env hygiene, vendored shared/, contract checks, cron guards, audit-sweep playbook, frontend lazy()+dead-code, test rebalance) with accept/reject reasoning, sequencing, and an explicit do-not-do list. Awaiting operator decisions. 2026-09-11.
- **[FRONTEND_STRUCTURE_AUDIT_2026-09-11.md](architecture/FRONTEND_STRUCTURE_AUDIT_2026-09-11.md)** — Frontend audited to the backend's standard: 27-route inventory, the full page→hook→endpoint→table data-contract map, ARCHITECTURE.md frontend drift list (map-as-home components undocumented), dead appsyncProxy, caching-key inventory. 2026-09-11.
- **[FRONTEND_QUALITY_AUDIT_2026-09-11.md](architecture/FRONTEND_QUALITY_AUDIT_2026-09-11.md)** — Frontend debt ranked: no route-level code-splitting (1.3MB main chunk), verified dead-code kill list (WorldMap/MapSidePanel/MiniMap), 20 hooks hand-rolling the same cache block, test coverage inverted (legacy map tested, live /map untested). 2026-09-11.
- **[EVENT_REGISTRY_PLAN.md](redesign-ux/_active/EVENT_REGISTRY_PLAN.md)** — One source of truth for event identity: the map's `stories/` layer becomes the canonical event registry, editorial becomes a selection over it; deterministic pins→threads bridge via exact article-URL overlap (fuzzy matching banned per T3c). Phases 0–3, spine change shadow-week-gated. Direction approved 2026-09-10; supersedes S7·T1's "selector consumes stories" remainder.

**🔭 proposed**
- **[REDESIGN_V2_PLAN.md](redesign-ux/_proposed/REDESIGN_V2_PLAN.md)** — v2 redesign — Changes A/B/F built via later plans.

## Distribution & channels

`project-docs/distribution/`

- **[BLOG_POST_DEVTO.md](distribution/BLOG_POST_DEVTO.md)** — Dev.to draft post (unpublished).
- **[DEVTO_AI_COST_OPTIMIZATION.md](distribution/DEVTO_AI_COST_OPTIMIZATION.md)** — Dev.to draft post (unpublished).
- **[DEVTO_GLOBAL_NEWS_FOR_DEVELOPERS.md](distribution/DEVTO_GLOBAL_NEWS_FOR_DEVELOPERS.md)** — Dev.to draft post (unpublished).
- **[DEVTO_PUBLISHING_GUIDE.md](distribution/DEVTO_PUBLISHING_GUIDE.md)** — How to publish to Dev.to.
- **[LINKEDIN_WEEKLY_RECAP_PLAN.md](distribution/LINKEDIN_WEEKLY_RECAP_PLAN.md)** — LinkedIn recap — discussion draft, NOT built.
- **[WORKER_FULL_CODE.md](distribution/WORKER_FULL_CODE.md)** — Cloudflare Worker paste-in code snippet.

## Cross-cutting audits & findings

`project-docs/audits/`

- **[BACKEND_TODO.md](audits/BACKEND_TODO.md)** — Backend issue tracker (incl. 2026-09-08 sweep findings).

## Strategy & pitch

`project-docs/strategy/`

- **[ANALYST_TOOL_DIRECTION.md](strategy/ANALYST_TOOL_DIRECTION.md)** — Founder direction pivot — analyst sense-making tool.
- **[PITCH.md](strategy/PITCH.md)** — Code-grounded investor pitch.

## Playbooks & process

`project-docs/playbooks/`

- **[AGENT_REVIEW_METHOD.md](playbooks/AGENT_REVIEW_METHOD.md)** — Multi-agent doc/code verification method (used for the 2026-09-08 sweep).
- **[BUG_PLAYBOOK.md](playbooks/BUG_PLAYBOOK.md)** — On-demand bug-fighting checks (no CI by design).
- **[PLAN_EXECUTION_PLAYBOOK.md](playbooks/PLAN_EXECUTION_PLAYBOOK.md)** — Declare→do→update loop for a multi-phase plan worked task-by-task across sessions/agents; the durable execution-ledger convention (extends TASK_WORKFLOW).
- **[TASK_WORKFLOW.md](playbooks/TASK_WORKFLOW.md)** — Single-task declare-then-update (docs-as-code, same-commit rule).

## Ops & deployment

`project-docs/ops/`

- **[DEPLOYMENT_NOTES.md](ops/DEPLOYMENT_NOTES.md)** — Frontend deploy checklist.
- **[DOMAIN_SETUP.md](ops/DOMAIN_SETUP.md)** — Custom-domain + Cloudflare DNS setup.
- **[SECURITY_DEPLOYMENT_NOTES.md](ops/SECURITY_DEPLOYMENT_NOTES.md)** — CORS/security notes for Lambda.

## Legacy / obsolete

`project-docs/_legacy/`

- **[AUDIT_FINDINGS_2026-06-24.md](_legacy/AUDIT_FINDINGS_2026-06-24.md)** — Fact-checked problem register (source-truth + scoring).
- **[FIX_BACKLOG.md](_legacy/FIX_BACKLOG.md)** — Prioritized action list from the audit session.
- **[FUNCTION_DEBATE.md](_legacy/FUNCTION_DEBATE.md)** — Multi-agent adversarial critique setup.
- **[FUNCTION_DEBATE_OUTPUT.md](_legacy/FUNCTION_DEBATE_OUTPUT.md)** — Synthesis of the 3-agent function critique.
- **[GAMMA_PITCH_WITH_CITATIONS.md](_legacy/GAMMA_PITCH_WITH_CITATIONS.md)** — Superseded Gamma.app pitch prompt.
- **[MOBILE_APP_DEVELOPMENT_GUIDE.md](_legacy/MOBILE_APP_DEVELOPMENT_GUIDE.md)** — React Native mobile app dev guide (sub-project).
- **[RESEARCH_EVIDENCE_COMPILATION.md](_legacy/RESEARCH_EVIDENCE_COMPILATION.md)** — Evidence compilation for investor pitch.
- **[TIERS.md](_legacy/TIERS.md)** — ⚠ SUPERSEDED — Paddle-era tier design.

## Kept at repo root

- **CLAUDE.md** — agent operating rules + deploy workflow (harness-loaded).
- **CHANGES.md** — canonical change log (appended each deploy).
