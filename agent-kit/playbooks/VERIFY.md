# Verify Playbook — how to know a change is good

> "How do I know my change is good before / during / after shipping it." Pick the right
> layer for the risk; the deeper the layer, the slower and the more it catches.

## The 4 layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Pre-commit       fast   |  typecheck + lint + unit tests    │
│ Layer 2 — Pre-deploy       medium |  verify-full (+ doc/contract gates)│
│ Layer 3 — Post-deploy smoke quick |  app actually renders, no crash   │
│ Layer 4 — Reviewer eyeball  mins  |  human confirms behavior matches   │
└──────────────────────────────────────────────────────────────────────┘
```

Each layer is cumulative — passing L3 implies L1+L2 passed. Skipping a layer is a deliberate,
stated trade-off, not a default.

## Layer 1 — Pre-commit (mandatory)

Goal: syntactically valid, follows patterns, doesn't break existing units.

```bash
cd <APP_DIR>
<VERIFY_CMD>      # typecheck + lint + tests in one shot
```

- **Enough for:** copy/i18n, renames, refactors with no behavior change, new unit tests.
- **Not enough for:** anything that adds a network call, changes routing/URL state, adds a
  new render path, or touches a backend function / data contract.
- Reading output: lint **warnings** are usually pre-existing and acceptable; **errors** block.
  Typecheck: silent = clean. Tests: every file should pass; a newly-skipped test is a question.

## Layer 2 — Pre-deploy (before push)

```bash
cd <APP_DIR> && <VERIFY_FULL_CMD>
```

Add here any repo-invariant checks: doc-tree integrity, data-contract / unit annotations,
i18n key parity across locales. These catch drift the compiler can't.

## Layer 3 — Post-deploy smoke

Confirm the page actually renders without a runtime crash.

```bash
# local, during dev:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/<route>
#   200 = renders · 3xx = auth redirect (healthy for gated routes) · 500 = bug (read the log) · 404 = routing mistake

# production, post-deploy:
cd <APP_DIR> && <SMOKE_CMD>
curl -s -o /dev/null -w "%{http_code}" <PROD_URL>    # MUST be 200
```

Smoke catches: hydration mismatches, missing i18n keys at runtime, async-effect crashes,
console errors at first paint. **It often skips the logged-out landing page** — so always
also `curl` the public root for `200` after a deploy.

> ⚠️ Deploy gotcha: a deploy can reuse a **stale build dir** → a no-op deploy that ships old
> code while smoke still passes. `rm -rf <CLEAN_BUILD_DIRS>` before a code-shipping deploy and
> confirm a new build/version id.

> ⚠️ Verifying **auth-gated** UI: use a **prod-mode local build** (`build && start`), not the
> dev server — dev-mode RSC fetches can drop the session cookie and bounce you to login mid-load,
> giving hollow passes. Or verify on the live domain post-deploy.

## Layer 4 — Reviewer eyeball

The human confirms visible behavior matches intent. When closing a tracked task, hand the
reviewer **one real verifiable action** ("open /X, hover the ? next to Y, confirm Z"), never a
vague "looks good."

## The independent-agent audit pattern

For page rewrites or anything where the author has blind spots, spawn an independent agent to
audit **before landing**:

```
Agent(subagent_type: project-manager | general-purpose, prompt:
  "Brief them cold: what the change is · what plan it followed · what I claim was done ·
   the exact files to read · numbered questions to answer · expected verdict format
   (ships clean / ships with caveats / has bugs). Cite file:line for every finding;
   trust nothing without a citation.")
```

**Use when:** any commit ≥ ~100 net lines, any cross-cutting refactor, any time you've been
deep in the code for hours. **Skip when:** trivial change you can verify yourself in < 5 min.

## The 5-minute rule for skipping layers

| Change effort | Minimum layers |
|---|---|
| Trivial (< 5 min, < 10 LOC) | L1 |
| Small (< 30 min) | L1 + L2 |
| Medium (< 4 h) | L1 + L2 + L3 local |
| Large / cross-cutting | L1 + L2 + L3 local + prod + L4 |
| Major (rewrite, schema migration) | All 4 + independent agent audit |

If you skip a layer, **say so in the commit body**: "Verify: L1+L2 only — copy change, no fetch surface."

## Anti-patterns (real burns)

1. Skipping L1 typecheck "because the change is small" — it catches the type drift you didn't see.
2. "Tests pass" without running tests **on the changed area** — full-suite green ≠ your path covered.
3. Calling a backend fix done before reading its **logs** — backend errors are silent at the API layer.
4. Closing a task without a smoke line the reviewer can actually run.
5. Committing without `git status --short` first — the tree often has unrelated in-flight changes.
6. Skipping the independent audit on a rewrite "to save tokens" — it pays for itself every time.
