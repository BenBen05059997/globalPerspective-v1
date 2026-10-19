# Analysis Studio — surfacing plan (put `/analyze` where reading-intent is highest)

**Status: ✅ SHIPPED + DEPLOYED 2026-07-09 (main `8cf2b29`, bundle `index-CpD8j76i.js` live-verified). ALL surfaces ①②③④ + the §3 enabler shipped in one pass.** Built by a Sonnet subagent (4 commits), reviewed + pushed + deployed by Opus. Engine live-tested + verified good same day (§2). Deploy needed a fresh explicit operator "yes" (the auto-mode classifier correctly blocked the first attempt under "execute all").
Self-contained for a hand-off agent. Parents: `ANALYSIS_STUDIO_PLAN.md` (the feature), memory `project_analysis_studio` (quality/verify history). Sibling pattern proven: `FOLLOW_SURFACING_PLAN.md` (same "invisible feature → surface at the intent moment" fix that unblocked FollowButton).

---

## 1. Why — the problem

`/analyze` (Analysis Studio: pick up to 4 real stories → cited, audited AI deep-dive over our own SUMMARY/PREDICTION/TRACE_CAUSE) is surfaced on **exactly one nav link** (`Layout.jsx` line 69, "Analyze" under the *markets* group) and **nothing else** — zero presence on Home, zero cross-links from the story/thread/country/economy pages where analysis intent actually lives. Verified 2026-07-09 (grep). This is almost certainly why usage is ~2 runs/30d — the same under-surfacing that kept FollowButton at 0 followers. It is NOT a quality problem (see §2).

## 2. Engine is verified good (live test, 2026-07-09 — do not re-litigate)

Ran `quality/analysis/check.mjs` against **today's live stories** (Iran ceasefire / NATO £37bn / German doctor), full pipeline: generate (`deepseek-v4-flash`) → deterministic validator → cross-model faithfulness auditor (`deepseek-v4-pro`).

- **Validator: 0/3 fabrication** — no phantom citations, no invented figures/dates.
- **Output is desk-grade.** Iran scenario lens gave 3 *distinct* scenarios (Managed Escalation 60-70% / Stalemate 15-20% / Full War 15-20% — partition ~100%, real downside tail), each with triggers + confirming/killing evidence + structural drivers, and correctly tags its own background/general-knowledge claims `(analyst context)` instead of laundering them through `[n]`. The honesty contract works.
- **Auditor over-flags — known + acceptable.** It flagged 3/3, but on inspection the worst-looking flag ("Iran targeted Bahrain & Kuwait — not in source") was a **false positive**: that claim is literally in the story *title* (`[1]`), correctly cited; the auditor only weighed the summary body. The other two were mild framing overreach / a hedged inference. The auditor is deliberately paranoid — it's a human-review aid, not a gate. Don't treat a lone auditor flag as proof of fabrication.

**Verdict: good enough to charge for; the gap is discovery, not quality.** (Credits themselves remain PARKED — separate decision, `project_member_gating` / `POLAR_BILLING_PLAN.md` §5. This plan is about surfacing the FREE/BYOK entry point, which is the funnel.)

## 3. The enabler — `?stories=` preselect (build this regardless of which surfaces are chosen)

Verified 2026-07-09: `AnalysisStudio.jsx` starts with `const [selected, setSelected] = useState([])` (topicIds) and reads **no query param**. So every "Analyze this →" button below is a dead end unless the Studio can accept a preselected story.

**Change (`AnalysisStudio.jsx`, ~5 lines, self-contained):**
- `import { useSearchParams } from 'react-router-dom';`
- Seed `selected` from `?stories=<id>[,<id>…]` on mount (only IDs that exist in the loaded `topics`; cap at `MAX_STORIES`). Once the topics list resolves, intersect the param IDs with real topicIds so a stale/unknown id is silently dropped (honest — no dead selection).
- Leave everything else untouched; an empty/absent param = today's behavior (empty selection).

This makes any surface a one-line `<Link to={`/analyze?stories=${id}`}>`.

## 4. Surfaces — recommendation (operator picks the subset; §6 asks)

Ordered by intent × traffic. **Not mutually exclusive.**

- **① Topics / Home per-story "Analyze →" — TOP PICK.** `Home.jsx` line ~502 `home-topic-actions` → `home-ai-row` already renders 3 per-story buttons (Summary / Predict / Trace Cause, keyed by `id = t.topicId`). Add a 4th as a **`<Link>`** (it navigates away — not a generate button) `to={`/analyze?stories=${id}`}` labelled "Analyze". Highest-traffic page + selection is the native action there + it's the entry page where discovery has to happen. One small CSS touch so the Link matches the `.home-ai-btn` pill shape (an `<a>` styled as the button; reuse the class, it's presentational).
- **② ThreadPage "Analyze this arc" — clean second surface.** A thread is a single, high-intent, focused story; the reader is already deep in it. One `<Link>` in the Arc Intelligence rail → `/analyze?stories=<primaryTopicId>`. Confirm the thread exposes a single follow-key topicId (threads carry multiple `regions`; use the thread's lead/primary topic, not the region list — mirror the FollowButton multi-country caution).
- **③ Home value-prop strip — awareness, cheap.** One line in the Home hero/trust strip ("Run a cited, fabrication-checked AI deep-dive on any stories → /analyze") so first-time visitors LEARN it exists. Coordinate with the existing site-orientation trust strip (don't duplicate).
- **④ Economy cross-link — nice-to-have, DEFER.** Same nav group; "Analyze what's repricing markets today" from `/economy`. Thematically tight but lower marginal discovery than ①. Do in a later round.

## 5. Verify + deploy gate

- Build: `cd global-perspectives-starter/frontend && npm run verify` (eslint + vitest + build) → green.
- Sanity: `/analyze?stories=<real-id>` preselects that story; `?stories=<bogus>` → empty selection (no crash, no dead chip); no param → unchanged. The per-story Link renders as a pill and does NOT nest inside another anchor (Home story title is a separate `<Link>` — keep the Analyze Link a sibling, not nested).
- **Deploy = GATED (needs explicit operator "yes"):** frontend `./deploy.sh` (build → copy `dist/` to `docs/` → strip `docs/assets/*.map` → resync `docs/404.html` byte-identical → hash-guard `docs/config.js`). Do NOT deploy without fresh auth. Live-verify after: Home story cards show "Analyze →"; clicking loads the Studio with the story preselected.

## 6. Open decision for the operator (asked 2026-07-09; answer to unblock the build)
Which surfaces from §4 to ship this round? Recommended: **① + ③** (entry-page button for intent + one awareness line), with ② as a fast follow. All share the §3 enabler, so §3 gets built no matter what.

## 7. Non-negotiables
- Studio gating unchanged — `/analyze` still requires a signed-in non-anon user for the run itself; the preselect + Links are pre-auth navigation only (they don't bypass the sign-in overlay).
- Preselect is honest — unknown/stale ids silently dropped, never a fake chip ([[feedback_no_misinformation_fallback]]).
- Per-story Analyze control is a sibling `<Link>`, never nested in the title anchor (no `<a>`-in-`<a>`).
- Deploy via `./deploy.sh` only (handles 404 resync + map strip); never hand-copy; never without explicit auth.
