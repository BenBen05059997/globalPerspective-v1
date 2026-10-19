# Studio redesign: bring your own hypothesis

Status: proposed (2026-10-19; not approved for build — decisions/0008)

Under review (2026-10-21): an overnight research and design debate (6 research reads, 4 user-group studies, 3 designs,
3 full plans, 2 judges; records in the untracked `.board/studio/`) recommends a different first version — a free,
assembled, no-model country sheet with marked fact/judgment lines, daily story-web history kept from now, and the
link ledger and workbench as later branches opened by measured signals. The operator decides; this plan is
superseded or rewritten only after that decision is recorded.

## Why
Decision 0001 makes the product an analyst tool over the story web: how a story formed, what it is likely to
trigger, and what would falsify a thesis. Decision 0011 keeps the Studio as a page with a public example. Today the
Studio does neither job: it writes a cited report over up to four of today's topics, and nobody runs it. It left
the menu on 2026-10-19 (decision 0030); this plan is what it has to become, and when it comes back.

## Measured state (2026-10-19, `.board/linking/studio.md`, `usage.md`; read-only)
- Use: `newsAnalyze` 0 invocations in 30 days (log streams only from 2026-07-10); `GlobalPerspectiveShares` holds 0
  items; `newsSharedAnalysis` 0 invocations in 14 days. Page visits are not knowable from logs (GA4 only).
- Deployed `newsAnalyze` (nodejs20.x, 120 s, 256 MB, last modified 2026-07-10) is a prompt-patched zip: its system
  prompt is pinned and STALE against the frontend's typed-source prompt (`lib/analysisPrompt.js` SYSTEM_PROMPT).
  The repo `src/index.js` differs by 126 lines (parked credits code, no daily cap, rewritten prompt), so it must not
  be deployed over the zip without a go-live decision (CLAUDE.md).
- Member path: `MAX_TOKENS` default 1600 on the server, which truncates the `gp-struct` JSON block that the scenario
  lens requires (BYOK runs cap at 2400, deep 3000). A non-member holding credits would get 403 (credits parked, 0002).
- Public example: `EXAMPLE_SHARE_ID` is `null` (`lib/sharedExample.js`), so signed-out visitors see "not ready yet".
- Story input: `?stories=` accepts only today's topic ids (topic ids change every run); citations carry no `threadId`.
- Missing for a hypothesis tool: no hypothesis input, no falsifier fields, no link from a run into the web, no
  scoring of a run against outcomes.

## What it becomes
One flow, public, read-first:
1. **State a hypothesis.** The reader writes one claim ("Iran's oil exports fall below X by March because …") and
   optionally picks stories. Stories are thread ids (stable), never topic ids.
2. **Place it in the web.** The tool finds the threads the claim touches and shows the `web_index` links between them
   (`features/threads/lib/webIndexLinks.js`: confidence, lagDays, mechanism, `cited[]`, shared actors), in the
   story-web wording of decision 0012 ("judged to feed into", never "caused").
3. **Evidence both ways.** Two lists, supporting and contradicting, each item a dated story entry with provenance
   (source, date, thread link) and a `ClaimTag` fact/judgment marker. Thin input says so (`THIN_GUARD`).
4. **Falsifiers as dated questions.** The tool proposes 1–3 falsifiers in the question schema
   (`backend/pipeline/NewsProjectInvokeAgentLambda/src/questions.js`: `text`, `deadline`, `p`, `resolutionSource`;
   `qidFor`) and runs them through `questionGate` (G7 no p, G8 generic source, G9 lead < 7 days, G10 restates
   reported news, G11 formality, G12 near-duplicate). A question that passes can be submitted to the track record
   as a reader-proposed question; it settles through the same weekly settle job (Q#/SETTLE#, decision 0027).
5. **Validate and share.** The existing validator (`lib/analysisValidator.js` + the server copy in
   `newsSharedAnalysis`: phantom/no citations, schema, invented figure/date, unused source, thin input) checks the
   run; sharing keeps the freeze-and-recheck path (re-fetch, freeze sources, 409 `sources_changed`, 422 on
   re-validation, unlisted + noindex per 0011 S2).

Kept as they are: BYOK in the browser, deep research as BYOK only, the lenses as optional framings of step 3.
Dropped: the free-form report as the main output.

## Work (each step one commit; build only on an explicit operator "build")
- [ ] H1 Input: hypothesis box + thread picker; `?stories=` takes thread ids (with L1's `studioHref`); citations carry
      `threadId` (L2).
- [ ] H2 Web placement: reuse `useWebIndex` + `webIndexLinks`; no new read action.
- [ ] H3 Evidence lists in the prompt contract and `gp-struct` (`supports[]`, `contradicts[]` with entry refs);
      validator learns the two lists (a cited ref must exist in the frozen sources).
- [ ] H4 Falsifiers: `gp-struct.falsifiers[]` in the question schema; a frontend mirror of `questionGate` (or a
      read action that runs the server one — decide in H4, no duplicated rules); submission path to the track
      record is a new Q# writer and needs its own design note (who may submit, rate limit, labelled "reader-proposed").
- [ ] H5 Server path: one prompt source for browser and server; raise the member output cap so `gp-struct` is never
      truncated; deployed `newsAnalyze` = repo (`scripts/lambda.sh newsAnalyze diff` clean).
- [ ] H6 Public example: the operator makes one real share and sets `EXAMPLE_SHARE_ID`.

## Return to the menu (all three, checked, not assumed)
1. A public example: `EXAMPLE_SHARE_ID` points at a real share that renders signed-out.
2. Sharing works end to end: a real POST to `NEWS_SHARE_ENDPOINT` freezes and re-validates, and the share page opens.
3. Deployed `newsAnalyze` matches the repo (`lambda.sh diff` shows no difference) with the current prompt.
Then a new decision record supersedes 0030 and `Layout.jsx` gets its menu item back.

## Open (operator)
- The repo `newsAnalyze` carries parked credits code (0002). Making deployed = repo means either deploying it with
  credits switched off or removing that code from the repo; both touch billing code and need a fresh yes.
- Whether reader-proposed questions enter the public track record, or a separate reader ledger.
- Whether the member server path stays (0 runs) or the Studio becomes BYOK-only.
